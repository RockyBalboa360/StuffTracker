// UI-Bausteine: Icons, Badges, Tags, Stepper, Sheets, Dialoge, Toast, Event-Dispatch.
import { t, getLang } from './i18n.js';
import * as store from './store.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Icons ---------- */
const P = {
  home: '<path d="M3 11l9-8 9 8M5.5 9.5V20h13V9.5"/>',
  stock: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  transport: '<path d="M3 12h16M13 6l6 6-6 6"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.2"/>',
  box: '<path d="M3 8l9-4 9 4v9l-9 4-9-4zM3 8l9 4 9-4M12 12v9"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  alert: '<path d="M12 4l10 17H2z"/><path d="M12 10v5M12 18v.5"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  edit: '<path d="M4 20l1-5L16 4l4 4L9 19z"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  gps: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5"/>',
  rotl: '<path d="M4 4v6h6M4.6 10A8 8 0 1 1 6 17.3"/>',
  rotr: '<path d="M20 4v6h-6M19.4 10A8 8 0 1 0 18 17.3"/>',
  crop: '<path d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14"/>',
  sunrise: '<path d="M4 19h16M7.5 19a4.5 4.5 0 019 0M12 11V5M9 8l3-3 3 3"/>',
  sunset: '<path d="M4 19h16M7.5 19a4.5 4.5 0 019 0M12 5v6M9 8l3 3 3-3"/>',
  collapse: '<path d="M7 4l5 5 5-5M7 20l5-5 5 5"/>',
  expand: '<path d="M7 9l5-5 5 5M7 15l5 5 5-5"/>',
  bell: '<path d="M6 17V11a6 6 0 1112 0v6l2 2H4zM10 21h4"/>',
};
/** Transport-Symbol: der gefüllte Subway-Pfeil (Vorlage „Downtown & Brooklyn“), alle anderen Symbole sind Linien. */
const TRANSPORT_ICON = '<path d="M2 9.8H20V14.2H2Z M23 12L13 22L10.45 19.45L17.91 12L10.45 4.55L13 2Z"/>';
export const icon = (name, size = 22) => (name === 'transport'
  ? `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">${TRANSPORT_ICON}</svg>`
  : `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);

/**
 * Richtungspfeil wie auf den NYC-Subway-Schildern (Vorlage „Downtown & Brooklyn“): dicker gerader Schaft und ein
 * OFFENER Pfeilkopf aus zwei dicken Balken im rechten Winkel, der Raum zwischen Schaft und Balken bleibt leer.
 */
// Kurzer dicker Schaft (links) + dicker Winkel als Spitze, alle Ecken scharf. Beide Teile im Uhrzeigersinn, damit sich
// die Überlappung nicht aushöhlt.
const ARROW_PATH = 'M0 17H54V27H0Z M60 22L38 44L32.34 38.34L48.69 22L32.34 5.66L38 0Z';
export const arrow = (cls = '') =>
  `<svg class="arrow ${cls}" viewBox="0 0 60 44" aria-hidden="true"><path d="${ARROW_PATH}" fill="currentColor"/></svg>`;

/* ---------- Badges (Linien-Symbole) ---------- */
const MTA = {
  blue: '#0039A6', orange: '#FF6319', lime: '#6CBE45', brown: '#996633', grey: '#A7A9AC',
  yellow: '#FCCC0A', cyan: '#00ADD0', red: '#EE352E', green: '#00933C', purple: '#B933AD',
};
export const PALETTE = MTA;
const LETTER = {
  A: 'blue', C: 'blue', E: 'blue', B: 'orange', D: 'orange', F: 'orange', M: 'orange', G: 'lime', J: 'brown', Z: 'brown',
  L: 'grey', S: 'grey', N: 'yellow', Q: 'yellow', R: 'yellow', W: 'yellow', T: 'cyan', 1: 'red', 2: 'red', 3: 'red',
  4: 'green', 5: 'green', 6: 'green', 7: 'purple', H: 'cyan', I: 'blue', K: 'lime', O: 'red', P: 'purple', U: 'green',
  V: 'cyan', X: 'brown', Y: 'yellow', 0: 'grey', 8: 'purple', 9: 'orange',
};
const FOLD = { Ä: 'A', Ö: 'O', Ü: 'U', ß: 'S' };
export const SHAPES = ['circle', 'diamond', 'square'];

export function placeLook(p) {
  const raw = (p.ch || (p.name || '?').trim().charAt(0) || '?').toUpperCase();
  const key = FOLD[raw] || raw;
  const color = p.color || MTA[LETTER[key]] || MTA.grey;
  const dark = color.toLowerCase() === MTA.yellow.toLowerCase();
  return { ch: raw, color, text: dark ? '#111' : '#fff', shape: p.shape || 'circle' };
}
export function badge(p, size = 'md', extra = '') {
  if (!p) return '';
  const l = placeLook(p);
  return `<span class="badge badge--${l.shape} sz-${size}" style="--bc:${l.color};--bt:${l.text}" data-badge="${p.id}" ${extra}><b>${esc(l.ch)}</b></span>`;
}
export function badgeRaw(ch, color, shape, size = 'lg') {
  const dark = color.toLowerCase() === MTA.yellow.toLowerCase();
  return `<span class="badge badge--${shape} sz-${size}" style="--bc:${color};--bt:${dark ? '#111' : '#fff'}"><b>${esc(ch)}</b></span>`;
}

/* ---------- Tags (Etiketten) ---------- */
export function tagChip(tg, { on = true, act = '', attrs = '', small = false, count = null } = {}) {
  const style = tg.style === 'plain' ? 'plain' : tg.style;
  const color = tg.color || MTA.grey;
  const dark = tg.style === 'plain' && color.toLowerCase() === MTA.yellow.toLowerCase();
  const cls = `tag tag--${style} ${on ? 'on' : 'off'} ${small ? 'tag--sm' : ''}`;
  const tag = act ? 'button' : 'span';
  return `<${tag} class="${cls}" style="--tc:${color};--tt:${dark ? '#111' : '#fff'}" ${act ? `data-act="${act}" type="button"` : ''} ${attrs}><i></i>${esc(store.nm(tg))}${count != null ? `<em>${count}</em>` : ''}</${tag}>`;
}
/** Kleiner Kreis in der Tag-Farbe, nur mit der Stückzahl. Der Durchmesser wächst mit der Stellenzahl (--d). */
export function tagDot(tg, n) {
  const color = tg.color || MTA.grey;
  const dark = tg.style === 'plain' && color.toLowerCase() === MTA.yellow.toLowerCase();
  return `<span class="tdot tdot--${tg.style}" style="--tc:${color};--tt:${dark ? '#111' : '#fff'};--d:${String(n).length}" title="${esc(store.nm(tg))}" aria-label="${esc(store.nm(tg))}: ${n}">${n}</span>`;
}
/** Stücke ohne Tag: transparenter Kreis mit dünnem hellem Rand. */
export const untaggedDot = (n) => `<span class="tdot tdot--none" style="--d:${String(n).length}" title="${esc(t('noTag'))}" aria-label="${esc(t('noTag'))}: ${n}">${n}</span>`;/** Tag-Etiketten mit Stückzahl für einen Bestandseintrag ({tagId: anzahl}). */
export function tagCountChips(tags, small = true) {
  return store.tagCounts(tags).map(([g, n]) => tagChip(g, { small, count: n })).join('');
}

/* ---------- Thumbnail ---------- */
export function thumb(it, size = 'md', { photos = true, letters = true } = {}) {
  const src = photos ? store.photo(it.id) : null;
  const g = store.group(it.groupId);
  const ini = esc((store.nm(it) || '?').trim().charAt(0).toUpperCase());
  if (src) return `<span class="thumb sz-${size}"><img src="${src}" alt=""></span>`;
  if (!letters) return '';
  return `<span class="thumb thumb--empty sz-${size}" title="${esc(store.nm(g))}"><b>${ini}</b></span>`;
}

/* ---------- Stepper ---------- */
export function stepper({ value, min = 0, max = 9999, on = '', args = {}, id = '', cls = '' }) {
  const a = Object.entries(args).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<div class="stepper ${cls}" data-on="${on}" data-min="${min}" data-max="${max}" ${a}>
    <button class="step-btn" type="button" data-d="-1" aria-label="${t('less')}">${icon('minus', 22)}</button>
    <input type="number" inputmode="numeric" pattern="[0-9]*" min="${min}" max="${max}" value="${value}" ${id ? `id="${id}"` : ''} aria-label="${t('qty')}">
    <button class="step-btn" type="button" data-d="1" aria-label="${t('more')}">${icon('plus', 22)}</button>
  </div>`;
}
export const stepHandlers = {};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function applyStep(cont, value, fromInput) {
  const { on, min, max, ...rest } = cont.dataset;
  const v = clamp(Math.floor(Number(value) || 0), Number(min), Number(max));
  const input = cont.querySelector('input');
  if (input && input.isConnected) input.value = v;
  stepHandlers[on]?.({ ...rest }, v);
  return v;
}
let rep = null; let held = false;
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.step-btn');
  if (!b) return;
  held = false;
  const cont = b.closest('.stepper');
  const d = Number(b.dataset.d);
  let cur = Number(cont.querySelector('input').value) || 0;
  const snapshot = document.createElement('div');
  Object.assign(snapshot.dataset, cont.dataset);
  const input = cont.querySelector('input');
  snapshot.querySelector = () => input;
  rep = setTimeout(() => {
    held = true;
    rep = setInterval(() => { cur = applyStep(cont.isConnected ? cont : snapshot, cur + d); }, 90);
  }, 450);
});
const stopRep = () => { clearTimeout(rep); clearInterval(rep); rep = null; };
['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, stopRep));
document.addEventListener('click', (e) => {
  const b = e.target.closest('.step-btn');
  if (!b) return;
  if (held) { held = false; return; }
  const cont = b.closest('.stepper');
  applyStep(cont, (Number(cont.querySelector('input').value) || 0) + Number(b.dataset.d));
});
document.addEventListener('change', (e) => {
  const inp = e.target.closest('.stepper input');
  if (inp) { applyStep(inp.closest('.stepper'), inp.value); return; }
  const el = e.target.closest('[data-change]');
  if (el) changes[el.dataset.change]?.(el, e);
});
document.addEventListener('focusin', (e) => { if (e.target.matches('.stepper input')) e.target.select?.(); });

/* ---------- Aktions-Dispatch ---------- */
export const actions = {};
export const changes = {};
export const ui = { tab: 'home', place: null, homePlace: null, search: '', homeSearch: '', collapsed: {}, seg: 'draft' };

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-sheet-close]')) { closeSheet(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const wrap = el.closest('.sheet-wrap');
  if (wrap) {
    const h = stack.find((s) => s.el === wrap);
    const fn = h?.opts.actions?.[el.dataset.act];
    if (fn) { fn(el, h, e); return; }
  }
  actions[el.dataset.act]?.(el, e);
});

