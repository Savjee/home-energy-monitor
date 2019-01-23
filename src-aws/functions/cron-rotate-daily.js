'use strict';
const { dynamoDocClient } = require('../core/aws-connections');
const { config } = require('../core/config');
const { getYesterdayDate, writeToS3, calculateKWH, writeToDynamoDB, parseDynamoDBItemsToCSV} = require('../core/helpers');

const deviceName = 'test';

/**
 * Fetches all of yesterday's readings of a certain 
 * device from DynamoDB.
 */
async function fetchYesterdaysData(){
	const timerLabel = '[PERF] Get history data';
    console.time(timerLabel);

    try{
        const prefix = 'reading-' + getYesterdayDate().string;

        const data = await dynamoDocClient.query({
            TableName : config.dynamoDb.table,
            KeyConditionExpression: '#key = :key and begins_with(#sortKey,:prefix)',
            ScanIndexForward: true, // DESC order
            ConsistentRead: false,
            ExpressionAttributeNames:{
                '#key': 'primarykey',
                '#sortKey': 'sortkey',
            },
            ExpressionAttributeValues: {
                ':key': deviceName,
                ':prefix': prefix
            },
        }).promise();

        console.timeEnd(timerLabel);
        console.log('Item count for yesterday', data.Items.length);
        return data;
    }catch(e){
        console.log('Error fetching historical data');
        console.log(e);

        // To prevent the application from crashing completely, we
        // return an valid DynamoDB result object with no entries.
        return { Items: [] };
    }
}


function calculateKwhSummary(csvData){
    // Transform the data
    const measurements = [];

    for(const line of csvData.split('\n')){
        if(line === '') continue;

        const parts = line.split(',');

        if(parts[0] === 'Timestamp') continue;

        measurements.push(
            [new Date(parseInt(parts[0])), parseInt(parts[1])]
        );
    }

    // Calculate the usage
    return calculateKWH(measurements);
}

async function writeUsageToDynamoDB(usageObj){
    const timerLabel = '[PERF] Write daily summary to DynamoDB';
    console.time(timerLabel);

    try{
        const key = 'summary-day-' + deviceName;
        const sortkey = getYesterdayDate().unixTimestamp;

        const data = await writeToDynamoDB(config.dynamoDb.table, {
            primarykey: key,
            sortkey: sortkey,
            usage: usageObj
        });

        console.timeEnd(timerLabel);
        return data;
    }catch(e){
        console.log('Error writing daily usage to DynamoDB:');
        console.log(e);

        // To prevent the application from crashing completely, we
        // return an valid DynamoDB result object with no entries.
        return false
    }
}

module.exports.handler = async(event, context, callback) => {
	const data = await fetchYesterdaysData();

	// Convert to CSV
	const csv = parseDynamoDBItemsToCSV(data);

	const time = getYesterdayDate();

	// Write to S3
	await writeToS3(`archived-readings/${deviceName}/${time.year}/${time.month}/${time.string}.csv`, csv);

    // Calculate the kWh consumed & write it to DynamoDB
    const usageData = calculateKwhSummary(csv);
    await writeUsageToDynamoDB(usageData);
};