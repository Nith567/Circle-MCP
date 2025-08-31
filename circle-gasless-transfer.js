import "dotenv/config";
import { createPublicClient, http, getContract, erc20Abi, encodePacked, hexToBigInt } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { toCircleSmartAccount } from "@circle-fin/modular-wallets-core";
import { createBundlerClient } from "viem/account-abstraction";
import { signPermit } from "./permit.js";

// Configuration
const chain = arbitrumSepolia;
const usdcAddress = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const paymasterAddress = "0x31BE08D380A21fc740883c0BC434FcFc88740b58";
const recipientAddress = "0x8879318091671ba1274e751f8cDEF76bb37eb3eD";
const ownerPrivateKey = process.env.PRIVATE_KEY;

async function circleGaslessTransfer() {
  console.log("🔥 CIRCLE GASLESS USDC TRANSFER");
  console.log("=".repeat(50));

  try {
    // 1. Setup client and account
    const client = createPublicClient({ chain, transport: http() });
    const owner = privateKeyToAccount(ownerPrivateKey);
    const account = await toCircleSmartAccount({ client, owner });

    console.log("📍 Setup:");
    console.log(`   Owner: ${owner.address}`);
    console.log(`   Smart Account: ${account.address}`);
    console.log(`   Chain: ${chain.name}`);
    console.log();

    // 2. Check USDC balance
    const usdc = getContract({ client, address: usdcAddress, abi: erc20Abi });
    const usdcBalance = await usdc.read.balanceOf([account.address]);

    console.log("💰 USDC Balance Check:");
    console.log(`   Balance: ${(Number(usdcBalance) / 1e6).toString()} USDC`);

    if (usdcBalance < 340000n) { // 0.34 USDC
      console.log(`   ❌ Insufficient balance! Need 0.34 USDC`);
      console.log(`   💡 Fund ${account.address} at: https://faucet.circle.com`);
      return;
    }
    console.log(`   ✅ Sufficient balance for transfer`);
    console.log();

    // 3. Setup Paymaster
    console.log("🔧 Setting up Circle Paymaster...");
    const paymaster = {
      async getPaymasterData(parameters) {
        const permitAmount = 10000000n; // 10 USDC allowance
        
        console.log("   🎫 Signing EIP-2612 permit...");
        const permitSignature = await signPermit({
          tokenAddress: usdcAddress,
          account,
          client,
          spenderAddress: paymasterAddress,
          permitAmount: permitAmount,
        });

        const paymasterData = encodePacked(
          ["uint8", "address", "uint256", "bytes"],
          [0, usdcAddress, permitAmount, permitSignature],
        );

        console.log("   ✅ Paymaster data prepared");
        return {
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: 200000n,
          paymasterPostOpGasLimit: 15000n,
          isFinal: true,
        };
      },
    };

    // 4. Setup Bundler Client
    console.log("🌐 Connecting to Pimlico bundler...");
    const bundlerClient = createBundlerClient({
      account,
      client,
      paymaster,
      userOperation: {
        estimateFeesPerGas: async ({ account, bundlerClient, userOperation }) => {
          const { standard: fees } = await bundlerClient.request({
            method: "pimlico_getUserOperationGasPrice",
          });
          const maxFeePerGas = hexToBigInt(fees.maxFeePerGas);
          const maxPriorityFeePerGas = hexToBigInt(fees.maxPriorityFeePerGas);
          return { maxFeePerGas, maxPriorityFeePerGas };
        },
      },
      transport: http(`https://public.pimlico.io/v2/${client.chain.id}/rpc`),
    });

    console.log("   ✅ Bundler client connected");
    console.log();

    // 5. Submit User Operation
    console.log("🚀 Submitting gasless USDC transfer...");
    console.log(`   To: ${recipientAddress}`);
    console.log(`   Amount: 0.34 USDC`);
    console.log(`   Gas: Paid in USDC via Circle Paymaster`);
    console.log();

    const hash = await bundlerClient.sendUserOperation({
      account,
      calls: [
        {
          to: usdc.address,
          abi: usdc.abi,
          functionName: "transfer",
          args: [recipientAddress, 340000n], // 0.34 USDC
        },
      ],
    });

    console.log("✅ USER OPERATION SUBMITTED!");
    console.log(`   UserOperation Hash: ${hash}`);
    console.log();

    // 6. Wait for receipt
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
    
    console.log("🎉 GASLESS TRANSFER COMPLETED!");
    console.log(`   Transaction Hash: ${receipt.receipt.transactionHash}`);
    console.log(`   🔍 Explorer: https://sepolia.arbiscan.io/tx/${receipt.receipt.transactionHash}`);
    console.log(`   Block: ${receipt.receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.receipt.gasUsed}`);
    console.log();

    // 7. Check new balance
    const newBalance = await usdc.read.balanceOf([account.address]);
    console.log("📊 Final Results:");
    console.log(`   ✅ Transferred: 0.34 USDC`);
    console.log(`   ✅ Recipient: ${recipientAddress}`);
    console.log(`   ✅ New Balance: ${(Number(newBalance) / 1e6).toString()} USDC`);
    console.log(`   ✅ Gas Payment: USDC (no ETH required!)`);
    console.log(`   ✅ Gasless Experience: SUCCESS`);

  } catch (error) {
    console.error("❌ Transfer failed:", error);
  }

  // Exit cleanly
  process.exit();
}

// Execute with warning
console.log("🚨 WARNING: This will execute a REAL on-chain transaction!");
console.log("   Press Ctrl+C to cancel, or wait 3 seconds to proceed...");
setTimeout(circleGaslessTransfer, 3000);
