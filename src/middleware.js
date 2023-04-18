const { DynamoDBClient, PutItemCommand, UpdateItemCommand, GetItemCommand, AttributeValue } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")

/*
  Helper for formulating create_request_log params
  also logs to console the response time
*/
const handle_create_request_log = async (req, start, code) => {
  console.log(`${req.method + req.path} response time: ${(new Date()).getTime() - start.getTime()}`)
  await create_request_log(
    req.method,
    req.path,
    (new Date()).getTime() - start.getTime(),
    code
  )
}


/*
  Create a request log in aws dynamodb for each request to the backend
*/
const create_request_log = async (
  method,
  route,
  response_time,
  response_code
) => {
  const dynamoClient = new DynamoDBClient({ region: "us-east-1" });

  const timestamp = new Date().toISOString(); // Get the current timestamp in ISO format

  const id = Math.random().toString(36).slice(2); // Generate a random id

  const params = {
    TableName: "WalletWizRequestLog",
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

/*
  Merges two lists of holders together joined on .address
  assumes the 1st list is the longer one
*/
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

/*
  Handle sending the response to the user, and creating a log
*/
const response_handler = async (req, res, body, start) => {
  if (body.holders && body.holders.length === 0) {
    await handle_create_request_log(req, start, 400)
    res.status(400).json({ message: 'invalid request no data found' })
  } else if (body.err) {
    await handle_create_request_log(req, start, 500)
    res.status(500).json({ message: 'Something went wrong on our end possible server overload', error: holders.err })
  } else {
    await handle_create_request_log(req, start, 200)
    res.json(body);
  }
}

exports.response_handler = response_handler

/*
  Makes sure the chain param is valid
*/
const check_chain = (req, res) => {
  var chain = req.params.chain
  if (chain != 'arbitrum' && chain != 'ethereum') {
    res.status(400).json({ message: 'Invalid chain ' + chain }).send()
    return true
  }
  return false
}

exports.check_chain = check_chain

async function updateOrAddTgUserMetrics(ctx) {
  const client = new DynamoDBClient({ region: "us-east-1" });
  const params = {
    TableName: "WalletWizTgUsers",
    Key: marshall({ userId: ctx.from.id.toString() }),
  };

  try {
    // check if user exists in the table
    const { Item } = await client.send(new GetItemCommand(params));
    
    if (Item) {
      // user exists, update their lastscan and scandates
      const now = Math.floor(Date.now() / 1000);
      const UpdateExpression = "SET lastscan = :now, scandates = list_append(scandates, :scandates), totalscans = totalscans + :one, username = :username";
      const ExpressionAttributeValues = marshall({ ":now": now, ":one": 1, ":scandates": [now], ":username": ctx.from.username });
      const updateParams = {
        ...params,
        UpdateExpression,
        ExpressionAttributeValues,
      };
      await client.send(new UpdateItemCommand(updateParams));
    } else {
      // user doesn't exist, add them to the table
      const now = Math.floor(Date.now() / 1000);
      const Item = {
        userId: ctx.from.id.toString(),
        lastscan: now,
        scandates: [now],
        totalscans: 1,
        username: ctx.from.username,
      };
      const putParams = {
        TableName: "WalletWizTgUsers",
        Item: marshall(Item),
      };
      await client.send(new PutItemCommand(putParams));
    }
  } catch (error) {
    console.error(error);
  }
}

module.exports.updateOrAddTgUserMetrics = updateOrAddTgUserMetrics

async function updateOrAddTokenMetrics(token_address) {
  const client = new DynamoDBClient({ region: "us-east-1" });
  const params = {
    TableName: "WalletWizTokens",
    Key: marshall({ address: token_address.toLowerCase() }),
  };

  try {
    // check if user exists in the table
    const { Item } = await client.send(new GetItemCommand(params));
    
    if (Item) {
      // user exists, update their lastscan and scandates
      const now = Math.floor(Date.now() / 1000);
      const UpdateExpression = "SET lastscan = :now, scandates = list_append(scandates, :scandates), totalscans = totalscans + :one";
      const ExpressionAttributeValues = marshall({ ":now": now, ":one": 1, ":scandates": [now] });
      const updateParams = {
        ...params,
        UpdateExpression,
        ExpressionAttributeValues,
      };
      await client.send(new UpdateItemCommand(updateParams));
    } else {
      // user doesn't exist, add them to the table
      const now = Math.floor(Date.now() / 1000);
      const Item = {
        address: token_address.toLowerCase(),
        lastscan: now,
        scandates: [now],
        totalscans: 1,
      };
      const putParams = {
        TableName: "WalletWizTokens",
        Item: marshall(Item),
      };
      await client.send(new PutItemCommand(putParams));
    }
  } catch (error) {
    console.error(error);
  }
}

module.exports.updateOrAddTokenMetrics = updateOrAddTokenMetrics