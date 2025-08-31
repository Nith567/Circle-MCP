const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function testSepoliaToFujiTransfer() {
    console.log('🚀 Testing CCTP Transfer: 0.14 USDC from Ethereum Sepolia to Avalanche Fuji...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client(
        {
            name: "sepolia-fuji-transfer-test",
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
        console.log(`📊 Sepolia USDC Balance: ${sepoliaBalanceData.balance.formatted}`);

        const fujiBalance = await client.callTool({
            name: 'get_usdc_balance_cctp', 
            arguments: {
                chainId: 43113, // Avalanche Fuji
                address: walletAddress
            }
        });
        const fujiBalanceData = JSON.parse(fujiBalance.content[0].text);
        console.log(`📊 Fuji USDC Balance: ${fujiBalanceData.balance.formatted}\n`);

        // Step 2: Execute the cross-chain transfer
        console.log('🔄 Step 2: Initiating cross-chain transfer...');
        console.log('   💸 Amount: 0.14 USDC');
        console.log('   📤 From: Ethereum Sepolia (11155111)');
        console.log('   📥 To: Avalanche Fuji (43113)');
        console.log('   👤 Recipient:', walletAddress);
        console.log('   ⏰ Starting transfer...\n');

        const transferStartTime = Date.now();
        
        const transferResult = await client.callTool({
            name: 'cctp_cross_chain_transfer',
            arguments: {
                fromChainId: 11155111,  // Ethereum Sepolia
                toChainId: 43113,       // Avalanche Fuji  
                amount: '0.14',         // 0.14 USDC
                recipientAddress: walletAddress
            }
        });

        const transferTime = Math.round((Date.now() - transferStartTime) / 1000);
        console.log(`✅ Transfer completed in ${transferTime} seconds!`);
        
        const transferResultData = JSON.parse(transferResult.content[0].text);
        console.log('📋 Transfer Details:');
        console.log(`   🔥 Burn Tx (Sepolia): ${transferResultData.burnTxHash}`);
        console.log(`   🏭 Mint Tx (Fuji): ${transferResultData.mintTxHash}`);
        console.log(`   🎯 Amount: ${transferResultData.amount} USDC`);
        console.log(`   ⚡ Status: ${transferResultData.status}\n`);

        // Step 3: Wait and check final balances
        console.log('⏳ Step 3: Waiting 30 seconds for blockchain confirmations...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        console.log('💰 Checking final balances...');
        
        const finalSepoliaBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 11155111,
                address: walletAddress
            }
        });
        const finalSepoliaData = JSON.parse(finalSepoliaBalance.content[0].text);
        console.log(`📊 Final Sepolia Balance: ${finalSepoliaData.balance.formatted}`);

        const finalFujiBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 43113, 
                address: walletAddress
            }
        });
        const finalFujiData = JSON.parse(finalFujiBalance.content[0].text);
        console.log(`📊 Final Fuji Balance: ${finalFujiData.balance.formatted}\n`);

        // Step 4: Calculate changes
        const sepoliaChange = parseFloat(finalSepoliaData.balance.formatted) - parseFloat(sepoliaBalanceData.balance.formatted);
        const fujiChange = parseFloat(finalFujiData.balance.formatted) - parseFloat(fujiBalanceData.balance.formatted);

        console.log('📈 Balance Changes:');
        console.log(`   Sepolia: ${sepoliaChange > 0 ? '+' : ''}${sepoliaChange.toFixed(6)} USDC`);
        console.log(`   Fuji: ${fujiChange > 0 ? '+' : ''}${fujiChange.toFixed(6)} USDC`);

        console.log('\n🎉 Cross-chain transfer test completed successfully!');
        console.log('🔗 Transaction URLs:');
        console.log(`   Burn: https://sepolia.etherscan.io/tx/${transferResultData.burnTxHash}`);
        console.log(`   Mint: https://testnet.snowtrace.io/tx/${transferResultData.mintTxHash}`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.message.includes('timeout')) {
            console.log('\n💡 Transfer may still be processing. Check your balances in a few minutes.');
            console.log('   This is normal for cross-chain transfers as they can take 2-5 minutes.');
        }
        
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    } finally {
        await client.close();
        process.exit(0);
    }
}

console.log('🌉 Circle CCTP v2 Cross-Chain Transfer Test');
console.log('=' .repeat(50));
testSepoliaToFujiTransfer().catch(console.error);
