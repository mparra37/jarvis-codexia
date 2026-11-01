/* JARVIS · llamadas al Worker */
import { urlApi } from './config.js';

export class ErrorApi extends Error {
  constructor(mensaje, status, datos) {
    super(mensaje);
    this.status = status;
    this.datos = datos || {};
  }
}

export const hayServidor = () => Boolean(urlApi());

/** Llama a la API. Lanza ErrorApi con status 0 si no hay servidor o no hay conexión. */
export async function llamar(metodo, ruta, cuerpo, { pin, timeout = 15000 } = {}) {
  const base = urlApi();
  if (!base) throw new ErrorApi('sin-servidor', 0);
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeout);
  try {
    const headers = {};
    if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
    if (pin) headers['X-Staff-Pin'] = pin;
    const r = await fetch(base + ruta, {
      method: metodo,
      headers,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: control.signal,
      cache: 'no-store',
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new ErrorApi(datos.error || `Error ${r.status}`, r.status, datos);
    return datos;
  } catch (e) {
    if (e instanceof ErrorApi) throw e;
    throw new ErrorApi('sin-conexion', 0);
  } finally {
    clearTimeout(reloj);
  }
}
