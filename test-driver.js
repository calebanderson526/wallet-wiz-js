const { test_token } = require("./WalletWiz")
const { handler } = require("./index")
const token_address = '0xaa54e84a3e6e5a80288d2c2f8e36ea5ca3a3ca30'

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