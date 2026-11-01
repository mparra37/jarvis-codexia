/* JARVIS · Sala de control: lo que se proyecta en la pantalla grande */
import { llamar, hayServidor } from './api.js';
import { NUCLEOS } from './datos.js';
import { AYUDA_ESTACIONES } from './estaciones_datos.js';
import { Nucleo } from './nucleo.js';
import { Ambiente } from './ambiente.js';
import { sonido, desbloquearAudio } from './sonidos.js';
import { $, esc } from './ui.js';

const fondo = new Ambiente($('#fondo'));
fondo.poner('laboratorio', '#3fd0ff');
const cuerpo = $('#cuerpo');
let vista = 'jarvis';
let equipos = [];
const nucleos = new Map();
let conSonido = false;
let primeraVez = true;
const vistos = new Set();
let anuncioVisto = null;

$('#b-jarvis').addEventListener('click', () => { vista = 'jarvis'; pintar(); });
$('#b-marcador').addEventListener('click', () => { vista = 'marcador'; pintar(); });
$('#b-sonido').addEventListener('click', () => {
  conSonido = !conSonido;
  desbloquearAudio();
  $('#b-sonido').textContent = conSonido ? '🔊 Sonido' : '🔇 Activar sonido';
  if (conSonido) sonido('enLinea');
});
$('#b-pantalla').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
});

function clave(e) { return `${e.nombre}|${e.creado}`; }

function pintar() {
  const enLinea = equipos.filter((e) => e.encendido).length;
  $('#contador').innerHTML = `${enLinea} / ${equipos.length}<span>JARVIS EN LÍNEA</span>`;
  $('#b-jarvis').classList.toggle('btn-primario', vista === 'jarvis');
  $('#b-marcador').classList.toggle('btn-primario', vista === 'marcador');
  if (vista === 'jarvis') pintarJarvis(); else pintarMarcador();
}

function pintarJarvis() {
  if (!cuerpo.querySelector('.rejilla')) {
    nucleos.forEach((n) => n.destruir());
    nucleos.clear();
    cuerpo.innerHTML = '<div class="rejilla" id="rejilla"></div>';
  }
  const rejilla = $('#rejilla');
  if (!equipos.length) {
    rejilla.innerHTML = '<p class="vacio">Esperando equipos… Abran JARVIS en sus tablets y creen su equipo.</p>';
    return;
  }
  rejilla.querySelector('.vacio')?.remove();
  const presentes = new Set();
  equipos.forEach((e) => {
    const k = clave(e);
    presentes.add(k);
    let tarjeta = rejilla.querySelector(`[data-k="${CSS.escape(k)}"]`);
    if (!tarjeta) {
      tarjeta = document.createElement('div');
      tarjeta.className = 'tarjeta-eq';
      tarjeta.dataset.k = k;
      tarjeta.innerHTML = '<span class="medalla"></span><canvas></canvas><span class="j"></span><span class="e"></span><span class="mini-barra"><i></i></span><span class="s"></span><span class="e est"></span>';
      rejilla.appendChild(tarjeta);
      nucleos.set(k, new Nucleo(tarjeta.querySelector('canvas'), { mini: true }));
    }
    const color = e.color || '#3fd0ff';
    tarjeta.style.setProperty('--c', color);
    tarjeta.classList.toggle('linea', Boolean(e.encendido));
    tarjeta.querySelector('.j').textContent = e.jarvis;
    tarjeta.querySelector('.j').style.color = color;
    tarjeta.querySelector('.e').textContent = e.nombre;
    tarjeta.querySelector('.mini-barra i').style.width = `${(e.instalados / 8) * 100}%`;
    tarjeta.querySelector('.s').textContent = e.encendido ? '● EN LÍNEA' : `Construyendo ${e.instalados}/8`;
    tarjeta.querySelector('.est').textContent = e.estacion && AYUDA_ESTACIONES[e.estacion] ? `📍 ${AYUDA_ESTACIONES[e.estacion].nombre}` : '';
    tarjeta.querySelector('.medalla').textContent = e.ultron ? '🛡️' : '';
    tarjeta.querySelector('.medalla').title = e.ultron ? 'Sobrevivieron a Ultrón' : '';
    const n = nucleos.get(k);
    n.poner({ forma: (NUCLEOS[e.forma] || NUCLEOS.N1).forma, color });
    n.hablando(Boolean(e.encendido) && Math.random() < 0.15);
  });
  rejilla.querySelectorAll('.tarjeta-eq').forEach((t) => {
    if (!presentes.has(t.dataset.k)) { nucleos.get(t.dataset.k)?.destruir(); nucleos.delete(t.dataset.k); t.remove(); }
  });
}

