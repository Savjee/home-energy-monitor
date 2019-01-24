const BASE_URL = '***REMOVED***';
let data = [];
let chart;

function toggleLoadingIndicator(visible){
	const $el = document.getElementById('loading-indicator');

	if(visible){
		$el.style.display = 'block';
	}else{
		$el.style.display = 'none';
	}
}

function fetchData(since){
	if(!since){
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() -1);
		yesterday.setHours(yesterday.getHours() + 2);
		since = yesterday.getTime() / 1000;
	}

	since = parseInt(since);

	return new Promise((resolve, reject) => {
		toggleLoadingIndicator(true);
		const xhr = new XMLHttpRequest();

		xhr.onload = function () {

			if (xhr.status >= 200 && xhr.status < 300) {
				console.time("Parse JSON");
				const json = JSON.parse(xhr.response);
				console.timeEnd("Parse JSON");


				console.time("Process data");
				processData(json);
				console.timeEnd("Process data");

				toggleLoadingIndicator(false);
				return resolve();
			} else {
				console.log('The request failed!');
				toggleLoadingIndicator(false);
				return reject();
			}
		};

		const query = `query{ realtime(sinceTimestamp: ${since}){timestamp, reading} }`;

		xhr.open('POST', BASE_URL);
		xhr.send(query);
	});
}

function processData(rawData){
	if(!rawData || !rawData.data || !rawData.data.realtime){
		return;
	}

	// data = rawData.data.realtime.map(el => [new Date])

	for(const entry of rawData.data.realtime){
		const date = new Date(entry.timestamp * 1000);
		const watts = parseFloat(entry.reading);

		// If this entry alredy exists, stop processing it!
		// if(data.find(el => el[0].getTime() === date.getTime())){
			// continue;
		// }

		data.push([
			date,
			watts,
		]);
	}

	// Update the current, max and min values
	const $current = document.getElementById('usage-current');
	$current.innerHTML = data[data.length-1][1] + ' W';

	if(chart){
		chart.updateOptions({
			file: data,
		});
	}
}

/**
 * Calculates the consumed kWh based on the given
 * dataset. More accurate when interval of measurements
 * is higher.
 */
function calculateKWH(dataset){
	let total = 0;

	for(let i = 0; i < dataset.length-1; i++){
		const current = dataset[i];
		const next = dataset[i+1];

		const seconds = (next[0].getTime() - current[0].getTime()) / 1000;

		total += (current[1] * seconds * (1/(60*60))) / 1000;
	}

	return total;
}

/**
 * Calculates the min, max and used kwh based of the highlighted
 * range in the chart. If nothing was highlighted, we make a
 * complete overview
 */
function getMetricsForSelectedRange(chart, initial_draw){
	let startDate = 0;
	let endDate = Number.MAX_SAFE_INTEGER;

	if(chart.dateWindow_){
		startDate = chart.dateWindow_[0];
		endDate = chart.dateWindow_[1];
	}

	// Extract the data between start & end date
	const dataInScope = data.filter(
		el => el[0] > startDate && el[0] < endDate
	);

	return {
		min: Math.min.apply(Math, dataInScope.map(i => i[1])),
		max: Math.max.apply(Math, dataInScope.map(i => i[1])),
		current: 0,
		usage: calculateKWH(dataInScope),
	}
}

/**
 * Is called by Dygraphs when the user has selected a range in
 * the chart. We then have to update the metrics for the newly
 * selected range.
 */
function updateMetricsForSelectedRange(chart, initial_draw){
	const metrics = getMetricsForSelectedRange(chart, initial_draw);

	// const $current = document.getElementById('usage-current');
	const $min = document.getElementById('usage-min');
	const $max = document.getElementById('usage-max');
	const $kwh = document.getElementById('usage-kwh');

	$max.innerHTML = metrics.max;
	$min.innerHTML = metrics.min;
	$kwh.innerHTML = parseFloat(metrics.usage).toFixed(2) + ' kWh';
}

/**
 * Between 21:00 and 06:00 there is a special "night hour" tarif for
 * electricity. Also all hours on Saturday and Sunday. Reflect that 
 * by highlighting these areas in grey.
 */
function highlightNightHours(canvas, area, chart){
	console.time('Highlighting night hours');

	let foundStart = false;
	let foundEnd = false;

	let startHighlight = null;
	let endHighlight = null;

	canvas.fillStyle = "#efefef";


	for(const entry of chart.file_){
		const date = entry[0];

		// Assume this is also going to be our last item to highlight
		endHighlight = chart.toDomXCoord(date);

		if(foundStart === false && isNightTarif(date)){
			// We now found our start!
			foundStart = true;
			startHighlight = chart.toDomXCoord(date);
		}

		// If this entry is not night tarif, but we did find the start
		// before then this is the end!
		if(foundStart === true && isNightTarif(date) === false){
			foundEnd = true;
		}

		// If we found both, draw them!
		if(foundStart === true && foundEnd === true){
			const width = endHighlight - startHighlight;

			canvas.fillRect(startHighlight, area.y, width, area.h);

			foundStart = false;
			foundEnd = false;
			startHighlight = null;
			endHighlight = null;
		}
	}

	// It could be that we found a start but not an end (in that case we're
	// actively in night hours and we should draw these as well!)
	if(foundStart && foundEnd === false){
		const lastPosition = chart.toDomXCoord(chart.file_[chart.file_.length -1][0]);
		const width = lastPosition - startHighlight;
		canvas.fillRect(startHighlight, area.y, width, area.h);
	}

	console.timeEnd('Highlighting night hours');
}

/**
 * Checks if a given date object is within night tarif or not.
 * For us that is between 21:00 and 06:00 and every weekend day.
 */
function isNightTarif(dateObj){
	if((dateObj.getHours() >= 21 && dateObj.getHours() <= 23) ||
		(dateObj.getHours() >= 0 && dateObj.getHours() <= 5)){
		return true;
	}

	if(dateObj.getDay() === 0 || dateObj.getDay() === 6){
		return true;
	}

	return false;
}

async function initChart(){

	// First fetch some data from ThingSpeak
	await fetchData();

	// Initialize the chart
	chart = new Dygraph(
	    document.getElementById("graphdiv"),
	    data,
	    {
            legend: 'always',
	    	labels: ['Timestamp', 'Watts'],
	    	underlayCallback: highlightNightHours,
	    	drawCallback: updateMetricsForSelectedRange,
	    	showRoller: true,
	    	rollPeriod: 14,
	    }
  	);

  	// Add callbacks to the buttons "yesterday" and "today"
  	document.getElementById('btnYesterday').addEventListener('click', () => {
  		const start = new Date();
  		start.setDate(start.getDate() - 1);
  		start.setHours(0);
  		start.setMinutes(0);

  		chart.updateOptions({
  			dateWindow: [start.getTime(), start.getTime() + 24*60*60*1000]
  		})
  	});

  	document.getElementById('btnToday').addEventListener('click', () => {
  		const start = new Date();
  		start.setHours(0);
  		start.setMinutes(0);

  		chart.updateOptions({
  			dateWindow: [start.getTime(), start.getTime() + 24*60*60*1000]
  		})
  	});

  	setInterval(async () => {
  		const someSecondsAgo = new Date();
  		someSecondsAgo.setMinutes(someSecondsAgo.getMinutes() - 1);
  		await fetchData(someSecondsAgo.getTime() / 1000);
  	}, 30 * 1000);
}