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

Circle Paymaster enables gasless USDC transactions where users pay gas fees in USDC instead of native tokens (ETH). **Two versions are available with different capabilities:**

### 🆕 Circle Paymaster v0.8 (Recommended)
**EIP-7702 Smart Accounts - The Future of Gasless Transactions**

#### Key Features:
- ✅ **EIP-7702 Technology**: Your EOA gets smart contract capabilities
- ✅ **Same Address**: Smart Account uses your existing EOA address
- ✅ **7 Testnets Supported**: Multi-chain gasless transactions
- ✅ **Better Performance**: Optimized gas usage and faster execution
- ✅ **Future-Proof**: Latest Circle technology

#### Supported Networks (v0.8):
| Network | Chain ID | Status |
|---------|----------|---------|
| **Arbitrum Sepolia** | 421614 | ✅ |
| **Base Sepolia** | 84532 | ✅ |
| **Ethereum Sepolia** | 11155111 | ✅ |
| **Avalanche Fuji** | 43113 | ✅ |
| **Optimism Sepolia** | 11155420 | ✅ |
| **Polygon Amoy** | 80002 | ✅ |
| **Unichain Sepolia** | 1301 | ✅ |

### 🔒 Circle Paymaster v0.7 (Legacy)
**Circle Smart Accounts - Original Implementation**

#### Key Features:
- ⚠️ **Circle Smart Account**: Separate smart contract wallet
- ⚠️ **Different Address**: Smart Account has different address than EOA
- ⚠️ **Single Chain**: Only Arbitrum Sepolia supported
- ⚠️ **Legacy Technology**: Older Circle implementation
- ⚠️ **Complex Setup**: Requires EIP-4337 bundler integration

#### Supported Networks (v0.7):
| Network | Chain ID | Status |
|---------|----------|---------|
| **Arbitrum Sepolia** | 421614 | ⚠️ Legacy Only |

### Gasless Transaction Tools

#### `paymaster_get_account_address`
**Get your Circle Smart Account address for funding**

```typescript
// Get EIP-7702 account address (v0.8) - RECOMMENDED
{
  "name": "paymaster_get_account_address",
  "arguments": {
    "chainId": 84532,           // Base Sepolia
    "version": "v0.8"           // Uses your EOA address directly!
  }
}

// Get Circle Smart Account address (v0.7) - LEGACY
{
  "name": "paymaster_get_account_address", 
  "arguments": {
    "chainId": 421614,          // Arbitrum Sepolia only
    "version": "v0.7"           // Creates separate smart contract
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
// Check v0.8 balance (recommended)
{
  "name": "paymaster_check_balance",
  "arguments": {
    "chainId": 84532,           // Any of 7 supported chains
    "version": "v0.8"
  }
}

// Check v0.7 balance (legacy)
{
  "name": "paymaster_check_balance",
  "arguments": {
    "chainId": 421614,          // Arbitrum Sepolia only
    "version": "v0.7"
  }
}
```

#### `paymaster_send_usdc`
**Send gasless USDC transfers (recipient pays zero gas)**

```typescript
// Send gaslessly with v0.8 (recommended)
{
  "name": "paymaster_send_usdc",
  "arguments": {
    "chainId": 84532,           // Base Sepolia
    "recipientAddress": "0x8879318091671ba1274e751f8cDEF76bb37eb3eD",
    "amount": "5.0",
    "version": "v0.8"           // EIP-7702 Smart Account
  }
}

// Send gaslessly with v0.7 (legacy)
{
  "name": "paymaster_send_usdc",
  "arguments": {
    "chainId": 421614,          // Arbitrum Sepolia only
    "recipientAddress": "0x8879318091671ba1274e751f8cDEF76bb37eb3eD",
    "amount": "5.0", 
    "version": "v0.7"           // Circle Smart Account + EIP-4337
  }
}
```

**v0.8 Flow (Recommended):**
1. User pays gas in USDC (not ETH)
2. Uses EIP-7702 to add smart contract functionality to EOA
3. Recipient receives USDC without paying any gas
4. Perfect onboarding experience across 7 chains

**v0.7 Flow (Legacy):**
1. User signs EIP-2612 permit for paymaster to spend USDC
2. Creates EIP-4337 User Operation via bundler
3. Paymaster pays gas in ETH, deducts equivalent USDC
4. Only works on Arbitrum Sepolia

#### `paymaster_get_supported_chains`
**Get chains supported by Circle Paymaster**

```typescript
// Get v0.8 supported chains (7 testnets) - RECOMMENDED
{
  "name": "paymaster_get_supported_chains",
  "arguments": {
    "version": "v0.8"
  }
}

// Get v0.7 supported chains (1 testnet) - LEGACY
{
  "name": "paymaster_get_supported_chains",
  "arguments": {
    "version": "v0.7"
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

### Circle Paymaster v0.8 (EIP-7702 Smart Accounts) - **RECOMMENDED**

| Network | Chain ID | Paymaster Address | Account Type | Status |
|---------|----------|-------------------|--------------|---------|
| **Arbitrum Sepolia** | 421614 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | EIP-7702 | ✅ |
| **Base Sepolia** | 84532 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | EIP-7702 | ✅ |
| **Ethereum Sepolia** | 11155111 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | EIP-7702 | ✅ |
| **Avalanche Fuji** | 43113 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | EIP-7702 | ✅ |
| **Optimism Sepolia** | 11155420 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | EIP-7702 | ✅ |
| **Polygon Amoy** | 80002 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | EIP-7702 | ✅ |
| **Unichain Sepolia** | 1301 | `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` | EIP-7702 | ✅ |

### Circle Paymaster v0.7 (Circle Smart Accounts) - **LEGACY**

| Network | Chain ID | Paymaster Address | Account Type | Status |
|---------|----------|-------------------|--------------|---------|
| **Arbitrum Sepolia** | 421614 | `0x31BE08D380A21fc740883c0BC434FcFc88740b58` | Circle Smart Account | ⚠️ Legacy |

## 💬 Natural Language Usage

### In Claude Desktop

```
"Transfer 10 USDC from Ethereum Sepolia to Base Sepolia"
```

```
"Send 5 USDC gaslessly to 0x123... on Base Sepolia using Circle Paymaster v0.8"
```

```
"Send 3 USDC gaslessly to 0x123... on Arbitrum Sepolia using Circle Paymaster v0.7"
```

```
"What's my USDC balance on all chains?"
```

```
"Get my Circle Smart Account address for Base Sepolia (v0.8)"
```

```
"Get my Circle Smart Account address for Arbitrum Sepolia (v0.7)"
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

