const { test_token } = require("./WalletWiz")
const { handler } = require("./index")
const token_address = '0xaa54e84A3e6e5A80288d2C2f8e36eA5cA3A3Ca30'

async function run() {
    const start = new Date();
    const result = await test_token(token_address);
    console.log(result)
    console.log(`${new Date() - start} ms runtime`)
}

run()

// handler({
//     "body": "{\"address\": \"0x73eD68B834e44096eB4beA6eDeAD038c945722F1\"}"
// })