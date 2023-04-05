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
    get_early_alpha
} = require('./WalletWiz');

const { response_handler, check_chain } = require('./middleware')

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

module.exports = router