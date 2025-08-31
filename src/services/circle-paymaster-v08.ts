import {
  createPublicClient,
  http,
  getContract,
  encodePacked,
  maxUint256,
  erc20Abi,
  parseErc6492Signature,
  hexToBigInt,
  type Address,
  type Hex,
} from 'viem';
import { arbitrumSepolia, baseSepolia, sepolia, avalancheFuji, optimismSepolia, polygonMumbai } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createBundlerClient, toSimple7702SmartAccount } from 'viem/account-abstraction';
import { config } from '../core/config.js';
import { getChain, getRpcUrl } from '../core/chains.js';

// EIP-2612 Permit ABI extension
export const eip2612Abi = [
  ...erc20Abi,
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
    name: "nonces",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
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

// Circle Paymaster v0.8 configuration (default)
export const CIRCLE_PAYMASTER_V08_CONFIG = {
  [421614]: { // Arbitrum Sepolia
    paymasterAddress: "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966",
    bundlerUrl: "https://public.pimlico.io/v2/421614/rpc",
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    version: "v0.8",
    accountType: "7702",
  },
  [84532]: { // Base Sepolia
    paymasterAddress: "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966",
    bundlerUrl: "https://public.pimlico.io/v2/84532/rpc",
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    version: "v0.8",
    accountType: "7702",
  },
  [11155111]: { // Ethereum Sepolia
    paymasterAddress: "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966",
    bundlerUrl: "https://public.pimlico.io/v2/11155111/rpc",
    usdcAddress: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
    version: "v0.8",
    accountType: "7702",
  },
  [43113]: { // Avalanche Fuji
    paymasterAddress: "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966",
    bundlerUrl: "https://public.pimlico.io/v2/43113/rpc",
    usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65",
    version: "v0.8",
    accountType: "7702",
  },
  [11155420]: { // Optimism Sepolia
    paymasterAddress: "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966",
    bundlerUrl: "https://public.pimlico.io/v2/11155420/rpc",
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    version: "v0.8",
    accountType: "7702",
  },
  [80002]: { // Polygon Amoy
    paymasterAddress: "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966",
    bundlerUrl: "https://public.pimlico.io/v2/80002/rpc",
    usdcAddress: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
    version: "v0.8",
    accountType: "7702",
  },
  [1301]: { // Unichain Sepolia
    paymasterAddress: "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966",
    bundlerUrl: "https://public.pimlico.io/v2/1301/rpc",
    usdcAddress: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238", // Placeholder
    version: "v0.8",
    accountType: "7702",
  },
} as const;

// Circle Paymaster v0.7 configuration (legacy)
export const CIRCLE_PAYMASTER_V07_CONFIG = {
  [421614]: { // Arbitrum Sepolia only
    paymasterAddress: "0x31BE08D380A21fc740883c0BC434FcFc88740b58",
    bundlerUrl: "https://public.pimlico.io/v2/421614/rpc",
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    version: "v0.7",
    accountType: "circle",
  },
} as const;

// Permit functions
export async function eip2612Permit({
  token,
  chain,
  ownerAddress,
  spenderAddress,
  value,
}: {
  token: any;
  chain: any;
  ownerAddress: Address;
  spenderAddress: Address;
  value: bigint;
}) {
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
    primaryType: "Permit",
    domain: {
      name: await token.read.name(),
      version: await token.read.version(),
      chainId: chain.id,
      verifyingContract: token.address,
    },
    message: {
      owner: ownerAddress,
      spender: spenderAddress,
      value: value.toString(),
      nonce: (await token.read.nonces([ownerAddress])).toString(),
      deadline: maxUint256.toString(),
    },
  };
}

