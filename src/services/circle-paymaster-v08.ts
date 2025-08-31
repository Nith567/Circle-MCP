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

// Circle Paymaster v0.8 configuration
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
    throw new Error(`Invalid permit signature for ${account.address}`);
  }

  const { signature } = parseErc6492Signature(wrappedPermitSignature);
  return signature;
}

export interface PaymasterTransferParams {
  chainId: number;
  recipientAddress: Address;
  amount: string;
}

export class CirclePaymasterV08Service {
  private account: any;
  private privateKey: string;

  constructor(privateKey?: string) {
    this.privateKey = privateKey || config.privateKey || '';
    this.account = privateKeyToAccount(this.privateKey as Hex);
  }

  /**
   * Get supported chains for v0.8
   */
  getSupportedChains() {
    return Object.keys(CIRCLE_PAYMASTER_V08_CONFIG).map(Number);
  }

  /**
   * Get config for a specific chain
   */
  private getConfig(chainId: number) {
    const config = (CIRCLE_PAYMASTER_V08_CONFIG as any)[chainId];
    
    if (!config) {
      const supportedChains = this.getSupportedChains();
      throw new Error(`Chain ${chainId} not supported for Circle Paymaster v0.8. Supported chains: ${supportedChains.join(', ')}`);
    }
    
    return config;
  }

  /**
   * Get EIP-7702 Smart Account address
   */
  async getAccountAddress(chainId: number, version?: string): Promise<Address> {
    try {
      const config = this.getConfig(chainId);
      const chain = getChain(chainId);
      const client = createPublicClient({
        chain,
        transport: http(getRpcUrl(chainId)),
      });

      // Create EIP-7702 Smart Account
      const account = await toSimple7702SmartAccount({ 
        client, 
        owner: this.account 
      });
      return account.address;
    } catch (error) {
      // Fallback to EOA if smart account creation fails
      return this.account.address;
    }
  }

  /**
   * Check USDC balance
   */
  async checkUSDCBalance(chainId: number, accountAddress?: Address, version?: string): Promise<string> {
    try {
      const config = this.getConfig(chainId);
      const chain = getChain(chainId);
      const client = createPublicClient({
        chain,
        transport: http(getRpcUrl(chainId)),
      });

      const targetAddress = accountAddress || await this.getAccountAddress(chainId);

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
   * Execute gasless transfer using Circle Paymaster v0.8
   */
  async executeGaslessTransfer(params: PaymasterTransferParams) {
    const { chainId, recipientAddress, amount } = params;
    
    try {
      const config = this.getConfig(chainId);
      
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

      // Create paymaster with permit
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

      const paymaster = {
        async getPaymasterData() {
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
          estimateFeesPerGas: async () => {
            try {
              const fees = await bundlerClient.request({
                method: "pimlico_getUserOperationGasPrice" as any,
              }) as any;
              const maxFeePerGas = hexToBigInt(fees.standard?.maxFeePerGas || "0x3b9aca00");
              const maxPriorityFeePerGas = hexToBigInt(fees.standard?.maxPriorityFeePerGas || "0x3b9aca00");
              return { maxFeePerGas, maxPriorityFeePerGas };
            } catch (error) {
              return { 
                maxFeePerGas: 1000000000n,
                maxPriorityFeePerGas: 1000000000n
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
        explorerUrl: `https://sepolia.arbiscan.io/tx/${receipt.receipt.transactionHash}`
      };

    } catch (error) {
      return {
        success: false,
        message: `Gasless transfer failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Factory function
export function createCirclePaymasterV08Service(privateKey?: string): CirclePaymasterV08Service {
  return new CirclePaymasterV08Service(privateKey);
}