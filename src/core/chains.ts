import { type Chain } from 'viem';
import {
  base,
  mainnet,
  optimism,
  sepolia,
  avalancheFuji,
  baseSepolia,
  arbitrumSepolia,
  lineaSepolia,
} from 'viem/chains';

// Define additional chains for Circle CCTP
export const worldchainSepolia: Chain = {
  id: 1666700000,
  name: 'Worldchain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://worldchain-sepolia.gateway.tenderly.co'] },
  },
  blockExplorers: {
    default: { name: 'Worldchain Sepolia Explorer', url: 'https://worldchain-sepolia.explorer.alchemy.com' },
  },
  testnet: true,
};

export const sonicBlazeTestnet: Chain = {
  id: 161,
  name: 'Sonic Blaze Testnet',
  nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sonic-blaze.g.alchemy.com/v2/GDp1JCvazYbd7TxvfqMnOBiCQSnLu02I'] },
  },
  blockExplorers: {
    default: { name: 'Sonic Blaze Explorer', url: 'https://testnet.soniclabs.com' },
  },
  testnet: true,
};

export const unichainSepolia: Chain = {
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://unichain-sepolia.g.alchemy.com/v2/GDp1JCvazYbd7TxvfqMnOBiCQSnLu02I'] },
  },
  blockExplorers: {
    default: { name: 'Unichain Sepolia Explorer', url: 'https://sepolia.unichain.org' },
  },
  testnet: true,
};

//https://base-testnet.g.alchemy.com/v2/QyxMOKTYrNkmofq71rof8WEO1kw9VuI4
export const DEFAULT_NETWORK = 'base';
export const DEFAULT_RPC_URL = 'https://base-mainnet.g.alchemy.com/v2/QyxMOKTYrNkmofq71rof8WEO1kw9VuI4';
export const DEFAULT_CHAIN_ID = 8453;

export const chainMap: Record<number, Chain> = {
  1: mainnet,
  10: optimism,
  8453: base,
  // Circle CCTP Supported Chains
  11155111: sepolia,
  43113: avalancheFuji,
  84532: baseSepolia,
  421614: arbitrumSepolia,
  59144: lineaSepolia,
  1666700000: worldchainSepolia,
  161: sonicBlazeTestnet,
  1301: unichainSepolia,
}; 

// Map network names to chain IDs for easier reference
export const networkNameMap: Record<string, number> = {
  'mainnet': 1,
  'base': 8453,
  'optimism': 10,
  'xlayer': 196,
  // Circle CCTP Networks
  'sepolia': 11155111,
  'eth-sepolia': 11155111,
  'ethereum-sepolia': 11155111,
  'avalanche-fuji': 43113,
  'avax-fuji': 43113,
  'fuji': 43113,
  'base-sepolia': 84532,
  'arbitrum-sepolia': 421614,
  'arb-sepolia': 421614,
  'linea-sepolia': 59144,
  'worldchain-sepolia': 1666700000,
  'sonic-blaze': 161,
  'sonic': 161,
  'unichain-sepolia': 1301,
  'unichain': 1301,
};

// Map chain IDs to RPC URLs
export const rpcUrlMap: Record<number, string> = {
  1: 'https://eth-mainnet.g.alchemy.com/v2/QyxMOKTYrNkmofq71rof8WEO1kw9VuI4',
  10: 'https://opt-mainnet.g.alchemy.com/v2/QyxMOKTYrNkmofq71rof8WEO1kw9VuI4',
  8453: 'https://base-mainnet.g.alchemy.com/v2/QyxMOKTYrNkmofq71rof8WEO1kw9VuI4',
  // Circle CCTP Chains
  11155111: 'https://eth-sepolia.g.alchemy.com/v2/QyxMOKTYrNkmofq71rof8WEO1kw9VuI4',
  43113: 'https://avax-fuji.g.alchemy.com/v2/GDp1JCvazYbd7TxvfqMnOBiCQSnLu02I',
  84532: 'https://base-sepolia.g.alchemy.com/v2/QyxMOKTYrNkmofq71rof8WEO1kw9VuI4',
  421614: 'https://arb-sepolia.g.alchemy.com/v2/GDp1JCvazYbd7TxvfqMnOBiCQSnLu02I',
  59144: 'https://rpc.sepolia.linea.build',
  1666700000: 'https://worldchain-sepolia.gateway.tenderly.co',
  161: 'https://sonic-blaze.g.alchemy.com/v2/GDp1JCvazYbd7TxvfqMnOBiCQSnLu02I',
  1301: 'https://unichain-sepolia.g.alchemy.com/v2/GDp1JCvazYbd7TxvfqMnOBiCQSnLu02I',
};

/**
 * Resolves a chain identifier (number or string) to a chain ID
 * @param chainIdentifier Chain ID (number) or network name (string)
 * @returns The resolved chain ID
 */
export function resolveChainId(chainIdentifier: number | string): number {
  if (typeof chainIdentifier === 'number') {
    return chainIdentifier;
  }

  // Convert to lowercase for case-insensitive matching
  const networkName = chainIdentifier.toLowerCase();

  // Check if the network name is in our map
  if (networkName in networkNameMap) {
    return networkNameMap[networkName];
  }

  // Try parsing as a number
  const parsedId = parseInt(networkName);
  if (!isNaN(parsedId)) {
    return parsedId;
  }

  // Default to mainnet if not found
  return DEFAULT_CHAIN_ID;
}

