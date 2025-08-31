const { StdioClientTransport, Client } = require('@modelcontextprotocol/sdk/client/index.js');
require('dotenv').config();

async function testTransferCall() {
    console.log('🚀 Testing CCTP Cross-Chain Transfer Tool Call...\n');

    // Connect to MCP server
    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client(
        {
            name: "cctp-test-client",
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

        // Test with small amount (0.01 USDC)
        console.log('💸 Testing cross-chain transfer: 0.01 USDC from Base Sepolia to Avalanche Fuji...');
        
        const transferResult = await client.callTool({
            name: 'cctp_cross_chain_transfer',
            arguments: {
                fromChainId: '84532',     // Base Sepolia
                toChainId: '43113',       // Avalanche Fuji
                amount: '0.01',           // Small test amount
                recipientAddress: '0x8A0d290b2EE35eFde47810CA8fF057e109e4190B' // Same wallet
            }
        });

        console.log('✅ Transfer result:', transferResult.content);

    } catch (error) {
        console.log('❌ Error:', error.message);
        
        // Also test balance check which should work
        try {
            console.log('\n🔍 Testing balance check as fallback...');
            const balanceResult = await client.callTool({
                name: 'get_usdc_balance_cctp',
                arguments: {
                    chainId: '84532',
                    address: '0x8A0d290b2EE35eFde47810CA8fF057e109e4190B'
                }
            });
            console.log('✅ Balance check result:', balanceResult.content);
        } catch (balanceError) {
            console.log('❌ Balance check error:', balanceError.message);
        }
    } finally {
        await client.close();
        process.exit(0);
    }
}

testTransferCall().catch(console.error);
