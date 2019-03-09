import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class EnergyService {

  /**
   * The URL to the main GraphQL API. This will be used to make all requests.
   */
  private BASE_URL = "***REMOVED***";

  private pendingRequests = [];



  constructor(private http: HttpClient) { }

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

  public async getReadingsForDate(): Promise<any>{
    const timestamp = new Date();
    timestamp.setHours(timestamp.getHours() - 6);

    const data = await this.makeGraphQLRequest(`
      query{
        realtime(sinceTimestamp: ${Math.floor(timestamp.getTime() / 1000)}){
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

    this.pendingRequests.push(req);

    const data = await req;

    this.pendingRequests.splice(
      this.pendingRequests.indexOf(req),
      1
    );

    return data;

  }
}

export interface MainStats{
  data: any;
}
