/* JARVIS · estado del equipo y sincronización con el Worker
 *
 * El equipo vive en este aparato (localStorage) y en el servidor (D1). Cada cambio se aplica aquí
 * al instante y se manda al servidor como "merge patch" (solo lo que cambió). Cada pocos segundos se
 * pide el equipo al servidor para ver lo que cambiaron los otros celulares del equipo.
 * Sin servidor o sin internet, todo sigue funcionando en el aparato y se manda después.
 */
import { llamar, hayServidor, ErrorApi } from './api.js';

const CLAVE = 'jarvis-equipo-v1';
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

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

function codigoNuevo() {
  let c = '';
  const azar = crypto.getRandomValues(new Uint32Array(4));
  for (let i = 0; i < 4; i++) c += LETRAS[azar[i] % LETRAS.length];
  return c;
}

export function equipoVacio(nombre, codigo) {
  return {
    codigo,
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
    encendido: null,
    creado: Date.now(),
  };
}

const oyentes = new Map();

export const estado = {
  equipo: null,
  registrado: false,
  pendiente: {},
  puntosPendientes: [],
  energia: null,
  global: { chatActivo: true, ia: false, anuncio: null },
  conexion: hayServidor() ? 'conectando' : 'sin-servidor',
  ultimoAnuncio: null,

  on(evento, fn) {
    if (!oyentes.has(evento)) oyentes.set(evento, new Set());
    oyentes.get(evento).add(fn);
  },
  emitir(evento, datos) { (oyentes.get(evento) || []).forEach((fn) => fn(datos)); },

  cargar() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (guardado && guardado.equipo) {
        this.equipo = guardado.equipo;
        this.registrado = Boolean(guardado.registrado);
        this.pendiente = guardado.pendiente || {};
        this.puntosPendientes = guardado.puntosPendientes || [];
        this.ultimoAnuncio = guardado.ultimoAnuncio || null;
      }
    } catch (e) { /* nada guardado */ }
    return this.equipo;
  },

  guardarLocal() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({
        equipo: this.equipo, registrado: this.registrado, pendiente: this.pendiente,
        puntosPendientes: this.puntosPendientes, ultimoAnuncio: this.ultimoAnuncio,
      }));
    } catch (e) { /* sin espacio */ }
  },

  /** Crea el equipo. Intenta registrarlo en el servidor; si no se puede, queda local y se reintenta. */
  async crear(nombre) {
    for (let intento = 0; intento < 4; intento++) {
      const codigo = codigoNuevo();
      const equipo = equipoVacio(nombre, codigo);
      if (!hayServidor()) {
        this.poner(equipo, false);
        return equipo;
      }
      try {
        const r = await llamar('PUT', `/api/equipos/${codigo}`, { equipo });
        this.poner(r.equipo, true);
        this.aplicarRespuesta(r);
        return r.equipo;
      } catch (e) {
        if (e.status === 409 && e.datos.motivo === 'existe') continue; // código repetido: otro
        if (e.status === 0) { this.poner(equipo, false); this.conexion = 'sin-conexion'; return equipo; }
        throw e;
      }
    }
    throw new ErrorApi('No se pudo crear el equipo. Intenta otra vez.', 500);
  },

  async unirse(codigo) {
    const r = await llamar('GET', `/api/equipos/${codigo.toUpperCase()}`);
    this.poner(r.equipo, true);
    this.aplicarRespuesta(r);
    return r.equipo;
  },

  poner(equipo, registrado) {
    this.equipo = equipo;
    this.registrado = registrado;
    this.pendiente = {};
    this.puntosPendientes = [];
    this.guardarLocal();
    this.emitir('cambio');
  },

  salir() {
    this.equipo = null;
    this.registrado = false;
    this.pendiente = {};
    this.puntosPendientes = [];
    try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
    this.emitir('cambio');
  },

  /** Cambia el equipo (merge patch) y lo manda al servidor. */
  cambiar(parche) {
    if (!this.equipo) return;
    this.equipo = aplicarParche(this.equipo, parche);
    this.pendiente = aplicarParche(this.pendiente, parche);
    // aplicarParche borra los null; en "pendiente" hay que conservarlos para que el servidor borre
    conservarNulos(this.pendiente, parche);
    this.guardarLocal();
    this.emitir('cambio');
    this.programar(700);
  },

  agregarPuntos(registro) {
    const r = { id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, t: Date.now(), ...registro };
    this.equipo.puntos = [...(this.equipo.puntos || []), { ...r, pendiente: true }];
    this.puntosPendientes.push(r);
    this.guardarLocal();
    this.emitir('cambio');
    this.programar(300);
    return r;
  },

  async borrarPuntos(id) {
    const esPendiente = this.puntosPendientes.some((p) => p.id === id);
    this.puntosPendientes = this.puntosPendientes.filter((p) => p.id !== id);
    this.equipo.puntos = (this.equipo.puntos || []).filter((p) => p.id !== id);
    this.guardarLocal();
    this.emitir('cambio');
    if (!esPendiente && this.registrado && hayServidor()) {
      await llamar('DELETE', `/api/equipos/${this.equipo.codigo}/puntos/${id}`).catch(() => {});
    }
  },

  programar(ms) {
    clearTimeout(this.reloj);
    this.reloj = setTimeout(() => this.sincronizar(), ms);
  },

  async sincronizar() {
    clearTimeout(this.reloj);
    if (!this.equipo) return;
    if (!hayServidor()) { this.conexion = 'sin-servidor'; this.emitir('conexion'); return; }
    if (this.sincronizando) { this.programar(500); return; }
    this.sincronizando = true;
    const codigo = this.equipo.codigo;
    try {
      if (!this.registrado) {
        try {
          const r = await llamar('PUT', `/api/equipos/${codigo}`, { equipo: { ...this.equipo, puntos: [] } });
          this.registrado = true;
          this.pendiente = {};
          this.aplicarRespuesta(r);
        } catch (e) {
          if (e.status === 409 && e.datos.motivo === 'existe') {
            // alguien más registró este código mientras estábamos sin internet: cambiamos el nuestro
            this.equipo = { ...this.equipo, codigo: codigoNuevo() };
            this.guardarLocal();
            this.emitir('cambio');
          }
          throw e;
        }
      }
      while (this.puntosPendientes.length) {
        const p = this.puntosPendientes[0];
        await llamar('POST', `/api/equipos/${codigo}/puntos`, p);
        this.puntosPendientes.shift();
        this.guardarLocal();
      }
      let r;
      if (Object.keys(this.pendiente).length) {
        const enviado = this.pendiente;
        this.pendiente = {};
        try {
          r = await llamar('PATCH', `/api/equipos/${codigo}`, { cambios: enviado });
        } catch (e) {
          this.pendiente = conservarNulos(aplicarParche(enviado, this.pendiente), enviado);
          throw e;
        }
      } else {
        r = await llamar('GET', `/api/equipos/${codigo}`);
      }
      this.aplicarRespuesta(r);
      this.conexion = 'ok';
    } catch (e) {
      if (e.status === 404 && this.registrado) {
        this.emitir('borrado');
      } else if (e.status === 400 || e.status === 422) {
        this.emitir('rechazo', e.message);
      }
      this.conexion = e.status === 0 ? 'sin-conexion' : (this.conexion === 'ok' ? 'ok' : 'sin-conexion');
    } finally {
      this.sincronizando = false;
      this.guardarLocal();
      this.emitir('conexion');
    }
  },

  aplicarRespuesta(r) {
    if (r.equipo && this.equipo && r.equipo.codigo === this.equipo.codigo) {
      // lo del servidor, con lo que todavía no se ha mandado encima
      let equipo = aplicarParche(r.equipo, this.pendiente);
      if (this.puntosPendientes.length) equipo = { ...equipo, puntos: [...(equipo.puntos || []), ...this.puntosPendientes.map((p) => ({ ...p, pendiente: true }))] };
      const antes = JSON.stringify(this.equipo);
      this.equipo = equipo;
      if (JSON.stringify(equipo) !== antes) this.emitir('cambio');
    }
    if (typeof r.energia === 'number') { this.energia = r.energia; this.emitir('energia'); }
    if (r.estado) {
      this.global = { ...this.global, ...r.estado };
      const a = r.estado.anuncio;
      if (a && a.id && a.id !== this.ultimoAnuncio) {
        const nuevo = this.ultimoAnuncio !== null || Date.now() - a.t < 3 * 60 * 1000;
        this.ultimoAnuncio = a.id;
        if (nuevo && Date.now() - a.t < 10 * 60 * 1000) this.emitir('anuncio', a);
      }
      this.emitir('global');
    }
  },

  /** Revisa al servidor cada "ms" mientras la página esté visible. */
  vigilar(ms = 6000) {
    clearInterval(this.intervalo);
    this.intervalo = setInterval(() => { if (!document.hidden) this.sincronizar(); }, ms);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.sincronizar(); });
    window.addEventListener('online', () => this.sincronizar());
  },
};

function conservarNulos(destino, parche) {
  if (!parche || typeof parche !== 'object' || Array.isArray(parche)) return destino;
  for (const [k, v] of Object.entries(parche)) {
    if (v === null) destino[k] = null;
    else if (typeof v === 'object' && !Array.isArray(v) && destino[k] && typeof destino[k] === 'object') conservarNulos(destino[k], v);
  }
  return destino;
}
