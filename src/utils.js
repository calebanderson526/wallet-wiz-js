const { Flipside } = require("../@flipsidecrypto/sdk/dist/src");
const flipside = new Flipside(
    process.env.FLIPSIDE_API_KEY,
    "https://node-api.flipsidecrypto.com"
)

// helper to convert unix time to string YYYY-MM-DD HH:mm:SS.ms
const unixTimeToString = (timestamp_ms) => {

    // Use the Date constructor to convert the timestamp to a Date object
    const date = new Date(timestamp_ms);

    // Use the Date object methods to construct the date string in the desired format
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    const dateString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;

    return dateString;
}

exports.unixTimeToString = unixTimeToString

// get the closest block number to a timestamp on a chain
const timestamp_to_block = async (timestamp, chain, retries) => {
    try {
        const query = {
            sql: `
          SELECT
          top 1
            block_number
          FROM
            ${chain}.core.fact_blocks
          ORDER BY
            ABS(datediff(second, block_timestamp, '${unixTimeToString(timestamp)}'))
        `,
            ttlMinutes: 10,
            timeoutMinutes: 0.5
        }
        const result = await flipside.query.run(query)
        return { block_number: result.records[0].BLOCK_NUMBER }
    } catch (e) {
        console.log(e, retries)
        if (retries > 5) {
            return { err: e }
        }
        await sleep(((Math.random() * 6) + (2 * retries)) * 1000)
        var tmp = retries + 1
        return await timestamp_to_block(timestamp, chain, tmp)
    }
}

exports.timestamp_to_block = timestamp_to_block