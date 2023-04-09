require('dotenv').config();
const Web3 = require('web3');
const { Flipside } = require("./@flipsidecrypto/sdk/dist/src");
const erc20_abi = require("./static/erc20_abi.json");
const axios = require('axios');
const eth_token_data = require('./static/eth-wiz-rug-data-current.json')
const arb_token_data = require('./static/arb-wiz-token-data-current.json')
const { merge_holders } = require('./middleware')

const flipside = new Flipside(
  process.env.FLIPSIDE_API_KEY,
  "https://node-api.flipsidecrypto.com"
)
const arbiscan_url = process.env.ARBISCAN_API_URL
const arbiscan_key = process.env.ARBISCAN_API_KEY
const etherscan_url = process.env.ETHERSCAN_API_URL
const etherscan_key = process.env.ETHERSCAN_API_KEY
const alchemy_time = 40


const sleep = ms => new Promise(r => setTimeout(r, ms));

function unixTimeToString(timestamp_ms) {

  // Use the Date constructor to convert the timestamp to a Date object
  const date = new Date(timestamp_ms);

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

const timestamp_to_block = async (timestamp, chain, retries) => {
  try {
    const query = {
      sql: `
        SELECT
        top 1
          block_number
        FROM
          ${chain}.core.fact_blocks
        ORDER BY
          ABS(datediff(second, block_timestamp, '2021-02-17 06:20:55.000'))
      `,
      ttlMinutes: 10
    }
    const result = await flipside.query.run(query)
    return { block_number: result.records[0].BLOCK_NUMBER }
  } catch (e) {
    console.log(e, retries)
    if (retries > 5) {
      return { err: e }
    }
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    var tmp = retries + 1
    return await timestamp_to_block(timestamp, chain, tmp)
  }
}

exports.timestamp_to_block = timestamp_to_block

const get_holders = async (token_address, start_date, snapshot_time, retries, chain) => {
  try {
    var total_supply_time = snapshot_time == -1 ? start_date : snapshot_time
    var total_supply_block = await timestamp_to_block(unixTimeToString(total_supply_time), chain, 0)
    if (total_supply_block.err) return total_supply_block
    const alchemy_endpoint = process.env[`${chain.toUpperCase()}_ALCHEMY_API_URL`] + process.env.ALCHEMY_API_KEY
    const web3 = new Web3(alchemy_endpoint)
    const token_contract = await new web3.eth.Contract(erc20_abi, token_address)
    const total_supply = await token_contract.methods.totalSupply().call({}, total_supply_block.block)

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
                a.block_timestamp > '${unixTimeToString(start_date - 604800000)}' and 
                ${snapshot_time != -1 ? `a.block_timestamp < '${unixTimeToString(snapshot_time)}' and ` : ''}
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
                a.block_timestamp > '${unixTimeToString(start_date - 604800000)}' and 
                ${snapshot_time != -1 ? `a.block_timestamp < '${unixTimeToString(snapshot_time)}' and ` : ''}
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
      ttlMinutes: 1
    };
    const result = await flipside.query.run(query)
    const res = result.records.map(h => { h.holding = h.holding / total_supply; return h })
    return { holders: res }
  } catch (e) {
    console.log(e, retries)
    if (retries > 5) {
      return { err: e }
    }
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    var tmp = retries + 1
    console.log(tmp)
    return await get_holders(token_address, start_date, snapshot_time, tmp, chain)
  }
}
exports.get_holders = get_holders

const get_contract_names = async (holders, retries, chain) => {
  const alchemy_endpoint = process.env[`${chain.toUpperCase()}_ALCHEMY_API_URL`] + process.env.ALCHEMY_API_KEY
  const web3 = new Web3(alchemy_endpoint)
  var byte_codes = []

  try {

    for (let i = 0; i < holders.length; i++) {
      var holder = holders[i]
      byte_codes.push(await web3.eth.getCode(holder.address))
      await sleep(alchemy_time)
    }

    return await update_is_contract_names(byte_codes, holders, 0, chain)

  } catch (e) {

    console.log(e)
    if (retries > 5) {
      return { err: e }
    }
    retries += 1
    await sleep((Math.random() * 6) + (2 * retries) * 1000)
    return await get_contract_names(holders, retries, chain)
  }
}
exports.get_contract_names = get_contract_names

