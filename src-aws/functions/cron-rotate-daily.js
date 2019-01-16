'use strict';
const { dynamoDocClient, s3 } = require('../core/aws-connections');
const { config } = require('../core/config');

const deviceName = 'test';

/**
 * Returns yesterday's date a string in the form:
 * 20180120. This is used to efficiently query the
 * readings from the rangekey in DynamoDB.
 */
function getYesterdayDateAsString(){
    const yesterday = new Date();
    yesterday.setUTCHours(0,0,0,0);
    yesterday.setDate(yesterday.getDate() -1);

    const string = yesterday
    			.toISOString()
    			.substring(0,10)
    			.replace(/-/g, '');

    return {
    	string: string,
    	year: string.substring(0,4),
    	month: string.substring(4,6),
    	day: string.substring(6,8)
    }
}

/**
 * Fetches all of yesterday's readings of a certain 
 * device from DynamoDB.
 */
async function fetchYesterdaysData(){
	const timerLabel = '[PERF] Get history data';
    console.time(timerLabel);

    try{
        const prefix = 'reading-' + getYesterdayDateAsString().string;

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

/**
 * Convert the output from DynamoDB (which is a JSON object)
 * into a string containing a CSV document with timestamp and
 * measurement column.
 */
function convertDataToCSV(data){
	let output = 'Timestamp,Watts\n';

	for(const entry of data.Items){
		// Last entry had this timestamp
		const timestamp = entry.raw_timestamp;
		const readings = entry.readings;

		// Calculate the time of the first entry, assuming that a 
		// measurement is taken every second. We do -2 because js
		// starts counting from 0 and because the last element should
		// not be included.
		let timeForEntry = entry.raw_timestamp - data.Items.length -2;;

		for(const reading of readings){
			output += timeForEntry + ',' + reading + '\n';
			timeForEntry++;
		}
	}

	// console.log('output csv:', output);
	return output;
}

function writeToS3(filename, contents){
	return s3.putObject({
        Body: contents,
        Bucket: config.s3.bucket,
        Key: filename
    }).promise();
}

module.exports.handler = async(event, context, callback) => {
	const data = await fetchYesterdaysData();

	// Convert to CSV
	const csv = convertDataToCSV(data);

	const time = getYesterdayDateAsString();

	// Write to S3
	await writeToS3(`archived-readings/${deviceName}/${time.year}/${time.month}/${time.string}.csv`, csv);
};