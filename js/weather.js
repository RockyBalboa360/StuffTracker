// Wetter: DWD über Bright Sky, Rückfall auf MET Norway (api.met.no). Dazu Ortssuche, Wetterstationen und Wettersymbole.
import { getLang } from './i18n.js';

const BS = 'https://api.brightsky.dev';
const MET = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
export const TTL = 15 * 60 * 1000;
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';

const pad = (n) => String(n).padStart(2, '0');
const ymdLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymdShifted = (ms) => new Date(ms).toISOString().slice(0, 10); // ms bereits um den Orts-Offset verschoben
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

async function getJson(url, ms = 12000) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return await r.json();
  } finally { clearTimeout(id); }
}

/* ---------- Symbole ---------- */
const WET = new Set(['fog', 'rain', 'sleet', 'snow', 'hail', 'thunderstorm']);
const iconOf = (condition, icon) => (WET.has(condition) ? condition : (icon || 'cloudy'));
function iconFromMet(code = '') {
  const night = /_night$/.test(code);
  const base = code.replace(/_(day|night|polartwilight)$/, '');
  if (base.includes('thunder')) return 'thunderstorm';
  if (base.includes('sleet')) return 'sleet';
  if (base.includes('snow')) return 'snow';
  if (base.includes('rain')) return 'rain';
  if (base === 'fog') return 'fog';
  if (base === 'clearsky') return night ? 'clear-night' : 'clear-day';
  if (base === 'fair' || base === 'partlycloudy') return night ? 'partly-cloudy-night' : 'partly-cloudy-day';
  return 'cloudy';
}
const dayIcon = (i) => ({ 'clear-night': 'clear-day', 'partly-cloudy-night': 'partly-cloudy-day' }[i] || i);

const SUN = (cx, cy, r = 7, k = 1) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FCCC0A"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
  const rad = (a * Math.PI) / 180; const r1 = (r + 3 * k); const r2 = (r + 7 * k);
  return `<line x1="${(cx + Math.cos(rad) * r1).toFixed(1)}" y1="${(cy + Math.sin(rad) * r1).toFixed(1)}" x2="${(cx + Math.cos(rad) * r2).toFixed(1)}" y2="${(cy + Math.sin(rad) * r2).toFixed(1)}" stroke="#FCCC0A" stroke-width="${2.6 * k}" stroke-linecap="round"/>`;
}).join('')}`;
const MOON = (x = 0, y = 0, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M30 8a15 15 0 1 0 10 26A12 12 0 0 1 30 8z" fill="#E4E7F6"/>`;
const CLOUD = (x = 0, y = 0, s = 1, c = '#C9CDD6') => `<path transform="translate(${x} ${y}) scale(${s})" d="M13 38a8.5 8.5 0 0 1-1-16.9A11 11 0 0 1 33 18.5 9.5 9.5 0 0 1 35 38z" fill="${c}"/>`;
const DROPS = (n = 3, c = '#4DA3FF') => [0, 1, 2].slice(0, n).map((i) => `<line x1="${16 + i * 8}" y1="40" x2="${14 + i * 8}" y2="46" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`).join('');
const FLAKES = (c = '#FFFFFF') => [0, 1, 2].map((i) => `<circle cx="${16 + i * 8}" cy="43" r="2.3" fill="${c}"/>`).join('');

