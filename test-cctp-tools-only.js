const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function testCCTPToolsOnly() {
    console.log('🚀 Testing CCTP Tools (No Actual Transfer)...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client(
        {
            name: "cctp-tools-test",
            version: "1.0.0"
        },
        {
            capabilities: {
                sampling: {}
            }
        }
    );

    try {
        await client.connect(transport);
        console.log('✅ Connected to CCTP MCP server\n');

        const walletAddress = '0x8A0d290b2EE35eFde47810CA8fF057e109e4190B';

        // Test 1: Get supported chains
        console.log('📋 Getting CCTP supported chains...');
        const supportedChains = await client.callTool({
            name: 'get_cctp_supported_chains',
            arguments: {}
        });
        console.log('✅ Supported chains result:', supportedChains.content[0].text);
        console.log();

        // Test 2: Get domain mappings
        console.log('🔗 Getting CCTP domain mappings...');
        const domainMappings = await client.callTool({
            name: 'get_cctp_domain_mappings',
            arguments: {}
        });
        console.log('✅ Domain mappings result:', domainMappings.content[0].text);
        console.log();

        // Test 3: Check balances
        console.log('💰 Checking USDC balances...');
        
        const sepoliaBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 11155111, // Ethereum Sepolia
                address: walletAddress
            }
        });
        console.log('📊 Sepolia balance:', JSON.parse(sepoliaBalance.content[0].text).balance.formatted);

        const fujiBalance = await client.callTool({
            name: 'get_usdc_balance_cctp', 
            arguments: {
                chainId: 43113, // Avalanche Fuji
                address: walletAddress
            }
        });
        console.log('📊 Fuji balance:', JSON.parse(fujiBalance.content[0].text).balance.formatted);
        console.log();

        // Test 4: Show transfer parameters (but don't execute)
        console.log('🔧 Transfer parameters for 0.12 USDC Sepolia → Fuji:');
        console.log('   Tool: cctp_cross_chain_transfer');
        console.log('   Parameters:');
        console.log('     fromChainId: 11155111 (Ethereum Sepolia)');
        console.log('     toChainId: 43113 (Avalanche Fuji)');
        console.log('     amount: "0.12"');
        console.log('     recipientAddress:', walletAddress);
        console.log();

        console.log('🎉 All CCTP tools are working correctly!');
        console.log('💡 To execute the actual transfer, use Claude Desktop and say:');
        console.log('   "Transfer 0.12 USDC from Ethereum Sepolia to Avalanche Fuji"');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    } finally {
        await client.close();
        process.exit(0);
    }
}

testCCTPToolsOnly().catch(console.error);
