require('dotenv').config();
const Web3 = require('web3');
const erc20abi = require('../static/erc20_abi.json')
const { Flipside } = require("../@flipsidecrypto/sdk/dist/src");
const flipside = new Flipside(
  process.env.FLIPSIDE_API_KEY,
  "https://node-api.flipsidecrypto.com"
)
const { unixTimeToString } = require('./utils')

const null_address = '0x0000000000000000000000000000000000000000'
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const alchemy_time = process.env.ALCHEMY_TIME
var web3;

/*
    Gets the top 50 holders of a token, and their address labels if present
    note: we need to handle the case where there too many transfers to handle ( > 10000 )
      - we parse the blocks that are given to us by web3js in the error message
      - keep going from the given blocks until the to_block returned in handleGetTransfers is 'latest'
      - if it will take more than 50 eth_getLogs calls we query flipside instead
*/
const top50Holders = async (token_address, from_block, to_block, retries, chain) => {
  var start = new Date()
  // change the global web3 object to the correct chain
  web3 = await new Web3(process.env[`${chain.toUpperCase()}_ALCHEMY_API_URL`] + process.env.ALCHEMY_API_KEY)
  
  // get total supply for calculating % holding
  const token_contract = await new web3.eth.Contract(erc20abi, token_address)
  const total_supply = await token_contract.methods.totalSupply().call({}, to_block)
  
  // for estimating number of calls
  const latest_block = to_block == 'latest' ? await web3.eth.getBlockNumber() : to_block 

  // handle fetching the transfers, error handling, and route to flipside if needed
  const transfers = await handleGetTransfers(token_address, from_block, to_block)
  if (transfers.err) {
    var wait_time = (retries * 3000) + (3000 * Math.random())
    await sleep(wait_time)
    return retries >= 5 ? transfers : await top50Holders(token_address, from_block, to_block, retries + 1, chain)
  }

  // keep getting the transfers until we have all of them, up until the current block
  while (transfers[1] != to_block) {
    var wait_time = (alchemy_time * 5) - ((new Date()).getTime() - start.getTime())
    await sleep(wait_time > 0 ? wait_time : 0)
    start = new Date()
    var newTransfers = await handleGetTransfers(token_address, transfers[1], to_block)

    if (newTransfers.err) {
      var wait_time = (retries * 3000) + (3000 * Math.random())
      await sleep(wait_time)
      return retries >= 5 ? transfers : await top50Holders(token_address, from_block, to_block, retries + 1, chain)
    }

    transfers[0] = transfers[0].concat(newTransfers[0])

    // if we are more than 20 calls away from finishing we query flipside instead
    if ((newTransfers[1] - transfers[1]) / (latest_block - transfers[1]) < 0.05) {
      console.log((newTransfers[1] - transfers[1]) / (latest_block - transfers[1]) + ' going to flipside')
      return await flipsideTop50Holders(token_address, from_block, to_block, retries, chain, total_supply)
    }
    transfers[1] = newTransfers[1]
  }

  // calculate holdings from transfers
  var holdings = calculate_holdings(transfers[0]);
  for (let i = 0; i < holdings.length; i++) {
    holdings[i].holding = holdings[i].holding / total_supply
  }

  // gets address labels from flipside
  var result = await handleGetLabels(holdings.slice(0, 50), 0, chain)
  return result
}

exports.top50Holders = top50Holders

/*
    Handles fetching the transfers
    note: if there is too many transfers, an error is thrown
       - we match with regex to find the block numbers kindly provided by web3js to use
       - make sure to return the latest block we checked so caller knows it's not complete
*/
const handleGetTransfers = async (token_address, from_block, to_block) => {
  const contract = await new web3.eth.Contract(erc20abi, token_address)
  try {
    const events = await contract.getPastEvents('Transfer', {
      fromBlock: from_block,
      toBlock: to_block
    })
    return [events, to_block]
  } catch (e) {
    const regex = /\[(.*)\]/; // match an array in the return statment
    const match = e.message.match(regex); // match the array
    if (!match) {
      console.log(e)
      return { err: e } // if web3js does not give block numbers then we should return an error
    }
    const hexRegex = /0x[0-9a-fA-F]+/g;
    var blocks = match[0].match(hexRegex) // match the hexadecimal block numbers
    blocks[0] = parseInt(blocks[0], 16)
    blocks[1] = parseInt(blocks[1], 16)

    return await handleGetTransfers(token_address, blocks[0], blocks[1])
  }
}

