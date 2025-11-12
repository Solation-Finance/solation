import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  mintTo,
  TOKEN_PROGRAM_ID,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { Solation } from "../target/types/solation";
import {
  getMarketMakerPDA,
  getMMVaultPDA,
  getVaultAuthorityPDA,
} from "./helpers/pdas";
import { SOL_MINT, INITIAL_LIQUIDITY, DECIMALS } from "./helpers/constants";
import { readFileSync } from "fs";
import * as os from "os";

/**
 * Script 05: Deposit Liquidity
 *
 * This script deposits initial liquidity into the market maker vaults.
 * For SOL: wraps native SOL into wSOL
 * For USDC: mints test USDC tokens and deposits them
 *
 * IMPORTANT: Update USDC_MINT in constants.ts with the actual mint from script 02!
 */
async function main() {
  console.log("💰 Depositing Liquidity...\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Solation as Program<Solation>;

  const owner = provider.wallet.publicKey;
  const [marketMaker] = getMarketMakerPDA(owner);

  // Load wallet keypair for signing transactions
  const walletPath = process.env.ANCHOR_WALLET || `${os.homedir()}/.config/solana/id.json`;
  console.log(`  Loading wallet from: ${walletPath}`);

  let walletKeypair: Keypair;
  try {
    const walletData = JSON.parse(readFileSync(walletPath, "utf-8"));
    walletKeypair = Keypair.fromSecretKey(new Uint8Array(walletData));
    console.log(`  Wallet loaded: ${walletKeypair.publicKey.toBase58()}`);
  } catch (error) {
    console.error("  ❌ Failed to load wallet keypair:");
    console.error(error);
    process.exit(1);
  }

  // Get USDC mint from command line
  const args = process.argv.slice(2);
  const usdcMintInput = args[0];

  if (!usdcMintInput) {
    console.error("❌ ERROR: USDC mint not provided!");
    console.error("Usage: npm run init:05 -- <USDC_MINT_ADDRESS>");
    console.error("\nGet the USDC mint address from the output of script 02");
    process.exit(1);
  }

  const usdcMint = new PublicKey(usdcMintInput);

  console.log("Configuration:");
  console.log(`  Owner: ${owner.toBase58()}`);
  console.log(`  Market Maker: ${marketMaker.toBase58()}`);
  console.log(`  SOL Amount: ${INITIAL_LIQUIDITY.SOL} SOL`);
  console.log(`  USDC Amount: ${INITIAL_LIQUIDITY.USDC} USDC\n`);

  // Step 1: Deposit SOL
  console.log("Step 1: Depositing SOL...");
  await depositSOL(program, owner, marketMaker);

  // Step 2: Mint and deposit USDC
  console.log("\nStep 2: Minting and depositing USDC...");
  await mintAndDepositUSDC(program, owner, marketMaker, usdcMint, walletKeypair);

  console.log("\n✅ All liquidity deposited successfully!");
}

async function depositSOL(
  program: Program<Solation>,
  owner: PublicKey,
  marketMaker: PublicKey
) {
  const [mmVault] = getMMVaultPDA(marketMaker, SOL_MINT);
  const [vaultAuthority] = getVaultAuthorityPDA(marketMaker, SOL_MINT);

  // Get vault token account from vault state
  const vaultState = await program.account.marketMakerVault.fetch(mmVault);
  const vaultTokenAccount = vaultState.vaultTokenAccount;

  // Get or create owner's associated token account for SOL
  const ownerTokenAccount = await getAssociatedTokenAddress(
    SOL_MINT,
    owner,
    false
  );

  console.log(`  Owner Token Account: ${ownerTokenAccount.toBase58()}`);
  console.log(`  Vault Token Account: ${vaultTokenAccount.toBase58()}`);

  // Check if owner ATA exists, create if not
  const accountInfo = await program.provider.connection.getAccountInfo(
    ownerTokenAccount
  );
  if (!accountInfo) {
    console.log("  Creating owner's associated token account for SOL...");
    const createAtaTx = await program.provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          owner,
          ownerTokenAccount,
          owner,
          SOL_MINT
        )
      )
    );
    console.log(`  ATA created: ${createAtaTx}`);
  }

  // Wrap SOL into wSOL token account
  const wrapAmount = INITIAL_LIQUIDITY.SOL * LAMPORTS_PER_SOL;
  console.log(`  Wrapping ${INITIAL_LIQUIDITY.SOL} SOL...`);

  const wrapTx = await program.provider.sendAndConfirm(
    new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: ownerTokenAccount,
        lamports: wrapAmount,
      }),
      createSyncNativeInstruction(ownerTokenAccount)
    )
  );
  console.log(`  ✅ Wrapped ${INITIAL_LIQUIDITY.SOL} SOL`);

  // For testing on localnet, we need to wrap SOL into wSOL first
  // This is typically done by transferring SOL to the token account
  // For simplicity, we'll assume the owner has wSOL or we'll handle it in the instruction

  try {
    const amount = new anchor.BN(INITIAL_LIQUIDITY.SOL * LAMPORTS_PER_SOL);

    const tx = await program.methods
      .depositLiquidity(amount)
      .accountsPartial({
        mmVault,
        vaultTokenAccount,
        assetMint: SOL_MINT,
        ownerTokenAccount,
        owner,
      })
      .rpc();

    console.log(`  ✅ Deposited ${INITIAL_LIQUIDITY.SOL} SOL`);
    console.log(`  Transaction: ${tx}`);

    // Verify
    const vault = await program.account.marketMakerVault.fetch(mmVault);
    console.log(`  Total Deposited: ${vault.totalDeposited.toString()} lamports`);
    console.log(`  Available Liquidity: ${vault.availableLiquidity.toString()} lamports`);

  } catch (error) {
    console.error("  ❌ Error depositing SOL:");
    console.error(error);
    console.error("\n  ⚠️  NOTE: You may need to manually wrap SOL first.");
    console.error("  Try: spl-token wrap <amount>");
  }
}

