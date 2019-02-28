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
module.exports.calculateKWH = function (dataset) {
	const { isNightTarif } = require('./IsNightTarif');

	const output = {
		day: 0,
		night: 0,
	};

	for(let i = 0; i < dataset.length-1; i++){
		const current = dataset[i];
		const next = dataset[i+1];

		// Seconds between the two measurements
		const seconds =
			(next[0].getTime() - current[0].getTime()) / 1000;

		// Kilowatts used between those points
		const kWh = (current[1] * seconds * (1/(60*60))) / 1000;

		if(isNightTarif(current[0])){
			output.night += kWh;
		}else{
			output.day += kWh;
		}
	}

	return output;
}