import { createCirclePaymasterService } from './src/services/circle-paymaster.js';
import type { Address } from 'viem';

async function testPaymasterV07Transfer() {
  console.log("🔥 Testing Circle Paymaster v0.7 Gasless Transfer");
  console.log("=".repeat(55));

  try {
    const paymasterService = createCirclePaymasterService();
    const chainId = 421614; // Arbitrum Sepolia
    const recipientAddress = "0x05Cc73A14C1D667a2dA5cc067c692A012EC7dC16" as Address;
    const amount = "0.23"; // 0.23 USDC

    console.log("📋 Transfer Details:");
    console.log(`   Chain: Arbitrum Sepolia (${chainId})`);
    console.log(`   Recipient: ${recipientAddress}`);
    console.log(`   Amount: ${amount} USDC`);
    console.log(`   Paymaster Version: v0.7 (Circle Smart Account)`);
    console.log(`   Gas Payment: USDC (no ETH needed!) ⛽`);
    console.log();

    // Step 1: Get Circle Smart Account address
    console.log("👤 Getting Circle Smart Account address...");
    const senderAddress = await paymasterService.getAccountAddress(chainId);
    console.log(`   Circle Smart Account: ${senderAddress}`);
    console.log();

    // Step 2: Check USDC balance in Smart Account
    console.log("💰 Checking USDC balance in Circle Smart Account...");
    const balance = await paymasterService.checkUSDCBalance(chainId);
    console.log(`   Current Balance: ${balance} USDC`);
    
    if (parseFloat(balance) < parseFloat(amount)) {
      console.log(`   ❌ Insufficient balance! Need ${amount} USDC, have ${balance} USDC`);
      console.log(`   💡 Fund your Circle Smart Account at: https://faucet.circle.com`);
      console.log(`   📋 Smart Account Address: ${senderAddress}`);
      return;
    }
    console.log(`   ✅ Sufficient balance for transfer`);
    console.log();

    // Step 3: Execute the gasless transfer
    console.log("🚀 Executing gasless transfer...");
    console.log(`   This will use Circle Paymaster v0.7 to pay gas in USDC`);
    console.log();

    const result = await paymasterService.executeGaslessTransfer({
      chainId,
      recipientAddress,
      amount,
    });

    if (result.success) {
      console.log();
      console.log("🎉 GASLESS TRANSFER SUCCESSFUL!");
      console.log("=".repeat(55));
      console.log(`✅ Transaction Hash: ${result.txHash}`);
      console.log(`🔗 Explorer URL: ${result.explorerUrl}`);
      console.log(`💰 Amount Transferred: ${amount} USDC`);
      console.log(`📤 From: ${senderAddress} (Circle Smart Account)`);
      console.log(`📥 To: ${recipientAddress}`);
      console.log(`⛽ Gas Paid With: USDC (via Circle Paymaster v0.7)`);
      console.log(`🌐 Network: Arbitrum Sepolia`);
      console.log();
      console.log("🔍 Verify the transaction:");
      console.log(`   ${result.explorerUrl}`);
      console.log();
      console.log("✨ The recipient received USDC without paying any gas fees!");
      
    } else {
      console.log();
      console.log("❌ TRANSFER FAILED!");
      console.log("=".repeat(55));
      console.log(`Error: ${result.message}`);
      console.log();
      
      if (result.message.includes('Insufficient')) {
        console.log("💡 Fund your Circle Smart Account:");
        console.log(`   Address: ${senderAddress}`);
        console.log(`   Faucet: https://faucet.circle.com`);
        console.log(`   Network: Arbitrum Sepolia`);
      }
    }

  } catch (error) {
    console.error();
    console.error("💥 ERROR OCCURRED!");
    console.error("=".repeat(55));
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error();
    
    if (error instanceof Error && error.message.includes('Private key')) {
      console.error("🔑 Make sure PRIVATE_KEY is set in your .env file");
    }
  }
}

// Run the test
testPaymasterV07Transfer()
  .then(() => {
    console.log("✅ Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Test failed:", error);
    process.exit(1);
  });