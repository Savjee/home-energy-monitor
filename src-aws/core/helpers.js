module.exports.getYesterdayDate = function(){
    const yesterday = new Date();
    yesterday.setUTCHours(0,0,0,0);
    yesterday.setDate(yesterday.getDate() -1);

    const string = yesterday
    			.toISOString()
    			.substring(0,10)
    			.replace(/-/g, '');

    return {
    	dateObj: yesterday,
    	unixTimestamp: yesterday.getTime() / 1000,
    	string: string,
    	year: string.substring(0,4),
    	month: string.substring(4,6),
    	day: string.substring(6,8)
    }
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

/**
 * Checks if a given date object is within night tarif or not.
 * For us that is between 21:00 and 06:00 and every weekend day.
 */
module.exports.isNightTarif = function(dateObj){
	if((dateObj.getHours() >= 21 && dateObj.getHours() <= 23) ||
		(dateObj.getHours() >= 0 && dateObj.getHours() <= 5)){
		return true;
	}

	if(dateObj.getDay() === 0 || dateObj.getDay() === 6){
		return true;
	}

	return false;
}

/**
 * Calculates how many kWh has been used in the given dataset.
 * Returns an object with two fields: "day" and "night" to
 * know how much was used under which tarif.
 *
 * Used to archive these statistics on a daily basis to Dynamo
 * and to show a counter in the front-end.
 *
 * Input format:
 * 	[
 * 		[timestamp, wattage],
 * 		[timestamp, wattage],
 * 		...
 * 	]
 */
module.exports.calculateKWH = function(dataset){
	const output = {
		day: 0,
		night: 0,
	};

	let total = 0;

	for(let i = 0; i < dataset.length-1; i++){
		const current = dataset[i];
		const next = dataset[i+1];

		// Seconds between the two measurements
		const seconds = 
			(next[0].getTime() - current[0].getTime()) / 1000;

		// Kilowatts used between those points
		const kWh = (current[1] * seconds * (1/(60*60))) / 1000;
		console.log('kwh:', kWh);


		if(module.exports.isNightTarif(current[0])){
			output.night += kWh;
		}else{
			output.day += kWh;
		}
	}

	return output;
}