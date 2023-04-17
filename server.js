require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const wiz_router = require('./wiz-router')
const cors = require('cors')
const {handleTest} = require('./src/TelegramHandler')
const {Telegraf} = require('telegraf')

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

app.use(cors())


app.get('/', async (req, res) => {
    res.json({ message: 'the server is online' })
})

app.use('/api/v1', wiz_router)

// Message handler to respond to text messages
bot.command('test', async (ctx) => {
    try {
        console.log('handling tg request')
        const message = ctx.message.text;
        const reply = await handleTest(message, 0)
        ctx.replyWithMarkdownV2(reply);
    } catch (e) {
        ctx.replyWithMarkdownV2('Request failed, try again later.')
    }
});

// Start the bot using the polling method
bot.launch();

// Start server
app.listen(process.env.PORT ? process.env.PORT : 8081, () => {
    console.log(`Server started on port ${process.env.PORT ? process.env.PORT : 8081}`);
});
