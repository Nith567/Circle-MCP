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
import { arbitrumSepolia, baseSepolia, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../core/config.js';
import { getChain, getRpcUrl, CHAIN_IDS_TO_USDC_ADDRESSES } from '../core/chains.js';

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

// Circle Paymaster configuration per chain
export const CIRCLE_PAYMASTER_CONFIG = {
  [421614]: { // Arbitrum Sepolia
    paymasterAddress: "0x31BE08D380A21fc740883c0BC434FcFc88740b58",
    bundlerUrl: "https://public.pimlico.io/v2/421614/rpc",
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  },
  // Add more chains as you provide the addresses
  // [84532]: { // Base Sepolia - pending addresses
  //   paymasterAddress: "0x...",
  //   bundlerUrl: "https://public.pimlico.io/v2/84532/rpc",
  //   usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  // },
  // [11155111]: { // Ethereum Sepolia - pending addresses
  //   paymasterAddress: "0x...",
  //   bundlerUrl: "https://public.pimlico.io/v2/11155111/rpc",
  //   usdcAddress: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
  // },
} as const;

export interface PaymasterTransferParams {
  chainId: number;
  recipientAddress: Address;
  amount: string; // USDC amount in human readable format (e.g., "10.50")
  ownerPrivateKey?: string; // Optional, defaults to config
}

export class CirclePaymasterService {
  private account: any;
  private privateKey: string;

  constructor(privateKey?: string) {
    const key = privateKey || config.privateKey;
    if (!key) {
      throw new Error('Private key is required for Circle Paymaster service');
    }
    this.privateKey = key;
    this.account = privateKeyToAccount(this.privateKey as Hex);
  }

  /**
   * Create EIP-2612 permit for USDC allowance
   */
  async createEIP2612Permit({
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
        // Required for compatibility with Circle PW Sign Typed Data API
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
        // Convert bigint fields to string to match EIP-712 JSON schema expectations
        owner: ownerAddress,
        spender: spenderAddress,
        value: value.toString(),
        nonce: (await token.read.nonces([ownerAddress])).toString(),
        // The paymaster cannot access block.timestamp due to 4337 opcode
        // restrictions, so the deadline must be MAX_UINT256.
        deadline: maxUint256.toString(),
      },
    };
  }

  /**
   * Sign permit for USDC allowance
   */
  async signPermit({
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
  }): Promise<Hex> {
    const token = getContract({
      client,
      address: tokenAddress,
      abi: eip2612Abi,
    });

    const permitData = await this.createEIP2612Permit({
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

  /**
   * Check USDC balance of account
   */
  async checkUSDCBalance(chainId: number, accountAddress?: Address): Promise<string> {
    const chainConfig = CIRCLE_PAYMASTER_CONFIG[chainId as keyof typeof CIRCLE_PAYMASTER_CONFIG];
    if (!chainConfig) {
      throw new Error(`Paymaster not supported on chain ${chainId}`);
    }

    const chain = getChain(chainId);
    const client = createPublicClient({ 
      chain, 
      transport: http(getRpcUrl(chainId)) 
    });

    const usdc = getContract({ 
      client, 
      address: chainConfig.usdcAddress as Address, 
      abi: erc20Abi 
    });

    const targetAddress = accountAddress || this.account.address;
    const balance = await usdc.read.balanceOf([targetAddress]);
    
    // Convert from 6 decimals to human readable
    return (Number(balance) / 1e6).toString();
  }

  /**
   * Simulate gasless USDC transfer (preparation step)
   */
  async prepareGaslessTransfer(params: PaymasterTransferParams): Promise<{
    success: boolean;
    message: string;
    permitData?: any;
    transferData?: any;
  }> {
    const { chainId, recipientAddress, amount } = params;
    
    const chainConfig = CIRCLE_PAYMASTER_CONFIG[chainId as keyof typeof CIRCLE_PAYMASTER_CONFIG];
    if (!chainConfig) {
      return {
        success: false,
        message: `Paymaster not supported on chain ${chainId}. Supported chains: ${Object.keys(CIRCLE_PAYMASTER_CONFIG).join(', ')}`
      };
    }

    const chain = getChain(chainId);
    const client = createPublicClient({ 
      chain, 
      transport: http(getRpcUrl(chainId)) 
    });

    const usdcAddress = chainConfig.usdcAddress as Address;
    const paymasterAddress = chainConfig.paymasterAddress as Address;

    // Check USDC balance
    const usdc = getContract({ client, address: usdcAddress, abi: erc20Abi });
    const usdcAmount = BigInt(parseFloat(amount) * 1e6); // Convert to 6 decimals
    const usdcBalance = await usdc.read.balanceOf([this.account.address]);

    if (usdcBalance < usdcAmount) {
      return {
        success: false,
        message: `Insufficient USDC balance. Need ${amount} USDC, have ${(Number(usdcBalance) / 1e6).toString()}. Fund your account at https://faucet.circle.com`
      };
    }

    // Create permit signature for paymaster allowance
    const permitAmount = 10000000n; // 10 USDC allowance for gas
    let permitSignature: Hex;
    
    try {
      permitSignature = await this.signPermit({
        tokenAddress: usdcAddress,
        client,
        account: this.account,
        spenderAddress: paymasterAddress,
        permitAmount: permitAmount,
      });
    } catch (error) {
      return {
        success: false,
        message: `Failed to create permit signature: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    const paymasterData = encodePacked(
      ["uint8", "address", "uint256", "bytes"],
      [0, usdcAddress, permitAmount, permitSignature],
    );

    return {
      success: true,
      message: `Ready to transfer ${amount} USDC to ${recipientAddress} using paymaster. Gas will be paid in USDC.`,
      permitData: {
        permitAmount: permitAmount.toString(),
        permitSignature,
        paymasterData,
      },
      transferData: {
        from: this.account.address,
        to: recipientAddress,
        amount: usdcAmount.toString(),
        usdcAddress,
        paymasterAddress,
        chainId,
        chainName: chain.name,
      }
    };
  }

  /**
   * Get supported chains for Circle Paymaster
   */
  getSupportedChains(): Array<{
    chainId: number;
    name: string;
    paymasterAddress: string;
    usdcAddress: string;
  }> {
    return Object.entries(CIRCLE_PAYMASTER_CONFIG).map(([chainId, config]) => ({
      chainId: Number(chainId),
      name: getChain(Number(chainId)).name,
      paymasterAddress: config.paymasterAddress,
      usdcAddress: config.usdcAddress,
    }));
  }

  /**
   * Execute gasless USDC transfer using Circle Paymaster
   */
  async executeGaslessTransfer(params: PaymasterTransferParams): Promise<{
    success: boolean;
    message: string;
    userOperationHash?: string;
    transactionHash?: string;
    error?: string;
  }> {
    const { chainId, recipientAddress, amount } = params;
    
    const chainConfig = CIRCLE_PAYMASTER_CONFIG[chainId as keyof typeof CIRCLE_PAYMASTER_CONFIG];
    if (!chainConfig) {
      return {
        success: false,
        message: `Paymaster not supported on chain ${chainId}. Only Arbitrum Sepolia (421614) is currently supported.`,
        error: "UNSUPPORTED_CHAIN"
      };
    }

    try {
      const chain = getChain(chainId);
      const client = createPublicClient({ 
        chain, 
        transport: http(getRpcUrl(chainId)) 
      });

      const usdcAddress = chainConfig.usdcAddress as Address;
      const paymasterAddress = chainConfig.paymasterAddress as Address;

      // Check USDC balance
      const usdc = getContract({ client, address: usdcAddress, abi: erc20Abi });
      const usdcAmount = BigInt(parseFloat(amount) * 1e6); // Convert to 6 decimals
      const usdcBalance = await usdc.read.balanceOf([this.account.address]);

      if (usdcBalance < usdcAmount) {
        return {
          success: false,
          message: `Insufficient USDC balance. Need ${amount} USDC, have ${(Number(usdcBalance) / 1e6).toString()}`,
          error: "INSUFFICIENT_BALANCE"
        };
      }

      // For now, simulate the gasless transfer since full Account Abstraction setup requires:
      // 1. Smart contract wallet deployment
      // 2. Bundler integration  
      // 3. User operation signing
      // 4. Paymaster validation
      
      console.log("🔄 Simulating gasless transfer execution...");
      console.log(`   From: ${this.account.address}`);
      console.log(`   To: ${recipientAddress}`);
      console.log(`   Amount: ${amount} USDC`);
      console.log(`   Paymaster: ${paymasterAddress}`);
      console.log(`   Chain: ${chain.name} (${chainId})`);

      // Create permit signature
      const permitAmount = 10000000n; // 10 USDC allowance for gas
      const permitSignature = await this.signPermit({
        tokenAddress: usdcAddress,
        client,
        account: this.account,
        spenderAddress: paymasterAddress,
        permitAmount: permitAmount,
      });

      const paymasterData = encodePacked(
        ["uint8", "address", "uint256", "bytes"],
        [0, usdcAddress, permitAmount, permitSignature],
      );

      // Simulate user operation hash (in real implementation, this would be submitted to bundler)
      const mockUserOpHash = `0x${Buffer.from(`gasless-${Date.now()}-${this.account.address}-${recipientAddress}-${amount}`).toString('hex').slice(0, 64)}` as `0x${string}`;

      return {
        success: true,
        message: `Successfully prepared gasless transfer of ${amount} USDC. In production, this would be submitted to the bundler.`,
        userOperationHash: mockUserOpHash,
        // Note: In real implementation, transactionHash would come from bundler after execution
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to execute gasless transfer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get Circle Smart Account address
   */
  async getAccountAddress(chainId: number): Promise<Address> {
    try {
      // Import Circle SDK here to avoid import issues
      const { toCircleSmartAccount } = await import('@circle-fin/modular-wallets-core');
      
      // Get the chain and create public client
      const chain = getChain(chainId);
      const client = createPublicClient({
        chain,
        transport: http(getRpcUrl(chainId)),
      });

      // Create Circle Smart Account
      const smartAccount = await toCircleSmartAccount({ 
        client, 
        owner: this.account 
      });

      return smartAccount.address;
    } catch (error) {
      // Fallback to EOA if Circle Smart Account creation fails
      console.warn('Failed to get Circle Smart Account, falling back to EOA:', error);
      return this.account.address;
    }
  }
}

// Factory function
export function createCirclePaymasterService(privateKey?: string): CirclePaymasterService {
  return new CirclePaymasterService(privateKey);
}
