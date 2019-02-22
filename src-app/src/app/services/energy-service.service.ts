import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class EnergyService {

  /**
   * Indicates wether or not there is a network request in process. Is used
   * to toggle the visibility of certain spinners in the application.
   */
  private isLoading = false;

  /**
   * The URL to the main GraphQL API. This will be used to make all requests.
   */
  private BASE_URL = "***REMOVED***";



  constructor(private http: HttpClient) { }

  public async getStatistics(): Promise<MainStats>{

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


  /**
   * Makes a request to the GraphQL API and returns a promise that should
   * be awaited.
   *
   * @param query The GraphQL query that should be executed
   */
  private makeGraphQLRequest(query: string) {
    return this.http.post(
      this.BASE_URL,
      query
    ).toPromise();
  }
}

export interface MainStats{

}
