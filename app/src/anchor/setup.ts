import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TheraSol, IDL as TheraSolIDL } from "./idl";

// Network and connection setup
export const network = clusterApiUrl("devnet");
export const connection = new Connection(network, "confirmed");
export const PROGRAM_ID = new PublicKey("9TvEeaFS2aJLMaheLvwvZyhfksFN4khTaxeEctzZhqnW");

// Initialize provider and program
export const provider = new anchor.AnchorProvider(connection, window.solana, { commitment: 'confirmed' });
anchor.setProvider(provider);
export const program = new Program<TheraSol>(TheraSolIDL, PROGRAM_ID, provider);

// Helper functions
export const getUserPDA = async (userPubkey: PublicKey) => {
    const [pda] = await PublicKey.findProgramAddress(
        [Buffer.from("user"), userPubkey.toBuffer()],
        program.programId
    );
    return pda;
};
