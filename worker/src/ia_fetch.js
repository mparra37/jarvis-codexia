/* JARVIS · llamada a Claude por HTTP directo (versión para pegar en la página de Cloudflare)
 *
 * El editor de Cloudflare no instala paquetes de npm, así que esta versión llama a la API de
 * Claude con fetch. Hace lo mismo que ia.js (el SDK): mismo modelo, esfuerzo, respaldo si el modelo
 * rechaza (fallbacks) y un reintento si la IA está saturada.
 */
import { ErrorHttp } from './errores.js';

const URL_API = 'https://api.anthropic.com/v1/messages';

/** Devuelve la respuesta de Claude ({ stop_reason, content }) o lanza ErrorHttp. */
export async function llamarClaude(env, { system, mensajes }) {
  const modelo = env.MODELO || 'claude-opus-5-5';
  const cuerpo = {
    model: modelo,
    max_tokens: 2000,
    system,
    messages: mensajes,
    output_config: { effort: env.ESFUERZO || 'low' },
  };
  const headers = {
    'content-type': 'application/json',
    'x-api-key': env.ANTHROPIC_API_KEY,
    'anthropic-version': '2026-10-21',
  };
  // los modelos con clasificadores de seguridad pueden rechazar; "fallbacks" reintenta en otro modelo
  if (/^claude-(opus|fable)/.test(modelo) || modelo === 'claude-sonnet-5-5') {
    cuerpo.fallbacks = 'default';
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }

  for (let intento = 0; intento < 2; intento++) {
    let r;
    try {
      r = await fetch(URL_API, { method: 'POST', headers, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(25000) });
    } catch (e) {
      if (intento === 0) continue;
      throw new ErrorHttp(502, 'No se pudo conectar con la IA.');
    }
    const datos = await r.json().catch(() => ({}));
    if (r.ok) return datos;
    const detalle = (datos.error && datos.error.message) || '';
    // saturada o error del servidor: un reintento
    if ((r.status === 429 || r.status === 529 || r.status >= 500) && intento === 0) {
      await new Promise((listo) => setTimeout(listo, 1200));
      continue;
    }
    console.error('IA', r.status, detalle);
    if (r.status === 401 || r.status === 403) throw new ErrorHttp(503, 'La API key de la IA no es válida.');
    if (r.status === 429 || r.status === 529) throw new ErrorHttp(429, 'La IA está muy ocupada. Intenten en unos segundos.');
    if (r.status === 400) throw new ErrorHttp(502, 'La IA no pudo contestar esa pregunta.');
    throw new ErrorHttp(502, 'La IA no está disponible en este momento.');
  }
  throw new ErrorHttp(502, 'La IA no está disponible en este momento.');
}
