use anchor_lang::prelude::*;

#[account]
pub struct MarketMakerVault {
    pub market_maker: Pubkey,         // Link to MM account
    pub asset_mint: Pubkey,           // Token mint (SOL, BTC, ETH, USDC)
    pub vault_token_account: Pubkey,  // SPL token account (PDA authority)
    pub total_deposited: u64,         // Total ever deposited
    pub available_liquidity: u64,     // Not locked in positions
    pub locked_liquidity: u64,        // Currently in positions
    pub bump: u8,
    pub vault_bump: u8,               // For vault token account PDA
}

impl MarketMakerVault {
    pub const LEN: usize = 8 + // discriminator
        32 + // market_maker
        32 + // asset_mint
        32 + // vault_token_account
        8 +  // total_deposited
        8 +  // available_liquidity
        8 +  // locked_liquidity
        1 +  // bump
        1;   // vault_bump
}
