import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class EnergyService {

  /**
   * The URL to the main GraphQL API. This will be used to make all requests.
   */
  private BASE_URL = "***REMOVED***";

  private pendingRequests = [];

  constructor(private http: HttpClient, private toastCtrl: ToastController) { }

  public isLoading() {
    return this.pendingRequests.length !== 0;
  }

  public async getStatistics(): Promise<any>{

    // Calculate the start and ending dates
    const startDate = new Date();
		startDate.setDate(startDate.getDate() - 31);

    // Convert these to timestamps and make them whole (no floats)
		const start = Math.floor(startDate.getTime() / 1000);
    const end = Math.ceil(Date.now() / 1000);

    // Make the request
    const data = await this.makeGraphQLRequest(`
      query{
        usageData(startDate:${start}, endDate:${end}){
          timestamp,
          dayUse,
          nightUse
        }
      }
    `);

    console.log('Fetched stats:', data);
    return data;
  }

  public async getHomePageStatistics(all?: boolean): Promise<any>{
    const timestamp = Math.floor(Date.now() / 1000 - 60);

    let additionalQueries = '';
    if (all === true) {
      additionalQueries = `
      stats{
          always_on
          today_so_far
      }`
    }

    const data = await this.makeGraphQLRequest(`
      query{
        realtime(sinceTimestamp: ${timestamp}){
          timestamp
          reading
        },
        ${additionalQueries}
      }
    `);

    console.log('realtime', data);

    return data;
  }

  public async getReadings(since?: number): Promise<any> {
    if (!since) {
      const date = new Date();
      date.setHours(date.getHours() - 6);
      since = date.getTime();
    }

    console.log('since', since);

    const data = await this.makeGraphQLRequest(`
      query{
        realtime(sinceTimestamp: ${Math.floor(since / 1000)}){
          timestamp, reading
        }
      }`
    );

    console.log('readings', data.data.realtime);
    return data.data.realtime;
  }


  /**
   * Makes a request to the GraphQL API and returns a promise that should
   * be awaited.
   *
   * @param query The GraphQL query that should be executed
   */
  private async makeGraphQLRequest(query: string): Promise<any> {

    const req = this.http.post(
      this.BASE_URL,
      query
    ).toPromise();

    // Push the request into the array so we can show load spinners
    // in the application at various places.
    this.pendingRequests.push(req);

    req
      .then((data) => {
        return data;
      })
      .catch(async (err) => {
        console.error('Error making GraphQL request', err);

        const toast = await this.toastCtrl.create({
          message: 'Could not fetch data from server. Try again later.',
          duration: 5000,
          showCloseButton: true,
          position: 'top',
          color: 'dark'
        });

        toast.present();
      })
      .finally(() => {

        // After any request, regardless of wether it was successfull
        // or not, we have to remove it from the pendingRequests array
        // so that all loading spinners dissapear in the UI.
        this.pendingRequests.splice(
          this.pendingRequests.indexOf(req),
          1
        );
      });

    // Return the pending requests so other methods can await it.
    return req;
  }
}

export interface MainStats{
  data: any;
}
