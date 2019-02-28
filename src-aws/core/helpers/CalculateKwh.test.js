const {calculateKWH} = require('./CalculateKwh');
const assert = require('assert');

describe('Calculate kWh', function() {
    it('should return 1 when consuming 1000W for 1 hour', function() {

    	// Consume 1000W for exactly 1 hour
    	const data = [
    		[new Date(1*1000), 1000],
    		[new Date(60*60*1000 +1000), 0],
    	];

    	// Should be 1kWh (at night)
      	assert.equal(calculateKWH(data).night, 1);
	});

	it('should return 0.5 when consuming 1000W for 30min', function() {

    	// Consume 1000W for exactly 30min
    	const data = [
    		[new Date(1*1000), 1000],
    		[new Date(30*60*1000 +1000), 0],
    	];

    	// Should be 1kWh (at night)
      	assert.equal(calculateKWH(data).night, 0.5);
	});
});