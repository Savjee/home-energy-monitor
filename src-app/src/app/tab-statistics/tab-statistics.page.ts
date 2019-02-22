import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { EnergyService } from '../services/energy-service.service';
import { Chart } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

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

  constructor(private energyService: EnergyService) { }

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
    const ctx = this.dayVsNightChartRef.nativeElement.getContext('2d');
    new Chart(ctx, {
      plugins: [ChartDataLabels],
      type: 'doughnut',
      data: {
        datasets: [{
          data: [ dayUsage, nightUsage],
          backgroundColor: ['rgb(54, 162, 235)', 'rgb(29, 41, 81)'],
        }],
        labels: ['Day usage', 'Night usage']
      },
      options: {
        tooltips: { enabled: false },
        legend: { display: false },
        layout: {
          padding: {
            top: 10,
          }
        },
        responsive: true,
        circumference: Math.PI,
        rotation: -Math.PI,
        plugins: {
          datalabels: {
            borderColor: 'white',
						borderRadius: 25,
            borderWidth: 2,
            color: 'white',
            anchor: 'end',
            font: {
							weight: 'bold'
						},
						formatter: function(value, context) {
              return Math.round(value) + ' kWh';
            },
            backgroundColor: function(context) {
							return context.dataset.backgroundColor;
						}
          }
        }
      }
    });
  }

  private async drawDailyUsageChart(data) {
    // Now transform it
    const chartData = {
      labels: data.data.usageData.map(el => this.formatTimestampForChartAxis(el.timestamp)),
			datasets: [
				{
					label: 'Day',
					backgroundColor: 'rgb(54, 162, 235)',
					data: data.data.usageData.map(el => el.dayUse)
				},
				{
					label: 'Night',
					backgroundColor: 'rgb(29, 41, 81)',
					data: data.data.usageData.map(el => el.nightUse)
				},
			]
    }

    // Draw the chart
    const ctx = this.usageChartRef.nativeElement.getContext('2d');

    new Chart(ctx, {
      type: 'bar',
      plugins: [],
      data: chartData,
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
    });
  }
}
