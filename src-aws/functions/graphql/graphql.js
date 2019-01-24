const { graphql, buildSchema } = require('graphql');
const { dynamoDocClient, s3 } = require('../../core/aws-connections');
const { config } = require('../../core/config');
const { getYesterdayDate, 
        getTodaysDate, 
        getReadingsFromDynamoDBSince, 
        parseDynamoDBItemsToCSV } = require('../../core/helpers');

const deviceName = 'xd-home-energy-monitor-1';


// Construct a schema, using GraphQL schema language
const schema = buildSchema(`
  type Query {
    usageData(startDate: Int!, endDate: Int!): [Reading]!

    realtime(sinceTimestamp: Int!): [Reading]!

    readings(startDate: Int!, endDate: Int!): [Reading]!
  }

  type Reading {
    timestamp: Int!
    reading: Int!
  }
`);

// The root provides a resolver function for each API endpoint
const resolvers = {
  realtime: async ({sinceTimestamp}) => {

    // You can only fetch 24hours worth of data with this endpoint
    const lowestTimestampAllowed = (new Date() / 1000) - 24 * 60 *60;

    if(sinceTimestamp && sinceTimestamp < lowestTimestampAllowed){
      throw new Error('This endpoint can only return data from the last 24 hours');
    }
    
    // If no timestamp was given, return the data from the last minute
    if(!sinceTimestamp){
      console.log('No timestamp provided, going default');
      sinceTimestamp = (new Date() / 1000) - 60;
    }

    const data = await getReadingsFromDynamoDBSince(deviceName, sinceTimestamp);
    return data;
  },
};



module.exports.handler = async function(event, context, callback){
  const query = event.body;

  console.log("event", event);
  console.log('query', query);

  const response = await graphql(
    schema, 
    query, 
    resolvers
  );

  return {
    statusCode: 200,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response),
  }
};