// Zentraler Zustand + Persistenz (IndexedDB). Fotos liegen in eigenem Store.
import { t, getLang } from './i18n.js';

export const VERSION = '0.13.0';
// tagsPerEntry gilt je Tag-Kategorie (höchstens so viele verschiedene Tags einer Kategorie je Artikel und Ort)
export const LIMITS = { places: 5, minPlaces: 2, tagsPerEntry: 6, tagsTotal: 80, tagCats: 12 };

/* ---------- Standard-Kategorien und -Tags ---------- */
const DEFAULT_CATS = ['clean', 'color', 'tech', 'charge'];
/** Tag-Kategorien je Standardgruppe: was für diese Art Artikel sinnvoll ist (im Artikel jederzeit änderbar). */
const GROUP_CATS = {
  g_base: ['cat_clean', 'cat_color'], g_second: ['cat_clean', 'cat_color'], g_third: ['cat_clean', 'cat_color'],
  g_sport: ['cat_clean', 'cat_color'], g_acc: ['cat_clean', 'cat_color'], g_bags: ['cat_clean', 'cat_color'],
  g_outdoor: ['cat_clean', 'cat_color'], g_it: ['cat_tech', 'cat_charge'], g_supp: [],
};
const groupDefaultCats = (g) => GROUP_CATS[g?.id] || g?.cats || ['cat_clean'];
/** [id, Schlüssel, Kategorie, Farbe] – Reihenfolge = Anzeigereihenfolge innerhalb der Kategorie. */
const DEFAULT_TAGS = [
  ['tg_clean', 'clean', 'cat_clean', null], ['tg_dirty', 'dirty', 'cat_clean', null],
  ['tg_filthy', 'filthy', 'cat_clean', '#7A4B25'], ['tg_worn', 'worn', 'cat_clean', '#B08A4A'],
  ['tg_damaged', 'damaged', 'cat_clean', null], ['tg_lost', 'lost', 'cat_clean', null],
  ['tg_c_black', 'c_black', 'cat_color', '#111111'], ['tg_c_grey', 'c_grey', 'cat_color', '#8E9196'],
  ['tg_c_blue', 'c_blue', 'cat_color', '#2457D6'], ['tg_c_green', 'c_green', 'cat_color', '#2E8B57'],
  ['tg_c_olive', 'c_olive', 'cat_color', '#6B6B2A'], ['tg_c_white', 'c_white', 'cat_color', '#FFFFFF'],
  ['tg_c_midgreen', 'c_midgreen', 'cat_color', '#004953'], ['tg_c_darkgrey', 'c_darkgrey', 'cat_color', '#4B4F54'],
  ['tg_c_navy', 'c_navy', 'cat_color', '#1B2A6B'], ['tg_c_jeans', 'c_jeans', 'cat_color', '#2F3E57'],
  ['tg_c_slate', 'c_slate', 'cat_color', '#2F4F4F'],
  ['tg_t_able', 't_able', 'cat_tech', '#6CBE45'], ['tg_t_partable', 't_partable', 'cat_tech', '#E0B400'], ['tg_t_unable', 't_unable', 'cat_tech', '#B3111D'],
  ['tg_t_ready', 't_ready', 'cat_tech', '#00933C'], ['tg_t_partready', 't_partready', 'cat_tech', '#FF8A00'], ['tg_t_unready', 't_unready', 'cat_tech', '#EE352E'],
  ['tg_ch_full', 'ch_full', 'cat_charge', '#00933C'], ['tg_ch_empty', 'ch_empty', 'cat_charge', '#B3111D'],
  ['tg_ch_gt50', 'ch_gt50', 'cat_charge', '#6CBE45'], ['tg_ch_lt50', 'ch_lt50', 'cat_charge', '#FF8A00'], ['tg_ch_unknown', 'ch_unknown', 'cat_charge', '#8E9196'],
];
const STYLE_OF = { tg_clean: 'clean', tg_dirty: 'dirty', tg_lost: 'lost', tg_damaged: 'damaged' };
const mkDefaultTag = ([id, k, cat, color]) => (STYLE_OF[id] ? { id, key: 'tag.' + k, style: STYLE_OF[id], cat } : { id, key: 'tag.' + k, style: 'plain', color, cat });
const mkDefaultCat = (k) => ({ id: 'cat_' + k, key: 'cat.' + k });

