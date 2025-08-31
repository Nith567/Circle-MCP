const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function testSepoliaToFujiTransfer() {
    console.log('🚀 Testing CCTP Transfer: 0.12 USDC from Ethereum Sepolia to Avalanche Fuji...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client(
        {
            name: "sepolia-fuji-test",
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

        // Check initial balances
        console.log('💰 Checking initial balances...');
        
        const sepoliaBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 11155111, // Ethereum Sepolia
                address: walletAddress
            }
        });
        console.log(`📊 Sepolia USDC Balance: ${sepoliaBalance.content[0].text}`);

        const fujiBalance = await client.callTool({
            name: 'get_usdc_balance_cctp', 
            arguments: {
                chainId: 43113, // Avalanche Fuji
                address: walletAddress
            }
        });
        console.log(`📊 Fuji USDC Balance: ${fujiBalance.content[0].text}\n`);

        // Execute the transfer
        console.log('🔄 Initiating cross-chain transfer...');
        console.log('   Amount: 0.12 USDC');
        console.log('   From: Ethereum Sepolia (11155111)');
        console.log('   To: Avalanche Fuji (43113)');
        console.log('   Recipient:', walletAddress);
        console.log();

        const transferResult = await client.callTool({
            name: 'cctp_cross_chain_transfer',
            arguments: {
                fromChainId: 11155111,  // Ethereum Sepolia
                toChainId: 43113,       // Avalanche Fuji  
                amount: '0.12',           // 0.12 USDC
                recipientAddress: walletAddress
            }
        });

        console.log('✅ Transfer completed!');
        console.log('📋 Result:', transferResult.content[0].text);

        // Wait a moment then check final balances
        console.log('\n⏳ Waiting 30 seconds before checking final balances...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        const finalSepoliaBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 11155111,
                address: walletAddress
            }
        });
        console.log(`📊 Final Sepolia Balance: ${finalSepoliaBalance.content[0].text}`);

        const finalFujiBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 43113, 
                address: walletAddress
            }
        });
        console.log(`📊 Final Fuji Balance: ${finalFujiBalance.content[0].text}`);

        console.log('\n🎉 Cross-chain transfer test completed successfully!');

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

testSepoliaToFujiTransfer().catch(console.error);
