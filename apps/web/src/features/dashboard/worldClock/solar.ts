/**
 * Where the sun is. A compact form of the NOAA/Meeus approximation — accurate
 * to about a minute of time, plenty for shading a globe and a 24-hour strip.
 * Angles in degrees unless noted.
 */

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

const normalize360 = (value: number) => ((value % 360) + 360) % 360

type SunEquatorial = {
  /** Declination: the latitude where the sun is overhead. */
  declination: number
  /** Right ascension. */
  rightAscension: number
  /** Greenwich mean sidereal time, as an angle. */
  sidereal: number
}

const daysSinceJ2000 = (date: Date) => date.getTime() / 86400000 - 10957.5

/**
 * The sun's apparent ecliptic longitude in degrees (0 at the March equinox).
 * Good to about 0.01°, a quarter of an hour of the sun's motion.
 */
export const sunEclipticLongitude = (date: Date) => {
  const d = daysSinceJ2000(date)
  const g = normalize360(357.529 + 0.98560028 * d) * RAD
  const q = normalize360(280.459 + 0.98564736 * d)
  return normalize360(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g))
}

const sunAt = (date: Date): SunEquatorial => {
  const d = daysSinceJ2000(date)
  const eclipticLongitude = sunEclipticLongitude(date) * RAD
  const obliquity = (23.439 - 0.00000036 * d) * RAD
  const rightAscension = normalize360(
    Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude)) * DEG,
  )
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude)) * DEG
  const sidereal = normalize360((18.697374558 + 24.06570982441908 * d) * 15)
  return { declination, rightAscension, sidereal }
}

/** The point on Earth where the sun is directly overhead. */
export const subsolarPoint = (date: Date) => {
  const { declination, rightAscension, sidereal } = sunAt(date)
  let longitude = normalize360(rightAscension - sidereal)
  if (longitude > 180) longitude -= 360
  return { latitude: declination, longitude }
}

/** Sun elevation above the horizon at a place (negative below it). */
export const sunElevation = (date: Date, latitude: number, longitude: number) => {
  const { declination, rightAscension, sidereal } = sunAt(date)
  const hourAngle = (sidereal + longitude - rightAscension) * RAD
  const lat = latitude * RAD
  const dec = declination * RAD
  return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle)) * DEG
}

export type Daylight = 'day' | 'golden' | 'twilight' | 'night'

/**
 * Light at a sun elevation: full day above 6°, the low golden sun between the
 * horizon and 6°, civil twilight down to −6°, then night.
 */
export const daylightAt = (elevation: number): Daylight => {
  if (elevation >= 6) return 'day'
  if (elevation >= 0) return 'golden'
  if (elevation >= -6) return 'twilight'
  return 'night'
}

/** Earth-fixed unit vector (x toward lon 0 on the equator, y north, z toward lon 90°W… see globe). */
export const latLonToVector = (latitude: number, longitude: number): [number, number, number] => {
  const lat = latitude * RAD
  const lon = longitude * RAD
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]
}
