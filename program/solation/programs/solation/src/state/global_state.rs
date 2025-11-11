use anchor_lang::prelude::*;

#[account]
pub struct GlobalState {
    pub authority: Pubkey,        // Program admin
    pub treasury: Pubkey,          // Fee recipient
    pub protocol_fee_bps: u16,     // Protocol fee in basis points (0 for MVP)
    pub paused: bool,              // Emergency pause flag
    pub total_volume: u64,         // Total volume traded
    pub total_positions: u64,      // Total positions created
    pub bump: u8,
}

impl GlobalState {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // treasury
        2 +  // protocol_fee_bps
        1 +  // paused
        8 +  // total_volume
        8 +  // total_positions
        1;   // bump
}
