import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  type Hex,
  parseUnits,
  formatUnits,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import axios from 'axios';
import {
  chainMap,
  rpcUrlMap,
  type ChainId,
  CHAIN_IDS_TO_USDC_ADDRESSES,
  CHAIN_IDS_TO_TOKEN_MESSENGER,
  CHAIN_IDS_TO_MESSAGE_TRANSMITTER,
  DESTINATION_DOMAINS,
  CHAIN_EXPLORERS,
} from '../chains.js';
import { getPrivateKeyAsHex } from '../config.js';

const DEFAULT_DECIMALS = 6;

export interface CCTPTransferParams {
  fromChainId: ChainId;
  toChainId: ChainId;
  recipientAddress: Address;
  amount: string;
  transferType?: 'fast' | 'standard';
}

export interface CCTPTransferResult {
  success: boolean;
  burnTxHash?: Hash;
  mintTxHash?: Hash;
  attestation?: any;
  error?: string;
  transferDetails?: {
    amount: string;
    fromChainId: ChainId;
    toChainId: ChainId;
    recipientAddress: Address;
    transferType: 'fast' | 'standard';
  };
  explorerLinks?: {
    burn: string;
    mint?: string;
  };
}

// Get public client for a specific chain
function getPublicClient(chainId: ChainId) {
  return createPublicClient({
    chain: chainMap[chainId],
    transport: http(rpcUrlMap[chainId]),
  });
}

// Get wallet client for a specific chain
function getWalletClient(chainId: ChainId) {
  const privateKey = getPrivateKeyAsHex();
  if (!privateKey) {
    throw new Error('Private key not configured');
  }

  const account = privateKeyToAccount(privateKey);
  
  return createWalletClient({
    account,
    chain: chainMap[chainId],
    transport: http(rpcUrlMap[chainId]),
  });
}

// Approve USDC for Token Messenger
async function approveUSDC(chainId: ChainId, amount: bigint): Promise<Hash> {
  const walletClient = getWalletClient(chainId);
  const publicClient = getPublicClient(chainId);
  
  const tx = await walletClient.sendTransaction({
    to: CHAIN_IDS_TO_USDC_ADDRESSES[chainId],
    data: encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
      ],
      functionName: "approve",
      args: [CHAIN_IDS_TO_TOKEN_MESSENGER[chainId], amount],
    }),
  });

  // Wait for approval transaction to be confirmed
  await publicClient.waitForTransactionReceipt({ 
    hash: tx,
    confirmations: 1
  });

  return tx;
}

// Burn USDC on source chain
async function burnUSDC(params: {
  chainId: ChainId;
  amount: bigint;
  destinationChainId: ChainId;
  destinationAddress: Address;
  transferType: 'fast' | 'standard';
}): Promise<Hash> {
  const { chainId, amount, destinationChainId, destinationAddress, transferType } = params;
  const walletClient = getWalletClient(chainId);
  
  const finalityThreshold = transferType === 'fast' ? 1000 : 2000;
  const maxFee = amount - 1n; // Leave 1 unit for fees
  const mintRecipient = `0x${destinationAddress.replace(/^0x/, '').padStart(64, '0')}` as Hex;

  const tx = await walletClient.sendTransaction({
    to: CHAIN_IDS_TO_TOKEN_MESSENGER[chainId],
    data: encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "depositForBurn",
          stateMutability: "nonpayable",
          inputs: [
            { name: "amount", type: "uint256" },
            { name: "destinationDomain", type: "uint32" },
            { name: "mintRecipient", type: "bytes32" },
            { name: "burnToken", type: "address" },
            { name: "hookData", type: "bytes32" },
            { name: "maxFee", type: "uint256" },
            { name: "finalityThreshold", type: "uint32" },
          ],
          outputs: [],
        },
      ],
      functionName: "depositForBurn",
      args: [
        amount,
        DESTINATION_DOMAINS[destinationChainId],
        mintRecipient,
        CHAIN_IDS_TO_USDC_ADDRESSES[chainId],
        "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
        maxFee,
        finalityThreshold,
      ],
    }),
  });

  return tx;
}

