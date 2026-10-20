// Foto aufnehmen / aus Galerie wählen -> kleines quadratisches Vorschaubild (JPEG-Data-URL).
const SIZE = 160;

export async function toThumb(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, SIZE, SIZE);
  bmp.close?.();
  return c.toDataURL('image/jpeg', 0.72);
}

export function pickPhoto(camera) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.capture = 'environment';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      try { resolve(await toThumb(f)); } catch { resolve(null); }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
