const { getUsageDataFromDynamoDB } = require('../../../core/helpers');
const { config } = require('../../../core/config');

module.exports.usageData = async ({ startDate, endDate }) => {

    // Fetch the data from DynamoDB
    const data = await getUsageDataFromDynamoDB(
      config.deviceName, startDate, endDate
    );

    // Tanform the usage data to a format that GraphQL expects
    return data.map(el => {
      return {
        timestamp: el.sortkey,
        dayUse: el.usage.day,
        nightUse: el.usage.night,
      }
    });
}