let data = null;
let migratedFrom = null;
/** true, wenn beim Start gespeicherte Daten auf ein neueres Modell gehoben wurden (also nach einem App-Update). */
export const wasMigrated = () => migratedFrom != null;
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
  if (d.v < 3) {
    // v3: Tag „beschädigt“, neue Standardgruppen, Ort „Hütte“ -> „Pendlerwohnung“
    if (!d.tags.some((g) => g.id === 'tg_damaged')) {
      const i = d.tags.findIndex((g) => g.id === 'tg_lost');
      d.tags.splice(i >= 0 ? i + 1 : d.tags.length, 0, { id: 'tg_damaged', key: 'tag.damaged', style: 'damaged' });
    }
    const addGroup = (after, key) => {
      if (d.groups.some((g) => g.id === `g_${key}`)) return;
      const i = d.groups.findIndex((g) => g.id === after);
      d.groups.splice(i >= 0 ? i + 1 : d.groups.length, 0, { id: `g_${key}`, key: `group.${key}` });
    };
    addGroup('g_base', 'second'); addGroup('g_supp', 'acc'); addGroup('g_acc', 'it');
    const remap = { g_outer: 'g_second', g_under: 'g_base', g_shoes: 'g_outdoor', g_cables: 'g_it' };
    d.items.forEach((it) => { if (it.sample && remap[it.groupId] && d.groups.some((g) => g.id === remap[it.groupId])) it.groupId = remap[it.groupId]; });
    Object.keys(remap).forEach((id) => {
      const g = d.groups.find((x) => x.id === id);
      if (g?.key && !d.items.some((it) => it.groupId === id)) d.groups = d.groups.filter((x) => x !== g);
    });
    d.places.forEach((p) => {
      if (p.name === 'Hütte') p.name = 'Pendlerwohnung';
      else if (p.name === 'Cabin') p.name = 'Commuter flat';
    });
    d.v = 3;
  }
  if (d.v < 4) {
    // v4: Gesamtmenge ist Master (Tag-Summe <= Menge), Tag-Verknüpfung sauber <-> schmutzig
    d.tagLinks ||= (d.tags.some((g) => g.id === 'tg_clean') && d.tags.some((g) => g.id === 'tg_dirty')) ? [['tg_clean', 'tg_dirty']] : [];
    d.items.forEach((it) => Object.values(it.stock).forEach((e) => normalize(e)));
    d.transports.forEach((tr) => tr.lines.forEach((l) => { l.tags ||= {}; trimTags(l.tags, l.qty); }));
    d.v = 4;
  }
  if (d.v < 5) {
    // v5: Wetter-Schalter, Sicherungs-Zeitpunkt
    d.settings.weatherOn ??= true;
    d.settings.created ||= Date.now();
    d.settings.lastBackup ??= null;
    d.v = 5;
  }
  if (d.v < 6) {
    // v6: nur eine Versionsmarke – löst die Meldung „Update abgeschlossen“ beim Wechsel von 0.6.x aus
    d.v = 6;
  }
  if (d.v < 7) {
    // v7: Tag-Kategorien (Sauberkeit, Farben, technischer Zustand, Ladezustand); je Artikel wählbar
    d.tagCats ||= DEFAULT_CATS.map(mkDefaultCat);
    const std = new Set(['tg_clean', 'tg_dirty', 'tg_lost', 'tg_damaged']);
    if (d.tags.some((g) => !std.has(g.id) && !g.cat)) d.tagCats.push({ id: 'cat_other', key: 'cat.other' });
    d.tags.forEach((g) => { g.cat ||= std.has(g.id) ? 'cat_clean' : 'cat_other'; });
    // fehlende Standard-Tags ergänzen und die Tags nach Kategorie ordnen (eigene Tags am Ende ihrer Kategorie)
    DEFAULT_TAGS.forEach((row) => { if (!d.tags.some((g) => g.id === row[0])) d.tags.push(mkDefaultTag(row)); });
    const defOrder = DEFAULT_TAGS.map((r) => r[0]);
    const catOrder = d.tagCats.map((c) => c.id);
    d.tags.sort((a, b) => (catOrder.indexOf(a.cat) - catOrder.indexOf(b.cat))
      || ((defOrder.includes(a.id) ? defOrder.indexOf(a.id) : 999) - (defOrder.includes(b.id) ? defOrder.indexOf(b.id) : 999)));
    d.groups.forEach((g) => { g.cats ||= groupDefaultCats(g); });
    d.items.forEach((it) => {
      if (it.cats) return;
      const used = new Set();
      Object.values(it.stock).forEach((e) => Object.keys(e.tags || {}).forEach((k) => { const c = d.tags.find((x) => x.id === k)?.cat; if (c) used.add(c); }));
      it.cats = d.tagCats.map((c) => c.id).filter((id) => id === 'cat_clean' || used.has(id));
    });
    d.items.forEach((it) => Object.values(it.stock).forEach((e) => normalize(e)));
    d.v = 7;
  }
  d.settings.homeButtons ||= 'dashboard';
  return d;
}

