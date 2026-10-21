// Artikel-Detail, Formulare, Verschieben in Transport, Aussondern, Mindestbestand, Tags.
import { t } from '../i18n.js';
import * as store from '../store.js';
import {
  esc, icon, badge, tagChip, thumb, stepper, stepHandlers, actions, openSheet, closeSheet, topSheet,
  toast, confirmDialog, PALETTE, arrow,
} from '../ui.js';
import { pickPhoto } from '../photo.js';
import { boxNameHtml, boxNameValue, bindBoxName } from './transport.js';

stepHandlers['local-qty'] = (_a, v) => { const s = topSheet(); if (s) s.qty = v; };
stepHandlers['item-qty'] = (a, v) => store.setQty(a.item, a.place, v);
stepHandlers['tag-count'] = (a, v) => {
  if (!store.setTagCount(a.item, a.place, a.tag, v)) toast(t('tagMax', { n: store.LIMITS.tagsPerEntry }), 'warn');
};

/** Tag zum Artikel am Ort hinzufügen (Startmenge siehe store.defaultTagCount); meldet, wenn nichts frei ist. */
function addTagTo(item, place, tag) {
  const ok = store.setTagCount(item, place, tag, store.defaultTagCount(item, place, tag));
  if (!ok) toast(t('tagMax', { n: store.LIMITS.tagsPerEntry }), 'warn');
  else if (!(store.item(item).stock[place].tags[tag] > 0)) toast(t('noFreePieces'), 'warn');
}

/* ================= Detail ================= */
function placeCard(it, p) {
  const e = it.stock[p.id];
  const qty = e?.qty || 0;
  const res = store.reserved(it.id, p.id);
  const low = store.isLow(it, p.id);
  const active = store.tagCounts(e?.tags);
  const rest = e ? store.untagged(e) : 0;
  const tags = qty > 0
    ? `<div class="tagbox">
        ${active.map(([g, n]) => `<div class="tagline">${tagChip(g)}${stepper({ value: n, min: 0, max: store.tagMax(it.id, p.id, g.id), on: 'tag-count', args: { item: it.id, place: p.id, tag: g.id } })}</div>`).join('')}
        ${rest > 0 ? `<div class="tagline tagline--none"><span class="tag-ph">${t('noTag')}</span><span class="countbox" aria-label="${t('noTag')}: ${rest}">${rest}</span></div>` : ''}
        <div class="tagrow">
          ${store.tags().filter((g) => !(e.tags[g.id] > 0)).map((g) => tagChip(g, { on: false, act: 'item-tag', attrs: `data-item="${it.id}" data-place="${p.id}" data-tag="${g.id}"` })).join('')}
          <button class="tag tag--add" type="button" data-act="item-tag-new" data-item="${it.id}" data-place="${p.id}" aria-label="${t('tagNew')}">${icon('plus', 16)}</button>
        </div>
      </div>` : '';
  return `<section class="pcard ${low ? 'low' : ''}" data-place="${p.id}">
    <header class="pcard-h">${badge(p, 'sm')}<h4>${esc(p.name)}</h4>
      ${low ? `<span class="warn">${icon('alert', 16)} ${t('low')}</span>` : ''}</header>
    <div class="pcard-qty">
      ${stepper({ value: qty, on: 'item-qty', args: { item: it.id, place: p.id } })}
      <span class="note note--total">${t('totalQty')}</span>
      ${res ? `<span class="note">${t('reserved', { n: res })}</span>` : ''}
    </div>
    ${tags}
    <div class="pcard-actions">
      ${qty > 0 ? `<button class="btn btn--sm" type="button" data-act="item-move" data-item="${it.id}" data-place="${p.id}">${icon('box', 18)} ${t('toBox')}</button>
      <button class="btn btn--sm" type="button" data-act="item-retire" data-item="${it.id}" data-place="${p.id}">${icon('ban', 18)} ${t('retire')}</button>` : ''}
      <button class="btn btn--sm ${e?.min?.on ? 'btn--on' : ''}" type="button" data-act="item-min" data-item="${it.id}" data-place="${p.id}">${icon('bell', 18)} ${e?.min?.on ? store.minLabel(e) : t('minSet')}</button>
    </div>
  </section>`;
}

