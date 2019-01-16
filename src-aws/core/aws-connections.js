const AWS = require("aws-sdk");
module.exports.dynamoDocClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });
module.exports.s3 = new AWS.S3();
