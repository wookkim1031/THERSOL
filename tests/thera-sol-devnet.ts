import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TheraSol } from "../target/types/thera_sol";
import { PublicKey, LAMPORTS_PER_SOL, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import { expect } from 'chai';
import { airdropIfRequired } from "@solana-developers/helpers";

describe("thera-sol-devnet", () => {
  // Configure the client to use devnet
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

  // Helper function to fund an account
  const fundAccount = async (address: PublicKey, amount: number) => {
    // First ensure the provider wallet has enough SOL
    await airdropIfRequired(provider, provider.wallet.publicKey, 2 * LAMPORTS_PER_SOL);
    
    const balance = await provider.connection.getBalance(address);
    const minBalance = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL minimum balance

    if (balance < minBalance) {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: address,
          lamports: amount,
        })
      );

      const signature = await provider.sendAndConfirm(transaction);
      await confirmTx(signature);

      // Wait a bit after transfer
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

  it("Complete lifecycle test", async () => {
    // Create a new keypair for this test
    const testUser = Keypair.generate();
    const userPDA = await getUserPDA(testUser.publicKey);

    // Use minimal amounts
    const depositAmount = new anchor.BN(0.05 * LAMPORTS_PER_SOL); // 0.05 SOL
    const withdrawAmount = new anchor.BN(0.02 * LAMPORTS_PER_SOL); // 0.02 SOL

    // Fund the test user with minimal amount
    console.log("Funding test user account...");
    await fundAccount(testUser.publicKey, 0.1 * LAMPORTS_PER_SOL); // Just enough for deposit and fees

    console.log("1. Initializing user account...");
    await program.methods
      .initializeUser()
      .accounts({
        user: testUser.publicKey,
        userAccount: userPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([testUser])
      .rpc();

    // Verify initialization
    let userAccount = await program.account.userAccount.fetch(userPDA);
    expect(userAccount.owner.toString()).to.equal(testUser.publicKey.toString());
    expect(userAccount.balance.toNumber()).to.equal(0);
    console.log("✓ User account initialized");

    console.log("2. Depositing funds...");
    await program.methods
      .depositFunds(depositAmount)
      .accounts({
        user: testUser.publicKey,
        userAccount: userPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([testUser])
      .rpc();

    // Verify deposit
    userAccount = await program.account.userAccount.fetch(userPDA);
    expect(userAccount.balance.toString()).to.equal(depositAmount.toString());
    console.log("✓ Funds deposited:", depositAmount.toString(), "lamports");

    console.log("3. Starting session...");
    const startTime = Math.floor(Date.now() / 1000);
    await program.methods
      .startSession(new anchor.BN(startTime))
      .accounts({
        user: testUser.publicKey,
        userAccount: userPDA,
      })
      .signers([testUser])
      .rpc();

    // Verify session start
    userAccount = await program.account.userAccount.fetch(userPDA);
    expect(userAccount.startTime.toString()).to.equal(startTime.toString());
    console.log("✓ Session started at:", startTime);

    // Wait for 2 minutes to accumulate some session time
    console.log("Waiting for 2 minutes...");
    await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));

    console.log("4. Ending session...");
    const endTime = Math.floor(Date.now() / 1000);
    await program.methods
      .endSession(new anchor.BN(endTime))
      .accounts({
        user: testUser.publicKey,
        userAccount: userPDA,
      })
      .signers([testUser])
      .rpc();

    // Verify session end
    userAccount = await program.account.userAccount.fetch(userPDA);
    expect(userAccount.endTime.toString()).to.equal(endTime.toString());
    expect(userAccount.sessionHistory.length).to.equal(1);
    console.log("✓ Session ended at:", endTime);

    console.log("5. Checking free balance...");
    const tx = await program.methods
      .checkFreeBalance()
      .accounts({
        user: testUser.publicKey,
        userAccount: userPDA,
      })
      .signers([testUser])
      .rpc();

    // Wait for transaction confirmation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get the event from the transaction logs
    const txInfo = await provider.connection.getTransaction(tx, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    const events = eventParser.parseLogs(txInfo.meta.logMessages);
    const freeBalanceEvent = events.find((event) => event.name === 'FreeBalanceEvent');
    const freeBalance = freeBalanceEvent.data.freeBalance;
    console.log("✓ Free balance:", freeBalance.toString(), "lamports");

    console.log("6. Withdrawing remaining funds...");
    await program.methods
      .reclaimFunds(withdrawAmount)
      .accounts({
        user: testUser.publicKey,
        userAccount: userPDA,
      })
      .signers([testUser])
      .rpc();

    // Verify withdrawal
    userAccount = await program.account.userAccount.fetch(userPDA);
    const sessionDurationMinutes = Math.ceil((endTime - startTime) / 60);
    const sessionCost = new anchor.BN(100_000 * sessionDurationMinutes); // RATE_PER_MINUTE * duration
    const expectedRemainingBalance = depositAmount.sub(withdrawAmount).sub(sessionCost);
    expect(userAccount.balance.toString()).to.equal(expectedRemainingBalance.toString());
    console.log("✓ Withdrew:", withdrawAmount.toString(), "lamports");
    console.log("✓ Remaining balance:", userAccount.balance.toString(), "lamports");
    console.log("✓ Session cost:", sessionCost.toString(), "lamports");
  });
});
