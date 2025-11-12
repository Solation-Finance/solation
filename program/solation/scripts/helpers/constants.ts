import { PublicKey } from "@solana/web3.js";

// Program ID
export const PROGRAM_ID = new PublicKey("2KW4NXTSbeq5BJM39rsR1sR15Uf72perBkVVMH88ZGRm");

// Native SOL (wrapped SOL)
export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

// USDC mint - we'll create this on localnet
// This is a placeholder - will be replaced with actual mint after creation
export const USDC_MINT_PLACEHOLDER = "Fp49VfCJxfF2jhyvnmyAGjK63RkS4j47q688ggHkKiwa";

// Mock Pyth Feed IDs (32-byte arrays)
// These are fake feed IDs for testing purposes
export const PYTH_FEED_IDS = {
  SOL: Array.from(Buffer.alloc(32, 1)), // All 1s
  USDC: Array.from(Buffer.alloc(32, 2)), // All 2s
};

// Mock prices (in USD, with appropriate decimals)
export const MOCK_PRICES = {
  SOL: 180_00000000, // $180 with 8 decimals
  USDC: 1_00000000,   // $1 with 8 decimals
};

// Asset decimals
export const DECIMALS = {
  SOL: 9,
  USDC: 6,
};

// Protocol parameters
export const PROTOCOL_FEE_BPS = 30; // 0.3% protocol fee

// Strike price parameters (basis points relative to spot)
export const STRIKE_PARAMS = {
  MIN_STRIKE_PERCENTAGE: 8000, // 80% of spot (for puts)
  MAX_STRIKE_PERCENTAGE: 12000, // 120% of spot (for calls)
};

// Expiry parameters (in seconds)
export const EXPIRY_PARAMS = {
  MIN_EXPIRY_SECONDS: 86400, // 1 day
  MAX_EXPIRY_SECONDS: 2592000, // 30 days
};

// Liquidity amounts for initial deposit
export const INITIAL_LIQUIDITY = {
  SOL: 100, // 100 SOL
  USDC: 10000, // 10,000 USDC
};