const update_is_contract_names = async (byte_codes, holders, retries, chain) => {
  try {
    var source_codes = []
    // do the api calls
    for (let i = 0; i < byte_codes.length; i++) {
      if (byte_codes[i] == '0x') {
        holders[i].is_contract = false
        continue
      }
      if (chain == 'arbitrum') {
        var query_str = `?module=contract&action=getsourcecode&address=${holders[i].address}&apikey=`
        source_codes.push(await axios.get(arbiscan_url + query_str + arbiscan_key))
      } else if (chain == 'ethereum') {
        var query_str = `?module=contract&action=getsourcecode&address=${holders[i].address}&apikey=`
        source_codes.push(await axios.get(etherscan_url + query_str + etherscan_key))
      }
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

    return { holders: holders }
  } catch (e) {
    console.log(e)
    if (retries > 5) {
      return { err: e }
    }
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    retries += 1
    return await update_is_contract_names(byte_codes, holders, retries)
  }
}

const get_holder_balances = async (holders, retries, chain) => {
  const alchemy_endpoint = process.env[`${chain.toUpperCase()}_ALCHEMY_API_URL`] + process.env.ALCHEMY_API_KEY
  const web3 = new Web3(alchemy_endpoint)

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
    return { 'holders': holders }
  } catch (e) {
    console.log(e)
    if (retries > 5) {
      return { err: e }
    }
    var time_to_sleep = ((Math.random() * 10) + (2 * retries)) * 1000
    console.log(time_to_sleep)
    await sleep(time_to_sleep)
    retries += 1
    return await get_holder_balances(holders, retries, chain)
  }
}
exports.get_holder_balances = get_holder_balances

const get_common_rugs_and_apes = (token_to_holders, found_rugs, token_to_name) => {
  const tokenKeys = Object.keys(token_to_holders);

  // Filter out the keys in found_rugs
  const tokenKeysNotInRugs = tokenKeys.filter(key => !found_rugs.includes(key));

  // Sort token_to_holders by the length of the arrays in descending order
  const sortedTokenHolders = tokenKeysNotInRugs.sort((a, b) => token_to_holders[b].length - token_to_holders[a].length);

  // Get the top 5 keys and their array lengths
  const top5KeysAndLengths = sortedTokenHolders.map(key => ({ address: key, count: token_to_holders[key].length }));

  // Repeat the above steps for the keys that are found in found_rugs
  const tokenKeysInRugs = tokenKeys.filter(key => found_rugs.includes(key));
  const sortedTokenHoldersInRugs = tokenKeysInRugs.sort((a, b) => token_to_holders[b].length - token_to_holders[a].length);
  const top5KeysAndLengthsInRugs = sortedTokenHoldersInRugs.map(key => ({ address: key, count: token_to_holders[key].length }));
  for (let rug of top5KeysAndLengthsInRugs) {
    rug.name = token_to_name[rug['address']]
  }

  for (let ape of top5KeysAndLengths) {
    ape.name = token_to_name[ape['address']]
  }

  return {
    apes: top5KeysAndLengths,
    rugs: top5KeysAndLengthsInRugs,
  };
}


