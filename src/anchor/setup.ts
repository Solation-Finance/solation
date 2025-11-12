import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import IDL from "./idl/solation.json";
import { PROGRAM_ID } from "../config/constants";

export type SolationProgram = Program<Idl>;

/**
 * Get the Anchor program instance
 */
export function getProgram(
  connection: Connection,
  wallet: AnchorWallet
): SolationProgram {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  return new Program(IDL as Idl, PROGRAM_ID, provider);
}

/**
 * Get the program without a wallet (read-only operations)
 */
export function getProgramReadonly(connection: Connection): SolationProgram {
  const provider = new AnchorProvider(
    connection,
    {} as AnchorWallet, // Dummy wallet for read-only
    {
      commitment: "confirmed",
    }
  );

  return new Program(IDL as Idl, PROGRAM_ID, provider);
}
