import { PublicKey, Transaction, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import { SolationProgram } from "../anchor/setup";
import {
  getGlobalStatePDA,
  getMarketMakerPDA,
  getAssetConfigPDA,
  getPositionPDA,
  getPositionUserVaultPDA,
  getPositionMMVaultPDA,
  getMMVaultPDA,
  getVaultAuthorityPDA,
} from "../anchor/pdas";
import { MARKET_MAKER_OWNER } from "../config/constants";

export interface CreatePositionParams {
  program: SolationProgram;
  userPublicKey: PublicKey;
  assetMint: PublicKey;
  quoteMint: PublicKey; // USDC
  quoteAddress: PublicKey; // The quote account to use
  strikePrice: number; // in base units (e.g., 180_00000000 for $180)
  contractSize: number; // in lamports/smallest unit
  positionId: bigint; // unique position ID for the user
}

/**
 * Create a new options position
 * This executes the create_position instruction
 */
export async function createPosition(params: CreatePositionParams): Promise<string> {
  const {
    program,
    userPublicKey,
    assetMint,
    quoteMint,
    quoteAddress,
    strikePrice,
    contractSize,
    positionId,
  } = params;

  // Derive PDAs
  const [globalState] = getGlobalStatePDA();
  const [marketMaker] = getMarketMakerPDA(MARKET_MAKER_OWNER);
  const [assetConfig] = getAssetConfigPDA(assetMint);
  const [position] = getPositionPDA(userPublicKey, positionId);
  const [positionUserVault] = getPositionUserVaultPDA(position);
  const [positionUserVaultAuthority] = getPositionPDA(userPublicKey, positionId); // Same as position
  const [positionMMVault] = getPositionMMVaultPDA(position);
  const [positionMMVaultAuthority] = getPositionPDA(userPublicKey, positionId); // Same as position
  const [mmVault] = getMMVaultPDA(marketMaker, quoteMint); // Premium vault (USDC)
  const [mmPremiumVault] = getMMVaultPDA(marketMaker, quoteMint);
  const [vaultAuthority] = getVaultAuthorityPDA(marketMaker, quoteMint);

  // Get MM vault state to retrieve token account addresses
  const mmVaultState = await program.account.marketMakerVault.fetch(mmVault);
  const mmVaultTokenAccount = mmVaultState.vaultTokenAccount;

  const mmPremiumVaultState = await program.account.marketMakerVault.fetch(mmPremiumVault);
  const mmPremiumVaultTokenAccount = mmPremiumVaultState.vaultTokenAccount;

  // Get user token accounts
  const userAssetTokenAccount = await getAssociatedTokenAddress(
    assetMint,
    userPublicKey
  );

  const userPremiumAccount = await getAssociatedTokenAddress(
    quoteMint,
    userPublicKey
  );

  console.log("Creating position with accounts:");
  console.log("  Global State:", globalState.toBase58());
  console.log("  Market Maker:", marketMaker.toBase58());
  console.log("  Quote:", quoteAddress.toBase58());
  console.log("  Asset Config:", assetConfig.toBase58());
  console.log("  Position:", position.toBase58());
  console.log("  User:", userPublicKey.toBase58());

  try {
    const tx = await program.methods
      .createPosition(
        new BN(positionId.toString()),
        new BN(strikePrice),
        new BN(contractSize)
      )
      .accounts({
        globalState,
        marketMaker,
        quote: quoteAddress,
        assetConfig,
        position,
        positionUserVault,
        positionUserVaultAuthority,
        positionMmVault: positionMMVault,
        positionMmVaultAuthority: positionMMVaultAuthority,
        mmVault,
        mmVaultTokenAccount,
        mmVaultAuthority: vaultAuthority,
        mmPremiumVault,
        mmPremiumVaultTokenAccount,
        mmPremiumVaultAuthority: vaultAuthority,
        userTokenAccount: userAssetTokenAccount,
        userPremiumAccount,
        userAssetMint: assetMint,
        mmAssetMint: quoteMint,
        premiumMint: quoteMint,
        user: userPublicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: PublicKey.default, // SystemProgram.programId
      })
      .rpc();

    console.log("✅ Position created! Transaction:", tx);
    return tx;
  } catch (error) {
    console.error("❌ Error creating position:");
    console.error(error);
    throw error;
  }
}

/**
 * Fetch all positions for a user
 */
export async function fetchUserPositions(
  program: SolationProgram,
  userPublicKey: PublicKey
) {
  try {
    const positions = await program.account.position.all([
      {
        memcmp: {
          offset: 8 + 8, // Discriminator (8) + position_id (8)
          bytes: userPublicKey.toBase58(),
        },
      },
    ]);

    return positions.map((p) => ({
      publicKey: p.publicKey,
      account: p.account,
    }));
  } catch (error) {
    console.error("Error fetching user positions:");
    console.error(error);
    return [];
  }
}

/**
 * Fetch a single position by its public key
 */
export async function fetchPosition(
  program: SolationProgram,
  positionPublicKey: PublicKey
) {
  try {
    const position = await program.account.position.fetch(positionPublicKey);
    return position;
  } catch (error) {
    console.error("Error fetching position:");
    console.error(error);
    return null;
  }
}

/**
 * Get the next available position ID for a user
 * This counts existing positions and returns the next sequential ID
 */
export async function getNextPositionId(
  program: SolationProgram,
  userPublicKey: PublicKey
): Promise<bigint> {
  const positions = await fetchUserPositions(program, userPublicKey);
  return BigInt(positions.length);
}
