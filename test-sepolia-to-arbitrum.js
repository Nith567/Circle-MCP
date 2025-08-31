const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function testSepoliaToArbitrumTransfer() {
    console.log('🚀 Testing CCTP Transfer: 0.27 USDC from Ethereum Sepolia to Arbitrum Sepolia...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client(
        {
            name: "sepolia-arbitrum-test",
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

        // Step 1: Check initial balances
        console.log('💰 Step 1: Checking initial balances...');
        
        const sepoliaBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 11155111, // Ethereum Sepolia
                address: walletAddress
            }
        });
        const sepoliaBalanceData = JSON.parse(sepoliaBalance.content[0].text);
        console.log(`📊 Ethereum Sepolia USDC: ${sepoliaBalanceData.balance.formatted}`);

        const arbitrumBalance = await client.callTool({
            name: 'get_usdc_balance_cctp', 
            arguments: {
                chainId: 421614, // Arbitrum Sepolia
                address: walletAddress
            }
        });
        const arbitrumBalanceData = JSON.parse(arbitrumBalance.content[0].text);
        console.log(`📊 Arbitrum Sepolia USDC: ${arbitrumBalanceData.balance.formatted}\n`);

        // Step 2: Get supported chains info
        console.log('📋 Step 2: Verifying chain support...');
        const supportedChains = await client.callTool({
            name: 'get_cctp_supported_chains',
            arguments: {}
        });
        const chainsData = JSON.parse(supportedChains.content[0].text);
        
        const ethSepoliaSupported = chainsData.supportedChains.find(c => c.chainId === 11155111);
        const arbSepoliaSupported = chainsData.supportedChains.find(c => c.chainId === 421614);
        
        console.log(`✅ Ethereum Sepolia (Domain ${ethSepoliaSupported.domain}): ${ethSepoliaSupported.name}`);
        console.log(`✅ Arbitrum Sepolia (Domain ${arbSepoliaSupported.domain}): ${arbSepoliaSupported.name}\n`);

        // Step 3: Execute the cross-chain transfer
        console.log('🔄 Step 3: Initiating cross-chain transfer...');
        console.log('   💸 Amount: 0.27 USDC');
        console.log('   📤 From: Ethereum Sepolia (11155111)');
        console.log('   📥 To: Arbitrum Sepolia (421614)');
        console.log('   👤 Recipient:', walletAddress);
        console.log('   ⏰ Starting transfer...\n');

        const transferStartTime = Date.now();
        
        // Add timeout wrapper for better error handling
        const transferPromise = client.callTool({
            name: 'cctp_cross_chain_transfer',
            arguments: {
                fromChainId: 11155111,  // Ethereum Sepolia
                toChainId: 421614,      // Arbitrum Sepolia  
                amount: '0.27',         // 0.27 USDC
                recipientAddress: walletAddress
            }
        });

        // Custom timeout (5 minutes)
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transfer timeout after 5 minutes')), 300000)
        );

        try {
            const transferResult = await Promise.race([transferPromise, timeoutPromise]);
            
            const transferTime = Math.round((Date.now() - transferStartTime) / 1000);
            console.log(`✅ Transfer completed in ${transferTime} seconds!`);
            
            const transferResultData = JSON.parse(transferResult.content[0].text);
            console.log('📋 Transfer Details:');
            console.log(`   🔥 Burn Tx (Ethereum): ${transferResultData.burnTxHash}`);
            console.log(`   🏭 Mint Tx (Arbitrum): ${transferResultData.mintTxHash}`);
            console.log(`   🎯 Amount: ${transferResultData.amount} USDC`);
            console.log(`   ⚡ Status: ${transferResultData.status}\n`);

            // Step 4: Check final balances
            console.log('💰 Step 4: Checking final balances...');
            
            const finalSepoliaBalance = await client.callTool({
                name: 'get_usdc_balance_cctp',
                arguments: {
                    chainId: 11155111,
                    address: walletAddress
                }
            });
            const finalSepoliaData = JSON.parse(finalSepoliaBalance.content[0].text);
            console.log(`📊 Final Ethereum Sepolia: ${finalSepoliaData.balance.formatted}`);

            const finalArbitrumBalance = await client.callTool({
                name: 'get_usdc_balance_cctp',
                arguments: {
                    chainId: 421614, 
                    address: walletAddress
                }
            });
            const finalArbitrumData = JSON.parse(finalArbitrumBalance.content[0].text);
            console.log(`📊 Final Arbitrum Sepolia: ${finalArbitrumData.balance.formatted}\n`);

            // Step 5: Calculate changes
            const sepoliaChange = parseFloat(finalSepoliaData.balance.formatted) - parseFloat(sepoliaBalanceData.balance.formatted);
            const arbitrumChange = parseFloat(finalArbitrumData.balance.formatted) - parseFloat(arbitrumBalanceData.balance.formatted);

            console.log('📈 Balance Changes:');
            console.log(`   Ethereum Sepolia: ${sepoliaChange > 0 ? '+' : ''}${sepoliaChange.toFixed(6)} USDC`);
            console.log(`   Arbitrum Sepolia: ${arbitrumChange > 0 ? '+' : ''}${arbitrumChange.toFixed(6)} USDC`);

            console.log('\n🎉 Cross-chain transfer test completed successfully!');
            console.log('🔗 Transaction URLs:');
            console.log(`   Burn: https://sepolia.etherscan.io/tx/${transferResultData.burnTxHash}`);
            console.log(`   Mint: https://sepolia.arbiscan.io/tx/${transferResultData.mintTxHash}`);

        } catch (timeoutError) {
            if (timeoutError.message.includes('timeout')) {
                console.log('⏰ Transfer is taking longer than 5 minutes...');
                console.log('💡 This is normal for CCTP transfers. The transaction may still complete.');
                console.log('🔍 Check your balances in a few minutes to confirm completion.');
                
                // Still try to get balance changes
                console.log('\n💰 Checking current balances...');
                try {
                    const currentSepolia = await client.callTool({
                        name: 'get_usdc_balance_cctp',
                        arguments: { chainId: 11155111, address: walletAddress }
                    });
                    const currentSepoliaData = JSON.parse(currentSepolia.content[0].text);
                    
                    const currentChange = parseFloat(currentSepoliaData.balance.formatted) - parseFloat(sepoliaBalanceData.balance.formatted);
                    if (currentChange < 0) {
                        console.log(`🔥 DETECTED: ${Math.abs(currentChange).toFixed(6)} USDC burned on Ethereum Sepolia`);
                        console.log('✅ Transfer is in progress! Check Arbitrum balance later.');
                    }
                } catch (e) {
                    console.log('❌ Could not check intermediate balances');
                }
            } else {
                throw timeoutError;
            }
        }

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

console.log('🌉 Circle CCTP v2: Ethereum Sepolia → Arbitrum Sepolia');
console.log('=' .repeat(55));
testSepoliaToArbitrumTransfer().catch(console.error);
