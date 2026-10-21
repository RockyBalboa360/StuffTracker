// Startseite: Dashboard für den angezeigten Ort, Suche über alle Daten, Wetter, Tag-Übersicht, Schnellaktionen.
import { t, getLang } from '../i18n.js';
import * as store from '../store.js';
import { esc, icon, badge, tagChip, actions, openSheet, closeSheet, ui, arrow, placeLook } from '../ui.js';
import { transportCard, openTransportForm } from './transport.js';
import { rowAll, haystack } from './stock.js';
import { openItemForm } from './item.js';
import { openLocationSheet } from './settings.js';
import * as wx from '../weather.js';
import { sunTimes } from '../sun.js';

const loc = () => (getLang() === 'de' ? 'de-DE' : 'en-GB');

/* ---------- Widget-Karte ---------- */
function widgetHtml(pid) {
  const w = store.settings().widget;
  if (!w?.on) return '';
  let title; let rows = []; let badgeHtml = '';
  if (w.kind === 'group') {
    const g = store.group(w.id) || store.groups()[0];
    title = store.nm(g);
    rows = store.sortedItems().filter((it) => it.groupId === g?.id)
      .map((it) => ({ it, qty: store.totalQty(it) })).filter((r) => r.qty > 0);
  } else {
    const p = store.place(w.id === 'current' ? pid : w.id) || store.place(pid);
    title = p.name; badgeHtml = badge(p, 'sm');
    rows = store.sortedItems().map((it) => ({ it, qty: store.qtyAt(it, p.id) })).filter((r) => r.qty > 0);
  }
  const total = rows.reduce((a, r) => a + r.qty, 0);
  if (w.size === 'small') {
    return `<section class="widget widget--small"><div class="widget-t">${badgeHtml}<b>${esc(title)}</b></div>
      <div class="widget-n">${total}</div><div class="muted">${t('nLinesItems', { n: rows.length })}</div></section>`;
  }
  const top = rows.slice(0, 8);
  return `<section class="widget widget--large"><div class="widget-t">${badgeHtml}<b>${esc(title)}</b><span class="widget-total">${total}</span></div>
    <ul>${top.map((r) => `<li><span>${esc(store.nm(r.it))}</span><b>${r.qty}</b></li>`).join('') || `<li class="muted">${t('emptyPlace')}</li>`}</ul>
    ${rows.length > top.length ? `<div class="muted">+${rows.length - top.length} …</div>` : ''}</section>`;
}

/** Angezeigter Ort: vorübergehende Wahl auf der Startseite, sonst der Start-Ort aus den Einstellungen. */
const viewPlaceId = () => (store.place(ui.homePlace) ? ui.homePlace : store.currentPlaceId());

/* ---------- Wetter ---------- */
const inflight = new Set();
const failed = new Map(); // Ort -> Zeitpunkt des letzten Fehlversuchs
const fmtT = (n) => `${Math.round(n)}°`;
const fmtMm = (n) => `${(Math.round(n * 10) / 10).toLocaleString(loc())} mm`;
const hhmm = (ms) => new Date(ms).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });

function sunLine(p) {
  const s = sunTimes(new Date(), Number(p.lat), Number(p.lon));
  if (s.polar) return `<div class="wx-sun">${icon(s.polar === 'day' ? 'sunrise' : 'sunset', 30)} <i>${t(s.polar === 'day' ? 'polarDay' : 'polarNight')}</i></div>`;
  return `<div class="wx-sun"><span>${icon('sunrise', 32)}<span class="sx"><i>${t('sunrise')}</i><b>${hhmm(s.rise)}</b></span></span><span>${icon('sunset', 32)}<span class="sx"><i>${t('sunset')}</i><b>${hhmm(s.set)}</b></span></span></div>`;
}

