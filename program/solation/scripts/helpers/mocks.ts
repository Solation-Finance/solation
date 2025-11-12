import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { MOCK_PRICES } from "./constants";

/**
 * Create a mock Pyth price account structure
 * This simulates a Pyth price update account with hardcoded prices
 */
export function createMockPythAccount(asset: "SOL" | "USDC"): PublicKey {
  // For local testing, we'll return a dummy public key
  // In actual settlement, you'd need to create an account with price data
  // For now, this is just a placeholder
  return Keypair.generate().publicKey;
}

/**
 * Get mock price for an asset (used in settlement logic)
 */
export function getMockPrice(asset: "SOL" | "USDC"): number {
  return MOCK_PRICES[asset];
}

/**
 * Helper to generate quote strike prices based on current spot
 */
export function generateStrikePrices(
  spotPrice: number,
  strategy: "CoveredCall" | "CashSecuredPut"
): number[] {
  const strikes: number[] = [];

  if (strategy === "CoveredCall") {
    // For covered calls, generate strikes above spot (105%, 110%, 115%, 120%)
    for (let i = 105; i <= 120; i += 4) {
      strikes.push(Math.floor((spotPrice * i) / 100));
    }
  } else {
    // For cash secured puts, generate strikes below spot (80%, 85%, 90%, 95%, 100%)
    for (let i = 80; i <= 100; i += 4) {
      strikes.push(Math.floor((spotPrice * i) / 100));
    }
  }

  return strikes;
}

/**
 * Calculate premium for a strike price
 * Simple Black-Scholes approximation for testing
 */
export function calculatePremium(
  spotPrice: number,
  strikePrice: number,
  daysToExpiry: number,
  strategy: "CoveredCall" | "CashSecuredPut"
): number {
  // Very simplified premium calculation
  // In production, you'd use proper options pricing models

  const timeValue = Math.sqrt(daysToExpiry / 365) * 0.1; // 10% volatility assumption
  const moneyness = Math.abs(strikePrice - spotPrice) / spotPrice;

  let intrinsicValue = 0;
  if (strategy === "CoveredCall" && strikePrice < spotPrice) {
    intrinsicValue = spotPrice - strikePrice;
  } else if (strategy === "CashSecuredPut" && strikePrice > spotPrice) {
    intrinsicValue = strikePrice - spotPrice;
  }

  const premium = (intrinsicValue + timeValue * spotPrice) * 0.05; // 5% of notional as base
  return Math.floor(premium);
}
