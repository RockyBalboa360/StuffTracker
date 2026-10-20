// Bestand: Gruppen -> Artikel, Ortsfilter, Suche.
import { t } from '../i18n.js';
import * as store from '../store.js';
import { esc, icon, badge, tagCountChips, thumb, actions, ui } from '../ui.js';

const selPlace = () => ui.place || store.currentPlaceId();

function haystack(it) {
  const parts = [store.nm(it), store.nm(store.group(it.groupId))];
  for (const [pid, e] of Object.entries(it.stock)) {
    Object.keys(e.tags).forEach((g) => parts.push(store.nm(store.tag(g))));
    if (e.qty > 0) parts.push(store.place(pid)?.name || '');
  }
  return parts.join(' ').toLowerCase();
}

function row(it, pid, all) {
  let qty; let tags = {}; let low = false;
  if (all) {
    qty = store.totalQty(it);
    for (const e of Object.values(it.stock)) for (const [k, n] of Object.entries(e.tags)) tags[k] = (tags[k] || 0) + n;
    low = store.places().some((p) => store.isLow(it, p.id));
  } else {
    const e = it.stock[pid];
    qty = e?.qty || 0; tags = e?.tags || {}; low = store.isLow(it, pid);
  }
  const tagHtml = tagCountChips(tags);
  const places = all
    ? `<span class="row-places">${store.places().filter((p) => store.qtyAt(it, p.id) > 0)
      .map((p) => `<span class="pq">${badge(p, 'xs')}<i>${store.qtyAt(it, p.id)}</i></span>`).join('')}</span>` : '';
  const transit = store.inTransit(it.id);
  return `<button class="row" type="button" data-act="item-open" data-item="${it.id}">
    ${thumb(it, 'md')}
    <span class="row-main"><b>${esc(store.nm(it))}</b>
      ${tagHtml ? `<span class="row-tags">${tagHtml}</span>` : ''}
      ${places}</span>
    <span class="row-qty ${low ? 'low' : ''}">${low ? icon('alert', 16) : ''}<b>${qty}</b>${transit && all ? `<small>+${transit}</small>` : ''}</span>
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

export function renderStock() {
  const sp = selPlace();
  return `<header class="sign">
      <h1>${t('tab.stock')}</h1>
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
};
document.addEventListener('input', (e) => {
  if (e.target.id !== 'q') return;
  ui.search = e.target.value;
  const el = document.getElementById('stock-list');
  if (el) el.innerHTML = listHtml();
});
