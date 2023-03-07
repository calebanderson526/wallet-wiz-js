require('dotenv').config();
const Web3 = require('web3');
const { Flipside, Query, QueryResultSet } = require("@flipsidecrypto/sdk");
const erc20_abi = require("./erc20_abi.json");
const axios = require('axios');


const flipside = new Flipside(
  process.env.FLIPSIDE_API_KEY,
  "https://node-api.flipsidecrypto.com"
)
const alchemy_endpoint = process.env.ALCHEMY_API_URL + process.env.ALCHEMY_API_KEY
const web3 = new Web3(alchemy_endpoint)
const arbiscan_url = process.env.ARBISCAN_API_URL
const arbiscan_key = process.env.ARBISCAN_API_KEY
const dex_screener_url = process.env.DEXSCREENER_API_URL
const alchemy_time = 0

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

exports.test_token = async (token_address) => {
  console.log(token_address)
  holders = await get_holders(token_address)
  var contract_named_holders = await get_contract_names(holders)
  var balances_holders = await get_holder_balances(holders)
  var rug_vs_ape_holders = await get_holder_rug_vs_ape(holders)
  var time_stats_holders = await get_wallet_time_stats(holders)
  holders = merge_holders(holders, contract_named_holders)
  holders = merge_holders(holders, balances_holders)
  holders = merge_holders(holders, rug_vs_ape_holders)
  holders = merge_holders(holders, time_stats_holders)

  return holders
}

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

const get_holders = async (token_address) => {
  var retries = 0
  try {
    const query = {
      sql: `
      select distinct
        top 50 t.address,
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
    console.log(e)
    if (retries > 5) {
      process.exit()
    }
    await sleep(5000)
    retries += 1
    return get_holders(token_address)
  }
}

const get_contract_names = async (holders) => {
  var retries = 0;
  var byte_codes = []

  try {

    for (let i = 0; i < holders.length; i++) {
      var holder = holders[i]
      byte_codes.push(await web3.eth.getCode(holder.address))
      await sleep(alchemy_time)
    }

    return await update_is_contract_names(byte_codes, holders)

  } catch (e) {

    console.log(e)
    if (retries > 5) {
      process.exit()
    }
    await sleep(5000)
    retries += 1
    return await get_contract_names(holders)
  }
}

const update_is_contract_names = async (byte_codes, holders) => {
  var retries = 0
  try {
    for (let i = 0; i < byte_codes.length; i++) {
      if (byte_codes[i] == '0x') {
        holders[i].is_contract = false
        continue
      }
      var query_str = `?module=contract&action=getsourcecode&address=${holders[i].address}`
      var source_code = await axios.get(arbiscan_url + query_str)
      var name = source_code.data.result[0].ContractName
      holders[i].address_name = name != '' && name ? name : 'Unverified Contract'
      holders[i].is_contract = true
      await sleep(200)
    }
  } catch (e) {
    console.log(e)
    if (retries > 5) {
      process.exit()
    }
    await sleep(5000)
    retries += 1
    return await update_is_contract_names(byte_codes, holders)
  }
  return holders
}

const get_holder_balances = async (holders) => {
  var retries = 0
  var eth_balances = {}
  var erc20_balances = {}
  try {
    for (let i = 0; i < holders.length; i++) {
      eth_balances[holders[i].address] = await web3.eth.getBalance(holders[i].address)
      await sleep(alchemy_time)
      var erc20_bals = []

      for (let j = 0; j < erc20_balance_checks.length; j++) {
        erc20_bals.push({
          symbol: erc20_balance_checks[j]['symbol'],
          contractAddress: erc20_balance_checks[j]['address'],
          tokenBalance: await erc20_balance_checks[j]
            .contract.methods.balanceOf(holders[i].address)
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
          var weth_bal = erc20_bal.tokenBalance / Math.pow(10, 18)
          usd_bal += weth_bal * eth_price.data.result.ethusd
          continue
        }
        var stable_bal = erc20_bal.tokenBalance / Math.pow(10, 18)
        usd_bal += stable_bal
      }
      holders[i].wallet_value = usd_bal
    }
    return holders
  } catch (e) {
    console.log(e)
    if (retries > 5) {
      process.exit()
    }
    await sleep(5000)
    retries += 1
    return await get_holder_balances(holders)
  }
}

const get_holder_rug_vs_ape = async (holders) => {
  var retries = 0
  try {
    var addresses_to_check = []
    for (let i = 0; i < holders.length; i++) {
      if (!holders[i]['is_contract']) {
        addresses_to_check.push(holders[i].address)
      }
    }
    var addr_with_quotes = addresses_to_check.map(addr => `'${addr}'`)
    var addr_str = addr_with_quotes.join(',')
    var sql = `
    select
      t1.contract_address,
      t1.origin_from_address
    from
      (
        Select
          e.contract_address,
          e.origin_from_address,
          sum(e.amount_in_usd) as usd_in,
          sum(e.amount_out_usd) as usd_out
        from
          arbitrum.sushi.ez_swaps e
        WHERE
          e.origin_from_address IN (${addr_str})
        group BY
          e.contract_address,
          e.origin_from_address
      ) t1
    `

    const query = {
      sql: sql,
      ttlMinutes: 10
    }
    var query_result = await flipside.query.run(query)
    let holder_to_rug_count = {};
    let holder_to_ape_count = {};
    let pair_to_holders = {};
    let unique_pairs = [];

    for (let row of query_result.records) {
      if (!unique_pairs.includes(row['contract_address'])) {
        unique_pairs.push(row['contract_address']);
      }

      let cur = pair_to_holders[row['contract_address']] || [];
      cur.push(row['origin_from_address']);
      pair_to_holders[row['contract_address']] = cur;
    }

    let i = 0;
    const dexscreener_max_batch = 30;

    while (i * dexscreener_max_batch < unique_pairs.length) {
      let cur_pairs = unique_pairs.slice(i * dexscreener_max_batch, (i + 1) * dexscreener_max_batch);
      let response = await axios.get(`${dex_screener_url}/dex/pairs/arbitrum/${cur_pairs.join(",")}`);
      let res = response.data
      await sleep(3000);
      for (let p of res['pairs']) {
        for (let h of pair_to_holders[p['pairAddress'].toLowerCase()]) {
          if (p['liquidity']['usd'] < 1000 || p['txns']['h6']['buys'] <= 0) {
            holder_to_rug_count[h] = (holder_to_rug_count[h] || 0) + 1;
          }
          holder_to_ape_count[h] = (holder_to_ape_count[h] || 0) + 1;
        }
      }
      i += 1;
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
      process.exit()
    }
    await sleep(5000)
    retries += 1
    return await get_holder_rug_vs_ape(holders)
  }
}

const get_wallet_time_stats = async (holders) => {
  let retries = 0;
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
      process.exit();
    }
    retries++;
    await sleep(5000);
    return get_wallet_time_stats(holders);
  }
}
