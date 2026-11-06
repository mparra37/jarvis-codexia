/* JARVIS · arma cloudflare/worker.js: el Worker en UN solo archivo para pegar en la página de Cloudflare
 *
 * Junta src/index.js con los archivos de ../js que usa, y cambia la llamada con el SDK (ia.js) por la
 * de HTTP directo (ia_fetch.js), porque el editor de Cloudflare no instala paquetes de npm.
 *   cd worker && npm install && node armar_pegable.mjs
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const salida = path.resolve(aqui, '..', 'cloudflare', 'worker.js');

const encabezado = `/* JARVIS · CODEXIA — Worker de Cloudflare en un solo archivo (súper inteligencia)
 *
 * CÓMO USARLO (sin terminal): vean "La súper inteligencia, copiando y pegando" en LEEME.md.
 *   1. En dash.cloudflare.com: Workers → Crear → Worker "Hello World" → Desplegar → Editar código.
 *   2. Borren todo, peguen ESTE archivo completo y Desplieguen.
 *   3. Configuración → Variables y secretos → Agregar → tipo Secreto: ANTHROPIC_API_KEY (y STAFF_PIN).
 *   4. (Opcional) Configuración → Enlaces → D1: nombre de variable DB.
 * Archivo generado por worker/armar_pegable.mjs: no lo editen a mano.
 */`;

await build({
  entryPoints: [path.join(aqui, 'src', 'index.js')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  outfile: salida,
  legalComments: 'none',
  banner: { js: encabezado },
  plugins: [{
    name: 'ia-sin-sdk',
    setup(b) {
      b.onResolve({ filter: /^\.\/ia\.js$/ }, () => ({ path: path.join(aqui, 'src', 'ia_fetch.js') }));
    },
  }],
});
console.log('listo:', salida);
