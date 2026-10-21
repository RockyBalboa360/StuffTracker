// Mehr / Einstellungen: Sprache, Darstellung, Orte, Gruppen, Tags, Widget, Daten, Protokoll.
import { t } from '../i18n.js';
import * as store from '../store.js';
import {
  esc, icon, badge, badgeRaw, tagChip, actions, openSheet, closeSheet, toast, confirmDialog, promptDialog,
  PALETTE, SHAPES, placeLook, onLongPress, fmtTs, ui,
} from '../ui.js';
import { openTagForm } from './item.js';
import { geocode, parseCoords, stations } from '../weather.js';
import { groupAccent } from './stock.js';

const seg = (act, cur, opts) => `<div class="segmented">${opts.map(([v, label]) =>
  `<button type="button" class="${cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}">${label}</button>`).join('')}</div>`;

export function renderSettings() {
  const s = store.settings();
  const w = s.widget;
  const ps = store.places();
  const canAdd = ps.length < store.LIMITS.places;
  const autoColor = !s.groupColor || s.groupColor === 'auto';
  const srcChips = w.kind === 'group'
    ? store.groups().map((g) => `<button type="button" class="chip ${w.id === g.id ? 'on' : ''}" data-act="wd-src" data-id="${g.id}">${esc(store.nm(g))}</button>`).join('')
    : `<button type="button" class="chip ${w.id === 'current' ? 'on' : ''}" data-act="wd-src" data-id="current">${icon('gps', 16)} ${t('currentPlace')}</button>` +
      ps.map((p) => `<button type="button" class="chip chip--badge ${w.id === p.id ? 'on' : ''}" data-act="wd-src" data-id="${p.id}">${badge(p, 'xs')} ${esc(p.name)}</button>`).join('');
  return `<header class="sign"><h1>${t('tab.more')}</h1></header>
  <div class="settings">
    <section class="card"><h3>${t('language')}</h3>
      ${seg('set-lang', s.lang, [['auto', t('auto')], ['de', 'Deutsch'], ['en', 'English']])}</section>

    <section class="card"><h3>${t('appearance')}</h3>
      ${seg('set-theme', s.theme, [['auto', t('theme.auto')], ['system', t('theme.system')], ['dark', t('theme.dark')], ['light', t('theme.light')]])}
      <p class="hint">${t('theme.' + s.theme + 'Hint')}</p></section>

    <section class="card"><h3>${t('wxSettings')}</h3>
      <button type="button" class="switch ${s.weatherOn ? 'on' : ''}" data-act="wx-toggle" role="switch" aria-checked="${s.weatherOn}"><i></i><span>${t('wxShow')}</span></button>
      <p class="hint">${t('wxSettingsHint')}</p></section>

    <section class="card"><h3>${t('places')} <small>${ps.length}/${store.LIMITS.places}</small></h3>
      <p class="hint">${t('badgeHint')}</p>
      ${ps.map((p) => `<div class="srow"><span class="srow-badge">${badge(p, 'md')}</span>
        <button type="button" class="srow-main" data-act="place-edit" data-id="${p.id}"><b>${esc(p.name)}</b>
        <span class="muted">${p.lat != null ? icon('pin', 14) + ' ' + t('located') : t('notLocated')}</span></button>
        <button type="button" class="icon-btn" data-act="place-edit" data-id="${p.id}" aria-label="${t('edit')}">${icon('edit', 20)}</button></div>`).join('')}
      <button type="button" class="btn btn--block" data-act="place-add" ${canAdd ? '' : 'disabled'}>${icon('plus')} ${t('placeAdd')}</button>
      <div class="lbl">${t('detect')}</div>
      ${seg('set-pm', s.placeMode, [['auto', t('detect.auto')], ['manual', t('detect.manual')]])}
      ${s.placeMode === 'manual'
        ? `<div class="chips pad">${ps.map((p) => `<button type="button" class="chip chip--badge ${store.currentPlaceId() === p.id ? 'on' : ''}" data-act="set-fixed" data-id="${p.id}">${badge(p, 'xs')} ${esc(p.name)}</button>`).join('')}</div>` : ''}
      <p class="hint">${t(s.placeMode === 'manual' ? 'detectHintFixed' : 'detectHint')}</p>
      <div class="lbl">${t('homeButtons')}</div>
      ${seg('set-hb', s.homeButtons, [['dashboard', t('homeButtons.dashboard')], ['stock', t('homeButtons.stock')]])}
      <p class="hint">${t(s.homeButtons === 'stock' ? 'homeButtonsHintStock' : 'homeButtonsHintDash')}</p></section>

    <section class="card"><h3>${t('groups')}</h3>
      ${store.groups().map((g, i, a) => `<div class="srow">
        <button type="button" class="srow-main" data-act="grp-rename" data-id="${g.id}"><b>${esc(store.nm(g))}</b><span class="muted">${t('nArticles', { n: store.groupCount(g.id) })}</span></button>
        <button type="button" class="icon-btn" data-act="grp-up" data-id="${g.id}" ${i === 0 ? 'disabled' : ''} aria-label="up">${icon('up', 20)}</button>
        <button type="button" class="icon-btn" data-act="grp-down" data-id="${g.id}" ${i === a.length - 1 ? 'disabled' : ''} aria-label="down">${icon('down', 20)}</button>
        <button type="button" class="icon-btn icon-btn--danger" data-act="grp-del" data-id="${g.id}" aria-label="${t('delete')}">${icon('trash', 20)}</button></div>`).join('')}
      <button type="button" class="btn btn--block" data-act="grp-add">${icon('plus')} ${t('groupAdd')}</button></section>

    <section class="card"><h3>${t('tags')} <small>${store.tags().length}/${store.LIMITS.tagsTotal}</small></h3>
      <p class="hint">${t('tagsHint', { n: store.LIMITS.tagsPerEntry })}</p>
      <div class="tagrow">${store.tags().map((g) => `<span class="tagwrap">${tagChip(g, { act: 'tag-edit', attrs: `data-id="${g.id}"` })}</span>`).join('')}
      <button class="tag tag--add" type="button" data-act="tag-add" aria-label="${t('tagNew')}">${icon('plus', 16)}</button></div></section>

    <section class="card"><h3>${t('tagLinks')}</h3>
      <ol class="rules">
        <li>${t('tagLinksRule1')}</li>
        <li>${t('tagLinksRule2')}</li>
        <li>${t('tagLinksRule3')}</li>
      </ol>
      <p class="hint">${t('tagLinksExample')}</p>
      ${store.tagLinks().map(([a, b], i, all) => `<div class="srow srow--link">
        <span class="rank">${i + 1}</span>
        <span class="linkpair">${tagChip(store.tag(a), { small: true })}<b aria-hidden="true">⇄</b>${tagChip(store.tag(b), { small: true })}</span>
        <button type="button" class="icon-btn" data-act="link-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="up">${icon('up', 20)}</button>
        <button type="button" class="icon-btn" data-act="link-down" data-i="${i}" ${i === all.length - 1 ? 'disabled' : ''} aria-label="down">${icon('down', 20)}</button>
        <button type="button" class="icon-btn icon-btn--danger" data-act="link-del" data-i="${i}" aria-label="${t('delete')}">${icon('trash', 20)}</button></div>`).join('') || `<p class="hint">${t('tagLinksNone')}</p>`}
      <button type="button" class="btn btn--block" data-act="link-add">${icon('plus')} ${t('linkAdd')}</button></section>

    <section class="card"><h3>${t('groupColor')}</h3>
      <p class="hint">${t('groupColorHint')}</p>
      <div class="gpreview" style="--ga:${groupAccent()}"><span>${esc(t('group.base'))}</span></div>
      <div class="chips pad"><button type="button" class="chip ${autoColor ? 'on' : ''}" data-act="gc-auto">${icon('refresh', 16)} ${t('groupColorAuto')}</button></div>
      <div class="swatches">${Object.values(PALETTE).map((c) => `<button type="button" class="swatch ${!autoColor && c.toLowerCase() === groupAccent().toLowerCase() ? 'on' : ''}" style="--sw:${c}" data-act="gc-set" data-c="${c}" aria-label="${c}"></button>`).join('')}</div></section>

    <section class="card"><h3>${t('widget')}</h3>
      <p class="hint">${t('widgetHint')}</p>
      <button type="button" class="switch ${w.on ? 'on' : ''}" data-act="wd-on" role="switch" aria-checked="${w.on}"><i></i><span>${t('widgetShow')}</span></button>
      ${w.on ? `<div class="lbl">${t('widgetSize')}</div>${seg('wd-size', w.size, [['small', t('small')], ['large', t('large')]])}
      <div class="lbl">${t('widgetSource')}</div>${seg('wd-kind', w.kind, [['place', t('place')], ['group', t('group')]])}
      <div class="chips pad">${srcChips}</div>` : ''}</section>

    <section class="card"><h3>${t('data')}</h3>
      <div class="btn-grid">
        <button type="button" class="btn" data-act="exp-json">${icon('download')} ${t('exportJson')}</button>
        <button type="button" class="btn" data-act="exp-csv">${icon('download')} ${t('exportCsv')}</button>
        <button type="button" class="btn" data-act="imp-json">${icon('upload')} ${t('importJson')}</button>
        <button type="button" class="btn" data-act="open-log">${icon('stock')} ${t('log')}</button>
      </div>
      ${store.hasSamples() ? `<button type="button" class="btn btn--block" data-act="clear-samples">${icon('trash')} ${t('clearSamples')}</button>` : ''}
      <button type="button" class="btn btn--danger btn--block" data-act="reset-all">${icon('trash')} ${t('resetAll')}</button></section>

    <section class="card"><h3>${t('about')}</h3>
      <div class="srow"><div class="srow-main"><b>StuffTracker</b><span class="muted">${t('version')} ${store.VERSION}</span></div></div>
      <div class="btn-grid">
        <button type="button" class="btn" data-act="check-update">${icon('download')} ${t('checkUpdate')}</button>
        <button type="button" class="btn" data-act="install-app" id="install-btn" hidden>${icon('plus')} ${t('install')}</button>
      </div></section>
  </div>`;
}

