const { test_token } = require("./WalletWiz")
const token_address = '0xaa54e84A3e6e5A80288d2C2f8e36eA5cA3A3Ca30'


const start = new Date();
const result = test_token(token_address);
console.log(result)
console.log(start - new Date())
