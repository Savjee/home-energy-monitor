import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { EnergyService } from '../services/energy-service.service';
import * as Highcharts from 'highcharts';

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
  @ViewChild('chart2') private mainChart2Ref: ElementRef;
  private chartData = [];


  constructor(public energyService: EnergyService) { }


  public async ionViewWillEnter() {
    if (this.chartData.length === 0) {
      const data = await this.energyService.getReadingsForDate();

      const filtered = data.filter(item => item.timestamp % 30 === 0);

      this.chartData = filtered;
      console.log('chart data', this.chartData);
      this.renderChart();
    }
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

    // console.log(this.chartData);

    Highcharts.chart(this.mainChart2Ref.nativeElement, {
      // legend: {
          // layout: 'vertical',
          // align: 'right',
          // verticalAlign: 'middle'
      // },
      title: {
        text: null,
      },

      legend: {
        enabled: false,
      },

      plotOptions: {
          series: {
              label: {
                  connectorAllowed: false
              },
            pointStart: 2010,
        },
        area: {
          fillColor: null,
        }
      },

      chart: {
        type: "line",
        panning: true,
        zoomType: null,
      },

      xAxis: {
        min: Date.now() - 4*60*60*1000,
        max: Date.now(),
        type: 'datetime',
      },

      yAxis: {
        min: 0,
        max: Math.max(...values),
        title: {
          text: null,
        }
      },


      series: [
        {
          type: null,
          name: 'Usage',
          color: '#8440FF',
          data: data
        }
      ],

      tooltip: {
        valueSuffix: 'W',
        followTouchMove: false,
      },

      responsive: {
          rules: [{
              condition: {
                  // maxWidth: 500
              },
              chartOptions: {
                  // legend: {
                      // layout: 'horizontal',
                      // align: 'center',
                      // verticalAlign: 'bottom'
                  // }
              }
          }]
      }

  });

    // const ctx = this.mainChartRef.nativeElement.getContext('2d');
    // new Chart(ctx, {
    //   type: 'line',
    //   data: {
    //     labels: labels,
    //     datasets: [
    //       {
    //         'label': 'Test',
    //         data: data,
    //         pointRadius: 0,
    //         borderColor: '#8440FF',
    //         fill: false,
    //       }
    //     ]
    //   },
    //   options: {
    //     tooltips: { enabled: false },
    //     animation: {
    //       duration: 0, // general animation time
    //     },
    //     legend: { display: false },
    //     layout: {
    //       padding: {
    //         top: 10,
    //       }
    //     },

    //     responsive: true,
    //     maintainAspectRatio: false,
    //     scales: {
    //       xAxes: [{
    //         type: 'time',
    //         time: {
    //           displayFormats: {
    //             minute: 'hh:mm'
    //           }
    //         }
    //       }],
    //       yAxes: [{ ticks: { min: 0 } }]
    //     },
    //     elements: {
    //       line: {
    //           // tension: 0, // disables bezier curves
    //       }
    //     }
    //   }
    // });
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
