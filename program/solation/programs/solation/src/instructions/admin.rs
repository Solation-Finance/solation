use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::*;
use crate::errors::ErrorCode;

// Initialize global state
#[derive(Accounts)]
pub struct InitializeGlobalState<'info> {
    #[account(
        init,
        payer = authority,
        space = GlobalState::LEN,
        seeds = [GLOBAL_STATE_SEED],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Treasury address
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_global_state(
    ctx: Context<InitializeGlobalState>,
    protocol_fee_bps: u16,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;

    global_state.authority = ctx.accounts.authority.key();
    global_state.treasury = ctx.accounts.treasury.key();
    global_state.protocol_fee_bps = protocol_fee_bps;
    global_state.paused = false;
    global_state.total_volume = 0;
    global_state.total_positions = 0;
    global_state.bump = ctx.bumps.global_state;

    msg!("Global state initialized with authority: {}", global_state.authority);

    Ok(())
}

// Update global state
#[derive(Accounts)]
pub struct UpdateGlobalState<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_STATE_SEED],
        bump = global_state.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub global_state: Account<'info, GlobalState>,

    pub authority: Signer<'info>,
}

pub fn handle_update_global_state(
    ctx: Context<UpdateGlobalState>,
    new_authority: Option<Pubkey>,
    new_treasury: Option<Pubkey>,
    new_fee_bps: Option<u16>,
    paused: Option<bool>,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;

    if let Some(auth) = new_authority {
        global_state.authority = auth;
    }

    if let Some(treasury) = new_treasury {
        global_state.treasury = treasury;
    }

    if let Some(fee) = new_fee_bps {
        global_state.protocol_fee_bps = fee;
    }

    if let Some(pause) = paused {
        global_state.paused = pause;
    }

    msg!("Global state updated");

    Ok(())
}

// Add asset configuration
#[derive(Accounts)]
#[instruction(asset_mint: Pubkey)]
pub struct AddAsset<'info> {
    #[account(
        seeds = [GLOBAL_STATE_SEED],
        bump = global_state.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        init,
        payer = authority,
        space = AssetConfig::LEN,
        seeds = [ASSET_CONFIG_SEED, asset_mint.as_ref()],
        bump
    )]
    pub asset_config: Account<'info, AssetConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_add_asset(
    ctx: Context<AddAsset>,
    asset_mint: Pubkey,
    quote_mint: Pubkey,
    pyth_feed_id: [u8; 32],
    min_strike_percentage: u16,
    max_strike_percentage: u16,
    min_expiry_seconds: i64,
    max_expiry_seconds: i64,
    decimals: u8,
) -> Result<()> {
    require!(
        min_strike_percentage < max_strike_percentage,
        ErrorCode::InvalidStrikeRange
    );

    require!(
        min_expiry_seconds < max_expiry_seconds,
        ErrorCode::InvalidExpiryRange
    );

    let asset_config = &mut ctx.accounts.asset_config;

    asset_config.asset_mint = asset_mint;
    asset_config.quote_mint = quote_mint;
    asset_config.pyth_feed_id = pyth_feed_id;
    asset_config.enabled = true;
    asset_config.min_strike_percentage = min_strike_percentage;
    asset_config.max_strike_percentage = max_strike_percentage;
    asset_config.min_expiry_seconds = min_expiry_seconds;
    asset_config.max_expiry_seconds = max_expiry_seconds;
    asset_config.decimals = decimals;
    asset_config.bump = ctx.bumps.asset_config;

    msg!("Asset added: {}", asset_mint);

    Ok(())
}

// Update asset configuration
#[derive(Accounts)]
pub struct UpdateAsset<'info> {
    #[account(
        seeds = [GLOBAL_STATE_SEED],
        bump = global_state.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        mut,
        seeds = [ASSET_CONFIG_SEED, asset_config.asset_mint.as_ref()],
        bump = asset_config.bump
    )]
    pub asset_config: Account<'info, AssetConfig>,

    pub authority: Signer<'info>,
}

pub fn handle_update_asset(
    ctx: Context<UpdateAsset>,
    enabled: Option<bool>,
    min_strike_percentage: Option<u16>,
    max_strike_percentage: Option<u16>,
    min_expiry_seconds: Option<i64>,
    max_expiry_seconds: Option<i64>,
) -> Result<()> {
    let asset_config = &mut ctx.accounts.asset_config;

    if let Some(e) = enabled {
        asset_config.enabled = e;
    }

    if let Some(min) = min_strike_percentage {
        asset_config.min_strike_percentage = min;
    }

    if let Some(max) = max_strike_percentage {
        asset_config.max_strike_percentage = max;
    }

    if let Some(min) = min_expiry_seconds {
        asset_config.min_expiry_seconds = min;
    }

    if let Some(max) = max_expiry_seconds {
        asset_config.max_expiry_seconds = max;
    }

    msg!("Asset updated: {}", asset_config.asset_mint);

    Ok(())
}
