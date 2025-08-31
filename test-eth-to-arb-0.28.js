const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
require('dotenv').config();

async function testEthSepoliaToArbSepolia() {
    console.log('🚀 Testing CCTP Transfer: 0.28 USDC from Ethereum Sepolia to Arbitrum Sepolia...\n');

    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'build/index.js']
    });

    const client = new Client(
        {
            name: "eth-arb-sepolia-test",
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
        
        const ethSepoliaBalance = await client.callTool({
            name: 'get_usdc_balance_cctp',
            arguments: {
                chainId: 11155111, // Ethereum Sepolia
                address: walletAddress
            }
        });
        const ethSepoliaData = JSON.parse(ethSepoliaBalance.content[0].text);
        console.log(`📊 Ethereum Sepolia USDC: ${ethSepoliaData.balance.formatted}`);

        const arbSepoliaBalance = await client.callTool({
            name: 'get_usdc_balance_cctp', 
            arguments: {
                chainId: 421614, // Arbitrum Sepolia
                address: walletAddress
            }
        });
        const arbSepoliaData = JSON.parse(arbSepoliaBalance.content[0].text);
        console.log(`📊 Arbitrum Sepolia USDC: ${arbSepoliaData.balance.formatted}\n`);

        // Step 2: Execute the transfer with background monitoring
        console.log('🔄 Step 2: Initiating cross-chain transfer...');
        console.log('   💸 Amount: 0.28 USDC');
        console.log('   📤 From: Ethereum Sepolia (11155111)');
        console.log('   📥 To: Arbitrum Sepolia (421614)');
        console.log('   👤 Recipient:', walletAddress);
        console.log('   ⏰ Starting transfer (this may take 2-5 minutes)...\n');

        // Create transfer promise
        const transferPromise = client.callTool({
            name: 'cctp_cross_chain_transfer',
            arguments: {
                fromChainId: 11155111,  // Ethereum Sepolia
                toChainId: 421614,      // Arbitrum Sepolia  
                amount: '0.28',         // 0.28 USDC
                recipientAddress: walletAddress
            }
        });

        // Create a monitoring function that runs in parallel
        const monitorBalances = async () => {
            console.log('👀 Starting balance monitoring...\n');
            const initialEthBalance = parseFloat(ethSepoliaData.balance.formatted);
            
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
                
                try {
                    const currentEthBalance = await client.callTool({
                        name: 'get_usdc_balance_cctp',
                        arguments: { chainId: 11155111, address: walletAddress }
                    });
                    const currentEthData = JSON.parse(currentEthBalance.content[0].text);
                    const currentEthAmount = parseFloat(currentEthData.balance.formatted);
                    
                    const currentArbBalance = await client.callTool({
                        name: 'get_usdc_balance_cctp',
                        arguments: { chainId: 421614, address: walletAddress }
                    });
                    const currentArbData = JSON.parse(currentArbBalance.content[0].text);
                    const currentArbAmount = parseFloat(currentArbData.balance.formatted);
                    
                    console.log(`📊 Monitor ${i + 1}: ETH=${currentEthAmount} USDC, ARB=${currentArbAmount} USDC`);
                    
                    // Check if burn happened
                    if (currentEthAmount < initialEthBalance - 0.25) {
                        console.log('🔥 BURN DETECTED on Ethereum Sepolia!');
                        
                        // Check if mint happened
                        if (currentArbAmount > parseFloat(arbSepoliaData.balance.formatted) + 0.25) {
                            console.log('🏭 MINT DETECTED on Arbitrum Sepolia! Transfer completed!');
                            break;
                        }
                    }
                } catch (error) {
                    console.log(`❌ Monitor error: ${error.message}`);
                }
            }
        };

        // Run transfer and monitoring in parallel, with timeout
        try {
            const result = await Promise.race([
                transferPromise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Transfer timeout after 5 minutes')), 300000)
                )
            ]);

            console.log('✅ Transfer completed successfully!');
            const transferData = JSON.parse(result.content[0].text);
            console.log('📋 Transfer Details:');
            console.log(`   🔥 Burn Tx: ${transferData.burnTxHash}`);
            console.log(`   🏭 Mint Tx: ${transferData.mintTxHash}`);
            console.log(`   💰 Amount: ${transferData.amount} USDC`);
            console.log(`   ⚡ Status: ${transferData.status}`);

        } catch (timeoutError) {
            console.log('⏰ Transfer is taking longer than expected...');
            console.log('🔍 Starting manual balance monitoring...');
            
            // Start monitoring in background
            monitorBalances();
        }

        // Final balance check
        console.log('\n💰 Final balance check...');
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

        console.log(`📊 Final Ethereum Sepolia: ${finalEthData.balance.formatted}`);
        console.log(`📊 Final Arbitrum Sepolia: ${finalArbData.balance.formatted}`);

        // Calculate changes
        const ethChange = parseFloat(finalEthData.balance.formatted) - parseFloat(ethSepoliaData.balance.formatted);
        const arbChange = parseFloat(finalArbData.balance.formatted) - parseFloat(arbSepoliaData.balance.formatted);

        console.log('\n📈 Balance Changes:');
        console.log(`   Ethereum Sepolia: ${ethChange > 0 ? '+' : ''}${ethChange.toFixed(6)} USDC`);
        console.log(`   Arbitrum Sepolia: ${arbChange > 0 ? '+' : ''}${arbChange.toFixed(6)} USDC`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await client.close();
        process.exit(0);
    }
}

console.log('🌉 Circle CCTP v2: Ethereum Sepolia → Arbitrum Sepolia (0.28 USDC)');
console.log('=' .repeat(65));
testEthSepoliaToArbSepolia().catch(console.error);
