require('dotenv').config();
const { Flipside } = require("../@flipsidecrypto/sdk/dist/src");
const eth_token_data = require('../static/eth-wiz-rug-data-current.json')
const arb_token_data = require('../static/arb-wiz-token-data-current.json')
const { merge_holders } = require('./middleware')

const flipside = new Flipside(
  process.env.FLIPSIDE_API_KEY,
  "https://node-api.flipsidecrypto.com"
)


const sleep = ms => new Promise(r => setTimeout(r, ms));

const earlyAlpha = async (holders, retries, chain) => {
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
        ttlMinutes: 10,
        timeoutMinutes: 4
      }
      var query_result = await flipside.query.run(query)
      var queryResult = query_result.records
  
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
      return await earlyAlpha(holders, retries, chain);
    }
  }
  exports.earlyAlpha = earlyAlpha