// Import the test_token function from WalletWiz.js
const { 
  test_token,
  merge_holders,
  get_contract_names,
  get_holder_balances,
  get_holder_rug_vs_ape,
  get_holders, 
  get_wallet_time_stats
} = require('./WalletWiz');

exports.handler = async (event) => {
  // Parse the address from the event body
  const body = JSON.parse(event.body);
  const route = event.rawPath


  // Call the test_token function with the parsed address
  const result = await test_token(body.address);

  if (result.error) {
    // Prepare the response with appropriate status code and headers
    var response = {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'no holders detected or bad token address' })
    };
  } else {
    // Prepare the response with appropriate status code and headers
    var response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ result })
    };
  }

  return response;
};
