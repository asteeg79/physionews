import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const BERLIN = 'Europe/Berlin';

export function getBerlinHour(date: Date = new Date()): number {
  return toZonedTime(date, BERLIN).getHours();
}

export function toBerlinDate(date: Date): Date {
  return toZonedTime(date, BERLIN);
}

export function berlinStartOfDay(date: Date = new Date()): Date {
  const berlin = toZonedTime(date, BERLIN);
  berlin.setHours(0, 0, 0, 0);
  return fromZonedTime(berlin, BERLIN);
}
