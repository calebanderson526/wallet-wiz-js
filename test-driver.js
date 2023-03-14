const { get_holders, get_holder_rug_vs_ape, get_contract_names } = require("./WalletWiz")
const { handler } = require("./index")
const token_address = '0xBBEa044f9e7c0520195e49Ad1e561572E7E1B948'

async function run() {
    const start = new Date();
    // const result = await handler({
    //     "body": "{\"address\": \"0x73eD68B834e44096eB4beA6eDeAD038c945722F1\"}"
    // })
    const result = await get_holders('0x73eD68B834e44096eB4beA6eDeAD038c945722F1', 1676632855000)
    const result3 = await get_contract_names(result)
    const result2 = await get_holder_rug_vs_ape(result3)
    console.log(result2)
    console.log(`${new Date() - start} ms runtime`)
}

run()