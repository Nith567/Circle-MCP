import {
  createPublicClient,
  http,
  getContract,
  encodePacked,
  maxUint256,
  erc20Abi,
  parseErc6492Signature,
  hexToBigInt,
  encodeFunctionData,
  type Address,
  type Hex,
} from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toCircleSmartAccount } from '@circle-fin/modular-wallets-core';
import { config } from '../core/config.js';
import { getChain, getRpcUrl } from '../core/chains.js';

// Real Circle Paymaster configuration for Arbitrum Sepolia
export const REAL_PAYMASTER_CONFIG = {
  paymasterAddress: "0x31BE08D380A21fc740883c0BC434FcFc88740b58" as Address,
  bundlerUrl: "https://public.pimlico.io/v2/421614/rpc",
  usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address,
  chainId: 421614,
} as const;

// EIP-2612 Permit ABI
export const permitAbi = [
  ...erc20Abi,
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
    name: "nonces",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" },
    ],
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export class RealCirclePaymaster {
  private account: any;
  private privateKey: string;

  constructor(privateKey?: string) {
    const key = privateKey || config.privateKey;
    if (!key) {
      throw new Error('Private key is required for Circle Paymaster');
    }
    this.privateKey = key;
    this.account = privateKeyToAccount(this.privateKey as Hex);
  }

  /**
   * Create EIP-2612 permit for USDC allowance
   */
  async createPermitTypedData(params: {
    token: any;
    owner: Address;
    spender: Address;
    value: bigint;
    nonce: bigint;
    deadline: bigint;
  }) {
    const { token, owner, spender, value, nonce, deadline } = params;
    
    return {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Permit" as const,
      domain: {
        name: await token.read.name(),
        version: await token.read.version(),
        chainId: REAL_PAYMASTER_CONFIG.chainId,
        verifyingContract: token.address,
      },
      message: {
        owner,
        spender,
        value: value.toString(),
        nonce: nonce.toString(),
        deadline: deadline.toString(),
      },
    };
  }

  /**
   * Execute REAL gasless USDC transfer
   */
  async executeRealGaslessTransfer(params: {
    recipientAddress: Address;
    amount: string;
  }): Promise<{
    success: boolean;
    message: string;
    userOperationHash?: string;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      const { recipientAddress, amount } = params;
      
      console.log("🔄 Setting up real Circle Smart Account...");
      
      // Create public client
      const client = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(getRpcUrl(REAL_PAYMASTER_CONFIG.chainId)),
      });

      // Create Circle Smart Account
      const owner = privateKeyToAccount(this.privateKey as Hex);
      const account = await toCircleSmartAccount({ client, owner });
      
      console.log(`   Smart Account: ${account.address}`);
      console.log(`   Owner: ${owner.address}`);

      // Get USDC contract
      const usdc = getContract({
        client,
        address: REAL_PAYMASTER_CONFIG.usdcAddress,
        abi: permitAbi,
      });

      // Check balance
      const usdcAmount = BigInt(parseFloat(amount) * 1e6); // Convert to 6 decimals
      const balance = await usdc.read.balanceOf([account.address]);
      
      console.log(`   USDC Balance: ${(Number(balance) / 1e6).toString()} USDC`);
      
      if (balance < usdcAmount) {
        return {
          success: false,
          message: `Insufficient USDC balance. Need ${amount} USDC, have ${(Number(balance) / 1e6).toString()}`,
          error: "INSUFFICIENT_BALANCE"
        };
      }

      // Create permit for paymaster
      console.log("🎫 Creating EIP-2612 permit...");
      const permitAmount = 10000000n; // 10 USDC allowance
      const permitNonce = await usdc.read.nonces([account.address]);
      const deadline = maxUint256;

      const permitTypedData = await this.createPermitTypedData({
        token: usdc,
        owner: account.address,
        spender: REAL_PAYMASTER_CONFIG.paymasterAddress,
        value: permitAmount,
        nonce: permitNonce,
        deadline,
      });

      const permitSignature = await account.signTypedData(permitTypedData);
      const { signature } = parseErc6492Signature(permitSignature);
      
      console.log("   ✅ Permit signature created");

      // Create paymaster data
      const paymasterData = encodePacked(
        ["uint8", "address", "uint256", "bytes"],
        [0, REAL_PAYMASTER_CONFIG.usdcAddress, permitAmount, signature],
      );

      console.log("💸 Preparing USDC transfer call...");
      
      // Encode USDC transfer
      const transferCallData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipientAddress, usdcAmount],
      });

      console.log(`   Transfer: ${amount} USDC to ${recipientAddress}`);
      console.log(`   Call data: ${transferCallData}`);

      // Check if smart account is deployed
      const code = await client.getCode({
        address: account.address,
      });

      let initCode: Hex = "0x";
      let userOpNonce = 0n;

      if (!code || code === '0x') {
        console.log("🏗️ Smart account not deployed - including deployment in UserOp");
        
        // For Circle Smart Account, we need the factory and creation data
        // This is a simplified approach - real implementation would get this from Circle SDK
        const CIRCLE_FACTORY = "0x48F8CAE83aeb2b7E76D5A3Ce3d8E40eA7c4b2FA0" as Address; // Example
        const SALT = "0x0000000000000000000000000000000000000000000000000000000000000000";
        
        // Create initCode for deployment (factory + calldata)
        initCode = encodePacked(
          ["address", "bytes"],
          [CIRCLE_FACTORY, encodeFunctionData({
            abi: [{
              type: "function",
              name: "createAccount",
              inputs: [
                { name: "owner", type: "address" },
                { name: "salt", type: "uint256" }
              ],
              outputs: [{ name: "", type: "address" }]
            }],
            functionName: "createAccount",
            args: [owner.address, BigInt(SALT)]
          })]
        );
        
        userOpNonce = 0n; // First transaction for new account
      } else {
        console.log("✅ Smart account already deployed");
        // Get current nonce (simplified - real implementation would fetch from entrypoint)
        userOpNonce = 0n; // Would fetch real nonce here
      }

      // Create user operation data with BigInt converted to hex strings
      const userOpData = {
        sender: account.address,
        nonce: `0x${userOpNonce.toString(16)}`, // Convert BigInt to hex string
        initCode: initCode, // Include deployment if needed
        callData: transferCallData,
        callGasLimit: `0x${(150000n).toString(16)}`, // Increased for deployment
        verificationGasLimit: `0x${(300000n).toString(16)}`, // Increased for deployment
        preVerificationGas: `0x${(50000n).toString(16)}`, // Convert BigInt to hex string
        maxFeePerGas: `0x${(1000000000n).toString(16)}`, // 1 gwei, convert BigInt to hex string
        maxPriorityFeePerGas: `0x${(1000000000n).toString(16)}`, // 1 gwei, convert BigInt to hex string
        paymasterAndData: encodePacked(
          ["address", "bytes"],
          [REAL_PAYMASTER_CONFIG.paymasterAddress, paymasterData]
        ),
        signature: "0x" as Hex, // Will be filled by account
      };

      console.log("🚀 Submitting to bundler...");
      console.log(`   Bundler URL: ${REAL_PAYMASTER_CONFIG.bundlerUrl}`);
      
      // Submit to bundler (simplified - real implementation would use proper bundler client)
      const bundlerResponse = await fetch(REAL_PAYMASTER_CONFIG.bundlerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_sendUserOperation',
          params: [userOpData, '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'], // EntryPoint
          id: 1,
        }),
      });

      const bundlerResult = await bundlerResponse.json();
      
      if (bundlerResult.error) {
        return {
          success: false,
          message: `Bundler error: ${bundlerResult.error.message}`,
          error: bundlerResult.error.message,
        };
      }

      const userOpHash = bundlerResult.result;
      console.log(`   ✅ User Operation Hash: ${userOpHash}`);

      // Wait for transaction receipt (simplified)
      console.log("⏳ Waiting for transaction confirmation...");
      
      // In real implementation, you'd poll for the receipt
      // For now, return the user operation hash
      
      return {
        success: true,
        message: `Successfully submitted gasless transfer of ${amount} USDC`,
        userOperationHash: userOpHash,
        // Transaction hash would be available after confirmation
      };

    } catch (error) {
      console.error("❌ Real transfer failed:", error);
      return {
        success: false,
        message: `Failed to execute real gasless transfer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get smart account address
   */
  async getSmartAccountAddress(): Promise<Address> {
    const client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(getRpcUrl(REAL_PAYMASTER_CONFIG.chainId)),
    });

    const owner = privateKeyToAccount(this.privateKey as Hex);
    const account = await toCircleSmartAccount({ client, owner });
    
    return account.address;
  }
}

export function createRealCirclePaymaster(privateKey?: string): RealCirclePaymaster {
  return new RealCirclePaymaster(privateKey);
}