const get_holder_rug_vs_ape = async (holders, retries, chain) => {
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
      contract_address,
      d.name
    FROM
      ${chain}.core.fact_token_transfers
      left join ${chain}.core.dim_contracts d on contract_address = d.address
    WHERE
      from_address IN (
        ${addr_str}
      )
    GROUP BY
      from_address,
      contract_address,
      d.name
    `

    const query = {
      sql: sql,
      ttlMinutes: 10
    }
    var query_result = await flipside.query.run(query)
    let holder_to_rug_count = {};
    let holder_to_ape_count = {};
    let token_to_holders = {};
    let token_to_name = {}
    let unique_tokens = [];

    for (let row of query_result.records) {
      if (!unique_tokens.includes(row['contract_address'])) {
        unique_tokens.push(row['contract_address']);
      }

      let cur = token_to_holders[row['contract_address']] || [];
      cur.push(row['address']);
      token_to_holders[row['contract_address']] = cur;
      holder_to_ape_count[row['address']] = (holder_to_ape_count[row['address']] || 0) + 1;
      token_to_name[row['contract_address']] = row.name
    }

    var tokens_with_quotes = unique_tokens.map(token => `'${token}'`)
    var token_str = tokens_with_quotes.join(',')
    console.log('done with 1st rug vs ape query')


    if (chain == 'arbitrum') {
      var sql2 = `
      SELECT
        a.contract_address as token_address
      FROM
        ${chain}.core.fact_token_transfers a
      WHERE
        a.contract_address in (${token_str})
        and datediff(hour, a.block_timestamp, getDate()) < 12
    `
      const query2 = {
        sql: sql2,
        ttlMinutes: 10
      }
      var rug_query_result = await flipside.query.run(query2)
      var token_data = rug_query_result.records
    } else if (chain == 'ethereum') {
      var token_data = eth_token_data.filter((token) => token.is_rug)
    }

    var found_rugs = []
    for (let token of unique_tokens) {
      var test = token_data.find(x => x.token_address == token)
      if ((test && chain == 'ethereum') || (!test && chain == 'arbitrum')) {
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

    var common_rugs_and_apes = get_common_rugs_and_apes(token_to_holders, found_rugs, token_to_name)
    var rug_length = common_rugs_and_apes.rugs.length
    var ape_length = common_rugs_and_apes.apes.length
    return {
      'holders': holders,
      'common_rugs': common_rugs_and_apes.rugs.slice(0, rug_length > 50 ? 50 : rug_length),
      'common_apes': common_rugs_and_apes.apes.slice(0, ape_length > 50 ? 50 : ape_length)
    };

  } catch (e) {
    console.log(e)
    if (retries > 5) {
      return { err: e }
    }
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    retries += 1
    return await get_holder_rug_vs_ape(holders, retries, chain)
  }
}
exports.get_holder_rug_vs_ape = get_holder_rug_vs_ape

const get_wallet_time_stats = async (holders, retries, chain) => {
  try {
    let addresses_to_check = [];
    for (let h of holders) {
      if (!h.address_name) {
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
              ${chain}.core.fact_transactions txs
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

    return { holders: holders };
  } catch (e) {
    console.log(e);
    if (retries > 5) {
      return { err: e }
    }
    retries++;
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    return await get_wallet_time_stats(holders, retries, chain);
  }
}

exports.get_wallet_time_stats = get_wallet_time_stats

const get_early_alpha = async (holders, retries, chain) => {
  let results = [];
  try {
    if (chain == 'arbitrum') {
      var token_data = arb_token_data
    } else if (chain == 'ethereum') {
      var token_data = eth_token_data
    }
    const addressesToCheck = holders.filter(holder => !holder.is_contract && !holder.address_name).map(holder => holder.address);
    let sql = `
      SELECT
        to_address AS address,
        contract_address,
        min(block_timestamp) as first_time
      FROM
        ${chain}.core.fact_token_transfers
      WHERE
        to_address IN (
          ${addressesToCheck.map(token => `'${token}'`).join(', ')}
        )
      GROUP BY
        to_address,
        contract_address
        `;
    const query = {
      sql: sql,
      ttlMinutes: 10
    }
    var query_result = await flipside.query.run(query)
    var queryResult = query_result.records
    console.log(queryResult.length)

    // Iterate over each row in the query result
    for (let i = 0; i < queryResult.length; i++) {
      let row = queryResult[i];
      let address = row.address;
      let contractAddress = row.contract_address;
      let firstTime = new Date(row.first_time);
      firstTime = firstTime.getTime() / 1000

      // Iterate over each object in the JSON array
      for (let j = 0; j < token_data.length; j++) {
        let obj = token_data[j];
        if (chain == 'ethereum' && !obj.is_alpha) {
          continue
        }
        let id = obj.token_address;
        let timeAt = (new Date(obj.first_pool)).getTime() / 1000;

        // Check if the contract address is in the JSON array and the first time is within 1 week of time_at
        //  && firstTime <= timeAt + (604800 * 10)
        var six_hours_in_seconds = 21600
        if (contractAddress == id && firstTime <= timeAt + (six_hours_in_seconds)) {
          // Check if this address is already in the results array
          let found = false;
          for (let k = 0; k < results.length; k++) {
            if (results[k].address === address) {
              results[k].early_alpha.push({ token_address: contractAddress, name: obj.name });
              found = true;
              break;
            }
          }

          // If the address isn't already in the results array, add it with the contract address as an early alpha
          if (!found) {
            results.push({ address: address, early_alpha: [{ token_address: contractAddress, name: obj.name }] });
          }
        }
      }
    }

    return { holders: merge_holders(holders, results) };
  } catch (e) {
    console.log(e);
    if (retries > 5) {
      return { err: e }
    }
    retries++;
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    return await get_early_alpha(holders, retries, chain);
  }
}
exports.get_early_alpha = get_early_alpha

const get_common_funders = async (holders, retries, chain, timestamp) => {
  try {
    const addressesToCheck = holders.filter(holder => !holder.is_contract && !holder.address_name).map(holder => holder.address);
    sql = `
    SELECT DISTINCT
      top 20
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
      ttlMinutes: 10
    }
    const results = await flipside.query.run(query)
    if (!results || !results.records.length) {
      return { holders: [] }
    }
    return { common_funders: results.records };
  } catch (e) {
    console.log(e);
    if (retries > 5) {
      return { err: e }
    }
    retries++;
    await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
    return await get_common_funders(holders, retries, chain, timestamp);
  }
}

exports.get_common_funders = get_common_funders