// Retrieve attestation from Circle API
async function retrieveAttestation(transactionHash: Hash, sourceChainId: ChainId): Promise<any> {
  const url = `https://iris-api-sandbox.circle.com/v2/messages/${DESTINATION_DOMAINS[sourceChainId]}?transactionHash=${transactionHash}`;

  let attempts = 0;
  const maxAttempts = 60; // 5 minutes with 5-second intervals

  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(url);
      if (response.data?.messages?.[0]?.status === 'complete') {
        return response.data.messages[0];
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
        continue;
      }
      throw error;
    }
  }

  throw new Error('Attestation timeout - message not found after 5 minutes');
}

// Mint USDC on destination chain
async function mintUSDC(destinationChainId: ChainId, attestation: any): Promise<Hash> {
  const walletClient = getWalletClient(destinationChainId);
  const publicClient = getPublicClient(destinationChainId);
  
  // Get current gas prices
  const feeData = await publicClient.estimateFeesPerGas();
  
  const contractConfig = {
    address: CHAIN_IDS_TO_MESSAGE_TRANSMITTER[destinationChainId],
    abi: [
      {
        type: "function",
        name: "receiveMessage",
        stateMutability: "nonpayable",
        inputs: [
          { name: "message", type: "bytes" },
          { name: "attestation", type: "bytes" },
        ],
        outputs: [],
      },
    ] as const,
  };

  // Estimate gas with buffer
  const gasEstimate = await publicClient.estimateContractGas({
    ...contractConfig,
    functionName: "receiveMessage",
    args: [attestation.message, attestation.attestation],
    account: walletClient.account,
  });

  // Add 20% buffer to gas estimate
  const gasWithBuffer = (gasEstimate * 120n) / 100n;

  const tx = await walletClient.sendTransaction({
    to: contractConfig.address,
    data: encodeFunctionData({
      ...contractConfig,
      functionName: "receiveMessage",
      args: [attestation.message, attestation.attestation],
    }),
    gas: gasWithBuffer,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  });

  return tx;
}

// Main CCTP transfer function
export async function executeCCTPTransfer(params: CCTPTransferParams): Promise<CCTPTransferResult> {
  try {
    const { fromChainId, toChainId, recipientAddress, amount, transferType = 'standard' } = params;
    
    // Parse amount to BigInt
    const numericAmount = parseUnits(amount, DEFAULT_DECIMALS);
    
    // Step 1: Approve USDC for Token Messenger
    await approveUSDC(fromChainId, numericAmount);
    
    // Step 2: Burn USDC on source chain
    const burnTxHash = await burnUSDC({
      chainId: fromChainId,
      amount: numericAmount,
      destinationChainId: toChainId,
      destinationAddress: recipientAddress,
      transferType,
    });
    
    // Step 3: Wait for attestation
    const attestation = await retrieveAttestation(burnTxHash, fromChainId);
    
    // Step 4: Mint USDC on destination chain
    const mintTxHash = await mintUSDC(toChainId, attestation);
    
    return {
      success: true,
      burnTxHash,
      mintTxHash,
      attestation,
      transferDetails: {
        amount: formatUnits(numericAmount, DEFAULT_DECIMALS),
        fromChainId,
        toChainId,
        recipientAddress,
        transferType,
      },
      explorerLinks: {
        burn: `${CHAIN_EXPLORERS[fromChainId]}${burnTxHash}`,
        mint: `${CHAIN_EXPLORERS[toChainId]}${mintTxHash}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Get USDC balance for an address
export async function getUSDCBalance(address: Address, chainId: ChainId): Promise<{
  raw: bigint;
  formatted: string;
}> {
  const publicClient = getPublicClient(chainId);
  
  const balance = await publicClient.readContract({
    address: CHAIN_IDS_TO_USDC_ADDRESSES[chainId],
    abi: [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [address],
  });

  return {
    raw: balance as bigint,
    formatted: formatUnits(balance as bigint, DEFAULT_DECIMALS),
  };
}

// Get supported chains for CCTP
export function getSupportedCCTPChains(): Array<{
  chainId: ChainId;
  name: string;
  domain: number;
  usdcAddress: string;
  explorerUrl: string;
}> {
  return Object.entries(DESTINATION_DOMAINS).map(([chainId, domain]) => {
    const id = parseInt(chainId) as ChainId;
    return {
      chainId: id,
      name: chainMap[id]?.name || `Chain ${id}`,
      domain,
      usdcAddress: CHAIN_IDS_TO_USDC_ADDRESSES[id],
      explorerUrl: CHAIN_EXPLORERS[id],
    };
  });
}
