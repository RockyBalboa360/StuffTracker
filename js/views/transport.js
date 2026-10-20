// Transporte = Kisten: vorbereiten -> abschicken (gesperrt) -> Ankunft bestätigen.
import { t } from '../i18n.js';
import * as store from '../store.js';
import {
  esc, icon, badge, tagCountChips, thumb, stepper, stepHandlers, actions, openSheet, closeSheet, topSheet,
  toast, confirmDialog, promptDialog, arrow, fmtDate, today, ui,
} from '../ui.js';

stepHandlers['line-qty'] = (a, v) => store.setLine(a.tr, a.item, v);
stepHandlers['pick-qty'] = (_a, v) => { const s = topSheet(); if (s) s.qty = v; };

const statusLabel = (s) => t('st.' + s);

export function routeHtml(tr, size = 'sm') {
  return `<span class="routes">${badge(store.place(tr.from), size)}${arrow()}${badge(store.place(tr.to), size)}</span>`;
}

export function transportCard(tr) {
  const n = tr.lines.reduce((a, l) => a + l.qty, 0);
  const date = tr.status === 'sent' ? t('since', { d: fmtDate(tr.sentAt) })
    : tr.status === 'arrived' ? t('arrivedOn', { d: fmtDate(tr.arrivedAt) })
    : tr.status === 'cancelled' ? t('cancelledOn', { d: fmtDate(tr.cancelledAt) }) : '';
  return `<button class="tcard tcard--${tr.status}" type="button" data-act="tr-open" data-id="${tr.id}">
    ${routeHtml(tr, 'md')}
    <span class="tcard-main"><b>${esc(tr.name)}</b>
      <span class="muted">${t('nPieces', { n })} · ${t('nLines', { n: tr.lines.length })}</span>
      ${date ? `<span class="muted">${esc(date)}</span>` : ''}</span>
    <span class="status status--${tr.status}">${statusLabel(tr.status)}</span>
  </button>`;
}

/* ================= Tab ================= */
export function renderTransport() {
  const all = store.transports();
  const seg = ui.seg;
  const groups = {
    draft: all.filter((x) => x.status === 'draft'),
    sent: all.filter((x) => x.status === 'sent'),
    done: all.filter((x) => x.status === 'arrived' || x.status === 'cancelled'),
  };
  const sortFn = {
    draft: (a, b) => b.createdAt - a.createdAt,
    sent: (a, b) => String(b.sentAt).localeCompare(String(a.sentAt)),
    done: (a, b) => String(b.arrivedAt || b.cancelledAt).localeCompare(String(a.arrivedAt || a.cancelledAt)),
  };
  const list = [...groups[seg]].sort(sortFn[seg]);
  const tabs = ['draft', 'sent', 'done'].map((k) =>
    `<button class="seg ${seg === k ? 'on' : ''}" type="button" data-act="tr-seg" data-s="${k}">${t('seg.' + k)}<span class="count">${groups[k].length}</span></button>`).join('');
  return `<header class="sign"><h1>${t('tab.transport')}</h1></header>
    <div class="segs">${tabs}</div>
    <div class="list">${list.length ? list.map(transportCard).join('') : `<div class="empty">${arrow('big')}<p>${t('emptyTr.' + seg)}</p></div>`}</div>
    <button class="fab" type="button" data-act="tr-new" aria-label="${t('trNew')}">${icon('plus', 28)}</button>`;
}
actions['tr-seg'] = (el) => { ui.seg = el.dataset.s; window.dispatchEvent(new Event('st:render')); };
actions['tr-open'] = (el) => openTransport(el.dataset.id);
actions['tr-new'] = () => openTransportForm();

/* ================= Neuer Transport ================= */
export function openTransportForm(preFrom) {
  const ps = store.places();
  const st = { from: preFrom || store.currentPlaceId(), to: null };
  st.to = ps.find((p) => p.id !== st.from)?.id;
  const h = openSheet({
    title: t('trNew'),
    cls: 'sheet--small',
    render: () => `
      <div class="lbl">${t('from')}</div>
      <div class="chips">${ps.map((p) => `<button type="button" class="chip chip--badge ${p.id === st.from ? 'on' : ''}" data-act="tf-from" data-id="${p.id}">${badge(p, 'xs')} ${esc(p.name)}</button>`).join('')}</div>
      <div class="lbl">${t('to')}</div>
      <div class="chips">${ps.filter((p) => p.id !== st.from).map((p) => `<button type="button" class="chip chip--badge ${p.id === st.to ? 'on' : ''}" data-act="tf-to" data-id="${p.id}">${badge(p, 'xs')} ${esc(p.name)}</button>`).join('')}</div>
      <label class="lbl" for="tf-name">${t('boxName')}</label>
      <input id="tf-name" class="field" type="text" maxlength="40" placeholder="${t('boxNamePh')}">`,
    footer: () => `<button class="btn btn--primary btn--block" type="button" data-act="tf-ok">${icon('box')} ${t('create')}</button>`,
    actions: {
      'tf-from': (el) => { st.from = el.dataset.id; if (st.to === st.from) st.to = ps.find((p) => p.id !== st.from).id; keep(); h.redraw(); },
      'tf-to': (el) => { st.to = el.dataset.id; keep(); h.redraw(); },
      'tf-ok': () => {
        const tr = store.createTransport({ from: st.from, to: st.to, name: h.el.querySelector('#tf-name').value.trim() });
        closeSheet();
        setTimeout(() => openTransport(tr.id), 260);
      },
    },
  });
  let name = '';
  function keep() { name = h.el.querySelector('#tf-name').value; }
  h.el.addEventListener('transitionend', () => {}, { once: true });
  const orig = h.redraw;
  h.redraw = () => { orig(); h.el.querySelector('#tf-name').value = name; };
}

