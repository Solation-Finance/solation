use anchor_lang::prelude::*;

#[account]
pub struct AssetConfig {
    pub asset_mint: Pubkey,
    pub quote_mint: Pubkey,           // Always USDC
    pub pyth_feed_id: [u8; 32],      // Pyth price feed ID
    pub enabled: bool,
    pub min_strike_percentage: u16,   // e.g., 80 = 80% of current price
    pub max_strike_percentage: u16,   // e.g., 120 = 120% of current price
    pub min_expiry_seconds: i64,      // e.g., 1 day = 86400
    pub max_expiry_seconds: i64,      // e.g., 90 days = 7776000
    pub decimals: u8,                 // Asset decimals
    pub bump: u8,
}

impl AssetConfig {
    pub const LEN: usize = 8 + // discriminator
        32 + // asset_mint
        32 + // quote_mint
        32 + // pyth_feed_id
        1 +  // enabled
        2 +  // min_strike_percentage
        2 +  // max_strike_percentage
        8 +  // min_expiry_seconds
        8 +  // max_expiry_seconds
        1 +  // decimals
        1;   // bump
}
