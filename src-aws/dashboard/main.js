const BASE_URL = '*** YOUR GRAPHQL ENDPOINT HERE ***';
let data = [];
let chart;
let animateDuration = 1500;

function toggleLoadingIndicator(visible){
	const $el = document.getElementById('loading-indicator');

	if(visible){
		$el.style.display = 'block';
	}else{
		$el.style.display = 'none';
	}
}

function formatTimestampForChartAxis(rawTimestamp){
	const date = new Date(rawTimestamp * 1000);
	const months = ["Jan", 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	return date.getDate() + ' ' + months[date.getMonth()];
}

function fetchChartDataForDailyUsage(){
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		xhr.onload = function () {

			if (xhr.status >= 200 && xhr.status < 300) {
				const json = JSON.parse(xhr.response);

				// Process that data for chartjs

				var chartData = {
					labels: json.data.usageData.map(el => formatTimestampForChartAxis(el.timestamp)),
					datasets: [
						{
							label: 'Day',
							backgroundColor: 'rgb(54, 162, 235)',
							data: json.data.usageData.map(el => el.dayUse)
						},
						{
							label: 'Night',
							backgroundColor: 'rgb(29, 41, 81)',
							data: json.data.usageData.map(el => el.nightUse)
						},
					]
				}

				return resolve(chartData);
			} else {
				console.log('The request failed!');
				return reject();
			}
		};

		const startDate = new Date();
		startDate.setDate(startDate.getDate() - 31);

		const start = parseInt(startDate.getTime() / 1000);
		const end = parseInt(Date.now() / 1000);

		const query = `query{usageData(startDate:${start}, endDate:${end}){timestamp, dayUse, nightUse}}`;

		xhr.open('POST', BASE_URL);
		xhr.send(query);
	});
}

function fetchData(since){
	if(!since){
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() -1);
		yesterday.setHours(yesterday.getHours() + 12);
		since = yesterday.getTime() / 1000;
	}
	
	since = parseInt(since);


	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		xhr.onload = function () {

			if (xhr.status >= 200 && xhr.status < 300) {
				console.time("Parse JSON");
				const json = JSON.parse(xhr.response);
				console.timeEnd("Parse JSON");


				console.time("Process data");
				processData(json);
				console.timeEnd("Process data");

				return resolve();
			} else {
				console.log('The request failed!');
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

	for(const entry of rawData.data.realtime){
		const date = entry.timestamp * 1000;

		// If this entries timestamp is before the last entry
		// in our dataset, then we skip it because it's data 
		// we already have! This reduces the time it takes to
		// process all the data by a LOT!
		if(data.length > 1 && date < data[data.length -1 ][0].getTime()){
			continue;
		}

		const watts = parseFloat(entry.reading);

		data.push([
			new Date(date),
			watts,
		]);
	}

	if(chart){
		chart.updateOptions({
			file: data,
		});
	}

	// Update metrics
	const $current = document.getElementById('stats-current');
	const $todayKwh = document.getElementById('stats-kwh');
	const $standbyPower = document.getElementById('stats-standby');
	const $max = document.getElementById('stats-max');

	const totalKwh = calculateKWH(data);

	$current.innerHTML = data[data.length-1][1] + ' W';
	$todayKwh.innerHTML = (Math.round(totalKwh * 100) / 100) + ' kWh';


	const readings = data.map(el => el[1]);
	const standbyWatts = jStat.mode(readings);
	$standbyPower.innerHTML = parseInt(standbyWatts) + ' W';
	$max.innerHTML = jStat.max(readings) + ' W';

	// Calculate total standby kWh
	const hours = (data[data.length-1][0].getTime() - data[0][0].getTime()) / 1000 / 3600;
	const standbyKwh = (standbyWatts/1000) * hours;

	initStandbyChart({
		activePower: totalKwh - (standbyKwh/1000 * hours), 
		standbyPower: standbyKwh
	});
}

function initStandbyChart({activePower, standbyPower}){
	const barChartData = {
		labels: ['Today'],
		datasets: [{
			data: [ activePower, standbyPower ],
			backgroundColor: ['rgb(54, 162, 235)', 'rgb(29, 41, 81)']
		}],
		labels: ['Active', 'Standby']
	};
	
	const ctx = document.getElementById('chart-standby').getContext('2d');
	new Chart(ctx, {
		type: 'doughnut',
		data: barChartData,
		options: {
			animation: {
				duration: animateDuration
			},
			responsive: true,
		}
	});

	animateDuration = 0;
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
	const $kwh = document.getElementById('usage-kwh');
	$kwh.innerHTML = parseFloat(metrics.usage).toFixed(2) + ' kWh';
}

/**
 * Between 21:00 and 06:00 there is a special "night hour" tarif for
 * electricity. Also all hours on Saturday and Sunday. Reflect that 
 * by highlighting these areas in grey.
 */
function highlightNightHours(canvas, area, chart){
	let foundStart = false;
	let foundEnd = false;

	let startHighlight = null;
	let endHighlight = null;

	canvas.fillStyle = "#efefef";

	for(let i = 0; i < chart.file_.length; i++){
		const entry = chart.file_[i];
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

		i += 30;
	}

	// It could be that we found a start but not an end (in that case we're
	// actively in night hours and we should draw these as well!)
	if(foundStart && foundEnd === false){
		const lastPosition = chart.toDomXCoord(chart.file_[chart.file_.length -1][0]);
		const width = lastPosition - startHighlight;
		canvas.fillRect(startHighlight, area.y, width, area.h);
	}
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

async function initUsageChart(){
	const chartdata = await fetchChartDataForDailyUsage();
	var ctx = document.getElementById('canvas').getContext('2d');

	new Chart(ctx, {
		type: 'bar',
		data: chartdata,
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				xAxes: [{
					stacked: true,
				}],
				yAxes: [{
					stacked: true
				}]
			}
		}
	})
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

  // 	document.getElementById('btnGetSignature').addEventListener('click', () => {
  // 		if(chart.dateWindow_){
		// 	const startDate = chart.dateWindow_[0];
		// 	const endDate = chart.dateWindow_[1];

		// 	const filteredData = data.filter(el => el[0] < endDate && el[0] > startDate);
		// 	console.log(filteredData.map(el => '['+ el[1] + '/10000]\n').toString());
		// }
  // 	});

  	// Every 30 seconds: fetch new data from the GraphQL endpoint.
  	// Fetch new records since the last record's timestamp.
  	setInterval(async () => {
  		await fetchData(data[data.length-1][0].getTime() / 1000);
  	}, 30 * 1000);
}