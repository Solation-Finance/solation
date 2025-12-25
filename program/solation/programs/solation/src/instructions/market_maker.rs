use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::state::*;
use crate::constants::*;
use crate::errors::ErrorCode;

// Register as market maker
#[derive(Accounts)]
pub struct RegisterMarketMaker<'info> {
    #[account(
        init,
        payer = owner,
        space = MarketMaker::LEN,
        seeds = [MARKET_MAKER_SEED, owner.key().as_ref()],
        bump
    )]
    pub market_maker: Account<'info, MarketMaker>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_register_market_maker(ctx: Context<RegisterMarketMaker>) -> Result<()> {
    let market_maker = &mut ctx.accounts.market_maker;

    market_maker.owner = ctx.accounts.owner.key();
    market_maker.active = true;
    market_maker.total_positions = 0;
    market_maker.completed_positions = 0;
    market_maker.reputation_score = 100;
    market_maker.bump = ctx.bumps.market_maker;

    msg!("Market maker registered: {}", market_maker.owner);

    Ok(())
}

// Initialize vault (one-time setup per MM per asset)
#[derive(Accounts)]
#[instruction(asset_mint: Pubkey)]
pub struct InitializeVault<'info> {
    #[account(
        seeds = [MARKET_MAKER_SEED, owner.key().as_ref()],
        bump = market_maker.bump
    )]
    pub market_maker: Account<'info, MarketMaker>,

    #[account(
        init,
        payer = owner,
        space = MarketMakerVault::LEN,
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), asset_mint.as_ref()],
        bump
    )]
    pub mm_vault: Account<'info, MarketMakerVault>,

    #[account(
        init,
        payer = owner,
        token::mint = asset_mint_account,
        token::authority = vault_authority,
        seeds = [VAULT_TOKEN_ACCOUNT_SEED, market_maker.key().as_ref(), asset_mint.as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for vault
    #[account(
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), asset_mint.as_ref()],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub asset_mint_account: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_vault(
    ctx: Context<InitializeVault>,
    asset_mint: Pubkey,
) -> Result<()> {
    let mm_vault = &mut ctx.accounts.mm_vault;

    // Initialize vault state
    mm_vault.market_maker = ctx.accounts.market_maker.key();
    mm_vault.asset_mint = asset_mint;
    mm_vault.vault_token_account = ctx.accounts.vault_token_account.key();
    mm_vault.total_deposited = 0;
    mm_vault.available_liquidity = 0;
    mm_vault.locked_liquidity = 0;
    mm_vault.bump = ctx.bumps.mm_vault;
    mm_vault.vault_bump = ctx.bumps.vault_token_account;

    msg!("Vault initialized for asset: {}", asset_mint);

    Ok(())
}

// Deposit liquidity into existing vault
#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
    #[account(
        seeds = [MARKET_MAKER_SEED, owner.key().as_ref()],
        bump = market_maker.bump
    )]
    pub market_maker: Account<'info, MarketMaker>,

    #[account(
        mut,
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), mm_vault.asset_mint.as_ref()],
        bump = mm_vault.bump
    )]
    pub mm_vault: Account<'info, MarketMakerVault>,

    #[account(
        mut,
        token::mint = asset_mint,
        token::authority = vault_authority
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for vault
    #[account(
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), mm_vault.asset_mint.as_ref()],
        bump = mm_vault.bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub asset_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = asset_mint,
        token::authority = owner
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_deposit_liquidity(
    ctx: Context<DepositLiquidity>,
    amount: u64,
) -> Result<()> {
    let mm_vault = &mut ctx.accounts.mm_vault;

    // Transfer tokens from owner to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.owner_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Update vault state
    mm_vault.total_deposited = mm_vault
        .total_deposited
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    mm_vault.available_liquidity = mm_vault
        .available_liquidity
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!("Deposited {} tokens to vault", amount);

    Ok(())
}

