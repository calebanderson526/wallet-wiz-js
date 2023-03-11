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
    const { address } = req.body;
    console.log(req)
    const holders = await get_holders(address);
    if (holders.length == 0) {
        res.status(400).json({ message: 'invalid token address or no holders detected' })
    } else {
        res.json(holders);
    }
});

app.post('/api/v1/get-contract-names', async (req, res) => {
    const { holders } = req.body;
    console.log(req)
    const mergedContractNames = merge_holders(holders, await get_contract_names(holders));
    res.json(mergedContractNames);
});

app.post('/api/v1/get-holder-balances', async (req, res) => {
    const { holders } = req.body;
    const mergedHolderBalances = merge_holders(holders, await get_holder_balances(holders));
    res.json(mergedHolderBalances);
});

app.post('/api/v1/get-holder-rug-vs-ape', async (req, res) => {
    const { holders } = req.body;
    console.log(req)
    const mergedHolderRugVsApe = merge_holders(holders, await get_holder_rug_vs_ape(holders));
    res.json(mergedHolderRugVsApe);
});

app.post('/api/v1/get-wallet-time-stats', async (req, res) => {
    const { holders } = req.body;
    console.log(req)
    const mergedWalletTimeStats = merge_holders(holders, await get_wallet_time_stats(holders));
    res.json(mergedWalletTimeStats);
});

app.post('/api/v1/calculate-scores', async (req, res) => {
    const { holders } = req.body;
    console.log(req)
    const mergedWalletScores = merge_holders(holders, calculate_scores(holders));
    res.json(mergedWalletScores);
});

// Start server
app.listen(3005, () => {
    console.log('Server started on port 3005');
});