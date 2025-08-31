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

// USDC contract on Arbitrum Sepolia
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address;
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

async function fundSmartAccount() {
  console.log("💰 Funding Smart Account with USDC");
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

    // Get smart account address
    const smartAccount = await toCircleSmartAccount({ client: publicClient, owner: account });
    
    console.log("📍 Addresses:");
    console.log(`   EOA (Your Wallet): ${account.address}`);
    console.log(`   Smart Account: ${smartAccount.address}`);
    console.log();

    // Check current balances
    console.log("💰 Current USDC Balances:");
    
    const eoaBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });

    const smartAccountBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [smartAccount.address],
    });

    console.log(`   EOA: ${(Number(eoaBalance) / 1e6).toString()} USDC`);
    console.log(`   Smart Account: ${(Number(smartAccountBalance) / 1e6).toString()} USDC`);
    console.log();

    if (Number(eoaBalance) === 0) {
      console.log("❌ No USDC in EOA! Fund your EOA first:");
      console.log(`   🏦 https://faucet.circle.com`);
      console.log(`   📋 Address: ${account.address}`);
      return;
    }

    // Transfer 5 USDC to smart account
    const transferAmount = parseUnits("5", 6); // 5 USDC
    
    console.log("📤 Transferring 5 USDC from EOA to Smart Account...");
    
    const txHash = await walletClient.sendTransaction({
      to: USDC_ADDRESS,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [smartAccount.address, transferAmount],
      }),
    });

    console.log(`   Transaction Hash: ${txHash}`);
    console.log(`   🔍 Explorer: https://sepolia.arbiscan.io/tx/${txHash}`);
    console.log();

    // Wait for confirmation
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 1 
    });

    if (receipt.status === 'success') {
      console.log("✅ Transfer successful!");
      
      // Check new balances
      const newSmartAccountBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [smartAccount.address],
      });

      console.log();
      console.log("💰 New Smart Account Balance:");
      console.log(`   ${(Number(newSmartAccountBalance) / 1e6).toString()} USDC`);
      console.log();
      console.log("🎯 Next Steps:");
      console.log("1. Run the real gasless transfer script again");
      console.log("2. The smart account now has USDC for the transfer!");
      console.log("3. Gas will be paid in USDC via Circle Paymaster");

    } else {
      console.log("❌ Transfer failed!");
    }

  } catch (error) {
    console.error("❌ Funding failed:", error);
  }
}

// Execute funding
fundSmartAccount();