function itemBody(id) {
  const it = store.item(id);
  if (!it) return '';
  const cur = store.currentPlaceId();
  const ps = [...store.places()].sort((a, b) => (a.id === cur ? -1 : b.id === cur ? 1 : 0));
  const ret = store.retiredFor(id);
  const retN = ret.reduce((a, r) => a + r.qty, 0);
  const transit = store.inTransit(id);
  return `<div class="item-top">
      <button class="photo-btn" type="button" data-act="item-photo" data-item="${id}" aria-label="${t('photo')}">${thumb(it, 'xl')}<span class="photo-cam">${icon('camera', 16)}</span></button>
      <div class="item-meta">
        <h3>${esc(store.nm(it))}</h3>
        <div class="muted">${esc(store.nm(store.group(it.groupId)))}</div>
        <button class="linkbtn" type="button" data-act="item-edit" data-item="${id}">${icon('edit', 16)} ${t('edit')}</button>
      </div>
    </div>
    ${transit ? `<div class="strip">${arrow('mini')} ${t('inTransit', { n: transit })}</div>` : ''}
    ${ps.map((p) => placeCard(it, p)).join('')}
    ${retN ? `<div class="strip strip--dim">${icon('ban', 16)} ${t('retiredTotal', { n: retN })}</div>` : ''}
    <button class="linkbtn linkbtn--danger" type="button" data-act="item-delete" data-item="${id}">${icon('trash', 16)} ${t('itemDelete')}</button>`;
}

export function openItem(id) {
  openSheet({
    live: true,
    title: () => store.nm(store.item(id)),
    render: () => itemBody(id),
  });
}

actions['item-open'] = (el) => openItem(el.dataset.item);
actions['item-tag'] = (el) => {
  const { item, place, tag } = el.dataset;
  addTagTo(item, place, tag);
};
actions['item-photo'] = (el) => openPhotoSheet(el.dataset.item);
actions['item-edit'] = (el) => openItemForm(el.dataset.item);
actions['item-move'] = (el) => openMove(el.dataset.item, el.dataset.place);
actions['item-retire'] = (el) => openRetire(el.dataset.item, el.dataset.place);
actions['item-min'] = (el) => openMin(el.dataset.item, el.dataset.place);
actions['item-tag-new'] = (el) => {
  const { item, place } = el.dataset;
  openTagForm(null, (g) => { if (g) addTagTo(item, place, g.id); });
};
actions['item-delete'] = async (el) => {
  const id = el.dataset.item;
  if (store.itemInUse(id)) { toast(t('itemInUse'), 'warn'); return; }
  if (await confirmDialog({ title: t('itemDelete'), text: t('itemDeleteText'), ok: t('delete'), danger: true })) {
    closeSheet();
    setTimeout(() => store.deleteItem(id), 50);
  }
};

/* ================= Foto ================= */
export function openPhotoSheet(itemId, onPick) {
  const apply = async (camera) => {
    const data = await pickPhoto(camera);
    if (!data) return;
    if (onPick) onPick(data); else store.setPhoto(itemId, data);
    closeSheet();
  };
  const h = openSheet({
    title: t('photo'),
    cls: 'sheet--small',
    render: () => `<div class="btn-stack">
      <button class="btn btn--primary" type="button" data-act="ph-cam">${icon('camera')} ${t('camera')}</button>
      <button class="btn" type="button" data-act="ph-gal">${icon('image')} ${t('gallery')}</button>
      ${(itemId && store.photo(itemId)) || onPick ? `<button class="btn btn--ghost" type="button" data-act="ph-del">${icon('trash')} ${t('photoRemove')}</button>` : ''}
    </div>`,
    actions: {
      'ph-cam': () => apply(true),
      'ph-gal': () => apply(false),
      'ph-del': () => { if (onPick) onPick(null); else store.setPhoto(itemId, null); closeSheet(); },
    },
  });
  return h;
}

