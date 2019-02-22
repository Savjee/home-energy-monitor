import { Component, OnInit } from '@angular/core';
import { EnergyService } from '../services/energy-service.service';

@Component({
  selector: 'app-tab-statistics',
  templateUrl: './tab-statistics.page.html',
  styleUrls: ['./tab-statistics.page.scss'],
})
export class TabStatisticsPage implements OnInit {

  constructor(private energyService: EnergyService) { }

  ngOnInit() {
    this.energyService.getStatistics();
  }

}
