use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::state::*;
use crate::constants::*;
use crate::errors::ErrorCode;

// Create position
#[derive(Accounts)]
#[instruction(position_id: u64)]
pub struct CreatePosition<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_STATE_SEED],
        bump = global_state.bump,
        constraint = !global_state.paused @ ErrorCode::ProtocolPaused
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        seeds = [MARKET_MAKER_SEED, market_maker.owner.as_ref()],
        bump = market_maker.bump,
        constraint = market_maker.active @ ErrorCode::MarketMakerNotActive
    )]
    pub market_maker: Account<'info, MarketMaker>,

    #[account(
        mut,
        seeds = [
            QUOTE_SEED,
            market_maker.key().as_ref(),
            quote.asset_mint.as_ref(),
            &[quote.strategy as u8]
        ],
        bump = quote.bump,
        constraint = quote.active @ ErrorCode::QuoteNotActive
    )]
    pub quote: Account<'info, Quote>,

    #[account(
        seeds = [ASSET_CONFIG_SEED, asset_config.asset_mint.as_ref()],
        bump = asset_config.bump,
        constraint = asset_config.enabled @ ErrorCode::AssetNotEnabled
    )]
    pub asset_config: Account<'info, AssetConfig>,

    // Position account
    #[account(
        init,
        payer = user,
        space = Position::LEN,
        seeds = [POSITION_SEED, user.key().as_ref(), &position_id.to_le_bytes()],
        bump
    )]
    pub position: Account<'info, Position>,

    // User's vault (holds user's locked asset)
    #[account(
        init,
        payer = user,
        token::mint = user_asset_mint,
        token::authority = position_user_vault_authority,
        seeds = [POSITION_USER_VAULT_SEED, position.key().as_ref()],
        bump
    )]
    pub position_user_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for user vault
    #[account(
        seeds = [POSITION_SEED, user.key().as_ref(), &position_id.to_le_bytes()],
        bump
    )]
    pub position_user_vault_authority: AccountInfo<'info>,

    // MM's vault (holds MM's locked asset)
    #[account(
        init,
        payer = user,
        token::mint = mm_asset_mint,
        token::authority = position_mm_vault_authority,
        seeds = [POSITION_MM_VAULT_SEED, position.key().as_ref()],
        bump
    )]
    pub position_mm_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for MM vault
    #[account(
        seeds = [POSITION_SEED, user.key().as_ref(), &position_id.to_le_bytes()],
        bump
    )]
    pub position_mm_vault_authority: AccountInfo<'info>,

    // Market maker's vault account
    #[account(
        mut,
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), mm_vault.asset_mint.as_ref()],
        bump = mm_vault.bump
    )]
    pub mm_vault: Account<'info, MarketMakerVault>,

    #[account(
        mut,
        token::mint = mm_asset_mint
    )]
    pub mm_vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for MM vault
    #[account(
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), mm_vault.asset_mint.as_ref()],
        bump = mm_vault.bump
    )]
    pub mm_vault_authority: AccountInfo<'info>,

    // MM's premium vault (USDC for premium payment)
    #[account(
        mut,
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), premium_mint.key().as_ref()],
        bump = mm_premium_vault.bump
    )]
    pub mm_premium_vault: Account<'info, MarketMakerVault>,

    #[account(
        mut,
        token::mint = premium_mint
    )]
    pub mm_premium_vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for MM premium vault
    #[account(
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), premium_mint.key().as_ref()],
        bump = mm_premium_vault.bump
    )]
    pub mm_premium_vault_authority: AccountInfo<'info>,

    // User's token accounts
    #[account(
        mut,
        token::mint = user_asset_mint,
        token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = premium_mint,
        token::authority = user
    )]
    pub user_premium_account: Account<'info, TokenAccount>,

    // Mints
    pub user_asset_mint: Account<'info, Mint>,
    pub mm_asset_mint: Account<'info, Mint>,
    pub premium_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_position(
    ctx: Context<CreatePosition>,
    position_id: u64,
    strike_price: u64,
    contract_size: u64,
) -> Result<()> {
    let clock = Clock::get()?;

    // Validate quote not expired
    require!(
        clock.unix_timestamp < ctx.accounts.quote.expiry_timestamp,
        ErrorCode::QuoteExpired
    );

    // Validate contract size
    require!(
        contract_size >= ctx.accounts.quote.min_size,
        ErrorCode::ContractSizeTooSmall
    );
    require!(
        contract_size <= ctx.accounts.quote.max_size,
        ErrorCode::ContractSizeTooLarge
    );

    // Find strike in quote
    let strike_quote = ctx.accounts.quote
        .strikes
        .iter()
        .find(|s| s.strike_price == strike_price)
        .ok_or(ErrorCode::StrikePriceNotFound)?;

    // Check available contracts
    require!(
        contract_size <= strike_quote.available_contracts,
        ErrorCode::InsufficientLiquidity
    );

    // Calculate premium
    let premium = strike_quote
        .premium_per_contract
        .checked_mul(contract_size)
        .ok_or(ErrorCode::MathOverflow)?;

    // Strategy-specific logic
    let strategy = ctx.accounts.quote.strategy;
    match strategy {
        StrategyType::CoveredCall => {
            handle_covered_call_position(ctx, position_id, strike_price, contract_size, premium)
        }
        StrategyType::CashSecuredPut => {
            handle_cash_secured_put_position(ctx, position_id, strike_price, contract_size, premium)
        }
    }
}

