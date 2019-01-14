const BASE_URL = 'https://api.thingspeak.com/channels/662755/fields/1.json?api_key=R6JPGF9DZBGJ7AS4';
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

function fetchData(entries = 10){
	return new Promise((resolve, reject) => {
		toggleLoadingIndicator(true);
		const xhr = new XMLHttpRequest();

		xhr.onload = function () {

			if (xhr.status >= 200 && xhr.status < 300) {
				const json = JSON.parse(xhr.response);
				processData(json);

				toggleLoadingIndicator(false);
				return resolve();
			} else {
				console.log('The request failed!');
				toggleLoadingIndicator(false);
				return reject();
			}
		};

		xhr.open('GET', BASE_URL + '&results=' + entries);
		xhr.send();
	});
}

function processData(rawData){
	if(!rawData || !rawData.feeds || rawData.feeds.length === 0){
		return;
	}

	for(const entry of rawData.feeds){
		const date = new Date(entry.created_at);
		const watts = parseFloat(entry.field1);

		// If this entry alredy exists, stop processing it!
		if(data.find(el => el[0].getTime() === date.getTime())){
			continue;
		}

		data.push([
			date,
			watts,
		]);
	}

	// Update the current, max and min values
	const $current = document.getElementById('usage-current');
	const $min = document.getElementById('usage-min');
	const $max = document.getElementById('usage-max');
	const $kwh = document.getElementById('usage-kwh');

	$max.innerHTML = Math.max.apply(Math, data.map(i => i[1])) + ' W';
	$min.innerHTML = Math.min.apply(Math, data.map(i => i[1])) + ' W';
	$current.innerHTML = data[data.length-1][1] + ' W';
	$kwh.innerHTML = calculateKWH() + ' kWh';

	if(chart){
		chart.updateOptions({
			file: data,
		});
	}
}

function calculateKWH(){
	let total = 0;

	for(let i = 0; i < data.length-1; i++){
		const current = data[i];
		const next = data[i+1];

		const seconds = (next[0].getTime() - current[0].getTime()) / 1000;

		total += (current[1] * seconds * (1/(60*60))) / 1000;
	}

	return Math.round(total);
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
	await fetchData(5760);

	// Initialize the chart
	chart = new Dygraph(
	    document.getElementById("graphdiv"),
	    data,
	    {
            legend: 'always',
	    	labels: ['Timestamp', 'Watts'],
	    	underlayCallback: highlightNightHours,
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
  		await fetchData(10);
  	}, 30 * 1000);
}