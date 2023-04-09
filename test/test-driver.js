const { 
    create_request_log, 
    get_holders, 
    get_holder_rug_vs_ape, 
    get_contract_names, 
    get_early_alpha,
    get_common_funders
} = require("../WalletWiz")
const token_address = '0xBBEa044f9e7c0520195e49Ad1e561572E7E1B948'

const {top50Holders} = require('../src/top50Holders')
const { contractNames } = require('../src/contractNames')
const { walletValues } = require('../src/walletValues')

async function run() {
    const start = new Date();
//     console.log('get holders')
//     const result = await get_holders('0x8646e185a388f42Fbf0087Cd75d6E1F95084D08B', 1671632855000, -1, 0, 'ethereum')
//     //const result2 = await get_common_funders(result.holders, 0, 'arbitrum', 1671632855000)
//     console.log('get_alpha')
//     console.log(result.holders.length)
//     const result3 = await get_contract_names(result.holders, 0, 'ethereum')
//     //const result2 = await get_early_alpha(result3.holders, 0, 'ethereum')
//     //console.log('get names')
//     const result2 = await get_holder_rug_vs_ape(result3.holders, 0, 'ethereum')
//     //console.log('get rug vs ape')
//     console.log(result2)
//     // console.log(JSON.stringify(result2, undefined, 2))
//     console.log(`${new Date() - start} ms runtime`)
//     // create_request_log('GET', '/api/user', 500, 200);
    console.log('holders')
    var result = await top50Holders('0x0fE0Ed7F146Cb12e4B9759afF4FA8d34571802ca', 'earliest', 'latest', 0, 'ethereum')
    console.log((new Date()).getTime()- start.getTime())
    console.log('contracts')
    var result2 = await walletValues(result.holders, 0, 'ethereum', 'latest')
    console.log((new Date()).getTime()- start.getTime())
    console.log(result2)
}

run()