/* ---------- Sprache / Darstellung / Erkennung ---------- */
actions['set-lang'] = (el) => store.setSetting('lang', el.dataset.v);
actions['set-theme'] = (el) => store.setSetting('theme', el.dataset.v);
actions['set-pm'] = (el) => {
  const fixedNeeded = el.dataset.v === 'manual' && !store.place(store.settings().manualPlace);
  if (fixedNeeded) store.setSetting('manualPlace', store.currentPlaceId());
  ui.homePlace = null;
  store.setSetting('placeMode', el.dataset.v);
  window.dispatchEvent(new Event('st:detect'));
};
actions['set-fixed'] = (el) => { ui.homePlace = null; store.setSetting('manualPlace', el.dataset.id); };
actions['set-hb'] = (el) => store.setSetting('homeButtons', el.dataset.v);

/* ---------- Orte ---------- */
actions['place-add'] = async () => {
  const name = await promptDialog({ title: t('placeAdd'), placeholder: t('placeNamePh'), maxlength: 24 });
  if (name) store.addPlace(name);
};
actions['place-edit'] = (el) => openPlaceForm(el.dataset.id);
function openPlaceForm(id) {
  const p = store.place(id);
  const h = openSheet({
    live: true,
    title: t('placeEdit'),
    render: () => {
      const q = store.place(id);
      return `<label class="lbl" for="pl-name">${t('name')}</label>
      <input id="pl-name" class="field" type="text" maxlength="24" value="${esc(q.name)}">
      <div class="lbl">${t('look')}</div>
      <div class="look">${badge(q, 'xl')}<p class="hint">${t('badgeHint')}</p></div>
      <div class="lbl">${t('location')}</div>
      <p class="hint">${q.lat != null ? `${icon('pin', 14)} ${q.geoLabel ? esc(q.geoLabel) + '<br>' : ''}${Number(q.lat).toFixed(4)}, ${Number(q.lon).toFixed(4)}${q.station ? `<br>${t('locStation')}: ${esc(q.station.name)}` : ''}` : t('notLocated')}</p>
      <button type="button" class="btn btn--block" data-act="pl-loc">${icon('pin')} ${t('locSheetBtn')}</button>
      <button class="linkbtn linkbtn--danger" type="button" data-act="pl-del">${icon('trash', 16)} ${t('placeDelete')}</button>`;
    },
    footer: () => `<button class="btn btn--primary btn--block" type="button" data-act="pl-save">${icon('check')} ${t('save')}</button>`,
    actions: {
      'pl-save': () => {
        const name = h.el.querySelector('#pl-name').value.trim();
        if (!name) { toast(t('nameReq'), 'warn'); return; }
        store.updatePlace(id, { name }); closeSheet();
      },
      'pl-loc': () => openLocationSheet(id),
      'pl-del': async () => {
        const why = store.placeBlocker(id);
        if (why) { toast(t('placeBlock.' + why), 'warn'); return; }
        if (await confirmDialog({ title: t('placeDelete'), text: t('placeDeleteText', { name: p.name }), ok: t('delete'), danger: true })) {
          closeSheet();
          setTimeout(() => store.deletePlace(id), 50);
        }
      },
    },
  });
  // Eingegebenen Namen bei Neuzeichnen (z. B. nach Badge-Änderung) behalten
  const orig = h.redraw;
  h.redraw = () => {
    const v = h.el.querySelector('#pl-name')?.value;
    if (!store.place(id)) return;
    orig();
    if (v != null) h.el.querySelector('#pl-name').value = v;
  };
}

