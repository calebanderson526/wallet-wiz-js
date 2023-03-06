// Import the test_token function from WalletWiz.js
const { test_token } = require('./WalletWiz');

exports.handler = async (event) => {
  // Parse the address from the event body
  const body = JSON.parse(event.body);

  // Call the test_token function with the parsed address
  const result = await test_token(body.address);

  // Prepare the response with appropriate status code and headers
  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ result })
  };

  return response;
};
