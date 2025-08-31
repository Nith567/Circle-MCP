# Circle CCTP v2 MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that enables seamless cross-chain USDC transfers using Circle's Cross-Chain Transfer Protocol (CCTP) v2. This server provides AI agents and LLM applications with the ability to transfer USDC between multiple blockchains through simple tool calls.

## Features

🔄 **Cross-Chain USDC Transfers**: Transfer USDC between 8 supported chains using Circle's CCTP v2  
⚡ **Fast & Standard Transfers**: Choose between fast (1000 finality) or standard (2000 finality) transfer speeds  
🔗 **Multi-Chain Support**: Ethereum Sepolia, Base Sepolia, Avalanche Fuji, Arbitrum Sepolia, Linea Sepolia, Worldchain Sepolia, Sonic Blaze, and Unichain Sepolia  
💰 **Balance Checking**: Check USDC balances across all supported chains  
🛡️ **Secure**: Uses your private key for transactions (stored locally in .env)  
📊 **Comprehensive Tooling**: Full EVM interaction capabilities including token transfers, balance checks, and contract interactions

## Supported Networks

| Chain | Chain ID | Domain | Status |
| Unichain Sepolia | 1301 | 10 | ✅ Active |
|-------|----------|---------|---------|
| Ethereum Sepolia | 11155111 | 0 | ✅ Active |
| Avalanche Fuji | 43113 | 1 | ✅ Active |
| Arbitrum Sepolia | 421614 | 3 | ✅ Active |
| Base Sepolia | 84532 | 6 | ✅ Active |
| Linea Sepolia | 59144 | 11 | ✅ Active |
| Sonic Blaze | 161 | 13 | ✅ Active |
| Worldchain Sepolia | 1666700000 | 14 | ✅ Active |

## Quick Start

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g @circle-fin/cctp-mcp-server

# Or use with npx (no installation needed)
npx @circle-fin/cctp-mcp-server
```

### Configuration

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "circle-cctp": {
      "command": "npx",
      "args": ["-y", "@circle-fin/cctp-mcp-server"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Available Tools

### Core CCTP Tools

#### `cctp_cross_chain_transfer`
Transfer USDC between supported chains using Circle's CCTP v2.

**Parameters:**
- `fromChainId` (number): Source chain ID (e.g., 11155111 for Ethereum Sepolia)
- `toChainId` (number): Destination chain ID (e.g., 84532 for Base Sepolia)  
- `recipientAddress` (string): Recipient address on destination chain
- `amount` (string): Amount of USDC to transfer (e.g., "10.5")
- `transferType` (optional): "fast" or "standard" (default: "standard")

**Example:**
```json
{
  "name": "cctp_cross_chain_transfer",
  "arguments": {
    "fromChainId": 11155111,
    "toChainId": 84532,
    "recipientAddress": "0x742d35Cc6654B3B5B2F214fB3E6dC8b5b1234567",
    "amount": "25.0",
    "transferType": "fast"
  }
}
```

#### `get_usdc_balance_cctp`
Check USDC balance on any CCTP supported chain.

**Parameters:**
- `address` (optional): Address to check (uses configured private key address if not provided)
- `chainId` (number): Chain ID to check balance on

#### `get_cctp_supported_chains`
Get list of all chains supported by Circle CCTP.

### EVM Tools

#### `get_balance`
Get native token balance (ETH) for an address on any supported chain.

#### `transfer_native`
Transfer native tokens (ETH) to an address.

#### `transfer_erc20`
Transfer ERC20 tokens to another address.

#### `get_erc20_balance` / `get_token_balance`
Get ERC20 token balance for an address.

#### `get_transaction`
Get detailed information about a specific transaction.

#### `get_transaction_receipt`
Get transaction receipt by hash.

#### `get_token_info`
Get comprehensive information about an ERC20 token.

## Circle CCTP Process Flow

1. **Burn Phase**: USDC is burned on the source chain via Token Messenger
2. **Attestation**: Circle's attestation service signs the burn message
3. **Mint Phase**: USDC is minted on destination chain using the attestation

```
Source Chain          Circle API          Destination Chain
     |                     |                        |
[Burn USDC] ---------> [Attestation] ---------> [Mint USDC]
     |                     |                        |
TokenMessenger         Iris API               MessageTransmitter
```

## Example Usage in AI Applications

### Claude/ChatGPT Integration

```typescript
// Transfer 100 USDC from Ethereum Sepolia to Base Sepolia
const transfer = await mcp.callTool({
  name: "cctp_cross_chain_transfer", 
  arguments: {
    fromChainId: 11155111,    // Ethereum Sepolia
    toChainId: 84532,         // Base Sepolia  
    recipientAddress: "0x742d35Cc6654B3B5B2F214fB3E6dC8b5b1234567",
    amount: "100.0",
    transferType: "fast"
  }
});
```

### Check USDC Balances

```typescript
// Check USDC balance on multiple chains
const chains = [11155111, 84532, 43113]; // ETH, Base, Avalanche
for (const chainId of chains) {
  const balance = await mcp.callTool({
    name: "get_usdc_balance_cctp",
    arguments: { chainId }
  });
  console.log(`Chain ${chainId}: ${balance.balance.formatted}`);
}
```

## Development

### Building

```bash
bun run build
```

### Testing

```bash
# Run all tests
bun test

# Test specific functionality
bun run test-cctp.js
```

### Project Structure

```
src/
├── core/
│   ├── chains.ts          # Chain configurations and CCTP constants
│   ├── config.ts          # Environment configuration
│   ├── tools.ts           # MCP tool definitions
│   ├── resources.ts       # MCP resource definitions
│   └── services/
│       ├── cctp.ts        # Circle CCTP service implementation
│       ├── balance.ts     # Balance checking services
│       ├── transfer.ts    # Transfer services
│       └── ...
├── server/
│   ├── server.ts          # MCP server implementation
│   └── http-server.ts     # HTTP wrapper
└── index.ts               # Main entry point
```

## Security Considerations

- Private keys are stored locally in `.env` files
- All transactions are signed locally using viem
- Circle CCTP uses their audited smart contracts
- Testnet environments for safe testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [Circle CCTP Documentation](https://developers.circle.com/stablecoins/cctp)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Circle Developer Hub](https://developers.circle.com)