/* ---------- Standort & Wetter eines Ortes ---------- */
/**
 * Standort per Adresse/Ort/Koordinaten oder GPS festlegen; dazu eine Wetterstation aus der Umgebung wählen.
 * Der Standort dient der Ortserkennung, dem Sonnenstand und dem Wetter.
 */
export function openLocationSheet(placeId) {
  const p0 = store.place(placeId);
  if (!p0) return;
  const st = { lat: p0.lat ?? null, lon: p0.lon ?? null, label: p0.geoLabel || '', station: p0.station || null, stations: null, stationsErr: false, results: [] };
  const coordsOk = () => st.lat != null && st.lon != null && Number.isFinite(st.lat) && Number.isFinite(st.lon);
  const num = (v) => (v == null ? '' : String(Math.round(Number(v) * 10000) / 10000));
  const $ = (sel) => h.el.querySelector(sel);

  function paintCoords() { $('#loc-lat').value = num(st.lat); $('#loc-lon').value = num(st.lon); $('#loc-label').textContent = st.label; }
  function paintResults() {
    $('#loc-results').innerHTML = st.results.map((r, i) => `<button type="button" class="boxcard" data-act="loc-pick" data-i="${i}">${icon('pin', 18)} <span class="loc-name">${esc(r.label)}</span></button>`).join('');
  }
  function paintStations() {
    const sel = $('#loc-station');
    const opts = [`<option value="">${esc(t('locStationAuto'))}</option>`];
    const list = [...(st.stations || [])];
    if (st.station && !list.some((s) => s.id === st.station.id)) list.unshift({ id: st.station.id, name: st.station.name, km: null });
    for (const s of list) opts.push(`<option value="${esc(s.id)}" data-name="${esc(s.name)}" ${st.station?.id === s.id ? 'selected' : ''}>${esc(s.name)}${s.km != null ? ` (${s.km} km)` : ''}</option>`);
    if (coordsOk() && st.stations === null && !st.stationsErr) opts.push(`<option disabled>${esc(t('locStationLoading'))}</option>`);
    if (st.stationsErr) opts.push(`<option disabled>${esc(t('locStationErr'))}</option>`);
    sel.innerHTML = opts.join('');
    sel.disabled = !coordsOk();
  }
  async function loadStations() {
    if (!coordsOk()) { st.stations = null; paintStations(); return; }
    st.stations = null; st.stationsErr = false; paintStations();
    const key = `${st.lat},${st.lon}`;
    try {
      const list = await stations(st.lat, st.lon);
      if (key !== `${st.lat},${st.lon}`) return;
      st.stations = list;
    } catch { st.stationsErr = true; }
    paintStations();
  }
  function setCoords(lat, lon, label) {
    st.lat = lat; st.lon = lon; st.label = label || ''; st.station = null; st.stations = null; st.results = [];
    paintCoords(); paintResults(); loadStations();
  }

  const h = openSheet({
    title: t('locTitle'),
    render: () => `
      <p class="hint">${t('locHint')}</p>
      <label class="lbl" for="loc-q">${t('locSearch')}</label>
      <div class="inline"><input id="loc-q" class="field" type="search" placeholder="${t('locSearchPh')}" autocomplete="off" enterkeyhint="search">
        <button class="btn" type="button" data-act="loc-search" aria-label="${t('locSearch')}">${icon('search')}</button></div>
      <div id="loc-results" class="boxlist"></div>
      <div class="lbl">${t('locCoords')}</div>
      <div class="coords">
        <label>${t('locLat')}<input id="loc-lat" class="field" inputmode="decimal" autocomplete="off"></label>
        <label>${t('locLon')}<input id="loc-lon" class="field" inputmode="decimal" autocomplete="off"></label></div>
      <div id="loc-label" class="hint"></div>
      <div class="btn-grid"><button class="btn" type="button" data-act="loc-gps">${icon('gps')} ${t('locGps')}</button>
        <button class="btn btn--ghost" type="button" data-act="loc-clear">${icon('close')} ${t('removeLocation')}</button></div>
      <div class="lbl">${t('locStation')}</div>
      <select id="loc-station" class="field"></select>
      <p class="hint">${t('locStationHint')}</p>`,
    footer: () => `<button class="btn btn--primary btn--block" type="button" data-act="loc-save">${icon('check')} ${t('save')}</button>`,
    mount: () => {},
    actions: {
      'loc-search': async () => {
        const q = $('#loc-q').value.trim();
        if (!q) return;
        const c = parseCoords(q);
        if (c) { setCoords(c.lat, c.lon, ''); return; }
        $('#loc-results').innerHTML = `<p class="hint">${t('locSearching')}</p>`;
        try {
          st.results = await geocode(q);
          paintResults();
          if (!st.results.length) $('#loc-results').innerHTML = `<p class="hint">${t('noResults')}</p>`;
        } catch { $('#loc-results').innerHTML = `<p class="hint">${t('locSearchFail')}</p>`; }
      },
      'loc-pick': (el) => { const r = st.results[Number(el.dataset.i)]; if (r) setCoords(r.lat, r.lon, r.label); },
      'loc-gps': () => {
        if (!navigator.geolocation) { toast(t('geoFail'), 'warn'); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => setCoords(pos.coords.latitude, pos.coords.longitude, t('locGpsLabel')),
          () => toast(t('geoFail'), 'warn'), { enableHighAccuracy: true, timeout: 15000 });
      },
      'loc-clear': () => setCoords(null, null, ''),
      'loc-save': () => {
        const lat = $('#loc-lat').value.trim() === '' ? null : Number($('#loc-lat').value.replace(',', '.'));
        const lon = $('#loc-lon').value.trim() === '' ? null : Number($('#loc-lon').value.replace(',', '.'));
        if ((lat == null) !== (lon == null) || (lat != null && (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180))) {
          toast(t('locBadCoords'), 'warn'); return;
        }
        store.updatePlace(placeId, lat == null
          ? { lat: null, lon: null, geoLabel: '', station: null }
          : { lat, lon, geoLabel: st.label, station: st.station });
        toast(t('locationSaved'));
        window.dispatchEvent(new Event('st:detect'));
        closeSheet();
      },
    },
  });
  paintCoords(); paintResults(); paintStations();
  h.el.addEventListener('change', (e) => {
    if (e.target.id === 'loc-lat' || e.target.id === 'loc-lon') {
      const lat = Number($('#loc-lat').value.replace(',', '.')); const lon = Number($('#loc-lon').value.replace(',', '.'));
      const ok = $('#loc-lat').value.trim() !== '' && $('#loc-lon').value.trim() !== '' && Number.isFinite(lat) && Number.isFinite(lon);
      st.label = ''; $('#loc-label').textContent = '';
      if (ok) { st.lat = lat; st.lon = lon; st.station = null; loadStations(); }
    }
    if (e.target.id === 'loc-station') {
      const o = e.target.selectedOptions[0];
      st.station = e.target.value ? { id: e.target.value, name: o.dataset.name || o.textContent } : null;
    }
  });
  h.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'loc-q') { e.preventDefault(); h.opts.actions['loc-search'](); } });
  if (coordsOk()) loadStations();
  return h;
}
actions['place-loc'] = (el) => openLocationSheet(el.dataset.id);

