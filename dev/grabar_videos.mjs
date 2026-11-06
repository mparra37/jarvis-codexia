/* JARVIS · graba los videos de ayuda (videos/*.mp4) con la app real
 *
 * Abre la app en Chrome con una cámara falsa que "ve" una tarjeta impresa (así el escáner lee el QR
 * de verdad), pone subtítulos grandes y un círculo donde se toca, y arma los MP4 con ffmpeg.
 *
 * Requisitos (una vez):  cd dev && npm install puppeteer-core   ·   pip install imageio-ffmpeg
 * Uso (con el servidor de prueba corriendo: node dev/servidor.mjs):
 *   node dev/grabar_videos.mjs            → todos
 *   node dev/grabar_videos.mjs escanear   → uno
 * Variables: CHROME (ruta de chrome.exe), FFMPEG (ruta de ffmpeg), SITIO (http://localhost:8095)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');
const SITIO = (process.env.SITIO || 'http://localhost:8095').replace(/\/$/, '');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FFMPEG = process.env.FFMPEG || execFileSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const ANCHO = 1280;
const ALTO = 800;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-videos-'));
const salida = path.join(raiz, 'videos');
fs.mkdirSync(salida, { recursive: true });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const ff = (args) => execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

// ---------- equipos de partida (lo que ya llevan hecho al empezar cada video) ----------
const base = (extra = {}) => ({
  nombre: 'Los Bits', jarvis: { nombre: 'JARVIS', lema: '' }, voz: { id: 'V1', tono: null, velocidad: null, vozNombre: '' },
  nucleo: { id: 'N1', color: '#3fd0ff' }, ambiente: { id: '' }, personalidad: { id: '', habla: '', encanta: '', nunca: '' },
  memoria: { integrantes: [], prepa: '', dato: '' }, escudo: { regla: '' }, habilidades: {}, instalados: {}, bitacora: {}, puntos: [],
  logros: {}, estacion: null, encendido: null, creado: 7, ...extra,
});
const armado = (extra = {}) => base({
  jarvis: { nombre: 'NOVA', lema: 'Ningún bug nos detiene' }, voz: { id: 'V3', tono: null, velocidad: null, vozNombre: '' },
  nucleo: { id: 'N4', color: '#3fd0ff' }, personalidad: { id: 'P2', habla: 'un narrador de fútbol en la final del mundial', encanta: 'los tacos', nunca: 'se rinde' },
  instalados: { identidad: true, voz: true, nucleo: true, personalidad: true }, ...extra,
});

// ---------- guiones ----------
const VIDEOS = {
  bienvenida: {
    tarjeta: 'ID',
    equipo: null,
    async guion(t) {
      await t.texto('Así se arma un JARVIS');
      await t.tocar('[data-accion="crear"]', 'Toquen CREAR NUESTRO JARVIS');
      await t.escribir('#f-nombre', 'Los Bits');
      await t.tocar('#f-crear .btn-primario', 'Escriban el nombre del equipo');
      await espera(1200);
      await t.tocar('.modal-guia [data-ok]', '');
      await t.texto('La app les dice qué tarjeta buscar', 2200);
      await t.tocar('[data-accion="escanear"]', 'Toquen ESCANEAR TARJETA');
      await t.texto('Apunten la cámara al QR de la tarjeta', 3500);
      await t.tocar('.chips[data-destino="f-jnombre"] .chip:nth-child(2)', 'Escojan un nombre');
      await t.tocar('[data-listo]', 'Toquen LISTO');
      await t.texto('¡Siguiente misión! Así hasta encenderlo', 3000);
    },
  },
  escanear: {
    tarjeta: 'V3',
    equipo: base({ jarvis: { nombre: 'NOVA', lema: '' }, instalados: { identidad: true } }),
    async guion(t) {
      await t.texto('Cómo escanear una tarjeta', 1800);
      await t.tocar('[data-accion="escanear"]', '1 · Toquen ESCANEAR TARJETA');
      await t.texto('2 · Apunten la cámara al QR, a un palmo', 3500);
      await t.texto('JARVIS cambia al instante', 2200);
      await t.tocar('[data-listo]', '3 · Toquen LISTO');
      await t.texto('¡Y sigan con la siguiente misión!', 2600);
    },
  },
  directiva: {
    tarjeta: 'P2',
    equipo: armado({ personalidad: { id: '', habla: '', encanta: '', nunca: '' }, instalados: { identidad: true, voz: true, nucleo: true } }),
    async guion(t) {
      await t.texto('La directiva principal', 1800);
      await t.tocar('[data-accion="escanear"]', 'Escaneen una tarjeta de PERSONALIDAD');
      await espera(3200);
      await t.tocar('.chips[data-destino="d-habla"] .chip:nth-child(1)', 'Toquen una idea en cada fila');
      await t.tocar('.chips[data-destino="d-encanta"] .chip:nth-child(2)', 'Le encanta…');
      await t.tocar('.chips[data-destino="d-nunca"] .chip:nth-child(1)', 'Nunca…');
      await t.tocar('details.mas summary', 'Así queda su prompt de sistema');
      await espera(1800);
      await t.tocar('[data-listo]', 'Toquen LISTO');
      await t.texto('¡Ya está listo para encender!', 2400);
    },
  },
  encender: {
    tarjeta: 'ID',
    equipo: armado(),
    async guion(t) {
      await t.texto('Con las 4 misiones, aparece INICIAR', 2400);
      await t.tocar('[data-accion="encender"]', 'Toquen INICIAR y suban el volumen');
      await t.texto('JARVIS arranca…', 4200);
      await t.texto('…y se presenta frente a todos', 4000);
      await t.tocar('#continuar', '');
      await t.texto('¡Aparecen misiones nuevas para descubrir!', 3200);
    },
  },
  pista: {
    tarjeta: 'ID',
    equipo: armado({ encendido: Date.now() }),
    async guion(t) {
      await t.texto('Cómo pedir una pista en un taller', 1800);
      await t.tocar('[data-p="hablar"]', 'Vayan a HABLAR');
      await t.tocar('#b-estacion', 'Toquen 📍 y elijan su taller');
      await t.tocar('[data-est="algoritmos"]', '');
      await t.tocar('#b-pista', 'Toquen 💡 PISTA');
      await t.texto('JARVIS da pistas, nunca la respuesta', 3000);
      await t.tocar('#b-pista', '¿Siguen atorados? Pidan otra');
      await espera(2200);
    },
  },
};

// ---------- herramientas para los guiones ----------
async function prepararCaptura(pagina) {
  await pagina.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = `#grab-sub{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9999;max-width:90%;
      padding:14px 26px;border-radius:16px;background:rgba(0,0,0,.82);border:2px solid #3fd0ff;color:#fff;
      font:700 30px Rajdhani,Segoe UI,sans-serif;text-align:center;transition:opacity .25s}
      #grab-sub:empty{opacity:0}
      .grab-dedo{position:fixed;z-index:9998;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;
      background:rgba(255,210,63,.45);border:4px solid #ffd23f;pointer-events:none;animation:grabTap .9s ease-out forwards}
      @keyframes grabTap{0%{transform:scale(.4);opacity:1}60%{transform:scale(1);opacity:1}100%{transform:scale(1.5);opacity:0}}`;
    document.head.appendChild(st);
    const d = document.createElement('div');
    d.id = 'grab-sub';
    document.body.appendChild(d);
  });
}

function herramientas(pagina) {
  // el subtítulo va abajo, salvo con una ventana abierta (para no tapar sus botones): ahí va arriba
  const sub = (txt) => pagina.evaluate((t) => {
    const d = document.getElementById('grab-sub');
    if (!d) return;
    d.textContent = t;
    const arriba = Boolean(document.querySelector('.modal-fondo'));
    d.style.top = arriba ? '12px' : 'auto';
    d.style.bottom = arriba ? 'auto' : '26px';
  }, txt);
  return {
    async texto(txt, ms = 2400) { await sub(txt); await espera(ms); },
    async tocar(sel, txt, ms = 1300) {
      if (txt) { await sub(txt); await espera(900); }
      await pagina.waitForSelector(sel, { visible: true, timeout: 12000 });
      const caja = await pagina.$eval(sel, (el) => { el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await pagina.evaluate(({ x, y }) => { const d = document.createElement('div'); d.className = 'grab-dedo'; d.style.left = `${x}px`; d.style.top = `${y}px`; document.body.appendChild(d); setTimeout(() => d.remove(), 1000); }, caja);
      await espera(350);
      await pagina.mouse.click(caja.x, caja.y);
      await espera(ms);
    },
    async escribir(sel, valor) { await pagina.waitForSelector(sel, { visible: true }); await pagina.type(sel, valor, { delay: 110 }); await espera(500); },
  };
}

/** Imagen de la "cámara": la tarjeta impresa sobre una mesa. */
async function camaraFalsa(navegador, codigo) {
  const y4m = path.join(tmp, `cam-${codigo}.y4m`);
  if (fs.existsSync(y4m)) return y4m;
  const p = await navegador.newPage();
  await p.setViewport({ width: 1100, height: 1500, deviceScaleFactor: 2 });
  await p.goto(`${SITIO}/tarjetas.html?base=https://mparra37.github.io/jarvis-codexia/`, { waitUntil: 'networkidle0' });
  const tarjetas = await p.$$('.tarjeta');
  const codigos = await p.$$eval('.tarjeta', (els) => els.map((e) => (e.querySelector('.cod') || {}).textContent || ''));
  const i = codigos.indexOf(codigo);
  const png = path.join(tmp, `tarjeta-${codigo}.png`);
  await tarjetas[i].screenshot({ path: png });
  await p.close();
  const cuadro = path.join(tmp, `cuadro-${codigo}.png`);
  ff(['-i', png, '-vf', 'scale=-2:600,pad=960:720:(ow-iw)/2:(oh-ih)/2:color=0x5a4632', '-frames:v', '1', cuadro]);
  ff(['-loop', '1', '-i', cuadro, '-t', '2', '-r', '15', '-pix_fmt', 'yuv420p', y4m]);
  return y4m;
}

