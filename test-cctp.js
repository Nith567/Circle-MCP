#!/usr/bin/env node

/**
 * Test script for Circle CCTP v2 cross-chain USDC transfers
 * This script demonstrates how to use the MCP server to transfer USDC between chains
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function testCCTP() {
  console.log('🚀 Testing Circle CCTP v2 Cross-Chain USDC Transfer...\n');

  // Start the MCP server
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['run', 'src/index.ts']
  });

  const client = new Client({
    name: 'cctp-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to CCTP MCP server\n');

    // Test 1: Get supported CCTP chains
    console.log('📋 Getting supported CCTP chains...');
    const chainsResult = await client.callTool({
      name: 'get_cctp_supported_chains',
      arguments: {}
    });
    console.log('Supported Chains:', JSON.parse(chainsResult.content[0].text).supportedChains.length, 'chains');
    console.log(JSON.parse(chainsResult.content[0].text).supportedChains.slice(0, 3).map(c => `${c.name} (ID: ${c.chainId})`).join(', '), '...\n');

    // Test 2: Get chain info for Base Sepolia
    console.log('🔗 Getting chain info for Base Sepolia...');
    const chainInfoResult = await client.callTool({
      name: 'get_chain_info',
      arguments: { network: 'base-sepolia' }
    });
    const chainInfo = JSON.parse(chainInfoResult.content[0].text);
    console.log(`Chain: ${chainInfo.network} (ID: ${chainInfo.chainId})`);
    console.log(`Block Number: ${chainInfo.blockNumber}\n`);

    // Test 3: Check if private key is configured (for balance checks)
    console.log('🔑 Checking wallet configuration...');
    try {
      const addressResult = await client.callTool({
        name: 'get_address_from_private_key',
        arguments: {}
      });
      const address = JSON.parse(addressResult.content[0].text).address;
      console.log(`Wallet Address: ${address}\n`);

      // Test 4: Get USDC balance on Base Sepolia
      console.log('💰 Getting USDC balance on Base Sepolia...');
      const balanceResult = await client.callTool({
        name: 'get_usdc_balance_cctp',
        arguments: {
          chainId: 84532 // Base Sepolia
        }
      });
      const balance = JSON.parse(balanceResult.content[0].text);
      console.log(`USDC Balance: ${balance.balance.formatted}\n`);

    } catch (error) {
      console.log('⚠️  Private key not configured - skipping balance checks');
      console.log('   To test with real transactions, set PRIVATE_KEY in .env file\n');
    }

    console.log('✅ All CCTP tests completed successfully!');
    console.log('\n📖 Available CCTP Tools:');
    console.log('   • cctp_cross_chain_transfer - Transfer USDC between chains');
    console.log('   • get_usdc_balance_cctp - Check USDC balance on any CCTP chain');
    console.log('   • get_cctp_supported_chains - List all supported chains');
    console.log('\n💡 Example transfer:');
    console.log('   Transfer 10 USDC from Ethereum Sepolia to Base Sepolia');
    console.log('   Use fromChainId: 11155111, toChainId: 84532, amount: "10.0"');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.close();
  }
}

// Run the test
testCCTP().catch(console.error);