/* ---------- Badge-Editor (langes Drücken) ---------- */
export function openBadgeEditor(placeId) {
  const p = store.place(placeId);
  if (!p) return;
  const look = placeLook(p);
  const st = { ch: look.ch, color: look.color, shape: look.shape };
  const h = openSheet({
    title: t('look'),
    cls: 'sheet--small',
    render: () => `<div class="look look--center">${badgeRaw(st.ch, st.color, st.shape, 'xxl')}</div>
      <div class="lbl">${t('symbol')}</div>
      <input id="bd-ch" class="field field--ch" type="text" maxlength="2" value="${esc(st.ch)}" autocapitalize="characters">
      <div class="lbl">${t('color')}</div>
      <div class="swatches">${Object.values(PALETTE).map((c) => `<button type="button" class="swatch ${c.toLowerCase() === st.color.toLowerCase() ? 'on' : ''}" style="--sw:${c}" data-act="bd-color" data-c="${c}" aria-label="${c}"></button>`).join('')}</div>
      <div class="lbl">${t('shape')}</div>
      <div class="chips">${SHAPES.map((s) => `<button type="button" class="chip chip--badge ${st.shape === s ? 'on' : ''}" data-act="bd-shape" data-s="${s}">${badgeRaw(st.ch, st.color, s, 'xs')} ${t('shape.' + s)}</button>`).join('')}</div>`,
    footer: () => `<button class="btn btn--ghost" type="button" data-act="bd-reset">${t('reset')}</button>
      <button class="btn btn--primary btn--grow" type="button" data-act="bd-ok">${icon('check')} ${t('save')}</button>`,
    actions: {
      'bd-color': (el) => { grab(); st.color = el.dataset.c; h.redraw(); },
      'bd-shape': (el) => { grab(); st.shape = el.dataset.s; h.redraw(); },
      'bd-reset': () => { store.updatePlace(placeId, { ch: undefined, color: undefined, shape: undefined }); closeSheet(); },
      'bd-ok': () => { grab(); store.updatePlace(placeId, { ch: st.ch, color: st.color, shape: st.shape }); closeSheet(); },
    },
  });
  function grab() { const v = h.el.querySelector('#bd-ch')?.value.trim().toUpperCase(); if (v) st.ch = v; }
}
onLongPress('[data-badge]', (el) => openBadgeEditor(el.dataset.badge));

