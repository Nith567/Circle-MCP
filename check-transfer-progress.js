const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function checkTransferProgress() {
    console.log('👀 Checking Transfer Progress: Ethereum Sepolia → Arbitrum Sepolia...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client({
        name: "transfer-progress",
        version: "1.0.0"
    }, {
        capabilities: { sampling: {} }
    });

    try {
        await client.connect(transport);
        console.log('✅ Connected to CCTP MCP server\n');

        const walletAddress = '0x8A0d290b2EE35eFde47810CA8fF057e109e4190B';
        
        // Expected initial balances
        const expectedSepolia = 16.7687;
        const expectedArbitrum = 10.0;
        
        console.log('📊 Expected Initial Balances:');
        console.log(`   🔵 Ethereum Sepolia: ${expectedSepolia} USDC`);
        console.log(`   🔴 Arbitrum Sepolia: ${expectedArbitrum} USDC\n`);

        // Check current balances
        console.log('💰 Current Balances:');
        
        const sepoliaBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 11155111,
                address: walletAddress
            }
        });
        const sepoliaData = JSON.parse(sepoliaBalance.content[0].text);
        const currentSepolia = parseFloat(sepoliaData.balance.formatted);
        console.log(`   🔵 Ethereum Sepolia: ${sepoliaData.balance.formatted}`);

        const arbitrumBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 421614,
                address: walletAddress
            }
        });
        const arbitrumData = JSON.parse(arbitrumBalance.content[0].text);
        const currentArbitrum = parseFloat(arbitrumData.balance.formatted);
        console.log(`   🔴 Arbitrum Sepolia: ${arbitrumData.balance.formatted}\n`);

        // Calculate changes
        const sepoliaChange = currentSepolia - expectedSepolia;
        const arbitrumChange = currentArbitrum - expectedArbitrum;

        console.log('📈 Balance Changes:');
        console.log(`   🔵 Sepolia: ${sepoliaChange > 0 ? '+' : ''}${sepoliaChange.toFixed(6)} USDC`);
        console.log(`   🔴 Arbitrum: ${arbitrumChange > 0 ? '+' : ''}${arbitrumChange.toFixed(6)} USDC\n`);

        // Analyze transfer status
        if (sepoliaChange < -0.2) {
            console.log('🔥 DETECTED: USDC was burned on Ethereum Sepolia!');
            console.log(`   💸 Amount burned: ~${Math.abs(sepoliaChange).toFixed(6)} USDC`);
            
            if (arbitrumChange > 0.2) {
                console.log('🏭 DETECTED: USDC was minted on Arbitrum Sepolia!');
                console.log('✅ Transfer completed successfully!');
            } else {
                console.log('⏳ Waiting for USDC to be minted on Arbitrum Sepolia...');
                console.log('💡 This can take 2-5 minutes for CCTP transfers.');
            }
        } else if (sepoliaChange < 0) {
            console.log('🔍 Minor balance change detected on Sepolia');
            console.log('💡 Transfer may be in progress or gas was used for other transactions');
        } else {
            console.log('⏸️  No transfer detected yet');
            console.log('💡 The transfer may not have started or is still processing approvals');
        }

    } catch (error) {
        console.error('❌ Progress check failed:', error.message);
    } finally {
        await client.close();
        process.exit(0);
    }
}

checkTransferProgress().catch(console.error);
