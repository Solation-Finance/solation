import { PublicKey } from "@solana/web3.js";

// Program ID
export const PROGRAM_ID = new PublicKey("2KW4NXTSbeq5BJM39rsR1sR15Uf72perBkVVMH88ZGRm");

// Localnet RPC endpoint
export const LOCALNET_RPC = "http://127.0.0.1:8899";

// Native SOL (wrapped SOL)
export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

// USDC mint - UPDATE THIS after running initialization script 02
// Get this from the output of: npm run init:02
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // PLACEHOLDER - UPDATE ME!

// Market Maker public key - this should be YOUR wallet address
// The same wallet you use to run the initialization scripts
export const MARKET_MAKER_OWNER = new PublicKey("E6ZnpJ8R6cpKqsZhKw6MJvZ3wBptHABRypk6QNZeksG3"); // UPDATE ME!