/* ---------- Gruppen ---------- */
actions['grp-add'] = async () => { const n = await promptDialog({ title: t('groupAdd'), placeholder: t('groupPh') }); if (n) store.addGroup(n); };
actions['grp-rename'] = async (el) => {
  const g = store.group(el.dataset.id);
  const n = await promptDialog({ title: t('edit'), value: store.nm(g) });
  if (n) store.renameGroup(g.id, n);
};
actions['grp-up'] = (el) => store.moveGroup(el.dataset.id, -1);
actions['grp-down'] = (el) => store.moveGroup(el.dataset.id, 1);
actions['grp-del'] = async (el) => {
  const g = store.group(el.dataset.id);
  if (store.groupCount(g.id)) { toast(t('groupNotEmpty'), 'warn'); return; }
  if (await confirmDialog({ title: t('groupDelete'), text: store.nm(g), ok: t('delete'), danger: true })) store.deleteGroup(g.id);
};

/* ---------- Tags ---------- */
actions['tag-add'] = () => openTagForm(null);
actions['tag-edit'] = (el) => {
  const g = store.tag(el.dataset.id);
  const h = openSheet({
    title: store.nm(g),
    cls: 'sheet--small',
    render: () => `<div class="pad">${tagChip(store.tag(g.id))}</div>
      <div class="btn-stack"><button class="btn" type="button" data-act="te-edit">${icon('edit')} ${t('edit')}</button>
      <button class="btn btn--danger" type="button" data-act="te-del">${icon('trash')} ${t('delete')}</button></div>`,
    actions: {
      'te-edit': () => { closeSheet(); setTimeout(() => openTagForm(g.id), 260); },
      'te-del': async () => {
        if (await confirmDialog({ title: t('tagDelete'), text: t('tagDeleteText'), ok: t('delete'), danger: true })) { store.deleteTag(g.id); closeSheet(); }
      },
    },
  });
  return h;
};

