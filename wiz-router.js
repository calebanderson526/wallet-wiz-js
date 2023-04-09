const express = require("express");
const bodyParser = require('body-parser');
const router = express.Router()
router.use(bodyParser.json())


const {contractNames} = require('./src/contractNames')
const {walletValues} = require('./src/walletValues')
const {rugVsApe} = require('./src/rugVsApe')
const {top50Holders} = require('./src/top50Holders')
const {walletTimeStats} = require('./src/walletTimeStats')
const {earlyAlpha} = require('./src/earlyAlpha')
const {commonFunders} = require('./src/commonFunders')
const {timestamp_to_block} = require('./src/utils')

const { response_handler, check_chain } = require('./src/middleware');

router.post('/:chain/holders', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { address, from_block, to_block } = req.body;
    const holders = await top50Holders(address, from_block, to_block, 0, req.params.chain);
    await response_handler(req, res, holders, start)
});

router.post('/:chain/contract-names', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders } = req.body;
    var contract_names = await contractNames(holders, 0, req.params.chain)
    await response_handler(req, res, contract_names, start)
});

router.post('/:chain/holder-balances', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders } = req.body;
    var holder_balances = await walletValues(holders, 0, req.params.chain)
    await response_handler(req, res, holder_balances, start)
});

router.post('/:chain/holder-rug-vs-ape', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders } = req.body;
    var holder_rug_vs_ape = await rugVsApe(holders, 0, req.params.chain)
    await response_handler(req, res, holder_rug_vs_ape, start)
});

router.post('/:chain/wallet-time-stats', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders } = req.body;
    var time_stats = await walletTimeStats(holders, 0, req.params.chain)
    await response_handler(req, res, time_stats, start)
});

router.post('/:chain/early-alpha', async (req, res) => {
    if(check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders } = req.body;
    var early_alpha = await earlyAlpha(holders, 0, req.params.chain)
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

router.post('/:chain/common-funders', async (req, res) => {
    if (check_chain(req, res)) {
        return
    }
    var start = new Date()
    const { holders, timestamp } = req.body
    var common_funders = await commonFunders(holders, 0, req.params.chain, timestamp)
    await response_handler(req, res, common_funders, start)
})

module.exports = router