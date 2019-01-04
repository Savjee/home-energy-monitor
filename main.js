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

	$max.innerHTML = Math.max.apply(Math, data.map(i => i[1])) + ' W';
	$min.innerHTML = Math.min.apply(Math, data.map(i => i[1])) + ' W';
	$current.innerHTML = data[data.length-1][1] + ' W';

	if(chart){
		chart.updateOptions({
			file: data,
		});
	}
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

	for(const entry of chart.file_){
		const date = entry[0];

		// Between 00:00 and 06:00
		if((date.getHours() >= 21 && date.getHours() <= 23) ||
			(date.getHours() >= 0 && date.getHours() <= 5)){

			if(foundStart === false){
				foundStart = true;
				startHighlight = chart.toDomXCoord(date);
			}

			endHighlight = chart.toDomXCoord(date);
		}else{
			if(foundStart === true && foundEnd === false){
				foundEnd = true;
				endHighlight = chart.toDomXCoord(date);
			}
		}

		if(foundStart === true && foundEnd === true){
			const width = endHighlight - startHighlight;

			canvas.fillStyle = "#efefef";
			canvas.fillRect(startHighlight, area.y, width, area.h);

			foundStart = false;
			foundEnd = false;
		}
	}
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

  	setInterval(async () => {
  		await fetchData(10);
  	}, 30 * 1000);
}