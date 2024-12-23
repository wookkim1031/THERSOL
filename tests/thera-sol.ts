import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TheraSol } from "../target/types/thera_sol";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { expect } from 'chai';

describe("thera-sol", () => {
  // Configure the client to use the devnet cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TheraSol as Program<TheraSol>;
  const user = provider.wallet;

  // Helper function to confirm transaction with retries
  const confirmTx = async (signature: string) => {
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature,
      ...latestBlockhash
    }, "confirmed");
  };

  // Helper function for airdrop with confirmation
  const requestAirdrop = async (address: PublicKey, amount: number) => {
    const balance = await provider.connection.getBalance(address);
    const minBalance = 0.5 * LAMPORTS_PER_SOL; // 0.5 SOL minimum balance
    
    if (balance < minBalance) {
      // Cap airdrop request at 2 SOL (devnet limit)
      const airdropAmount = Math.min(2 * LAMPORTS_PER_SOL, amount);
      const signature = await provider.connection.requestAirdrop(address, airdropAmount);
      await confirmTx(signature);
      
      // Wait a bit after airdrop to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

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
      
      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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
      const depositAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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

      const timestamp = Math.floor(Date.now() / 1000);
      await program.methods
        .startSession(new anchor.BN(timestamp))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPDA);
      expect(userAccount.startTime.toString()).to.equal(timestamp.toString());
    });

    it("Cannot start another session while one is active", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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

      // Start first session
      const timestamp = Math.floor(Date.now() / 1000);
      await program.methods
        .startSession(new anchor.BN(timestamp))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // Try to start another session
      try {
        await program.methods
          .startSession(new anchor.BN(timestamp + 60))
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
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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

      // Start session
      const startTime = Math.floor(Date.now() / 1000);
      await program.methods
        .startSession(new anchor.BN(startTime))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // End session
      const endTime = startTime + 300; // 5 minutes later
      await program.methods
        .endSession(new anchor.BN(endTime))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPDA);
      expect(userAccount.endTime.toString()).to.equal(endTime.toString());
      expect(userAccount.startTime.toString()).to.equal("0");
    });

    it("Cannot end session with invalid timestamp", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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

      // Start session
      const startTime = Math.floor(Date.now() / 1000);
      await program.methods
        .startSession(new anchor.BN(startTime))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // Try to end session with invalid timestamp
      try {
        await program.methods
          .endSession(new anchor.BN(startTime - 60))
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

    it("Cannot start session without minimum balance", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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

      // Try to start session without minimum balance
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        await program.methods
          .startSession(new anchor.BN(timestamp))
          .accounts({
            user: testUser.publicKey,
            userAccount: userPDA,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientBalance");
      }
    });

    it("Tracks session history and costs", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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

      // Start first session
      const startTime1 = Math.floor(Date.now() / 1000);
      await program.methods
        .startSession(new anchor.BN(startTime1))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // End first session after 5 minutes
      const endTime1 = startTime1 + (5 * 60);
      await program.methods
        .endSession(new anchor.BN(endTime1))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // Start second session
      const startTime2 = endTime1 + 60; // Start 1 minute after first session
      await program.methods
        .startSession(new anchor.BN(startTime2))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // End second session after 3 minutes
      const endTime2 = startTime2 + (3 * 60);
      await program.methods
        .endSession(new anchor.BN(endTime2))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // Check free balance
      const tx = await program.methods
        .checkFreeBalance()
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // Wait longer for devnet confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the event from the transaction logs
      const txInfo = await provider.connection.getTransaction(tx, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
      const events = eventParser.parseLogs(txInfo.meta.logMessages);
      const freeBalanceEvent = events.find((event) => event.name === 'FreeBalanceEvent');
      const freeBalance = freeBalanceEvent.data.freeBalance;

      // Get user account
      const userAccount = await program.account.userAccount.fetch(userPDA);

      // Verify session history
      expect(userAccount.sessionHistory.length).to.equal(2);
      expect(userAccount.totalSessions).to.equal(2);

      // Verify first session
      const session1 = userAccount.sessionHistory[0];
      expect(session1.startTime.toString()).to.equal(startTime1.toString());
      expect(session1.endTime.toString()).to.equal(endTime1.toString());
      const session1Cost = Math.floor((endTime1 - startTime1) / 60) * 100_000;
      expect(session1.cost.toString()).to.equal(session1Cost.toString());

      // Verify second session
      const session2 = userAccount.sessionHistory[1];
      expect(session2.startTime.toString()).to.equal(startTime2.toString());
      expect(session2.endTime.toString()).to.equal(endTime2.toString());
      const session2Cost = Math.floor((endTime2 - startTime2) / 60) * 100_000;
      expect(session2.cost.toString()).to.equal(session2Cost.toString());

      // Verify free balance calculation
      const expectedFreeBalance = userAccount.balance;
      expect(freeBalance.toString()).to.equal(expectedFreeBalance.toString());

      // Try to reclaim more funds
      try {
        await program.methods
          .reclaimFunds(depositAmount)
          .accounts({
            user: testUser.publicKey,
            userAccount: userPDA,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientBalance");
      }

      // Reclaim the actual free balance
      await program.methods
        .reclaimFunds(new anchor.BN(expectedFreeBalance))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // Verify the balance is now 0
      const finalUserAccount = await program.account.userAccount.fetch(userPDA);
      expect(finalUserAccount.balance.toString()).to.equal("0");
      // Try to reclaim more funds
      try {
        await program.methods
          .reclaimFunds(new anchor.BN(1))
          .accounts({
            user: testUser.publicKey,
            userAccount: userPDA,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientBalance");
      }
    });

    it("Cannot reclaim more than free balance", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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

      // Run a 10-minute session
      const startTime = Math.floor(Date.now() / 1000);
      await program.methods
        .startSession(new anchor.BN(startTime))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      const endTime = startTime + (10 * 60);
      await program.methods
        .endSession(new anchor.BN(endTime))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // Try to reclaim more than free balance
      try {
        await program.methods
          .reclaimFunds(depositAmount)
          .accounts({
            user: testUser.publicKey,
            userAccount: userPDA,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientBalance");
      }

      // Check that we can reclaim the actual free balance
      const tx = await program.methods
        .checkFreeBalance()
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // Wait longer for devnet confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the event from the transaction logs
      const txInfo = await provider.connection.getTransaction(tx, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
      const events = eventParser.parseLogs(txInfo.meta.logMessages);
      const freeBalanceEvent = events.find((event) => event.name === 'FreeBalanceEvent');
      const freeBalance = freeBalanceEvent.data.freeBalance;

      await program.methods
        .reclaimFunds(new anchor.BN(freeBalance.toString()))
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // Verify the reclaim was successful
      const userAccount = await program.account.userAccount.fetch(userPDA);
      const sessionCost = Math.floor((endTime - startTime) / 60) * 100_000;
      const expectedBalance = depositAmount.sub(new anchor.BN(sessionCost));
      expect(userAccount.balance.toString()).to.equal("0");
      expect(freeBalance.toString()).to.equal(expectedBalance.toString());
      expect(userAccount.balance.toNumber()).to.equal(0);
      expect(freeBalance.toNumber()).to.equal(expectedBalance.toNumber());
      // Try to reclaim more funds
      try {
        await program.methods
          .reclaimFunds(new anchor.BN(1))
          .accounts({
            user: testUser.publicKey,
            userAccount: userPDA,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientBalance");
      }
    });
  });

  describe("Fund Management", () => {
    it("Can reclaim funds", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL
      const reclaimAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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

      // Get initial balances
      const userInitialBalance = await provider.connection.getBalance(testUser.publicKey);
      const pdaInitialBalance = await provider.connection.getBalance(userPDA);

      // Reclaim funds
      await program.methods
        .reclaimFunds(reclaimAmount)
        .accounts({
          user: testUser.publicKey,
          userAccount: userPDA,
        })
        .signers([testUser])
        .rpc();

      // Check balances after reclaim
      const userFinalBalance = await provider.connection.getBalance(testUser.publicKey);
      const pdaFinalBalance = await provider.connection.getBalance(userPDA);
      const userAccount = await program.account.userAccount.fetch(userPDA);

      // Verify balances
      expect(userFinalBalance).to.be.above(userInitialBalance);
      expect(pdaFinalBalance).to.equal(pdaInitialBalance - reclaimAmount.toNumber());
      expect(userAccount.balance.toNumber()).to.equal(depositAmount.toNumber() - reclaimAmount.toNumber());
    });

    it("Cannot reclaim more than available balance", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL
      const reclaimAmount = new anchor.BN(2 * LAMPORTS_PER_SOL); // 2 SOL (more than deposited)

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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

      try {
        // Try to reclaim more than deposited
        await program.methods
          .reclaimFunds(reclaimAmount)
          .accounts({
            user: testUser.publicKey,
            userAccount: userPDA,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientBalance");
      }
    });

    it("Cannot reclaim funds during active session", async () => {
      // Create a new keypair for this test
      const testUser = Keypair.generate();
      const userPDA = await getUserPDA(testUser.publicKey);
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL
      const reclaimAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL
      const startTime = new anchor.BN(Math.floor(Date.now() / 1000));

      // Fund the test user (reduced amount for devnet)
      await requestAirdrop(testUser.publicKey, 1.5 * LAMPORTS_PER_SOL);

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
        // Try to reclaim funds during session
        await program.methods
          .reclaimFunds(reclaimAmount)
          .accounts({
            user: testUser.publicKey,
            userAccount: userPDA,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect(error.toString()).to.include("ActiveSession");
      }
    });
  });
});
