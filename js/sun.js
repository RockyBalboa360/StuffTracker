// Sonnenauf-/untergang (NOAA-Näherung) für den automatischen Hell/Dunkel-Modus.
const rad = Math.PI / 180;

export function sunTimes(date, lat, lon) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  const day = Math.floor((Date.UTC(y, m, d) - Date.UTC(y, 0, 0)) / 86400000);
  const g = (2 * Math.PI / 365) * (day - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const arg = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (arg > 1) return { polar: 'night' };
  if (arg < -1) return { polar: 'day' };
  const ha = Math.acos(arg) / rad;
  const base = Date.UTC(y, m, d);
  return {
    rise: new Date(base + (720 - 4 * (lon + ha) - eqt) * 60000),
    set: new Date(base + (720 - 4 * (lon - ha) - eqt) * 60000),
  };
}

export function isDaytime(now, lat, lon) {
  if (lat == null || lon == null) {
    const h = now.getHours();
    return h >= 7 && h < 19;
  }
  const s = sunTimes(now, lat, lon);
  if (s.polar) return s.polar === 'day';
  const mod = (x) => ((x % 1440) + 1440) % 1440;
  const since = mod((now - s.rise) / 60000);
  const span = mod((s.set - s.rise) / 60000);
  return since < span;
}
