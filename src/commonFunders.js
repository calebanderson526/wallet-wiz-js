require('dotenv').config();
const { Flipside } = require("../@flipsidecrypto/sdk/dist/src");
const Web3 = require('web3');

const flipside = new Flipside(
  process.env.FLIPSIDE_API_KEY,
  "https://node-api.flipsidecrypto.com"
)
const { unixTimeToString } = require('./utils')
const wiz_abi = require('../static/WalletWizABI.json')
var web3;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const commonFunders = async (holders, retries, chain, timestamp) => {
  try {
    const addressesToCheck = holders.filter(holder => !holder.is_contract && !holder.address_name).map(holder => holder.address);
    sql = `
      SELECT DISTINCT
        top 100
        count(DISTINCT t.eth_to_address) as count,
        t.eth_from_address as funder
      FROM
        ${chain}.core.ez_eth_transfers t
        LEFT JOIN ${chain}.core.dim_labels dl ON dl.address = t.eth_from_address
        LEFT JOIN ${chain}.core.dim_contracts dc ON dc.address = t.eth_from_address
      WHERE
        t.eth_to_address IN (${addressesToCheck.map(token => `'${token}'`).join(', ')})
        AND (dc.name IS NULL AND dl.address_name IS NULL)
        AND t.block_timestamp <= '${unixTimeToString(timestamp)}'
        AND t.block_timestamp >= '${unixTimeToString(timestamp - 1296000000)}'
      GROUP BY
        t.eth_from_address
      ORDER BY
        count(DISTINCT t.eth_to_address) desc
      `
    const query = {
      sql: sql,
      ttlMinutes: 10,
      timeoutMinutes: 2
    }
    const results = await flipside.query.run(query)
    if (!results || !results.records.length) {
      return { holders: [] }
    }

    // change the global web3 object to the correct chain
    web3 = await new Web3(process.env[`${chain.toUpperCase()}_ALCHEMY_API_URL`] + process.env.ALCHEMY_API_KEY)

    // use multicall contract to check multiple addresses at onces
    const contract = await new web3.eth.Contract(wiz_abi, process.env[`${chain.toUpperCase()}_WALLET_WIZ_ADDRESS`])

    const is_contract = await contract.methods.multiIsContract(
      results.records.map((h) => h.funder)
    ).call()

    var nonContractFunders = []
    for (let i = 0; i < is_contract.length; i++) {
      if (!is_contract[i]) {
        nonContractFunders.push(results.records[i])
      }
    }

    return { common_funders: nonContractFunders };
  } catch (e) {
    console.log(e);
    if (retries > 5) {
      return { err: e }
    }
    retries++;
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    return await commonFunders(holders, retries, chain, timestamp);
  }
}

exports.commonFunders = commonFunders