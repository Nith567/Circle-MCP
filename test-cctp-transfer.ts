#!/usr/bin/env bun

/**
 * Test script for Circle CCTP v2 cross-chain USDC transfer
 * Transfer 0.3 USDC from Base Sepolia to Avalanche Fuji
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Chain IDs
const BASE_SEPOLIA = 84532;
const AVALANCHE_FUJI = 43113;

interface ToolResult {
  content: Array<{ text: string; type: string }>;
}

async function testCCTPTransfer() {
  console.log('🚀 Circle CCTP v2: Base Sepolia → Avalanche Fuji Transfer\n');
  console.log('📊 Transfer Details:');
  console.log(`   • Amount: 0.3 USDC`);
  console.log(`   • From: Base Sepolia (Chain ID: ${BASE_SEPOLIA})`);
  console.log(`   • To: Avalanche Fuji (Chain ID: ${AVALANCHE_FUJI})`);
  console.log(`   • Transfer Type: Fast\n`);

  // Start the MCP server
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
    await client.connect(transport);
    console.log('✅ Connected to CCTP MCP server\n');

    // Step 1: Get wallet address
    console.log('🔑 Getting wallet address...');
    const addressResult = await client.callTool({
      name: 'get_address_from_private_key',
      arguments: {}
    }) as ToolResult;
    const address = JSON.parse(addressResult.content[0].text).address;
    console.log(`Wallet Address: ${address}\n`);

    // Step 2: Check USDC balance on Base Sepolia (source chain)
    console.log('💰 Checking USDC balance on Base Sepolia (source)...');
    const sourceBalanceResult = await client.callTool({
      name: 'get_usdc_balance_cctp',
      arguments: {
        chainId: BASE_SEPOLIA
      }
    }) as ToolResult;
    const sourceBalance = JSON.parse(sourceBalanceResult.content[0].text);
    console.log(`Source Balance: ${sourceBalance.balance.formatted}`);

    // Check if sufficient balance
    const sourceBalanceNum = parseFloat(sourceBalance.balance.formatted.replace(' USDC', ''));
    if (sourceBalanceNum < 0.3) {
      console.log('❌ Insufficient USDC balance on Base Sepolia');
      console.log(`   Required: 0.3 USDC, Available: ${sourceBalanceNum} USDC`);
      console.log('   Please fund your wallet with USDC on Base Sepolia first.');
      return;
    }

    // Step 3: Check USDC balance on Avalanche Fuji (destination chain) - before transfer
    console.log('💰 Checking USDC balance on Avalanche Fuji (destination - before)...');
    const destBalanceBeforeResult = await client.callTool({
      name: 'get_usdc_balance_cctp',
      arguments: {
        chainId: AVALANCHE_FUJI
      }
    }) as ToolResult;
    const destBalanceBefore = JSON.parse(destBalanceBeforeResult.content[0].text);
    console.log(`Destination Balance (before): ${destBalanceBefore.balance.formatted}\n`);

    // Step 4: Execute the cross-chain transfer
    console.log('🔄 Executing cross-chain USDC transfer...');
    console.log('   This will:');
    console.log('   1. Burn 0.3 USDC on Base Sepolia');
    console.log('   2. Wait for Circle attestation');
    console.log('   3. Mint 0.3 USDC on Avalanche Fuji\n');

    const transferResult = await client.callTool({
      name: 'cctp_cross_chain_transfer',
      arguments: {
        fromChainId: BASE_SEPOLIA,
        toChainId: AVALANCHE_FUJI,
        recipientAddress: address, // Send to same wallet
        amount: '0.3',
        transferType: 'fast'
      }
    }) as ToolResult;

    const transfer = JSON.parse(transferResult.content[0].text);
    
    if (transfer.success) {
      console.log('✅ Cross-chain transfer completed successfully!\n');
      console.log('📋 Transaction Details:');
      console.log(`   • Burn TX Hash: ${transfer.burnTxHash}`);
      console.log(`   • Mint TX Hash: ${transfer.mintTxHash}`);
      console.log(`   • Amount: 0.3 USDC`);
      console.log(`   • Recipient: ${transfer.recipient}\n`);
      
      console.log('🔗 Explorer Links:');
      if (transfer.explorerLinks?.burn) {
        console.log(`   • Burn TX: ${transfer.explorerLinks.burn}`);
      }
      if (transfer.explorerLinks?.mint) {
        console.log(`   • Mint TX: ${transfer.explorerLinks.mint}`);
      }
      console.log();

      // Step 5: Check balances after transfer
      console.log('💰 Checking balances after transfer...');
      
      // Source chain balance (should be reduced)
      const sourceBalanceAfterResult = await client.callTool({
        name: 'get_usdc_balance_cctp',
        arguments: {
          chainId: BASE_SEPOLIA
        }
      }) as ToolResult;
      const sourceBalanceAfter = JSON.parse(sourceBalanceAfterResult.content[0].text);
      console.log(`Base Sepolia (after): ${sourceBalanceAfter.balance.formatted}`);

      // Destination chain balance (should be increased)
      const destBalanceAfterResult = await client.callTool({
        name: 'get_usdc_balance_cctp',
        arguments: {
          chainId: AVALANCHE_FUJI
        }
      }) as ToolResult;
      const destBalanceAfter = JSON.parse(destBalanceAfterResult.content[0].text);
      console.log(`Avalanche Fuji (after): ${destBalanceAfter.balance.formatted}\n`);

      // Calculate changes
      const sourceChange = parseFloat(sourceBalanceAfter.balance.formatted.replace(' USDC', '')) - 
                          parseFloat(sourceBalance.balance.formatted.replace(' USDC', ''));
      const destChange = parseFloat(destBalanceAfter.balance.formatted.replace(' USDC', '')) - 
                        parseFloat(destBalanceBefore.balance.formatted.replace(' USDC', ''));

      console.log('📊 Balance Changes:');
      console.log(`   • Base Sepolia: ${sourceChange >= 0 ? '+' : ''}${sourceChange.toFixed(6)} USDC`);
      console.log(`   • Avalanche Fuji: ${destChange >= 0 ? '+' : ''}${destChange.toFixed(6)} USDC`);
      console.log(`   • Net Change: ${(sourceChange + destChange).toFixed(6)} USDC (should be ~0 minus fees)\n`);

      console.log('🎉 Cross-chain transfer completed successfully!');
      
    } else {
      console.log('❌ Cross-chain transfer failed:');
      console.log(`   Error: ${transfer.error}\n`);
    }

  } catch (error: any) {
    console.error('❌ Transfer test failed:', error.message);
    
    if (error.message.includes('Private key not configured')) {
      console.log('\n💡 Setup Instructions:');
      console.log('   1. Create a .env file in the project root');
      console.log('   2. Add your private key: PRIVATE_KEY=0x1234...');
      console.log('   3. Fund your wallet with USDC on Base Sepolia');
      console.log('   4. Run the test again');
    }
  } finally {
    await client.close();
    await transport.close();
  }
}

// Run the transfer test
console.log('Starting CCTP transfer test...\n');
testCCTPTransfer().catch(console.error);
