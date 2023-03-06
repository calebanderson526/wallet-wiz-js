require('dotenv').config();
const Web3 = require('web3');
const  { Flipside, Query, QueryResultSet } = require("@flipsidecrypto/sdk");
const erc20_abi = require("./erc20_abi.json");

const web3 = new Web3(alchemy_endpoint)
const flipside = new Flipside(
    process.env.FLIPSIDE_API_KEY,
    "https://node-api.flipsidecrypto.com"
)
const alchemy_endpoint = process.env.ALCHEMY_API_URL + process.env.ALCHEMY_API_KEY
const arbiscan_url = process.env.ARBISCAN_API_URL
const arbiscan_key = process.env.ARBISCAN_API_KEY
const dex_screener_url = process.env.DEXSCREENER_API_URL

const erc20_balance_checks = [
    {
        'symbol': 'USDC',
        'address': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        'contract': web3.eth.contract(
            address = Web3.toChecksumAddress('0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'),
            abi = abi_json
        )
    },
    {
        'symbol': 'USDT',
        'address': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        'contract': web3.eth.contract(
            address = Web3.toChecksumAddress('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'),
            abi = abi_json
        )
    },
    {
        'symbol': 'WETH',
        'address': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        'contract': web3.eth.contract(
            address = Web3.toChecksumAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'),
            abi = abi_json
        )
    }
]

const sleep = ms => new Promise(r => setTimeout(r, ms));

exports.test_token = async (token_address) => {
    holders = await get_holders(token_adress)
}

const merge_holders = (holders1, holders2) => {

}

const get_holders = async (token_address) => {
    var retries = 0
    try {
        const query = {
            sql: `
            select distinct
                top 50
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
                        sum(RAW_AMOUNT / 1e18) as total,
                        TO_ADDRESS as address
                      from
                        arbitrum.core.fact_token_transfers a
                      where
                        a.contract_address = LOWER('${token_address}')
                      group by
                        2
                      union all
                      select
                        - sum(RAW_AMOUNT / 1e18) as total,
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
            ttlMinutes:10
        };
        const result = await flipside.query.run(query)
        return result.records
    } catch (e) {
        print(e)
        if (retries > 5) {
            process.exit()
        }
        await sleep(5000)
        retries += 1
        return get_holders(token_address)
    }
}

const get_contract_names = async (holders) => {

}

const update_is_contract_names = async (res, holders) => {

}

const get_holder_balances = async (holders) => {

}

const get_holder_rug_vs_ape = async (holders) => {

}

const get_wallet_time_stats = async (holders) => {

}
