import { fail } from '../http.js';

export function takeOfficialNumber(existing:number|null, series:{series:string;year:number;nextValue:number}|null):{officialSeries:string;officialYear:number;officialNumber:number} {
  if(existing!=null) fail(409,'ALREADY_FILED','This measure already has an official number.');
  if(!series) fail(422,'SERIES_NOT_CONFIGURED','Official numbering is not configured (D-04).');
  return {officialSeries:series.series,officialYear:series.year,officialNumber:series.nextValue};
}
