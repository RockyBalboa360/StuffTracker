// Startseite: Dashboard für den Ort, an dem sich das Gerät befindet.
import { t, getLang } from '../i18n.js';
import * as store from '../store.js';
import { esc, icon, badge, actions, openSheet, closeSheet, ui, arrow } from '../ui.js';
import { transportCard } from './transport.js';

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
  const date = new Date().toLocaleDateString(getLang() === 'de' ? 'de-DE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const auto = store.settings().placeMode !== 'manual';
  const isDefault = pid === store.currentPlaceId();

  const net = store.places().map((q) => {
    const n = store.items().reduce((a, it) => a + store.qtyAt(it, q.id), 0);
    return `<button class="net ${q.id === pid ? 'on' : ''}" type="button" data-act="home-place" data-p="${q.id}">${badge(q, 'md')}<span>${n}</span></button>`;
  }).join('');

  const section = (title, list, extra = '') => (list.length ? `<h2 class="h2">${title}</h2><div class="list">${list.map(transportCard).join('')}${extra}</div>` : '');

  return `<nav class="netbar" aria-label="${t('places')}">${net}</nav>
    <header class="sign sign--hero">
      <div class="sign-kicker"><span>${t('station')} · ${esc(date)}</span>
        ${toStock ? `<button class="chg" type="button" data-act="place-switch">${isDefault ? (auto ? icon('gps', 16) : icon('pin', 16)) : icon('pin', 16)} ${t('change')}</button>` : ''}</div>
      <div class="hero-row"><h1 class="${p.name.length > 11 ? 'h1-long' : ''}">${esc(p.name)}</h1>${badge(p, 'xl')}</div>
    </header>
    <div class="stats">
      <div class="stat"><b>${total}</b><span>${t('pieces')}</span></div>
      <button class="stat stat--link" type="button" data-act="home-stock" data-p="${pid}"><b>${here.length}</b><span>${t('articles')} ${icon('transport', 14)}</span></button>
      <div class="stat ${lows.length ? 'bad' : ''}"><b>${lows.length}</b><span>${t('warnings')}</span></div>
    </div>
    ${lows.length ? `<h2 class="h2 h2--warn">${icon('alert', 18)} ${t('lowStock')}</h2>
      <div class="list">${lows.map(({ item, entry }) => `<button class="row row--low" type="button" data-act="item-open" data-item="${item.id}">
        <span class="row-main"><b>${esc(store.nm(item))}</b><span class="muted">${store.minLabel(entry)}</span></span>
        <span class="row-qty low">${icon('alert', 16)}<b>${store.minCount(entry)}</b></span></button>`).join('')}</div>` : ''}
    ${section(`${t('incoming')} → ${esc(p.name)}`, incoming)}
    ${section(t('outgoing'), outgoing)}
    ${section(t('seg.draft'), drafts)}
    ${widgetHtml(pid)}
    ${!incoming.length && !outgoing.length && !drafts.length && !lows.length ? `<div class="empty small">${arrow('big')}<p>${t('allQuiet')}</p></div>` : ''}`;
}

/** Ort-Buttons: je nach Einstellung Dashboard dieses Ortes oder dessen Bestandsliste. */
/** Kachel 
  if (store.settings().homeButtons === 'stock') { ui.place = el.dataset.p; location.hash = '#/stock'; return; }
  ui.homePlace = el.dataset.p;
  window.dispatchEvent(new Event('st:render'));
};

/** „Ort wechseln“ (nur sichtbar, wenn die Ort-Buttons zur Bestandsliste führen): Dashboard vorübergehend umschalten. */
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
