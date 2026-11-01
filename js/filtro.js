/* JARVIS · filtro de palabras
 *
 * Revisa los textos que escriben los equipos (nombres, lema, directiva). Lo usan la app (aviso
 * inmediato) y el Worker (la revisión que cuenta). Es una lista corta a propósito: el resto lo cuidan
 * las reglas fijas de la IA y el staff, que puede reiniciar un equipo.
 */

const PROHIBIDAS = [
  'pendej\\w*', 'put[oa]s?', 'putit[oa]s?', 'verga\\w*', 'ching\\w*', 'cabron\\w*', 'pinche\\w*', 'culer[oa]s?',
  'mamad\\w*', 'mamon\\w*', 'jot[oa]s?', 'maric\\w*', 'mierd\\w*', 'cono', 'porno\\w*', 'sexo\\w*', 'sexual\\w*',
  'nazi\\w*', 'hitler', 'estupid[oa]s?', 'idiota\\w*', 'imbecil\\w*', 'pito', 'pitos', 'nalg\\w*', 'pene\\w*',
  'vagina\\w*', 'tetas?', 'culo', 'culos', 'perra\\w*', 'zorra\\w*', 'naco\\w*', 'retrasad[oa]s?', 'malparid\\w*',
  'fuck\\w*', 'shit\\w*', 'bitch\\w*', 'ass', 'dick\\w*',
];

const REGEX = new RegExp(`(^|[^a-z0-9])(${PROHIBIDAS.join('|')})(?=$|[^a-z0-9])`, 'i');

/** Quita acentos y cambia números y símbolos que se usan para disfrazar letras. */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's')
    .replace(/7/g, 't').replace(/@/g, 'a').replace(/\$/g, 's')
    .replace(/(.)\1{2,}/g, '$1$1');
}

/** true si el texto se puede usar. */
export function textoLimpio(texto) {
  const n = normalizar(texto);
  return !REGEX.test(n) && !REGEX.test(n.replace(/(.)\1+/g, '$1'));
}

/** Revisa todos los textos de un objeto (recorre arreglos y objetos). Devuelve el primero que falla o ''. */
export function primerTextoSucio(valor) {
  if (typeof valor === 'string') return textoLimpio(valor) ? '' : valor;
  if (Array.isArray(valor)) {
    for (const v of valor) { const m = primerTextoSucio(v); if (m) return m; }
    return '';
  }
  if (valor && typeof valor === 'object') {
    for (const v of Object.values(valor)) { const m = primerTextoSucio(v); if (m) return m; }
  }
  return '';
}
