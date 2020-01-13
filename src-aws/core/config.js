module.exports.config = {
	deviceName: 'xd-home-energy-monitor-2',
	
	dynamoDb: {
		table: 'xd-home-energy-monitor',
	},

	s3: {
		bucket: 'xd-home-energy-monitor-datastore'
	}
};