function weatherCard(pid) {
  if (!store.settings().weatherOn) return '';
  const p = store.place(pid);
  if (!wx.hasCoords(p)) {
    return `<section class="wx wx--hint" id="weather-card"><div class="wx-hintrow">${wx.weatherIcon('partly-cloudy-day', 40)}
      <div><b>${t('wxTitle')}</b><span class="muted">${t('wxNoLoc', { place: esc(p.name) })}</span></div></div>
      <button class="btn btn--sm" type="button" data-act="wx-loc" data-id="${pid}">${icon('pin', 18)} ${t('wxSetLoc')}</button></section>`;
  }
  const w = wx.cached(pid);
  if (!wx.usable(w, p)) {
    const bad = failed.has(pid) && !inflight.has(pid);
    return `<section class="wx wx--empty" id="weather-card"><b>${t('wxTitle')} · ${esc(p.name)}</b>
      <p class="muted">${bad ? t('wxFail') : t('wxLoading')}</p>
      ${bad ? `<button class="btn btn--sm" type="button" data-act="wx-refresh" data-id="${pid}">${icon('refresh', 18)} ${t('wxRetry')}</button>` : ''}</section>`;
  }
  const old = wx.stale(w);
  const n = w.now;
  const rainLine = n.precip != null ? `<span>${t(n.precipKind === 'last' ? 'wxRainLast' : 'wxRainNext', { mm: fmtMm(n.precip) })}</span>` : '';
  const windLine = n.wind != null ? `<span>${t('wxWind', { v: Math.round(n.wind) })}</span>` : '';
  const tom = w.tomorrow;
  const h3 = (w.next3 || []).map((h) => `<div class="wx-h"><small>${new Date(h.t).toLocaleTimeString(loc(), { hour: '2-digit' })}</small>${wx.weatherIcon(h.icon, 30)}<b>${fmtT(h.temp)}</b><em>${fmtMm(h.precip || 0)}</em></div>`).join('');
  const station = w.station ? ` · ${esc(w.station.name)}${w.station.km != null ? `, ${w.station.km} km` : ''}` : '';
  return `<section class="wx ${old ? 'wx--old' : ''}" id="weather-card">
    <div class="wx-top"><span class="wx-asked">${old ? t('wxOld', { time: hhmm(w.fetchedAt) }) : t('wxAsked', { time: hhmm(w.fetchedAt) })}</span>
      <button class="wx-refresh" type="button" data-act="wx-refresh" data-id="${pid}" aria-label="${t('wxRefresh')}">${icon('refresh', 18)}</button></div>
    <div class="wx-now">${wx.weatherIcon(n.icon, 88)}
      <div class="wx-temp">${fmtT(n.temp)}<small>C</small></div>
      <div class="wx-desc"><b>${t('wx.' + n.icon)}</b>${rainLine}${windLine}</div></div>
    <div class="wx-grid">
      <div class="wx-box"><h4>${t('wxNext3')}</h4><div class="wx-h3">${h3 || '–'}</div></div>
      <div class="wx-box"><h4>${t('wxTomorrow')}</h4>${tom
    ? `<div class="wx-day">${wx.weatherIcon(tom.icon, 44)}<div><span class="wx-hi">${fmtT(tom.tmax)}</span> <span class="wx-lo">${fmtT(tom.tmin)}</span>
        <em>${fmtMm(tom.precip)}${tom.prob != null ? ` · ${Math.round(tom.prob)} %` : ''}</em></div></div>` : '–'}</div>
    </div>
    ${sunLine(p)}
    <div class="wx-meta">${t(w.source === 'met' ? 'wxModel' : 'wxMeasured', { time: hhmm(n.time) })} · ${esc(w.sourceName)}${station}</div>
  </section>`;
}

function paintWeather(pid) {
  const el = document.getElementById('weather-card');
  if (el && viewPlaceId() === pid && ui.tab === 'home') el.outerHTML = weatherCard(pid);
}

async function loadWeather(pid) {
  const p = store.place(pid);
  if (!p || inflight.has(pid)) return;
  inflight.add(pid);
  paintWeather(pid);
  try { await wx.refresh(p); failed.delete(pid); } catch { failed.set(pid, Date.now()); } finally { inflight.delete(pid); paintWeather(pid); }
}

