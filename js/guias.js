/* JARVIS · videos de ayuda (grabados de la app real) con sus pasos escritos
 *
 * Si el video no carga (sin internet la primera vez), se ven igual los pasos.
 * Los videos se graban con dev/grabar_videos.mjs.
 */
import { modal, esc } from './ui.js';

export const GUIAS = {
  bienvenida: {
    titulo: '¿Cómo funciona?',
    video: 'videos/bienvenida.mp4',
    pasos: [
      'Cada tarjeta del sobre es una pieza de su JARVIS.',
      'Toquen Escanear tarjeta y apunten al QR.',
      'Sigan las misiones: cuando tenga nombre, voz, forma y personalidad, ¡enciéndanlo!',
    ],
  },
  escanear: {
    titulo: 'Cómo escanear una tarjeta',
    video: 'videos/escanear.mp4',
    pasos: [
      'Toquen el botón Escanear tarjeta.',
      'Apunten la cámara al QR, como si le tomaran una foto, a un palmo de distancia.',
      'JARVIS cambia al instante. Toquen Listo y sigan con la siguiente misión.',
      '¿No abre la cámara? Toquen Escribir código y escriban el código de la esquina (V3, P1…).',
    ],
  },
  directiva: {
    titulo: 'Cómo armar la directiva principal',
    video: 'videos/directiva.mp4',
    pasos: [
      'Escaneen una tarjeta de PERSONALIDAD.',
      'Toquen una idea en cada fila: cómo habla, qué le encanta y qué nunca hace (o escriban la suya).',
      'Toquen Escuchar para oír cómo quedó y luego Listo.',
    ],
  },
  encender: {
    titulo: 'Cómo encender a JARVIS',
    video: 'videos/encender.mp4',
    pasos: [
      'Cuando tengan nombre, voz, forma y personalidad, aparece el botón INICIAR.',
      'Tóquenlo y suban el volumen: JARVIS arranca y se presenta.',
      'Después aparecen misiones nuevas para descubrir más cosas.',
    ],
  },
  pista: {
    titulo: 'Cómo pedir una pista en un taller',
    video: 'videos/pista.mp4',
    pasos: [
      'En Hablar toquen el botón 📍 y elijan el taller donde están.',
      'Toquen 💡 Pista: JARVIS les da una pista, nunca la respuesta.',
      'Si siguen atorados, pidan otra pista o pregúntenle con sus palabras.',
    ],
  },
};

/** Abre el reproductor de una guía: video arriba (sin sonido, en bucle) y los pasos abajo. */
export function verGuia(id, { alCerrar, decir } = {}) {
  const g = GUIAS[id];
  if (!g) return null;
  const m = modal(`<h2 style="margin-right:44px">📺 ${esc(g.titulo)}</h2>
    <div class="guia-video"><video src="${esc(g.video)}" autoplay muted loop playsinline preload="auto"></video></div>
    <ol class="guia-pasos">${g.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
    <div class="fila-botones">${decir ? '<button class="btn" data-leer>🔊 Escuchar</button>' : ''}<button class="btn btn-primario" data-ok style="flex:1">¡Entendido!</button></div>`,
  { clase: 'modal-guia', alCerrar });
  const video = m.el.querySelector('video');
  video.addEventListener('error', () => { video.closest('.guia-video').hidden = true; });
  m.el.querySelector('[data-ok]').addEventListener('click', m.cerrar);
  m.el.querySelector('[data-leer]')?.addEventListener('click', () => decir(g.pasos.join(' ')));
  return m;
}

/** Lista de todas las guías (botón de ayuda de arriba). */
export function menuGuias({ decir } = {}) {
  const m = modal(`<h2>Ayuda</h2>
    <div class="lista">${Object.entries(GUIAS).map(([id, g]) => `<button class="item guia-item" data-g="${id}">📺 <b>${esc(g.titulo)}</b></button>`).join('')}</div>`);
  m.el.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { m.cerrar(); verGuia(b.dataset.g, { decir }); }));
}
