import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'home',
        children: [
          {
            path: '',
            loadChildren: '../tab-home/tab-home.module#TabHomeModule'
          }
        ]
      },
      {
        path: 'readings',
        children: [
          {
            path: '',
            loadChildren: '../tab-readings/tab-readings.module#TabReadingsModule'
          }
        ]
      },
      {
        path: 'statistics',
        children: [
          {
            path: '',
            loadChildren: '../tab-statistics/tab-statistics.module#TabStatisticsModule'
          }
        ]
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class TabsPageRoutingModule {}
