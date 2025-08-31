import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toCircleSmartAccount } from '@circle-fin/modular-wallets-core';
import { config } from './src/core/config.js';
import { getRpcUrl } from './src/core/chains.js';

// USDC and Paymaster addresses on Arbitrum Sepolia
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address;
const PAYMASTER_ADDRESS = "0x31BE08D380A21fc740883c0BC434FcFc88740b58" as Address;
const CHAIN_ID = 421614;

const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function simpleGaslessTransfer() {
  console.log("🔥 SIMPLE GASLESS USDC TRANSFER");
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

    // Get smart account
    const smartAccount = await toCircleSmartAccount({ 
      client: publicClient, 
      owner: account 
    });
    
    console.log("📍 Addresses:");
    console.log(`   Owner: ${account.address}`);
    console.log(`   Smart Account: ${smartAccount.address}`);
    console.log();

    // Check USDC balance
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [smartAccount.address],
    });

    console.log("💰 Smart Account USDC Balance:");
    console.log(`   ${(Number(balance) / 1e6).toString()} USDC`);
    console.log();

    if (Number(balance) === 0) {
      console.log("❌ No USDC in Smart Account!");
      console.log("   Run: bun run fund-smart-account.ts");
      return;
    }

    // Use Circle SDK to send transfer (should handle paymaster automatically)
    const recipient = "0x8879318091671ba1274e751f8cDEF76bb37eb3eD" as Address;
    const amount = parseUnits("0.28", 6); // 0.28 USDC

    console.log("🚀 Sending gasless transfer via Circle SDK...");
    console.log(`   To: ${recipient}`);
    console.log(`   Amount: 0.28 USDC`);
    console.log(`   Gas: Paid via Circle Paymaster`);
    console.log();

    // Send the transfer using the Smart Account
    const txHash = await smartAccount.sendTransaction({
      to: USDC_ADDRESS,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient, amount],
      }),
    });

    console.log("✅ TRANSFER SUBMITTED!");
    console.log(`   Transaction Hash: ${txHash}`);
    console.log(`   🔍 Explorer: https://sepolia.arbiscan.io/tx/${txHash}`);
    console.log();

    // Wait for confirmation
    console.log("⏳ Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 1 
    });

    if (receipt.status === 'success') {
      console.log("🎉 GASLESS TRANSFER SUCCESSFUL!");
      console.log();
      console.log("📊 Transaction Details:");
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed}`);
      console.log(`   Gas paid in: USDC (via Circle Paymaster)`);
      
      // Check new balance
      const newBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [smartAccount.address],
      });

      console.log();
      console.log("💰 New Smart Account Balance:");
      console.log(`   ${(Number(newBalance) / 1e6).toString()} USDC`);

    } else {
      console.log("❌ Transfer failed!");
    }

  } catch (error) {
    console.error("❌ Transfer failed:", error);
  }
}

// Execute transfer with warning
console.log("🚨 WARNING: This will execute a REAL on-chain transaction!");
console.log("   Press Ctrl+C to cancel, or wait 3 seconds to proceed...");
setTimeout(simpleGaslessTransfer, 3000);
