import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hex,
} from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toCircleSmartAccount } from '@circle-fin/modular-wallets-core';
import { config } from './src/core/config.js';
import { getRpcUrl } from './src/core/chains.js';

const CHAIN_ID = 421614;

async function deploySmartAccount() {
  console.log("🚀 Deploying Circle Smart Account");
  console.log("=".repeat(50));

  try {
    if (!config.privateKey) {
      throw new Error('Private key not found in .env');
    }

    // Create clients
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(getRpcUrl(CHAIN_ID)),
    });

    const account = privateKeyToAccount(config.privateKey as Hex);
    const walletClient = createWalletClient({
      account,
      chain: arbitrumSepolia,
      transport: http(getRpcUrl(CHAIN_ID)),
    });

    console.log("📍 Owner Address:", account.address);

    // Get smart account (this creates the instance)
    const smartAccount = await toCircleSmartAccount({ 
      client: publicClient, 
      owner: account 
    });
    
    console.log("📋 Smart Account Address:", smartAccount.address);

    // Check if already deployed
    const code = await publicClient.getCode({
      address: smartAccount.address,
    });

    if (code && code !== '0x') {
      console.log("✅ Smart Account is already deployed!");
      console.log(`   Code size: ${code.length} characters`);
      return;
    }

    console.log("⚠️  Smart Account not deployed yet. Deploying...");

    // Deploy the smart account by sending a simple transaction
    // This will trigger the CREATE2 deployment
    console.log("🔄 Sending deployment transaction...");
    
    // Send a minimal ETH transaction to deploy the account
    const txHash = await walletClient.sendTransaction({
      to: smartAccount.address,
      value: 0n, // Send 0 ETH just to deploy
    });

    console.log(`   Transaction Hash: ${txHash}`);
    console.log(`   🔍 Explorer: https://sepolia.arbiscan.io/tx/${txHash}`);

    // Wait for confirmation
    console.log("⏳ Waiting for deployment confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 1 
    });

    if (receipt.status === 'success') {
      console.log("✅ Smart Account deployed successfully!");
      
      // Verify deployment
      const newCode = await publicClient.getCode({
        address: smartAccount.address,
      });

      if (newCode && newCode !== '0x') {
        console.log(`   ✅ Verification: Contract code found (${newCode.length} chars)`);
        console.log();
        console.log("🎯 Next Steps:");
        console.log("1. Your Smart Account is now deployed and ready");
        console.log("2. Run the gasless transfer script again");
        console.log("3. The account abstraction should work now!");
      } else {
        console.log("❌ Warning: No contract code found after deployment");
      }

    } else {
      console.log("❌ Deployment failed!");
    }

  } catch (error) {
    console.error("❌ Deployment failed:", error);
  }
}

// Execute deployment
deploySmartAccount();