async function grabar(nombre) {
  const v = VIDEOS[nombre];
  // primero, la tarjeta para la cámara falsa (con un navegador normal)
  const previo = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const y4m = await camaraFalsa(previo, v.tarjeta);
  await previo.close();

  const navegador = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`, '--autoplay-policy=no-user-gesture-required', `--window-size=${ANCHO},${ALTO}`],
  });
  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: ANCHO, height: ALTO });
  await pagina.goto(`${SITIO}/?demoraqr=2600`, { waitUntil: 'networkidle0' });
  await pagina.evaluate((equipo) => {
    localStorage.clear();
    sessionStorage.clear();
    if (equipo) localStorage.setItem('jarvis-local-v2', JSON.stringify({ equipo }));
  }, v.equipo);
  await pagina.reload({ waitUntil: 'networkidle0' });
  await espera(800);
  await prepararCaptura(pagina);

  // captura de pantalla continua (CDP screencast) con la hora de cada cuadro
  const carpeta = path.join(tmp, nombre);
  fs.mkdirSync(carpeta, { recursive: true });
  const cdp = await pagina.target().createCDPSession();
  const cuadros = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const archivo = path.join(carpeta, `c${String(cuadros.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(archivo, Buffer.from(data, 'base64'));
    cuadros.push({ archivo, t: metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: ANCHO, maxHeight: ALTO, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  await v.guion(herramientas(pagina));
  const t1 = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await navegador.close();

  // armar el MP4 respetando el tiempo real entre cuadros
  const lista = path.join(carpeta, 'lista.txt');
  let txt = '';
  cuadros.forEach((c, i) => {
    const sig = i + 1 < cuadros.length ? cuadros[i + 1].t : t1;
    txt += `file '${c.archivo.replace(/\\/g, '/')}'\nduration ${Math.max(0.02, sig - c.t).toFixed(3)}\n`;
  });
  txt += `file '${cuadros[cuadros.length - 1].archivo.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(lista, txt);
  const mp4 = path.join(salida, `${nombre}.mp4`);
  ff(['-f', 'concat', '-safe', '0', '-i', lista, '-vf', 'scale=960:-2,fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', mp4]);
  console.log(`${nombre}.mp4 · ${(t1 - t0).toFixed(1)} s · ${cuadros.length} cuadros · ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB`);
  return mp4;
}

const pedidos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIDEOS);
const hechos = [];
for (const n of pedidos) hechos.push(await grabar(n));

// el video completo para la presentación: todos seguidos
if (pedidos.length === Object.keys(VIDEOS).length) {
  const lista = path.join(tmp, 'demo.txt');
  fs.writeFileSync(lista, ['bienvenida', 'escanear', 'directiva', 'encender', 'pista'].map((n) => `file '${path.join(salida, `${n}.mp4`).replace(/\\/g, '/')}'`).join('\n'));
  ff(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', path.join(salida, 'demo.mp4')]);
  console.log('demo.mp4 listo');
}
fs.rmSync(tmp, { recursive: true, force: true });
