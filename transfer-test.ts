#!/usr/bin/env bun

/**
 * Circle CCTP v2 Cross-Chain Transfer: Base Sepolia → Avalanche Fuji
 * Transfer 0.3 USDC between chains using Circle's CCTP
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Chain IDs for CCTP
const BASE_SEPOLIA = 84532;
const AVALANCHE_FUJI = 43113;

interface ToolResult {
  content: Array<{ text: string; type: string }>;
}

interface CCTPTransferResult {
  success: boolean;
  burnTxHash?: string;
  mintTxHash?: string;
  explorerLinks?: {
    burn?: string;
    mint?: string;
  };
  error?: string;
  recipient?: string;
}

interface BalanceResult {
  balance: {
    formatted: string;
    raw: string;
  };
  address: string;
  chainId: number;
}

async function executeCCTPTransfer(): Promise<void> {
  console.log('🚀 Circle CCTP v2: Cross-Chain USDC Transfer\n');
  console.log('📊 Transfer Details:');
  console.log(`   • Amount: 0.3 USDC`);
  console.log(`   • From: Base Sepolia (Chain ID: ${BASE_SEPOLIA})`);
  console.log(`   • To: Avalanche Fuji (Chain ID: ${AVALANCHE_FUJI})`);
  console.log(`   • Transfer Type: Fast (1000 finality threshold)\n`);

  // Create MCP transport and client
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['run', 'src/index.ts']
  });

  const client = new Client({
    name: 'cctp-transfer-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    // Connect to the MCP server
    await client.connect(transport);

    console.log('✅ Connected to CCTP MCP server');

    // Step 1: Get wallet address
    console.log('\n🔑 Getting wallet address...');
    const addressResult = await client.callTool({
      name: 'get_address_from_private_key',
      arguments: {}
    }) as ToolResult;
    
    const addressData = JSON.parse(addressResult.content[0].text);
    const address: string = addressData.address;
    console.log(`   Wallet: ${address}`);

    // Step 2: Check source balance
    console.log('\n💰 Checking source balance (Base Sepolia)...');
    const sourceBalanceResult = await client.callTool({
      name: 'get_usdc_balance_cctp',
      arguments: { chainId: BASE_SEPOLIA }
    }) as ToolResult;
    
    const sourceBalance: BalanceResult = JSON.parse(sourceBalanceResult.content[0].text);
    console.log(`   Balance: ${sourceBalance.balance.formatted}`);

    // Validate sufficient funds
    const sourceBalanceNum = parseFloat(sourceBalance.balance.formatted.replace(' USDC', ''));
    if (sourceBalanceNum < 0.3) {
      console.log('\n❌ Insufficient USDC balance!');
      console.log(`   Required: 0.3 USDC`);
      console.log(`   Available: ${sourceBalanceNum} USDC`);
      console.log('\n💡 To get test USDC:');
      console.log('   1. Visit https://faucet.circle.com/');
      console.log('   2. Connect your wallet');
      console.log('   3. Request USDC on Base Sepolia');
      return;
    }

    // Step 3: Check destination balance (before)
    console.log('\n💰 Checking destination balance (Avalanche Fuji - before)...');
    const destBeforeResult = await client.callTool({
      name: 'get_usdc_balance_cctp',
      arguments: { chainId: AVALANCHE_FUJI }
    }) as ToolResult;
    
    const destBefore: BalanceResult = JSON.parse(destBeforeResult.content[0].text);
    console.log(`   Balance: ${destBefore.balance.formatted}`);

    // Step 4: Execute the transfer
    console.log('\n🔄 Executing cross-chain transfer...');
    console.log('   ⏳ This process takes ~2-5 minutes:');
    console.log('      1. Burning USDC on Base Sepolia...');
    console.log('      2. Waiting for Circle attestation...');
    console.log('      3. Minting USDC on Avalanche Fuji...');

    const startTime = Date.now();
    
    const transferResult = await client.callTool({
      name: 'cctp_cross_chain_transfer',
      arguments: {
        fromChainId: BASE_SEPOLIA,
        toChainId: AVALANCHE_FUJI,
        recipientAddress: address,
        amount: '0.3',
        transferType: 'fast'
      }
    }) as ToolResult;

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    const transfer: CCTPTransferResult = JSON.parse(transferResult.content[0].text);
    
    if (transfer.success) {
      console.log(`\n✅ Transfer completed in ${duration} seconds!\n`);
      
      console.log('📋 Transaction Details:');
      console.log(`   • Burn TX: ${transfer.burnTxHash}`);
      console.log(`   • Mint TX: ${transfer.mintTxHash}`);
      console.log(`   • Amount: 0.3 USDC`);
      console.log(`   • Recipient: ${address}`);
      
      if (transfer.explorerLinks) {
        console.log('\n🔗 View on Explorers:');
        if (transfer.explorerLinks.burn) {
          console.log(`   • Base Sepolia Burn: ${transfer.explorerLinks.burn}`);
        }
        if (transfer.explorerLinks.mint) {
          console.log(`   • Avalanche Fuji Mint: ${transfer.explorerLinks.mint}`);
        }
      }

      // Step 5: Wait a moment for blockchain to update, then verify final balances
      console.log('\n⏳ Waiting for blockchain to update...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
      
      console.log('\n💰 Checking final balances...');
      
      const sourceAfterResult = await client.callTool({
        name: 'get_usdc_balance_cctp',
        arguments: { chainId: BASE_SEPOLIA }
      }) as ToolResult;
      const sourceAfter: BalanceResult = JSON.parse(sourceAfterResult.content[0].text);
      
      const destAfterResult = await client.callTool({
        name: 'get_usdc_balance_cctp',
        arguments: { chainId: AVALANCHE_FUJI }
      }) as ToolResult;
      const destAfter: BalanceResult = JSON.parse(destAfterResult.content[0].text);

      const sourceChange = parseFloat(sourceAfter.balance.formatted.replace(' USDC', '')) - sourceBalanceNum;
      const destChange = parseFloat(destAfter.balance.formatted.replace(' USDC', '')) - 
                        parseFloat(destBefore.balance.formatted.replace(' USDC', ''));

      console.log(`   Base Sepolia: ${sourceAfter.balance.formatted} (${sourceChange >= 0 ? '+' : ''}${sourceChange.toFixed(6)})`);
      console.log(`   Avalanche Fuji: ${destAfter.balance.formatted} (+${destChange.toFixed(6)})`);
      
      console.log('\n🎉 Cross-chain transfer successful!');
      console.log(`   Transferred 0.3 USDC from Base Sepolia to Avalanche Fuji in ${duration}s`);
      
    } else {
      console.log('\n❌ Transfer failed:');
      console.log(`   Error: ${transfer.error}`);
    }

  } catch (error: any) {
    console.error('\n❌ Transfer failed:', error.message);
    
    if (error.message.includes('PRIVATE_KEY')) {
      console.log('\n💡 Setup required:');
      console.log('   1. Create .env file: echo "PRIVATE_KEY=0x..." > .env');
      console.log('   2. Fund wallet with USDC on Base Sepolia');
      console.log('   3. Run again: bun run transfer-test');
    }
  } finally {
    try {
      await client.close();
    } catch (e) {
      // Ignore close errors
    }
    try {
      await transport.close();
    } catch (e) {
      // Ignore transport close errors
    }
  }
}

// Run the transfer
console.log('Starting CCTP transfer test...\n');
executeCCTPTransfer().catch((error: Error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