/* ---------- Tag-Verknüpfungen ---------- */
actions['link-del'] = (el) => store.removeTagLink(Number(el.dataset.i));
actions['link-up'] = (el) => store.moveTagLink(Number(el.dataset.i), -1);
actions['link-down'] = (el) => store.moveTagLink(Number(el.dataset.i), 1);
actions['link-add'] = () => {
  const st = { a: null, b: null };
  const pick = (which) => `<div class="tagrow">${store.tags().map((g) => tagChip(g, { on: st[which] === g.id, act: 'lk-' + which, attrs: `data-id="${g.id}"` })).join('')}</div>`;
  const h = openSheet({
    title: t('linkAdd'),
    render: () => `<p class="hint">${t('tagLinksHint')}</p>
      <div class="lbl">${t('linkFirst')}</div>${pick('a')}
      <div class="lbl">${t('linkSecond')}</div>${pick('b')}`,
    footer: () => `<button class="btn btn--primary btn--block" type="button" data-act="lk-ok">${icon('check')} ${t('save')}</button>`,
    actions: {
      'lk-a': (el) => { st.a = el.dataset.id; h.redraw(); },
      'lk-b': (el) => { st.b = el.dataset.id; h.redraw(); },
      'lk-ok': () => {
        if (!st.a || !st.b || st.a === st.b) { toast(t('linkNeedTwo'), 'warn'); return; }
        if (!store.addTagLink(st.a, st.b)) { toast(t('linkExists'), 'warn'); return; }
        closeSheet();
      },
    },
  });
};

