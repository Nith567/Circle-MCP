#!/usr/bin/env node

/**
 * Circle CCTP v2 Cross-Chain Transfer: Base Sepolia → Avalanche Fuji
 * Transfer 0.3 USDC between chains using Circle's CCTP
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { spawn } from 'child_process';

// Chain IDs
const BASE_SEPOLIA = 84532;
const AVALANCHE_FUJI = 43113;

async function executeCCTPTransfer() {
  console.log('🚀 Circle CCTP v2: Cross-Chain USDC Transfer\n');
  console.log('📊 Transfer Details:');
  console.log(`   • Amount: 0.3 USDC`);
  console.log(`   • From: Base Sepolia (Chain ID: ${BASE_SEPOLIA})`);
  console.log(`   • To: Avalanche Fuji (Chain ID: ${AVALANCHE_FUJI})`);
  console.log(`   • Transfer Type: Fast (1000 finality threshold)\n`);

  // Start the MCP server
  const serverProcess = spawn('bun', ['run', 'src/index.ts'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    cwd: process.cwd()
  });

  const transport = new StdioClientTransport({
    stdin: serverProcess.stdin,
    stdout: serverProcess.stdout
  });

  const client = new Client({
    name: 'cctp-transfer-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to CCTP MCP server');

    // Step 1: Get wallet address
    console.log('\n🔑 Getting wallet address...');
    const addressResult = await client.callTool({
      name: 'get_address_from_private_key',
      arguments: {}
    });
    const address = JSON.parse(addressResult.content[0].text).address;
    console.log(`   Wallet: ${address}`);

    // Step 2: Check source balance
    console.log('\n💰 Checking source balance (Base Sepolia)...');
    const sourceBalanceResult = await client.callTool({
      name: 'get_usdc_balance_cctp',
      arguments: { chainId: BASE_SEPOLIA }
    });
    const sourceBalance = JSON.parse(sourceBalanceResult.content[0].text);
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
    });
    const destBefore = JSON.parse(destBeforeResult.content[0].text);
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
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    const transfer = JSON.parse(transferResult.content[0].text);
    
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

      // Step 5: Verify final balances
      console.log('\n💰 Checking final balances...');
      
      const sourceAfterResult = await client.callTool({
        name: 'get_usdc_balance_cctp',
        arguments: { chainId: BASE_SEPOLIA }
      });
      const sourceAfter = JSON.parse(sourceAfterResult.content[0].text);
      
      const destAfterResult = await client.callTool({
        name: 'get_usdc_balance_cctp',
        arguments: { chainId: AVALANCHE_FUJI }
      });
      const destAfter = JSON.parse(destAfterResult.content[0].text);

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

  } catch (error) {
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
    serverProcess.kill();
  }
}

// Run the transfer
console.log('Starting CCTP transfer test...\n');
executeCCTPTransfer().catch(console.error);