/*
    After fetching holders and balances we query flipside to get labels
    This gives us detection for things like hot wallets
    holdings = [{address: string}]
*/
const handleGetLabels = async (holdings, retries, chain) => {

  try {
    const values = holdings.map(
      obj => `'${obj.address.toLowerCase()}'`
    ).join(',');
    const query = {
      sql: `
                select
                  l.address,
                  l.address_name
                from
                  ${chain}.core.dim_labels l
                where
                  l.address in (${values})
                
            `,
      ttlMinutes: 60,
      timeoutMinutes: 0.5
    }
    const result = await flipside.query.run(query)

    // mutate the holdings parameter to now contain address names
    for (let i = 0; i < result ? result.records.length : 0; i++) {
      for (let j = 0; j < holdings.length; j++) {
        if (result.records[i].address == holdings[j].address) {
          holdings[j].address_name = result.records[i].address_name
        }
      }
    }
    return { holders: holdings }
  } catch (e) {
    console.log(e)
    if (retries > 5) {
      return { err: e }
    }
    var wait_time = (retries * 2000) + (6000 * Math.random())
    await sleep(wait_time)
    return await handleGetLabels(holdings, retries + 1, chain)
  }

}

/*
    If a token has a lot of transfers it's faster to pull from flipside instead of using getLogs
    We query flipside and have the same resulting data shape at the end
*/
const flipsideTop50Holders = async (token_address, from_block, to_block, retries, chain, total_supply) => {
  try {
    const first_block = await web3.eth.getBlock(from_block)
    const second_block = await web3.eth.getBlock(to_block)
    const query = {
      sql: `
          select top 50
            t.address,
            l.address_name,
            holding
          from
            (
              select
                sum(total) as holding,
                address
              from
                (
                  select
                    sum(
                      RAW_AMOUNT
                    ) as total,
                    TO_ADDRESS as address
                  from
                    ${chain}.core.fact_token_transfers a
                  where
                    a.block_timestamp > '${unixTimeToString(first_block.timestamp - 604800)}' and 
                    ${to_block != 'latest' ? `a.block_timestamp < '${unixTimeToString(second_block.timestamp)}' and ` : ''}
                    a.contract_address = LOWER('${token_address}')
                  group by
                    2
                  union all
                  select
                    - sum(
                      RAW_AMOUNT
                    ) as total,
                    FROM_ADDRESS as address
                  from
                    ${chain}.core.fact_token_transfers a
                  where
                    a.block_timestamp > '${unixTimeToString(first_block.timestamp - 604800)}' and 
                    ${to_block != 'latest' ? `a.block_timestamp < '${unixTimeToString(second_block.timestamp)}' and ` : ''}
                    a.contract_address = LOWER('${token_address}')
                  group by
                    2
                ) t
              group by
                address
            ) t
            left join ${chain}.core.dim_labels l on t.address = l.address
          where
            holding >= 1
          order by
            holding desc
          `,
      ttlMinutes: 10,
      timeoutMinutes: 2
    };
    const result = await flipside.query.run(query)
    for (let i = 0; i < (result.records ? result.records.length : 0); i++) {
      result.records[i].holding = result.records[i].holding / total_supply
    }
    return { holders: result.records }
  } catch (e) {
    console.log(e)
    if (retries > 5) {
      return { err: e }
    }
    var wait_time = (retries * 2000) + (6000 * Math.random())
    await sleep(wait_time)
    return await flipsideTop50Holders(token_address, from_block, to_block, retries + 1, chain)
  }

}

/*
    Accepts an array of transfer logs
    calculates the holdings for each address
    returns sorted list of holdings, 
     - first element in each entry is the address, second element is the holding
*/
const calculate_holdings = (transfers) => {
  var holdings = {}

  // sum holdings using hashmap
  for (var i = 0; i < transfers.length; i++) {
    var is_mint = transfers[i].returnValues.from == null_address
    var is_burn = transfers[i].returnValues.to == null_address
    holdings[transfers[i].returnValues.from] = (holdings[transfers[i].returnValues.from] || 0) - (is_mint ? 0 : Number(transfers[i].returnValues.value))
    holdings[transfers[i].returnValues.to] = (holdings[transfers[i].returnValues.to] || 0) + (is_burn ? 0 : Number(transfers[i].returnValues.value))
  }

  // convert hashmap into array of objects [{address: string, holding: number}]
  // sorted desc by holding
  holdings = Object.entries(holdings)
  holdings.sort((a, b) => b[1] - a[1]);
  holdings = holdings.map(([key, value]) => ({
    address: key.toLowerCase(),
    holding: value
  }))

  return holdings
}

// main('0x8646e185a388f42Fbf0087Cd75d6E1F95084D08B')
//top50Holders('0x0fE0Ed7F146Cb12e4B9759afF4FA8d34571802ca', 'earliest', 'latest', 0, 'ethereum')