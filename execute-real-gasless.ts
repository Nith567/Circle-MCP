import { createRealCirclePaymaster } from './src/services/real-circle-paymaster.js';
import type { Address } from 'viem';

async function executeRealGaslessTransfer() {
  console.log("🔥 EXECUTING REAL GASLESS USDC TRANSFER");
  console.log("=".repeat(70));
  console.log("⚠️  This will create an ACTUAL on-chain transaction!");
  console.log();

  try {
    const paymaster = createRealCirclePaymaster();
    const recipientAddress = "0x8879318091671ba1274e751f8cDEF76bb37eb3eD" as Address;
    const amount = "0.28"; // 0.28 USDC

    console.log("📋 REAL Transfer Details:");
    console.log(`   Chain: Arbitrum Sepolia (421614)`);
    console.log(`   To: ${recipientAddress}`);
    console.log(`   Amount: ${amount} USDC`);
    console.log(`   Gas Payment: USDC via Circle Paymaster`);
    console.log(`   Paymaster: 0x31BE08D380A21fc740883c0BC434FcFc88740b58`);
    console.log();

    // Get smart account address
    console.log("👤 Getting Circle Smart Account address...");
    const smartAccountAddress = await paymaster.getSmartAccountAddress();
    console.log(`   Smart Account: ${smartAccountAddress}`);
    console.log();

    console.log("⚡ EXECUTING REAL GASLESS TRANSFER...");
    console.log("   This will submit to Pimlico bundler!");
    console.log();

    const result = await paymaster.executeRealGaslessTransfer({
      recipientAddress,
      amount,
    });

    if (result.success) {
      console.log("🎉 REAL GASLESS TRANSFER SUCCESSFUL!");
      console.log(`   💸 Sent: ${amount} USDC`);
      console.log(`   👤 To: ${recipientAddress}`);
      console.log(`   ⛽ Gas: Paid with USDC (NO ETH USED!)`);
      console.log(`   🔗 User Operation Hash: ${result.userOperationHash}`);
      
      if (result.transactionHash) {
        console.log(`   🧾 Transaction Hash: ${result.transactionHash}`);
        console.log(`   🔍 View on Explorer: https://sepolia.arbiscan.io/tx/${result.transactionHash}`);
      } else {
        console.log("   ⏳ Transaction hash will be available after confirmation");
        console.log(`   🔍 Track User Op: https://jiffyscan.xyz/userOpHash/${result.userOperationHash}?network=arbitrum-sepolia`);
      }

      console.log();
      console.log("🔥 REAL BENEFITS ACHIEVED:");
      console.log("✅ Zero ETH spent on gas fees");
      console.log("✅ Gas automatically paid from USDC balance");
      console.log("✅ Recipient gets exactly 0.28 USDC");
      console.log("✅ Account Abstraction working!");
      console.log("✅ Circle Paymaster v0.7 live!");

    } else {
      console.log("❌ REAL TRANSFER FAILED!");
      console.log(`   Error: ${result.message}`);
      if (result.error) {
        console.log(`   Details: ${result.error}`);
      }

      // Common issues and solutions
      console.log();
      console.log("💡 Common Issues:");
      console.log("1. Insufficient USDC balance in smart account");
      console.log("2. Smart account not deployed yet");
      console.log("3. Bundler connectivity issues");
      console.log("4. Paymaster validation failures");
    }

  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('Private key')) {
        console.log();
        console.log("🔧 Fix Required:");
        console.log("1. Set PRIVATE_KEY in .env file");
        console.log("2. Ensure private key is valid");
      } else if (error.message.includes('fetch')) {
        console.log();
        console.log("🌐 Network Issue:");
        console.log("1. Check internet connection");
        console.log("2. Verify bundler URL is accessible");
        console.log("3. Try again in a few minutes");
      }
    }
  }
}

// Execute the real gasless transfer
console.log("🚨 WARNING: This will execute a REAL on-chain transaction!");
console.log("   Press Ctrl+C to cancel, or wait 3 seconds to proceed...");

setTimeout(() => {
  executeRealGaslessTransfer();
}, 3000);
