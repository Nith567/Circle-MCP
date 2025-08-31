import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {getSupportedNetworks, getRpcUrl, DEFAULT_NETWORK, type ChainId, CHAIN_IDS} from "./chains.js";
import * as services from "./services/index.js";
import { 
  executeCCTPTransfer, 
  getUSDCBalance, 
  getSupportedCCTPChains 
} from './services/cctp.js';
import { createCirclePaymasterService } from '../services/circle-paymaster.js';
import { createCirclePaymasterV08Service } from '../services/circle-paymaster-v08.js';

const paymasterService = createCirclePaymasterService();
const paymasterV08Service = createCirclePaymasterV08Service();
import {type Address, type Hex, type Hash, WriteContractParameters, Abi} from 'viem';
import { getPrivateKeyAsHex } from "./config.js";

/**
 * Register all EVM-related tools with the MCP server
 *
 * @param server The MCP server instance
 */
export function registerEVMTools(server: McpServer) {


  // Get chain information (updated to include CCTP chains)
  server.tool(
    "get_chain_info",
    "Get information about EVM networks including all supported chains for Circle CCTP transfers",
    {
      network: z.string().optional().describe("Network name (e.g., 'base-sepolia', 'sepolia', 'avalanche-fuji') or chain ID. Supports all CCTP enabled chains. Defaults to Base mainnet.")
    },
    async ({ network = DEFAULT_NETWORK }) => {
      try {
        const chainId = await services.getChainId(network);
        const blockNumber = await services.getBlockNumber(network);
        const rpcUrl = getRpcUrl(network);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              network,
              chainId,
              blockNumber: blockNumber.toString(),
              rpcUrl
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching chain info: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Circle CCTP v2 - Cross-chain USDC transfer
  server.tool(
    "cctp_cross_chain_transfer",
    "Transfer USDC between supported chains using Circle's Cross-Chain Transfer Protocol (CCTP) v2. This burns USDC on the source chain and mints it on the destination chain. Example: 'convert my 0.2 USDC from Avalanche Fuji to Base Sepolia'",
    {
      fromChainId: z.number().describe("Source chain ID where USDC will be burned (e.g., 11155111 for Ethereum Sepolia, 84532 for Base Sepolia, 43113 for Avalanche Fuji)"),
      toChainId: z.number().describe("Destination chain ID where USDC will be minted (e.g., 43113 for Avalanche Fuji, 421614 for Arbitrum Sepolia, 84532 for Base Sepolia)"),
      amount: z.string().describe("Amount of USDC to transfer (e.g., '10.5' for 10.5 USDC, '0.2' for 0.2 USDC)"),
      recipientAddress: z.string().optional().describe("Recipient address on the destination chain. If not provided, uses your own wallet address from the private key."),
      transferType: z.enum(['fast', 'standard']).optional().describe("Transfer speed - 'fast' for quicker finality or 'standard' for normal speed. Defaults to 'standard'.")
    },
    async ({ fromChainId, toChainId, amount, recipientAddress, transferType = 'standard' }) => {
      try {
        // Use configured address if no recipient address provided
        let targetRecipient = recipientAddress;
        if (!targetRecipient) {
          const privateKeyValue = getPrivateKeyAsHex();
          if (!privateKeyValue) {
            return {
              content: [{ type: "text", text: "Error: No recipient address provided and PRIVATE_KEY environment variable is not set. Please provide a recipient address or set the PRIVATE_KEY environment variable." }],
              isError: true
            };
          }
          targetRecipient = services.getAddressFromPrivateKey(privateKeyValue);
        }

        const result = await executeCCTPTransfer({
          fromChainId: fromChainId as ChainId,
          toChainId: toChainId as ChainId,
          recipientAddress: targetRecipient as Address,
          amount,
          transferType,
        });

        if (result.success) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                burnTxHash: result.burnTxHash,
                mintTxHash: result.mintTxHash,
                explorerLinks: result.explorerLinks,
                details: {
                  amount: `${amount} USDC`,
                  fromChain: fromChainId,
                  toChain: toChainId,
                  recipient: targetRecipient,
                  transferType,
                  timestamp: new Date().toISOString()
                },
                message: `Successfully transferred ${amount} USDC from chain ${fromChainId} to chain ${toChainId}`,
                recipient: targetRecipient
              }, null, 2)
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `Error during CCTP transfer: ${result.error}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error executing CCTP transfer: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get USDC balance on CCTP supported chains
  server.tool(
    "get_usdc_balance_cctp",
    "Get USDC balance for an address on Circle CCTP supported chains",
    {
      address: z.string().optional().describe("The address to check USDC balance for. If not provided, uses the address from the configured private key."),
      chainId: z.number().describe("Chain ID to check balance on (e.g., 11155111 for Ethereum Sepolia, 84532 for Base Sepolia)")
    },
    async ({ address, chainId }) => {
      try {
        // Use configured address if no address provided
        let targetAddress = address;
        if (!targetAddress) {
          const privateKeyValue = getPrivateKeyAsHex();
          if (!privateKeyValue) {
            return {
              content: [{ type: "text", text: "Error: No address provided and PRIVATE_KEY environment variable is not set. Please provide an address or set the PRIVATE_KEY environment variable." }],
              isError: true
            };
          }
          targetAddress = services.getAddressFromPrivateKey(privateKeyValue);
        }

        const balance = await getUSDCBalance(targetAddress as Address, chainId as ChainId);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address: targetAddress,
              chainId,
              balance: {
                raw: balance.raw.toString(),
                formatted: `${balance.formatted} USDC`
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching USDC balance: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get supported CCTP chains
  server.tool(
    "get_cctp_supported_chains",
    "Get all chains supported by Circle's Cross-Chain Transfer Protocol (CCTP) with their details",
    {},
    async () => {
      try {
        const supportedChains = getSupportedCCTPChains();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              totalChains: supportedChains.length,
              supportedChains: supportedChains.map((chain: any) => ({
                chainId: chain.chainId,
                name: chain.name,
                domain: chain.domain,
                usdcAddress: chain.usdcAddress,
                explorerUrl: chain.explorerUrl
              }))
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching CCTP supported chains: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get CCTP v2 supported blockchains
  server.tool(
    "get_cctp_v2_blockchains",
    "Get comprehensive information about all CCTP v2 supported blockchains including mainnet and testnet networks, with their capabilities and supported tokens",
    {},
    async () => {
      try {
        const cctpV2Blockchains = {
          overview: "CCTP V2 is available on the following blockchains where USDC is natively issued, providing Standard Transfer, Fast Transfer, and Hooks functionalities.",
          supportedTokens: {
            USDC: "Supported on all CCTP V2 domains except BNB Smart Chain",
            USYC: "Supported only on Ethereum and BNB Smart Chain"
          },
          networks: {
            mainnet: [
              { name: "Arbitrum", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Avalanche", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Base", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "BNB Smart Chain", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USYC"], note: "USYC only" },
              { name: "Codex", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Ethereum", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC", "USYC"] },
              { name: "Linea", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "OP Mainnet", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Polygon PoS", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Sei", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Solana", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Sonic", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Unichain", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "World Chain", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] }
            ],
            testnet: [
              { name: "Arbitrum Sepolia", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Avalanche Fuji", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Base Sepolia", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "BNB Smart Chain Testnet", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USYC"], note: "USYC only" },
              { name: "Codex Testnet", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Ethereum Sepolia", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC", "USYC"] },
              { name: "Linea Sepolia", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "OP Sepolia", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Polygon PoS Amoy", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Sei Testnet", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Solana Devnet", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Sonic Testnet", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "Unichain Sepolia", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] },
              { name: "World Chain Sepolia", capabilities: ["Standard Transfer", "Fast Transfer", "Hooks"], tokens: ["USDC"] }
            ]
          },
          totalNetworks: 28,
          totalMainnetNetworks: 14,
          totalTestnetNetworks: 14
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(cctpV2Blockchains, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching CCTP v2 blockchains: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get CCTP domain mappings
  server.tool(
    "get_cctp_domain_mappings",
    "Get CCTP domain ID mappings for all supported blockchains with their corresponding names and supported tokens",
    {},
    async () => {
      try {
        const domainMappings = {
          overview: "CCTP domain IDs map blockchain networks to unique identifiers for cross-chain messaging. Not all domains support the same tokens.",
          tokenSupport: {
            USDC: "Supported on all CCTP V2 domains except BNB Smart Chain (domain 17)",
            USYC: "Supported only on Ethereum (domain 0) and BNB Smart Chain (domain 17)"
          },
          domains: [
            { domainId: 0, name: "Ethereum", supportedTokens: ["USDC", "USYC"] },
            { domainId: 1, name: "Avalanche", supportedTokens: ["USDC"] },
            { domainId: 2, name: "OP", supportedTokens: ["USDC"] },
            { domainId: 3, name: "Arbitrum", supportedTokens: ["USDC"] },
            { domainId: 5, name: "Solana", supportedTokens: ["USDC"] },
            { domainId: 6, name: "Base", supportedTokens: ["USDC"] },
            { domainId: 7, name: "Polygon PoS", supportedTokens: ["USDC"] },
            { domainId: 10, name: "Unichain", supportedTokens: ["USDC"] },
            { domainId: 11, name: "Linea", supportedTokens: ["USDC"] },
            { domainId: 12, name: "Codex", supportedTokens: ["USDC"] },
            { domainId: 13, name: "Sonic", supportedTokens: ["USDC"] },
            { domainId: 14, name: "World Chain", supportedTokens: ["USDC"] },
            { domainId: 16, name: "Sei", supportedTokens: ["USDC"] },
            { domainId: 17, name: "BNB Smart Chain", supportedTokens: ["USYC"] }
          ],
          totalDomains: 14,
          usdcDomains: 13,
          usycDomains: 2,
          note: "Domain IDs are used internally by CCTP for routing messages between chains. Each blockchain network has a unique domain ID."
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(domainMappings, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching CCTP domain mappings: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get supported networks (now including CCTP chains)
  server.tool(
    "get_supported_networks",
    "Get a list of supported EVM networks including Circle CCTP chains",
    {},
    async () => {
      try {
        const networks = getSupportedNetworks();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              supportedNetworks: networks
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching supported networks: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );


  // Get native token balance
  server.tool(
    "get_balance",
    "Get the native token balance (ETH) for an address",
    {
      address: z.string().describe("The wallet address name (e.g., '0x1234...') to check the balance for"),
      network: z.string().optional().describe("Network name (e.g., 'base', 'optimism') or chain ID. Supports Base and Optimism networks. Defaults to Base mainnet.")
    },
    async ({ address, network = DEFAULT_NETWORK }) => {
      try {
        const balance = await services.getBalance(address, network);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address,
              network,
              wei: balance.wei.toString(),
              ether: balance.eth
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching balance: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get ERC20 balance
  server.tool(
    "get_erc20_balance",
    "Get the ERC20 token balance of an EVM address. If no address is provided, uses the address derived from the configured private key.",
    {
      address: z.string().optional().describe("The EVM address to check. If not provided, uses the address from the configured private key."),
      tokenAddress: z.string().describe("The ERC20 token contract address"),
      network: z.string().optional().describe("Network name or chain ID. Defaults to Base mainnet.")
    },
    async ({ address, tokenAddress, network = DEFAULT_NETWORK }) => {
      try {
        // Use configured address if no address provided
        let targetAddress = address;
        if (!targetAddress) {
          const privateKeyValue = getPrivateKeyAsHex();
          if (!privateKeyValue) {
            return {
              content: [{ type: "text", text: "Error: No address provided and PRIVATE_KEY environment variable is not set. Please provide an address or set the PRIVATE_KEY environment variable." }],
              isError: true
            };
          }
          targetAddress = services.getAddressFromPrivateKey(privateKeyValue);
        }

        const balance = await services.getERC20Balance(
          tokenAddress as Address,
          targetAddress as Address,
          network
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address: targetAddress,
              tokenAddress,
              network,
              balance: {
                raw: balance.raw.toString(),
                formatted: balance.formatted,
                decimals: balance.token.decimals
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        // Use the address that was actually used for the request
        const usedAddress = address || "configured private key address";
        return {
          content: [{
            type: "text",
            text: `Error fetching ERC20 balance for ${usedAddress}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get ERC20 token balance
  server.tool(
    "get_token_balance",
    "Get the balance of an ERC20 token for an address",
    {
      tokenAddress: z.string().describe("The contract address name of the ERC20 token (e.g., '0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1')"),
      ownerAddress: z.string().describe("The wallet address name to check the balance for (e.g., '0x1234...')"),
      network: z.string().optional().describe("Network name (e.g., 'base', 'optimism') or chain ID. Supports Base and Optimism networks. Defaults to Base mainnet.")
    },
    async ({ tokenAddress, ownerAddress, network = DEFAULT_NETWORK }) => {
      try {
        const balance = await services.getERC20Balance(tokenAddress, ownerAddress, network);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              tokenAddress,
              owner: ownerAddress,
              network,
              raw: balance.raw.toString(),
              formatted: balance.formatted,
              symbol: balance.token.symbol,
              decimals: balance.token.decimals
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching token balance: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get transaction by hash
  server.tool(
    "get_transaction",
    "Get detailed information about a specific transaction by its hash. Includes sender, recipient, value, data, and more.",
    {
      txHash: z.string().describe("The transaction hash to look up (e.g., '0x1234...')"),
      network: z.string().optional().describe("Network name (e.g., 'base', 'optimism') or chain ID. Defaults to Base mainnet.")
    },
    async ({ txHash, network = DEFAULT_NETWORK }) => {
      try {
        const tx = await services.getTransaction(txHash as Hash, network);

        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson(tx)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching transaction ${txHash}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Get transaction receipt
  server.tool(
    "get_transaction_receipt",
    "Get a transaction receipt by its hash",
    {
      txHash: z.string().describe("The transaction hash to look up"),
      network: z.string().optional().describe("Network name or chain ID. Defaults to Base mainnet.")
    },
    async ({ txHash, network = DEFAULT_NETWORK }) => {
      try {
        const receipt = await services.getTransactionReceipt(txHash as Hash, network);

        return {
          content: [{
            type: "text",
            text: services.helpers.formatJson(receipt)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching transaction receipt ${txHash}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );



  // TRANSFER TOOLS

  // Transfer native tokens (ETH)
  server.tool(
    "transfer_native",
    "Transfer native tokens (ETH) to an address",
    {
      to: z.string().describe("The recipient address (e.g., '0x1234...'"),
      amount: z.string().describe("Amount to send in ETH (or the native token of the network), as a string (e.g., '0.1')"),
      network: z.string().optional().describe("Network name (e.g., 'base', 'optimism') or chain ID. Defaults to Base mainnet.")
    },
    async ({ to, amount, network = DEFAULT_NETWORK }) => {
      try {
        const txHash = await services.transferEth(to, amount, network);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash,
              to,
              amount,
              network
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error transferring native tokens: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Transfer ERC20
  server.tool(
    "transfer_erc20",
    "Transfer ERC20 tokens to another address",
    {
      tokenAddress: z.string().describe("The address of the ERC20 token contract"),
      toAddress: z.string().describe("The recipient address"),
      amount: z.string().describe("The amount of tokens to send (in token units, e.g., '10' for 10 tokens)"),
      network: z.string().optional().describe("Network name (e.g., 'base', 'optimism') or chain ID. Defaults to Base mainnet.")
    },
    async ({ tokenAddress, toAddress, amount, network = DEFAULT_NETWORK }) => {
      try {
        const result = await services.transferERC20(
          tokenAddress,
          toAddress,
          amount,
          network
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash: result.txHash,
              network,
              tokenAddress,
              recipient: toAddress,
              amount: result.amount.formatted,
              symbol: result.token.symbol
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error transferring ERC20 tokens: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );





  // CONTRACT TOOLS

  // Get ERC20 token information
  server.tool(
    "get_token_info",
    "Get comprehensive information about an ERC20 token including name, symbol, decimals, total supply, and other metadata. Use this to analyze any token on EVM chains.",
    {
      tokenAddress: z.string().describe("The contract address of the ERC20 token (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')"),
      network: z.string().optional().describe("Network name (e.g., 'base', 'optimism') or chain ID. Defaults to Base mainnet.")
    },
    async ({ tokenAddress, network = DEFAULT_NETWORK }) => {
      try {
        const tokenInfo = await services.getERC20TokenInfo(tokenAddress as Address, network);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address: tokenAddress,
              network,
              ...tokenInfo
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching token info: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // WALLET TOOLS

  // Get address from private key
  server.tool(
    "get_address_from_private_key",
    "Get the EVM address derived from a private key",
    {}, // Schema is empty as privateKey parameter was removed
    async () => { // Handler function starts here
      try {
        const privateKeyValue = getPrivateKeyAsHex();
        if (!privateKeyValue) {
          return {
            content: [{ type: "text", text: "Error: The PRIVATE_KEY environment variable is not set. Please set this variable with your private key and restart the MCP server for this tool to function." }],
            isError: true
          };
        }

        const address = services.getAddressFromPrivateKey(privateKeyValue);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address,
              // Do not return the private key in the response.
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error deriving address from private key: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Circle Paymaster - Get Smart Account Address (v0.8 default, v0.7 legacy)
  server.tool(
    "paymaster_get_account_address",
    "Get your Circle Smart Account address for gasless transfers. v0.8 uses EIP-7702 (default), v0.7 uses Circle Smart Account (legacy, Arbitrum Sepolia only)",
    {
      chainId: z.number().describe("Chain ID (421614 for Arbitrum Sepolia, 84532 for Base Sepolia, etc.)"),
      version: z.enum(["v0.7", "v0.8"]).optional().describe("Paymaster version - v0.8 (default, supports more chains) or v0.7 (legacy, Arbitrum Sepolia only)"),
    },
    async ({ chainId, version = "v0.8" }) => {
      try {
        if (version === "v0.7" && chainId !== 421614) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Circle Paymaster v0.7 only supports Arbitrum Sepolia (421614)",
                recommendation: "Use v0.8 which supports multiple chains: Arbitrum, Base, Ethereum, Avalanche, Optimism, Polygon, Unichain Sepolia"
              }, null, 2)
            }]
          };
        }

        const service = version === "v0.8" ? paymasterV08Service : paymasterService;
        const accountAddress = await service.getAccountAddress(chainId, version);
        const balance = await service.checkUSDCBalance(chainId, undefined, version);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              version,
              chainId,
              smartAccountAddress: accountAddress,
              currentBalance: balance,
              accountType: version === "v0.8" ? "EIP-7702 Smart Account" : "Circle Smart Account",
              fundingInstructions: {
                address: accountAddress,
                faucetUrl: "https://faucet.circle.com",
                notes: [
                  `This is your ${version === "v0.8" ? "EIP-7702" : "Circle"} Smart Account address (not your EOA)`,
                  "You need USDC in this smart account to pay for gas fees",
                  "Fund this address with USDC using the Circle faucet",
                  "Minimum recommended: 5 USDC for multiple gasless transfers"
                ]
              },
              supportedChains: version === "v0.8" ? 
                "Arbitrum, Base, Ethereum, Avalanche, Optimism, Polygon, Unichain Sepolia" :
                "Arbitrum Sepolia only"
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error getting account address'
            }, null, 2)
          }]
        };
      }
    }
  );

  // Circle Paymaster - Gasless USDC transfers (v0.8 default, v0.7 legacy)
  server.tool(
    "paymaster_send_usdc",
    "Send USDC using Circle Paymaster (gasless transaction - gas fees paid in USDC). v0.8 supports multiple chains with EIP-7702, v0.7 is legacy. NOTE: Get your smart account address first and fund it with USDC.",
    {
      chainId: z.number().describe("Chain ID (421614=Arbitrum, 84532=Base, 11155111=Ethereum, 43113=Avalanche, 11155420=Optimism, 80002=Polygon, 1301=Unichain Sepolia)"),
      recipientAddress: z.string().describe("Recipient wallet address (0x...)"),
      amount: z.string().describe("Amount of USDC to send (e.g., '10.50' for $10.50)"),
      version: z.enum(["v0.7", "v0.8"]).optional().describe("Paymaster version - v0.8 (default, multi-chain) or v0.7 (legacy, Arbitrum only)"),
    },
    async ({ chainId, recipientAddress, amount, version = "v0.8" }) => {
      try {
        if (version === "v0.7" && chainId !== 421614) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Circle Paymaster v0.7 only supports Arbitrum Sepolia (421614)",
                recommendation: "Use v0.8 (default) which supports multiple testnets",
                supportedChainsV08: "Arbitrum, Base, Ethereum, Avalanche, Optimism, Polygon, Unichain Sepolia"
              }, null, 2)
            }]
          };
        }

        const service = version === "v0.8" ? paymasterV08Service : paymasterService;
        
        // Check balance first
        const balance = await service.checkUSDCBalance(chainId, undefined, version);
        const accountAddress = await service.getAccountAddress(chainId, version);
        
        if (parseFloat(balance) < parseFloat(amount)) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Insufficient USDC balance in Smart Account",
                currentBalance: balance,
                requiredAmount: amount,
                smartAccountAddress: accountAddress,
                version,
                accountType: version === "v0.8" ? "EIP-7702 Smart Account" : "Circle Smart Account",
                instructions: [
                  "Fund your Smart Account with USDC first",
                  `Smart Account Address: ${accountAddress}`,
                  "Faucet: https://faucet.circle.com",
                  "Then try the transfer again"
                ]
              }, null, 2)
            }]
          };
        }

        // Execute transfer
        const result = await service.executeGaslessTransfer({
          chainId,
          recipientAddress: recipientAddress as Address,
          amount,
          version,
        });

        if (result.success) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: result.message,
                version,
                accountType: version === "v0.8" ? "EIP-7702 Smart Account" : "Circle Smart Account",
                gaslessTransfer: true,
                details: {
                  from: accountAddress,
                  to: recipientAddress,
                  amount: `${amount} USDC`,
                  chainId: chainId,
                  gasPaidWith: "USDC",
                  noETHRequired: true,
                },
                transactionHash: 'transactionHash' in result ? result.transactionHash : undefined,
                userOperationHash: 'userOperationHash' in result ? result.userOperationHash : undefined,
                note: "Gas fees automatically deducted from USDC balance!"
              }, null, 2)
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `Error preparing gasless transfer: ${result.message}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error with Circle Paymaster: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    "paymaster_check_balance",
    "Check USDC balance for Circle Smart Account (used for gasless transfers)",
    {
      chainId: z.number().describe("Chain ID to check balance on"),
      accountAddress: z.string().optional().describe("Account address to check (optional, defaults to your Circle Smart Account)"),
    },
    async ({ chainId, accountAddress }) => {
      try {
        const balance = await paymasterService.checkUSDCBalance(
          chainId, 
          accountAddress as Address | undefined
        );

        const targetAddress = accountAddress || (await paymasterService.getAccountAddress(chainId));
        const balanceFloat = parseFloat(balance);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              balance: `${balance} USDC`,
              address: targetAddress,
              chainId: chainId,
              canUsePaymaster: balanceFloat > 0,
              minimumForGas: "~0.50 USDC",
              status: balanceFloat > 1 ? 
                "✅ Excellent balance for gasless transfers!" : 
                balanceFloat > 0.5 ? 
                "✅ Sufficient balance for gasless transfers!" :
                balanceFloat > 0 ?
                "⚠️ Low balance - may need more USDC for gas fees" :
                "❌ No USDC - account needs funding",
              fundingInstructions: balanceFloat < 1 ? {
                smartAccountAddress: targetAddress,
                faucetUrl: "https://faucet.circle.com",
                recommendedAmount: "5 USDC",
                note: "Fund this Smart Account address (not your EOA) with USDC"
              } : undefined
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error checking paymaster balance: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    "paymaster_get_supported_chains",
    "Get list of chains supported by Circle Paymaster v0.7",
    {},
    async () => {
      try {
        const supportedChains = paymasterService.getSupportedChains();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              supportedChains: supportedChains.map(chain => ({
                name: chain.name,
                chainId: chain.chainId,
                paymasterAddress: chain.paymasterAddress,
                usdcAddress: chain.usdcAddress,
                gaslessTransfers: true,
              })),
              totalChains: supportedChains.length,
              benefits: [
                "No ETH required for gas fees",
                "Gas automatically paid from USDC balance", 
                "Seamless user experience",
                "Powered by Circle Paymaster v0.7"
              ]
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting supported chains: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );


}
