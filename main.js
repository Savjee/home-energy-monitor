const BASE_URL = 'https://api.thingspeak.com/channels/662755/fields/1.json?api_key=R6JPGF9DZBGJ7AS4&results=5760';

function toggleLoadingIndicator(visible){
	const $el = document.getElementById('loading-indicator');

	if(visible){
		$el.style.display = 'block';
	}else{
		$el.style.display = 'none';
	}
}

function fetchData(){
	return new Promise((resolve, reject) => {
		toggleLoadingIndicator(true);
		const xhr = new XMLHttpRequest();

		xhr.onload = function () {

			if (xhr.status >= 200 && xhr.status < 300) {
				const json = JSON.parse(xhr.response);
				toggleLoadingIndicator(false);
				return resolve(json);
			} else {
				console.log('The request failed!');
				toggleLoadingIndicator(false);
				return reject();
			}
		};

		xhr.open('GET', BASE_URL);
		xhr.send();
	});
}

function processData(rawData){
	if(!rawData || !rawData.feeds || rawData.feeds.length === 0){
		return;
	}

	const processedData = [];

	for(const entry of rawData.feeds){
		processedData.push([
			new Date(entry.created_at),
			parseFloat(entry.field1)
		]);
	}

	return processedData;
}

/**
 * Between 21:00 and 06:00 there is a special "night hour" tarif for
 * electricity. Reflect that by highlighting these areas in grey.
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
	const rawData = await fetchData();
	const processedData = processData(rawData);

	console.log(processedData);

	// Initialize the chart
	const chart = new Dygraph(
	    document.getElementById("graphdiv"),
	    processedData,
	    {
	    	labels: ['Timestamp', 'Watts'],
	    	underlayCallback: highlightNightHours,
	    }
  	);
}