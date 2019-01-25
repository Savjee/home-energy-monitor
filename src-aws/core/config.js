module.exports.config = {
	deviceName: 'xd-home-energy-monitor-1',
	
	dynamoDb: {
		table: 'xd-home-energy-monitor',
	},

	s3: {
		bucket: 'xd-home-energy-monitor-datastore'
	}
};