/* ================= Artikel anlegen / bearbeiten ================= */
export function openItemForm(itemId, presetPlace) {
  const it = itemId ? store.item(itemId) : null;
  const cur = store.place(presetPlace) ? presetPlace : store.currentPlaceId();
  const st = { name: it ? store.nm(it) : '', groupId: it?.groupId || store.groups()[0]?.id, placeId: cur, qty: 1, photo: null, photoSet: false };
  const h = openSheet({
    title: it ? t('edit') : t('itemNew'),
    render: (hh) => `
      <label class="lbl" for="f-name">${t('name')}</label>
      <input id="f-name" class="field" type="text" maxlength="60" value="${esc(st.name)}" placeholder="${t('namePh')}" autocomplete="off">
      <div class="lbl">${t('group')}</div>
      <div class="chips" id="f-groups">${store.groups().map((g) => `<button type="button" class="chip ${g.id === st.groupId ? 'on' : ''}" data-act="f-group" data-id="${g.id}">${esc(store.nm(g))}</button>`).join('')}</div>
      ${it ? '' : `
        <div class="lbl">${t('photo')}</div>
        <button type="button" class="photo-btn" data-act="f-photo">${st.photo ? `<span class="thumb sz-xl"><img src="${st.photo}" alt=""></span>` : `<span class="thumb thumb--empty sz-xl">${icon('camera', 28)}</span>`}</button>
        <div class="lbl">${t('startStock')}</div>
        <div class="chips">${store.places().map((p) => `<button type="button" class="chip chip--badge ${p.id === st.placeId ? 'on' : ''}" data-act="f-place" data-id="${p.id}">${badge(p, 'xs')} ${esc(p.name)}</button>`).join('')}</div>
        <div class="pad">${stepper({ value: hh.qty ?? 1, on: 'local-qty' })}</div>`}`,
    footer: () => `<button class="btn btn--primary btn--block" type="button" data-act="f-save">${icon('check')} ${t('save')}</button>`,
    actions: {
      'f-group': (el) => {
        st.groupId = el.dataset.id;
        h.el.querySelectorAll('#f-groups .chip').forEach((c) => c.classList.toggle('on', c === el));
      },
      'f-place': (el) => {
        st.placeId = el.dataset.id;
        h.el.querySelectorAll('.chip--badge').forEach((c) => c.classList.toggle('on', c === el));
      },
      'f-photo': () => openPhotoSheet(null, (data) => { st.photo = data; st.photoSet = true; h.redraw(); }),
      'f-save': () => {
        const name = h.el.querySelector('#f-name').value.trim();
        if (!name) { toast(t('nameReq'), 'warn'); h.el.querySelector('#f-name').focus(); return; }
        if (it) {
          store.updateItem(it.id, { name, groupId: st.groupId });
        } else {
          const q = h.qty ?? 1;
          store.addItem({ name, groupId: st.groupId, placeId: st.placeId, qty: q, photoData: st.photo });
          toast(t('itemCreated'));
        }
        closeSheet();
      },
    },
  });
  h.qty = 1;
  const nameEl = h.el.querySelector('#f-name');
  // Name bei Redraw (z. B. nach Foto) erhalten
  const origRedraw = h.redraw;
  h.redraw = () => { st.name = h.el.querySelector('#f-name')?.value ?? st.name; origRedraw(); };
  if (!it) setTimeout(() => nameEl?.focus(), 250);
  return h;
}
actions['item-new'] = () => openItemForm(null);

/* ================= In Transport legen ================= */
stepHandlers['mv-qty'] = (_a, v) => topSheet()?.onQty?.(v);
stepHandlers['mv-tag'] = (a, v) => topSheet()?.onTag?.(a.tag, v);

