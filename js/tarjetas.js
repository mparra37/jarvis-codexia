/* JARVIS · tarjetas QR para imprimir (un sobre por equipo)
 *
 * Cada QR guarda la dirección de la app con ?t=CODIGO. Por defecto la dirección es la de esta misma
 * página: impriman desde la página publicada (GitHub Pages) para que los QR apunten ahí.
 */
import { TARJETAS, MODULO, ORDEN_SOBRE, ICONOS, colorTarjeta } from './datos.js';
import { qrSVG, esc } from './ui.js';
import { AYUDA_ESTACIONES, ORDEN_ESTACIONES } from './estaciones_datos.js';

const COLOR_ESTACION = { movil: '#2dd4bf', algoritmos: '#a78bfa', ciber: '#ff1638', redes: '#38bdf8' };

const entrada = document.querySelector('#base');
const params = new URLSearchParams(location.search);
entrada.value = params.get('base') || new URL('./', location.href).toString();

function svgIcono(nombre) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONOS[nombre] || ''}</svg>`;
}

function etiqueta(t) {
  if (t.tipo === 'modulo') return MODULO[t.modulo].nombre.toUpperCase();
  if (t.tipo === 'accion') return 'ACCIÓN';
  return '★ LEGENDARIO ★';
}

function tarjeta(codigo, base) {
  if (codigo === 'INFO') {
    return `<div class="tarjeta info">
      <div class="franja" style="background:#03060b"><span>J.A.R.V.I.S.</span>${svgIcono('qr')}</div>
      <div class="nombre" style="text-align:center">¿Cómo se usa?</div>
      <ol>
        <li>Abran JARVIS en la tablet (o con este QR).</li>
        <li>Toquen <b>Crear nuestro JARVIS</b> y escriban el nombre del equipo.</li>
        <li>Toquen <b>Escanear tarjeta</b> y apunten a una tarjeta.</li>
        <li>Pueden cambiar de opinión: escaneen otra.</li>
        <li>Con Identidad, Voz, Núcleo y Personalidad, ¡enciéndanlo!</li>
      </ol>
      <div class="qr">${qrSVG(base, { tam: 200, margen: 1 })}</div>
    </div>`;
  }
  const t = TARJETAS[codigo];
  const color = colorTarjeta(codigo);
  const icono = t.tipo === 'modulo' ? (t.modulo === 'habilidades' ? 'habilidades' : t.modulo) : t.tipo === 'accion' ? 'accion' : 'ultron';
  const url = `${base}?t=${codigo}`;
  const ult = t.tipo === 'especial';
  return `<div class="tarjeta ${ult ? 'ult' : ''}">
    <div class="franja" style="background:${ult ? 'linear-gradient(90deg,#b07800,#ffcc33,#b07800)' : color}"><span>${esc(etiqueta(t))}</span>${svgIcono(ult ? 'accion' : icono)}</div>
    <div class="nombre">${esc(t.nombre)}</div>
    <div class="desc">${esc(t.desc)}</div>
    <div class="qr">${qrSVG(url, { tam: 200, margen: 1, color: '#0b1626' })}</div>
    <div class="pie"><span>JARVIS · CODEXIA</span><span class="cod">${codigo}</span></div>
  </div>`;
}

function pintar() {
  let base = entrada.value.trim();
  if (!/^https?:\/\//.test(base)) base = `https://${base}`;
  base = base.split('?')[0];
  const aviso = document.querySelector('#aviso');
  const local = /localhost|127\.0\.0\.1/.test(base);
  aviso.hidden = !local;
  aviso.textContent = local ? '⚠ Los QR apuntan a esta computadora (localhost). Para imprimir los de verdad, abran esta página desde GitHub Pages o escriban arriba la dirección publicada de JARVIS.' : '';
  const que = document.querySelector('#que').value;
  const hojas = [];
  for (let i = 0; i < ORDEN_SOBRE.length; i += 9) hojas.push(ORDEN_SOBRE.slice(i, i + 9));
  const sobre = hojas.map((h) => `<div class="hoja">${h.map((c) => tarjeta(c, base)).join('')}</div>`).join('');
  const carteles = [ORDEN_ESTACIONES.slice(0, 2), ORDEN_ESTACIONES.slice(2, 4)]
    .map((par) => `<div class="hoja carteles">${par.map((id) => cartel(id, base)).join('')}</div>`).join('');
  document.querySelector('#hojas').innerHTML = (que !== 'carteles' ? sobre : '') + (que !== 'sobre' ? carteles : '');
}

/** Cartel para la mesa de cada taller: su QR abre las pistas de esa estación en JARVIS. */
function cartel(id, base) {
  const a = AYUDA_ESTACIONES[id];
  return `<div class="cartel">
    <div>
      <div class="grande">¿ATORADOS?</div>
      <div class="sub">Pregúntenle a su JARVIS</div>
      <span class="est" style="background:${COLOR_ESTACION[id]}">${esc(a.nombre.toUpperCase())}</span>
      <div class="reto">${esc(a.reto)}</div>
      <div class="nota">Escaneen con la tablet o el celular del equipo. JARVIS da pistas, no respuestas.</div>
    </div>
    <div class="qr">${qrSVG(`${base}?estacion=${id}`, { tam: 260, margen: 1, color: '#0b1626' })}</div>
  </div>`;
}

entrada.addEventListener('change', pintar);
document.querySelector('#que').addEventListener('change', pintar);
document.querySelector('#imprimir').addEventListener('click', () => window.print());
pintar();