fn handle_covered_call_position(
    mut ctx: Context<CreatePosition>,
    position_id: u64,
    strike_price: u64,
    contract_size: u64,
    premium: u64,
) -> Result<()> {
    // Covered Call:
    // - User deposits underlying asset (contract_size)
    // - MM locks USDC (strike_price * contract_size)
    // - MM pays premium to user immediately

    let strike_amount = strike_price
        .checked_mul(contract_size)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10u64.pow(ctx.accounts.asset_config.decimals as u32))
        .ok_or(ErrorCode::MathOverflow)?;

    // Check MM has enough USDC liquidity
    require!(
        ctx.accounts.mm_vault.available_liquidity >= strike_amount,
        ErrorCode::InsufficientLiquidity
    );

    // Check MM has enough premium USDC
    require!(
        ctx.accounts.mm_premium_vault.available_liquidity >= premium,
        ErrorCode::InsufficientLiquidity
    );

    // 1. Transfer user's underlying asset to position_user_vault
    let cpi_accounts_user = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.position_user_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new(cpi_program.clone(), cpi_accounts_user),
        contract_size,
    )?;

    // 2. Transfer MM's USDC to position_mm_vault
    let market_maker_key = ctx.accounts.market_maker.key();
    let asset_mint_key = ctx.accounts.mm_vault.asset_mint;
    let mm_vault_bump = ctx.accounts.mm_vault.bump;
    let mm_vault_seeds = &[
        MM_VAULT_SEED,
        market_maker_key.as_ref(),
        asset_mint_key.as_ref(),
        &[mm_vault_bump],
    ];
    let mm_vault_signer = &[&mm_vault_seeds[..]];

    let cpi_accounts_mm = Transfer {
        from: ctx.accounts.mm_vault_token_account.to_account_info(),
        to: ctx.accounts.position_mm_vault.to_account_info(),
        authority: ctx.accounts.mm_vault_authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_mm, mm_vault_signer),
        strike_amount,
    )?;

    // 3. Transfer premium from MM to user
    let premium_mint_key = ctx.accounts.mm_premium_vault.asset_mint;
    let mm_premium_bump = ctx.accounts.mm_premium_vault.bump;
    let mm_premium_seeds = &[
        MM_VAULT_SEED,
        market_maker_key.as_ref(),
        premium_mint_key.as_ref(),
        &[mm_premium_bump],
    ];
    let mm_premium_signer = &[&mm_premium_seeds[..]];

    let cpi_accounts_premium = Transfer {
        from: ctx.accounts.mm_premium_vault_token_account.to_account_info(),
        to: ctx.accounts.user_premium_account.to_account_info(),
        authority: ctx.accounts.mm_premium_vault_authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts_premium, mm_premium_signer),
        premium,
    )?;

    // 4. Update MM vault liquidity
    ctx.accounts.mm_vault.available_liquidity = ctx.accounts.mm_vault
        .available_liquidity
        .checked_sub(strike_amount)
        .ok_or(ErrorCode::MathOverflow)?;
    ctx.accounts.mm_vault.locked_liquidity = ctx.accounts.mm_vault
        .locked_liquidity
        .checked_add(strike_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    ctx.accounts.mm_premium_vault.available_liquidity = ctx.accounts.mm_premium_vault
        .available_liquidity
        .checked_sub(premium)
        .ok_or(ErrorCode::MathOverflow)?;

    // 5. Initialize position
    initialize_position(
        &mut ctx,
        position_id,
        strike_price,
        contract_size,
        premium,
    )?;

    // 6. Update global state
    ctx.accounts.global_state.total_positions = ctx.accounts.global_state
        .total_positions
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    ctx.accounts.global_state.total_volume = ctx.accounts.global_state
        .total_volume
        .checked_add(contract_size)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!("Covered call position created: {}", ctx.accounts.position.key());

    Ok(())
}

