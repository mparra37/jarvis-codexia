/* JARVIS · servidor de prueba local
 *
 * Sirve el sitio y la API con el MISMO código del Worker, usando SQLite de Node en lugar de D1.
 *
 *   cd worker && npm install        (una vez)
 *   node dev/servidor.mjs           (desde la carpeta del repositorio)
 *   → http://localhost:8095/
 *
 * Variables opcionales: PUERTO (8095), ANTHROPIC_API_KEY (para probar la IA de verdad),
 * STAFF_PIN (1234), BD (archivo .sqlite; por defecto en memoria), MODELO.
 * Sin ANTHROPIC_API_KEY, la IA contesta en "modo de prueba".
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..'); // el repositorio
const worker = (await import('../worker/src/index.js')).default;

const PUERTO = Number(process.env.PUERTO || 8095);
const db = new DatabaseSync(process.env.BD || ':memory:');

/** Lo mínimo de la API de D1 que usa el Worker, sobre node:sqlite. */
function d1(base) {
  const preparar = (sql) => {
    const st = base.prepare(sql);
    let args = [];
    const limpiar = (fila) => (fila ? { ...fila } : null);
    const sentencia = {
      bind(...a) { args = a.map((v) => (typeof v === 'boolean' ? Number(v) : v)); return sentencia; },
      async first(col) { const f = limpiar(st.get(...args)); return f && col ? f[col] : f; },
      async all() { return { results: st.all(...args).map(limpiar), success: true }; },
      async run() { const r = st.run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    };
    return sentencia;
  };
  return {
    prepare: preparar,
    async batch(lista) { const res = []; for (const s of lista) res.push(await s.run()); return res; },
  };
}

const env = {
  DB: d1(db),
  STAFF_PIN: process.env.STAFF_PIN || '1234',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  MODO_PRUEBA: '1',
  MODELO: process.env.MODELO || 'claude-opus-5-5',
  ESFUERZO: 'low',
  ORIGENES: '*',
  CUOTA_TABLETA: '30',
  LIMITE_DIARIO: '3000',
  CLAVE_VR: 'enlace-vr-2026',
};

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

function servirArchivo(req, res, url) {
  let ruta = decodeURIComponent(url.pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.join(raiz, ruta);
  if (!archivo.startsWith(raiz)) { res.writeHead(403).end(); return; }
  fs.stat(archivo, (err, info) => {
    if (err || !info.isFile()) {
      if (!err && info.isDirectory()) { res.writeHead(302, { Location: `${url.pathname}/` }).end(); return; }
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('No encontrado');
      return;
    }
    const tipo = TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream';
    const rango = req.headers.range;
    if (rango && tipo === 'video/mp4') {
      const [ini, fin] = rango.replace('bytes=', '').split('-').map((n) => (n ? Number(n) : undefined));
      const desde = ini || 0;
      const hasta = fin !== undefined ? fin : info.size - 1;
      res.writeHead(206, { 'Content-Type': tipo, 'Content-Range': `bytes ${desde}-${hasta}/${info.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': hasta - desde + 1 });
      fs.createReadStream(archivo, { start: desde, end: hasta }).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-store', 'Content-Length': info.size });
    fs.createReadStream(archivo).pipe(res);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!url.pathname.startsWith('/api/')) { servirArchivo(req, res, url); return; }
  const cuerpo = await new Promise((r) => { const partes = []; req.on('data', (c) => partes.push(c)); req.on('end', () => r(Buffer.concat(partes))); });
  const peticion = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : cuerpo });
  const respuesta = await worker.fetch(peticion, env);
  const encabezados = Object.fromEntries(respuesta.headers.entries());
  res.writeHead(respuesta.status, encabezados);
  res.end(Buffer.from(await respuesta.arrayBuffer()));
  if (process.env.LOG) console.log(req.method, url.pathname, respuesta.status);
}).listen(PUERTO, () => {
  console.log(`JARVIS de prueba en http://localhost:${PUERTO}/`);
  console.log(`IA: ${env.ANTHROPIC_API_KEY ? `real (${env.MODELO})` : 'modo de prueba (sin API key)'} · PIN del staff: ${env.STAFF_PIN}`);
});
