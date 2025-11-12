import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Solation } from "../target/types/solation";
import { getGlobalStatePDA } from "./helpers/pdas";
import { PROTOCOL_FEE_BPS } from "./helpers/constants";

/**
 * Script 01: Initialize Global State
 *
 * This script initializes the protocol's global state account.
 * Should be run only once per deployment.
 */
async function main() {
  console.log("🚀 Initializing Global State...\n");

  // Setup provider and program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Solation as Program<Solation>;

  const authority = provider.wallet.publicKey;
  const treasury = provider.wallet.publicKey; // Use same wallet as treasury for testing

  // Derive global state PDA
  const [globalState, globalStateBump] = getGlobalStatePDA();

  console.log("Configuration:");
  console.log(`  Authority: ${authority.toBase58()}`);
  console.log(`  Treasury: ${treasury.toBase58()}`);
  console.log(`  Protocol Fee: ${PROTOCOL_FEE_BPS} bps (${PROTOCOL_FEE_BPS / 100}%)`);
  console.log(`  Global State PDA: ${globalState.toBase58()}\n`);

  try {
    // Check if already initialized
    try {
      const existingState = await program.account.globalState.fetch(globalState);
      console.log("⚠️  Global state already initialized!");
      console.log(`  Existing authority: ${existingState.authority.toBase58()}`);
      console.log(`  Existing treasury: ${existingState.treasury.toBase58()}`);
      console.log(`  Total positions: ${existingState.totalPositions.toString()}`);
      return;
    } catch (err) {
      // Not initialized yet, continue
    }

    // Initialize global state
    const tx = await program.methods
      .initializeGlobalState(PROTOCOL_FEE_BPS)
      .accounts({
        authority,
        treasury,
      })
      .rpc();

    console.log("✅ Global state initialized successfully!");
    console.log(`  Transaction: ${tx}\n`);

    // Verify
    const state = await program.account.globalState.fetch(globalState);
    console.log("Verification:");
    console.log(`  Authority: ${state.authority.toBase58()}`);
    console.log(`  Treasury: ${state.treasury.toBase58()}`);
    console.log(`  Fee (bps): ${state.protocolFeeBps}`);
    console.log(`  Paused: ${state.paused}`);
    console.log(`  Total Volume: ${state.totalVolume.toString()}`);
    console.log(`  Total Positions: ${state.totalPositions.toString()}`);

  } catch (error) {
    console.error("❌ Error initializing global state:");
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
