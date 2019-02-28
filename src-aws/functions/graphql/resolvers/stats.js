const graphqlFields = require('graphql-fields');
const { getReadingsFromDynamoDBSince, getTodaysDate, calculateKWH } = require('../../../core/helpers');
const jStat = require('jStat').jStat;

const { config } = require('../../../core/config');

module.exports.stats = async ({ sinceTimestamp }, context, info) => {
    const lowestTimestampAllowed = (new Date() / 1000) - 20 * 60 * 60;
    const todayStartTimestamp = getTodaysDate().unixTimestamp;

    const requestedFields = graphqlFields(info);
    const output = {};

    const allReadings = await getReadingsFromDynamoDBSince(config.deviceName, todayStartTimestamp);

    if (requestedFields.always_on) {
        const readingsOnly = allReadings.map(el => el.reading);
        const standbyWatts = jStat.mode(readingsOnly);

        output.always_on = standbyWatts;
    }

    // TODO: If only the today_so_far field is requested, we can get away by only loading
    // the records from today, potentially saving us a lot of DynamoDB read capacity.
    if (requestedFields.today_so_far) {
        // Tranform the readings into something the calculateKWH function expects
        const input = allReadings.map(item => [item.timestamp, item.reading]);

        const usage = calculateKWH(input);
        output.today_so_far = usage.day + usage.night;
    }

    return output;
}