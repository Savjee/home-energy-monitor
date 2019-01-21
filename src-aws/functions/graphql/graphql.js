const { graphql, buildSchema } = require('graphql');
const {getYesterdayDate} = require('../../core/helpers');
// const { dynamoDocClient, s3 } = require('../../core/aws-connections');
// const { config } = require('../../core/config');

// Construct a schema, using GraphQL schema language
const schema = buildSchema(`
  type Query {

    # Test
    usageData(startDate: Int!, endDate: Int!): [Reading]!

    # Test 2
    realtime(startTimestamp: Int!): [Reading]!
  }

  type Reading {
    timestamp: Int!
    reading: Int!
  }
`);

// function test(){
//   const timerLabel = '[PERF] Get history data';
//   console.time(timerLabel);

//   try{
//       const prefix = 'reading-' + getYesterdayDateAsString().string;

//       const data = await dynamoDocClient.query({
//           TableName : config.dynamoDb.table,
//           KeyConditionExpression: '#key = :key and begins_with(#sortKey,:prefix)',
//           ScanIndexForward: true, // DESC order
//           ConsistentRead: false,
//           ExpressionAttributeNames:{
//               '#key': 'primarykey',
//               '#sortKey': 'sortkey',
//           },
//           ExpressionAttributeValues: {
//               ':key': deviceName,
//               ':prefix': prefix
//           },
//       }).promise();

//       console.timeEnd(timerLabel);
//       console.log('Item count for yesterday', data.Items.length);
//       return data;
//   }catch(e){
//       console.log('Error fetching historical data');
//       console.log(e);

//       // To prevent the application from crashing completely, we
//       // return an valid DynamoDB result object with no entries.
//       return { Items: [] };
//   }
// }

// The root provides a resolver function for each API endpoint
var root = {
  realtime: ({startTimestamp}) => {

    // Check the passed timestamp. It cannot be before yesterday's date
    // and it cannot be in the future. This prevents bogus requests to
    // DynamoDB and reduces costs.
    const minTimestamp = getYesterdayDate().unixTimestamp;

    if(startTimestamp < minTimestamp){
      throw new Error('This endpoint can only return data from the last 24 hours');
    }

    if(startTimestamp > Date.now()/1000){
      throw new Error('You cannot request data from the future!');
    }

    // Everything appears to be good, make a request to DynamoDB.

    return [
    	{
    		timestamp: 1927,
    		reading: 10,
    	}
    ];
  },
};



module.exports.handler = function(){
  // Run the GraphQL query '{ hello }' and print out the response
  graphql(schema, '{ realtime(startTimestamp:1876876876){timestamp, reading} }', root).then((response) => {
    console.log(JSON.stringify(response));
  });
}();