/**
 * Returns the chain configuration for the specified chain ID or network name
 * @param chainIdentifier Chain ID (number) or network name (string)
 * @returns The chain configuration
 * @throws Error if the network is not supported (when string is provided)
 */
export function getChain(chainIdentifier: number | string = DEFAULT_CHAIN_ID): Chain {
  if (typeof chainIdentifier === 'string') {
    const networkName = chainIdentifier.toLowerCase();
    // Try to get from direct network name mapping first
    if (networkNameMap[networkName]) {
      return chainMap[networkNameMap[networkName]] || base;
    }

    // If not found, throw an error
    throw new Error(`Unsupported network: ${chainIdentifier}`);
  }

  // If it's a number, return the chain from chainMap
  return chainMap[chainIdentifier] || base;
}

/**
 * Gets the appropriate RPC URL for the specified chain ID or network name
 * @param chainIdentifier Chain ID (number) or network name (string)
 * @returns The RPC URL for the specified chain
 */
export function getRpcUrl(chainIdentifier: number | string = DEFAULT_CHAIN_ID): string {
  const chainId = typeof chainIdentifier === 'string'
    ? resolveChainId(chainIdentifier)
    : chainIdentifier;

  return rpcUrlMap[chainId] || DEFAULT_RPC_URL;
}

/**
 * Get a list of supported networks
 * @returns Array of supported network names (excluding short aliases)
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(networkNameMap)
    .filter(name => name.length > 2) // Filter out short aliases
    .sort();
}

// Circle CCTP v2 Configuration
export const CHAIN_IDS = {
  ETH_SEPOLIA: 11155111,
  AVAX_FUJI: 43113,
  BASE_SEPOLIA: 84532,
  SONIC_BLAZE: 161,
  LINEA_SEPOLIA: 59144,
  ARBITRUM_SEPOLIA: 421614,
  WORLDCHAIN_SEPOLIA: 1666700000,
  UNICHAIN_SEPOLIA: 1301,
} as const;

export type ChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];

// USDC Contract Addresses for Circle CCTP
export const CHAIN_IDS_TO_USDC_ADDRESSES: Record<ChainId, `0x${string}`> = {
  [CHAIN_IDS.ETH_SEPOLIA]: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
  [CHAIN_IDS.AVAX_FUJI]: "0x5425890298aed601595a70AB815c96711a31Bc65",
  [CHAIN_IDS.BASE_SEPOLIA]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [CHAIN_IDS.SONIC_BLAZE]: "0xA4879Fed32Ecbef99399e5cbC247E533421C4eC6",
  [CHAIN_IDS.LINEA_SEPOLIA]: "0xFEce4462D57bD51A6A552365A011b95f0E16d9B7",
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  [CHAIN_IDS.WORLDCHAIN_SEPOLIA]: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88",
  [CHAIN_IDS.UNICHAIN_SEPOLIA]: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
};

// Token Messenger Contract Addresses
export const CHAIN_IDS_TO_TOKEN_MESSENGER: Record<ChainId, `0x${string}`> = {
  [CHAIN_IDS.ETH_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [CHAIN_IDS.AVAX_FUJI]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [CHAIN_IDS.BASE_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [CHAIN_IDS.SONIC_BLAZE]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [CHAIN_IDS.LINEA_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [CHAIN_IDS.WORLDCHAIN_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [CHAIN_IDS.UNICHAIN_SEPOLIA]: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
};

// Message Transmitter Contract Addresses
export const CHAIN_IDS_TO_MESSAGE_TRANSMITTER: Record<ChainId, `0x${string}`> = {
  [CHAIN_IDS.ETH_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [CHAIN_IDS.AVAX_FUJI]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [CHAIN_IDS.BASE_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [CHAIN_IDS.SONIC_BLAZE]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [CHAIN_IDS.LINEA_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [CHAIN_IDS.WORLDCHAIN_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [CHAIN_IDS.UNICHAIN_SEPOLIA]: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
};

// Destination Domains for Circle CCTP
export const DESTINATION_DOMAINS: Record<ChainId, number> = {
  [CHAIN_IDS.ETH_SEPOLIA]: 0,
  [CHAIN_IDS.AVAX_FUJI]: 1,
  [CHAIN_IDS.BASE_SEPOLIA]: 6,
  [CHAIN_IDS.SONIC_BLAZE]: 13,
  [CHAIN_IDS.LINEA_SEPOLIA]: 11,
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: 3,
  [CHAIN_IDS.WORLDCHAIN_SEPOLIA]: 14,
  [CHAIN_IDS.UNICHAIN_SEPOLIA]: 10,
};

// Chain Explorers
export const CHAIN_EXPLORERS: Record<ChainId, string> = {
  [CHAIN_IDS.ETH_SEPOLIA]: "https://sepolia.etherscan.io/tx/",
  [CHAIN_IDS.AVAX_FUJI]: "https://testnet.snowtrace.io/tx/",
  [CHAIN_IDS.BASE_SEPOLIA]: "https://sepolia.basescan.org/tx/",
  [CHAIN_IDS.SONIC_BLAZE]: "https://testnet.soniclabs.com/tx/",
  [CHAIN_IDS.LINEA_SEPOLIA]: "https://sepolia.lineascan.build/tx/",
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: "https://sepolia.arbiscan.io/tx/",
  [CHAIN_IDS.WORLDCHAIN_SEPOLIA]: "https://worldchain-sepolia.explorer.alchemy.com/tx/",
  [CHAIN_IDS.UNICHAIN_SEPOLIA]: "https://sepolia.unichain.org/tx/",
};
