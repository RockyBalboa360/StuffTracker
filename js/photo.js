// Foto aufnehmen / aus Galerie wählen. Die Datei geht anschließend in den Foto-Editor (drehen, zuschneiden).

/** Öffnet die Kamera oder die Galerie und liefert die gewählte Bilddatei (oder null bei Abbruch). */
export function pickPhotoFile(camera) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.capture = 'environment';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
