const express = require('express');
const bodyParser = require('body-parser');
const {
    merge_holders, 
    get_contract_names, 
    get_holder_balances, 
    get_holder_rug_vs_ape, 
    get_holders, 
    get_wallet_time_stats 
} = require('./WalletWiz');
const { calculate_scores } = require('./HealthScore')
const cors = require('cors')
const app = express();
app.use(cors())

// Set up middleware to parse request bodies as JSON
app.use(bodyParser.json());
app.get('/', async (req, res) => {
    res.json({message: 'hi'})
})
// Define routes
app.post('/api/v1/get-holders', async (req, res) => {
    var start = new Date()
    const { address, start_date } = req.body;
    console.log('get holders')
    const holders = await get_holders(address, start_date, 0);
    if (holders.length === 0) {
        console.log(`/api/v1/get-holders response time: ${new Date() - start}`)
        res.status(400).json({ message: 'invalid token address or no holders detected' })
    } else if (holders.err) {
        res.status(500).json( {message: 'Something went wrong on our end possible server overload', error: holders.err} )
    } else {
        console.log(`/api/v1/get-holders response time: ${new Date() - start}`)
        res.json(holders);
    }
});

app.post('/api/v1/get-contract-names', async (req, res) => {
    var start = new Date()
    const { holders } = req.body;
    console.log('get contract names')
    var contract_names = await get_contract_names(holders, 0)
    if (contract_names.err) {
        res.status(500).json( {message: 'Something went wrong on our end possible server overload', error: holders.err} )
    } else {
        console.log(`/api/v1/get-contract-names response time: ${new Date() - start}`)
        const mergedContractNames = merge_holders(holders, contract_names);
        res.json(mergedContractNames);
    }
});

app.post('/api/v1/get-holder-balances', async (req, res) => {
    var start = new Date()
    const { holders } = req.body;
    console.log('get holder balances')
    var holder_balances = await get_holder_balances(holders, 0)
    if (holder_balances.length === 0) {
        console.log(`response time: ${new Date() - start}`)
        res.status(400).json({ message: 'invalid request no data found' })
    } else if (holder_balances.err) {
        res.status(500).json( {message: 'Something went wrong on our end possible server overload', error: holders.err} )
    } else {
        console.log(`/api/v1/get-holder-balances response time: ${new Date() - start}`)
        const mergedHolderBalances = merge_holders(holders, holder_balances);
        res.json(mergedHolderBalances);
    }
});

app.post('/api/v1/get-holder-rug-vs-ape', async (req, res) => {
    var start = new Date()
    const { holders } = req.body;
    console.log('get holder rug vs ape')
    var holder_rug_vs_ape = await get_holder_rug_vs_ape(holders, 0)
    if (holder_rug_vs_ape.length === 0) {
        console.log(`response time: ${new Date() - start}`)
        res.status(400).json({ message: 'invalid request no data found' })
    } else if (holder_rug_vs_ape.err) {
        res.status(500).json( {message: 'Something went wrong on our end possible server overload', error: holders.err} )
    } else {
        console.log(`/api/v1/get-holder-rug-vs-ape response time: ${new Date() - start}`)
        const mergedHolderRugVsApe = merge_holders(holders, holder_rug_vs_ape);
        res.json(mergedHolderRugVsApe);
    }
});

app.post('/api/v1/get-wallet-time-stats', async (req, res) => {
    var start = new Date()
    const { holders } = req.body;
    console.log('get time stats')
    var time_stats = await get_wallet_time_stats(holders, 0)
    if (time_stats.length === 0) {
        console.log(`response time: ${new Date() - start}`)
        res.status(400).json({ message: 'invalid request no data found' })
    } else if (time_stats.err) {
        res.status(500).json( {message: 'Something went wrong on our end possible server overload', error: holders.err} )
    } else {
        console.log(`/api/v1/get-wallet-time-stats response time: ${new Date() - start}`)
        const mergedWalletTimeStats = merge_holders(holders, time_stats);
        res.json(mergedWalletTimeStats);
    }
});

app.post('/api/v1/calculate-scores', async (req, res) => {
    var start = new Date()
    const { holders } = req.body;
    console.log('calculate scores')
    var scores = calculate_scores(holders)
    if (scores.length === 0) {
        console.log(`response time: ${new Date() - start}`)
        res.status(400).json({ message: 'invalid request no data found' })
    } else if (scores.err) {
        res.status(500).json( {message: 'Something went wrong on our end possible server overload', error: holders.err} )
    } else {
        console.log(`/api/v1/calculate-scores response time: ${new Date() - start}`)
        const mergedWalletScores = merge_holders(holders, scores);
        res.json(mergedWalletScores);
    }
});

// Start server
app.listen(8081, () => {
    console.log('Server started on port 8081');
});
