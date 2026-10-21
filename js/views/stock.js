// Bestand: Gruppen -> Artikel, Ortsfilter, Suche.
import { t } from '../i18n.js';
import * as store from '../store.js';
import { esc, icon, badge, tagDot, untaggedDot, thumb, actions, ui } from '../ui.js';

const selPlace = () => ui.place || store.currentPlaceId();

function haystack(it) {
  const parts = [store.nm(it), store.nm(store.group(it.groupId))];
  for (const [pid, e] of Object.entries(it.stock)) {
    Object.keys(e.tags).forEach((g) => parts.push(store.nm(store.tag(g))));
    if (e.qty > 0) parts.push(store.place(pid)?.name || '');
  }
  return parts.join(' ').toLowerCase();
}

/** Je Ort: Symbol, Gesamtzahl und kleine Kreise nur für die dort aktiven Tags. */
/** Kreise für ein Stück-Bündel: zuerst die Stücke ohne Tag (transparent), dann je aktives Tag. */
function dotsFor(tags, total) {
  const tagged = Object.values(tags).reduce((a, b) => a + b, 0);
  const free = Math.max(0, total - tagged);
  return (free > 0 ? untaggedDot(free) : '') + store.tagCounts(tags).map(([g, n]) => tagDot(g, n)).join('');
}

function placeStock(it, p) {
  const e = it.stock[p.id];
  const dots = dotsFor(e.tags, e.qty);
  return `<span class="pq">${badge(p, 'ml')}<i class="pq-n">${e.qty}</i>${dots}</span>`;
}

function row(it, pid, all) {
  let qty; let low = false; let places;
  const transit = store.transitInfo(it.id);
  if (all) {
    qty = store.totalQty(it) + transit.total;
    low = store.places().some((p) => store.isLow(it, p.id));
    places = store.places().filter((p) => store.qtyAt(it, p.id) > 0).map((p) => placeStock(it, p)).join('');
  } else {
    const e = it.stock[pid];
    qty = e?.qty || 0; low = store.isLow(it, pid);
    places = e && e.qty > 0 ? placeStock(it, store.place(pid)) : '';
  }
  const transitHtml = all && transit.total > 0
    ? `<span class="pq pq--transit" title="${t('tab.transport')}"><span class="tbadge">${icon('transport', 18)}</span><i class="pq-n">${transit.total}</i>${dotsFor(transit.tags, transit.total)}</span>` : '';
  const bottom = places + transitHtml;
  return `<button class="row" type="button" data-act="item-open" data-item="${it.id}">
    ${thumb(it, 'md')}
    <span class="row-main"><b>${esc(store.nm(it))}</b>
      ${bottom ? `<span class="row-places">${bottom}</span>` : ''}</span>
    <span class="row-qty ${low ? 'low' : ''}">${low ? icon('alert', 16) : ''}<b>${qty}</b></span>
  </button>`;
}
function listHtml() {
  const q = ui.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const sp = selPlace();
  const all = sp === 'all' || q.length > 0;
  const list = store.sortedItems().filter((it) => {
    if (q.length) { const h = haystack(it); return q.every((w) => h.includes(w)); }
    if (sp === 'all') return true;
    const e = it.stock[sp];
    return !!e && (e.qty > 0 || e.min?.on);
  });
  if (!list.length) {
    return `<div class="empty">${icon('search', 36)}<p>${q.length ? t('noResults') : t('emptyPlace')}</p></div>`;
  }
  const byGroup = new Map(store.groups().map((g) => [g.id, []]));
  list.forEach((it) => (byGroup.get(it.groupId) || byGroup.set(it.groupId, []).get(it.groupId)).push(it));
  let html = '';
  for (const [gid, arr] of byGroup) {
    if (!arr.length) continue;
    const g = store.group(gid);
    const closed = ui.collapsed[gid] && !q.length;
    html += `<section class="group ${closed ? 'closed' : ''}">
      <button class="grouphead" type="button" data-act="grp-toggle" data-g="${gid}">
        <span class="gname">${esc(g ? store.nm(g) : '–')}</span><span class="count">${arr.length}</span>${icon('chevron', 20)}</button>
      <div class="group-body">${closed ? '' : arr.map((it) => row(it, sp, all)).join('')}</div></section>`;
  }
  return html;
}

/** Schaltfläche „Alle zuklappen / aufklappen“ – zeigt die jeweils sinnvolle Aktion. */
function allBtn() {
  const anyOpen = store.groups().some((g) => !ui.collapsed[g.id]);
  return `<button class="chg" id="grp-all" type="button" data-act="grp-all">${icon(anyOpen ? 'collapse' : 'expand', 16)} ${t(anyOpen ? 'collapseAll' : 'expandAll')}</button>`;
}
const syncAllBtn = () => { const b = document.getElementById('grp-all'); if (b) b.outerHTML = allBtn(); };

export function renderStock() {
  const sp = selPlace();
  return `<header class="sign">
      <div class="sign-kicker sign-kicker--title"><h1>${t('tab.stock')}</h1>${allBtn()}</div>
      <label class="search">${icon('search', 20)}<input id="q" type="search" placeholder="${t('searchPh')}" value="${esc(ui.search)}" autocomplete="off" enterkeyhint="search"></label>
    </header>
    <div class="pchips" role="tablist">
      <button class="pchip ${sp === 'all' ? 'on' : ''}" type="button" data-act="stock-place" data-p="all"><span class="all-dot">∗</span> ${t('all')}</button>
      ${store.places().map((p) => `<button class="pchip ${sp === p.id ? 'on' : ''}" type="button" data-act="stock-place" data-p="${p.id}">${badge(p, 'xs')} ${esc(p.name)}</button>`).join('')}
    </div>
    <div id="stock-list" class="list">${listHtml()}</div>
    <button class="fab" type="button" data-act="item-new" aria-label="${t('itemNew')}">${icon('plus', 28)}</button>`;
}

/** Teil-Aktualisierung, damit das Suchfeld den Fokus behält. */
export function refreshStock() {
  const el = document.getElementById('stock-list');
  if (el && document.activeElement?.id === 'q') { el.innerHTML = listHtml(); return true; }
  return false;
}

actions['stock-place'] = (el) => { ui.place = el.dataset.p; ui.search = ''; window.dispatchEvent(new Event('st:render')); };
actions['grp-toggle'] = (el) => {
  const g = el.dataset.g;
  ui.collapsed[g] = !ui.collapsed[g];
  const list = document.getElementById('stock-list');
  if (list) list.innerHTML = listHtml();
  syncAllBtn();
};
actions['grp-all'] = () => {
  const anyOpen = store.groups().some((g) => !ui.collapsed[g.id]);
  store.groups().forEach((g) => { ui.collapsed[g.id] = anyOpen; });
  const list = document.getElementById('stock-list');
  if (list) list.innerHTML = listHtml();
  syncAllBtn();
};
document.addEventListener('input', (e) => {
  if (e.target.id !== 'q') return;
  ui.search = e.target.value;
  const el = document.getElementById('stock-list');
  if (el) el.innerHTML = listHtml();
});
