/* JARVIS · escáner de QR con la cámara
 *
 * Usa BarcodeDetector cuando el navegador lo tiene (Chrome en Android) y jsQR en los demás
 * (iPhone, Firefox). vendor/jsQR.js define el global "jsQR".
 */
/* global jsQR */

let flujo = null;
let activo = false;

export async function abrirEscaner(video, alLeer) {
  cerrarEscaner();
  activo = true;
  flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
  if (!activo) { cerrarEscaner(); return; }
  video.srcObject = flujo;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play().catch(() => {});

  let detector = null;
  try {
    if ('BarcodeDetector' in window) {
      const formatos = await window.BarcodeDetector.getSupportedFormats();
      if (formatos.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    }
  } catch (e) { detector = null; }

  // ?demoraqr=2500: solo para grabar los videos de ayuda (que se alcance a ver la cámara)
  const demora = Number(new URLSearchParams(location.search).get('demoraqr')) || 0;
  const inicio = Date.now();
  const lienzo = document.createElement('canvas');
  const g = lienzo.getContext('2d', { willReadFrequently: true });
  let ultimo = '';
  let ultimoT = 0;

  const revisar = async () => {
    if (!activo) return;
    if (video.readyState >= 2 && video.videoWidth) {
      let texto = '';
      try {
        if (detector) {
          const codigos = await detector.detect(video);
          if (codigos.length) texto = codigos[0].rawValue;
        } else if (typeof jsQR === 'function') {
          const escala = Math.min(1, 640 / video.videoWidth);
          lienzo.width = Math.round(video.videoWidth * escala);
          lienzo.height = Math.round(video.videoHeight * escala);
          g.drawImage(video, 0, 0, lienzo.width, lienzo.height);
          const img = g.getImageData(0, 0, lienzo.width, lienzo.height);
          const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (r) texto = r.data;
        }
      } catch (e) { /* cuadro malo, siguiente */ }
      const ahora = Date.now();
      if (texto && ahora - inicio >= demora && (texto !== ultimo || ahora - ultimoT > 2500)) {
        ultimo = texto;
        ultimoT = ahora;
        alLeer(texto);
      }
    }
    if (activo) setTimeout(revisar, 160);
  };
  revisar();
}

export function cerrarEscaner() {
  activo = false;
  if (flujo) flujo.getTracks().forEach((t) => t.stop());
  flujo = null;
}
