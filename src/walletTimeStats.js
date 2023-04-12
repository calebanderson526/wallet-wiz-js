require('dotenv').config();
const { Flipside } = require("../@flipsidecrypto/sdk/dist/src");

const flipside = new Flipside(
  process.env.FLIPSIDE_API_KEY,
  "https://node-api.flipsidecrypto.com"
)


const sleep = ms => new Promise(r => setTimeout(r, ms));

/*
  Computes aggregates for each holder [{address: string}]
    - first transaction time
    - last transaction time
    - number of transactions
    - average time between transactions
    - age of wallet
*/
const walletTimeStats = async (holders, retries, chain) => {
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
        ttlMinutes: 10,
        timeoutMinutes: 2
      }
      var query_result = await flipside.query.run(query)

      // mutate the holders parameter to then return
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
      return await walletTimeStats(holders, retries, chain);
    }
  }
  
  exports.walletTimeStats = walletTimeStats