/* ================= Detail ================= */
function lineRow(tr, l) {
  const it = store.item(l.itemId);
  if (!it) return '';
  const tagHtml = tagCountChips(l.tags);
  const max = tr.status === 'draft' ? store.available(it, tr.from) + l.qty : l.qty;
  return `<div class="line">
    ${thumb(it, 'md')}
    <div class="line-main"><b>${esc(store.nm(it))}</b>${tagHtml ? `<span class="row-tags">${tagHtml}</span>` : ''}</div>
    ${tr.status === 'draft'
      ? stepper({ value: l.qty, min: 0, max, on: 'line-qty', args: { tr: tr.id, item: it.id } })
      : `<span class="line-qty">× ${l.qty}</span>`}
  </div>`;
}

function trBody(id) {
  const tr = store.transport(id);
  if (!tr) return '';
  const lines = tr.lines.map((l) => lineRow(tr, l)).join('');
  const info = tr.status === 'sent' ? `<div class="strip">${arrow('mini')} ${t('sentSince', { d: fmtDate(tr.sentAt) })} · ${t('locked')}</div>`
    : tr.status === 'arrived' ? `<div class="strip strip--ok">${icon('check', 16)} ${t('arrivedOn', { d: fmtDate(tr.arrivedAt) })}</div>`
    : tr.status === 'cancelled' ? `<div class="strip strip--dim">${icon('ban', 16)} ${t('cancelledOn', { d: fmtDate(tr.cancelledAt) })}</div>` : '';
  return `<div class="tr-head">${routeHtml(tr, 'lg')}
      <div class="tr-names"><span>${esc(store.place(tr.from)?.name)}</span><span>${esc(store.place(tr.to)?.name)}</span></div></div>
    ${info}
    <div class="lines">${lines || `<div class="empty small"><p>${t('boxEmpty')}</p></div>`}</div>
    ${tr.status === 'draft' ? `<button class="btn btn--block" type="button" data-act="tr-add" data-id="${id}">${icon('plus')} ${t('addItems')}</button>` : ''}`;
}

function trFooter(id) {
  const tr = store.transport(id);
  if (!tr) return '';
  if (tr.status === 'draft') {
    return `<button class="btn btn--danger" type="button" data-act="tr-delete" data-id="${id}" aria-label="${t('delete')}">${icon('trash')}</button>
      <button class="btn btn--primary btn--grow" type="button" data-act="tr-send" data-id="${id}" ${tr.lines.length ? '' : 'disabled'}>${icon('transport')} ${t('send')}</button>`;
  }
  if (tr.status === 'sent') {
    return `<button class="btn btn--ghost" type="button" data-act="tr-cancel" data-id="${id}">${icon('ban')} ${t('cancelSent')}</button>
      <button class="btn btn--primary btn--grow" type="button" data-act="tr-arrive" data-id="${id}">${icon('check')} ${t('arrive')}</button>`;
  }
  return '';
}

export function openTransport(id) {
  openSheet({
    live: true,
    title: () => store.transport(id)?.name || '',
    headHtml: () => {
      const tr = store.transport(id);
      return tr ? `<span>${esc(tr.name)}</span>${tr.status === 'draft' ? `<button class="mini-edit" type="button" data-act="tr-rename" data-id="${id}" aria-label="${t('edit')}">${icon('edit', 16)}</button>` : ''}` : '';
    },
    render: () => trBody(id),
    footer: () => trFooter(id),
  });
}

