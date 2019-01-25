const { getReadingsFromDynamoDBSince } = require('../../../core/helpers');
const { config } = require('../../../core/config');

/**
 * Fetches the collected readings from DynamoDB.
 * 
 * To prevent the user from consuming too many read units, we limit
 * the amount of data you can request here to the last 24 hours.
 * 
 * @param  {int} sinceTimestamp 	Timestamp in ms
 */
module.exports.realtime = async ({ sinceTimestamp }) => {
    const lowestTimestampAllowed = (new Date() / 1000) - 24 * 60 * 60;

    if (sinceTimestamp && sinceTimestamp < lowestTimestampAllowed) {
        throw new Error('This endpoint can only return data from the last 24 hours');
    }

    // If no timestamp was given, return the data from the last minute
    if (!sinceTimestamp) {
        console.log('No timestamp provided, going default');
        sinceTimestamp = (new Date() / 1000) - 60;
    }

    return await getReadingsFromDynamoDBSince(config.deviceName, sinceTimestamp);
}