/** Nach dem Zeichnen der Startseite: Wetter bei Bedarf nachladen (höchstens alle 15 Minuten). */
export function afterHome() {
  const pid = viewPlaceId();
  const p = store.place(pid);
  if (!store.settings().weatherOn || !wx.hasCoords(p)) return;
  const w = wx.cached(pid);
  if (wx.usable(w, p) && !wx.stale(w)) return;
  if (inflight.has(pid) || (failed.has(pid) && Date.now() - failed.get(pid) < 60000)) return;
  loadWeather(pid);
}
actions['wx-refresh'] = (el) => { failed.delete(el.dataset.id); loadWeather(el.dataset.id); };
actions['wx-loc'] = (el) => openLocationSheet(el.dataset.id);

/* ---------- Suche über alle Daten ---------- */
function homeResults(raw) {
  const tokens = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';
  const hit = (s) => tokens.every((w) => s.toLowerCase().includes(w));
  const items = store.sortedItems().filter((it) => hit(`${haystack(it)} ${store.places().filter((p) => store.qtyAt(it, p.id) > 0).map((p) => p.name).join(' ')}`));
  const places = store.places().filter((p) => hit(p.name));
  const groups = store.groups().filter((g) => hit(store.nm(g)));
  const tags = store.tags().filter((g) => hit(store.nm(g)));
  const trs = store.transports().filter((tr) => hit([tr.name, store.place(tr.from)?.name, store.place(tr.to)?.name, t('st.' + tr.status),
    ...tr.lines.map((l) => store.nm(store.item(l.itemId)))].join(' ')));
  const sec = (title, n, body) => (n ? `<h2 class="h2">${title} <span class="count">${n}</span></h2>${body}` : '');
  const html = [
    sec(t('articles'), items.length, `<div class="list">${items.map(rowAll).join('')}</div>`),
    sec(t('places'), places.length, `<div class="list">${places.map((p) => `<button class="row" type="button" data-act="hs-place" data-p="${p.id}">${badge(p, 'md')}
      <span class="row-main"><b>${esc(p.name)}</b></span><span class="row-qty"><b>${store.items().reduce((a, it) => a + store.qtyAt(it, p.id), 0)}</b></span></button>`).join('')}</div>`),
    sec(t('groups'), groups.length, `<div class="list">${groups.map((g) => `<button class="row" type="button" data-act="hs-query" data-q="${esc(store.nm(g))}">
      <span class="row-main"><b>${esc(store.nm(g))}</b></span><span class="row-qty"><b>${store.groupCount(g.id)}</b></span></button>`).join('')}</div>`),
    sec(t('tags'), tags.length, `<div class="list"><div class="tagrow">${tags.map((g) => tagChip(g, { act: 'hs-query', attrs: `data-q="${esc(store.nm(g))}"` })).join('')}</div></div>`),
    sec(t('boxes'), trs.length, `<div class="list">${trs.map(transportCard).join('')}</div>`),
  ].join('');
  return html || `<div class="empty">${icon('search', 36)}<p>${t('noResults')}</p></div>`;
}
const openStock = (place, query) => { ui.place = place; ui.search = query || ''; location.hash = '#/stock'; };
actions['hs-place'] = (el) => openStock(el.dataset.p, '');
actions['hs-query'] = (el) => openStock('all', el.dataset.q);
document.addEventListener('input', (e) => {
  if (e.target.id !== 'hq') return;
  ui.homeSearch = e.target.value;
  const res = document.getElementById('home-results');
  const dash = document.getElementById('home-dash');
  if (!res || !dash) return;
  const q = ui.homeSearch.trim();
  res.innerHTML = q ? homeResults(q) : '';
  res.hidden = !q;
  dash.hidden = !!q;
});

