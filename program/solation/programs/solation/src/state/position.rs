use anchor_lang::prelude::*;
use super::StrategyType;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PositionStatus {
    Active,
    SettledITM,        // In the money, exercised
    SettledOTM,        // Out of money, expired worthless
    SettledATM,        // At the money (edge case)
}

#[account]
pub struct Position {
    pub position_id: u64,             // Unique position ID
    pub user: Pubkey,
    pub market_maker: Pubkey,
    pub strategy: StrategyType,
    pub asset_mint: Pubkey,           // Underlying asset
    pub quote_mint: Pubkey,           // USDC
    pub strike_price: u64,            // Strike price in USDC terms
    pub premium_paid: u64,            // Premium user received upfront
    pub contract_size: u64,           // Amount of underlying
    pub created_at: i64,
    pub expiry_timestamp: i64,
    pub settlement_price: Option<u64>, // Pyth price at settlement
    pub status: PositionStatus,

    // Vault accounts holding the locked assets
    pub user_vault: Pubkey,           // User's locked asset PDA
    pub mm_vault_locked: Pubkey,      // MM's locked asset PDA

    pub bump: u8,
    pub user_vault_bump: u8,
    pub mm_vault_bump: u8,
}

impl Position {
    pub const LEN: usize = 8 + // discriminator
        8 +  // position_id
        32 + // user
        32 + // market_maker
        1 +  // strategy
        32 + // asset_mint
        32 + // quote_mint
        8 +  // strike_price
        8 +  // premium_paid
        8 +  // contract_size
        8 +  // created_at
        8 +  // expiry_timestamp
        1 + 8 + // settlement_price (Option<u64>)
        1 +  // status
        32 + // user_vault
        32 + // mm_vault_locked
        1 +  // bump
        1 +  // user_vault_bump
        1;   // mm_vault_bump
}
