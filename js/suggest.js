// Vorschläge aus früheren Suchanfragen beim Tippen (Suche auf der Startseite und im Bestand).
import * as store from './store.js';
import { esc } from './ui.js';

const INPUTS = new Set(['hq', 'q']);

/** Container für die Vorschläge direkt unter dem Suchfeld (wird bei Bedarf angelegt). */
function box(input) {
  const host = input.closest('label.search') || input.parentElement;
  let el = host.nextElementSibling;
  if (!el?.classList.contains('sugg')) {
    el = document.createElement('div');
    el.className = 'sugg';
    host.after(el);
  }
  el.dataset.for = input.id;
  return el;
}

function show(input) {
  const q = input.value.trim().toLowerCase();
  const el = box(input);
  const words = (s) => s.toLowerCase().split(/\s+/);
  const hits = !q ? [] : store.searchHistory()
    .filter((h) => h.toLowerCase() !== q && (h.toLowerCase().startsWith(q) || words(h).some((w) => w.startsWith(q))))
    .slice(0, 5);
  el.innerHTML = hits.map((h) => `<button type="button" class="chip chip--sugg" data-sugg="${esc(h)}">${esc(h)}</button>`).join('');
  el.hidden = !hits.length;
}

document.addEventListener('input', (e) => { if (INPUTS.has(e.target.id)) show(e.target); });

// Tippen auf einen Vorschlag soll das Suchfeld nicht verlassen (sonst verschwindet die Liste vor dem Klick).
document.addEventListener('pointerdown', (e) => { if (e.target.closest('.sugg button')) e.preventDefault(); });

document.addEventListener('click', (e) => {
  const b = e.target.closest('.sugg button');
  if (!b) return;
  const input = document.getElementById(b.parentElement.dataset.for);
  if (!input) return;
  input.value = b.dataset.sugg;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  store.addSearch(input.value);
});

// Gemerkt wird eine Anfrage, wenn das Feld verlassen oder bestätigt wird und es Treffer gab.
document.addEventListener('change', (e) => {
  const id = e.target.id;
  if (!INPUTS.has(id)) return;
  const q = e.target.value.trim();
  if (q.length < 2) return;
  const hasResults = id === 'hq'
    ? !!document.getElementById('home-results')?.children.length && !document.querySelector('#home-results .empty')
    : document.querySelectorAll('#stock-list .row').length > 0;
  if (hasResults) store.addSearch(q);
});

document.addEventListener('focusout', (e) => {
  if (!INPUTS.has(e.target.id)) return;
  setTimeout(() => { const el = e.target.closest('label.search')?.nextElementSibling; if (el?.classList.contains('sugg')) el.hidden = true; }, 0);
});
