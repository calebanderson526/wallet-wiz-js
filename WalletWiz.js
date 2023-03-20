require('dotenv').config();
const Web3 = require('web3');
const { Flipside, Query, QueryResultSet } = require("./@flipsidecrypto/sdk");
const erc20_abi = require("./erc20_abi.json");
const axios = require('axios');
const { calculate_scores } = require('./HealthScore')


const flipside = new Flipside(
  process.env.FLIPSIDE_API_KEY,
  "https://node-api.flipsidecrypto.com"
)
const alchemy_endpoint = process.env.ALCHEMY_API_URL + process.env.ALCHEMY_API_KEY
const web3 = new Web3(alchemy_endpoint)
const arbiscan_url = process.env.ARBISCAN_API_URL
const arbiscan_key = process.env.ARBISCAN_API_KEY
const dex_screener_url = process.env.DEXSCREENER_API_URL
const alchemy_time = 40

const erc20_balance_checks = [
  {
    'symbol': 'USDC',
    'address': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    'contract': new web3.eth.Contract(
      erc20_abi,
      '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
    )
  },
  {
    'symbol': 'USDT',
    'address': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    'contract': new web3.eth.Contract(
      erc20_abi,
      '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    )
  },
  {
    'symbol': 'WETH',
    'address': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    'contract': new web3.eth.Contract(
      erc20_abi,
      '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
    )
  }
]

const sleep = ms => new Promise(r => setTimeout(r, ms));

const test_token = async (token_address) => {
  var holders = await get_holders(token_address)
  if (!holders) {
    console.log('!holders')
    return { error: 'no holders detected' }
  } else if (holders.length == 0) {
    return { error: 'no holders detected' }
  }
  var contract_named_holders = await get_contract_names(holders)
  var balances_holders = await get_holder_balances(holders)
  var rug_vs_ape_holders = await get_holder_rug_vs_ape(holders)
  var time_stats_holders = await get_wallet_time_stats(holders)
  holders = merge_holders(holders, contract_named_holders)
  holders = merge_holders(holders, balances_holders)
  holders = merge_holders(holders, rug_vs_ape_holders)
  holders = merge_holders(holders, time_stats_holders)
  holders = calculate_scores(holders)

  return holders
}
exports.test_token = test_token

const merge_holders = (holders1, holders2) => {
  var merged = [];
  for (let i = 0; i < holders1.length; i++) {
    merged.push({
      ...holders1[i],
      ...(holders2.find((item) => item.address == holders1[i].address))
    })
  }
  return merged
}
exports.merge_holders = merge_holders

function unixTimeMillisToString(timestamp_ms) {
  // Convert the Unix timestamp from milliseconds to seconds
  var threeDaysInMs = 432000 / 2
  var timestamp_sec = timestamp_ms / 1000
  timestamp_sec -= threeDaysInMs

  // Use the Date constructor to convert the timestamp to a Date object
  const date = new Date(timestamp_sec * 1000);

  // Use the Date object methods to construct the date string in the desired format
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  const dateString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;

  return dateString;
}


const get_holders = async (token_address, start_date, retries) => {
  try {
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
                  RAW_AMOUNT / concat(
                    '1e',
                    (
                      select
                        decimals
                      from
                        arbitrum.core.dim_contracts c
                      where
                        c.address = LOWER('${token_address}')
                    )
                  )
                ) as total,
                TO_ADDRESS as address
              from
                arbitrum.core.fact_token_transfers a
              where
                a.block_timestamp > '${unixTimeMillisToString(start_date)}' and 
                a.contract_address = LOWER('${token_address}')
              group by
                2
              union all
              select
                - sum(
                  RAW_AMOUNT / concat(
                    '1e',
                    (
                      select
                        decimals
                      from
                        arbitrum.core.dim_contracts c
                      where
                        c.address = LOWER('${token_address}')
                    )
                  )
                ) as total,
                FROM_ADDRESS as address
              from
                arbitrum.core.fact_token_transfers a
              where
                a.block_timestamp > '${unixTimeMillisToString(start_date)}' and 
                a.contract_address = LOWER('${token_address}')
              group by
                2
            ) t
          group by
            address
        ) t
        left join arbitrum.core.dim_labels l on t.address = l.address
      where
        holding >= 1
      order by
        holding desc
      `,
      ttlMinutes: 10
    };
    const result = await flipside.query.run(query)
    return result.records
  } catch (e) {
    console.log(e, retries)
    if (retries > 5) {
      return {err: e}
    }
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    var tmp = retries + 1
    console.log(tmp)
    return await get_holders(token_address, start_date, tmp)
  }
}
exports.get_holders = get_holders

const get_contract_names = async (holders, retries) => {
  var byte_codes = []

  try {

    for (let i = 0; i < holders.length; i++) {
      var holder = holders[i]
      byte_codes.push(await web3.eth.getCode(holder.address))
      await sleep(alchemy_time)
    }

    return await update_is_contract_names(byte_codes, holders, 0)

  } catch (e) {

    console.log(e)
    if (retries > 5) {
      return {err: e}
    }
    retries += 1
    await sleep((Math.random() * 6) + (2 * retries) * 1000)
    return await get_contract_names(holders, retries)
  }
}
exports.get_contract_names = get_contract_names

const update_is_contract_names = async (byte_codes, holders, retries) => {
  try {
    var source_codes = []
    // do the api calls
    for (let i = 0; i < byte_codes.length; i++) {
      if (byte_codes[i] == '0x') {
        holders[i].is_contract = false
        continue
      }
      var query_str = `?module=contract&action=getsourcecode&address=${holders[i].address}&apikey=`
      source_codes.push(await axios.get(arbiscan_url + query_str + arbiscan_key))
      await sleep(220)
    }
    // update the table
    let j = 0
    for (let i = 0; i < byte_codes.length; i++) {
      if (byte_codes[i] == '0x') {
        continue
      }
      var name = source_codes[j].data.result[0].ContractName
      holders[i].address_name = name != '' && name ? name : 'Unverified Contract'
      holders[i].is_contract = true
      j += 1
    }
  } catch (e) {
    console.log(e)
    if (retries > 5) {
      return {err: e}
    }
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    retries += 1
    return await update_is_contract_names(byte_codes, holders, retries)
  }
  return holders
}

const get_holder_balances = async (holders, retries) => {
  var eth_balances = {}
  var erc20_balances = {}
  try {
    for (let i = 0; i < holders.length; i++) {
      eth_balances[holders[i].address] = await web3.eth.getBalance(holders[i].address)
      await sleep(alchemy_time)
      var erc20_bals = []

      for (let j = 0; j < erc20_balance_checks.length; j++) {
        var cur_erc20_bal = await erc20_balance_checks[j].contract.methods.balanceOf(holders[i].address).call()
        erc20_bals.push({
          symbol: erc20_balance_checks[j]['symbol'],
          contractAddress: erc20_balance_checks[j]['address'],
          tokenBalance: cur_erc20_bal
        })
        await sleep(alchemy_time)
      }
      erc20_balances[holders[i].address] = erc20_bals
    }

    var query_str = '?module=stats&action=ethprice&apikey='
    var eth_price = await axios.get(`${arbiscan_url}${query_str}${arbiscan_key}`)

    for (let i = 0; i < holders.length; i++) {
      var holder = holders[i]
      var eth_bal = (eth_balances[holder.address] / Math.pow(10, 18))
      var usd_bal = eth_bal * eth_price.data.result.ethusd

      for (let j = 0; j < erc20_balances[holder.address].length; j++) {
        var erc20_bal = erc20_balances[holder.address][j]
        if (erc20_bal.symbol == 'WETH') {
          var weth_bal = await erc20_bal.tokenBalance / Math.pow(10, 18)
          usd_bal += weth_bal * eth_price.data.result.ethusd
          continue
        }
        var stable_bal = await erc20_bal.tokenBalance / Math.pow(10, 18)
        usd_bal += stable_bal
      }
      holders[i].wallet_value = usd_bal
    }
    return holders
  } catch (e) {
    console.log(e)
    if (retries > 5) {
      return {err: e}
    }
    var time_to_sleep = ((Math.random() * 10) + (2 * retries)) * 1000
    console.log(time_to_sleep)
    await sleep(time_to_sleep)
    retries += 1
    return await get_holder_balances(holders, retries)
  }
}
exports.get_holder_balances = get_holder_balances

const get_holder_rug_vs_ape = async (holders, retries) => {
  try {
    var addresses_to_check = []
    for (let i = 0; i < holders.length; i++) {
      if (!holders[i]['is_contract'] && !holders[i].address_name) {
        addresses_to_check.push(holders[i].address)
      }
    }
    var addr_with_quotes = addresses_to_check.map(addr => `'${addr}'`)
    var addr_str = addr_with_quotes.join(',')
    var sql = `
    SELECT
      from_address AS address,
      contract_address
    FROM
      arbitrum.core.fact_token_transfers
    WHERE
      from_address IN (${addr_str})
    GROUP BY
      address,
      contract_address
    `

    const query = {
      sql: sql,
      ttlMinutes: 10
    }
    var query_result = await flipside.query.run(query)
    let holder_to_rug_count = {};
    let holder_to_ape_count = {};
    let token_to_holders = {};
    let unique_tokens = [];

    for (let row of query_result.records) {
      if (!unique_tokens.includes(row['contract_address'])) {
        unique_tokens.push(row['contract_address']);
      }

      let cur = token_to_holders[row['contract_address']] || [];
      cur.push(row['address']);
      token_to_holders[row['contract_address']] = cur;
      holder_to_ape_count[row['address']] = (holder_to_ape_count[row['address']] || 0) + 1;
    }

    var tokens_with_quotes = unique_tokens.map(token => `'${token}'`)
    var token_str = tokens_with_quotes.join(',')
    console.log('done with 1st rug vs ape query')

    var sql2 = `
      SELECT
        a.contract_address
      FROM
        arbitrum.core.fact_token_transfers a
      WHERE
        a.contract_address in (${token_str})
        and datediff(hour, a.block_timestamp, getDate()) < 11
    `
    const query2 = {
      sql: sql2,
      ttlMinutes: 10
    }
    var query_result2 = await flipside.query.run(query2)
    var found_rugs = []
    for (let token of unique_tokens) {
      var test = query_result2.records.find(x => x.contract_address == token)
      if (!test) {
        found_rugs.push(token)
        for (let h of token_to_holders[token]) {
          holder_to_rug_count[h] = (holder_to_rug_count[h] || 0) + 1;
        }
      }
    }

    for (let i = 0; i < holders.length; i++) {
      for (let ha in holder_to_ape_count) {
        if (ha === holders[i]['address']) {
          holders[i]['ape_count'] = holder_to_ape_count[ha];
        }
      }
    }

    for (let i = 0; i < holders.length; i++) {
      for (let ha in holder_to_rug_count) {
        if (ha === holders[i]['address']) {
          holders[i]['rug_count'] = holder_to_rug_count[ha];
        }
      }
      if (!holders[i]['rug_count']) {
        holders[i]['rug_count'] = 0;
      }
      if (!holders[i]['ape_count']) {
        holders[i]['ape_count'] = 0;
      }
    }
    return holders;

  } catch (e) {
    console.log(e)
    if (retries > 5) {
      return {err: e}
    }
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    retries += 1
    return await get_holder_rug_vs_ape(holders, retries)
  }
}
exports.get_holder_rug_vs_ape = get_holder_rug_vs_ape

const get_wallet_time_stats = async (holders, retries) => {
  try {
    let addresses_to_check = [];
    for (let h of holders) {
      if (!h.is_contract) {
        addresses_to_check.push(h.address);
      }
    }
    let sql = `
            SELECT
              txs.from_address,
              min(txs.block_timestamp) as first_tx,
              max(txs.block_timestamp) as last_tx,
              count(txs.tx_hash) as tx_count,
              datediff(day, first_tx, last_tx) as wallet_age,
              datediff(hour, first_tx, last_tx) / tx_count as avg_time
            from
              arbitrum.core.fact_transactions txs
            WHERE
              txs.from_address in (${addresses_to_check.map(a => `'${a}'`).join(', ')})
            group by
              txs.from_address
        `;

    const query = {
      sql: sql,
      ttlMinutes: 10
    }
    var query_result = await flipside.query.run(query)
    for (let r of query_result.records) {
      for (let i = 0; i < holders.length; i++) {
        let h = holders[i];
        if (h.address === r.from_address) {
          h.wallet_age = r.wallet_age;
          h.avg_time = r.avg_time;
          h.tx_count = r.tx_count;
        }
      }
    }

    return holders;
  } catch (e) {
    console.log(e);
    if (retries > 5) {
      return {err: e}
    }
    retries++;
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    return get_wallet_time_stats(holders, retries);
  }
}

exports.get_wallet_time_stats = get_wallet_time_stats
