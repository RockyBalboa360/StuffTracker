// Foto-Editor: drehen (90°-Schritte) und zuschneiden (Bild verschieben + zoomen, Ausschnitt = Quadrat).
// Ergebnis ist ein kleines quadratisches JPEG-Vorschaubild (data-URL).
import { t } from './i18n.js';
import { icon, openSheet, closeSheet, toast } from './ui.js';

const OUT = 160; // Kantenlänge des gespeicherten Vorschaubilds

/** Öffnet den Editor für eine Bilddatei; liefert die data-URL oder null (abgebrochen). */
export async function openPhotoEditor(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { toast(t('photoLoadFail'), 'warn'); return null; }
  // Arbeitskopie (höchstens 1280 px), damit das Zeichnen beim Verschieben flüssig bleibt
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const src = document.createElement('canvas');
  src.width = Math.max(1, Math.round(bmp.width * k));
  src.height = Math.max(1, Math.round(bmp.height * k));
  src.getContext('2d').drawImage(bmp, 0, 0, src.width, src.height);
  bmp.close?.();

  return new Promise((resolve) => {
    const V = Math.max(200, Math.min(340, window.innerWidth - 34)); // Kantenlänge der Anzeige
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const st = { rot: 0, zoom: 1, x: 0, y: 0 }; // x, y: Verschiebung in Anzeige-Pixeln
    let result = null;
    let canvas; let ctx;

    const dims = () => (st.rot % 180 ? [src.height, src.width] : [src.width, src.height]);
    const scale = () => (V / Math.min(...dims())) * st.zoom;
    function clamp() {
      const [w, h] = dims(); const s = scale();
      const mx = Math.max(0, (w * s - V) / 2); const my = Math.max(0, (h * s - V) / 2);
      st.x = Math.max(-mx, Math.min(mx, st.x));
      st.y = Math.max(-my, Math.min(my, st.y));
    }
    /** Zeichnet den aktuellen Ausschnitt auf ein size×size großes Ziel. */
    function draw(c, size) {
      clamp();
      const f = size / V; const s = scale() * f;
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
      g.translate(size / 2 + st.x * f, size / 2 + st.y * f);
      g.rotate((st.rot * Math.PI) / 180);
      g.scale(s, s);
      g.drawImage(src, -src.width / 2, -src.height / 2);
    }
    const paint = () => draw(canvas, V * dpr);

    function rotate(dir) {
      // Verschiebung mitdrehen, damit der gewählte Bildteil im Rahmen bleibt
      const { x, y } = st;
      st.x = dir > 0 ? -y : y;
      st.y = dir > 0 ? x : -x;
      st.rot = (st.rot + (dir > 0 ? 90 : 270)) % 360;
      paint();
    }
    function setup(h) {
      canvas = h.el.querySelector('#pe-canvas');
      canvas.width = canvas.height = Math.round(V * dpr);
      ctx = canvas.getContext('2d');
      paint();
      let drag = null;
      canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', (e) => {
        if (!drag) return;
        st.x += e.clientX - drag.x; st.y += e.clientY - drag.y;
        drag = { x: e.clientX, y: e.clientY };
        paint();
      });
      const end = () => { drag = null; };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(st.zoom * (e.deltaY < 0 ? 1.1 : 0.9)); }, { passive: false });
      h.el.querySelector('#pe-zoom').addEventListener('input', (e) => setZoom(Number(e.target.value)));
    }
    function setZoom(z) {
      st.zoom = Math.max(1, Math.min(4, z));
      const sl = document.getElementById('pe-zoom'); if (sl) sl.value = String(st.zoom);
      paint();
    }

    openSheet({
      title: t('photoEdit'),
      onClose: () => resolve(result),
      render: () => `
        <p class="hint">${t('photoHint')}</p>
        <div class="pe-frame" style="width:${V}px;height:${V}px"><canvas id="pe-canvas" style="width:${V}px;height:${V}px" aria-label="${t('photoEdit')}"></canvas><i class="pe-grid" aria-hidden="true"></i></div>
        <div class="pe-tools">
          <button type="button" class="btn" data-act="pe-rl">${icon('rotl')} ${t('photoRotL')}</button>
          <button type="button" class="btn" data-act="pe-rr">${icon('rotr')} ${t('photoRotR')}</button>
        </div>
        <label class="pe-zoom">${icon('crop', 20)}<span>${t('photoZoom')}</span><input id="pe-zoom" type="range" min="1" max="4" step="0.01" value="1"></label>`,
      footer: () => `<button class="btn btn--ghost" type="button" data-act="pe-cancel">${t('cancel')}</button>
        <button class="btn btn--primary btn--grow" type="button" data-act="pe-ok">${icon('check')} ${t('photoUse')}</button>`,
      mount: (h) => setup(h),
      actions: {
        'pe-rl': () => rotate(-1),
        'pe-rr': () => rotate(1),
        'pe-cancel': () => closeSheet(),
        'pe-ok': () => {
          const out = document.createElement('canvas');
          out.width = out.height = OUT;
          draw(out, OUT);
          result = out.toDataURL('image/jpeg', 0.75);
          closeSheet();
        },
      },
    });
  });
}
