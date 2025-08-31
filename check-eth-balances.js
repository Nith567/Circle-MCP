const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function checkETHBalances() {
    console.log('⛽ Checking ETH Balances for CCTP Transfers...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client({
        name: "eth-balance-checker",
        version: "1.0.0"
    }, {
        capabilities: { sampling: {} }
    });

    try {
        await client.connect(transport);
        console.log('✅ Connected to MCP server\n');

        const walletAddress = '0x8A0d290b2EE35eFde47810CA8fF057e109e4190B';
        
        console.log('💰 Checking ETH balances on CCTP chains...\n');

        // Check ETH on Ethereum Sepolia
        const sepoliaETH = await client.callTool({
            name: 'get_balance',
            arguments: {
                address: walletAddress,
                network: 'sepolia'
            }
        });
        console.log('🔵 Ethereum Sepolia ETH:', JSON.parse(sepoliaETH.content[0].text).balance);

        // Check AVAX on Avalanche Fuji  
        const fujiAVAX = await client.callTool({
            name: 'get_balance',
            arguments: {
                address: walletAddress,
                network: 'avalanche-fuji'
            }
        });
        console.log('🔴 Avalanche Fuji AVAX:', JSON.parse(fujiAVAX.content[0].text).balance);

        console.log('\n⛽ Gas Requirements for CCTP:');
        console.log('📤 Source Chain (Sepolia): ~0.01-0.02 ETH');
        console.log('   • USDC Approval: ~0.005 ETH');
        console.log('   • Burn Transaction: ~0.01 ETH');
        console.log('📥 Destination Chain (Fuji): ~0.01 AVAX');
        console.log('   • Mint Transaction: ~0.01 AVAX');

        console.log('\n💡 Why you need gas on both chains:');
        console.log('1. 🔥 Sepolia ETH: Pay for approval + burn transaction');
        console.log('2. 🏭 Fuji AVAX: Pay for mint transaction');
        console.log('3. 🤖 CCTP is automated but needs gas on destination');

        console.log('\n🎯 Your current status:');
        const sepoliaBalance = parseFloat(JSON.parse(sepoliaETH.content[0].text).balance);
        const fujiBalance = parseFloat(JSON.parse(fujiAVAX.content[0].text).balance);

        if (sepoliaBalance > 0.02) {
            console.log('✅ Sepolia ETH: Sufficient for transfers');
        } else {
            console.log('⚠️  Sepolia ETH: Low balance, get more from faucet');
        }

        if (fujiBalance > 0.01) {
            console.log('✅ Fuji AVAX: Sufficient for transfers');
        } else {
            console.log('⚠️  Fuji AVAX: Low balance, get more from faucet');
        }

        console.log('\n🚰 Testnet Faucets:');
        console.log('• Sepolia ETH: https://sepoliafaucet.com/');
        console.log('• Fuji AVAX: https://faucet.avax.network/');

    } catch (error) {
        console.error('❌ Balance check failed:', error.message);
    } finally {
        await client.close();
        process.exit(0);
    }
}

checkETHBalances().catch(console.error);
