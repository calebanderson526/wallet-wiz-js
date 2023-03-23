const { get_holders, get_holder_rug_vs_ape, get_contract_names } = require("./WalletWiz")
const token_address = '0xBBEa044f9e7c0520195e49Ad1e561572E7E1B948'

async function run() {
    const start = new Date();
    // const result = await handler({
    //     "body": "{\"address\": \"0x73eD68B834e44096eB4beA6eDeAD038c945722F1\"}"
    // })
    const result = await get_holders('0x73eD68B834e44096eB4beA6eDeAD038c945722F1', 1676632855000, 1677183655000, 0)
    console.log('get holders')
    //const result3 = await get_contract_names(result)
    //console.log('get names')
    //const result2 = await get_holder_rug_vs_ape(result3)
    //console.log('get rug vs ape')
    console.log(result.slice(0, 15))
    console.log(`${new Date() - start} ms runtime`)
}

run()