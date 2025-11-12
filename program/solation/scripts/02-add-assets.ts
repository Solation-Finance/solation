import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Solation } from "../target/types/solation";
import { getGlobalStatePDA, getAssetConfigPDA } from "./helpers/pdas";
import {
  SOL_MINT,
  PYTH_FEED_IDS,
  DECIMALS,
  STRIKE_PARAMS,
  EXPIRY_PARAMS,
} from "./helpers/constants";

/**
 * Script 02: Add Assets
 *
 * This script adds asset configurations for SOL and USDC.
 * It also creates a USDC mint on localnet for testing.
 */
async function main() {
  console.log("🪙 Adding Assets (SOL & USDC)...\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Solation as Program<Solation>;

  const authority = provider.wallet.publicKey;
  const [globalState] = getGlobalStatePDA();

  // Step 1: Create USDC mint on localnet
  console.log("Step 1: Creating USDC mint on localnet...");
  const usdcMint = await createMint(
    provider.connection,
    provider.wallet.payer,
    authority, // mint authority
    authority, // freeze authority
    DECIMALS.USDC // decimals
  );
  console.log(`✅ USDC Mint created: ${usdcMint.toBase58()}\n`);

  // Step 2: Add SOL asset config
  console.log("Step 2: Adding SOL asset configuration...");
  const [solAssetConfig] = getAssetConfigPDA(SOL_MINT);

  try {
    // Check if SOL config already exists
    try {
      const existing = await program.account.assetConfig.fetch(solAssetConfig);
      console.log("⚠️  SOL asset config already exists");
      console.log(`  Enabled: ${existing.enabled}`);
    } catch (err) {
      // Not initialized, add it
      const tx = await program.methods
        .addAsset(
          SOL_MINT,
          usdcMint, // quote mint (SOL priced in USDC)
          PYTH_FEED_IDS.SOL,
          STRIKE_PARAMS.MIN_STRIKE_PERCENTAGE,
          STRIKE_PARAMS.MAX_STRIKE_PERCENTAGE,
          new anchor.BN(EXPIRY_PARAMS.MIN_EXPIRY_SECONDS),
          new anchor.BN(EXPIRY_PARAMS.MAX_EXPIRY_SECONDS),
          DECIMALS.SOL
        )
        .accounts({
          authority,
        })
        .rpc();

      console.log(`✅ SOL asset added successfully!`);
      console.log(`  Transaction: ${tx}`);
      console.log(`  Asset Config: ${solAssetConfig.toBase58()}\n`);
    }
  } catch (error) {
    console.error("❌ Error adding SOL asset:");
    console.error(error);
    throw error;
  }

  // Step 3: Add USDC asset config
  console.log("Step 3: Adding USDC asset configuration...");
  const [usdcAssetConfig] = getAssetConfigPDA(usdcMint);

  try {
    // Check if USDC config already exists
    try {
      const existing = await program.account.assetConfig.fetch(usdcAssetConfig);
      console.log("⚠️  USDC asset config already exists");
      console.log(`  Enabled: ${existing.enabled}`);
    } catch (err) {
      // Not initialized, add it
      const tx = await program.methods
        .addAsset(
          usdcMint,
          usdcMint, // quote mint (USDC/USDC for cash-secured puts)
          PYTH_FEED_IDS.USDC,
          STRIKE_PARAMS.MIN_STRIKE_PERCENTAGE,
          STRIKE_PARAMS.MAX_STRIKE_PERCENTAGE,
          new anchor.BN(EXPIRY_PARAMS.MIN_EXPIRY_SECONDS),
          new anchor.BN(EXPIRY_PARAMS.MAX_EXPIRY_SECONDS),
          DECIMALS.USDC
        )
        .accounts({
          authority,
        })
        .rpc();

      console.log(`✅ USDC asset added successfully!`);
      console.log(`  Transaction: ${tx}`);
      console.log(`  Asset Config: ${usdcAssetConfig.toBase58()}\n`);
    }
  } catch (error) {
    console.error("❌ Error adding USDC asset:");
    console.error(error);
    throw error;
  }

  // Summary
  console.log("📊 Summary:");
  console.log(`  SOL Mint: ${SOL_MINT.toBase58()}`);
  console.log(`  USDC Mint: ${usdcMint.toBase58()}`);
  console.log(`  SOL Asset Config: ${solAssetConfig.toBase58()}`);
  console.log(`  USDC Asset Config: ${usdcAssetConfig.toBase58()}`);
  console.log("\n⚠️  IMPORTANT: Save the USDC mint address for use in other scripts!");
  console.log(`  Add to constants.ts: export const USDC_MINT = new PublicKey("${usdcMint.toBase58()}");`);
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
