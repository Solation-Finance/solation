use anchor_lang::prelude::*;

#[account]
pub struct MarketMaker {
    pub owner: Pubkey,               // MM wallet address
    pub active: bool,                // Can accept new positions
    pub total_positions: u64,        // Total positions count
    pub completed_positions: u64,    // Settled positions count
    pub reputation_score: u16,       // Future: reputation system
    pub bump: u8,
}

impl MarketMaker {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner
        1 +  // active
        8 +  // total_positions
        8 +  // completed_positions
        2 +  // reputation_score
        1;   // bump
}
