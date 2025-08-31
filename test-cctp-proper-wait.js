const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function testCCTPTransferWithProperWait() {
    console.log('🚀 Testing CCTP Transfer: 0.3 USDC from Ethereum Sepolia to Arbitrum Sepolia...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client(
        {
            name: "cctp-proper-wait-test",
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
        
        const initialEthBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: { chainId: 11155111, address: walletAddress }
        });
        const initialEthData = JSON.parse(initialEthBalance.content[0].text);
        console.log(`📊 Ethereum Sepolia: ${initialEthData.balance.formatted}`);

        const initialArbBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: { chainId: 421614, address: walletAddress }
        });
        const initialArbData = JSON.parse(initialArbBalance.content[0].text);
        console.log(`📊 Arbitrum Sepolia: ${initialArbData.balance.formatted}\n`);

        // Start the transfer with a VERY long timeout (15 minutes)
        console.log('🔄 Starting transfer with 15-minute timeout...');
        console.log('💡 This will either complete successfully or actually crash if there\'s a real error\n');

        const transferStartTime = Date.now();

        try {
            // Create a promise that will wait up to 15 minutes
            const transferResult = await Promise.race([
                client.callTool({
                    name: 'cctp_cross_chain_transfer',
                    arguments: {
                        fromChainId: 11155111,
                        toChainId: 421614,
                        amount: '0.3',
                        recipientAddress: walletAddress
                    }
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('15 minute timeout - something is seriously wrong')), 900000)
                )
            ]);

            const transferTime = Math.round((Date.now() - transferStartTime) / 1000);
            console.log(`\n🎉 TRANSFER COMPLETED in ${transferTime} seconds!`);
            
            const transferData = JSON.parse(transferResult.content[0].text);
            console.log('📋 Transfer Details:');
            console.log(`   🔥 Burn Tx: ${transferData.burnTxHash}`);
            console.log(`   🏭 Mint Tx: ${transferData.mintTxHash}`);
            console.log(`   💰 Amount: ${transferData.amount} USDC`);
            console.log(`   ⚡ Status: ${transferData.status}`);
            
            console.log('\n🔗 Transaction Links:');
            console.log(`   Burn: https://sepolia.etherscan.io/tx/${transferData.burnTxHash}`);
            console.log(`   Mint: https://sepolia.arbiscan.io/tx/${transferData.mintTxHash}`);

        } catch (error) {
            const elapsed = Math.round((Date.now() - transferStartTime) / 1000);
            
            if (error.message.includes('15 minute timeout')) {
                console.log(`\n💀 TRANSFER FAILED after ${elapsed} seconds (15 minutes)`);
                console.log('🚨 This indicates a serious problem with the CCTP service or network');
            } else {
                console.log(`\n❌ TRANSFER ERROR after ${elapsed} seconds:`);
                console.log(`   Error: ${error.message}`);
                console.log('🔍 This is a real error, not just a timeout');
            }
            
            // Check if burn happened anyway
            console.log('\n🔍 Checking if burn happened despite error...');
            const currentEthBalance = await client.callTool({
                name: 'get_usdc_balance_cctp',
                arguments: { chainId: 11155111, address: walletAddress }
            });
            const currentEthData = JSON.parse(currentEthBalance.content[0].text);
            const ethChange = parseFloat(currentEthData.balance.formatted) - parseFloat(initialEthData.balance.formatted);
            
            if (ethChange < -0.25) {
                console.log(`🔥 BURN DETECTED: ${Math.abs(ethChange).toFixed(6)} USDC was burned`);
                console.log('⏳ The mint may still happen on Arbitrum in a few minutes');
            } else {
                console.log('❌ No burn detected - transfer likely failed completely');
            }
        }

        // Final balance check
        console.log('\n💰 Final balances:');
        
        const finalEthBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: { chainId: 11155111, address: walletAddress }
        });
        const finalEthData = JSON.parse(finalEthBalance.content[0].text);
        
        const finalArbBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: { chainId: 421614, address: walletAddress }
        });
        const finalArbData = JSON.parse(finalArbBalance.content[0].text);

        console.log(`📊 Ethereum Sepolia: ${finalEthData.balance.formatted}`);
        console.log(`📊 Arbitrum Sepolia: ${finalArbData.balance.formatted}`);

        const ethChange = parseFloat(finalEthData.balance.formatted) - parseFloat(initialEthData.balance.formatted);
        const arbChange = parseFloat(finalArbData.balance.formatted) - parseFloat(initialArbData.balance.formatted);

        console.log('\n📈 Total Changes:');
        console.log(`   Ethereum: ${ethChange > 0 ? '+' : ''}${ethChange.toFixed(6)} USDC`);
        console.log(`   Arbitrum: ${arbChange > 0 ? '+' : ''}${arbChange.toFixed(6)} USDC`);

    } catch (error) {
        console.error('\n💥 SCRIPT CRASHED:', error.message);
        console.error('📍 This is a connection or setup error, not a transfer timeout');
    } finally {
        await client.close();
        process.exit(0);
    }
}

console.log('🌉 CCTP Transfer with Proper Timeout Handling');
console.log('=' .repeat(50));
console.log('💡 This script will either:');
console.log('   ✅ Complete successfully (2-5 minutes)');
console.log('   ❌ Crash with real error');
console.log('   💀 Timeout after 15 minutes (serious problem)');
console.log('=' .repeat(50));

testCCTPTransferWithProperWait().catch(console.error);
