require('dotenv').config();
const Web3 = require('web3');
const axios = require('axios');
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const wiz_abi = require('../static/WalletWizABI.json')
const arbiscan_url = process.env.ARBISCAN_API_URL
const arbiscan_key = process.env.ARBISCAN_API_KEY
const etherscan_url = process.env.ETHERSCAN_API_URL
const etherscan_key = process.env.ETHERSCAN_API_KEY
var web3;

/*
    Given a list of holders [{address: string}] and a chain
    determine whether or not each address is a smart contract
        - if it is then we also get the contract name from block explorer
    if 5 calls fail we return an error
*/
const contractNames = async (holders, retries, chain) => {
    try {
        // change the global web3 object to the correct chain
        web3 = await new Web3(process.env[`${chain.toUpperCase()}_ALCHEMY_API_URL`] + process.env.ALCHEMY_API_KEY)

        // use multicall contract to check multiple addresses at onces
        const contract = await new web3.eth.Contract(wiz_abi, process.env[`${chain.toUpperCase()}_WALLET_WIZ_ADDRESS`])
        const is_contract = await contract.methods.multiIsContract(
            holders.map((h) => h.address)
        ).call()
        
        // mutate the holders + get the contract name if it's a contract
        for (let i = 0; i < is_contract.length; i++) {
            holders[i].is_contract = is_contract[i]
            if (is_contract[i]) {
                var start = new Date()
                var name = await handleGetContractName(holders[i].address, 0, chain)
                // if the block explorer gives errors we return an error
                if (name.err) {
                    return { err: name.err }
                }
                holders[i].address_name = name
                var wait_time = 250 - ((new Date()).getTime() - start.getTime())
                await sleep(wait_time > 0 ? wait_time : 0)
            }
        }
        return { holders: holders }
    } catch (e) {
        console.log(e)
        if (retries > 5) {
            return { err: e }
        }
        var wait_time = (retries * 3000) + (3000 * Math.random())
        await sleep(wait_time)
        return await contractNames(holders, retries + 1, chain)
    }
}

/*
    Given an address and chain, get the contract name
    if this retries 5 time in a row, return an error
*/
const handleGetContractName = async (address, retries, chain) => {
    try {
        
        // handle eth and arbitrum, return the contract name that we receive
        var query_str = `?module=contract&action=getsourcecode&address=${address}&apikey=`
        if (chain == 'arbitrum') {
            var res = await axios.get(arbiscan_url + query_str + arbiscan_key)
            return res.data.result[0].ContractName == '' ? 'Unverified Contract' : res.data.result[0].ContractName
        } else if (chain == 'ethereum') {
            var res = await axios.get(etherscan_url + query_str + etherscan_key)
            return res.data.result[0].ContractName == '' ? 'Unverified Contract' : res.data.result[0].ContractName
        }

    } catch (e) {
        console.log(e)
        if (retries > 5) {
            return { err: e }
        }
        var wait_time = (retries * 3000) + (3000 * Math.random())
        await sleep(wait_time)
        return await handleGetContractName(address, retries + 1, chain)
    }
}

exports.contractNames = contractNames