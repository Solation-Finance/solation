import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Solation } from "../target/types/solation";
import { getMarketMakerPDA } from "./helpers/pdas";

/**
 * Script 03: Register Market Maker
 *
 * This script registers your wallet as a market maker.
 * You'll be the sole liquidity provider for the protocol.
 */
async function main() {
  console.log("🏦 Registering Market Maker...\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Solation as Program<Solation>;

  const owner = provider.wallet.publicKey;
  const [marketMaker, marketMakerBump] = getMarketMakerPDA(owner);

  console.log("Configuration:");
  console.log(`  Owner: ${owner.toBase58()}`);
  console.log(`  Market Maker PDA: ${marketMaker.toBase58()}\n`);

  try {
    // Check if already registered
    try {
      const existing = await program.account.marketMaker.fetch(marketMaker);
      console.log("⚠️  Market maker already registered!");
      console.log(`  Owner: ${existing.owner.toBase58()}`);
      console.log(`  Active: ${existing.active}`);
      console.log(`  Total Positions: ${existing.totalPositions.toString()}`);
      console.log(`  Completed Positions: ${existing.completedPositions.toString()}`);
      console.log(`  Reputation Score: ${existing.reputationScore}`);
      return;
    } catch (err) {
      // Not registered yet, continue
    }

    // Register market maker
    const tx = await program.methods
      .registerMarketMaker()
      .accounts({
        owner,
      })
      .rpc();

    console.log("✅ Market maker registered successfully!");
    console.log(`  Transaction: ${tx}\n`);

    // Verify
    const mm = await program.account.marketMaker.fetch(marketMaker);
    console.log("Verification:");
    console.log(`  Owner: ${mm.owner.toBase58()}`);
    console.log(`  Active: ${mm.active}`);
    console.log(`  Total Positions: ${mm.totalPositions.toString()}`);
    console.log(`  Completed Positions: ${mm.completedPositions.toString()}`);
    console.log(`  Reputation Score: ${mm.reputationScore}`);
    console.log(`  Bump: ${mm.bump}`);

  } catch (error) {
    console.error("❌ Error registering market maker:");
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
