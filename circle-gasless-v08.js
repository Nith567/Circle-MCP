import "dotenv/config";
import { createPublicClient, http, getContract, erc20Abi, encodePacked, hexToBigInt } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient, toSimple7702SmartAccount } from "viem/account-abstraction";
import { signPermit } from "./src/services/circle-paymaster-v08.js";

// Configuration for Circle Paymaster v0.8
const chain = arbitrumSepolia;
const usdcAddress = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const paymasterAddress = "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966";
const recipientAddress = "0x8879318091671ba1274e751f8cDEF76bb37eb3eD";
const ownerPrivateKey = process.env.PRIVATE_KEY;

async function circleGaslessTransferV08() {
  console.log("🔥 CIRCLE GASLESS USDC TRANSFER v0.8 (EIP-7702)");
  console.log("=".repeat(55));

  try {
    // 1. Setup client and account
    const client = createPublicClient({ chain, transport: http() });
    const owner = privateKeyToAccount(ownerPrivateKey);
    const account = await toSimple7702SmartAccount({ client, owner });

    console.log("📍 Setup:");
    console.log(`   Owner (EOA): ${owner.address}`);
    console.log(`   Smart Account (7702): ${account.address}`);
    console.log(`   Chain: ${chain.name}`);
    console.log(`   Paymaster Version: v0.8`);
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

    // 3. Setup Paymaster v0.8
    console.log("🔧 Setting up Circle Paymaster v0.8...");
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
          try {
            const fees = await bundlerClient.request({
              method: "pimlico_getUserOperationGasPrice",
            });
            const maxFeePerGas = hexToBigInt(fees.standard?.maxFeePerGas || "0x3b9aca00");
            const maxPriorityFeePerGas = hexToBigInt(fees.standard?.maxPriorityFeePerGas || "0x3b9aca00");
            return { maxFeePerGas, maxPriorityFeePerGas };
          } catch (error) {
            return { 
              maxFeePerGas: 1000000000n, // 1 gwei fallback
              maxPriorityFeePerGas: 1000000000n 
            };
          }
        },
      },
      transport: http(`https://public.pimlico.io/v2/${client.chain.id}/rpc`),
    });

    console.log("   ✅ Bundler client connected");
    console.log();

    // 5. Sign authorization for 7702 account
    console.log("🔐 Signing EIP-7702 authorization...");
    const authorization = await owner.signAuthorization({
      chainId: chain.id,
      nonce: await client.getTransactionCount({ address: owner.address }),
      contractAddress: account.authorization.address,
    });
    console.log("   ✅ Authorization signed");
    console.log();

    // 6. Submit User Operation
    console.log("🚀 Submitting gasless USDC transfer...");
    console.log(`   To: ${recipientAddress}`);
    console.log(`   Amount: 0.34 USDC`);
    console.log(`   Gas: Paid in USDC via Circle Paymaster v0.8`);
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
      authorization,
    });

    console.log("✅ USER OPERATION SUBMITTED!");
    console.log(`   UserOperation Hash: ${hash}`);
    console.log();

    // 7. Wait for receipt
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
    
    console.log("🎉 GASLESS TRANSFER COMPLETED!");
    console.log(`   Transaction Hash: ${receipt.receipt.transactionHash}`);
    console.log(`   🔍 Explorer: https://sepolia.arbiscan.io/tx/${receipt.receipt.transactionHash}`);
    console.log(`   Block: ${receipt.receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.receipt.gasUsed}`);
    console.log();

    // 8. Check new balance
    const newBalance = await usdc.read.balanceOf([account.address]);
    console.log("📊 Final Results:");
    console.log(`   ✅ Transferred: 0.34 USDC`);
    console.log(`   ✅ Recipient: ${recipientAddress}`);
    console.log(`   ✅ New Balance: ${(Number(newBalance) / 1e6).toString()} USDC`);
    console.log(`   ✅ Gas Payment: USDC (no ETH required!)`);
    console.log(`   ✅ Account Type: EIP-7702 Smart Account`);
    console.log(`   ✅ Paymaster Version: v0.8`);

  } catch (error) {
    console.error("❌ Transfer failed:", error);
  }

  // Exit cleanly
  process.exit();
}

// Execute with warning
console.log("🚨 WARNING: This will execute a REAL on-chain transaction!");
console.log("   Using Circle Paymaster v0.8 with EIP-7702 Smart Account");
console.log("   Press Ctrl+C to cancel, or wait 3 seconds to proceed...");
setTimeout(circleGaslessTransferV08, 3000);
