const {contractNames} = require('./contractNames')
const {walletValues} = require('./walletValues')
const {rugVsApe} = require('./rugVsApe')
const {top50Holders} = require('./top50Holders')
const {walletTimeStats} = require('./walletTimeStats')
const {commonFunders} = require('./commonFunders')
const {unixTimeToString} = require('./utils')

/*
    Helper to calculate average of an array of numbers
*/
function calculateAverage(numbers) {
    let sum = 0;
    for (let i = 0; i < numbers.length; i++) {
        sum += numbers[i];
    }
    return sum / numbers.length;
}

/*
    handler for /test on the wallet wiz telegram bot
*/
async function handleTest(message, retries) {
    try {
        const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
        const [command, token_address, ...params] = message.split(' ')
        const isAddress = ethereumAddressRegex.test(token_address)
        if (!isAddress) {
            return 'Ethereum address is Invalid'
        }

        // Run all wallet wiz tests
        const holders = await top50Holders(token_address, 'earliest', 'latest', 0, 'ethereum')
        const holdersNames = await contractNames(holders.holders, 0, 'ethereum')
        const holderBalances = walletValues(holdersNames.holders, 0, 'ethereum')
        const holderRugVsApe = rugVsApe(holdersNames.holders, 0, 'ethereum')
        const holderWalletTime = walletTimeStats(holdersNames.holders, 0, 'ethereum')
        const holderCommonFunders = commonFunders(holdersNames.holders, 0, 'ethereum', unixTimeToString((new Date).getTime()))
        
        // Calculate Averages
        var avgHolding = Number(calculateAverage((holders.holders).map(r => r.holding)) * 100).toFixed(3) + ' %'
        var avgValue = '$' + Number(calculateAverage((await holderBalances).holders.map(r => r.wallet_value && !r.address_name && r.address != '0x000000000000000000000000000000000000dead'  ? r.wallet_value : 0))).toFixed(2)
        var avgRugs = Number(calculateAverage((await holderRugVsApe).holders.map(r => r.rug_count ? r.rug_count : 0))).toFixed(2) + ' rugs'
        var avgTime = Number(calculateAverage((await holderWalletTime).holders.map(r => r.avg_time ? r.avg_time : 0))).toFixed(2) + ' hours'
        var avgAge = Number(calculateAverage((await holderWalletTime).holders.map(r => r.wallet_age ? r.wallet_age : 0))).toFixed(2) + ' days'
        var avgTx = Number(calculateAverage((await holderWalletTime).holders.map(r => r.tx_count ? r.tx_count : 0))).toFixed(2) + ' txns'
        var reply = 
        `Results for *${token_address}*

*Averages*
_Holding_: ${avgHolding}
_$$$ Value_: ${avgValue}
_Rugs Aped_: ${avgRugs}
_Time between TXN_: ${avgTime}
_Age_: ${avgAge}
_TXN Count_: ${avgTx}

*Top 5 Common Rugs*: ${(await holderRugVsApe).common_rugs.slice(0, 5).map(obj => obj.address).join(', ')}

*Top 5 Common Apes*: ${(await holderRugVsApe).common_apes.slice(0, 5).map(obj => obj.address).join(', ')}

*Top 5 Common Funders*: ${(await holderCommonFunders).common_funders.slice(0, 5).join(', ')}
`
        return reply.replace(/\./g, "\\.");
    } catch(e) {
        return e.message
    }
}

module.exports.handleTest = handleTest