const ICON_PARTS = {
  'clear-day': SUN(24, 24, 9),
  'clear-night': MOON(0, 3, 1),
  'partly-cloudy-day': `${SUN(17, 17, 7, .85)}${CLOUD(4, 4, .95)}`,
  'partly-cloudy-night': `${MOON(-6, -4, .75)}${CLOUD(4, 4, .95)}`,
  cloudy: CLOUD(0, 0, 1.05, '#C9CDD6'),
  fog: `${CLOUD(0, -6, 1, '#B9BEC8')}<g stroke="#9CA3AF" stroke-width="3" stroke-linecap="round"><line x1="10" y1="35" x2="38" y2="35"/><line x1="14" y1="41" x2="42" y2="41"/></g>`,
  wind: '<g fill="none" stroke="#B9BEC8" stroke-width="3.2" stroke-linecap="round"><path d="M6 18h24a5 5 0 1 0-5-5"/><path d="M6 26h32a5 5 0 1 1-5 5"/><path d="M6 34h16"/></g>',
  rain: `${CLOUD(0, -6, 1, '#AEB4C0')}${DROPS()}`,
  sleet: `${CLOUD(0, -6, 1, '#AEB4C0')}<line x1="16" y1="40" x2="14" y2="46" stroke="#4DA3FF" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="43" r="2.3" fill="#fff"/><line x1="32" y1="40" x2="30" y2="46" stroke="#4DA3FF" stroke-width="3" stroke-linecap="round"/>`,
  snow: `${CLOUD(0, -6, 1, '#C3C8D2')}${FLAKES()}`,
  hail: `${CLOUD(0, -6, 1, '#AEB4C0')}<circle cx="16" cy="43" r="2.6" fill="#D6ECFF"/><circle cx="25" cy="45" r="2.6" fill="#D6ECFF"/><circle cx="34" cy="43" r="2.6" fill="#D6ECFF"/>`,
  thunderstorm: `${CLOUD(0, -7, 1, '#7C8494')}<path d="M26 28l-8 11h6l-3 9 11-13h-6l3-7z" fill="#FCCC0A"/>`,
};
export const weatherIcon = (name, size = 48) =>
  `<svg class="wxi" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${ICON_PARTS[name] || ICON_PARTS.cloudy}</svg>`;

/* ---------- Auswertung ---------- */
function summarize(series, offMs, nowMs) {
  const next3 = series.filter((s) => s.step === 1 && s.t > nowMs).slice(0, 3);
  const tomorrow = ymdShifted(nowMs + offMs + 864e5);
  const ds = series.filter((s) => ymdShifted(s.t + offMs) === tomorrow);
  if (!ds.length) return { next3, tomorrow: null };
  const temps = ds.map((s) => s.temp);
  const probs = ds.map((s) => s.prob).filter((x) => x != null);
  const noon = ds.reduce((best, s) => {
    const d = Math.abs(new Date(s.t + offMs).getUTCHours() - 13);
    return !best || d < best.d ? { s, d } : best;
  }, null).s;
  return {
    next3,
    tomorrow: {
      tmin: Math.min(...temps), tmax: Math.max(...temps),
      precip: ds.reduce((a, s) => a + (s.precip || 0), 0),
      prob: probs.length ? Math.max(...probs) : null,
      icon: dayIcon(noon.icon),
    },
  };
}

async function fromDwd(p) {
  const now = new Date();
  const auto = `${BS}/current_weather?lat=${p.lat}&lon=${p.lon}&tz=${TZ}`;
  const byStation = p.station?.id ? `${BS}/current_weather?dwd_station_id=${encodeURIComponent(p.station.id)}&tz=${TZ}` : null;
  const fcUrl = `${BS}/weather?lat=${p.lat}&lon=${p.lon}&date=${ymdLocal(now)}&last_date=${ymdLocal(addDays(now, 2))}&tz=${TZ}`;
  const cwPromise = byStation ? getJson(byStation).catch(() => getJson(auto)) : getJson(auto);
  const [cw, fc] = await Promise.all([cwPromise, getJson(fcUrl)]);
  const c = cw.weather;
  if (!c || c.temperature == null) throw new Error('no current data');
  const series = (fc.weather || []).filter((w) => w.temperature != null)
    .map((w) => ({ t: Date.parse(w.timestamp), step: 1, temp: w.temperature, precip: w.precipitation ?? 0, prob: w.precipitation_probability ?? null, icon: iconOf(w.condition, w.icon) }));
  if (series.length < 6) throw new Error('no forecast data');
  const offMs = -new Date().getTimezoneOffset() * 60000;
  const src = cw.sources?.[0];
  return {
    source: 'dwd', sourceName: 'DWD',
    station: src ? { name: src.station_name, km: src.distance != null ? Math.round(src.distance / 1000) : null } : null,
    now: { temp: c.temperature, icon: iconOf(c.condition, c.icon), precip: c.precipitation_60 ?? null, precipKind: 'last', wind: c.wind_speed_10 ?? c.wind_speed ?? null, hum: c.relative_humidity ?? null, time: Date.parse(c.timestamp) },
    ...summarize(series, offMs, Date.now()),
  };
}

