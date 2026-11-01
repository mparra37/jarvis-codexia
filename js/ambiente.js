/* JARVIS · ambientes: fondos animados de pantalla completa (sin imágenes)
 *
 * const a = new Ambiente(canvas); a.poner('desierto', '#3fd0ff'); a.modo('ultron' | null)
 * Se dibuja a ~30 cuadros por segundo y se pausa cuando la pestaña no está visible.
 */

function azar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rgba(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export class Ambiente {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.tipo = 'base';
    this.color = '#3fd0ff';
    this.modoActual = null;
    this.ultimo = 0;
    this.t0 = performance.now();
    this.ajustar();
    window.addEventListener('resize', () => this.ajustar());
    this.cuadro = this.cuadro.bind(this);
    requestAnimationFrame(this.cuadro);
  }

  ajustar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.preparar();
  }

  poner(tipo, color) {
    const cambio = tipo !== this.tipo;
    this.tipo = tipo || 'base';
    if (color) this.color = color;
    if (cambio) this.preparar();
  }

  modo(m) { this.modoActual = m; }

  preparar() {
    const r = azar(7);
    const { w, h } = this;
    this.estrellas = Array.from({ length: 220 }, () => ({ x: r() * w, y: r() * h, r: r() * 1.4 + 0.3, f: r() * 6 }));
    this.particulas = Array.from({ length: 50 }, () => ({ x: r() * w, y: r() * h, v: 0.2 + r() * 0.6, r: r() * 2 + 0.5 }));
    this.edificios = [0, 1].map((capa) => {
      const lista = [];
      let x = -20;
      while (x < w + 40) {
        const ancho = 40 + r() * 80;
        const alto = h * (capa ? 0.18 + r() * 0.3 : 0.25 + r() * 0.4);
        const ventanas = [];
        for (let vy = 12; vy < alto - 10; vy += 16) {
          for (let vx = 8; vx < ancho - 8; vx += 14) if (r() < 0.45) ventanas.push([vx, vy, r() * 10]);
        }
        lista.push({ x, ancho, alto, ventanas });
        x += ancho + 4 + r() * 10;
      }
      return lista;
    });
    const columnas = Math.ceil(w / 18);
    this.gotas = Array.from({ length: columnas }, () => ({ y: r() * h, v: 3 + r() * 6 }));
    this.lluvia = Array.from({ length: 160 }, () => ({ x: r() * w, y: r() * h, v: 8 + r() * 8 }));
    this.montanas = [0, 1, 2].map((k) => {
      const puntos = [];
      for (let x = 0; x <= w + 40; x += 40) puntos.push([x, h * (0.62 + k * 0.07) - r() * h * (0.12 - k * 0.03)]);
      return puntos;
    });
    this.saguaros = Array.from({ length: Math.max(3, Math.round(w / 260)) }, (_, i) => ({ x: (i + 0.3 + r() * 0.4) * (w / Math.max(3, Math.round(w / 260))), alto: h * (0.16 + r() * 0.12), brazos: r() }));
    this.rayo = { siguiente: 2, hasta: 0, camino: [] };
    if (this.tipo === 'codigo') { this.g.fillStyle = '#000'; this.g.fillRect(0, 0, w, h); }
  }

  cuadro(ahora) {
    requestAnimationFrame(this.cuadro);
    if (document.hidden || ahora - this.ultimo < 33) return;
    this.ultimo = ahora;
    const t = (ahora - this.t0) / 1000;
    const dibujo = DIBUJOS[this.tipo] || DIBUJOS.base;
    dibujo.call(this, this.g, this.w, this.h, t, this.color);
    if (this.modoActual === 'ultron') {
      const g = this.g;
      g.fillStyle = 'rgba(160,0,20,0.35)';
      g.fillRect(0, 0, this.w, this.h);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = `rgba(255,22,56,${Math.random() * 0.3})`;
        g.fillRect(0, Math.random() * this.h, this.w, Math.random() * 20);
      }
    }
  }
}

function degradado(g, w, h, paradas) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  paradas.forEach(([p, c]) => grad.addColorStop(p, c));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

