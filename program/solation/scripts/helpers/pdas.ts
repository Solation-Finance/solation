import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants";

/**
 * Derive the global state PDA
 */
export function getGlobalStatePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    PROGRAM_ID
  );
}

/**
 * Derive the asset config PDA for a given asset mint
 */
export function getAssetConfigPDA(assetMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("asset_config"), assetMint.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive the market maker PDA for a given owner
 */
export function getMarketMakerPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market_maker"), owner.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive the market maker vault PDA
 */
export function getMMVaultPDA(
  marketMaker: PublicKey,
  assetMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mm_vault"), marketMaker.toBuffer(), assetMint.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive the vault token account PDA
 */
export function getVaultTokenAccountPDA(
  marketMaker: PublicKey,
  assetMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault_token_account"),
      marketMaker.toBuffer(),
      assetMint.toBuffer(),
    ],
    PROGRAM_ID
  );
}

/**
 * Derive the vault authority PDA (same as mm_vault for this program)
 */
export function getVaultAuthorityPDA(
  marketMaker: PublicKey,
  assetMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mm_vault"), marketMaker.toBuffer(), assetMint.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive the position PDA
 */
export function getPositionPDA(
  user: PublicKey,
  positionId: number
): [PublicKey, number] {
  const positionIdBuffer = Buffer.alloc(8);
  positionIdBuffer.writeBigUInt64LE(BigInt(positionId));

  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), user.toBuffer(), positionIdBuffer],
    PROGRAM_ID
  );
}

/**
 * Derive the position user vault PDA
 */
export function getPositionUserVaultPDA(
  position: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position_user_vault"), position.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive the position MM vault PDA
 */
export function getPositionMMVaultPDA(
  position: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position_mm_vault"), position.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive the quote PDA
 * Strategy: 0 = CoveredCall, 1 = CashSecuredPut
 */
export function getQuotePDA(
  marketMaker: PublicKey,
  assetMint: PublicKey,
  strategy: number
): [PublicKey, number] {
  const strategyBuffer = Buffer.alloc(1);
  strategyBuffer.writeUInt8(strategy);

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("quote"),
      marketMaker.toBuffer(),
      assetMint.toBuffer(),
      strategyBuffer,
    ],
    PROGRAM_ID
  );
}
