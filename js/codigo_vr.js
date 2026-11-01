/* JARVIS · lee los códigos de verificación de los juegos VR (Enlace VR / CODEXIA)
 *
 * Es el mismo algoritmo de ITC-VR-Games/js/marcador.js (leerCodigo). Si se cambia allá, hay que
 * cambiarlo aquí. La app usa CONFIG.CLAVE_VR (js/config.js) y el Worker la variable CLAVE_VR.
 */

export const JUEGOS_VR = {
  1: 'Router humano', 2: 'Arma la computadora', 3: 'Carrera de palabras', 4: 'Robot programado', 5: 'Laboratorio NOC-7', 6: 'Programa al robot',
};
const LETRAS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function huella(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** null si no parece código; si no, { codigo, valido, juego, nombreJuego, equipo, puntaje, hora }. */
export function leerCodigoVR(codigo, clave = 'enlace-vr-2026') {
  const limpio = String(codigo).toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (!/^[0-9A-Z]{8}$/.test(limpio)) return null;
  let valor = 0;
  for (const c of limpio) {
    const d = LETRAS.indexOf(c);
    if (d < 0) return null;
    valor = valor * 32 + d;
  }
  const comprobacion = Math.floor(valor / 1073741824);
  const datos = ((valor % 1073741824) ^ (huella(`${clave}#${comprobacion}`) >>> 2)) >>> 0;
  const valido = huella(`${clave}|${datos}`) % 1024 === comprobacion;
  const minuto = datos % 2048;
  const puntaje = Math.floor(datos / 2048) % 4096;
  const equipo = Math.floor(datos / 2048 / 4096) % 16;
  const juego = Math.floor(datos / 2048 / 4096 / 16);
  const ok = valido && Boolean(JUEGOS_VR[juego]) && minuto < 1440;
  return {
    codigo: `${limpio.slice(0, 4)}-${limpio.slice(4)}`,
    valido: ok,
    juego: ok ? juego : null,
    nombreJuego: ok ? JUEGOS_VR[juego] : '',
    equipo: ok ? equipo : null,
    puntaje: ok ? puntaje : null,
    hora: ok ? `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}` : '',
  };
}