const DIBUJOS = {
  base(g, w, h, t, color) {
    degradado(g, w, h, [[0, '#04101c'], [1, '#010306']]);
    const grad = g.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.6);
    grad.addColorStop(0, rgba(color, 0.12));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  },

  laboratorio(g, w, h, t, color) {
    DIBUJOS.base.call(this, g, w, h, t, color);
    const horizonte = h * 0.55;
    g.strokeStyle = rgba(color, 0.22);
    g.lineWidth = 1;
    for (let i = -20; i <= 20; i++) {
      g.beginPath();
      g.moveTo(w / 2 + i * 12, horizonte);
      g.lineTo(w / 2 + i * w * 0.12, h);
      g.stroke();
    }
    for (let k = 0; k < 14; k++) {
      const p = ((k + (t * 0.6) % 1) / 14);
      const y = horizonte + (h - horizonte) * p * p;
      g.strokeStyle = rgba(color, 0.05 + p * 0.25);
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    g.fillStyle = rgba(color, 0.5);
    for (const p of this.particulas) {
      p.y -= p.v;
      if (p.y < 0) { p.y = h; }
      g.beginPath(); g.arc(p.x + Math.sin(t + p.y * 0.01) * 10, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
  },

  galaxia(g, w, h, t) {
    degradado(g, w, h, [[0, '#05010f'], [1, '#000208']]);
    const nubes = [['#6b2dff', 0.3, 0.3], ['#ff3d9a', 0.75, 0.6], ['#2d9bff', 0.5, 0.85]];
    nubes.forEach(([c, x, y], i) => {
      const cx = w * (x + Math.sin(t * 0.05 + i) * 0.04);
      const cy = h * (y + Math.cos(t * 0.04 + i) * 0.04);
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.45);
      grad.addColorStop(0, rgba(c, 0.22));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
    for (const e of this.estrellas) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.2 + e.f));
      g.fillStyle = `rgba(255,255,255,${a})`;
      const x = (e.x + t * 4 * e.r) % w;
      g.fillRect(x, e.y, e.r, e.r);
    }
  },

  ciudad(g, w, h, t) {
    degradado(g, w, h, [[0, '#070a24'], [0.6, '#1b1040'], [1, '#2a1238']]);
    for (const e of this.estrellas.slice(0, 90)) {
      g.fillStyle = `rgba(255,255,255,${0.3 + 0.4 * Math.abs(Math.sin(t + e.f))})`;
      g.fillRect(e.x, e.y * 0.5, 1.2, 1.2);
    }
    g.fillStyle = '#f4f1de';
    g.shadowColor = '#f4f1de';
    g.shadowBlur = 30;
    g.beginPath(); g.arc(w * 0.82, h * 0.16, Math.min(w, h) * 0.05, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    [1, 0].forEach((k) => {
      for (const b of this.edificios[k]) {
        const x = b.x;
        g.fillStyle = k ? '#0f1230' : '#06081a';
        g.fillRect(x, h - b.alto, b.ancho, b.alto);
        if (!k) {
          for (const [vx, vy, f] of b.ventanas) {
            const prendida = Math.sin(t * 0.3 + f * 3) > -0.6;
            if (!prendida) continue;
            g.fillStyle = f > 7 ? 'rgba(120,220,255,0.75)' : 'rgba(255,214,120,0.75)';
            g.fillRect(x + vx, h - b.alto + vy, 6, 8);
          }
        }
      }
    });
  },

  codigo(g, w, h, t, color) {
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 0, w, h);
    g.font = '16px "Share Tech Mono", monospace';
    this.gotas.forEach((d, i) => {
      const ch = Math.random() < 0.5 ? '0' : '1';
      g.fillStyle = Math.random() < 0.08 ? '#ffffff' : rgba(color, 0.85);
      g.fillText(ch, i * 18, d.y);
      d.y += d.v * 2.2;
      if (d.y > h + 20 && Math.random() < 0.06) d.y = -20;
    });
  },

  desierto(g, w, h, t) {
    degradado(g, w, h, [[0, '#1b0c35'], [0.38, '#7a2a5a'], [0.6, '#ff6b3d'], [0.72, '#ffb347'], [1, '#ffb347']]);
    for (const e of this.estrellas.slice(0, 60)) {
      if (e.y > h * 0.3) continue;
      g.fillStyle = `rgba(255,255,255,${0.2 + 0.5 * Math.abs(Math.sin(t + e.f))})`;
      g.fillRect(e.x, e.y, 1.3, 1.3);
    }
    const sol = Math.min(w, h) * 0.13;
    const sy = h * 0.6 + Math.sin(t * 0.1) * 4;
    const grad = g.createRadialGradient(w * 0.5, sy, 0, w * 0.5, sy, sol * 2.4);
    grad.addColorStop(0, 'rgba(255,240,180,0.95)');
    grad.addColorStop(0.4, 'rgba(255,190,90,0.5)');
    grad.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(w * 0.5, sy, sol * 2.4, 0, Math.PI * 2); g.fill();
    const colores = ['#7a3352', '#4f1f3d', '#2a1128'];
    this.montanas.forEach((pts, k) => {
      g.fillStyle = colores[k];
      g.beginPath();
      g.moveTo(0, h);
      pts.forEach(([x, y]) => g.lineTo(x, y));
      g.lineTo(w, h);
      g.closePath();
      g.fill();
    });
    g.fillStyle = '#12060f';
    g.fillRect(0, h * 0.86, w, h * 0.14);
    for (const s of this.saguaros) {
      const base = h * 0.88;
      const ancho = s.alto * 0.13;
      g.fillStyle = '#12060f';
      const tronco = (x, y, an, al) => {
        g.beginPath();
        g.moveTo(x - an / 2, y);
        g.lineTo(x - an / 2, y - al + an / 2);
        g.arc(x, y - al + an / 2, an / 2, Math.PI, 0);
        g.lineTo(x + an / 2, y);
        g.fill();
      };
      tronco(s.x, base, ancho, s.alto);
      // brazos
      const ladoI = s.x - ancho * 1.4;
      g.fillRect(ladoI, base - s.alto * 0.45, ancho * 1.4, ancho * 0.7);
      tronco(ladoI + ancho * 0.35, base - s.alto * 0.45 + ancho * 0.7, ancho * 0.7, s.alto * (0.3 + s.brazos * 0.15));
      const ladoD = s.x;
      g.fillRect(ladoD, base - s.alto * 0.6, ancho * 1.4, ancho * 0.7);
      tronco(ladoD + ancho * 1.05, base - s.alto * 0.6 + ancho * 0.7, ancho * 0.7, s.alto * 0.25);
    }
  },

  tormenta(g, w, h, t) {
    degradado(g, w, h, [[0, '#0a0f1a'], [0.5, '#141c2b'], [1, '#05070c']]);
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 0.22 + t * 0.01) % 1.3) * w - w * 0.1;
      const grad = g.createRadialGradient(cx, h * 0.12, 0, cx, h * 0.12, w * 0.35);
      grad.addColorStop(0, 'rgba(70,80,105,0.5)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h * 0.6);
    }
    g.strokeStyle = 'rgba(170,200,255,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    for (const d of this.lluvia) {
      d.y += d.v;
      d.x -= d.v * 0.25;
      if (d.y > h) { d.y = -10; d.x = Math.random() * (w + 100); }
      g.moveTo(d.x, d.y);
      g.lineTo(d.x + 3, d.y - 14);
    }
    g.stroke();
    const r = this.rayo;
    if (t > r.siguiente) {
      r.hasta = t + 0.18;
      r.siguiente = t + 3 + Math.random() * 5;
      r.camino = [];
      let x = w * (0.2 + Math.random() * 0.6);
      for (let y = 0; y < h * 0.75; y += 25) { r.camino.push([x, y]); x += (Math.random() - 0.5) * 50; }
    }
    if (t < r.hasta) {
      g.fillStyle = 'rgba(200,220,255,0.18)';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e8f0ff';
      g.lineWidth = 3;
      g.shadowColor = '#9cc8ff';
      g.shadowBlur = 20;
      g.beginPath();
      r.camino.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.shadowBlur = 0;
    }
  },
};
