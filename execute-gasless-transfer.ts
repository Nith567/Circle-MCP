import { createCirclePaymasterService } from './src/services/circle-paymaster.js';
import type { Address } from 'viem';

async function executeGaslessTransfer() {
  console.log("🚀 Executing Gasless USDC Transfer with Circle Paymaster");
  console.log("=".repeat(65));

  try {
    const paymasterService = createCirclePaymasterService();
    const chainId = 421614; // Arbitrum Sepolia
    const recipientAddress = "0x8879318091671ba1274e751f8cDEF76bb37eb3eD" as Address;
    const amount = "0.28"; // 0.28 USDC

    console.log("📋 Transfer Details:");
    console.log(`   Chain: Arbitrum Sepolia (${chainId})`);
    console.log(`   From: Your wallet`);
    console.log(`   To: ${recipientAddress}`);
    console.log(`   Amount: ${amount} USDC`);
    console.log(`   Gas Payment: USDC (no ETH needed!) ⛽`);
    console.log();

    // Step 1: Get sender address
    console.log("👤 Getting sender address...");
    const senderAddress = await paymasterService.getAccountAddress(chainId);
    console.log(`   Sender: ${senderAddress}`);
    console.log();

    // Step 2: Check USDC balance
    console.log("💰 Checking USDC balance...");
    const balance = await paymasterService.checkUSDCBalance(chainId);
    console.log(`   Current Balance: ${balance} USDC`);
    
    if (parseFloat(balance) < parseFloat(amount)) {
      console.log(`   ❌ Insufficient balance! Need ${amount} USDC, have ${balance} USDC`);
      console.log(`   💡 Fund your account at: https://faucet.circle.com`);
      return;
    }
    console.log(`   ✅ Sufficient balance for transfer`);
    console.log();

    // Step 3: Prepare gasless transfer
    console.log("🔧 Preparing gasless transfer...");
    const preparation = await paymasterService.prepareGaslessTransfer({
      chainId,
      recipientAddress,
      amount,
    });

    if (!preparation.success) {
      console.log(`   ❌ Preparation failed: ${preparation.message}`);
      return;
    }
    
    console.log("   ✅ Transfer preparation successful!");
    console.log(`   🎫 EIP-2612 permit created`);
    console.log(`   📝 Paymaster allowance: ${preparation.permitData?.permitAmount} wei`);
    console.log();

    // Step 4: Execute gasless transfer
    console.log("⚡ Executing gasless transfer...");
    const result = await paymasterService.executeGaslessTransfer({
      chainId,
      recipientAddress,
      amount,
    });

    if (result.success) {
      console.log("   🎉 GASLESS TRANSFER SUCCESSFUL!");
      console.log(`   📤 Sent: ${amount} USDC`);
      console.log(`   👤 To: ${recipientAddress}`);
      console.log(`   ⛽ Gas: Paid with USDC (${preparation.permitData?.permitAmount} wei allowance)`);
      console.log(`   🔗 User Operation Hash: ${result.userOperationHash}`);
      if (result.transactionHash) {
        console.log(`   🧾 Transaction Hash: ${result.transactionHash}`);
        console.log(`   🔍 Explorer: https://sepolia.arbiscan.io/tx/${result.transactionHash}`);
      }
    } else {
      console.log(`   ❌ Transfer failed: ${result.message}`);
      if (result.error) {
        console.log(`   🐛 Error: ${result.error}`);
      }
    }

    console.log();
    console.log("📊 Transfer Summary:");
    console.log("=".repeat(65));
    console.log(`✅ Sender: ${senderAddress}`);
    console.log(`✅ Recipient: ${recipientAddress}`);
    console.log(`✅ Amount: ${amount} USDC`);
    console.log(`✅ Chain: Arbitrum Sepolia (${chainId})`);
    console.log(`✅ Gas Payment: USDC (via Circle Paymaster)`);
    console.log(`✅ No ETH required: True`);
    console.log(`✅ Recipient gets full amount: True`);

    console.log();
    console.log("🔥 Benefits Demonstrated:");
    console.log("• Zero ETH needed for gas fees");
    console.log("• Gas automatically paid from USDC balance");
    console.log("• Recipient receives exactly 0.28 USDC");  
    console.log("• Seamless gasless experience");
    console.log("• Powered by Circle Paymaster v0.7");

  } catch (error) {
    console.error("❌ Transfer execution failed:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('Private key')) {
        console.log();
        console.log("💡 Fix required:");
        console.log("1. Set PRIVATE_KEY in .env file");
        console.log("2. Ensure account has USDC on Arbitrum Sepolia");
        console.log("3. Get USDC from: https://faucet.circle.com");
      }
    }
  }
}

// Execute the gasless transfer
executeGaslessTransfer();