function pintarMarcador() {
  nucleos.forEach((n) => n.destruir());
  nucleos.clear();
  const orden = [...equipos].sort((a, b) => b.puntos - a.puntos || b.piezas - a.piezas || a.creado - b.creado);
  cuerpo.innerHTML = `<div class="marcador">${orden.length ? orden.slice(0, 14).map((e, i) => `<div class="fila-m" style="--c:${esc(e.color || '#3fd0ff')}">
      <span class="pos">${i + 1}</span>
      <span><b>${esc(e.nombre)}</b> <span class="tenue">· ${esc(e.jarvis)}</span></span>
      <span class="piezas" title="Piezas de la bitácora">${[0, 1, 2, 3].map((p) => `<i class="${p < e.piezas ? 'si' : ''}"></i>`).join('')}</span>
      <span class="pts">${e.puntos}</span></div>`).join('') : '<p class="vacio">Todavía no hay equipos.</p>'}</div>`;
}

function celebrar(e) {
  if (conSonido) sonido('enLinea');
  const capa = document.createElement('div');
  capa.className = 'encendido-grande';
  capa.innerHTML = `<div><canvas></canvas><div class="t1" style="color:${esc(e.color || '#3fd0ff')}">${esc(e.jarvis)}</div><div class="t2">${esc(e.nombre)}</div><div class="t3">EN LÍNEA</div></div>`;
  document.body.appendChild(capa);
  const n = new Nucleo(capa.querySelector('canvas'), { forma: (NUCLEOS[e.forma] || NUCLEOS.N1).forma, color: e.color || '#3fd0ff' });
  n.hablando(true);
  setTimeout(() => { n.destruir(); capa.remove(); }, 4500);
}

function mostrarAnuncio(a) {
  const ultron = a.tipo === 'ultron';
  const capa = document.createElement('div');
  capa.className = `anuncio ${ultron ? 'ultron-anuncio' : ''}`;
  capa.innerHTML = `<div class="caja"><div class="tipo">${ultron ? '⚠ TRANSMISIÓN DE ULTRÓN' : 'MENSAJE DEL STAFF'}</div><div class="texto">${esc(a.texto)}</div></div>`;
  document.body.appendChild(capa);
  if (conSonido) sonido(ultron ? 'ultron' : 'anuncio');
  if (ultron) fondo.modo('ultron');
  capa.addEventListener('click', () => { capa.remove(); fondo.modo(null); });
  setTimeout(() => { capa.remove(); fondo.modo(null); }, 15000);
}

const cola = [];
let celebrando = false;
function siguienteCelebracion() {
  if (celebrando || !cola.length) return;
  celebrando = true;
  celebrar(cola.shift());
  setTimeout(() => { celebrando = false; siguienteCelebracion(); }, 4800);
}

async function revisar() {
  if (!hayServidor()) {
    cuerpo.innerHTML = '<p class="vacio">La Sala de control necesita el servidor (Worker). Configúrenlo en js/config.js.</p>';
    return;
  }
  try {
    const r = await llamar('GET', '/api/sala');
    equipos = r.equipos;
    equipos.forEach((e) => {
      const k = clave(e);
      if (e.encendido && !vistos.has(k)) {
        vistos.add(k);
        if (!primeraVez && cola.length < 6) cola.push(e);
      }
    });
    const a = r.estado && r.estado.anuncio;
    if (a && a.id !== anuncioVisto) {
      if (!primeraVez || Date.now() - a.t < 60000) mostrarAnuncio(a);
      anuncioVisto = a.id;
    }
    primeraVez = false;
    pintar();
    siguienteCelebracion();
  } catch (e) {
    $('#contador').innerHTML = '—<span>SIN CONEXIÓN</span>';
  }
}

pintar();
revisar();
setInterval(revisar, 3000);
// los núcleos de los equipos encendidos "hablan" de vez en cuando para que se vean vivos
setInterval(() => {
  equipos.forEach((e) => { const n = nucleos.get(clave(e)); if (n) n.hablando(Boolean(e.encendido) && Math.random() < 0.2); });
}, 1500);