fn handle_cash_secured_put_position(
    mut ctx: Context<CreatePosition>,
    position_id: u64,
    strike_price: u64,
    contract_size: u64,
    premium: u64,
) -> Result<()> {
    // Cash Secured Put:
    // - MM deposits underlying asset (contract_size)
    // - User deposits USDC (strike_price * contract_size)
    // - MM pays premium to user immediately

    let strike_amount = strike_price
        .checked_mul(contract_size)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10u64.pow(ctx.accounts.asset_config.decimals as u32))
        .ok_or(ErrorCode::MathOverflow)?;

    // Check MM has enough underlying asset
    require!(
        ctx.accounts.mm_vault.available_liquidity >= contract_size,
        ErrorCode::InsufficientLiquidity
    );

    // Check MM has enough premium USDC
    require!(
        ctx.accounts.mm_premium_vault.available_liquidity >= premium,
        ErrorCode::InsufficientLiquidity
    );

    // 1. Transfer user's USDC to position_user_vault
    let cpi_accounts_user = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.position_user_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new(cpi_program.clone(), cpi_accounts_user),
        strike_amount,
    )?;

    // 2. Transfer MM's underlying asset to position_mm_vault
    let market_maker_key = ctx.accounts.market_maker.key();
    let asset_mint_key = ctx.accounts.mm_vault.asset_mint;
    let mm_vault_bump = ctx.accounts.mm_vault.bump;
    let mm_vault_seeds = &[
        MM_VAULT_SEED,
        market_maker_key.as_ref(),
        asset_mint_key.as_ref(),
        &[mm_vault_bump],
    ];
    let mm_vault_signer = &[&mm_vault_seeds[..]];

    let cpi_accounts_mm = Transfer {
        from: ctx.accounts.mm_vault_token_account.to_account_info(),
        to: ctx.accounts.position_mm_vault.to_account_info(),
        authority: ctx.accounts.mm_vault_authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_mm, mm_vault_signer),
        contract_size,
    )?;

    // 3. Transfer premium from MM to user
    let premium_mint_key = ctx.accounts.mm_premium_vault.asset_mint;
    let mm_premium_bump = ctx.accounts.mm_premium_vault.bump;
    let mm_premium_seeds = &[
        MM_VAULT_SEED,
        market_maker_key.as_ref(),
        premium_mint_key.as_ref(),
        &[mm_premium_bump],
    ];
    let mm_premium_signer = &[&mm_premium_seeds[..]];

    let cpi_accounts_premium = Transfer {
        from: ctx.accounts.mm_premium_vault_token_account.to_account_info(),
        to: ctx.accounts.user_premium_account.to_account_info(),
        authority: ctx.accounts.mm_premium_vault_authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts_premium, mm_premium_signer),
        premium,
    )?;

    // 4. Update MM vault liquidity
    ctx.accounts.mm_vault.available_liquidity = ctx.accounts.mm_vault
        .available_liquidity
        .checked_sub(contract_size)
        .ok_or(ErrorCode::MathOverflow)?;
    ctx.accounts.mm_vault.locked_liquidity = ctx.accounts.mm_vault
        .locked_liquidity
        .checked_add(contract_size)
        .ok_or(ErrorCode::MathOverflow)?;

    ctx.accounts.mm_premium_vault.available_liquidity = ctx.accounts.mm_premium_vault
        .available_liquidity
        .checked_sub(premium)
        .ok_or(ErrorCode::MathOverflow)?;

    // 5. Initialize position
    initialize_position(
        &mut ctx,
        position_id,
        strike_price,
        contract_size,
        premium,
    )?;

    // 6. Update global state
    ctx.accounts.global_state.total_positions = ctx.accounts.global_state
        .total_positions
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    ctx.accounts.global_state.total_volume = ctx.accounts.global_state
        .total_volume
        .checked_add(contract_size)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!("Cash secured put position created: {}", ctx.accounts.position.key());

    Ok(())
}

fn initialize_position(
    ctx: &mut Context<CreatePosition>,
    position_id: u64,
    strike_price: u64,
    contract_size: u64,
    premium: u64,
) -> Result<()> {
    let clock = Clock::get()?;
    let position = &mut ctx.accounts.position;

    position.position_id = position_id;
    position.user = ctx.accounts.user.key();
    position.market_maker = ctx.accounts.market_maker.key();
    position.strategy = ctx.accounts.quote.strategy;
    position.asset_mint = ctx.accounts.asset_config.asset_mint;
    position.quote_mint = ctx.accounts.quote.quote_mint;
    position.strike_price = strike_price;
    position.premium_paid = premium;
    position.contract_size = contract_size;
    position.created_at = clock.unix_timestamp;
    position.expiry_timestamp = ctx.accounts.quote.expiry_timestamp;
    position.settlement_price = None;
    position.status = PositionStatus::Active;
    position.user_vault = ctx.accounts.position_user_vault.key();
    position.mm_vault_locked = ctx.accounts.position_mm_vault.key();
    position.bump = ctx.bumps.position;
    position.user_vault_bump = ctx.bumps.position_user_vault;
    position.mm_vault_bump = ctx.bumps.position_mm_vault;

    Ok(())
}
