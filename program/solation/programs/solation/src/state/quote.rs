use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum StrategyType {
    CoveredCall,
    CashSecuredPut,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StrikeQuote {
    pub strike_price: u64,           // In quote decimals (USDC, 6 decimals)
    pub premium_per_contract: u64,   // Premium quoted by MM
    pub available_contracts: u64,    // How many can be sold
}

#[account]
pub struct Quote {
    pub market_maker: Pubkey,
    pub asset_mint: Pubkey,           // Underlying asset
    pub quote_mint: Pubkey,           // Always USDC
    pub strategy: StrategyType,       // CoveredCall or CashSecuredPut
    pub strikes: Vec<StrikeQuote>,    // Up to 10 strike prices
    pub expiry_timestamp: i64,        // When this quote expires
    pub min_size: u64,                // Minimum contract size
    pub max_size: u64,                // Maximum per user
    pub last_updated: i64,
    pub active: bool,
    pub bump: u8,
}

impl Quote {
    // Max 10 strikes per quote
    pub const MAX_STRIKES: usize = 10;

    pub const LEN: usize = 8 + // discriminator
        32 + // market_maker
        32 + // asset_mint
        32 + // quote_mint
        1 +  // strategy
        4 + (Self::MAX_STRIKES * (8 + 8 + 8)) + // strikes vec (price, premium, available)
        8 +  // expiry_timestamp
        8 +  // min_size
        8 +  // max_size
        8 +  // last_updated
        1 +  // active
        1;   // bump
}
