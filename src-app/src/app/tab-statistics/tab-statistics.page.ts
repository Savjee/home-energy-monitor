import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { EnergyService } from '../services/energy-service.service';
import * as Highcharts from 'highcharts';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-tab-statistics',
  templateUrl: './tab-statistics.page.html',
  styleUrls: ['./tab-statistics.page.scss'],
})
export class TabStatisticsPage implements OnInit, AfterViewInit {

  @ViewChild('usageChart') private usageChartRef: ElementRef;
  @ViewChild('dayVsNight') private dayVsNightChartRef: ElementRef;

  public activeSegmentControl = "30days";

  public moreStats = {
    daily_average: null,
    total_30days: null,
  }

  // Keeps track of which segments we already rendered and did all the
  // network requests for. This to prevent multiple calls to the backend.
  private segmentsRendered = {
    '30days': false,
  }

  constructor(public energyService: EnergyService, private decimalPipe: DecimalPipe) { }

  ngOnInit() {
  }

  async ngAfterViewInit() {
    await this.segment30daysWasOpened();
  }

  /**
   * Called whenever the user switches to another segment. Responsible
   * for calling the correct function based on this event.
   */
  public segmentChanged(event) {
    this.activeSegmentControl = event.detail.value;

    if (this.activeSegmentControl === '30days') {
      this.segment30daysWasOpened();
    }
  }

  /**
   * Called when the user wants to open the "Last 30 days" summary
   * segment. It fetches the required data from the server and renders
   * a few charts on the screens asynchrounously.
   */
  private async segment30daysWasOpened() {
    // If we already rendered the charts we shouldn't do it again!
    if (this.segmentsRendered["30days"]) {
      return;
    }

    // Fetch the data we need
    const data = await this.energyService.getStatistics();

    // Calculate total day/night usage
    let totalDay = 0;
    let totalNight = 0;

    for (const entry of data.data.usageData) {
      totalDay += entry.dayUse;
      totalNight += entry.nightUse;
    }

    // Simultanuously draw all our charts on screen
    await Promise.all([
      this.drawDayVsNightChart(totalDay, totalNight),
      this.drawDailyUsageChart(data),
      this.calculateMoreStats(data),
    ]);

    this.segmentsRendered["30days"] = true;
  }

  private formatTimestampForChartAxis(rawTimestamp){
    const date = new Date(rawTimestamp * 1000);
    const months = ["Jan", 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return date.getDate() + ' ' + months[date.getMonth()];
  }

  /**
   * Calculate additional statistics that are displayed as text. This is based on
   * the data given to the function (return data from the API).
   */
  private async calculateMoreStats(data) {
    const dailyTotals = data.data.usageData.map(item => item.dayUse + item.nightUse);

    const total = dailyTotals.reduce((a, b) => a + b);

    this.moreStats.daily_average = total / dailyTotals.length;
    this.moreStats.total_30days = total;
  }

  /**
   * Draw the pie chart that shows the difference between day and night usage.
   */
  private async drawDayVsNightChart(dayUsage: number, nightUsage: number) {
    const self = this;

    Highcharts.chart(this.dayVsNightChartRef.nativeElement, {
      chart: {
        type: 'pie'
      },
      title: {
        text: null,
      },
      plotOptions:{
        pie: {
          colors: ['#534B62', '#8440FF'],
          dataLabels:{
            enabled: true,
            distance: -30,
            style:{
              color: 'white'
            }
          }
        }
      },
      tooltip: {
        formatter: function(){
          return `<b>${this.point.name} usage:</b>
                  <br>${self.decimalPipe.transform(this.y, '1.1-2')} kWh`;
        }
      },
      series: [{
        type: 'pie',
        name: 'Day vs Night',
        data: [
          ['Night', nightUsage],
          ['Day', dayUsage],
        ]
      }]
    });
  }

  private async drawDailyUsageChart(data) {
    // Reference to our page instance for use inside the formatter
    // of Highcharts (arrow functions not allowed)
    const self = this;

    Highcharts.chart(this.usageChartRef.nativeElement, {
      chart: {
        type: 'column',
      },
      title: {
        text: null,
      },
      legend:{
        enabled: false,
      },
      xAxis:{
        categories: data.data.usageData.map(el => this.formatTimestampForChartAxis(el.timestamp)),
      },
      yAxis:{
        min: 0,
        allowDecimals: false,
        title:{
          text: null,
        }
      },
      tooltip: {
        formatter: function(){
          return `<b>${this.x} - ${this.series.name} usage:</b>
                  <br> ${self.decimalPipe.transform(this.y, '1.1-2')} kWh`;
        }
      },
      plotOptions: {
        column: {
          stacking: 'normal',
          pointPadding: 0,
          borderWidth: 0
        }
      },
      series: [
        {
          type: 'column',
          name: 'Night',
          color: '#534B62',
          data: data.data.usageData.map(el => el.nightUse),
        },
        {
          type: 'column',
          name: 'Day',
          color: '#8440FF',
          data: data.data.usageData.map(el => el.dayUse),
        },
      ]
    });
  }
}
