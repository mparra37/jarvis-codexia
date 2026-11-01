/* JARVIS · piezas de interfaz: modales, avisos, escapado de texto */

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Abre un modal. contenido = HTML. Devuelve { el, cerrar }. alCerrar se llama una vez. */
export function modal(contenido, { clase = '', alCerrar, sinCerrar = false, color } = {}) {
  // quitar el foco del botón que abrió el modal (si no, un Enter lo vuelve a abrir)
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal ${clase}" role="dialog" aria-modal="true">${sinCerrar ? '' : '<button class="cerrar" aria-label="Cerrar">×</button>'}${contenido}</div>`;
  const caja = fondo.firstElementChild;
  if (color) caja.style.setProperty('--c', color);
  let cerrado = false;
  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    fondo.remove();
    document.removeEventListener('keydown', alTecla);
    if (alCerrar) alCerrar();
  };
  const alTecla = (e) => { if (e.key === 'Escape' && !sinCerrar) cerrar(); };
  document.addEventListener('keydown', alTecla);
  if (!sinCerrar) {
    fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
    caja.querySelector('.cerrar').addEventListener('click', cerrar);
  }
  document.body.appendChild(fondo);
  return { el: caja, cerrar };
}

/** Pregunta sí/no. Resuelve true o false. */
export function confirmar(texto, { si = 'Sí', no = 'Cancelar', peligro = false } = {}) {
  return new Promise((resolver) => {
    let respuesta = false;
    const m = modal(`<p style="font-size:20px;margin:8px 40px 18px 0">${esc(texto)}</p>
      <div class="fila-botones"><button class="btn ${peligro ? 'btn-rojo' : 'btn-primario'}" data-si>${esc(si)}</button><button class="btn" data-no>${esc(no)}</button></div>`,
    { alCerrar: () => resolver(respuesta) });
    m.el.querySelector('[data-si]').addEventListener('click', () => { respuesta = true; m.cerrar(); });
    m.el.querySelector('[data-no]').addEventListener('click', () => m.cerrar());
  });
}

let avisoActual = null;
export function aviso(texto, { mal = false, ms = 2600 } = {}) {
  if (avisoActual) avisoActual.remove();
  const el = document.createElement('div');
  el.className = `aviso ${mal ? 'mal' : ''}`;
  el.textContent = texto;
  document.body.appendChild(el);
  avisoActual = el;
  setTimeout(() => { if (avisoActual === el) { el.remove(); avisoActual = null; } }, ms);
}

export function hora(t) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Dibuja un QR en un <canvas> o devuelve un SVG (usa vendor/qrcode.js, global "qrcode"). */
export function qrSVG(texto, { tam = 200, margen = 2, color = '#000', fondo = '#fff' } = {}) {
  /* global qrcode */
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const total = n + margen * 2;
  let d = '';
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(f, c)) d += `M${c + margen} ${f + margen}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${tam}" height="${tam}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${fondo}"/><path d="${d}" fill="${color}"/></svg>`;
}

/** Pantalla completa (si se puede) y que no se apague la pantalla mientras se usa. */
let bloqueo = null;
export async function mantenerPantalla() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') bloqueo = await navigator.wakeLock.request('screen');
  } catch (e) { /* no soportado */ }
}
document.addEventListener('visibilitychange', () => { if (bloqueo && document.visibilityState === 'visible') mantenerPantalla(); });
