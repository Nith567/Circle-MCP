const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function monitorBalances() {
    console.log('👀 Monitoring USDC Balances During Transfer...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client({
        name: "balance-monitor",
        version: "1.0.0"
    }, {
        capabilities: { sampling: {} }
    });

    try {
        await client.connect(transport);
        console.log('✅ Connected to CCTP MCP server\n');

        const walletAddress = '0x8A0d290b2EE35eFde47810CA8fF057e109e4190B';
        
        // Monitor balances every 30 seconds
        for (let i = 0; i < 8; i++) {
            console.log(`📊 Balance Check #${i + 1} (${new Date().toLocaleTimeString()})`);
            
            try {
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

                console.log(`   🔵 Sepolia: ${sepoliaData.balance.formatted}`);
                console.log(`   🔴 Fuji: ${fujiData.balance.formatted}`);
                
                // Check if we can detect the burn transaction
                const sepoliaBalance = parseFloat(sepoliaData.balance.formatted);
                if (sepoliaBalance < 17.5) {
                    console.log('   🔥 DETECTED: USDC was burned on Sepolia! Transfer in progress...');
                }
                
                const fujiBalance = parseFloat(fujiData.balance.formatted);
                if (fujiBalance > 2.6) {
                    console.log('   🏭 DETECTED: USDC was minted on Fuji! Transfer completed!');
                    break;
                }
                
            } catch (error) {
                console.log(`   ❌ Error checking balances: ${error.message}`);
            }
            
            if (i < 7) {
                console.log('   ⏳ Waiting 30 seconds...\n');
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        }

        console.log('\n🎉 Monitoring complete!');
        console.log('💡 If the Claude Desktop tool call is still loading, the transfer is progressing normally.');

    } catch (error) {
        console.error('❌ Monitor failed:', error.message);
    } finally {
        await client.close();
        process.exit(0);
    }
}

monitorBalances().catch(console.error);