/* ---------- Karten ---------- */
const DAY = 86400000;
function backupNotice() {
  const s = store.settings();
  const since = s.lastBackup || s.created;
  if (!since) return '';
  const days = Math.floor((Date.now() - since) / DAY);
  if (days <= 9) return '';
  return `<section class="notice" role="status">${icon('alert', 22)}
    <div><b>${t('backupTitle')}</b><span class="muted">${s.lastBackup ? t('backupAge', { n: days }) : t('backupNever', { n: days })}</span></div>
    <button class="btn btn--sm btn--primary" type="button" data-act="backup-now">${icon('download', 18)} ${t('backupNow')}</button></section>`;
}
actions['backup-now'] = () => actions['exp-json']?.();

function tagOverview(pid, here) {
  const tot = {}; let none = 0;
  for (const it of here) {
    const e = it.stock[pid];
    for (const [k, n] of Object.entries(e.tags)) tot[k] = (tot[k] || 0) + n;
    none += store.untagged(e);
  }
  const chips = store.tagCounts(tot).map(([g, n]) => tagChip(g, { count: n, act: 'home-tag', attrs: `data-p="${pid}" data-q="${esc(store.nm(g))}"` })).join('');
  if (!chips && !none) return '';
  return `<section class="card card--flat"><h3>${t('tagOverview')}</h3>
    <div class="tagrow">${chips}${none ? `<span class="pill-none"><i></i>${t('noTag')}<em>${none}</em></span>` : ''}</div></section>`;
}
actions['home-tag'] = (el) => openStock(el.dataset.p, el.dataset.q);
actions['qa-item'] = (el) => openItemForm(null, el.dataset.p);
actions['qa-box'] = (el) => openTransportForm(el.dataset.p);

export function renderHome() {
  const pid = viewPlaceId();
  const p = store.place(pid);
  const toStock = store.settings().homeButtons === 'stock';
  const here = store.items().filter((it) => store.qtyAt(it, pid) > 0);
  const total = here.reduce((a, it) => a + store.qtyAt(it, pid), 0);
  const lows = store.lowStock(pid);
  const sent = store.transports().filter((x) => x.status === 'sent');
  const incoming = sent.filter((x) => x.to === pid);
  const outgoing = sent.filter((x) => x.from === pid);
  const drafts = store.transports().filter((x) => x.status === 'draft' && x.from === pid);
  const date = new Date().toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' });
  const lc = store.lastChange();
  const lcText = lc ? new Date(lc).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';
  const auto = store.settings().placeMode !== 'manual';
  const isDefault = pid === store.currentPlaceId();
  const q = (ui.homeSearch || '').trim();

  const net = store.places().map((pl) => {
    const n = store.items().reduce((a, it) => a + store.qtyAt(it, pl.id), 0);
    return `<button class="net ${pl.id === pid ? 'on' : ''}" type="button" data-act="home-place" data-p="${pl.id}">${badge(pl, 'md')}<span>${n}</span></button>`;
  }).join('');

  const section = (title, list) => (list.length ? `<h2 class="h2">${title}</h2><div class="list">${list.map(transportCard).join('')}</div>` : '');

  const groupsHere = new Set(here.map((it) => it.groupId)).size;
  const quiet = !incoming.length && !outgoing.length && !drafts.length && !lows.length;

  // Reihenfolge: Ort-Buttons, Suche, Kopf, Sicherungs-Hinweis, Kacheln, Warnungen, Kisten, Tags, Wetter, Widget.
  return `<nav class="netbar" aria-label="${t('places')}">${net}</nav>
    <label class="search search--page">${icon('search', 20)}<input id="hq" type="search" placeholder="${t('homeSearchPh')}" value="${esc(ui.homeSearch || '')}" autocomplete="off" enterkeyhint="search"></label>
    <header class="sign sign--hero">
      <div class="sign-kicker"><span>${esc(date)}</span><span class="lastchg">${t('lastChange')}: ${lcText}</span></div>
      ${toStock ? `<div class="chg-row"><button class="chg" type="button" data-act="place-switch">${isDefault && auto ? icon('gps', 16) : icon('pin', 16)} ${t('change')}</button></div>` : ''}
      <div class="hero-row"><h1 class="${p.name.length > 11 ? 'h1-long' : ''}">${esc(p.name)}</h1>${badge(p, 'xl')}</div>
    </header>
    <div id="home-results" ${q ? '' : 'hidden'}>${q ? homeResults(q) : ''}</div>
    <div id="home-dash" ${q ? 'hidden' : ''} style="--pc:${placeLook(p).color}">
      ${backupNotice()}
      <div class="stats">
        <div class="stat"><b>${total}</b><span>${t('piecesTotal')}</span></div>
        <button class="stat" type="button" data-act="home-stock" data-p="${pid}"><b>${here.length}</b><span>${t('articleKinds')}</span></button>
        <button class="stat" type="button" data-act="home-stock" data-p="${pid}"><b>${groupsHere}</b><span>${t('groups')}</span></button>
        <div class="stat ${lows.length ? 'bad' : ''}"><b>${lows.length}</b><span>${t('warnings')}</span></div>
      </div>
      <div class="quick">
        <button class="btn" type="button" data-act="qa-item" data-p="${pid}">${icon('plus')} ${t('itemNew')}</button>
        <button class="btn" type="button" data-act="qa-box" data-p="${pid}">${icon('box')} ${t('boxNewShort')}</button>
      </div>
      ${lows.length ? `<h2 class="h2 h2--warn">${icon('alert', 18)} ${t('lowStock')}</h2>
        <div class="list">${lows.map(({ item, entry }) => `<button class="row row--low" type="button" data-act="item-open" data-item="${item.id}">
          <span class="row-main"><b>${esc(store.nm(item))}</b><span class="muted">${store.minLabel(entry)}</span></span>
          <span class="row-qty low">${icon('alert', 16)}<b>${store.minCount(entry)}</b></span></button>`).join('')}</div>` : ''}
      ${section(`${t('incoming')} → ${esc(p.name)}`, incoming)}
      ${section(t('outgoing'), outgoing)}
      ${section(t('seg.draft'), drafts)}
      ${quiet ? `<div class="empty small">${arrow('big')}<p>${t('allQuiet')}</p></div>` : ''}
      ${tagOverview(pid, here)}
      ${weatherCard(pid)}
      ${widgetHtml(pid)}
    </div>`;
}

