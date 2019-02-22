import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { EnergyService } from '../services/energy-service.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-tab-statistics',
  templateUrl: './tab-statistics.page.html',
  styleUrls: ['./tab-statistics.page.scss'],
})
export class TabStatisticsPage implements OnInit, AfterViewInit {

  @ViewChild('usageChart') private usageChartRef: ElementRef;
  @ViewChild('dayVsNight') private dayVsNightChartRef: ElementRef;

  private usageChartInstance: Chart;

  constructor(private energyService: EnergyService) { }

  ngOnInit() {
  }

  async ngAfterViewInit() {
    await this.drawDailyUsageChart();
  }

  private formatTimestampForChartAxis(rawTimestamp){
    const date = new Date(rawTimestamp * 1000);
    const months = ["Jan", 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return date.getDate() + ' ' + months[date.getMonth()];
  }

  private async drawDayVsNightChart(dayUsage: number, nightUsage: number) {
    const ctx = this.dayVsNightChartRef.nativeElement.getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [ dayUsage, nightUsage ],
          backgroundColor: ['rgb(54, 162, 235)', 'rgb(29, 41, 81)']
        }],
        labels: ['Day usage', 'Night usage']
      },
      options: {
        responsive: true,
        circumference: Math.PI,
				rotation: -Math.PI,
      }
    });
  }

  private async drawDailyUsageChart() {
    // Fetch the data
    const data = await this.energyService.getStatistics();

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

    this.usageChartInstance = new Chart(ctx, {
      type: 'bar',
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

    // Calculate total day/night usage
    let totalDay = 0;
    let totalNight = 0;

    for (const entry of data.data.usageData) {
      totalDay += entry.dayUse;
      totalNight += entry.nightUse;
    }

    this.drawDayVsNightChart(totalDay, totalNight);
  }
}
