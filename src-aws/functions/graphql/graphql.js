const { graphql, buildSchema } = require('graphql/index');
const { realtime } = require('./resolvers/realtime');
const { usageData } = require('./resolvers/usageData');
const { stats } = require('./resolvers/stats');

// Construct a schema, using GraphQL schema language
const schema = buildSchema(`
  type Query {
    usageData(startDate: Int!, endDate: Int!): [DailySummary]!

    stats: Stats!

    realtime(sinceTimestamp: Int!): [Reading]!

    readings(startDate: Int!, endDate: Int!): [Reading]!
  }

  type Stats{
    always_on: Float
    today_so_far: Float
  }

  type Reading {
    timestamp: Int!
    reading: Int!
  }

  type DailySummary{
    timestamp: Int!
    dayUse: Float!
    nightUse: Float!
  }
`);

// The root provides a resolver function for each API endpoint
const resolvers = {
  usageData: usageData,
  realtime: realtime,
  stats: stats,
};

module.exports.handler = async function(event, context, callback){
  const query = event.body;

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