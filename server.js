const express = require('express');
const bodyParser = require('body-parser');
const wiz_router = require('./wiz-router')
const cors = require('cors')

const app = express();

app.use(cors())


app.get('/', async (req, res) => {
    res.json({message: 'the server is online'})
})

app.use('/api/v1', wiz_router)

// Start server
app.listen(process.env.PORT ? process.env.PORT : 8081, () => {
    console.log(`Server started on port ${process.env.PORT ? process.env.PORT : 8081}`);
});
