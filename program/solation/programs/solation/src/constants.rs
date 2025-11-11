// PDA Seeds
pub const GLOBAL_STATE_SEED: &[u8] = b"global_state";
pub const MARKET_MAKER_SEED: &[u8] = b"market_maker";
pub const MM_VAULT_SEED: &[u8] = b"mm_vault";
pub const VAULT_TOKEN_ACCOUNT_SEED: &[u8] = b"vault_token_account";
pub const QUOTE_SEED: &[u8] = b"quote";
pub const POSITION_SEED: &[u8] = b"position";
pub const POSITION_USER_VAULT_SEED: &[u8] = b"position_user_vault";
pub const POSITION_MM_VAULT_SEED: &[u8] = b"position_mm_vault";
pub const ASSET_CONFIG_SEED: &[u8] = b"asset_config";

// Pyth parameters
pub const PYTH_STALENESS_THRESHOLD: u64 = 60; // 60 seconds

// Quote parameters
pub const MAX_STRIKES_PER_QUOTE: usize = 10;

// Basis points (10000 = 100%)
pub const BASIS_POINTS_DIVISOR: u64 = 10000;
