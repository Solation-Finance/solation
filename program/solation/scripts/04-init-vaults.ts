import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Solation } from "../target/types/solation";
import {
  getMarketMakerPDA,
  getMMVaultPDA,
  getVaultTokenAccountPDA,
  getVaultAuthorityPDA,
} from "./helpers/pdas";
import { SOL_MINT, USDC_MINT_PLACEHOLDER } from "./helpers/constants";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

/**
 * Script 04: Initialize Vaults
 *
 * This script initializes market maker vaults for SOL and USDC.
 * These vaults will hold liquidity for options trading.
 *
 * IMPORTANT: Update USDC_MINT in constants.ts with the actual mint from script 02!
 */
async function main() {
  console.log("🏛️  Initializing Market Maker Vaults...\n");

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
    console.error("Usage: npm run init:04 -- <USDC_MINT_ADDRESS>");
    console.error("\nGet the USDC mint address from the output of script 02");
    process.exit(1);
  }

  const usdcMint = new PublicKey(usdcMintInput);

  console.log("Configuration:");
  console.log(`  Market Maker: ${marketMaker.toBase58()}`);
  console.log(`  Owner: ${owner.toBase58()}`);
  console.log(`  SOL Mint: ${SOL_MINT.toBase58()}`);
  console.log(`  USDC Mint: ${usdcMint.toBase58()}\n`);

  // Initialize SOL vault
  console.log("Step 1: Initializing SOL vault...");
  await initializeVault(program, owner, marketMaker, SOL_MINT, "SOL");

  // Initialize USDC vault
  console.log("\nStep 2: Initializing USDC vault...");
  await initializeVault(program, owner, marketMaker, usdcMint, "USDC");

  console.log("\n✅ All vaults initialized successfully!");
}

async function initializeVault(
  program: Program<Solation>,
  owner: PublicKey,
  marketMaker: PublicKey,
  assetMint: PublicKey,
  assetName: string
) {
  const [mmVault] = getMMVaultPDA(marketMaker, assetMint);
  const [vaultTokenAccount] = getVaultTokenAccountPDA(marketMaker, assetMint);
  const [vaultAuthority] = getVaultAuthorityPDA(marketMaker, assetMint);

  console.log(`  Asset: ${assetName}`);
  console.log(`  MM Vault PDA: ${mmVault.toBase58()}`);
  console.log(`  Vault Token Account: ${vaultTokenAccount.toBase58()}`);
  console.log(`  Vault Authority: ${vaultAuthority.toBase58()}`);

  try {
    // Check if vault already exists
    try {
      const existing = await program.account.marketMakerVault.fetch(mmVault);
      console.log(`  ⚠️  ${assetName} vault already initialized`);
      console.log(`    Total Deposited: ${existing.totalDeposited.toString()}`);
      console.log(`    Available Liquidity: ${existing.availableLiquidity.toString()}`);
      return;
    } catch (err) {
      // Not initialized, continue
    }

    // Initialize vault
    const tx = await program.methods
      .initializeVault(assetMint)
      .accounts({
        owner,
        assetMintAccount: assetMint,
      })
      .rpc();

    console.log(`  ✅ ${assetName} vault initialized!`);
    console.log(`    Transaction: ${tx}`);

    // Verify
    const vault = await program.account.marketMakerVault.fetch(mmVault);
    console.log(`  Verification:`);
    console.log(`    Market Maker: ${vault.marketMaker.toBase58()}`);
    console.log(`    Asset Mint: ${vault.assetMint.toBase58()}`);
    console.log(`    Vault Token Account: ${vault.vaultTokenAccount.toBase58()}`);
    console.log(`    Total Deposited: ${vault.totalDeposited.toString()}`);
    console.log(`    Available Liquidity: ${vault.availableLiquidity.toString()}`);

  } catch (error) {
    console.error(`  ❌ Error initializing ${assetName} vault:`);
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
