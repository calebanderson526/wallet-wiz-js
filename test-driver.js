const { get_holders } = require("./WalletWiz")
const { handler } = require("./index")
const token_address = '0xBBEa044f9e7c0520195e49Ad1e561572E7E1B948'

async function run() {
    const start = new Date();
    // const result = await handler({
    //     "body": "{\"address\": \"0x73eD68B834e44096eB4beA6eDeAD038c945722F1\"}"
    // })
    const result = await get_holders('0x73eD68B834e44096eB4beA6eDeAD038c945722F1', 1676632855000)
    console.log(result)
    console.log(`${new Date() - start} ms runtime`)
}

run()