export async function signPermit({
  tokenAddress,
  client,
  account,
  spenderAddress,
  permitAmount,
}: {
  tokenAddress: Address;
  client: any;
  account: any;
  spenderAddress: Address;
  permitAmount: bigint;
}) {
  const token = getContract({
    client,
    address: tokenAddress,
    abi: eip2612Abi,
  });
  
  const permitData = await eip2612Permit({
    token,
    chain: client.chain,
    ownerAddress: account.address,
    spenderAddress,
    value: permitAmount,
  });

  const wrappedPermitSignature = await account.signTypedData(permitData);

  const isValid = await client.verifyTypedData({
    ...permitData,
    address: account.address,
    signature: wrappedPermitSignature,
  });

  if (!isValid) {
    throw new Error(
      `Invalid permit signature for ${account.address}: ${wrappedPermitSignature}`,
    );
  }

  const { signature } = parseErc6492Signature(wrappedPermitSignature);
  return signature;
}

export interface PaymasterTransferParams {
  chainId: number;
  recipientAddress: Address;
  amount: string;
  version?: "v0.7" | "v0.8"; // Default to v0.8
}

export class CirclePaymasterV08Service {
  private account: any;
  private privateKey: string;

  constructor(privateKey?: string) {
    this.privateKey = privateKey || config.privateKey || '';
    this.account = privateKeyToAccount(this.privateKey as Hex);
  }

  /**
   * Get supported chains for the specified version
   */
  getSupportedChains(version: "v0.7" | "v0.8" = "v0.8") {
    const config = version === "v0.8" ? CIRCLE_PAYMASTER_V08_CONFIG : CIRCLE_PAYMASTER_V07_CONFIG;
    return Object.keys(config).map(Number);
  }

  /**
   * Get config for a specific chain and version
   */
  private getConfig(chainId: number, version: "v0.7" | "v0.8" = "v0.8") {
    const configMap = version === "v0.8" ? CIRCLE_PAYMASTER_V08_CONFIG : CIRCLE_PAYMASTER_V07_CONFIG;
    const config = (configMap as any)[chainId];
    
    if (!config) {
      const supportedChains = this.getSupportedChains(version);
      throw new Error(`Chain ${chainId} not supported for Circle Paymaster ${version}. Supported chains: ${supportedChains.join(', ')}`);
    }
    
    return config;
  }

  /**
   * Get Smart Account address (7702 or Circle Smart Account based on version)
   */
  async getAccountAddress(chainId: number, version: "v0.7" | "v0.8" = "v0.8"): Promise<Address> {
    try {
      const config = this.getConfig(chainId, version);
      const chain = getChain(chainId);
      const client = createPublicClient({
        chain,
        transport: http(getRpcUrl(chainId)),
      });

      if (version === "v0.8") {
        // EIP-7702 Smart Account
        const account = await toSimple7702SmartAccount({ 
          client, 
          owner: this.account 
        });
        return account.address;
      } else {
        // Circle Smart Account (v0.7)
        const { toCircleSmartAccount } = await import('@circle-fin/modular-wallets-core');
        const smartAccount = await toCircleSmartAccount({ 
          client, 
          owner: this.account 
        });
        return smartAccount.address;
      }
    } catch (error) {
      console.warn(`Failed to get smart account for ${version}, falling back to EOA:`, error);
      return this.account.address;
    }
  }

