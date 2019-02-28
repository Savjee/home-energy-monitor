module.exports.getYesterdayDate = function(){
    const yesterday = new Date();
    yesterday.setHours(0);
    yesterday.setMinutes(0);
    yesterday.setSeconds(0);
    yesterday.setDate(yesterday.getDate() -1);

    const string = yesterday
    			.toISOString()
    			.substring(0,10)
    			.replace(/-/g, '');

    return {
    	dateObj: yesterday,
    	unixTimestamp: parseInt(yesterday.getTime() / 1000),
    	string: string,
    	year: string.substring(0,4),
    	month: string.substring(4,6),
    	day: string.substring(6,8)
    }
}

module.exports.getTodaysDate = function(){
	const today = new Date();
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);

    const string = today
    			.toISOString()
    			.substring(0,10)
    			.replace(/-/g, '');

    return {
    	dateObj: today,
    	unixTimestamp: parseInt(today.getTime() / 1000),
    	string: string,
    	year: string.substring(0,4),
    	month: string.substring(4,6),
    	day: string.substring(6,8)
    }
}

module.exports.parseDynamoDBReadingsToJson = function(data){
	const output = [];

	for(const entry of data.Items){
		const timestamp = entry.sortkey;
		const readings = entry.readings;


		// Calculate the time of the first entry, assuming that a 
		// measurement is taken every second. We do -2 because js
		// starts counting from 0 and because the last element should
		// not be included.
		let timeForEntry = entry.sortkey - readings.length -2;

		for(const reading of readings){
			output.push({
				timestamp: timeForEntry,
				reading: reading
			});

			timeForEntry++;
		}
	}

	return output;
}

/**
 * Convert the output from DynamoDB (which is a JSON object)
 * into a string containing a CSV document with timestamp and
 * measurement column.
 */
module.exports.parseDynamoDBItemsToCSV = function(dynamoData){
	let output = 'Timestamp,Watts\n';

	const json = module.exports.parseDynamoDBReadingsToJson(dynamoData);

	for(const reading of json){
		output += reading.timestamp + ',' + reading.reading + '\n';
	}

	return output;
}

module.exports.getReadingsFromDynamoDBSince = async function(deviceId, timestamp){
	const { dynamoDocClient } = require('./aws-connections');
	const { config } = require('./config');

	const data = await dynamoDocClient.query({
       TableName : config.dynamoDb.table,
       KeyConditionExpression: '#key = :key and #sortkey > :timestamp',
       ScanIndexForward: true, // DESC order
       ConsistentRead: false,
       ExpressionAttributeNames:{
           '#key': 'primarykey',
           '#sortkey': 'sortkey',
       },
       ExpressionAttributeValues: {
           ':key': 'reading-' + deviceId,
           ':timestamp': timestamp
       },
    }).promise();

	return module.exports.parseDynamoDBReadingsToJson(data);
}

module.exports.getUsageDataFromDynamoDB = async function(deviceId, startDate, endDate){
	const { dynamoDocClient } = require('./aws-connections');
	const { config } = require('./config');

	const data = await dynamoDocClient.query({
       TableName : config.dynamoDb.table,
       KeyConditionExpression: '#key = :key and #sortkey BETWEEN :start AND :end',
       ScanIndexForward: true, // DESC order
       ConsistentRead: false,
       ExpressionAttributeNames:{
           '#key': 'primarykey',
           '#sortkey': 'sortkey',
       },
       ExpressionAttributeValues: {
           ':key': 'summary-day-' + deviceId,
           ':start': startDate,
           ':end': endDate
       },
    }).promise();

	console.log(data);
    return data.Items;
}

module.exports.writeToS3 = function(filename, contents){
	const { s3 } = require('./aws-connections');
	const { config } = require('./config');

	return s3.putObject({
        Body: contents,
        Bucket: config.s3.bucket,
        Key: filename
    }).promise();
}

module.exports.readFromS3 = function(filename){
	const { s3 } = require('./aws-connections');
	const { config } = require('./config');

	return s3.getObject({
        Bucket: config.s3.bucket,
        Key: filename,
    }).promise();
}

module.exports.getDatesBetween = function(startDate, endDate){
	const dateArray = [];

    let currentDate = startDate;
    while (currentDate <= endDate) {
        dateArray.push(new Date (currentDate));
        currentDate = currentDate.addDays(1);
    }

    return dateArray;
}

/**
 * Write a given object to the given table name. Returns a
 * promise that should be awaited.
 */
module.exports.writeToDynamoDB = function(tableName, object){
	const { dynamoDocClient } = require('./aws-connections');

	return dynamoDocClient.put({
        TableName: tableName,
        Item: object
    }).promise();
}