export function openMove(itemId, placeId) {
  const it = store.item(itemId);
  const from = store.place(placeId);
  const avail = store.available(it, placeId);
  if (avail <= 0) { toast(t('nothingFree'), 'warn'); return; }
  const others = store.places().filter((p) => p.id !== placeId);
  const drafts = store.transports().filter((x) => x.status === 'draft' && x.from === placeId);
  const free = store.freeTags(it, placeId);
  const st = { sel: drafts[0]?.id || 'new', dest: others[0]?.id, qty: 1, name: '', choice: '', manual: false, alloc: store.defaultAlloc(it, placeId, 1) };
  const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const tagRows = () => {
    const rows = store.tags().filter((g) => free[g.id] > 0);
    if (!rows.length) return '';
    return `<div class="lbl">${t('ofThose')}</div>
      ${rows.map((g) => `<div class="tagline">${tagChip(g)}${stepper({ value: st.alloc[g.id] || 0, min: 0, max: Math.min(free[g.id], st.qty), on: 'mv-tag', args: { tag: g.id } })}</div>`).join('')}
      <p class="hint">${t('allocHint')}</p>`;
  };
  const h = openSheet({
    title: t('toBox'),
    render: () => `
      <div class="strip">${thumb(it, 'sm')} <div><b>${esc(store.nm(it))}</b><div class="muted">${badge(from, 'xs')} ${esc(from.name)} · ${t('freeN', { n: avail })}</div></div></div>
      <div class="lbl">${t('amount')}</div>
      <div class="pad">${stepper({ value: st.qty, min: 1, max: avail, on: 'mv-qty' })}</div>
      ${tagRows()}
      <div class="lbl">${t('whichBox')}</div>
      <div class="boxlist">
        ${drafts.map((d) => `<button type="button" class="boxcard ${st.sel === d.id ? 'on' : ''}" data-act="mv-sel" data-id="${d.id}">
            <span class="routes">${badge(from, 'xs')}${arrow('mini')}${badge(store.place(d.to), 'xs')}</span>
            <b>${esc(d.name)}</b><span class="muted">${t('nLines', { n: d.lines.length })}</span></button>`).join('')}
        <button type="button" class="boxcard boxcard--new ${st.sel === 'new' ? 'on' : ''}" data-act="mv-sel" data-id="new">
          ${icon('plus', 20)} <b>${t('boxNew')}</b></button>
      </div>
      ${st.sel === 'new' ? `
        <div class="lbl">${t('destination')}</div>
        <div class="chips">${others.map((p) => `<button type="button" class="chip chip--badge ${p.id === st.dest ? 'on' : ''}" data-act="mv-dest" data-id="${p.id}">${badge(p, 'xs')} ${esc(p.name)}</button>`).join('')}</div>
        ${boxNameHtml(st)}` : ''}`,
    footer: () => `<button class="btn btn--primary btn--block" type="button" data-act="mv-ok">${icon('box')} ${t('toBox')}</button>`,
    actions: {
      'mv-sel': (el) => { st.sel = el.dataset.id; redraw(); },
      'mv-dest': (el) => { st.dest = el.dataset.id; h.el.querySelectorAll('.chip--badge').forEach((c) => c.classList.toggle('on', c === el)); },
      'mv-ok': () => {
        const q = Math.min(st.qty, avail);
        const name = boxNameValue(st);
        let tid = st.sel;
        if (tid === 'new') tid = store.createTransport({ from: placeId, to: st.dest, name }).id;
        if (!store.addLine(tid, itemId, q, { ...st.alloc })) { toast(t('nothingFree'), 'warn'); return; }
        toast(t('movedToBox', { n: q, box: store.nm(store.transport(tid)) }));
        closeSheet();
      },
    },
  });
  bindBoxName(h, st);
  function redraw() {
    h.redraw();
  }
  h.onQty = (v) => {
    st.qty = v;
    if (!st.manual || total(st.alloc) > v) st.alloc = store.defaultAlloc(it, placeId, v);
    redraw();
  };
  h.onTag = (tag, v) => {
    st.manual = true;
    const others2 = total(st.alloc) - (st.alloc[tag] || 0);
    v = Math.max(0, Math.min(v, free[tag] || 0, st.qty - others2));
    if (v > 0) st.alloc[tag] = v; else delete st.alloc[tag];
    redraw();
  };
  return h;
}

/* ================= Aussondern ================= */
export function openRetire(itemId, placeId) {
  const it = store.item(itemId);
  const e = it.stock[placeId];
  const st = { reason: 'defect' };
  const h = openSheet({
    title: t('retire'),
    render: () => `
      <p class="hint">${t('retireHint')}</p>
      <div class="strip">${thumb(it, 'sm')} <div><b>${esc(store.nm(it))}</b><div class="muted">${badge(store.place(placeId), 'xs')} ${esc(store.place(placeId).name)} · ${e.qty}</div></div></div>
      <div class="lbl">${t('amount')}</div>
      <div class="pad">${stepper({ value: 1, min: 1, max: e.qty, on: 'local-qty' })}</div>
      <div class="lbl">${t('reason')}</div>
      <div class="chips" id="rt-r">
        <button type="button" class="chip on" data-act="rt-reason" data-id="defect">${t('reason.defect')}</button>
        <button type="button" class="chip" data-act="rt-reason" data-id="disposed">${t('reason.disposed')}</button>
        <button type="button" class="chip" data-act="rt-reason" data-id="worn">${t('reason.worn')}</button>
      </div>
      <label class="lbl" for="rt-note">${t('note')}</label>
      <input id="rt-note" class="field" type="text" maxlength="80" placeholder="${t('notePh')}">`,
    footer: () => `<button class="btn btn--danger btn--block" type="button" data-act="rt-ok">${icon('ban')} ${t('retireDo')}</button>`,
    actions: {
      'rt-reason': (el) => { st.reason = el.dataset.id; h.el.querySelectorAll('#rt-r .chip').forEach((c) => c.classList.toggle('on', c === el)); },
      'rt-ok': () => {
        store.retire(itemId, placeId, h.qty ?? 1, st.reason, h.el.querySelector('#rt-note').value.trim());
        toast(t('retired'));
        closeSheet();
      },
    },
  });
  h.qty = 1;
}

