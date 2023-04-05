const express = require("express");
const bodyParser = require('body-parser');
const router = express.Router()
router.use(bodyParser.json())

const {
    get_contract_names, 
    get_holder_balances, 
    get_holder_rug_vs_ape, 
    get_holders, 
    get_wallet_time_stats,
    get_early_alpha,
    timestamp_to_block,
    get_common_funders
} = require('./WalletWiz');

const { response_handler, check_chain } = require('./middleware');
const { ReturnConsumedCapacity } = require("@aws-sdk/client-dynamodb");

router.post('/:chain/holders', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { address, start_date, snapshot_time } = req.body;
    const holders = await get_holders(address, start_date, snapshot_time, 0, req.params.chain);
    await response_handler(req, res, holders, start)
});

router.post('/:chain/contract-names', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders } = req.body;
    var contract_names = await get_contract_names(holders, 0, req.params.chain)
    await response_handler(req, res, contract_names, start)
});

router.post('/:chain/holder-balances', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders } = req.body;
    var holder_balances = await get_holder_balances(holders, 0, req.params.chain)
    await response_handler(req, res, holder_balances, start)
});

router.post('/:chain/holder-rug-vs-ape', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders } = req.body;
    var holder_rug_vs_ape = await get_holder_rug_vs_ape(holders, 0, req.params.chain)
    await response_handler(req, res, holder_rug_vs_ape, start)
});

router.post('/:chain/wallet-time-stats', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders } = req.body;
    var time_stats = await get_wallet_time_stats(holders, 0, req.params.chain)
    await response_handler(req, res, time_stats, start)
});

router.post('/:chain/early-alpha', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders } = req.body;
    var early_alpha = await get_early_alpha(holders, 0, req.params.chain)
    await response_handler(req, res, early_alpha, start)
});

router.post('/:chain/timestamp-to-block', async (req, res) => {
    if (check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { timestamp } = req.body;
    var block_number = await timestamp_to_block(timestamp, chain, 0)
    await response_handler(req, res, block_number, start)
})

router.post('/:chain/commmon-funders', async (req, res) => {
    if (check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders, timestamp } = req.body
    var common_funders = await get_common_funders(holders, 0, req.params.chain, timestamp)
    await response_handler(req, res, common_funders, start)
})

module.exports = router