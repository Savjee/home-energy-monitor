const slsw = require('serverless-webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'production',
  entry: slsw.lib.entries,
  target: 'node',
  externals: [nodeExternals({
  	whitelist: ['graphql']
  })] // exclude external modules
};