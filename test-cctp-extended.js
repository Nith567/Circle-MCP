const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function testCCTPWithLongerTimeout() {
    console.log('🚀 Testing CCTP Transfer with Extended Timeout...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    // Create client with longer timeout
    const client = new Client(
        {
            name: "cctp-long-timeout-test",
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

        // Check balance first
        console.log('💰 Checking current balances...');
        const sepoliaBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 11155111,
                address: walletAddress
            }
        });
        const sepoliaData = JSON.parse(sepoliaBalance.content[0].text);
        console.log(`📊 Sepolia Balance: ${sepoliaData.balance.formatted}`);

        // Test smaller amount first (0.01 USDC) to see if it works at all
        console.log('\n🧪 Testing with small amount first (0.01 USDC)...');
        
        try {
            const smallTransferResult = await Promise.race([
                client.callTool({
                    name: 'cctp_cross_chain_transfer',
                    arguments: {
                        fromChainId: 11155111,
                        toChainId: 43113,
                        amount: '0.01',
                        recipientAddress: walletAddress
                    }
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Custom timeout after 3 minutes')), 180000)
                )
            ]);

            console.log('✅ Small transfer succeeded!');
            const result = JSON.parse(smallTransferResult.content[0].text);
            console.log(`🔥 Burn Tx: ${result.burnTxHash}`);
            console.log(`🏭 Mint Tx: ${result.mintTxHash}`);
            
        } catch (error) {
            if (error.message.includes('Custom timeout')) {
                console.log('⏰ Transfer is taking longer than 3 minutes (this is normal for CCTP)');
                console.log('💡 The transfer may still complete. Check your balance later.');
            } else {
                console.log('❌ Small transfer failed:', error.message);
            }
        }

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    } finally {
        await client.close();
    }
}

// Also create a balance checker
async function checkBalancesOnly() {
    console.log('\n📊 Balance Check Only...');
    
    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client({
        name: "balance-checker",
        version: "1.0.0"
    }, {
        capabilities: { sampling: {} }
    });

    try {
        await client.connect(transport);
        
        const walletAddress = '0x8A0d290b2EE35eFde47810CA8fF057e109e4190B';

        const sepolia = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: { chainId: 11155111, address: walletAddress }
        });
        
        const fuji = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: { chainId: 43113, address: walletAddress }
        });

        const sepoliaData = JSON.parse(sepolia.content[0].text);
        const fujiData = JSON.parse(fuji.content[0].text);

        console.log(`✅ Sepolia: ${sepoliaData.balance.formatted}`);
        console.log(`✅ Fuji: ${fujiData.balance.formatted}`);

    } catch (error) {
        console.error('❌ Balance check failed:', error.message);
    } finally {
        await client.close();
    }
}

console.log('🌉 Circle CCTP v2 Extended Test');
console.log('=' .repeat(40));

// Run both tests
testCCTPWithLongerTimeout()
    .then(() => checkBalancesOnly())
    .then(() => {
        console.log('\n💡 To test 0.14 USDC transfer, use Claude Desktop:');
        console.log('   "Transfer 0.14 USDC from Ethereum Sepolia to Avalanche Fuji"');
        process.exit(0);
    })
    .catch(console.error);
