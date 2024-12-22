import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TheraSol } from "../target/types/thera_sol";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
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
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      
      // Fund the test user
      const fundTx = await provider.connection.requestAirdrop(
        testUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(fundTx);

      await program.methods
        .initializeUser()
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPDA);
      expect(userAccount.owner.toString()).to.equal(testUser.publicKey.toString());
      expect(userAccount.balance.toNumber()).to.equal(0);
      expect(userAccount.startTime.toNumber()).to.equal(0);
      expect(userAccount.endTime.toNumber()).to.equal(0);
      expect(userAccount.totalSessions).to.equal(0);
    });

    it("Deposit funds", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      // Fund the test user
      const fundTx = await provider.connection.requestAirdrop(
        testUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(fundTx);

      // Initialize the account
      await program.methods
        .initializeUser()
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      // Deposit funds
      await program.methods
        .depositFunds(depositAmount)
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPDA);
      expect(userAccount.balance.toNumber()).to.equal(depositAmount.toNumber());
    });
  });

  describe("Session Management", () => {
    it("Start session", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000));

      // Fund the test user
      const fundTx = await provider.connection.requestAirdrop(
        testUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(fundTx);

      // Initialize the account
      await program.methods
        .initializeUser()
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      await program.methods
        .startSession(startTime)
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPDA);
      expect(userAccount.startTime.toNumber()).to.equal(startTime.toNumber());
      expect(userAccount.endTime.toNumber()).to.equal(0);
    });

    it("Cannot start another session while one is active", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000));

      // Fund the test user
      const fundTx = await provider.connection.requestAirdrop(
        testUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(fundTx);

      // Initialize the account
      await program.methods
        .initializeUser()
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      // Start first session
      await program.methods
        .startSession(startTime)
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      try {
        // Try to start another session
        await program.methods
          .startSession(startTime)
          .accounts({
            user: testUser.publicKey,
            userAccount: userPDA,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect(error.toString()).to.include("AlreadyInSession");
      }
    });

    it("End session", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000));
      const endTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour later

      // Fund the test user
      const fundTx = await provider.connection.requestAirdrop(
        testUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(fundTx);

      // Initialize the account
      await program.methods
        .initializeUser()
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      // Start a session
      await program.methods
        .startSession(startTime)
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // End the session
      await program.methods
        .endSession(endTime)
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPDA);
      expect(userAccount.endTime.toNumber()).to.equal(endTime.toNumber());
      expect(userAccount.totalSessions).to.equal(1);
    });

    it("Cannot end session when not in session", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const endTime = new anchor.BN(Math.floor(Date.now() / 1000));

      // Fund the test user
      const fundTx = await provider.connection.requestAirdrop(
        testUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(fundTx);

      // Initialize the account
      await program.methods
        .initializeUser()
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      try {
        await program.methods
          .endSession(endTime)
          .accounts({
            user: testUser.publicKey,
            userAccount: userPDA,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect(error.toString()).to.include("NotInSession");
      }
    });

    it("Cannot end session with invalid timestamp", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000));
      const invalidEndTime = new anchor.BN(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago

      // Fund the test user
      const fundTx = await provider.connection.requestAirdrop(
        testUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(fundTx);

      // Initialize the account
      await program.methods
        .initializeUser()
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      // Start a session
      await program.methods
        .startSession(startTime)
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      try {
        await program.methods
          .endSession(invalidEndTime)
          .accounts({
            user: testUser.publicKey,
            userAccount: userPDA,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect(error.toString()).to.include("InvalidEndTime");
      }
    });
  });
});
