import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TheraSol } from "../target/types/thera_sol";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from 'chai';

describe("thera-sol", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TheraSol as Program<TheraSol>;
  const user = provider.wallet;

  const getUserPDA = async (userPubkey: PublicKey) => {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from("user"), userPubkey.toBuffer()],
      program.programId
    );
    return pda;
  };

  describe("User Account Management", () => {
    it("Initialize user account", async () => {
      const userPDA = await getUserPDA(user.publicKey);
      
      const tx = await program.methods
        .initializeUser()
        .accounts({
          user: user.publicKey,
          userAccount: userPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPDA);
      
      expect(userAccount.owner.toString()).to.equal(user.publicKey.toString());
      expect(userAccount.balance.toNumber()).to.equal(0);
      expect(userAccount.startTime.toNumber()).to.equal(0);
      expect(userAccount.endTime.toNumber()).to.equal(0);
      expect(userAccount.totalSessions).to.equal(0);
    });

    it("Deposit funds", async () => {
      const userPDA = await getUserPDA(user.publicKey);
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      const tx = await program.methods
        .depositFunds(depositAmount)
        .accounts({
          user: user.publicKey,
          userAccount: userPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPDA);
      expect(userAccount.balance.toNumber()).to.equal(depositAmount.toNumber());
    });
  });

  describe("Session Management", () => {
    it("Start session", async () => {
      const userPDA = await getUserPDA(user.publicKey);
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000));

      const tx = await program.methods
        .startSession(startTime)
        .accounts({
          user: user.publicKey,
          userAccount: userPDA,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPDA);
      expect(userAccount.startTime.toNumber()).to.equal(startTime.toNumber());
      expect(userAccount.endTime.toNumber()).to.equal(0);
    });

    it("Cannot start another session while one is active", async () => {
      const userPDA = await getUserPDA(user.publicKey);
      const newStartTime = new anchor.BN(Math.floor(Date.now() / 1000));

      try {
        await program.methods
          .startSession(newStartTime)
          .accounts({
            user: user.publicKey,
            userAccount: userPDA,
          })
          .rpc();
        expect.fail("Should have thrown AlreadyInSession error");
      } catch (error) {
        expect(error.toString()).to.include("AlreadyInSession");
      }
    });

    it("End session", async () => {
      const userPDA = await getUserPDA(user.publicKey);
      const endTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour later

      const tx = await program.methods
        .endSession(endTime)
        .accounts({
          user: user.publicKey,
          userAccount: userPDA,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPDA);
      expect(userAccount.endTime.toNumber()).to.equal(endTime.toNumber());
      expect(userAccount.totalSessions).to.equal(1);
    });

    it("Cannot end session when not in session", async () => {
      const userPDA = await getUserPDA(user.publicKey);
      const endTime = new anchor.BN(Math.floor(Date.now() / 1000));

      try {
        await program.methods
          .endSession(endTime)
          .accounts({
            user: user.publicKey,
            userAccount: userPDA,
          })
          .rpc();
        expect.fail("Should have thrown NotInSession error");
      } catch (error) {
        expect(error.toString()).to.include("NotInSession");
      }
    });

    it("Cannot end session with invalid timestamp", async () => {
      const userPDA = await getUserPDA(user.publicKey);
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000));
      
      // Start a new session
      await program.methods
        .startSession(startTime)
        .accounts({
          user: user.publicKey,
          userAccount: userPDA,
        })
        .rpc();

      // Try to end session with earlier timestamp
      const invalidEndTime = new anchor.BN(startTime.toNumber() - 3600);

      try {
        await program.methods
          .endSession(invalidEndTime)
          .accounts({
            user: user.publicKey,
            userAccount: userPDA,
          })
          .rpc();
        expect.fail("Should have thrown InvalidEndTime error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidEndTime");
      }
    });
  });
});
