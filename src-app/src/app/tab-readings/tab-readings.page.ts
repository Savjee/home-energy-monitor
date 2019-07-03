import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { EnergyService } from '../services/energy-service.service';
import * as Highcharts from 'highcharts';
import { ChartDefaults } from '../utils/chart-defaults';

@Component({
  selector: 'app-tab-readings',
  templateUrl: './tab-readings.page.html',
  styleUrls: ['./tab-readings.page.scss'],
})
export class TabReadingsPage {
  public selectedDate = new Date().toISOString();
  public todaysDate = new Date().toISOString();
  public showForwardArrow = false;

  @ViewChild('chart') private mainChartRef: ElementRef;

  // The JS timestamp of when we last updated the data in the chart
  private lastUpdated = null;

  // Data that is used to plot the chart
  private chartData = [];

  constructor(public energyService: EnergyService) { }

  public async ionViewWillEnter() {
    // If we don't have any data in memory, go out and fetch them
    if (this.chartData.length === 0) {
      await this.refreshReadings();
      return;
    }

    // If the data we have is older then 30 minutes, refresh them!
    if (this.lastUpdated < Date.now() - 30*60*1000) {
      await this.refreshReadings();
      return;
    }
  }

  /**
   * Refreshes the data in the graph. If we already have downloaded data before,
   * it only fetches new data, after the lastUpdated timestamp.
   */
  private async refreshReadings() {
    const data = await this.energyService.getReadings(this.lastUpdated);
    this.lastUpdated = Date.now();

    const filtered = data.filter(item => item.timestamp % 30 === 0);
    this.chartData = this.chartData.concat(filtered);

    this.renderChart();
  }

  /**
   * Called when the date was changed through the picker or with
   * the arrows next to it.
   */
  public dateChanged() {

    // Show the forward arrow when the selected date is not equal to
    // todays date
    this.showForwardArrow =
      this.selectedDate.substring(0, 10) !== this.todaysDate.substring(0, 10);
  }

  /**
   * Called when the user clicks on the forward arrow
   */
  public goToTomorrow() {
    this.manipulateSelectedDateBy(1);
  }

  /**
   * Called when the user clicks on the backwards arrow
   */
  public goToYesterday() {
    this.manipulateSelectedDateBy(-1);
  }

  /**
   * Responsible for fetching the required data from the API and
   * storing it in the private "chartData" field. Also calls the
   * "renderChart" function to update if necessary.
   */
  private fetchDataForDate() {

  }

  private renderChart() {
    const data = this.chartData.map(item => [item.timestamp * 1000, item.reading]);
    const values = data.map(item => item[1]);

    Highcharts.chart(this.mainChartRef.nativeElement, {
      ...ChartDefaults,
      chart: {
        type: "line",
        panning: true,
        pinchType: 'x',
        events: {
          load() {
            this.xAxis[0].setExtremes(Date.now() - 4 * 60 * 60 * 1000, Date.now())
          }
        }
      },
      xAxis: {
        type: 'datetime',
      },
      yAxis: {
        max: Math.max(...values),
        title: {
          text: null,
        }
      },
      series: [{
        type: null,
        name: 'Usage',
        color: '#8440FF',
        data: data
      }],
      tooltip: {
        valueSuffix: 'W',
        followTouchMove: false,
      },
    });
  }

  /**
   * Takes the currently selected date and increments it by a given
   * amount of days. If given a negative number it goes backwards.
   */
  private manipulateSelectedDateBy(amount: number) {
    const date = new Date(this.selectedDate);
    date.setDate(date.getDate() + amount);
    this.selectedDate = date.toISOString();
  }
}