/* ---------- Lang/Format ---------- */
/** short=true: das aktuelle Jahr entfällt (kürzere Kartenzeilen), andere Jahre bleiben sichtbar. */
export const fmtDate = (iso, short = false) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const noYear = short && y === new Date().getFullYear();
  return new Date(y, m - 1, d).toLocaleDateString(getLang() === 'de' ? 'de-DE' : 'en-GB', noYear ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtTs = (ts) =>
  new Date(ts).toLocaleString(getLang() === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ---------- Toast ---------- */
let toastTimer;
export function toast(msg, kind = '') {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.className = `toast ${kind} show`;
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- Sheets (mit Android-Zurück-Taste) ---------- */
const stack = [];
export function openSheet(opts) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  const h = { opts, el: wrap, redraw };
  function redraw() {
    const body = wrap.querySelector('.sheet-body');
    const top = body ? body.scrollTop : 0;
    const title = typeof opts.title === 'function' ? opts.title(h) : opts.title;
    wrap.innerHTML = `<div class="sheet-backdrop" data-sheet-close></div>
      <section class="sheet ${opts.cls || ''}" role="dialog" aria-modal="true">
        <header class="sheet-head"><h2>${opts.headHtml ? opts.headHtml(h) : esc(title)}</h2>
          <button class="sheet-x" data-sheet-close aria-label="${t('close')}">${icon('close')}</button></header>
        <div class="sheet-body">${opts.render(h)}</div>
        ${opts.footer ? `<footer class="sheet-foot">${opts.footer(h)}</footer>` : ''}
      </section>`;
    const nb = wrap.querySelector('.sheet-body');
    if (nb) nb.scrollTop = top;
    opts.mount?.(h);
  }
  redraw();
  stack.push(h);
  history.pushState({ s: stack.length }, '');
  document.body.appendChild(wrap);
  document.body.classList.add('has-sheet');
  requestAnimationFrame(() => wrap.classList.add('in'));
  return h;
}
function removeTop() {
  const h = stack.pop();
  if (!h) return;
  h.opts.onClose?.(h);
  h.el.classList.remove('in');
  setTimeout(() => h.el.remove(), 220);
  if (!stack.length) document.body.classList.remove('has-sheet');
}
export function closeSheet(n = 1) {
  n = Math.min(n, stack.length);
  if (n > 0) history.go(-n);
}
window.addEventListener('popstate', () => {
  const target = history.state?.s || 0;
  while (stack.length > target) removeTop();
});
export const refreshSheets = () => stack.forEach((h) => h.opts.live && h.redraw());
export const topSheet = () => stack[stack.length - 1];

/* ---------- Dialoge ---------- */
function dialog(build) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dlg-wrap';
    const done = (v) => { wrap.remove(); resolve(v); };
    wrap.innerHTML = `<div class="dlg-backdrop"></div><div class="dlg" role="alertdialog">${build.html}</div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('.dlg-backdrop').onclick = () => done(null);
    wrap.querySelector('[data-no]').onclick = () => done(null);
    wrap.querySelector('[data-yes]').onclick = () => done(build.value ? build.value(wrap) : true);
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') done(null);
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') wrap.querySelector('[data-yes]').click();
    });
    (wrap.querySelector('input') || wrap.querySelector('[data-yes]')).focus();
    wrap.querySelector('input')?.select();
  });
}
export async function confirmDialog({ title, text = '', ok, cancel, danger = false }) {
  const r = await dialog({
    html: `<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <div class="dlg-btns"><button class="btn btn--ghost" data-no type="button">${esc(cancel || t('cancel'))}</button>
      <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-yes type="button">${esc(ok || t('ok'))}</button></div>`,
  });
  return r === true;
}
export function promptDialog({ title, value = '', ok, placeholder = '', maxlength = 40 }) {
  return dialog({
    html: `<h3>${esc(title)}</h3>
      <input class="field" type="text" maxlength="${maxlength}" value="${esc(value)}" placeholder="${esc(placeholder)}">
      <div class="dlg-btns"><button class="btn btn--ghost" data-no type="button">${t('cancel')}</button>
      <button class="btn btn--primary" data-yes type="button">${esc(ok || t('save'))}</button></div>`,
    value: (w) => w.querySelector('input').value.trim() || null,
  });
}

/* ---------- Lange drücken (Badge-Editor) ---------- */
export function onLongPress(selector, cb, ms = 520) {
  let timer = null; let fired = false; let sx = 0; let sy = 0;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(selector);
    if (!el) return;
    fired = false; sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => { fired = true; navigator.vibrate?.(15); cb(el, e); }, ms);
  });
  document.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { clearTimeout(timer); timer = null; }
  });
  ['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => { clearTimeout(timer); timer = null; }));
  // Folge-Klick nach langem Drücken unterdrücken
  document.addEventListener('click', (e) => {
    if (fired && e.target.closest(selector)) { e.stopPropagation(); e.preventDefault(); fired = false; }
  }, true);
  document.addEventListener('contextmenu', (e) => { if (e.target.closest(selector)) e.preventDefault(); });
}
