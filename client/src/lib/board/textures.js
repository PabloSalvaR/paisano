// Texturas procedurales de la mesa, el mar y los terrenos (dibujadas en un lienzo, sin imágenes).
import { makeCanvas, mulberry32 } from './util.js';

function blobs(ctx, w, h, n, cols, rmin, rmax, alpha, r) {
  for (var i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.fillStyle = cols[Math.floor(r() * cols.length)];
    ctx.beginPath();
    var rr = rmin + r() * (rmax - rmin);
    ctx.ellipse(r() * w, r() * h, rr, rr * (0.55 + r() * 0.4), r() * 3.14, 0, 6.2832);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function terrainCanvas(kind) {
  var w = 256, c = makeCanvas(w, w), ctx = c.getContext('2d'), r = mulberry32(kind.length * 977 + 13), i, y, x;
  var base = { forest: '#3f8f45', pasture: '#a7d15c', fields: '#e8bf45', hills: '#c96a3b', mountains: '#8d949c', desert: '#e3c78d' }[kind];
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, w);
  if (kind === 'forest') blobs(ctx, w, w, 420, ['#2f7a3a', '#4aa050', '#357f3f', '#5cb05a'], 3, 14, 0.5, r);
  if (kind === 'pasture') blobs(ctx, w, w, 420, ['#95c44c', '#b8e06c', '#8bbb45', '#c6e98a'], 3, 16, 0.5, r);
  if (kind === 'fields') {
    for (i = 0; i < 26; i++) { ctx.fillStyle = i % 2 ? '#d9ab30' : '#f2cf64'; ctx.globalAlpha = 0.55; ctx.fillRect(0, i * 10, w, 5); }
    ctx.globalAlpha = 1; blobs(ctx, w, w, 200, ['#e0b23a', '#f6d777'], 2, 9, 0.35, r);
  }
  if (kind === 'hills') {
    for (i = 0; i < 22; i++) { ctx.strokeStyle = i % 2 ? '#b25428' : '#dc8355'; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.beginPath(); y = i * 12 + 6; ctx.moveTo(0, y); for (x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 26 + i) * 3); ctx.stroke(); }
    ctx.globalAlpha = 1; blobs(ctx, w, w, 260, ['#b85a30', '#d9794a', '#a9502c'], 2, 10, 0.4, r);
  }
  if (kind === 'mountains') blobs(ctx, w, w, 480, ['#7b828b', '#9fa6ae', '#6f757d', '#b3b9c0'], 2, 12, 0.5, r);
  if (kind === 'desert') {
    for (i = 0; i < 20; i++) { ctx.strokeStyle = i % 2 ? '#d2b16c' : '#f0dcaa'; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.beginPath(); y = i * 13 + 7; ctx.moveTo(0, y); for (x = 0; x <= w; x += 12) ctx.lineTo(x, y + Math.sin(x / 20 + i * 1.7) * 4); ctx.stroke(); }
    ctx.globalAlpha = 1; blobs(ctx, w, w, 220, ['#d8b97a', '#efd9a3', '#cfae6e'], 2, 9, 0.35, r);
  }
  return c;
}

export function woodCanvas(base, dark, light, seed) {
  var w = 512, c = makeCanvas(w, w), ctx = c.getContext('2d'), r = mulberry32(seed), i, x;
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, w);
  for (i = 0; i < 260; i++) {
    var y = r() * w, amp = 1 + r() * 4, ph = r() * 6, f = Math.floor(1 + r() * 3);
    ctx.strokeStyle = r() > 0.5 ? dark : light; ctx.globalAlpha = 0.08 + r() * 0.22; ctx.lineWidth = 0.6 + r() * 2.4;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / w * 6.2832 * f + ph) * amp);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return c;
}

export function waterCanvas() {
  var w = 512, c = makeCanvas(w, w), ctx = c.getContext('2d'), r = mulberry32(4242), i, x;
  // Fondo de un solo color (el promedio del degradado anterior). La textura se repite cada 4.2 unidades sobre el mar:
  // un degradado no encaja consigo mismo y dejaba costuras visibles en forma de "bloques".
  ctx.fillStyle = '#2881b3'; ctx.fillRect(0, 0, w, w);
  for (i = 0; i < 110; i++) {
    var y0 = r() * w, amp = 3 + r() * 7, f = Math.floor(2 + r() * 3), ph = r() * 6, len = 90 + r() * 200, x0 = r() * w;
    ctx.strokeStyle = r() > 0.45 ? '#a6dcf0' : '#1c6494';
    ctx.globalAlpha = 0.16 + r() * 0.22; ctx.lineWidth = 1.5 + r() * 2.5; ctx.lineCap = 'round';
    for (var dy = -w; dy <= w; dy += w) for (var dx = -w; dx <= w; dx += w) {
      ctx.beginPath();
      for (x = 0; x <= len; x += 10) {
        var px = x0 + x + dx, py = y0 + dy + Math.sin((x0 + x) / w * 6.2832 * f + ph) * amp;
        if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  return c;
}