/* ================= Mindestbestand ================= */
export function openMin(itemId, placeId) {
  const e = store.item(itemId).stock[placeId];
  const st = { on: !!e?.min?.on, tag: store.minTagId(e) };
  const h = openSheet({
    title: t('minTitle'),
    render: (hh) => `
      <p class="hint">${t('minHint')}</p>
      <button type="button" class="switch ${st.on ? 'on' : ''}" data-act="mn-toggle" role="switch" aria-checked="${st.on}"><i></i><span>${t('minActive')}</span></button>
      <div class="lbl">${t('minValue')}</div>
      <div class="pad">${stepper({ value: hh.qty ?? e?.min?.v ?? 1, min: 0, on: 'local-qty' })}</div>
      <div class="lbl">${t('minTag')}</div>
      <p class="hint">${t('minTagHint')}</p>
      <div class="chips">
        <button type="button" class="chip ${st.tag ? '' : 'on'}" data-act="mn-tag" data-id="">${t('minTagNone')}</button>
        ${store.tags().map((g) => tagChip(g, { on: st.tag === g.id, act: 'mn-tag', attrs: `data-id="${g.id}"` })).join('')}
      </div>`,
    footer: () => `<button class="btn btn--primary btn--block" type="button" data-act="mn-ok">${icon('check')} ${t('save')}</button>`,
    actions: {
      'mn-toggle': () => { st.on = !st.on; h.redraw(); },
      'mn-tag': (el) => { st.tag = el.dataset.id && st.tag !== el.dataset.id ? el.dataset.id : null; h.redraw(); },
      'mn-ok': () => { store.setMin(itemId, placeId, st.on, h.qty ?? 1, st.tag); closeSheet(); },
    },
  });
  h.qty = e?.min?.v ?? 1;
}

/* ================= Tag anlegen / bearbeiten ================= */
export function openTagForm(tagId, done) {
  const g = tagId ? store.tag(tagId) : null;
  if (!g && store.tags().length >= store.LIMITS.tagsTotal) { toast(t('tagsFull'), 'warn'); return; }
  const st = { color: g?.color || PALETTE.blue };
  const h = openSheet({
    title: g ? t('edit') : t('tagNew'),
    cls: 'sheet--small',
    render: () => `
      <label class="lbl" for="tg-name">${t('name')}</label>
      <input id="tg-name" class="field" type="text" maxlength="18" value="${esc(g ? store.nm(g) : '')}" placeholder="${t('tagPh')}">
      ${!g || g.style === 'plain' ? `<div class="lbl">${t('color')}</div>
      <div class="swatches">${Object.values(PALETTE).map((c) => `<button type="button" class="swatch ${c === st.color ? 'on' : ''}" style="--sw:${c}" data-act="tg-color" data-c="${c}" aria-label="${c}"></button>`).join('')}</div>
      <div class="pad" id="tg-prev"></div>` : ''}`,
    footer: () => `<button class="btn btn--primary btn--block" type="button" data-act="tg-ok">${icon('check')} ${t('save')}</button>`,
    actions: {
      'tg-color': (el) => { st.color = el.dataset.c; h.el.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s === el)); preview(); },
      'tg-ok': () => {
        const name = h.el.querySelector('#tg-name').value.trim();
        if (!name) { toast(t('nameReq'), 'warn'); return; }
        let res;
        if (g) { store.updateTag(g.id, g.style === 'plain' ? { name, color: st.color } : { name }); res = store.tag(g.id); }
        else res = store.addTag(name, st.color);
        closeSheet();
        done?.(res);
      },
    },
    mount: (hh) => preview(hh),
  });
  function preview(hh = h) {
    const p = hh.el.querySelector('#tg-prev');
    if (p) p.innerHTML = tagChip({ style: 'plain', color: st.color, name: hh.el.querySelector('#tg-name')?.value || t('tagPh') });
  }
  h.el.addEventListener('input', (e) => { if (e.target.id === 'tg-name') preview(); });
}