  /**
   * Check USDC balance
   */
  async checkUSDCBalance(chainId: number, accountAddress?: Address, version: "v0.7" | "v0.8" = "v0.8"): Promise<string> {
    try {
      const config = this.getConfig(chainId, version);
      const chain = getChain(chainId);
      const client = createPublicClient({
        chain,
        transport: http(getRpcUrl(chainId)),
      });

      const targetAddress = accountAddress || await this.getAccountAddress(chainId, version);

      const usdc = getContract({
        client,
        address: config.usdcAddress as Address,
        abi: erc20Abi,
      });

      const balance = await usdc.read.balanceOf([targetAddress]);
      return (Number(balance) / 1e6).toString();
    } catch (error) {
      throw new Error(`Failed to check USDC balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute gasless transfer using Circle Paymaster v0.8 (default) or v0.7
   */
  async executeGaslessTransfer(params: PaymasterTransferParams) {
    const { chainId, recipientAddress, amount, version = "v0.8" } = params;
    
    try {
      if (version === "v0.7") {
        return await this.executeV07Transfer(params);
      } else {
        return await this.executeV08Transfer(params);
      }
    } catch (error) {
      return {
        success: false,
        message: `Gasless transfer failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute transfer using Circle Paymaster v0.8 (EIP-7702)
   */
  private async executeV08Transfer(params: PaymasterTransferParams) {
    const { chainId, recipientAddress, amount } = params;
    const config = this.getConfig(chainId, "v0.8");
    
    // Create clients
    const chain = getChain(chainId);
    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(chainId)),
    });

    // Create 7702 Smart Account
    const account = await toSimple7702SmartAccount({ 
      client, 
      owner: this.account 
    });

    // Get USDC contract
    const usdc = getContract({
      client,
      address: config.usdcAddress as Address,
      abi: erc20Abi,
    });

    // Create paymaster
    const paymaster = {
      async getPaymasterData(parameters: any) {
        const permitAmount = 10000000n; // 10 USDC
        const permitSignature = await signPermit({
          tokenAddress: config.usdcAddress as Address,
          account,
          client,
          spenderAddress: config.paymasterAddress as Address,
          permitAmount,
        });

        const paymasterData = encodePacked(
          ["uint8", "address", "uint256", "bytes"],
          [0, config.usdcAddress as Address, permitAmount, permitSignature],
        );

        return {
          paymaster: config.paymasterAddress as Address,
          paymasterData,
          paymasterVerificationGasLimit: 200000n,
          paymasterPostOpGasLimit: 15000n,
          isFinal: true,
        };
      },
    };

    // Create bundler client
    const bundlerClient = createBundlerClient({
      account,
      client,
      paymaster,
      userOperation: {
        estimateFeesPerGas: async ({ account, bundlerClient, userOperation }) => {
          try {
            const fees = await bundlerClient.request({
              method: "pimlico_getUserOperationGasPrice" as any,
            }) as any;
            const maxFeePerGas = hexToBigInt(fees.standard?.maxFeePerGas || "0x3b9aca00");
            const maxPriorityFeePerGas = hexToBigInt(fees.standard?.maxPriorityFeePerGas || "0x3b9aca00");
            return { maxFeePerGas, maxPriorityFeePerGas };
          } catch (error) {
            // Fallback gas prices
            return { 
              maxFeePerGas: 1000000000n, // 1 gwei
              maxPriorityFeePerGas: 1000000000n // 1 gwei
            };
          }
        },
      },
      transport: http(config.bundlerUrl),
    });

    // Sign authorization for 7702 account
    const authorization = await this.account.signAuthorization({
      chainId: chain.id,
      nonce: await client.getTransactionCount({ address: this.account.address }),
      contractAddress: account.authorization.address,
    });

    // Submit user operation
    const usdcAmount = BigInt(Math.floor(parseFloat(amount) * 1e6));
    const hash = await bundlerClient.sendUserOperation({
      account,
      calls: [
        {
          to: usdc.address,
          abi: usdc.abi,
          functionName: "transfer",
          args: [recipientAddress, usdcAmount],
        },
      ],
      authorization,
    });

    // Wait for receipt
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });

    return {
      success: true,
      userOperationHash: hash,
      transactionHash: receipt.receipt.transactionHash,
      message: `Successfully transferred ${amount} USDC using Circle Paymaster v0.8`,
      version: "v0.8",
      accountType: "7702"
    };
  }

  /**
   * Execute transfer using Circle Paymaster v0.7 (Circle Smart Account)
   */
  private async executeV07Transfer(params: PaymasterTransferParams) {
    // This would use the existing Circle Smart Account implementation
    // For now, return a message directing users to use v0.8
    return {
      success: false,
      message: "Circle Paymaster v0.7 is deprecated. Please use v0.8 (default) which supports more chains and EIP-7702 smart accounts.",
      recommendation: "Use version v0.8 for better performance and multi-chain support"
    };
  }
}

// Factory function
export function createCirclePaymasterV08Service(privateKey?: string): CirclePaymasterV08Service {
  return new CirclePaymasterV08Service(privateKey);
}