### Circle Paymaster v0.8 (EIP-7702) - **RECOMMENDED**

```
User EOA              Circle Paymaster v0.8         Blockchain
     |                        |                        |
[Add EIP-7702] ----------> [Enable Smart] --------> [Same Address]
     |                        |                        |
[Send USDC] ------------> [Pay Gas in ETH] --------> [Execute Transaction]
     |                        |                        |
[Pay 0 ETH] <------------- [Deduct USDC] <---------- [Transaction Success]
```

**v0.8 Process:**
1. **EIP-7702**: Temporarily adds smart contract functionality to EOA
2. **Same Address**: Uses your existing EOA address (no new account needed)
3. **Multi-Chain**: Works across 7 different testnets
4. **Gas Payment**: Paymaster pays ETH gas, deducts equivalent USDC

### Circle Paymaster v0.7 (EIP-4337) - **LEGACY**

```
User Wallet           Circle Paymaster v0.7          Blockchain
     |                        |                        |
[Sign Permit] ----------> [Receive USDC] --------> [Pay Gas in ETH]
     |                        |                        |
[Send UserOp] ----------> [Bundle & Submit] -----> [Execute Transaction]
     |                        |                        |
[Pay 0 ETH] <------------- [Deduct USDC] <--------- [Transaction Success]
```

**v0.7 Process:**
1. **EIP-2612 Permit**: User signs permit for paymaster to spend USDC
2. **User Operation**: Transaction bundled with paymaster data via EIP-4337
3. **Bundler**: Uses external bundler service (Pimlico) for execution
4. **Gas Payment**: Paymaster pays ETH gas, deducts equivalent USDC

## 🚀 Getting Started

### 1. Fund Your Account

**For CCTP transfers:**
- Fund your EOA with USDC on any supported chain
- Use [Circle Faucet](https://faucet.circle.com)

**For Circle Paymaster v0.8 (Recommended):**
```bash
# Your EOA and Smart Account are the same address!
"Get my Circle Smart Account address for Base Sepolia using v0.8"
# Fund your EOA address directly at https://faucet.circle.com
```

**For Circle Paymaster v0.7 (Legacy):**
```bash
# Smart Account has different address than EOA
"Get my Circle Smart Account address for Arbitrum Sepolia using v0.7"
# Fund the returned Smart Account address at https://faucet.circle.com
```

### 2. Start Transferring

```bash
# Cross-chain transfer
"Send 10 USDC from Base to Arbitrum"

# Gasless transfer with v0.8 (recommended)
"Send 5 USDC gaslessly to 0x123... on Base using v0.8 paymaster"

# Gasless transfer with v0.7 (legacy)
"Send 5 USDC gaslessly to 0x123... on Arbitrum using v0.7 paymaster"
```

## 🔍 Paymaster Version Comparison

| Feature | Circle Paymaster v0.8 | Circle Paymaster v0.7 |
|---------|----------------------|----------------------|
| **Technology** | EIP-7702 Smart Accounts | Circle Smart Account + EIP-4337 |
| **Account Address** | ✅ Same as EOA | ❌ Different from EOA |
| **Supported Chains** | ✅ 7 testnets | ❌ 1 testnet (Arbitrum Sepolia) |
| **Performance** | ✅ Optimized gas usage | ⚠️ Higher gas costs |
| **Setup Complexity** | ✅ Simple | ⚠️ Complex (bundler required) |
| **Future Support** | ✅ Active development | ⚠️ Legacy/maintenance mode |
| **Recommended Use** | ✅ **All new projects** | ⚠️ Legacy support only |

## 💡 Best Practices

1. **Use v0.8 Paymaster**: Better performance, more chains, and future-proof
2. **Use v0.7 Only When**: You specifically need legacy compatibility
3. **Fund Correct Address**: 
   - v0.8: Fund your EOA address directly
   - v0.7: Fund the separate Smart Account address
4. **Check Version Support**: Ensure the chain supports your chosen paymaster version
5. **Test First**: Use testnets to familiarize yourself with the tools

## 🛡️ Security

- Private keys stored locally in `.env` files
- All transactions signed locally using viem
- Circle's audited smart contracts
- Testnet environments for safe experimentation

## 🔗 Resources

- [Circle CCTP Documentation](https://developers.circle.com/stablecoins/docs/cctp-getting-started)
- [Circle Paymaster v0.8 Documentation](https://developers.circle.com/wallets/docs/circle-paymaster-overview)
- [Circle Paymaster v0.7 Documentation](https://developers.circle.com/wallets/docs/circle-paymaster-v0-7)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Circle Developer Hub](https://developers.circle.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [USDC Faucet](https://faucet.circle.com)

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.
