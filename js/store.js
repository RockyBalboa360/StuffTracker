// Zentraler Zustand + Persistenz (IndexedDB). Fotos liegen in eigenem Store.
import { t, getLang } from './i18n.js';

export const VERSION = '0.2.0';
export const LIMITS = { places: 5, minPlaces: 2, tagsPerEntry: 4, tagsTotal: 16 };

let data = null;
let photos = new Map();
const subs = new Set();
let saveTimer = null;
let db = null;

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

/* ---------- IndexedDB ---------- */
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('stufftracker', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('kv');
      r.result.createObjectStore('photos');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = (store, mode = 'readonly') => db.transaction(store, mode).objectStore(store);
const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function persist() {
  if (!db) return;
  try { await wrap(tx('kv', 'readwrite').put(data, 'data')); } catch (e) { console.error('save failed', e); }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
}
export function flush() { clearTimeout(saveTimer); return persist(); }

/* ---------- Laden ---------- */
/** Ältere Datenstände auf das aktuelle Modell heben (v2: Tags tragen Stückzahlen). */
function migrate(d) {
  if ((d.v || 1) < 2) {
    const toCounts = (tags, qty) => (Array.isArray(tags) ? Object.fromEntries(tags.map((id) => [id, qty])) : tags || {});
    d.items.forEach((it) => Object.values(it.stock).forEach((e) => { e.tags = e.qty > 0 ? toCounts(e.tags, e.qty) : {}; }));
    d.transports.forEach((tr) => tr.lines.forEach((l) => { l.tags = toCounts(l.tags, l.qty); }));
    d.v = 2;
  }
  d.settings.homeButtons ||= 'dashboard';
  return d;
}

export async function load() {
  try {
    db = await openDb();
    data = await wrap(tx('kv').get('data'));
    if (data) { const before = data.v; migrate(data); if (before !== data.v) scheduleSave(); }
    const store = tx('photos');
    const keys = await wrap(store.getAllKeys());
    const vals = await wrap(tx('photos').getAll());
    keys.forEach((k, i) => photos.set(k, vals[i]));
    navigator.storage?.persist?.();
  } catch (e) {
    console.warn('IndexedDB nicht verfügbar, nur Arbeitsspeicher', e);
  }
  return data;
}
export const hasData = () => !!data;
export function init(lang) {
  data = seed(lang);
  scheduleSave();
}

export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const notify = () => subs.forEach((f) => f());
function mutate(fn) {
  const r = fn();
  scheduleSave();
  notify();
  return r;
}

/* ---------- Zugriff ---------- */
export const settings = () => data.settings;
export const places = () => data.places;
export const groups = () => data.groups;
export const tags = () => data.tags;
export const items = () => data.items;
export const transports = () => data.transports;
export const log = () => data.log;
export const place = (id) => data.places.find((p) => p.id === id);
export const group = (id) => data.groups.find((g) => g.id === id);
export const tag = (id) => data.tags.find((g) => g.id === id);
export const item = (id) => data.items.find((i) => i.id === id);
export const transport = (id) => data.transports.find((x) => x.id === id);
export const nm = (o) => (o ? (o.name ?? (o.key ? t(o.key) : '')) : '');
export const photo = (id) => photos.get(id);

export function sortedItems() {
  return [...data.items].sort((a, b) => nm(a).localeCompare(nm(b), getLang()));
}

export const qtyAt = (it, pid) => it.stock[pid]?.qty || 0;
export const totalQty = (it) => Object.values(it.stock).reduce((a, e) => a + e.qty, 0);

export function reserved(itemId, pid) {
  let n = 0;
  for (const tr of data.transports) {
    if (tr.status !== 'draft' || tr.from !== pid) continue;
    for (const l of tr.lines) if (l.itemId === itemId) n += l.qty;
  }
  return n;
}
export const available = (it, pid) => qtyAt(it, pid) - reserved(it.id, pid);

export function inTransit(itemId) {
  let n = 0;
  for (const tr of data.transports) {
    if (tr.status !== 'sent') continue;
    for (const l of tr.lines) if (l.itemId === itemId) n += l.qty;
  }
  return n;
}

export function lowStock(pid) {
  const out = [];
  for (const it of data.items) {
    const e = it.stock[pid];
    if (e && e.min?.on && e.qty < e.min.v) out.push({ item: it, entry: e });
  }
  return out;
}
export const isLow = (it, pid) => { const e = it.stock[pid]; return !!(e && e.min?.on && e.qty < e.min.v); };

export function currentPlaceId() {
  const s = data.settings;
  if (s.placeMode === 'manual' && place(s.manualPlace)) return s.manualPlace;
  if (place(s.lastPlace)) return s.lastPlace;
  return data.places[0].id;
}
export function setDetectedPlace(id) {
  if (data.settings.lastPlace === id) return;
  data.settings.lastPlace = id;
  scheduleSave();
  notify();
}
export function setGeo(lat, lon) {
  data.settings.lastGeo = { lat, lon, ts: Date.now() };
  scheduleSave();
}

/* ---------- Einstellungen ---------- */
export function setSetting(k, v) { mutate(() => { data.settings[k] = v; }); }
export function setWidget(patch) { mutate(() => { Object.assign(data.settings.widget, patch); }); }

/* ---------- Protokoll ---------- */
function addLog(type, o = {}) {
  data.log.unshift({ id: uid(), ts: Date.now(), type, ...o });
  if (data.log.length > 500) data.log.length = 500;
}
/** Tags tragen je Artikel+Ort eine Stückzahl: tags = { tagId: anzahl }, jede Zahl <= qty. */
function normalize(e) {
  if (e.qty <= 0) { e.qty = 0; e.tags = {}; return; }
  for (const k of Object.keys(e.tags)) {
    if (e.tags[k] > e.qty) e.tags[k] = e.qty;
    if (!(e.tags[k] > 0)) delete e.tags[k];
  }
}
function ensureEntry(it, pid) {
  return (it.stock[pid] ||= { qty: 0, tags: {}, min: { on: false, v: 1 } });
}
function addTagCounts(e, incoming) {
  for (const [k, n] of Object.entries(incoming || {})) {
    if (!(n > 0)) continue;
    if (!(k in e.tags) && Object.keys(e.tags).length >= LIMITS.tagsPerEntry) continue;
    e.tags[k] = (e.tags[k] || 0) + n;
  }
}
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
function trimTags(tags, qty) {
  let s = sum(tags);
  for (const k of Object.keys(tags).reverse()) {
    if (s <= qty) break;
    const cut = Math.min(tags[k], s - qty);
    tags[k] -= cut; s -= cut;
    if (tags[k] <= 0) delete tags[k];
  }
}
/** [[tag, anzahl], …] in der Reihenfolge der Tag-Liste. */
export function tagCounts(tags) {
  return data.tags.filter((g) => tags?.[g.id] > 0).map((g) => [g, tags[g.id]]);
}
export const untagged = (e) => Math.max(0, e.qty - sum(e.tags));

/** Stück je Tag, die nicht schon in Kisten (Vorbereitung) vorgemerkt sind. */
export function freeTags(it, pid) {
  const e = it.stock[pid]; const res = {};
  for (const tr of data.transports) {
    if (tr.status !== 'draft' || tr.from !== pid) continue;
    for (const l of tr.lines) if (l.itemId === it.id) for (const [k, n] of Object.entries(l.tags || {})) res[k] = (res[k] || 0) + n;
  }
  const out = {};
  for (const [k, n] of Object.entries(e?.tags || {})) { const f = n - (res[k] || 0); if (f > 0) out[k] = f; }
  return out;
}
export function defaultAlloc(it, pid, qty) {
  const free = freeTags(it, pid); const out = {}; let left = qty;
  for (const g of data.tags) {
    const f = free[g.id];
    if (f && left > 0) { const n = Math.min(f, left); out[g.id] = n; left -= n; }
  }
  return out;
}

/* ---------- Artikel ---------- */
export function addItem({ name, groupId, placeId, qty, photoData }) {
  return mutate(() => {
    const it = { id: uid(), name, groupId, stock: {}, createdAt: Date.now() };
    if (placeId && qty > 0) { const e = ensureEntry(it, placeId); e.qty = qty; }
    data.items.push(it);
    if (photoData) { photos.set(it.id, photoData); savePhoto(it.id, photoData); }
    addLog('itemNew', { item: name, place: place(placeId)?.name, qty });
    return it;
  });
}
export function updateItem(id, patch) {
  mutate(() => { const it = item(id); if (!it) return; if ('name' in patch) delete it.key; Object.assign(it, patch); });
}
export function itemInUse(id) {
  return data.transports.some((tr) => (tr.status === 'draft' || tr.status === 'sent') && tr.lines.some((l) => l.itemId === id));
}
export function deleteItem(id) {
  if (itemInUse(id)) return false;
  mutate(() => {
    const it = item(id);
    addLog('itemDel', { item: nm(it) });
    data.items = data.items.filter((i) => i.id !== id);
    data.retired = data.retired.filter((r) => r.itemId !== id);
    data.transports.forEach((tr) => { tr.lines = tr.lines.filter((l) => l.itemId !== id); });
    photos.delete(id); delPhoto(id);
  });
  return true;
}
async function savePhoto(id, v) { if (db) try { await wrap(tx('photos', 'readwrite').put(v, id)); } catch (e) { console.error(e); } }
async function delPhoto(id) { if (db) try { await wrap(tx('photos', 'readwrite').delete(id)); } catch (e) { console.error(e); } }
export function setPhoto(id, v) {
  mutate(() => {
    if (v) { photos.set(id, v); savePhoto(id, v); } else { photos.delete(id); delPhoto(id); }
  });
}

export function setQty(itemId, pid, qty) {
  mutate(() => {
    const it = item(itemId); const e = ensureEntry(it, pid);
    qty = Math.max(0, Math.floor(Number(qty) || 0));
    if (qty === e.qty) return;
    addLog('adjust', { item: nm(it), place: place(pid)?.name, from: e.qty, to: qty });
    e.qty = qty; normalize(e);
  });
}
/** Anzahl der Stücke mit diesem Tag setzen (0 entfernt das Tag). false = Tag-Limit erreicht. */
export function setTagCount(itemId, pid, tagId, n) {
  const e = item(itemId)?.stock[pid];
  if (!e) return true;
  n = Math.max(0, Math.min(e.qty, Math.floor(Number(n) || 0)));
  if (n > 0 && !(tagId in e.tags) && Object.keys(e.tags).length >= LIMITS.tagsPerEntry) return false;
  mutate(() => { if (n > 0) e.tags[tagId] = n; else delete e.tags[tagId]; });
  return true;
}
/** Startwert beim Hinzufügen eines Tags: die noch ungetaggten Stücke (mindestens 1). */
export function defaultTagCount(itemId, pid) {
  const e = item(itemId)?.stock[pid];
  return e ? Math.max(1, untagged(e)) : 1;
}
export function retire(itemId, pid, qty, reason, note) {
  mutate(() => {
    const it = item(itemId); const e = it.stock[pid];
    qty = Math.min(qty, e.qty);
    if (qty <= 0) return;
    e.qty -= qty; normalize(e);
    data.retired.unshift({ id: uid(), itemId, placeId: pid, qty, reason, note, ts: Date.now() });
    addLog('retire', { item: nm(it), place: place(pid)?.name, qty, reason });
  });
}
export const retiredFor = (itemId) => data.retired.filter((r) => r.itemId === itemId);
export function setMin(itemId, pid, on, v) {
  mutate(() => { const e = ensureEntry(item(itemId), pid); e.min = { on, v: Math.max(0, Math.floor(v) || 0) }; });
}

/* ---------- Orte ---------- */
export function addPlace(name) {
  if (data.places.length >= LIMITS.places) return null;
  return mutate(() => { const p = { id: uid(), name }; data.places.push(p); return p; });
}
export function updatePlace(id, patch) { mutate(() => Object.assign(place(id), patch)); }
export function placeBlocker(id) {
  if (data.items.some((it) => qtyAt(it, id) > 0)) return 'stock';
  if (data.transports.some((tr) => (tr.from === id || tr.to === id) && (tr.status === 'draft' || tr.status === 'sent'))) return 'transport';
  if (data.places.length <= LIMITS.minPlaces) return 'min';
  return null;
}
export function deletePlace(id) {
  if (placeBlocker(id)) return false;
  mutate(() => {
    data.places = data.places.filter((p) => p.id !== id);
    data.transports = data.transports.filter((tr) => tr.from !== id && tr.to !== id);
    data.items.forEach((it) => { delete it.stock[id]; });
    data.retired = data.retired.filter((r) => r.placeId !== id);
    if (data.settings.manualPlace === id) data.settings.manualPlace = null;
    if (data.settings.lastPlace === id) data.settings.lastPlace = null;
  });
  return true;
}

/* ---------- Gruppen ---------- */
export function addGroup(name) { return mutate(() => { const g = { id: uid(), name }; data.groups.push(g); return g; }); }
export function renameGroup(id, name) { mutate(() => { const g = group(id); delete g.key; g.name = name; }); }
export function moveGroup(id, d) {
  mutate(() => {
    const i = data.groups.findIndex((g) => g.id === id); const j = i + d;
    if (j < 0 || j >= data.groups.length) return;
    [data.groups[i], data.groups[j]] = [data.groups[j], data.groups[i]];
  });
}
export const groupCount = (id) => data.items.filter((i) => i.groupId === id).length;
export function deleteGroup(id) {
  if (groupCount(id)) return false;
  mutate(() => { data.groups = data.groups.filter((g) => g.id !== id); });
  return true;
}

/* ---------- Tags ---------- */
export function addTag(name, color) {
  if (data.tags.length >= LIMITS.tagsTotal) return null;
  return mutate(() => { const g = { id: uid(), name, style: 'plain', color }; data.tags.push(g); return g; });
}
export function updateTag(id, patch) {
  mutate(() => { const g = tag(id); if ('name' in patch) delete g.key; Object.assign(g, patch); });
}
export function deleteTag(id) {
  mutate(() => {
    data.tags = data.tags.filter((g) => g.id !== id);
    data.items.forEach((it) => Object.values(it.stock).forEach((e) => { delete e.tags[id]; }));
    data.transports.forEach((tr) => tr.lines.forEach((l) => { if (l.tags) delete l.tags[id]; }));
  });
}

/* ---------- Transporte ---------- */
export function createTransport({ from, to, name }) {
  return mutate(() => {
    data.settings.boxCounter = (data.settings.boxCounter || 0) + 1;
    const tr = {
      id: uid(), name: name || `${t('box')} ${data.settings.boxCounter}`,
      from, to, status: 'draft', createdAt: Date.now(), lines: [],
    };
    data.transports.unshift(tr);
    addLog('tNew', { box: tr.name, from: place(from)?.name, to: place(to)?.name });
    return tr;
  });
}
/** Stück in eine Kiste legen. alloc = { tagId: anzahl } legt fest, wie viele davon welches Tag tragen. */
export function addLine(tid, itemId, qty, alloc) {
  const tr = transport(tid); const it = item(itemId);
  if (!tr || tr.status !== 'draft' || !it) return false;
  if (qty > available(it, tr.from)) return false;
  alloc ||= defaultAlloc(it, tr.from, qty);
  const free = freeTags(it, tr.from);
  if (sum(alloc) > qty || Object.entries(alloc).some(([k, n]) => n > (free[k] || 0))) return false;
  const l = tr.lines.find((x) => x.itemId === itemId);
  mutate(() => {
    if (l) {
      l.qty += qty;
      for (const [k, n] of Object.entries(alloc)) if (n > 0) l.tags[k] = (l.tags[k] || 0) + n;
    } else {
      tr.lines.push({ itemId, qty, tags: Object.fromEntries(Object.entries(alloc).filter(([, n]) => n > 0)) });
    }
  });
  return true;
}
export function setLine(tid, itemId, qty) {
  const tr = transport(tid); const it = item(itemId);
  const l = tr?.lines.find((x) => x.itemId === itemId);
  if (!l || tr.status !== 'draft') return false;
  qty = Math.max(0, Math.floor(Number(qty) || 0));
  const max = available(it, tr.from) + l.qty;
  if (qty > max) qty = max;
  mutate(() => {
    if (qty === 0) tr.lines = tr.lines.filter((x) => x !== l);
    else { l.qty = qty; trimTags(l.tags, qty); }
  });
  return qty;
}
export function sendTransport(tid, dateISO) {
  const tr = transport(tid);
  if (!tr || tr.status !== 'draft' || !tr.lines.length) return false;
  for (const l of tr.lines) if (qtyAt(item(l.itemId), tr.from) < l.qty) return false;
  mutate(() => {
    for (const l of tr.lines) {
      const e = item(l.itemId).stock[tr.from];
      for (const [k, n] of Object.entries(l.tags || {})) if (e.tags[k]) e.tags[k] = Math.max(0, e.tags[k] - n);
      e.qty -= l.qty; normalize(e);
    }
    tr.status = 'sent'; tr.sentAt = dateISO;
    addLog('tSend', { box: tr.name, from: place(tr.from)?.name, to: place(tr.to)?.name, n: tr.lines.length });
  });
  return true;
}
export function arriveTransport(tid, dateISO) {
  const tr = transport(tid);
  if (!tr || tr.status !== 'sent') return false;
  mutate(() => {
    for (const l of tr.lines) {
      const it = item(l.itemId); if (!it) continue;
      const e = ensureEntry(it, tr.to);
      e.qty += l.qty;
      addTagCounts(e, l.tags);
      normalize(e);
    }
    tr.status = 'arrived'; tr.arrivedAt = dateISO;
    addLog('tArrive', { box: tr.name, to: place(tr.to)?.name, n: tr.lines.length });
  });
  return true;
}
export function cancelTransport(tid) {
  const tr = transport(tid);
  if (!tr) return false;
  mutate(() => {
    if (tr.status === 'draft') {
      data.transports = data.transports.filter((x) => x !== tr);
      addLog('tDelete', { box: tr.name });
    } else if (tr.status === 'sent') {
      for (const l of tr.lines) {
        const it = item(l.itemId); if (!it) continue;
        const e = ensureEntry(it, tr.from);
        e.qty += l.qty;
        addTagCounts(e, l.tags);
        normalize(e);
      }
      tr.status = 'cancelled'; tr.cancelledAt = new Date().toISOString().slice(0, 10);
      addLog('tCancel', { box: tr.name, from: place(tr.from)?.name });
    }
  });
  return true;
}
export function renameTransport(tid, name) { mutate(() => { transport(tid).name = name; }); }

/* ---------- Beispieldaten ---------- */
export const hasSamples = () => data.items.some((i) => i.sample) || data.transports.some((x) => x.sample);
export function clearSamples() {
  mutate(() => {
    const ids = new Set(data.items.filter((i) => i.sample).map((i) => i.id));
    data.transports = data.transports.filter((tr) => !tr.sample && !tr.lines.some((l) => ids.has(l.itemId)));
    data.items = data.items.filter((i) => !i.sample);
    data.retired = data.retired.filter((r) => !ids.has(r.itemId));
    data.log = data.log.filter((l) => !l.sample);
    data.settings.sampleCleared = true;
  });
}
export async function clearAll(lang) {
  data = seed(lang, true);
  photos = new Map();
  if (db) try { await wrap(tx('photos', 'readwrite').clear()); } catch (e) { console.error(e); }
  scheduleSave(); notify();
}

/* ---------- Export / Import ---------- */
export function exportJson() {
  return JSON.stringify({ app: 'StuffTracker', format: 1, exportedAt: new Date().toISOString(), data, photos: Object.fromEntries(photos) });
}
export async function importJson(text) {
  const o = JSON.parse(text);
  if (o.app !== 'StuffTracker' || !o.data?.places) throw new Error('format');
  data = migrate(o.data);
  photos = new Map(Object.entries(o.photos || {}));
  if (db) {
    try {
      await wrap(tx('photos', 'readwrite').clear());
      for (const [k, v] of photos) await wrap(tx('photos', 'readwrite').put(v, k));
    } catch (e) { console.error(e); }
  }
  scheduleSave(); notify();
}
export function exportCsv() {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [[t('csv.item'), t('csv.group'), t('csv.place'), t('csv.qty'), t('csv.tags'), t('csv.min')].map(q).join(';')];
  for (const it of sortedItems()) {
    for (const p of data.places) {
      const e = it.stock[p.id];
      if (!e || (e.qty === 0 && !e.min?.on)) continue;
      const tg = tagCounts(e.tags).map(([g, n]) => `${nm(g)}: ${n}`).join(', ');
      rows.push([nm(it), nm(group(it.groupId)), p.name, e.qty, tg, e.min?.on ? e.min.v : ''].map(q).join(';'));
    }
  }
  return '﻿' + rows.join('\r\n');
}

/* ---------- Seed ---------- */
const DAY = 86400000;
const isoDay = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

function seed(lang, empty = false) {
  const names = lang === 'en' ? ['Home', 'Office', 'Cabin'] : ['Wohnung', 'Büro', 'Hütte'];
  const pl = names.map((name) => ({ id: uid(), name }));
  const groups = ['outer', 'base', 'third', 'under', 'sport', 'shoes', 'supp', 'cables', 'bags', 'outdoor']
    .map((k) => ({ id: 'g_' + k, key: 'group.' + k }));
  const tg = [
    { id: 'tg_clean', key: 'tag.clean', style: 'clean' },
    { id: 'tg_dirty', key: 'tag.dirty', style: 'dirty' },
    { id: 'tg_lost', key: 'tag.lost', style: 'lost' },
  ];
  const d = {
    v: 2,
    settings: {
      lang: 'auto', theme: 'auto', placeMode: 'auto', manualPlace: null, lastPlace: null, lastGeo: null,
      homeButtons: 'dashboard', boxCounter: 0, sampleCleared: empty,
      widget: { on: true, size: 'large', kind: 'place', id: 'current' },
    },
    places: pl, groups, tags: tg, items: [], transports: [], retired: [], log: [],
  };
  if (empty) return d;

  const mk = (key, g, stock) => {
    const it = { id: uid(), key, groupId: 'g_' + g, sample: true, createdAt: Date.now(), stock: {} };
    for (const [pi, [qty, tags = {}, min]] of Object.entries(stock)) {
      it.stock[pl[pi].id] = { qty, tags, min: min ? { on: true, v: min } : { on: false, v: 1 } };
    }
    d.items.push(it);
    return it;
  };
  const C = 'tg_clean', D_ = 'tg_dirty', L = 'tg_lost';
  mk('sample.jeans', 'outer', { 0: [3, { [C]: 3 }], 1: [1, { [C]: 1 }] });
  const tshirt = mk('sample.tshirt', 'base', { 0: [12, { [C]: 9, [D_]: 3 }], 2: [4, { [D_]: 4 }] });
  mk('sample.longsleeve', 'base', { 0: [4, { [C]: 3, [D_]: 1 }], 2: [2, { [C]: 2 }] });
  mk('sample.fleece', 'third', { 2: [2, { [C]: 2 }] });
  mk('sample.shell', 'third', { 0: [1, { [C]: 1 }], 2: [2, { [D_]: 1, [L]: 1 }] });
  const socks = mk('sample.socks', 'under', { 0: [10, { [C]: 10 }], 1: [3, { [C]: 3 }], 2: [2, { [D_]: 2 }] });
  mk('sample.runshirt', 'sport', { 0: [6, { [C]: 6 }], 1: [2, { [D_]: 2 }] });
  mk('sample.boots', 'shoes', { 2: [1, { [D_]: 1 }], 0: [1, { [C]: 1 }] });
  mk('sample.magnesium', 'supp', { 0: [2, {}, 1] });
  const cable = mk('sample.cable', 'cables', { 0: [4], 1: [2, {}, 2] });
  mk('sample.backpack', 'bags', { 0: [1, [C]] });
  mk('sample.headlamp', 'outdoor', { 2: [1] });

  d.transports.push({
    id: uid(), name: `${lang === 'en' ? 'Box' : 'Kiste'} 1`, from: pl[0].id, to: pl[2].id, status: 'sent',
    createdAt: Date.now() - 4 * DAY, sentAt: isoDay(-3), sample: true,
    lines: [{ itemId: tshirt.id, qty: 3, tags: { [C]: 3 } }, { itemId: socks.id, qty: 4, tags: { [C]: 4 } }],
  });
  d.transports.push({
    id: uid(), name: `${lang === 'en' ? 'Box' : 'Kiste'} 2`, from: pl[1].id, to: pl[0].id, status: 'draft',
    createdAt: Date.now() - DAY, sample: true, lines: [{ itemId: cable.id, qty: 1, tags: {} }],
  });
  d.settings.boxCounter = 2;
  return d;
}
