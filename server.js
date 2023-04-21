require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const wiz_router = require('./wiz-router')
const cors = require('cors')
const {setupBot} = require('./src/TelegramHandler')
const {Telegraf} = require('telegraf')

const app = express();
// const testBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {handlerTimeout: 120_000})
const arbBot = new Telegraf(process.env.ARB_TELEGRAM_BOT_TOKEN, {handlerTimeout: 120_000})
const ethBot = new Telegraf(process.env.ETH_TELEGRAM_BOT_TOKEN, {handlerTimeout: 120_000})

app.use(cors())


app.get('/', async (req, res) => {
    res.json({ message: 'the server is online' })
})

app.use('/api/v1', wiz_router)

// setupBot(testBot, 'ethereum')
setupBot(arbBot, 'arbitrum')
setupBot(ethBot, 'ethereum')

// Start server
app.listen(process.env.PORT ? process.env.PORT : 8081, () => {
    console.log(`Server started on port ${process.env.PORT ? process.env.PORT : 8081}`);
});
