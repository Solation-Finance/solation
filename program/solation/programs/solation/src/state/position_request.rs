use anchor_lang::prelude::*;
use super::StrategyType;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum RequestStatus {
    Pending,
    Accepted,
    Rejected,
    Expired,
}

#[account]
pub struct PositionRequest {
    pub request_id: u64,              // Unique request ID per user
    pub user: Pubkey,                 // User who made the request
    pub market_maker: Pubkey,         // MM who owns the quote
    pub quote: Pubkey,                // Quote being referenced
    pub strategy: StrategyType,       // CoveredCall or CashSecuredPut
    pub asset_mint: Pubkey,           // Underlying asset
    pub quote_mint: Pubkey,           // Quote currency (USDC)
    pub strike_price: u64,            // Chosen strike price
    pub contract_size: u64,           // Requested contract size
    pub premium: u64,                 // Calculated premium (strike.premium_per_contract * contract_size)
    pub created_at: i64,              // When request was made
    pub expires_at: i64,              // created_at + MM_CONFIRMATION_WINDOW
    pub status: RequestStatus,        // Current status
    pub bump: u8,
}

impl PositionRequest {
    pub const LEN: usize = 8 +  // discriminator
        8 +   // request_id
        32 +  // user
        32 +  // market_maker
        32 +  // quote
        1 +   // strategy
        32 +  // asset_mint
        32 +  // quote_mint
        8 +   // strike_price
        8 +   // contract_size
        8 +   // premium
        8 +   // created_at
        8 +   // expires_at
        1 +   // status
        1;    // bump

    pub fn is_expired(&self, current_timestamp: i64) -> bool {
        current_timestamp >= self.expires_at
    }

    pub fn is_pending(&self) -> bool {
        self.status == RequestStatus::Pending
    }
}
