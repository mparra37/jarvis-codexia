/* JARVIS · llamada a Claude con el SDK oficial (versión con terminal: npx wrangler deploy)
 *
 * La versión para pegar en la página de Cloudflare (sin npm) usa ia_fetch.js en su lugar: el
 * archivo cloudflare/worker.js se arma con worker/armar_pegable.mjs.
 */
import Anthropic from '@anthropic-ai/sdk';
import { ErrorHttp } from './errores.js';

/** Devuelve la respuesta de Claude ({ stop_reason, content }) o lanza ErrorHttp. */
export async function llamarClaude(env, { system, mensajes }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25000 });
  const modelo = env.MODELO || 'claude-opus-5-5';
  const parametros = {
    model: modelo,
    max_tokens: 2000,
    system,
    messages: mensajes,
    output_config: { effort: env.ESFUERZO || 'low' },
  };
  try {
    // los modelos con clasificadores de seguridad pueden rechazar; "fallbacks" reintenta en otro modelo
    if (/^claude-(opus|fable)/.test(modelo) || modelo === 'claude-sonnet-5-5') {
      return await client.beta.messages.create({ ...parametros, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    }
    return await client.messages.create(parametros);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ErrorHttp(503, 'La API key de la IA no es válida.');
    if (e instanceof Anthropic.RateLimitError) throw new ErrorHttp(429, 'La IA está muy ocupada. Intenten en unos segundos.');
    if (e instanceof Anthropic.BadRequestError) { console.error('IA 400', e.message); throw new ErrorHttp(502, 'La IA no pudo contestar esa pregunta.'); }
    if (e instanceof Anthropic.APIError) { console.error('IA', e.status, e.message); throw new ErrorHttp(502, 'La IA no está disponible en este momento.'); }
    throw new ErrorHttp(502, 'No se pudo conectar con la IA.');
  }
}
