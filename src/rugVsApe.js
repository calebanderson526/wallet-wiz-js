require('dotenv').config();
const { Flipside } = require("../@flipsidecrypto/sdk/dist/src");
const eth_token_data = require('../static/eth-wiz-data-COMPLETE.json')
const arb_token_data = require('../static/arb-wiz-data-COMPLETE.json')

const flipside = new Flipside(
  process.env.FLIPSIDE_API_KEY,
  "https://node-api.flipsidecrypto.com"
)


const sleep = ms => new Promise(r => setTimeout(r, ms));

/*
  Given a map of token => addresses that hold them,
  and a list of 'found rugs'
    - return how many times a holder has bough each token 
    - group by rugs vs apes
    - sort each list
*/
const commonRugsAndApes = (token_to_holders, found_rugs, token_to_name) => {
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

/*
  Get all the tokens each holder has transfered out of their account
  compare that to our list of rug tokens
  return each holders rug and ape count, as well as a list of common rugs and apes
*/
const rugVsApe = async (holders, retries, chain) => {
    try {
      var addresses_to_check = []
      for (let i = 0; i < holders.length; i++) {
        if (!holders[i]['is_contract'] && !holders[i].address_name) {
          addresses_to_check.push(holders[i].address)
        }
      }
      var addr_with_quotes = addresses_to_check.map(addr => `'${addr}'`)
      var addr_str = addr_with_quotes.join(',')
      // query flipside for all the 'apes'
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
        ttlMinutes: 10,
        timeoutMinutes: 2
      }
      var query_result = await flipside.query.run(query)
      let holder_to_rug_count = {};
      let holder_to_ape_count = {};
      let token_to_holders = {};
      let token_to_name = {}
      let unique_tokens = [];
      
      // find all the unique tokens
      // create a mapping of token => holder
      // create a mapping of holder => ape count
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
      console.log('done with rug vs ape query')
  
  
      if (chain == 'arbitrum') {
        var token_data = arb_token_data.filter((token) => token.is_rug)
      } else if (chain == 'ethereum') {
        var token_data = eth_token_data.filter((token) => token.is_rug)
      }
      
      // if the 'ape' is found as a rug, add it to found_rugs
      // also create a mapping of holder => rug count
      var found_rugs = []
      for (let token of unique_tokens) {
        var test = token_data.find(x => x.token_address.toLowerCase() == token)
        if (test) {
          found_rugs.push(token)
          for (let h of token_to_holders[token]) {
            holder_to_rug_count[h] = (holder_to_rug_count[h] || 0) + 1;
          }
        }
      }
      
      // mutate the holders parameter for their ape count
      for (let i = 0; i < holders.length; i++) {
        for (let ha in holder_to_ape_count) {
          if (ha === holders[i]['address']) {
            holders[i]['ape_count'] = holder_to_ape_count[ha];
          }
        }
      }

      // mutate holders list for rug count
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
      
      // get common rugs and apes
      var common_rugs_and_apes = commonRugsAndApes(token_to_holders, found_rugs, token_to_name)
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
      return await rugVsApe(holders, retries, chain)
    }
  }
  exports.rugVsApe = rugVsApe