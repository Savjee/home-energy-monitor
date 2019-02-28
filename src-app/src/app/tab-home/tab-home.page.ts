import { Component, OnInit } from '@angular/core';
import { EnergyService } from '../services/energy-service.service';

@Component({
  selector: 'app-tab-home',
  templateUrl: './tab-home.page.html',
  styleUrls: ['./tab-home.page.scss'],
})
export class TabHomePage {

  public stats = {
    current: '?',
    always_on: '?',
    today_so_far: '?',
  }


  private intervalTimer = null;
  private scheduledTimeout = null;
  private lastUpdate = null;

  constructor(public energyService: EnergyService) { }

  /**
   * Called when the user reaches the main screen. Here we should determn what
   * should happen with the background refresh operations (cancel them or
   * schedule new ones)
   */
  async ionViewWillEnter() {
    // Define how long we should wait in between refreshed (30 seconds)
    const minimumWaitTime = 30 * 1000;

    if (this.intervalTimer !== null) {
      clearInterval(this.intervalTimer);
    }

    // If we haven't updated before, we can do it straight away and not
    // care about anything else.
    if (this.lastUpdate === null) {
      await this.fetchData(true);
      this.scheduleTimer();
      return;
    }

    const updateTimeDelta = Date.now() - this.lastUpdate;

    // If we updated before but it was more then 30 seconds ago, refresh it
    // now again and don't continue executing code.
    if (updateTimeDelta > minimumWaitTime) {
      await this.fetchData();
      this.scheduleTimer();
      return;
    }

    // If we get here it means we updates less then 30 seconds but the user
    // has reopened the dashboard. Calculate how long we must wait to reach 30
    // seconds and then schedule a timer to do the refresh.
    this.scheduleTimer(minimumWaitTime - updateTimeDelta);
    return;
  }

  /**
   * Called when the user leaves the main screen. Here we should cancel the
   * timer that automatically refreshes the screen.
   */
  async ionViewDidLeave() {
    clearInterval(this.intervalTimer);
  }

  /**
   * Schedules a refresh action after a given delay of waitMs milliseconds.
   * Also cancels any pending timeout should there be one.
   * @param waitMs Time to wait in milliseconds
   */
  private scheduleTimer(waitMs = 0) {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
    }

    this.scheduledTimeout = setTimeout(async () => {
      this.intervalTimer = setInterval(async () => {
        await this.fetchData();
      }, 30 * 1000);
    }, waitMs);

  }

  /**
   *
   * @param all Wether or not to fetch the "always_on" and "today_so_far"
   *            Best to set these to false if not needed
   */
  private async fetchData(all?: boolean) {
    const realtime = await this.energyService.getHomePageStatistics(all);

    this.stats.current = realtime.data.realtime[realtime.data.realtime.length - 1].reading;

    if (all === true) {
      this.stats.always_on = realtime.data.stats.always_on;
      this.stats.today_so_far = realtime.data.stats.today_so_far;
    }

    this.lastUpdate = Date.now();
  }
}
