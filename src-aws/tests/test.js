const {calculateKWH} = require('../core/helpers');
const assert = require('assert');

describe('Calculate kWh', function() {
    it('should return -1 when the value is not present', function() {

    	// Consume 1000W for exactly 1 hour
    	const data = [
    		[new Date(1*1000), 1000],
    		[new Date(60*60*1000 +1000), 0],
    	];

    	// Should be 1kWh (at night)
      	assert.equal(calculateKWH(data).night, 1);
    });
});