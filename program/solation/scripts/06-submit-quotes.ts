import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Solation } from "../target/types/solation";
import { getMarketMakerPDA, getAssetConfigPDA, getQuotePDA } from "./helpers/pdas";
import { SOL_MINT, MOCK_PRICES, DECIMALS } from "./helpers/constants";
import { generateStrikePrices, calculatePremium } from "./helpers/mocks";

/**
 * Script 06: Submit Quotes
 *
 * This script submits initial quotes for SOL covered calls and cash-secured puts.
 * Market makers provide pricing for different strike prices and expiries.
 *
 * IMPORTANT: Update USDC_MINT in constants.ts with the actual mint from script 02!
 */
async function main() {
  console.log("📝 Submitting Quotes...\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Solation as Program<Solation>;

  const owner = provider.wallet.publicKey;
  const [marketMaker] = getMarketMakerPDA(owner);

  // Get USDC mint from command line
  const args = process.argv.slice(2);
  const usdcMintInput = args[0];

  if (!usdcMintInput) {
    console.error("❌ ERROR: USDC mint not provided!");
    console.error("Usage: npm run init:06 -- <USDC_MINT_ADDRESS>");
    console.error("\nGet the USDC mint address from the output of script 02");
    process.exit(1);
  }

  const usdcMint = new PublicKey(usdcMintInput);
  const [solAssetConfig] = getAssetConfigPDA(SOL_MINT);

  console.log("Configuration:");
  console.log(`  Market Maker: ${marketMaker.toBase58()}`);
  console.log(`  Owner: ${owner.toBase58()}`);
  console.log(`  SOL Asset Config: ${solAssetConfig.toBase58()}`);
  console.log(`  USDC Mint: ${usdcMint.toBase58()}\n`);

  // Define expiry dates (7, 14, 30 days from now)
  const now = Math.floor(Date.now() / 1000);
  const expiries = [
    { days: 7, timestamp: now + 7 * 86400 },
    { days: 14, timestamp: now + 14 * 86400 },
    { days: 30, timestamp: now + 30 * 86400 },
  ];

  const spotPrice = MOCK_PRICES.SOL / 100000000; // Convert to regular USD price

  // Step 1: Submit Covered Call quotes
  console.log("Step 1: Submitting Covered Call quotes...");
  for (const expiry of expiries) {
    await submitQuote(
      program,
      owner,
      marketMaker,
      SOL_MINT,
      usdcMint,
      solAssetConfig,
      "CoveredCall",
      expiry,
      spotPrice
    );
  }

  // Step 2: Submit Cash-Secured Put quotes
  console.log("\nStep 2: Submitting Cash-Secured Put quotes...");
  for (const expiry of expiries) {
    await submitQuote(
      program,
      owner,
      marketMaker,
      SOL_MINT,
      usdcMint,
      solAssetConfig,
      "CashSecuredPut",
      expiry,
      spotPrice
    );
  }

  console.log("\n✅ All quotes submitted successfully!");
}

async function submitQuote(
  program: Program<Solation>,
  owner: PublicKey,
  marketMaker: PublicKey,
  assetMint: PublicKey,
  quoteMint: PublicKey,
  assetConfig: PublicKey,
  strategy: "CoveredCall" | "CashSecuredPut",
  expiry: { days: number; timestamp: number },
  spotPrice: number
) {
  console.log(`\n  Strategy: ${strategy}, Expiry: ${expiry.days} days`);

  // Generate strike prices
  const strikePricesRaw = generateStrikePrices(spotPrice, strategy);
  console.log(`  Strike prices: ${strikePricesRaw.join(", ")}`);

  // Create strike quotes with premiums
  const strikes = strikePricesRaw.map((strikePrice) => {
    const premium = calculatePremium(
      spotPrice,
      strikePrice,
      expiry.days,
      strategy
    );

    // Convert to program format with proper decimals
    return {
      strikePrice: new anchor.BN(strikePrice * 100000000), // 8 decimals
      premiumPerContract: new anchor.BN(premium * Math.pow(10, DECIMALS.USDC)),
      availableContracts: new anchor.BN(1000), // 1000 contracts available
    };
  });

  // Create a unique quote account
  const quoteKeypair = Keypair.generate();

  console.log(`  Quote Account: ${quoteKeypair.publicKey.toBase58()}`);
  console.log(`  Number of strikes: ${strikes.length}`);

  try {
    // Create the strategy enum properly for Anchor
    let strategyEnum: any;
    if (strategy === "CoveredCall") {
      strategyEnum = { coveredCall: {} };
    } else {
      strategyEnum = { cashSecuredPut: {} };
    }

    const tx = await program.methods
      .submitQuote(
        assetMint,
        quoteMint,
        strategyEnum,
        strikes,
        new anchor.BN(expiry.timestamp),
        new anchor.BN(0.1 * LAMPORTS_PER_SOL), // Min size: 0.1 SOL
        new anchor.BN(100 * LAMPORTS_PER_SOL) // Max size: 100 SOL
      )
      .accountsPartial({
        quote: quoteKeypair.publicKey,
        owner,
      })
      .signers([quoteKeypair])
      .rpc();

    console.log(`  ✅ Quote submitted!`);
    console.log(`  Transaction: ${tx}`);

    // Verify
    const quote = await program.account.quote.fetch(quoteKeypair.publicKey);
    console.log(`  Verification:`);
    console.log(`    Market Maker: ${quote.marketMaker.toBase58()}`);
    console.log(`    Active: ${quote.active}`);
    console.log(`    Expiry: ${new Date(quote.expiryTimestamp.toNumber() * 1000).toISOString()}`);
    console.log(`    Min Size: ${quote.minSize.toNumber() / LAMPORTS_PER_SOL} SOL`);
    console.log(`    Max Size: ${quote.maxSize.toNumber() / LAMPORTS_PER_SOL} SOL`);
    console.log(`    Number of Strikes: ${quote.strikes.length}`);

  } catch (error) {
    console.error(`  ❌ Error submitting quote:`);
    console.error(error);
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✨ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:");
    console.error(error);
    process.exit(1);
  });
