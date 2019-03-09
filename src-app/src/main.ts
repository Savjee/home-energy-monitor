import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

import { Chart } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

if (environment.production) {
  enableProdMode();
}

// Disable the Chart Data Labels plugin by default. We will enable it
// on a case by case basis.
Chart.plugins.unregister(ChartDataLabels);


platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
