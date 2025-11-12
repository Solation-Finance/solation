import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "../config/constants";

/**
 * PDA derivation functions for the Solation program
 */

export function getGlobalStatePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    PROGRAM_ID
  );
}

export function getAssetConfigPDA(assetMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("asset_config"), assetMint.toBuffer()],
    PROGRAM_ID
  );
}

export function getMarketMakerPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market_maker"), owner.toBuffer()],
    PROGRAM_ID
  );
}

export function getMMVaultPDA(
  marketMaker: PublicKey,
  assetMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mm_vault"), marketMaker.toBuffer(), assetMint.toBuffer()],
    PROGRAM_ID
  );
}

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

export function getVaultAuthorityPDA(
  marketMaker: PublicKey,
  assetMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mm_vault"), marketMaker.toBuffer(), assetMint.toBuffer()],
    PROGRAM_ID
  );
}

export function getPositionPDA(
  user: PublicKey,
  positionId: bigint
): [PublicKey, number] {
  const positionIdBuffer = Buffer.alloc(8);
  positionIdBuffer.writeBigUInt64LE(positionId);

  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), user.toBuffer(), positionIdBuffer],
    PROGRAM_ID
  );
}

export function getPositionUserVaultPDA(
  position: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position_user_vault"), position.toBuffer()],
    PROGRAM_ID
  );
}

export function getPositionMMVaultPDA(position: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position_mm_vault"), position.toBuffer()],
    PROGRAM_ID
  );
}