export async function load() {
  try {
    db = await openDb();
    data = await wrap(tx('kv').get('data'));
    if (data) { const before = data.v; migrate(data); if (before !== data.v) { migratedFrom = before; scheduleSave(); } }
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
/** touch=false: Einstellungen zählen nicht als „letzte Änderung“ der Daten. */
function mutate(fn, touch = true) {
  const r = fn();
  if (touch) data.changed = Date.now();
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

/** Tag, auf den sich der Mindestbestand bezieht (optionale „und“-Verknüpfung), sonst null. */
export const minTagId = (e) => (e?.min?.tag && data.tags.some((g) => g.id === e.min.tag) ? e.min.tag : null);
/** Stückzahl, die gegen den Mindestbestand zählt: nur Stücke mit dem Tag, sonst der Gesamtbestand am Ort. */
export const minCount = (e) => { const g = minTagId(e); return g ? (e.tags[g] || 0) : e.qty; };
/** Warnmodus: 'below' = Warnung beim Unterschreiten (weniger als n), 'reach' = schon beim Erreichen (n oder weniger). */
export const minMode = (e) => (e?.min?.mode === 'reach' ? 'reach' : 'below');
export function minLabel(e) {
  const g = minTagId(e);
  const k = minMode(e) === 'reach' ? 'minReach' : 'minShort';
  return g ? t(k + 'Tag', { n: e.min.v, tag: nm(tag(g)) }) : t(k, { n: e.min.v });
}
const lowEntry = (e) => !!(e && e.min?.on && (minMode(e) === 'reach' ? minCount(e) <= e.min.v : minCount(e) < e.min.v));

export function lowStock(pid) {
  const out = [];
  for (const it of data.items) {
    const e = it.stock[pid];
    if (lowEntry(e)) out.push({ item: it, entry: e });
  }
  return out;
}
export const isLow = (it, pid) => lowEntry(it.stock[pid]);

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
export function setSetting(k, v) { mutate(() => { data.settings[k] = v; }, false); }
export function setWidget(patch) { mutate(() => { Object.assign(data.settings.widget, patch); }, false); }
/** Zeitpunkt der letzten Datenänderung (Bestand, Tags, Kisten, Orte …). */
/** Zeitpunkt der Ankunftsbuchung einer Kiste (ältere Kisten: Ende des gebuchten Ankunftstages). */
export const arrivedTs = (tr) => tr.arrivedTs || (tr.arrivedAt ? Date.parse(`${tr.arrivedAt}T23:59:59`) : 0);
export const lastChange = () => data.changed || data.log[0]?.ts || Math.max(0, ...data.items.map((i) => i.createdAt || 0)) || null;
export const markBackup = () => setSetting('lastBackup', Date.now());

/* ---------- Protokoll ---------- */
function addLog(type, o = {}) {
  data.log.unshift({ id: uid(), ts: Date.now(), type, ...o });
  if (data.log.length > 500) data.log.length = 500;
}
/**
 * Tags tragen je Artikel+Ort eine Stückzahl: tags = { tagId: anzahl }. Die Gesamtmenge ist der Master:
 * Innerhalb einer Tag-Kategorie ist die Summe der Tag-Mengen höchstens qty (ein Stück trägt je Kategorie höchstens ein Tag).
 */
function normalize(e) {
  if (e.qty <= 0) { e.qty = 0; e.tags = {}; return; }
  for (const k of Object.keys(e.tags)) {
    if (!tag(k)) { delete e.tags[k]; continue; }
    if (e.tags[k] > e.qty) e.tags[k] = e.qty;
    if (!(e.tags[k] > 0)) delete e.tags[k];
  }
  trimTags(e.tags, e.qty);
}
function ensureEntry(it, pid) {
  return (it.stock[pid] ||= { qty: 0, tags: {}, min: { on: false, v: 1, tag: null } });
}
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
/** Kategorie eines Tags (Tags aus alten Datenständen ohne Kategorie bilden eine gemeinsame Gruppe '_'). */
const catKey = (tagId) => tag(tagId)?.cat || '_';
/** Summe der Tag-Mengen einer Kategorie (ohne cat: aller Tags). */
export function catSum(tags, cat) {
  let n = 0;
  for (const [k, v] of Object.entries(tags || {})) if (cat === undefined || catKey(k) === cat) n += v;
  return n;
}
const kindsInCat = (tags, cat) => Object.keys(tags).filter((k) => tags[k] > 0 && catKey(k) === cat).length;
function addTagCounts(e, incoming) {
  for (const [k, n] of Object.entries(incoming || {})) {
    if (!(n > 0) || !tag(k)) continue;
    if (!(k in e.tags) && kindsInCat(e.tags, catKey(k)) >= LIMITS.tagsPerEntry) continue;
    e.tags[k] = (e.tags[k] || 0) + n;
  }
}
/** Je Kategorie die Summe auf qty begrenzen: überzählige Stücke werden vom zuletzt gesetzten Tag der Kategorie abgezogen. */
function trimTags(tags, qty) {
  const cats = new Set(Object.keys(tags).map(catKey));
  for (const c of cats) {
    let s = catSum(tags, c);
    for (const k of Object.keys(tags).reverse()) {
      if (s <= qty) break;
      if (catKey(k) !== c) continue;
      const cut = Math.min(tags[k], s - qty);
      tags[k] -= cut; s -= cut;
      if (tags[k] <= 0) delete tags[k];
    }
  }
}
/** [[tag, anzahl], …] in der Reihenfolge der Tag-Liste. */
export function tagCounts(tags) {
  return data.tags.filter((g) => tags?.[g.id] > 0).map((g) => [g, tags[g.id]]);
}
/** Stücke ohne Tag in einer Kategorie (ohne cat: die größte Lücke über alle Tags, wie vor den Kategorien). */
export const untagged = (e, cat) => Math.max(0, e.qty - catSum(e.tags, cat));

/* ---------- Tag-Kategorien ---------- */
export const tagCats = () => data.tagCats;
export const tagCat = (id) => data.tagCats.find((c) => c.id === id);
export const tagsOfCat = (cat) => data.tags.filter((g) => g.cat === cat);
/** Kategorien, die ein Artikel verwendet (in der Reihenfolge der Kategorien). */
export const itemCats = (it) => data.tagCats.filter((c) => it?.cats?.includes(c.id));
/** Vorgabe-Kategorien für neue Artikel einer Gruppe. */
export const defaultCatsFor = (groupId) => groupDefaultCats(group(groupId));
/** Anzahl Stücke mit Tags aus dieser Kategorie über alle Orte (für die Rückfrage beim Entfernen). */
export function catUsage(itemId, cat) {
  const it = item(itemId);
  return Object.values(it?.stock || {}).reduce((a, e) => a + catSum(e.tags, cat), 0);
}
export function setItemCats(itemId, cats) {
  mutate(() => {
    const it = item(itemId); if (!it) return;
    const keep = data.tagCats.map((c) => c.id).filter((id) => cats.includes(id));
    const removed = (it.cats || []).filter((c) => !keep.includes(c));
    it.cats = keep;
    if (!removed.length) return;
    const rm = new Set(data.tags.filter((g) => removed.includes(g.cat)).map((g) => g.id));
    Object.values(it.stock).forEach((e) => {
      for (const k of Object.keys(e.tags)) if (rm.has(k)) delete e.tags[k];
      if (e.min?.tag && rm.has(e.min.tag)) e.min.tag = null;
    });
    data.transports.forEach((tr) => tr.lines.forEach((l) => {
      if (l.itemId === itemId) for (const k of Object.keys(l.tags || {})) if (rm.has(k)) delete l.tags[k];
    }));
  });
}
export function addTagCat(name) {
  if (data.tagCats.length >= LIMITS.tagCats) return null;
  return mutate(() => { const c = { id: uid(), name }; data.tagCats.push(c); return c; });
}
export function renameTagCat(id, name) { mutate(() => { const c = tagCat(id); delete c.key; c.name = name; }); }
/** Löscht die Kategorie samt ihrer Tags (überall entfernt). */
export function deleteTagCat(id) {
  mutate(() => {
    const ids = data.tags.filter((g) => g.cat === id).map((g) => g.id);
    ids.forEach((tid) => removeTagEverywhere(tid));
    data.tags = data.tags.filter((g) => g.cat !== id);
    data.tagCats = data.tagCats.filter((c) => c.id !== id);
    data.items.forEach((it) => { it.cats = (it.cats || []).filter((c) => c !== id); });
    data.groups.forEach((g) => { if (g.cats) g.cats = g.cats.filter((c) => c !== id); });
  });
}

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
  const free = freeTags(it, pid); const out = {}; const used = {};
  for (const g of data.tags) {
    const f = free[g.id]; const c = catKey(g.id);
    const left = qty - (used[c] || 0);
    if (f && left > 0) { const n = Math.min(f, left); out[g.id] = n; used[c] = (used[c] || 0) + n; }
  }
  return out;
}
/** Passt eine Zuordnung {tagId: anzahl} zu einer Menge? (je Kategorie höchstens qty Stück, nur bekannte Tags) */
export function allocFits(alloc, qty) {
  const cats = new Set(Object.keys(alloc).map(catKey));
  return [...cats].every((c) => catSum(alloc, c) <= qty);
}

/* ---------- Artikel ---------- */
export function addItem({ name, groupId, placeId, qty, photoData, tags, cats }) {
  return mutate(() => {
    const it = { id: uid(), name, groupId, stock: {}, createdAt: Date.now(), cats: cats ? data.tagCats.map((c) => c.id).filter((id) => cats.includes(id)) : [...defaultCatsFor(groupId)] };
    if (placeId && qty > 0) {
      const e = ensureEntry(it, placeId);
      e.qty = qty;
      // Tags mit Stückzahl gleich beim Anlegen (nur Kategorien des Artikels, je Kategorie höchstens tagsPerEntry und Summe <= Menge)
      const per = {};
      for (const [k, n] of Object.entries(tags || {})) {
        const g = tag(k);
        if (!(n > 0) || !g || !it.cats.includes(g.cat)) continue;
        per[g.cat] = (per[g.cat] || 0) + 1;
        if (per[g.cat] <= LIMITS.tagsPerEntry) e.tags[k] = n;
      }
      normalize(e);
    }
    data.items.push(it);
    if (photoData) { photos.set(it.id, photoData); savePhoto(it.id, photoData); }
    addLog('itemNew', { item: name, place: place(placeId)?.name, qty });
    return it;
  });
}
/** Bezeichnungen gelten als gleich, wenn sie sich nur in Groß-/Kleinschreibung oder Leerzeichen unterscheiden. */
export const nameKey = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
/** Artikel mit dieser Bezeichnung (ohne den Artikel exceptId), sonst undefined. */
export const findByName = (name, exceptId = null) => {
  const k = nameKey(name);
  return k ? data.items.find((i) => i.id !== exceptId && nameKey(nm(i)) === k) : undefined;
};
/** Bekannte Bezeichnungen, die zu den getippten Buchstaben passen (Wortanfang), kürzeste zuerst. */
export function suggestNames(q, limit = 5) {
  const k = nameKey(q);
  if (!k) return [];
  const seen = new Set();
  return data.items.map((i) => nm(i)).filter((n) => {
    const nk = nameKey(n);
    if (nk === k || seen.has(nk)) return false;
    if (!(nk.startsWith(k) || nk.split(' ').some((w) => w.startsWith(k)))) return false;
    seen.add(nk); return true;
  }).sort((a, b) => a.length - b.length).slice(0, limit);
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
/**
 * Zugang oder Abgang größerer Mengen buchen (Neukauf, Verbrauch …): ändert die Gesamtmenge.
 * qty = Stückzahl insgesamt, tags = { tagId: anzahl } (je Kategorie höchstens qty Stück).
 * Abgang nimmt nur Stücke, die nicht in Kisten vorgemerkt sind.
 * Liefert { qty, tags } (die gebuchte Menge) oder false, wenn die Buchung nicht möglich ist.
 */
export function bookStock(itemId, pid, { qty = 0, tags = {}, out = false }) {
  const it = item(itemId);
  if (!it || !place(pid)) return false;
  const tg = Object.fromEntries(Object.entries(tags).map(([k, n]) => [k, Math.floor(Number(n) || 0)]).filter(([k, n]) => n > 0 && tag(k)));
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (n <= 0 || !allocFits(tg, n)) return false;
  const e = it.stock[pid];
  if (out) {
    if (!e || n > available(it, pid)) return false;
    const free = freeTags(it, pid);
    if (Object.entries(tg).some(([k, c]) => c > (free[k] || 0))) return false;
  } else {
    const merged = { ...(e?.tags || {}) };
    for (const k of Object.keys(tg)) merged[k] = (merged[k] || 0) + tg[k];
    const cats = new Set(Object.keys(merged).map(catKey));
    if ([...cats].some((c) => kindsInCat(merged, c) > LIMITS.tagsPerEntry)) return false;
  }
  mutate(() => {
    const en = ensureEntry(it, pid);
    if (out) {
      for (const [k, c] of Object.entries(tg)) en.tags[k] -= c;
      en.qty -= n;
    } else {
      en.qty += n;
      addTagCounts(en, tg);
    }
    normalize(en);
    addLog(out ? 'stockOut' : 'stockIn', { item: nm(it), place: place(pid)?.name, qty: n });
  });
  return { qty: n, tags: tg };
}
/** Neuen Bestand in einen vorhandenen Artikel einbuchen (Zusammenführen); ein fehlendes Foto wird übernommen. */
export function mergeStock(itemId, pid, { qty = 0, tags = {}, photoData = null, cats = null }) {
  if (photoData && !photos.has(itemId)) setPhoto(itemId, photoData);
  if (!(qty > 0)) return { qty: 0, tags: {} };
  // Kategorien des neuen Eintrags kommen zu denen des vorhandenen Artikels dazu
  const it = item(itemId);
  if (cats?.length) mutate(() => { it.cats = data.tagCats.map((c) => c.id).filter((id) => it.cats?.includes(id) || cats.includes(id)); });
  const tg = Object.fromEntries(Object.entries(tags).filter(([k, n]) => n > 0 && it?.cats?.includes(tag(k)?.cat)));
  return bookStock(itemId, pid, { qty, tags: tg });
}
/** Verknüpfte Tags (logische Zusammenhänge, z. B. sauber <-> schmutzig). */
export const tagLinks = () => data.tagLinks || [];
/** Verknüpfte Tags gelten nur innerhalb derselben Kategorie. */
export function partnersOf(tagId) {
  return tagLinks().flatMap(([a, b]) => (a === tagId ? [b] : b === tagId ? [a] : []))
    .filter((id) => data.tags.some((g) => g.id === id) && catKey(id) === catKey(tagId));
}
/** Größte mögliche Menge für ein Tag: die Gesamtmenge (fehlende Stücke kommen von anderen Tags). */
export function tagMax(itemId, pid) {
  return item(itemId)?.stock[pid]?.qty || 0;
}
/**
 * Menge eines Tags setzen. Die Gesamtmenge bleibt unverändert:
 * Mehr -> zuerst von den verknüpften Tags, dann von den Stücken ohne Tag, zuletzt vom jeweils größten anderen Tag.
 * Weniger -> an das erste verknüpfte Tag, sonst zu den Stücken ohne Tag.
 * false = Tag-Limit je Artikel und Ort erreicht.
 */
export function setTagCount(itemId, pid, tagId, n) {
  const e = item(itemId)?.stock[pid];
  if (!e) return true;
  const cur = e.tags[tagId] || 0;
  n = Math.max(0, Math.min(tagMax(itemId, pid, tagId), Math.floor(Number(n) || 0)));
  const delta = n - cur;
  if (delta === 0) return true;
  const cat = catKey(tagId);
  const sameCat = (k) => catKey(k) === cat;
  const partners = partnersOf(tagId);
  const next = { ...e.tags };
  if (delta > 0) {
    let need = delta;
    for (const p of partners) {
      const take = Math.min(need, next[p] || 0);
      if (take > 0) { next[p] -= take; need -= take; if (next[p] <= 0) delete next[p]; }
    }
    need -= Math.min(need, untagged(e, cat));
    const others = Object.keys(next).filter((k) => k !== tagId && sameCat(k)).sort((a, b) => next[b] - next[a]);
    for (const k of others) {
      if (need <= 0) break;
      const take = Math.min(need, next[k]);
      next[k] -= take; need -= take;
      if (next[k] <= 0) delete next[k];
    }
  } else if (partners.length) {
    const p = partners[0];
    if (p in next || kindsInCat(next, cat) - (n === 0 ? 1 : 0) < LIMITS.tagsPerEntry) next[p] = (next[p] || 0) - delta;
  }
  if (n > 0) next[tagId] = n; else delete next[tagId];
  if (kindsInCat(next, cat) > LIMITS.tagsPerEntry) return false;
  mutate(() => { e.tags = next; normalize(e); });
  return true;
}
/** Startwert beim Hinzufügen eines Tags: 1 Stück von einem verknüpften Tag, sonst alle Stücke ohne Tag der Kategorie (mindestens 1). */
export function defaultTagCount(itemId, pid, tagId) {
  const e = item(itemId)?.stock[pid];
  if (!e) return 1;
  if (partnersOf(tagId).some((p) => e.tags[p] > 0)) return 1;
  return Math.max(1, untagged(e, catKey(tagId)));
}
export function addTagLink(a, b) {
  if (a === b || !tag(a) || !tag(b)) return false;
  if (tagLinks().some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return false;
  mutate(() => { (data.tagLinks ||= []).push([a, b]); });
  return true;
}
export function removeTagLink(i) { mutate(() => { data.tagLinks.splice(i, 1); }); }
/** Reihenfolge = Priorität: weiter oben stehende Verknüpfungen gelten zuerst. */
export function moveTagLink(i, d) {
  mutate(() => {
    const j = i + d;
    if (j < 0 || j >= data.tagLinks.length) return;
    [data.tagLinks[i], data.tagLinks[j]] = [data.tagLinks[j], data.tagLinks[i]];
  });
}
/** Stück und Tag-Mengen aller Kisten, die gerade unterwegs sind. */
export function transitInfo(itemId) {
  const out = { total: 0, tags: {} };
  for (const tr of data.transports) {
    if (tr.status !== 'sent') continue;
    for (const l of tr.lines) {
      if (l.itemId !== itemId) continue;
      out.total += l.qty;
      for (const [k, n] of Object.entries(l.tags || {})) out.tags[k] = (out.tags[k] || 0) + n;
    }
  }
  return out;
}export function retire(itemId, pid, qty, reason, note) {
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
export function setMin(itemId, pid, on, v, tagId = null, mode = 'below') {
  mutate(() => { const e = ensureEntry(item(itemId), pid); e.min = { on, v: Math.max(0, Math.floor(v) || 0), tag: tagId || null, mode: mode === 'reach' ? 'reach' : 'below' }; });
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
/** Tag-Kategorien, die neue Artikel dieser Gruppe vorab erhalten. */
export function setGroupCats(id, cats) {
  mutate(() => { const g = group(id); if (g) g.cats = data.tagCats.map((c) => c.id).filter((c) => cats.includes(c)); }, false);
}
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
/** Neues Tag in einer Kategorie (ohne Angabe: Sauberkeit bzw. die erste Kategorie). */
export function addTag(name, color, cat) {
  if (data.tags.length >= LIMITS.tagsTotal) return null;
  const c = tagCat(cat) ? cat : data.tagCats[0]?.id;
  // neue Tags stehen am Ende ihrer Kategorie
  return mutate(() => {
    const g = { id: uid(), name, style: 'plain', color, cat: c };
    let at = data.tags.length;
    for (let i = data.tags.length - 1; i >= 0; i--) if (data.tags[i].cat === c) { at = i + 1; break; }
    data.tags.splice(at, 0, g);
    return g;
  });
}
export function updateTag(id, patch) {
  mutate(() => { const g = tag(id); if ('name' in patch) delete g.key; Object.assign(g, patch); });
}
function removeTagEverywhere(id) {
  data.tagLinks = (data.tagLinks || []).filter((l) => !l.includes(id));
  data.items.forEach((it) => Object.values(it.stock).forEach((e) => {
    delete e.tags[id];
    if (e.min?.tag === id) e.min.tag = null;
  }));
  data.transports.forEach((tr) => tr.lines.forEach((l) => { if (l.tags) delete l.tags[id]; }));
}
export function deleteTag(id) {
  mutate(() => {
    data.tags = data.tags.filter((g) => g.id !== id);
    removeTagEverywhere(id);
  });
}

/* ---------- Transporte ---------- */
/** Bereits genutzte Kistennamen (zuletzt verwendete zuerst, dazu die Namen vorhandener Kisten). */
export function boxNames() {
  const seen = new Set(); const out = [];
  for (const n of [...(data.settings.boxNames || []), ...data.transports.map((x) => x.name)]) {
    const s = String(n || '').trim(); const k = s.toLowerCase();
    if (s && !seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out;
}
function rememberBoxName(name) {
  const list = (data.settings.boxNames ||= []).filter((x) => x.toLowerCase() !== name.toLowerCase());
  list.unshift(name);
  data.settings.boxNames = list.slice(0, 40);
}
/** Frühere Suchanfragen (Start und Bestand) für die Vorschläge beim Tippen. Ändert nur den Speicher, kein Neuzeichnen. */
export const searchHistory = () => data.settings.searchHistory || [];
export function addSearch(q) {
  q = String(q || '').trim();
  if (q.length < 2) return;
  const list = (data.settings.searchHistory || []).filter((x) => x.toLowerCase() !== q.toLowerCase());
  list.unshift(q);
  data.settings.searchHistory = list.slice(0, 30);
  scheduleSave();
}

export function createTransport({ from, to, name }) {
  return mutate(() => {
    if (name) rememberBoxName(name);
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
  if (!allocFits(alloc, qty) || Object.entries(alloc).some(([k, n]) => n > (free[k] || 0))) return false;
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
    tr.status = 'arrived'; tr.arrivedAt = dateISO; tr.arrivedTs = Date.now();
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
  data = o.data; // vor dem Migrieren setzen: normalize() liest die Tags aus dem aktuellen Stand
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
  const names = lang === 'en' ? ['Home', 'Office', 'Commuter flat'] : ['Wohnung', 'Büro', 'Pendlerwohnung'];
  const pl = names.map((name) => ({ id: uid(), name }));
  const groups = ['base', 'second', 'third', 'sport', 'supp', 'acc', 'it', 'bags', 'outdoor']
    .map((k) => ({ id: 'g_' + k, key: 'group.' + k, cats: GROUP_CATS['g_' + k] }));
  const tg = DEFAULT_TAGS.map(mkDefaultTag);
  const d = {
    v: 7,
    tagCats: DEFAULT_CATS.map(mkDefaultCat),
    tagLinks: [['tg_clean', 'tg_dirty']],
    settings: {
      lang: 'auto', theme: 'auto', placeMode: 'auto', manualPlace: null, lastPlace: null, lastGeo: null,
      homeButtons: 'dashboard', boxCounter: 0, sampleCleared: empty,
      weatherOn: true, created: Date.now(), lastBackup: null,
      widget: { on: true, size: 'large', kind: 'place', id: 'current' },
    },
    places: pl, groups, tags: tg, items: [], transports: [], retired: [], log: [],
  };
  if (empty) return d;

  const mk = (key, g, stock) => {
    // Beispiel-Artikel nutzen immer Sauberkeit (die Beispielzahlen verwenden diese Tags), plus die Vorgabe ihrer Gruppe
    const it = { id: uid(), key, groupId: 'g_' + g, sample: true, createdAt: Date.now(), stock: {}, cats: [...new Set(['cat_clean', ...GROUP_CATS['g_' + g]])].filter((c) => d.tagCats.some((x) => x.id === c)) };
    for (const [pi, [qty, tags = {}, min]] of Object.entries(stock)) {
      it.stock[pl[pi].id] = { qty, tags, min: min ? { on: true, v: min } : { on: false, v: 1 } };
    }
    d.items.push(it);
    return it;
  };
  const C = 'tg_clean', D_ = 'tg_dirty', L = 'tg_lost', X = 'tg_damaged';
  mk('sample.jeans', 'second', { 0: [3, { [C]: 3 }], 1: [1, { [C]: 1 }] });
  const tshirt = mk('sample.tshirt', 'base', { 0: [12, { [C]: 9, [D_]: 3 }], 2: [4, { [D_]: 4 }] });
  mk('sample.longsleeve', 'base', { 0: [4, { [C]: 3, [D_]: 1 }], 2: [2, { [C]: 2 }] });
  mk('sample.fleece', 'third', { 2: [2, { [C]: 2 }] });
  mk('sample.shell', 'third', { 0: [1, { [C]: 1 }], 2: [2, { [D_]: 1, [L]: 1 }] });
  const socks = mk('sample.socks', 'base', { 0: [10, { [C]: 10 }], 1: [3, { [C]: 3 }], 2: [2, { [D_]: 2 }] });
  mk('sample.runshirt', 'sport', { 0: [6, { [C]: 6 }], 1: [2, { [D_]: 2 }] });
  mk('sample.boots', 'outdoor', { 2: [1, { [D_]: 1 }], 0: [2, { [C]: 1, [X]: 1 }] });
  mk('sample.magnesium', 'supp', { 0: [2, {}, 1] });
  mk('sample.beanie', 'acc', { 0: [2, { [C]: 2 }], 2: [1, { [L]: 1 }] });
  const cable = mk('sample.cable', 'it', { 0: [4], 1: [2, {}, 2] });
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