/** Kachel „Artikel“: direkt in die Bestandsliste des angezeigten Ortes. */
actions['home-stock'] = (el) => { ui.place = el.dataset.p; ui.search = ''; location.hash = '#/stock'; };

/** Ort-Buttons: je nach Einstellung Dashboard dieses Ortes oder dessen Bestandsliste. */
actions['home-place'] = (el) => {
  if (store.settings().homeButtons === 'stock') { ui.place = el.dataset.p; ui.search = ''; location.hash = '#/stock'; return; }
  ui.homePlace = el.dataset.p;
  window.dispatchEvent(new Event('st:render'));
};

/** Ort wechseln (nur sichtbar, wenn die Ort-Buttons zur Bestandsliste führen): Dashboard vorübergehend umschalten. */
actions['place-switch'] = () => {
  const def = store.currentPlaceId();
  const cur = viewPlaceId();
  const auto = store.settings().placeMode !== 'manual';
  openSheet({
    title: t('switchTitle'),
    cls: 'sheet--small',
    render: () => `<p class="hint">${t('switchHint')}</p>
      ${store.places().map((q) => `<button type="button" class="boxcard ${q.id === cur ? 'on' : ''}" data-act="sw-set" data-p="${q.id}">${badge(q, 'sm')} <b>${esc(q.name)}</b>
        ${q.id === def ? `<span class="muted">${auto ? icon('gps', 14) + ' ' + t('autoHint') : icon('pin', 14) + ' ' + t('fixedHint')}</span>` : ''}</button>`).join('')}`,
    actions: {
      'sw-set': (el) => { ui.homePlace = el.dataset.p === def ? null : el.dataset.p; closeSheet(); window.dispatchEvent(new Event('st:render')); },
    },
  });
};