// Withdraw liquidity from vault
#[derive(Accounts)]
pub struct WithdrawLiquidity<'info> {
    #[account(
        seeds = [MARKET_MAKER_SEED, owner.key().as_ref()],
        bump = market_maker.bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub market_maker: Account<'info, MarketMaker>,

    #[account(
        mut,
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), mm_vault.asset_mint.as_ref()],
        bump = mm_vault.bump
    )]
    pub mm_vault: Account<'info, MarketMakerVault>,

    #[account(
        mut,
        token::mint = asset_mint,
        token::authority = vault_authority
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for vault
    #[account(
        seeds = [MM_VAULT_SEED, market_maker.key().as_ref(), mm_vault.asset_mint.as_ref()],
        bump = mm_vault.bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub asset_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = asset_mint,
        token::authority = owner
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw_liquidity(
    ctx: Context<WithdrawLiquidity>,
    amount: u64,
) -> Result<()> {
    let mm_vault = &mut ctx.accounts.mm_vault;

    // Check sufficient available liquidity
    require!(
        mm_vault.available_liquidity >= amount,
        ErrorCode::InsufficientLiquidity
    );

    // Transfer tokens from vault to owner
    let market_maker_key = ctx.accounts.market_maker.key();
    let asset_mint_key = mm_vault.asset_mint;
    let seeds = &[
        MM_VAULT_SEED,
        market_maker_key.as_ref(),
        asset_mint_key.as_ref(),
        &[mm_vault.bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.owner_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;

    // Update vault state
    mm_vault.available_liquidity = mm_vault
        .available_liquidity
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!("Withdrawn {} tokens from vault", amount);

    Ok(())
}

// Submit quote
#[derive(Accounts)]
#[instruction(asset_mint: Pubkey, quote_mint: Pubkey, strategy: StrategyType, expiry_timestamp: i64)]
pub struct SubmitQuote<'info> {
    #[account(
        seeds = [MARKET_MAKER_SEED, owner.key().as_ref()],
        bump = market_maker.bump,
        has_one = owner @ ErrorCode::Unauthorized,
        constraint = market_maker.active @ ErrorCode::MarketMakerNotActive
    )]
    pub market_maker: Account<'info, MarketMaker>,

    #[account(
        init,
        payer = owner,
        space = Quote::LEN,
        seeds = [
            QUOTE_SEED,
            market_maker.key().as_ref(),
            asset_mint.as_ref(),
            &[strategy as u8],
            &expiry_timestamp.to_le_bytes()
        ],
        bump
    )]
    pub quote: Account<'info, Quote>,

    #[account(
        seeds = [ASSET_CONFIG_SEED, asset_mint.as_ref()],
        bump = asset_config.bump,
        constraint = asset_config.enabled @ ErrorCode::AssetNotEnabled
    )]
    pub asset_config: Account<'info, AssetConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_submit_quote(
    ctx: Context<SubmitQuote>,
    asset_mint: Pubkey,
    quote_mint: Pubkey,
    strategy: StrategyType,
    strikes: Vec<StrikeQuote>,
    expiry_timestamp: i64,
    min_size: u64,
    max_size: u64,
) -> Result<()> {
    require!(
        strikes.len() <= MAX_STRIKES_PER_QUOTE,
        ErrorCode::TooManyStrikes
    );

    require!(
        min_size > 0 && max_size >= min_size,
        ErrorCode::InvalidQuoteParameters
    );

    let clock = Clock::get()?;
    require!(
        expiry_timestamp > clock.unix_timestamp,
        ErrorCode::QuoteExpired
    );

    let quote = &mut ctx.accounts.quote;

    // Initialize or update quote
    quote.market_maker = ctx.accounts.market_maker.key();
    quote.asset_mint = asset_mint;
    quote.quote_mint = quote_mint;
    quote.strategy = strategy;
    quote.strikes = strikes;
    quote.expiry_timestamp = expiry_timestamp;
    quote.min_size = min_size;
    quote.max_size = max_size;
    quote.last_updated = clock.unix_timestamp;
    quote.active = true;
    quote.bump = ctx.bumps.quote;

    msg!("Quote submitted for asset: {}", asset_mint);

    Ok(())
}

// Update quote
#[derive(Accounts)]
pub struct UpdateQuote<'info> {
    #[account(
        seeds = [MARKET_MAKER_SEED, owner.key().as_ref()],
        bump = market_maker.bump,
        has_one = owner @ ErrorCode::Unauthorized
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
        bump = quote.bump
    )]
    pub quote: Account<'info, Quote>,

    pub owner: Signer<'info>,
}

pub fn handle_update_quote(
    ctx: Context<UpdateQuote>,
    strikes: Option<Vec<StrikeQuote>>,
    expiry_timestamp: Option<i64>,
    min_size: Option<u64>,
    max_size: Option<u64>,
    active: Option<bool>,
) -> Result<()> {
    let quote = &mut ctx.accounts.quote;
    let clock = Clock::get()?;

    if let Some(s) = strikes {
        require!(s.len() <= MAX_STRIKES_PER_QUOTE, ErrorCode::TooManyStrikes);
        quote.strikes = s;
    }

    if let Some(expiry) = expiry_timestamp {
        require!(
            expiry > clock.unix_timestamp,
            ErrorCode::QuoteExpired
        );
        quote.expiry_timestamp = expiry;
    }

    if let Some(min) = min_size {
        quote.min_size = min;
    }

    if let Some(max) = max_size {
        quote.max_size = max;
    }

    if let Some(a) = active {
        quote.active = a;
    }

    quote.last_updated = clock.unix_timestamp;

    msg!("Quote updated");

    Ok(())
}
