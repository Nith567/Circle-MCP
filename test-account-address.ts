import { createCirclePaymasterService } from './src/services/circle-paymaster.js';

async function testGetAccountAddress() {
  console.log("🔍 Testing Circle Smart Account Address Tool");
  console.log("=".repeat(50));

  try {
    const paymasterService = createCirclePaymasterService();
    const chainId = 421614; // Arbitrum Sepolia

    console.log("📍 Getting Circle Smart Account Address...");
    const accountAddress = await paymasterService.getAccountAddress(chainId);
    console.log(`   Smart Account: ${accountAddress}`);

    console.log();
    console.log("💰 Checking current USDC balance...");
    const balance = await paymasterService.checkUSDCBalance(chainId);
    console.log(`   Current Balance: ${balance} USDC`);

    console.log();
    console.log("📋 Funding Instructions:");
    console.log(`   1. Go to: https://faucet.circle.com`);
    console.log(`   2. Fund this address: ${accountAddress}`);
    console.log(`   3. Recommended amount: 5 USDC`);
    console.log(`   4. This is your SMART ACCOUNT (not your EOA)`);
    console.log(`   5. You need USDC here to pay for gas in gasless transfers`);

    console.log();
    console.log("✅ Account Address Tool Working!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testGetAccountAddress();
