# Circle CCTP MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that enables seamless **USDC-only transactions** across multiple blockchains using Circle's Cross-Chain Transfer Protocol (CCTP) v2 and Circle Paymaster. Perfect for AI agents that need to handle USDC transfers without worrying about native gas tokens.

## 🌟 Circle-Powered Features

### 🔄 Cross-Chain USDC Transfers (CCTP v2)
- **Native USDC**: Real USDC transfers, not bridges or wrapped tokens
- **8 Testnets Supported**: Ethereum, Base, Arbitrum, Avalanche, Sonic, Linea, Worldchain, Unichain Sepolia
- **Fast & Standard Modes**: Choose your transfer speed
- **AI-Friendly**: Simple tool calls for complex cross-chain operations

### ⛽ Gasless USDC Transactions (Circle Paymaster)
- **Pay Gas with USDC**: No ETH required for transactions
- **Two Versions Available**:
  - **v0.8 (Recommended)**: EIP-7702 Smart Accounts, 7 testnets
  - **v0.7 (Legacy)**: Circle Smart Accounts, Arbitrum Sepolia only
- **Perfect UX**: Recipients receive USDC without paying gas fees
- **Account Abstraction**: Modern wallet infrastructure built-in

## 🚀 Quick Start

### Claude Desktop Configuration
Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "circle-cctp": {
      "command": "npx",
      "args": ["-y", "circle-cctp-mcp-server"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## 🛠 Circle CCTP Tools

### Core Cross-Chain Transfer Tools

#### `cctp_cross_chain_transfer`
**Transfer USDC between chains using Circle's native protocol**

```typescript
// Transfer 25 USDC from Ethereum to Base
{
  "name": "cctp_cross_chain_transfer",
  "arguments": {
    "fromChainId": 11155111,    // Ethereum Sepolia
    "toChainId": 84532,         // Base Sepolia
    "recipientAddress": "0x742d35Cc6654B3B5B2F214fB3E6dC8b5b1234567",
    "amount": "25.0",
    "transferType": "fast"      // or "standard"
  }
}
```

**Parameters:**
- `fromChainId`: Source chain ID
- `toChainId`: Destination chain ID  
- `amount`: USDC amount (e.g., "10.5")
- `recipientAddress`: Destination address
- `transferType`: "fast" or "standard" (optional)

#### `get_usdc_balance_cctp`
**Check USDC balance on any supported chain**

```typescript
// Check balance on Arbitrum Sepolia
{
  "name": "get_usdc_balance_cctp",
  "arguments": {
    "chainId": 421614,
    "address": "0x742d35Cc6654B3B5B2F214fB3E6dC8b5b1234567"
  }
}
```

#### `get_supported_chains_cctp`
**Get all chains supported by Circle CCTP**

Returns list of 8 supported testnets with chain IDs and domain mappings.

#### `get_domain_mappings_cctp`
**Get Circle domain mappings for CCTP protocol**

## ⛽ Circle Paymaster Tools

### Gasless Transaction Tools

#### `paymaster_get_account_address`
**Get your Circle Smart Account address for funding**

```typescript
// Get EIP-7702 account address for Base Sepolia
{
  "name": "paymaster_get_account_address",
  "arguments": {
    "chainId": 84532,
    "version": "v0.8"          // or "v0.7" for legacy
  }
}
```

**What it returns:**
- Smart Account address
- Current USDC balance
- Funding instructions
- Account type (EIP-7702 vs Circle Smart Account)

#### `paymaster_check_balance`
**Check USDC balance in your Smart Account**

```typescript
// Check balance in Smart Account
{
  "name": "paymaster_check_balance",
  "arguments": {
    "chainId": 421614,
    "version": "v0.8"
  }
}
```

#### `paymaster_send_usdc`
**Send gasless USDC transfers (recipient pays zero gas)**

```typescript
// Send 5 USDC gaslessly
{
  "name": "paymaster_send_usdc",
  "arguments": {
    "chainId": 421614,
    "recipientAddress": "0x8879318091671ba1274e751f8cDEF76bb37eb3eD",
    "amount": "5.0",
    "version": "v0.8"
  }
}
```

**Flow:**
1. User pays gas in USDC (not ETH)
2. Recipient receives USDC without paying any gas
3. Perfect onboarding experience

#### `paymaster_get_supported_chains`
**Get chains supported by Circle Paymaster**

```typescript
// Get v0.8 supported chains (7 testnets)
{
  "name": "paymaster_get_supported_chains",
  "arguments": {
    "version": "v0.8"
  }
}
```

## 🌐 Supported Networks

### CCTP v2 Cross-Chain Transfers

| Network | Chain ID | Domain | USDC Address | Status |
|---------|----------|---------|--------------|---------|
| **Ethereum Sepolia** | 11155111 | 0 | `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238` | ✅ |
| **Avalanche Fuji** | 43113 | 1 | `0x5425890298aed601595a70AB815c96711a31Bc65` | ✅ |
| **Arbitrum Sepolia** | 421614 | 3 | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | ✅ |
| **Base Sepolia** | 84532 | 6 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | ✅ |
| **Linea Sepolia** | 59144 | 11 | `0xFEce4462D57bD51A6A552365A011b95f0E16d9B7` | ✅ |
| **Sonic Blaze** | 161 | 13 | `0xA4879Fed32Ecbef99399e5cbC247E533421C4eC6` | ✅ |
| **Worldchain Sepolia** | 1666700000 | 14 | `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` | ✅ |
| **Unichain Sepolia** | 1301 | 10 | `0x31d0220469e10c4E71834a79b1f276d740d3768F` | ✅ |

### Circle Paymaster v0.8 (EIP-7702 Smart Accounts)

| Network | Chain ID | Paymaster Address | Status |
|---------|----------|-------------------|---------|
| **Arbitrum Sepolia** | 421614 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | ✅ |
| **Base Sepolia** | 84532 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | ✅ |
| **Ethereum Sepolia** | 11155111 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | ✅ |
| **Avalanche Fuji** | 43113 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | ✅ |
| **Optimism Sepolia** | 11155420 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | ✅ |
| **Polygon Amoy** | 80002 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | ✅ |
| **Unichain Sepolia** | 1301 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | ✅ |

### Circle Paymaster v0.7 (Legacy)

| Network | Chain ID | Paymaster Address | Status |
|---------|----------|-------------------|---------|
| **Arbitrum Sepolia** | 421614 | `0x31BE08D380A21fc740883c0BC434FcFc88740b58` | ⚠️ Legacy |

## 💬 Natural Language Usage

### In Claude Desktop

```
"Transfer 10 USDC from Ethereum Sepolia to Base Sepolia"
```

```
"Send 5 USDC gaslessly to 0x123... on Arbitrum Sepolia using Circle Paymaster"
```

```
"What's my USDC balance on all chains?"
```

```
"Get my Circle Smart Account address for Arbitrum Sepolia so I can fund it"
```

```
"Check if I can send gasless transactions on Base Sepolia"
```

## 🔄 How Circle CCTP Works

Circle's Cross-Chain Transfer Protocol enables native USDC transfers without bridges:

```
Source Chain          Circle API          Destination Chain
     |                     |                        |
[Burn USDC] ---------> [Attestation] ---------> [Mint USDC]
     |                     |                        |
TokenMessenger         Iris API               MessageTransmitter
```

**Process:**
1. **Burn**: USDC burned on source chain via Token Messenger
2. **Attest**: Circle's attestation service signs the burn message  
3. **Mint**: Native USDC minted on destination chain

**Benefits:**
- ✅ Real USDC (not wrapped)
- ✅ 2-5 minute transfers
- ✅ Lower fees than bridges
- ✅ Circle's audited contracts

## ⛽ How Circle Paymaster Works

Circle Paymaster enables USDC-only transactions where users pay gas in USDC:

```
User Wallet           Circle Paymaster           Blockchain
     |                        |                        |
[Sign Permit] ----------> [Receive USDC] --------> [Pay Gas in ETH]
     |                        |                        |
[Send UserOp] ----------> [Bundle & Submit] -----> [Execute Transaction]
     |                        |                        |
[Pay 0 ETH] <------------- [Deduct USDC] <--------- [Transaction Success]
```

**Process:**
1. **EIP-2612 Permit**: User signs permit for paymaster to spend USDC
2. **User Operation**: Transaction bundled with paymaster data
3. **Gas Payment**: Paymaster pays ETH gas, deducts equivalent USDC
4. **Execution**: Transaction executes, user never touches ETH

**Benefits:**
- ✅ Zero ETH required
- ✅ Perfect onboarding UX
- ✅ Recipients pay no gas
- ✅ Multi-chain support

## 🚀 Getting Started

### 1. Fund Your Account

**For CCTP transfers:**
- Fund your EOA with USDC on any supported chain
- Use [Circle Faucet](https://faucet.circle.com)

**For Paymaster gasless transfers:**
```bash
# Get your Smart Account address
"Get my Circle Smart Account address for Arbitrum Sepolia"

# Fund it with USDC at https://faucet.circle.com
# Then send gasless transactions!
```

### 2. Start Transferring

```bash
# Cross-chain transfer
"Send 10 USDC from Base to Arbitrum"

# Gasless transfer  
"Send 5 USDC gaslessly to 0x123... on Base using Circle Paymaster"
```

## 💡 Best Practices

1. **Use v0.8 Paymaster**: Better performance and more chains than v0.7
2. **Fund Smart Accounts**: Ensure your Circle Smart Account has USDC for gasless transfers
3. **Check Balances**: Regular balance checks help track transfers
4. **Consider Speed**: Use "fast" transfers for urgent transactions
5. **Test First**: Use testnets to familiarize yourself with the tools

## 🛡️ Security

- Private keys stored locally in `.env` files
- All transactions signed locally using viem
- Circle's audited smart contracts
- Testnet environments for safe experimentation

## 🔗 Resources

- [Circle CCTP Documentation](https://developers.circle.com/stablecoins/docs/cctp-getting-started)
- [Circle Paymaster Documentation](https://developers.circle.com/wallets/docs/circle-paymaster-overview)
- [Circle Developer Hub](https://developers.circle.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [USDC Faucet](https://faucet.circle.com)

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the Circle ecosystem and AI agent developers who want USDC-only transactions without gas token complexity.**