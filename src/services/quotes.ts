import { PublicKey } from "@solana/web3.js";
import { SolationProgram } from "../anchor/setup";
import { getMarketMakerPDA } from "../anchor/pdas";
import { MARKET_MAKER_OWNER } from "../config/constants";

export interface Quote {
  publicKey: PublicKey;
  marketMaker: PublicKey;
  assetMint: PublicKey;
  quoteMint: PublicKey;
  strategy: "CoveredCall" | "CashSecuredPut";
  strikes: Array<{
    strikePrice: number;
    premiumPerContract: number;
    availableContracts: number;
  }>;
  expiryTimestamp: number;
  minSize: number;
  maxSize: number;
  lastUpdated: number;
  active: boolean;
}

/**
 * Fetch all quotes from a specific market maker
 */
export async function fetchMarketMakerQuotes(
  program: SolationProgram,
  marketMakerOwner: PublicKey = MARKET_MAKER_OWNER
): Promise<Quote[]> {
  try {
    const [marketMaker] = getMarketMakerPDA(marketMakerOwner);

    const quotes = await program.account.quote.all([
      {
        memcmp: {
          offset: 8, // Skip discriminator
          bytes: marketMaker.toBase58(),
        },
      },
    ]);

    return quotes.map((q) => {
      const account = q.account as any;

      // Determine strategy
      let strategy: "CoveredCall" | "CashSecuredPut" = "CoveredCall";
      if (account.strategy.cashSecuredPut !== undefined) {
        strategy = "CashSecuredPut";
      }

      return {
        publicKey: q.publicKey,
        marketMaker: account.marketMaker,
        assetMint: account.assetMint,
        quoteMint: account.quoteMint,
        strategy,
        strikes: account.strikes.map((s: any) => ({
          strikePrice: s.strikePrice.toNumber(),
          premiumPerContract: s.premiumPerContract.toNumber(),
          availableContracts: s.availableContracts.toNumber(),
        })),
        expiryTimestamp: account.expiryTimestamp.toNumber(),
        minSize: account.minSize.toNumber(),
        maxSize: account.maxSize.toNumber(),
        lastUpdated: account.lastUpdated.toNumber(),
        active: account.active,
      };
    });
  } catch (error) {
    console.error("Error fetching market maker quotes:");
    console.error(error);
    return [];
  }
}

/**
 * Fetch quotes for a specific asset and strategy
 */
export async function fetchQuotesForAsset(
  program: SolationProgram,
  assetMint: PublicKey,
  strategy: "CoveredCall" | "CashSecuredPut"
): Promise<Quote[]> {
  const allQuotes = await fetchMarketMakerQuotes(program);

  return allQuotes.filter(
    (q) =>
      q.assetMint.equals(assetMint) &&
      q.strategy === strategy &&
      q.active &&
      q.expiryTimestamp > Date.now() / 1000 // Not expired
  );
}

/**
 * Get the best available quote for a specific strike price
 */
export function getBestQuoteForStrike(
  quotes: Quote[],
  strikePrice: number
): { quote: Quote; strikeIndex: number } | null {
  for (const quote of quotes) {
    const strikeIndex = quote.strikes.findIndex(
      (s) => s.strikePrice === strikePrice && s.availableContracts > 0
    );

    if (strikeIndex !== -1) {
      return { quote, strikeIndex };
    }
  }

  return null;
}

/**
 * Group quotes by expiry date
 */
export function groupQuotesByExpiry(quotes: Quote[]): Map<number, Quote[]> {
  const grouped = new Map<number, Quote[]>();

  for (const quote of quotes) {
    const existing = grouped.get(quote.expiryTimestamp) || [];
    existing.push(quote);
    grouped.set(quote.expiryTimestamp, existing);
  }

  return grouped;
}

/**
 * Get all unique strike prices from quotes
 */
export function getUniqueStrikePrices(quotes: Quote[]): number[] {
  const strikes = new Set<number>();

  for (const quote of quotes) {
    for (const strike of quote.strikes) {
      strikes.add(strike.strikePrice);
    }
  }

  return Array.from(strikes).sort((a, b) => a - b);
}
