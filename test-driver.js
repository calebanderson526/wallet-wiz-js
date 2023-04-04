const { 
    create_request_log, 
    get_holders, 
    get_holder_rug_vs_ape, 
    get_contract_names, 
    get_early_alpha 
} = require("./WalletWiz")
const token_address = '0xBBEa044f9e7c0520195e49Ad1e561572E7E1B948'

async function run() {
    const start = new Date();
    // const result = await handler({
    //     "body": "{\"address\": \"0x73eD68B834e44096eB4beA6eDeAD038c945722F1\"}"
    // })
    // 1676632855000
    const result = await get_holders('0xa0eeBB0E5C3859a1c5412C2380c074f2f6725e2E', 1670632855000, -1, 0)
    console.log('get holders')
    // const result3 = await get_contract_names(result)
    // const result2 = await get_early_alpha(result3)
    //console.log('get names')
    //const result2 = await get_holder_rug_vs_ape(result3)
    //console.log('get rug vs ape')
    console.log(result)
    // console.log(JSON.stringify(result2, undefined, 2))
    console.log(`${new Date() - start} ms runtime`)
    // create_request_log('GET', '/api/user', 500, 200);
}

run()