async function fromMet(p) {
  const j = await getJson(`${MET}?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}`);
  const nowMs = Date.now();
  const series = j.properties.timeseries.map((e) => {
    const d = e.data; const one = d.next_1_hours; const six = d.next_6_hours; const nx = one || six;
    return {
      t: Date.parse(e.time), step: one ? 1 : 6, temp: d.instant.details.air_temperature, wind: d.instant.details.wind_speed,
      hum: d.instant.details.relative_humidity, precip: (one || six)?.details?.precipitation_amount ?? 0, prob: null, icon: iconFromMet(nx?.summary?.symbol_code),
    };
  });
  const cur = series.filter((s) => s.t <= nowMs + 30 * 60000).pop() || series[0];
  const offMs = Math.round(p.lon / 15) * 3600000;
  return {
    source: 'met', sourceName: 'MET Norway', station: null,
    now: { temp: cur.temp, icon: cur.icon, precip: cur.step === 1 ? cur.precip : null, precipKind: 'next', wind: cur.wind != null ? cur.wind * 3.6 : null, hum: cur.hum ?? null, time: cur.t },
    ...summarize(series, offMs, nowMs),
  };
}

/* ---------- Zwischenspeicher + Abruf ---------- */
const key = (pid) => `st_weather_${pid}`;
export function cached(pid) { try { return JSON.parse(localStorage.getItem(key(pid))); } catch { return null; } }
function save(pid, w) { try { localStorage.setItem(key(pid), JSON.stringify(w)); } catch { /* voll/gesperrt */ } }
export const usable = (w, p) => !!w && w.lat === p.lat && w.lon === p.lon && (w.stationId || null) === (p.station?.id || null);
export const stale = (w) => !w || Date.now() - w.fetchedAt > TTL;
export const hasCoords = (p) => p && p.lat != null && p.lon != null && Number.isFinite(Number(p.lat));

/** Holt das Wetter: erst DWD, bei fehlenden Daten (z. B. außerhalb Deutschlands) MET Norway. */
export async function refresh(p) {
  let data;
  try { data = await fromDwd(p); } catch { data = await fromMet(p); }
  Object.assign(data, { fetchedAt: Date.now(), lat: p.lat, lon: p.lon, stationId: p.station?.id || null });
  save(p.id, data);
  return data;
}

/* ---------- Ortssuche und Stationen ---------- */
export function parseCoords(s) {
  const m = String(s).trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1].replace(',', '.')); const lon = Number(m[2].replace(',', '.'));
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
/** Adresse, Straße, Stadt oder Ortschaft -> bis zu 6 Treffer (Nominatim, sonst Open-Meteo). */
export async function geocode(q) {
  const lang = getLang();
  const enc = encodeURIComponent(q);
  try {
    const j = await getJson(`https://nominatim.openstreetmap.org/search?q=${enc}&format=jsonv2&limit=6&accept-language=${lang}`);
    if (j.length) return j.map((x) => ({ label: x.display_name, lat: Number(x.lat), lon: Number(x.lon) }));
  } catch { /* weiter mit Open-Meteo */ }
  const j = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${enc}&count=6&language=${lang}&format=json`);
  return (j.results || []).map((r) => ({ label: [r.name, r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude }));
}
const nice = (s) => String(s).toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
/** Bekannte DWD-Wetterstationen in der Nähe (Messstationen mit aktuellen Werten), nach Entfernung sortiert. */
export async function stations(lat, lon) {
  const j = await getJson(`${BS}/sources?lat=${lat}&lon=${lon}&max_dist=60000`);
  const seen = new Map();
  for (const s of j.sources || []) {
    if (s.observation_type === 'current' && s.dwd_station_id && !seen.has(s.dwd_station_id)) {
      seen.set(s.dwd_station_id, { id: s.dwd_station_id, name: nice(s.station_name), km: Math.round(s.distance / 100) / 10 });
    }
  }
  return [...seen.values()].sort((a, b) => a.km - b.km);
}
