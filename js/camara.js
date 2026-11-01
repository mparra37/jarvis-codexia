/* JARVIS · cámara de fotos del equipo
 *
 * Las fotos se quedan en el aparato (IndexedDB), nunca se suben al servidor.
 */

let flujo = null;
let frente = false;

export async function abrirCamara(video, { usarFrente = frente } = {}) {
  cerrarCamara();
  frente = usarFrente;
  flujo = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: frente ? 'user' : 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } },
    audio: false,
  });
  video.srcObject = flujo;
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.style.transform = frente ? 'scaleX(-1)' : '';
  await video.play().catch(() => {});
}

export function cerrarCamara() {
  if (flujo) flujo.getTracks().forEach((t) => t.stop());
  flujo = null;
}

export function camaraDeFrente() { return frente; }

/** Toma la foto con el marco de JARVIS. Devuelve un Blob JPEG. */
export function capturar(video, { titulo = '', subtitulo = '', color = '#3fd0ff' } = {}) {
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 960;
  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const g = lienzo.getContext('2d');
  if (frente) { g.translate(w, 0); g.scale(-1, 1); }
  g.drawImage(video, 0, 0, w, h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // marco
  const b = Math.round(Math.min(w, h) * 0.018);
  g.strokeStyle = color;
  g.lineWidth = b;
  g.strokeRect(b / 2, b / 2, w - b, h - b);
  const franja = Math.round(h * 0.13);
  const grad = g.createLinearGradient(0, h - franja * 1.6, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.75)');
  g.fillStyle = grad;
  g.fillRect(0, h - franja * 1.6, w, franja * 1.6);
  g.fillStyle = '#ffffff';
  g.font = `800 ${Math.round(franja * 0.36)}px Orbitron, sans-serif`;
  g.textBaseline = 'alphabetic';
  g.fillText(titulo.toUpperCase(), b * 2.2, h - franja * 0.5);
  g.fillStyle = color;
  g.font = `600 ${Math.round(franja * 0.24)}px Rajdhani, sans-serif`;
  g.fillText(subtitulo, b * 2.2, h - franja * 0.16);
  g.textAlign = 'right';
  g.fillStyle = '#ff1638';
  g.font = `800 ${Math.round(franja * 0.26)}px Orbitron, sans-serif`;
  g.fillText('CODEXIA', w - b * 2.2, h - franja * 0.2);
  return new Promise((r) => lienzo.toBlob((blob) => r(blob), 'image/jpeg', 0.88));
}

// ---------- almacén ----------
const BD = 'jarvis-fotos';
function abrirBD() {
  return new Promise((resolver, rechazar) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('fotos', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rechazar(req.error);
  });
}
async function tienda(modo) {
  const bd = await abrirBD();
  return bd.transaction('fotos', modo).objectStore('fotos');
}
const esperar = (req) => new Promise((r, x) => { req.onsuccess = () => r(req.result); req.onerror = () => x(req.error); });

export async function guardarFoto(blob, datos) {
  const t = await tienda('readwrite');
  return esperar(t.add({ blob, t: Date.now(), ...datos }));
}
export async function listarFotos(equipo) {
  try {
    const t = await tienda('readonly');
    const todas = await esperar(t.getAll());
    return todas.filter((f) => !equipo || f.equipo === equipo).sort((a, b) => b.t - a.t);
  } catch (e) { return []; }
}
export async function borrarFoto(id) {
  const t = await tienda('readwrite');
  return esperar(t.delete(id));
}
