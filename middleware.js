const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const handle_create_request_log = async (req, start, code) => {
    console.log(`${req.method + req.path} response time: ${(new Date()).getTime() - start.getTime()}`)
    await create_request_log(
        req.method,
        req.path,
        (new Date()).getTime() - start.getTime(),
        code
    )
}

const create_request_log = async (
    method,
    route,
    response_time,
    response_code
  ) => {
    const dynamoClient = new DynamoDBClient({ region: "us-east-1" }); // Replace "us-east-1" with your desired AWS region
  
    const timestamp = new Date().toISOString(); // Get the current timestamp in ISO format
  
    const id = Math.random().toString(36).slice(2); // Generate a random id
  
    const params = {
      TableName: "WalletWizRequestLog", // Replace with your table name
      Item: {
        id: { S: id },
        method: { S: method },
        route: { S: route },
        response_time: { N: response_time.toString() },
        response_code: { N: response_code.toString() },
        timestamp: { S: timestamp },
      },
    };
  
    const command = new PutItemCommand(params);
  
    try {
      const response = await dynamoClient.send(command);
      console.log(`Added request log with id ${id}`);
    } catch (err) {
      console.error(err);
    }
  }

  exports.handle_create_request_log = handle_create_request_log

  const merge_holders = (holders1, holders2) => {
    var merged = [];
    for (let i = 0; i < holders1.length; i++) {
      merged.push({
        ...holders1[i],
        ...(holders2.find((item) => item.address == holders1[i].address))
      })
    }
    return merged
  }
  exports.merge_holders = merge_holders

  const response_handler = async (req, res, body, start) => {
    if (body.holders && body.holders.length === 0) {
        await handle_create_request_log(req, start, 400)
        res.status(400).json({ message: 'invalid request no data found' })
    } else if (body.err) {
        await handle_create_request_log(req, start, 500)
        res.status(500).json( {message: 'Something went wrong on our end possible server overload', error: holders.err} )
    } else {
        await handle_create_request_log(req, start, 200)
        res.json(body);
    }
  }

  exports.response_handler = response_handler

  const check_chain = (req, res) => {
    var chain = req.params.chain
    if (chain != 'arbitrum' && chain != 'ethereum') {
        res.status(400).json({message: 'Invalid chain ' + chain}).send()
        return true
    }
    return false
  }

  exports.check_chain = check_chain