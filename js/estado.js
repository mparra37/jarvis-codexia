/* JARVIS · el JARVIS de este aparato
 *
 * Cada tablet (o celular) tiene su propio JARVIS, guardado solo en el aparato (localStorage). No hay
 * códigos de equipo ni sincronización: si el internet falla, nada cambia. El servidor solo se usa
 * para el Cerebro IA (estado.js no lo toca).
 */

const CLAVE = 'jarvis-local-v2';
const CLAVE_VIEJA = 'jarvis-equipo-v1';

/** Aplica un merge patch (RFC 7396): objetos se combinan, null borra, lo demás reemplaza. */
export function aplicarParche(destino, parche) {
  if (parche === null || typeof parche !== 'object' || Array.isArray(parche)) return parche;
  const salida = destino && typeof destino === 'object' && !Array.isArray(destino) ? { ...destino } : {};
  for (const [k, v] of Object.entries(parche)) {
    if (v === null) delete salida[k];
    else salida[k] = aplicarParche(salida[k], v);
  }
  return salida;
}

/** Identificador al azar de este aparato (el servidor lo usa para la batería diaria del Cerebro IA). */
export function dispositivo() {
  try {
    let id = localStorage.getItem('jarvis-dispositivo');
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('jarvis-dispositivo', id);
    }
    return id;
  } catch (e) {
    return 'sin-almacenamiento';
  }
}

export function equipoVacio(nombre) {
  return {
    nombre,
    jarvis: { nombre: 'JARVIS', lema: '' },
    voz: { id: 'V1', tono: null, velocidad: null, vozNombre: '' },
    nucleo: { id: 'N1', color: '#3fd0ff' },
    ambiente: { id: '' },
    personalidad: { id: '', habla: '', encanta: '', nunca: '' },
    memoria: { integrantes: [], prepa: '', dato: '' },
    escudo: { regla: '' },
    habilidades: {},
    instalados: {},
    bitacora: {},
    puntos: [],
    logros: {},
    estacion: null,
    encendido: null,
    creado: Date.now(),
  };
}

const oyentes = new Map();

export const estado = {
  equipo: null,

  on(evento, fn) {
    if (!oyentes.has(evento)) oyentes.set(evento, new Set());
    oyentes.get(evento).add(fn);
  },
  emitir(evento, datos) { (oyentes.get(evento) || []).forEach((fn) => fn(datos)); },

  cargar() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (guardado && guardado.equipo) this.equipo = guardado.equipo;
      else {
        // tablets que usaron la versión anterior (con servidor): conservar su JARVIS
        const viejo = JSON.parse(localStorage.getItem(CLAVE_VIEJA) || 'null');
        if (viejo && viejo.equipo) { this.equipo = viejo.equipo; this.guardar(); }
      }
    } catch (e) { /* nada guardado */ }
    return this.equipo;
  },

  guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify({ equipo: this.equipo })); } catch (e) { /* sin espacio */ }
  },

  crear(nombre) {
    this.equipo = equipoVacio(nombre);
    this.guardar();
    this.emitir('cambio');
    return this.equipo;
  },

  /** Borra el JARVIS de este aparato (para empezar de nuevo). */
  salir() {
    this.equipo = null;
    try { localStorage.removeItem(CLAVE); localStorage.removeItem(CLAVE_VIEJA); } catch (e) { /* nada */ }
    this.emitir('cambio');
  },

  cambiar(parche) {
    if (!this.equipo) return;
    this.equipo = aplicarParche(this.equipo, parche);
    this.guardar();
    this.emitir('cambio');
  },

  agregarPuntos(registro) {
    const r = { id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, t: Date.now(), ...registro };
    this.equipo.puntos = [...(this.equipo.puntos || []), r];
    this.guardar();
    this.emitir('cambio');
    return r;
  },

  borrarPuntos(id) {
    this.equipo.puntos = (this.equipo.puntos || []).filter((p) => p.id !== id);
    this.guardar();
    this.emitir('cambio');
  },
};
