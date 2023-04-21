require('dotenv').config();
const { Flipside } = require("../@flipsidecrypto/sdk/dist/src");
const eth_token_data = require('../static/eth-wiz-data-COMPLETE.json')
const arb_token_data = require('../static/arb-wiz-data-COMPLETE.json')

const flipside = new Flipside(
  process.env.FLIPSIDE_API_KEY,
  "https://node-api.flipsidecrypto.com"
)

// we exclude blue chips from this test as we are
// analyzing low mkt cap tokens
const token_exclusions = {
  arbitrum: [
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'.toLowerCase(), // usdt
    '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'.toLowerCase(), // usdc
    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'.toLowerCase(), // dai
    '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'.toLowerCase(), // weth
    '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f'.toLowerCase(), // wbtc
    '0x912CE59144191C1204E64559FE8253a0e49E6548'.toLowerCase(), // arb
    '0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978'.toLowerCase(), // crv
    '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F'.toLowerCase(), // frx
    '0x9623063377AD1B27544C965cCd7342f7EA7e88C7'.toLowerCase(), // grt
    '0x4D15a3A2286D883AF0AA1B3f21367843FAc63E07'.toLowerCase(), // tusd
    '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4'.toLowerCase(), // link
    '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0'.toLowerCase(), // uni
    '0xd4d42F0b6DEF4CE0383636770eF773390d85c61A'.toLowerCase(), // sushi
    '0x6ab707Aca953eDAeFBc4fD23bA73294241490620'.toLowerCase(), // aarbUSDT
    '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a'.toLowerCase(), // gmx
    '0x289ba1701C2F088cf0faf8B3705246331cB8A839'.toLowerCase(), // lpt
    '0x10393c20975cF177a3513071bC110f7962CD67da'.toLowerCase(), // jones
    '0x6C2C06790b3E3E3c38e12Ee22F8183b37a13EE55'.toLowerCase(), // dpx
    '0x51318B7D00db7ACc4026C88c3952B66278B6A67F'.toLowerCase(), // pls
    '0xa684cd057951541187f288294a1e1C2646aA2d24'.toLowerCase(), // vsta
    '0x080F6AEd32Fc474DD5717105Dba5ea57268F46eb'.toLowerCase(), // syn
    '0xd3f1Da62CAFB7E7BC6531FF1ceF6F414291F03D3'.toLowerCase(), // dbl
    '0xB5de3f06aF62D8428a8BF7b4400Ea42aD2E0bc53'.toLowerCase(), // brc
    '0x6694340fc020c5E6B96567843da2df01b2CE1eb6'.toLowerCase(), // stg
    '0x32Eb7902D4134bf98A28b963D26de779AF92A212'.toLowerCase(), // rdpx
    '0x3E6648C5a70A150A88bCE65F4aD4d506Fe15d2AF'.toLowerCase(), // spell
    '0xB2d948Be3a74ECCe80378D4093E6cD7f4dC1Cf9C'.toLowerCase()  // amx
  ],
  ethereum: [
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase(), // usdt
    '0xB8c77482e45F1F44dE1745F52C74426C631bDD52'.toLowerCase(), // bnb
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(), // usdc
    '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39'.toLowerCase(), // hex
    '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'.toLowerCase(), // steth
    '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0'.toLowerCase(), // matic
    '0x4Fabb145d64652a948d72533023f6E7A623C7C53'.toLowerCase(), // busd
    '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'.toLowerCase(), // shib
    '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(), // dai
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'.toLowerCase(), // uni
    '0x3883f5e181fccaF8410FA61e12b59BAd963fb645'.toLowerCase(), // theta
    '0x2AF5D2aD76741191D15Dfe7bF6aC92d4Bd912Ca3'.toLowerCase(), // leo
    '0x4d224452801ACEd8B2F0aebE155379bb5D594381'.toLowerCase(), // ape
    '0x58b6A8A3302369DAEc383334672404Ee733aB239'.toLowerCase(), // lpt
    '0xd26114cd6EE289AccF82350c8d8487fedB8A0C07'.toLowerCase(), // omg
    '0xab95E915c123fdEd5BDfB6325e35ef5515F1EA69'.toLowerCase(), // xnn
    '0xa3EE21C306A700E682AbCdfe9BaA6A08F3820419'.toLowerCase(), // g-cre
    '0xa3EE21C306A700E682AbCdfe9BaA6A08F3820419'.toLowerCase(), // vin
    '0x0D8775F648430679A709E98d2b0Cb6250d2887EF'.toLowerCase(), // bat
    '0x4DC3643DbC642b72C158E7F3d2ff232df61cb6CE'.toLowerCase(), // amb
    '0x0E69D0A2bbB30aBcB7e5CfEA0E4FDe19C00A8d47'.toLowerCase(), // iov
    '0x92e52a1A235d9A103D970901066CE910AAceFD37'.toLowerCase(), // ucash
    '0xe530441f4f73bDB6DC2fA5aF7c3fC5fD551Ec838'.toLowerCase(), // gse
    '0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b'.toLowerCase(), // cro
    '0x4092678e4E78230F46A1534C0fbc8fA39780892B'.toLowerCase(), // ocn
    '0x3845badAde8e6dFF049820680d1F14bD3903a5d0'.toLowerCase(), // sand
    '0x15D4c048F83bd7e37d49eA4C83a07267Ec4203dA'.toLowerCase(), // gala
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase()  // weth
  ]
}
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
        and contract_address not in (
          ${token_exclusions[chain.toLowerCase()].map((e) => (`'${e}'`)).join(',')}
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