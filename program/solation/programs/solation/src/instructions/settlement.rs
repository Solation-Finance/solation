use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use crate::state::*;
use crate::constants::*;
use crate::errors::ErrorCode;

// Settle position
#[derive(Accounts)]
pub struct SettlePosition<'info> {
    #[account(
        mut,
        constraint = position.status == PositionStatus::Active @ ErrorCode::PositionNotActive
    )]
    pub position: Account<'info, Position>,

    #[account(
        seeds = [ASSET_CONFIG_SEED, asset_config.asset_mint.as_ref()],
        bump = asset_config.bump
    )]
    pub asset_config: Account<'info, AssetConfig>,

    #[account(
        mut,
        seeds = [MARKET_MAKER_SEED, market_maker.owner.as_ref()],
        bump = market_maker.bump
    )]
    pub market_maker: Account<'info, MarketMaker>,

    // Position vaults
    #[account(
        mut,
        token::authority = position_vault_authority
    )]
    pub position_user_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::authority = position_vault_authority
    )]
    pub position_mm_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for position vaults (derived with position_id)
    pub position_vault_authority: AccountInfo<'info>,

    // Market maker's vault (to unlock liquidity)
    #[account(
        mut,
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), mm_vault.asset_mint.as_ref()],
        bump = mm_vault.bump
    )]
    pub mm_vault: Account<'info, MarketMakerVault>,

    // Destination accounts for settlement
    #[account(mut)]
    pub user_destination: Account<'info, TokenAccount>,

    #[account(mut)]
    pub mm_destination: Account<'info, TokenAccount>,

    // Pyth price feed
    /// CHECK: Validated by Pyth SDK
    pub price_update: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_settle_position(mut ctx: Context<SettlePosition>) -> Result<()> {
    let clock = Clock::get()?;

    // Check position has expired
    require!(
        clock.unix_timestamp >= ctx.accounts.position.expiry_timestamp,
        ErrorCode::PositionNotExpired
    );

    // Load Pyth price update and extract settlement price
    let settlement_price = {
        let price_update_account = &ctx.accounts.price_update;
        let price_update_data = price_update_account.try_borrow_data()
            .map_err(|_| ErrorCode::PriceTooStale)?;

        let price_update = PriceUpdateV2::try_from_slice(&price_update_data)
            .map_err(|_| ErrorCode::PriceTooStale)?;

        // Get price with staleness check
        // Note: Pyth SDK v1.x uses get_price_unchecked
        let price = price_update.get_price_unchecked(&ctx.accounts.asset_config.pyth_feed_id)
            .map_err(|_| ErrorCode::PythFeedIdMismatch)?;

        // Manual staleness check
        let price_timestamp = price_update.price_message.publish_time;
        require!(
            clock.unix_timestamp - price_timestamp < PYTH_STALENESS_THRESHOLD as i64,
            ErrorCode::PriceTooStale
        );

        // Verify feed ID matches
        require!(
            price_update.price_message.feed_id == ctx.accounts.asset_config.pyth_feed_id,
            ErrorCode::PythFeedIdMismatch
        );

        // Convert price to u64 (handle negative prices by taking absolute value)
        price.price.abs() as u64
    };

    msg!("Settlement price: {}", settlement_price);
    msg!("Strike price: {}", ctx.accounts.position.strike_price);

    // Store settlement price and strategy before borrowing ctx mutably
    ctx.accounts.position.settlement_price = Some(settlement_price);
    let strategy = ctx.accounts.position.strategy;
    let position_key = ctx.accounts.position.key();

    // Settle based on strategy
    match strategy {
        StrategyType::CoveredCall => {
            settle_covered_call(&mut ctx, settlement_price)?;
        }
        StrategyType::CashSecuredPut => {
            settle_cash_secured_put(&mut ctx, settlement_price)?;
        }
    }

    msg!("Position settled: {}", position_key);

    Ok(())
}

