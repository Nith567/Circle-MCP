import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  encodeFunctionData, 
  parseUnits, 
  getContract, 
  encodePacked,
  maxUint256,
  parseErc6492Signature,
  hexToBigInt,
  type Address, 
  type Hex 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { toCircleSmartAccount } from '@circle-fin/modular-wallets-core';
import { createBundlerClient } from 'viem/account-abstraction';
import { erc20Abi } from 'viem';
import { getRpcUrl, getChain } from '../core/chains.js';
import { config } from '../core/config.js';

const CIRCLE_PAYMASTER_CONFIG = {
  421614: { // Arbitrum Sepolia
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    paymasterAddress: "0x31BE08D380A21fc740883c0BC434FcFc88740b58"
  }
};

// EIP-2612 ABI extension
const eip2612Abi = [
  ...erc20Abi,
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    stateMutability: "view",
    type: "function",
    name: "nonces",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface PaymasterTransferParams {
  chainId: number;
  recipientAddress: Address;
  amount: string;
}

export class CirclePaymasterService {
  private account: any;
  private smartAccount: any = null;

  constructor() {
    if (!config.privateKey) {
      throw new Error('Private key not found in environment variables');
    }
    this.account = privateKeyToAccount(config.privateKey as Hex);
  }

  /**
   * Create EIP-2612 permit for USDC
   */
  private async createEIP2612Permit(
    token: any,
    chain: any,
    ownerAddress: Address,
    spenderAddress: Address,
    value: bigint
  ) {
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

  /**
   * Sign permit for paymaster
   */
  private async signPermit(
    client: any,
    tokenAddress: Address,
    spenderAddress: Address,
    permitAmount: bigint
  ) {
    const token = getContract({
      client,
      address: tokenAddress,
      abi: eip2612Abi,
    });

    const permitData = await this.createEIP2612Permit(
      token,
      client.chain,
      this.smartAccount.address,
      spenderAddress,
      permitAmount
    );

    const wrappedPermitSignature = await this.smartAccount.signTypedData(permitData);

    const isValid = await client.verifyTypedData({
      ...permitData,
      address: this.smartAccount.address,
      signature: wrappedPermitSignature,
    });

    if (!isValid) {
      throw new Error(`Invalid permit signature for ${this.smartAccount.address}`);
    }

    const { signature } = parseErc6492Signature(wrappedPermitSignature);
    return signature;
  }

  /**
   * Get Circle Smart Account address (REAL v0.7 implementation)
   */
  async getAccountAddress(chainId: number, version?: string): Promise<Address> {
    const chainConfig = CIRCLE_PAYMASTER_CONFIG[chainId as keyof typeof CIRCLE_PAYMASTER_CONFIG];
    if (!chainConfig) {
      throw new Error(`Paymaster v0.7 not supported on chain ${chainId}. Only supports Arbitrum Sepolia (421614)`);
    }

    const chain = getChain(chainId);
    const client = createPublicClient({ 
      chain, 
      transport: http(getRpcUrl(chainId)) 
    });

    // Create REAL Circle Smart Account using Circle SDK
    const smartAccount = await toCircleSmartAccount({ 
      client, 
      owner: this.account 
    });

    this.smartAccount = smartAccount;
    return smartAccount.address;
  }

  /**
   * Check USDC balance in Circle Smart Account (REAL implementation)
   */
  async checkUSDCBalance(chainId: number, accountAddress?: Address, version?: string): Promise<string> {
    const chainConfig = CIRCLE_PAYMASTER_CONFIG[chainId as keyof typeof CIRCLE_PAYMASTER_CONFIG];
    if (!chainConfig) {
      throw new Error(`Paymaster v0.7 not supported on chain ${chainId}. Only supports Arbitrum Sepolia (421614)`);
    }

    const chain = getChain(chainId);
    const client = createPublicClient({ 
      chain, 
      transport: http(getRpcUrl(chainId)) 
    });

    // Get Circle Smart Account address if not provided
    let targetAddress = accountAddress;
    if (!targetAddress) {
      targetAddress = await this.getAccountAddress(chainId);
    }

    const usdc = getContract({ 
      client, 
      address: chainConfig.usdcAddress as Address, 
      abi: erc20Abi 
    });

    const balance = await usdc.read.balanceOf([targetAddress]);
    
    // Convert from 6 decimals to human readable
    return (Number(balance) / 1e6).toString();
  }

  /**
   * Execute REAL gasless USDC transfer using Circle Paymaster v0.7 with EIP-4337
   */
  async executeGaslessTransfer(params: PaymasterTransferParams): Promise<{
    success: boolean;
    txHash?: string;
    message: string;
    explorerUrl?: string;
  }> {
    const { chainId, recipientAddress, amount } = params;
    
    const chainConfig = CIRCLE_PAYMASTER_CONFIG[chainId as keyof typeof CIRCLE_PAYMASTER_CONFIG];
    if (!chainConfig) {
      return {
        success: false,
        message: `Paymaster v0.7 not supported on chain ${chainId}. Only supports Arbitrum Sepolia (421614)`
      };
    }

    try {
      const chain = getChain(chainId);
      const client = createPublicClient({ 
        chain, 
        transport: http(getRpcUrl(chainId)) 
      });

      // Get or create Circle Smart Account
      if (!this.smartAccount) {
        await this.getAccountAddress(chainId);
      }



      // Check balance first
      const balance = await this.checkUSDCBalance(chainId);
      const balanceNum = parseFloat(balance);
      const amountNum = parseFloat(amount);
      
      if (balanceNum < amountNum) {
        return {
          success: false,
          message: `Insufficient USDC balance. Have ${balance} USDC, need ${amount} USDC. Fund your Circle Smart Account at: https://faucet.circle.com`
        };
      }

      // Prepare transfer data
      const amountWei = parseUnits(amount, 6); // USDC has 6 decimals
      const permitAmount = parseUnits("10", 6); // 10 USDC permit for gas
      
      
      // Sign permit for paymaster to spend USDC for gas
      const permitSignature = await this.signPermit(
        client,
        chainConfig.usdcAddress as Address,
        chainConfig.paymasterAddress as Address,
        permitAmount
      );


      // Create paymaster data
      const paymasterData = encodePacked(
        ["uint8", "address", "uint256", "bytes"],
        [0, chainConfig.usdcAddress as Address, permitAmount, permitSignature]
      );

      // Create paymaster configuration
      const paymaster = {
        async getPaymasterData() {
          return {
            paymaster: chainConfig.paymasterAddress as Address,
            paymasterData,
            paymasterVerificationGasLimit: 200000n,
            paymasterPostOpGasLimit: 15000n,
            isFinal: true,
          };
        },
      };

      
      // Create bundler client with Pimlico
      const bundlerClient = createBundlerClient({
        account: this.smartAccount,
        client,
        paymaster,
        userOperation: {
          estimateFeesPerGas: async () => {
            // Use a simple gas estimation for testnet
            return {
              maxFeePerGas: parseUnits("2", 9), // 2 gwei
              maxPriorityFeePerGas: parseUnits("1", 9), // 1 gwei
            };
          },
        },
        transport: http(`https://public.pimlico.io/v2/${chainId}/rpc`),
      });

      
      // Submit user operation
      const userOpHash = await bundlerClient.sendUserOperation({
        account: this.smartAccount,
        calls: [
          {
            to: chainConfig.usdcAddress as Address,
            abi: erc20Abi,
            functionName: "transfer",
            args: [recipientAddress, amountWei],
          },
        ],
      });


      // Wait for transaction receipt
      const receipt = await bundlerClient.waitForUserOperationReceipt({ 
        hash: userOpHash 
      });

      const txHash = receipt.receipt.transactionHash;
      const explorerUrl = `https://sepolia.arbiscan.io/tx/${txHash}`;
      
      
      return {
        success: true,
        txHash,
        explorerUrl,
        message: `Successfully transferred ${amount} USDC using Circle Paymaster v0.7. Gas paid in USDC via EIP-4337! 🚀`
      };

    } catch (error) {
      console.error('Circle Paymaster v0.7 transfer failed:', error);
      return {
        success: false,
        message: `Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * LEGACY - Remove simulation, use real execution
   */
  async prepareGaslessTransfer(params: PaymasterTransferParams): Promise<{
    success: boolean;
    message: string;
    permitData?: any;
    transferData?: any;
    txHash?: string;
    explorerUrl?: string;
  }> {
    // Now calls the REAL execution instead of simulation
    const result = await this.executeGaslessTransfer(params);
    return {
      success: result.success,
      message: result.message,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl
    };
  }
}

export function createCirclePaymasterService() {
  return new CirclePaymasterService();
}