async function mintAndDepositUSDC(
  program: Program<Solation>,
  owner: PublicKey,
  marketMaker: PublicKey,
  usdcMint: PublicKey,
  walletKeypair: Keypair
) {
  const [mmVault] = getMMVaultPDA(marketMaker, usdcMint);
  const [vaultAuthority] = getVaultAuthorityPDA(marketMaker, usdcMint);

  // Get vault token account from vault state
  const vaultState = await program.account.marketMakerVault.fetch(mmVault);
  const vaultTokenAccount = vaultState.vaultTokenAccount;

  // Get or create owner's associated token account for USDC
  const ownerTokenAccount = await getAssociatedTokenAddress(
    usdcMint,
    owner,
    false
  );

  console.log(`  USDC Mint: ${usdcMint.toBase58()}`);
  console.log(`  Owner Token Account: ${ownerTokenAccount.toBase58()}`);
  console.log(`  Vault Token Account: ${vaultTokenAccount.toBase58()}`);

  // Check if owner ATA exists, create if not
  const accountInfo = await program.provider.connection.getAccountInfo(
    ownerTokenAccount
  );
  if (!accountInfo) {
    console.log("  Creating owner's associated token account for USDC...");
    const createAtaTx = await program.provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          owner,
          ownerTokenAccount,
          owner,
          usdcMint
        )
      )
    );
    console.log(`  ATA created: ${createAtaTx}`);
  }

  // Mint USDC to owner's account
  const mintAmount = INITIAL_LIQUIDITY.USDC * Math.pow(10, DECIMALS.USDC);
  console.log(`  Minting ${INITIAL_LIQUIDITY.USDC} USDC...`);

  try {
    const mintTx = await mintTo(
      program.provider.connection,
      walletKeypair,
      usdcMint,
      ownerTokenAccount,
      walletKeypair,
      mintAmount
    );
    console.log(`  ✅ Minted ${INITIAL_LIQUIDITY.USDC} USDC`);
    console.log(`  Mint transaction: ${mintTx}`);

    // Deposit USDC to vault
    const depositAmount = new anchor.BN(mintAmount);

    const tx = await program.methods
      .depositLiquidity(depositAmount)
      .accountsPartial({
        mmVault,
        vaultTokenAccount,
        assetMint: usdcMint,
        ownerTokenAccount,
        owner,
      })
      .rpc();

    console.log(`  ✅ Deposited ${INITIAL_LIQUIDITY.USDC} USDC`);
    console.log(`  Transaction: ${tx}`);

    // Verify
    const vault = await program.account.marketMakerVault.fetch(mmVault);
    const depositedUSDC = vault.totalDeposited.toNumber() / Math.pow(10, DECIMALS.USDC);
    console.log(`  Total Deposited: ${depositedUSDC} USDC`);
    console.log(`  Available Liquidity: ${vault.availableLiquidity.toNumber() / Math.pow(10, DECIMALS.USDC)} USDC`);

  } catch (error) {
    console.error("  ❌ Error minting/depositing USDC:");
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