/* ---------- Gruppenfarbe ---------- */
actions['gc-auto'] = () => store.setSetting('groupColor', 'auto');
actions['gc-set'] = (el) => store.setSetting('groupColor', el.dataset.c);

/* ---------- Widget ---------- */
actions['wd-on'] = () => store.setWidget({ on: !store.settings().widget.on });
actions['wd-size'] = (el) => store.setWidget({ size: el.dataset.v });
actions['wd-kind'] = (el) => store.setWidget({ kind: el.dataset.v, id: el.dataset.v === 'group' ? store.groups()[0].id : 'current' });
actions['wd-src'] = (el) => store.setWidget({ id: el.dataset.id });

/* ---------- Daten ---------- */
function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const stamp = () => new Date().toISOString().slice(0, 10);
actions['exp-json'] = () => { download(`stufftracker-${stamp()}.json`, store.exportJson(), 'application/json'); store.markBackup(); toast(t('exported')); };
actions['wx-toggle'] = () => store.setSetting('weatherOn', !store.settings().weatherOn);
actions['exp-csv'] = () => { download(`stufftracker-${stamp()}.csv`, store.exportCsv(), 'text/csv;charset=utf-8'); toast(t('exported')); };
actions['imp-json'] = () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/json,.json';
  input.onchange = async () => {
    const f = input.files?.[0]; if (!f) return;
    if (!(await confirmDialog({ title: t('importJson'), text: t('importWarn'), ok: t('importDo'), danger: true }))) return;
    try { await store.importJson(await f.text()); toast(t('imported')); } catch { toast(t('importFail'), 'warn'); }
  };
  input.click();
};
actions['clear-samples'] = async () => {
  if (await confirmDialog({ title: t('clearSamples'), text: t('clearSamplesText'), ok: t('delete'), danger: true })) { store.clearSamples(); toast(t('samplesCleared')); }
};
actions['reset-all'] = async () => {
  if (!(await confirmDialog({ title: t('resetAll'), text: t('resetAllText'), ok: t('delete'), danger: true }))) return;
  if (!(await confirmDialog({ title: t('sure'), text: t('resetAllText2'), ok: t('resetNow'), danger: true }))) return;
  const { getLang } = await import('../i18n.js');
  await store.clearAll(getLang());
  toast(t('resetDone'));
};

/* ---------- Protokoll ---------- */
actions['open-log'] = () => {
  openSheet({
    title: t('log'),
    render: () => {
      const l = store.log();
      if (!l.length) return `<div class="empty small"><p>${t('logEmpty')}</p></div>`;
      return `<ul class="log">${l.map((e) => `<li><time>${fmtTs(e.ts)}</time><span>${esc(logText(e))}</span></li>`).join('')}</ul>`;
    },
  });
};
function logText(e) {
  const p = { ...e };
  if (e.sample) p.sample = '';
  if (e.reason) p.reason = t('reason.' + e.reason);
  if (e.item && e.sample) p.item = t(e.item);
  return t('log.' + e.type, p);
}
