import { daylightState, referencePoint, type DaylightState } from "../tokens/daylight.js";

/**
 * Sun altitude in degrees for a moment and place. Compact NOAA-style approximation; accurate to
 * a fraction of a degree, which is plenty for choosing an environmental state.
 */
export function sunAltitudeDeg(date: Date, lat: number, lon: number): number {
  const rad = Math.PI / 180;
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const d = jd - 2451545.0; // days since J2000
  const g = rad * ((357.529 + 0.98560028 * d) % 360); // mean anomaly
  const q = (280.459 + 0.98564736 * d) % 360; // mean longitude
  const L = rad * ((q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360); // ecliptic longitude
  const e = rad * (23.439 - 0.00000036 * d); // obliquity
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)); // right ascension
  const dec = Math.asin(Math.sin(e) * Math.sin(L)); // declination
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24; // Greenwich mean sidereal time, hours
  const lst = (((gmst + lon / 15) % 24) + 24) % 24;
  let ha = lst * 15 * rad - ra; // hour angle
  ha = ((((ha + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  const alt = Math.asin(
    Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha),
  );
  return alt / rad;
}

/** Environmental state for Switzerland at `date` (reference point Bern). */
export function daylightStateAt(date: Date, point = referencePoint): DaylightState {
  const alt = sunAltitudeDeg(date, point.lat, point.lon);
  const later = sunAltitudeDeg(new Date(date.getTime() + 10 * 60_000), point.lat, point.lon);
  return daylightState(alt, later > alt);
}