actions['tr-rename'] = async (el) => {
  const tr = store.transport(el.dataset.id);
  const v = await promptDialog({ title: t('boxName'), value: tr.name });
  if (v) store.renameTransport(tr.id, v);
};
actions['tr-delete'] = async (el) => {
  const id = el.dataset.id;
  if (await confirmDialog({ title: t('trDelete'), text: t('trDeleteText'), ok: t('delete'), danger: true })) {
    closeSheet();
    setTimeout(() => store.cancelTransport(id), 50);
  }
};
actions['tr-send'] = (el) => openSend(el.dataset.id);
actions['tr-arrive'] = (el) => openArrive(el.dataset.id);
actions['tr-cancel'] = async (el) => {
  const tr = store.transport(el.dataset.id);
  if (await confirmDialog({ title: t('cancelSent'), text: t('cancelSentText', { place: store.place(tr.from)?.name }), ok: t('cancelSentDo'), danger: true })) {
    store.cancelTransport(tr.id);
    toast(t('cancelled'));
  }
};

/* ---------- Abschicken / Ankunft: Datum bestätigen ---------- */
function dateSheet({ title, text, okLabel, okIcon, onOk }) {
  let date = today();
  const h = openSheet({
    title,
    cls: 'sheet--small',
    render: () => `<p class="hint">${text}</p>
      <label class="lbl" for="d-date">${t('date')}</label>
      <input id="d-date" class="field" type="date" value="${date}" max="2100-01-01">`,
    footer: () => `<button class="btn btn--primary btn--block" type="button" data-act="d-ok">${icon(okIcon)} ${okLabel}</button>`,
    actions: {
      'd-ok': () => { date = h.el.querySelector('#d-date').value || today(); onOk(date); },
    },
  });
}
export function openSend(id) {
  const tr = store.transport(id);
  dateSheet({
    title: t('send'), text: t('sendHint'), okLabel: t('sendDo'), okIcon: 'transport',
    onOk: (date) => {
      if (!store.sendTransport(id, date)) { toast(t('sendFail'), 'warn'); return; }
      toast(t('sentOk', { box: tr.name }));
      closeSheet();
    },
  });
}
export function openArrive(id) {
  const tr = store.transport(id);
  dateSheet({
    title: t('arrive'), text: t('arriveHint', { place: store.place(tr.to)?.name }), okLabel: t('arriveDo'), okIcon: 'check',
    onOk: (date) => {
      store.arriveTransport(id, date);
      toast(t('arrivedOk', { place: store.place(tr.to)?.name }));
      closeSheet();
    },
  });
}
actions['tr-arrive-quick'] = (el) => openArrive(el.dataset.id);

/* ================= Artikel hinzufügen ================= */
actions['tr-add'] = (el) => openPicker(el.dataset.id);
export function openPicker(tid) {
  const tr = store.transport(tid);
  const from = store.place(tr.from);
  const st = { q: '' };
  const listHtml = () => {
    const q = st.q.trim().toLowerCase();
    const rows = store.sortedItems().filter((it) => store.available(it, tr.from) > 0 && (!q || store.nm(it).toLowerCase().includes(q) || store.nm(store.group(it.groupId)).toLowerCase().includes(q)));
    if (!rows.length) return `<div class="empty small"><p>${t('nothingToPick')}</p></div>`;
    return rows.map((it) => {
      const inBox = store.transport(tid).lines.find((l) => l.itemId === it.id)?.qty || 0;
      return `<button class="row" type="button" data-act="pk-add" data-item="${it.id}">
        ${thumb(it, 'md')}
        <span class="row-main"><b>${esc(store.nm(it))}</b><span class="muted">${esc(store.nm(store.group(it.groupId)))}</span></span>
        <span class="row-qty"><b>${store.available(it, tr.from)}</b>${inBox ? `<small>${t('inBoxN', { n: inBox })}</small>` : ''}</span>
      </button>`;
    }).join('');
  };
  const h = openSheet({
    live: false,
    title: t('addItems'),
    render: () => `<div class="strip">${badge(from, 'xs')} ${t('pickFrom', { place: esc(from.name) })}</div>
      <label class="search">${icon('search', 20)}<input id="pk-q" type="search" placeholder="${t('searchPh')}" autocomplete="off"></label>
      <p class="hint">${t('pickHint')}</p>
      <div id="pk-list" class="list">${listHtml()}</div>`,
    actions: {
      'pk-add': (el) => {
        const it = store.item(el.dataset.item);
        if (!store.addLine(tid, it.id, 1)) { toast(t('nothingFree'), 'warn'); return; }
        h.el.querySelector('#pk-list').innerHTML = listHtml();
        toast(t('added', { name: store.nm(it) }));
      },
    },
  });
  h.el.addEventListener('input', (e) => {
    if (e.target.id !== 'pk-q') return;
    st.q = e.target.value;
    h.el.querySelector('#pk-list').innerHTML = listHtml();
  });
}