fn settle_covered_call(
    ctx: &mut Context<SettlePosition>,
    settlement_price: u64,
) -> Result<()> {
    // Extract position data before any mutable borrows
    let position_bump = ctx.accounts.position.bump;
    let position_user = ctx.accounts.position.user;
    let position_id = ctx.accounts.position.position_id;
    let contract_size = ctx.accounts.position.contract_size;
    let strike_price = ctx.accounts.position.strike_price;

    let position_seeds = &[
        POSITION_SEED,
        position_user.as_ref(),
        &position_id.to_le_bytes(),
        &[position_bump],
    ];
    let signer = &[&position_seeds[..]];


    if settlement_price > strike_price {
        // ITM: MM exercises
        ctx.accounts.position.status = PositionStatus::SettledITM;

        // Transfer underlying from position_user_vault to MM
        let cpi_accounts_underlying = Transfer {
            from: ctx.accounts.position_user_vault.to_account_info(),
            to: ctx.accounts.mm_destination.to_account_info(),
            authority: ctx.accounts.position_vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_underlying,
                signer,
            ),
            contract_size,
        )?;

        // Transfer USDC from position_mm_vault to user
        let cpi_accounts_usdc = Transfer {
            from: ctx.accounts.position_mm_vault.to_account_info(),
            to: ctx.accounts.user_destination.to_account_info(),
            authority: ctx.accounts.position_vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_usdc,
                signer,
            ),
            ctx.accounts.position_mm_vault.amount,
        )?;

        msg!("Covered call settled ITM - MM exercised");
    } else {
        // OTM: Expires worthless
        ctx.accounts.position.status = PositionStatus::SettledOTM;

        // Transfer underlying back to user
        let cpi_accounts_underlying = Transfer {
            from: ctx.accounts.position_user_vault.to_account_info(),
            to: ctx.accounts.user_destination.to_account_info(),
            authority: ctx.accounts.position_vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_underlying,
                signer,
            ),
            contract_size,
        )?;

        // Transfer USDC back to MM
        let cpi_accounts_usdc = Transfer {
            from: ctx.accounts.position_mm_vault.to_account_info(),
            to: ctx.accounts.mm_destination.to_account_info(),
            authority: ctx.accounts.position_vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_usdc,
                signer,
            ),
            ctx.accounts.position_mm_vault.amount,
        )?;

        msg!("Covered call settled OTM - User keeps underlying");
    }

    // Update market maker stats
    let market_maker = &mut ctx.accounts.market_maker;
    market_maker.completed_positions = market_maker
        .completed_positions
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    // Unlock MM vault liquidity
    let mm_vault = &mut ctx.accounts.mm_vault;
    let strike_amount = strike_price
        .checked_mul(contract_size)
        .ok_or(ErrorCode::MathOverflow)?;

    mm_vault.locked_liquidity = mm_vault
        .locked_liquidity
        .checked_sub(strike_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}

fn settle_cash_secured_put(
    ctx: &mut Context<SettlePosition>,
    settlement_price: u64,
) -> Result<()> {
    // Extract position data before any mutable borrows
    let position_bump = ctx.accounts.position.bump;
    let position_user = ctx.accounts.position.user;
    let position_id = ctx.accounts.position.position_id;
    let contract_size = ctx.accounts.position.contract_size;
    let strike_price = ctx.accounts.position.strike_price;

    let position_seeds = &[
        POSITION_SEED,
        position_user.as_ref(),
        &position_id.to_le_bytes(),
        &[position_bump],
    ];
    let signer = &[&position_seeds[..]];

    if settlement_price < strike_price {
        // ITM: User exercises
        ctx.accounts.position.status = PositionStatus::SettledITM;

        // Transfer underlying from position_mm_vault to user
        let cpi_accounts_underlying = Transfer {
            from: ctx.accounts.position_mm_vault.to_account_info(),
            to: ctx.accounts.user_destination.to_account_info(),
            authority: ctx.accounts.position_vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_underlying,
                signer,
            ),
            contract_size,
        )?;

        // Transfer USDC from position_user_vault to MM
        let cpi_accounts_usdc = Transfer {
            from: ctx.accounts.position_user_vault.to_account_info(),
            to: ctx.accounts.mm_destination.to_account_info(),
            authority: ctx.accounts.position_vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_usdc,
                signer,
            ),
            ctx.accounts.position_user_vault.amount,
        )?;

        msg!("Cash secured put settled ITM - User exercised");
    } else {
        // OTM: Expires worthless
        ctx.accounts.position.status = PositionStatus::SettledOTM;

        // Transfer USDC back to user
        let cpi_accounts_usdc = Transfer {
            from: ctx.accounts.position_user_vault.to_account_info(),
            to: ctx.accounts.user_destination.to_account_info(),
            authority: ctx.accounts.position_vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_usdc,
                signer,
            ),
            ctx.accounts.position_user_vault.amount,
        )?;

        // Transfer underlying back to MM
        let cpi_accounts_underlying = Transfer {
            from: ctx.accounts.position_mm_vault.to_account_info(),
            to: ctx.accounts.mm_destination.to_account_info(),
            authority: ctx.accounts.position_vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_underlying,
                signer,
            ),
            contract_size,
        )?;

        msg!("Cash secured put settled OTM - User gets USDC back");
    }

    // Update market maker stats
    let market_maker = &mut ctx.accounts.market_maker;
    market_maker.completed_positions = market_maker
        .completed_positions
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    // Unlock MM vault liquidity
    let mm_vault = &mut ctx.accounts.mm_vault;
    mm_vault.locked_liquidity = mm_vault
        .locked_liquidity
        .checked_sub(contract_size)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}
