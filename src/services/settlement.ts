import { PublicKey, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SolationProgram } from "../anchor/setup";
import {
  getAssetConfigPDA,
  getMarketMakerPDA,
  getMMVaultPDA,
  getVaultAuthorityPDA,
  getPositionUserVaultPDA,
  getPositionMMVaultPDA,
  getPositionPDA,
} from "../anchor/pdas";
import { MARKET_MAKER_OWNER } from "../config/constants";

export interface SettlePositionParams {
  program: SolationProgram;
  userPublicKey: PublicKey;
  positionPublicKey: PublicKey;
  assetMint: PublicKey;
  quoteMint: PublicKey;
  positionId: bigint;
}

/**
 * Settle an expired position
 * Uses a mock Pyth price update account for testing
 */
export async function settlePosition(params: SettlePositionParams): Promise<string> {
  const {
    program,
    userPublicKey,
    positionPublicKey,
    assetMint,
    quoteMint,
    positionId,
  } = params;

  // Derive PDAs
  const [assetConfig] = getAssetConfigPDA(assetMint);
  const [marketMaker] = getMarketMakerPDA(MARKET_MAKER_OWNER);
  const [positionUserVault] = getPositionUserVaultPDA(positionPublicKey);
  const [positionMMVault] = getPositionMMVaultPDA(positionPublicKey);
  const [position] = getPositionPDA(userPublicKey, positionId);
  const [mmVault] = getMMVaultPDA(marketMaker, assetMint);
  const [vaultAuthority] = getVaultAuthorityPDA(marketMaker, assetMint);

  // Get user destination token accounts
  const userDestination = await getAssociatedTokenAddress(
    assetMint,
    userPublicKey
  );

  // Get MM vault state to retrieve token account
  const mmVaultState = await program.account.marketMakerVault.fetch(mmVault);
  const mmDestination = mmVaultState.vaultTokenAccount;

  // Create a mock Pyth price update account
  // In production, you would use actual Pyth price feeds
  const mockPriceUpdate = createMockPythPriceAccount();

  console.log("Settling position with accounts:");
  console.log("  Position:", positionPublicKey.toBase58());
  console.log("  Asset Config:", assetConfig.toBase58());
  console.log("  Market Maker:", marketMaker.toBase58());
  console.log("  User:", userPublicKey.toBase58());

  try {
    const tx = await program.methods
      .settlePosition()
      .accounts({
        position: positionPublicKey,
        assetConfig,
        marketMaker,
        positionUserVault,
        positionMmVault: positionMMVault,
        positionVaultAuthority: position, // Same as position PDA
        mmVault,
        userDestination,
        mmDestination,
        priceUpdate: mockPriceUpdate,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Position settled! Transaction:", tx);
    return tx;
  } catch (error) {
    console.error("❌ Error settling position:");
    console.error(error);
    throw error;
  }
}

/**
 * Create a mock Pyth price update account
 * In production, you would use actual Pyth price feeds
 *
 * For localnet testing, this returns a dummy keypair
 * The actual price checking would need to be disabled in the contract
 * or you'd need to set up a local Pyth oracle
 */
function createMockPythPriceAccount(): PublicKey {
  // For now, return a dummy public key
  // In a real implementation, you would:
  // 1. Run a local Pyth oracle
  // 2. Or modify the contract to accept mock prices for testing
  // 3. Or use Pyth's localnet deployment

  // This is a placeholder - the contract will need to handle this appropriately
  return Keypair.generate().publicKey;
}

/**
 * Check if a position can be settled
 * Returns true if the position is expired and active
 */
export async function canSettlePosition(
  program: SolationProgram,
  positionPublicKey: PublicKey
): Promise<boolean> {
  try {
    const position = await program.account.position.fetch(positionPublicKey);
    const now = Math.floor(Date.now() / 1000);

    // Check if position is active and expired
    const status = (position as any).status;
    const isActive = status.active !== undefined;
    const isExpired = (position as any).expiryTimestamp.toNumber() <= now;

    return isActive && isExpired;
  } catch (error) {
    console.error("Error checking position settlement status:");
    console.error(error);
    return false;
  }
}

/**
 * Get positions that are ready to be settled
 */
export async function getSettleablePositions(
  program: SolationProgram,
  userPublicKey: PublicKey
): Promise<PublicKey[]> {
  try {
    const positions = await program.account.position.all([
      {
        memcmp: {
          offset: 8 + 8, // Discriminator (8) + position_id (8)
          bytes: userPublicKey.toBase58(),
        },
      },
    ]);

    const now = Math.floor(Date.now() / 1000);
    const settleable: PublicKey[] = [];

    for (const p of positions) {
      const account = p.account as any;
      const status = account.status;
      const isActive = status.active !== undefined;
      const isExpired = account.expiryTimestamp.toNumber() <= now;

      if (isActive && isExpired) {
        settleable.push(p.publicKey);
      }
    }

    return settleable;
  } catch (error) {
    console.error("Error fetching settleable positions:");
    console.error(error);
    return [];
  }
}
