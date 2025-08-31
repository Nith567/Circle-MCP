const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function testCCTPWithAsyncApproach() {
    console.log('🚀 Testing CCTP with Async Approach (Workaround for MCP 60s timeout)...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client({
        name: "cctp-async-test",
        version: "1.0.0"
    }, {
        capabilities: { sampling: {} }
    });

    try {
        await client.connect(transport);
        console.log('✅ Connected to CCTP MCP server\n');

        const walletAddress = '0x8A0d290b2EE35eFde47810CA8fF057e109e4190B';

        // Check initial balances
        const initialEthBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: { chainId: 11155111, address: walletAddress }
        });
        const initialEthData = JSON.parse(initialEthBalance.content[0].text);
        console.log(`📊 Initial Ethereum Sepolia: ${initialEthData.balance.formatted}`);

        const initialArbBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: { chainId: 421614, address: walletAddress }
        });
        const initialArbData = JSON.parse(initialArbBalance.content[0].text);
        console.log(`📊 Initial Arbitrum Sepolia: ${initialArbData.balance.formatted}\n`);

        // Try the transfer (will timeout after 60 seconds)
        console.log('🔄 Starting CCTP transfer (expecting MCP timeout at 60s)...');
        const transferStartTime = Date.now();

        try {
            const transferResult = await client.callTool({
                name: 'cctp_cross_chain_transfer',
                arguments: {
                    fromChainId: 11155111,
                    toChainId: 421614,
                    amount: '0.25',
                    recipientAddress: walletAddress
                }
            });

            // If we get here, the transfer completed within 60 seconds!
            console.log('🎉 Transfer completed within MCP timeout!');
            const transferData = JSON.parse(transferResult.content[0].text);
            console.log(`🔥 Burn Tx: ${transferData.burnTxHash}`);
            console.log(`🏭 Mint Tx: ${transferData.mintTxHash}`);

        } catch (timeoutError) {
            const elapsed = Math.round((Date.now() - transferStartTime) / 1000);
            console.log(`⏰ MCP timeout after ${elapsed} seconds (expected)\n`);

            // Now monitor the transfer manually
            console.log('👀 Monitoring transfer progress manually...');
            
            let transferCompleted = false;
            let burnDetected = false;
            const maxChecks = 20; // Check for up to 10 minutes
            
            for (let i = 0; i < maxChecks; i++) {
                console.log(`🔍 Check ${i + 1}/${maxChecks} (${new Date().toLocaleTimeString()})...`);
                
                // Check current balances
                const currentEthBalance = await client.callTool({
                    name: 'get_usdc_balance_cctp',
                    arguments: { chainId: 11155111, address: walletAddress }
                });
                const currentEthData = JSON.parse(currentEthBalance.content[0].text);
                const ethAmount = parseFloat(currentEthData.balance.formatted);
                
                const currentArbBalance = await client.callTool({
                    name: 'get_usdc_balance_cctp',
                    arguments: { chainId: 421614, address: walletAddress }
                });
                const currentArbData = JSON.parse(currentArbBalance.content[0].text);
                const arbAmount = parseFloat(currentArbData.balance.formatted);
                
                console.log(`   ETH: ${ethAmount} USDC, ARB: ${arbAmount} USDC`);
                
                // Check if burn happened
                const ethChange = ethAmount - parseFloat(initialEthData.balance.formatted);
                if (ethChange < -0.2 && !burnDetected) {
                    console.log(`   🔥 BURN DETECTED! ${Math.abs(ethChange).toFixed(6)} USDC burned`);
                    burnDetected = true;
                }
                
                // Check if mint happened
                const arbChange = arbAmount - parseFloat(initialArbData.balance.formatted);
                if (arbChange > 0.2) {
                    console.log(`   🏭 MINT DETECTED! ${arbChange.toFixed(6)} USDC minted`);
                    console.log('✅ TRANSFER COMPLETED SUCCESSFULLY!');
                    transferCompleted = true;
                    break;
                }
                
                // Wait 30 seconds before next check
                if (i < maxChecks - 1) {
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            }
            
            if (!transferCompleted) {
                if (burnDetected) {
                    console.log('⏳ Transfer is still in progress (burn detected but mint pending)');
                    console.log('💡 The mint should complete within a few more minutes');
                } else {
                    console.log('❌ No transfer activity detected - may have failed');
                }
            }
        }

        // Final summary
        console.log('\n📊 Final Summary:');
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

        const ethChange = parseFloat(finalEthData.balance.formatted) - parseFloat(initialEthData.balance.formatted);
        const arbChange = parseFloat(finalArbData.balance.formatted) - parseFloat(initialArbData.balance.formatted);

        console.log(`💰 Ethereum Sepolia: ${finalEthData.balance.formatted} (${ethChange > 0 ? '+' : ''}${ethChange.toFixed(6)})`);
        console.log(`💰 Arbitrum Sepolia: ${finalArbData.balance.formatted} (${arbChange > 0 ? '+' : ''}${arbChange.toFixed(6)})`);

        if (Math.abs(ethChange) > 0.2 || Math.abs(arbChange) > 0.2) {
            console.log('\n🎉 Transfer activity detected! CCTP is working.');
        } else {
            console.log('\n❌ No significant balance changes detected.');
        }

    } catch (error) {
        console.error('\n💥 Script error:', error.message);
    } finally {
        await client.close();
        process.exit(0);
    }
}

console.log('💡 MCP has a 60-second timeout, but CCTP takes 2-5 minutes');
console.log('💡 This script works around that limitation by monitoring manually');
console.log('=' .repeat(60));

testCCTPWithAsyncApproach().catch(console.error);
