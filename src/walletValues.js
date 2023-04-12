require('dotenv').config();
const Web3 = require('web3');
const axios = require('axios');
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const wiz_abi = require('../static/WalletWizABI.json')
const erc20abi = require('../static/erc20_abi.json')
const arbiscan_url = process.env.ARBISCAN_API_URL
const arbiscan_key = process.env.ARBISCAN_API_KEY
const etherscan_url = process.env.ETHERSCAN_API_URL
const etherscan_key = process.env.ETHERSCAN_API_KEY
var web3;
var multicaller_address = process.env.MULTICALLER_ADDRESS;
const multicaller_abi = require('../static/multicallerABI.json')

/*
    Use the makerdao multicall3 contract in order to batch multiple read functions into one call
    We must encode call data in order to use this contract
    adds 'wallet_value' property to each holder
*/
const walletValues = async (holders, retries, chain, block) => {
    try {
        // change the global web3 object to the correct chain
        var provider = process.env[`${chain.toUpperCase()}_ALCHEMY_API_URL`] + process.env.ALCHEMY_API_KEY
        web3 = await new Web3(provider)
        
        // list of erc20's we will be checking balances for
        const erc20_balance_checks = [
            {
                'symbol': 'USDC',
                'decimals': 6,
                'ethereum_address': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                'arbitrum_address': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
            },
            {
                'symbol': 'USDT',
                'decimals': 6,
                'ethereum_address': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                'arbitrum_address': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
            },
            {
                'symbol': 'WETH',
                'decimals': 18,
                'ethereum_address': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                'arbitrum_address': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
            }
        ]

        const multicaller_contract = await new web3.eth.Contract(multicaller_abi, multicaller_address)

        // construct necessary contracts
        const usdc_contract = new web3.eth.Contract(erc20abi, erc20_balance_checks[0][`${chain}_address`])
        const usdt_contract = new web3.eth.Contract(erc20abi, erc20_balance_checks[1][`${chain}_address`])
        const weth_contract = new web3.eth.Contract(erc20abi, erc20_balance_checks[2][`${chain}_address`])

        var calls = []

        // create the calls
        for (let i = 0; i < holders.length; i++) {
            calls.push(usdc_contract.methods.balanceOf(holders[i].address))
            calls.push(usdt_contract.methods.balanceOf(holders[i].address))
            calls.push(weth_contract.methods.balanceOf(holders[i].address))
            calls.push(multicaller_contract.methods.getEthBalance(holders[i].address))
        }

        

        // get the eth price
        var query_str = '?module=stats&action=ethprice&apikey='
        var eth_price = await axios.get(`${arbiscan_url}${query_str}${arbiscan_key}`)

        // call multicall
        // we need to formulate evm call data in order to use multicall so we use .encodeABI()
        const result = await multicaller_contract.methods.aggregate(calls.map((call) => {
            const callData = call.encodeABI();
            return {
                target: call._parent._address,
                callData: callData,
            }
        })).call()
        var ethusd = eth_price.data.result.ethusd

        // call results are returned in an array with length of (number of token balances checked * number of accounts checked)
        // array is one dimensional
        // convert the call results to usd and mutate the holders list
        for (let i = 0; i < result.returnData.length; i += 4) {
            var cur_value = 0
            cur_value += result.returnData[i+0] / (10 ** 6)
            cur_value += result.returnData[i+1] / (10 ** 6)
            cur_value += (result.returnData[i+2] / (10 ** 18)) * ethusd
            cur_value += (result.returnData[i+3] / (10 ** 18)) * ethusd
            holders[i / 4].wallet_value = cur_value
        }

        return { holders: holders }
    } catch (e) {
        console.log(e)
        if (retries > 5) {
            return { err: e }
        }
        var wait_time = (retries * 3000) + (3000 * Math.random())
        await sleep(wait_time)
        return await walletValues(holders, retries + 1, chain, block)
    }
}

exports.walletValues = walletValues