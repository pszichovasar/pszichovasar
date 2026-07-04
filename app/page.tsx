"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";

function shuffleWithSeed(arr: string[], seed: number): string[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const IMG_COUNT = 30;
const IMG_SIZE_DESKTOP = 60;
const IMG_SIZE_MOBILE = 20;
const getImgSize = () =>
  typeof window !== "undefined" && window.innerWidth <= 768
    ? IMG_SIZE_MOBILE
    : IMG_SIZE_DESKTOP;

const FLOATING_INIT = Array.from({ length: IMG_COUNT }, (_, i) => {
  const seed = i * 137 + 42;
  const r = (n: number) => ((seed * 1664525 + n * 1013904223) & 0x7fffffff) / 0x7fffffff;
  return {
    src: `/j${(i % 6) + 1}.jpg`,
    x: r(1) * 82 + 5,
    y: r(2) * 82 + 5,
    vx: (r(3) - 0.5) * 120,
    vy: (r(4) - 0.5) * 100,
    rotation: r(6) * 360,
    rotSpeed: (r(7) - 0.5) * 120,
    delay: r(8) * 400,
  };
});

type Vec2 = { x: number; y: number };

function getCorners(cx: number, cy: number, ang: number, S: number): Vec2[] {
  const h = S / 2, cos = Math.cos(ang), sin = Math.sin(ang);
  return [
    { x: cx + cos * (-h) - sin * (-h), y: cy + sin * (-h) + cos * (-h) },
    { x: cx + cos * (h) - sin * (-h), y: cy + sin * (h) + cos * (-h) },
    { x: cx + cos * (h) - sin * (h), y: cy + sin * (h) + cos * (h) },
    { x: cx + cos * (-h) - sin * (h), y: cy + sin * (-h) + cos * (h) },
  ];
}

function project(pts: Vec2[], ax: Vec2): [number, number] {
  let mn = Infinity, mx = -Infinity;
  for (const p of pts) {
    const d = p.x * ax.x + p.y * ax.y;
    if (d < mn) mn = d;
    if (d > mx) mx = d;
  }
  return [mn, mx];
}

function obbCollide(
  ax: number, ay: number, aAng: number,
  bx: number, by: number, bAng: number,
  S: number
): { overlap: number; nx: number; ny: number } | null {
  const cornersA = getCorners(ax, ay, aAng, S);
  const cornersB = getCorners(bx, by, bAng, S);
  const axes: Vec2[] = [
    { x: Math.cos(aAng), y: Math.sin(aAng) },
    { x: -Math.sin(aAng), y: Math.cos(aAng) },
    { x: Math.cos(bAng), y: Math.sin(bAng) },
    { x: -Math.sin(bAng), y: Math.cos(bAng) },
  ];
  let minOverlap = Infinity, minAxis: Vec2 = axes[0];
  for (const axis of axes) {
    const [a0, a1] = project(cornersA, axis);
    const [b0, b1] = project(cornersB, axis);
    const overlap = Math.min(a1, b1) - Math.max(a0, b0);
    if (overlap <= 0) return null;
    if (overlap < minOverlap) { minOverlap = overlap; minAxis = axis; }
  }
  const dx = ax - bx, dy = ay - by;
  const dot = dx * minAxis.x + dy * minAxis.y;
  const sign = dot < 0 ? -1 : 1;
  return { overlap: minOverlap, nx: minAxis.x * sign, ny: minAxis.y * sign };
}

// Тип для накопленных миниатюр узоров
type Thumbnail = {
  id: number;
  src: string;
  srcX: number; srcY: number; srcW: number; srcH: number;
  dstX: number; dstY: number; dstSize: number;
};

// Заливка как в Paint: линии-разделители создают области, flood-fill заливает каждую ярким цветом.
// Фон тоже получает случайный цвет. Белого и серого нет.
function buildColoredMosaic(
  trails: { x: number; y: number }[][],
  minX: number, minY: number,
  cropW: number, cropH: number
): string | null {
  const SIZE = 400;
  const scale = Math.min(SIZE / Math.max(cropW, cropH, 1), 4);
  const w = Math.max(4, Math.round(cropW * scale));
  const h = Math.max(4, Math.round(cropH * scale));

  const ALL: [number, number, number][] = [
    [255, 0, 60], [255, 80, 0], [255, 200, 0], [180, 255, 0],
    [0, 255, 80], [0, 255, 220], [0, 140, 255], [80, 0, 255],
    [200, 0, 255], [255, 0, 180], [255, 120, 120], [120, 255, 120],
    [120, 120, 255], [255, 220, 100], [100, 255, 220], [220, 100, 255],
  ];
  const COLORS = [...ALL].sort(() => Math.random() - 0.5);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  if (!trails.length || trails.every(t => t.length < 2)) {
    ctx.fillStyle = `rgb(${COLORS[0].join(',')})`;
    ctx.fillRect(0, 0, w, h);
    return canvas.toDataURL("image/png");
  }

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  // Рисуем разделители с учётом NaN разрывов и quadratic curves
  const drawTrails = (strokeColor: string, lineW: number) => {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    trails.forEach(trail => {
      if (trail.length < 2) return;
      ctx.beginPath();
      let penDown = false;
      let prevX = 0, prevY = 0;
      for (let j = 0; j < trail.length; j++) {
        const p = trail[j];
        if (isNaN(p.x)) {
          if (penDown) { ctx.stroke(); ctx.beginPath(); penDown = false; }
          continue;
        }
        const sx = (p.x - minX) * scale;
        const sy = (p.y - minY) * scale;
        if (!penDown) {
          ctx.moveTo(sx, sy);
          prevX = sx; prevY = sy;
          penDown = true;
        } else {
          const mx = (prevX + sx) / 2;
          const my = (prevY + sy) / 2;
          ctx.quadraticCurveTo(prevX, prevY, mx, my);
          prevX = sx; prevY = sy;
        }
      }
      if (penDown) ctx.stroke();
    });
  };



  // Разделители — как в оригинале
  drawTrails("#000", Math.max(2.5, 2.5 * scale));

  // Края canvas
  ctx.fillStyle = "#000";
  const bw = Math.max(2, Math.round(2 * scale));
  ctx.fillRect(0, 0, w, bw); ctx.fillRect(0, h - bw, w, bw);
  ctx.fillRect(0, 0, bw, h); ctx.fillRect(w - bw, 0, bw, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const n = w * h;
  const isBorder = (i: number) => data[i * 4] < 180;
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  const recentColors: number[] = [];

  for (let start = 0; start < n; start++) {
    if (visited[start] || isBorder(start)) continue;
    let ci = Math.floor(Math.random() * COLORS.length);
    for (let attempt = 0; attempt < 8; attempt++) {
      if (!recentColors.includes(ci)) break;
      ci = Math.floor(Math.random() * COLORS.length);
    }
    recentColors.push(ci); if (recentColors.length > 4) recentColors.shift();
    const [cr, cg, cb] = COLORS[ci];
    let qH = 0, qT = 0;
    queue[qT++] = start; visited[start] = 1;
    while (qH < qT) {
      const idx = queue[qH++];
      const o = idx * 4;
      data[o] = cr; data[o + 1] = cg; data[o + 2] = cb; data[o + 3] = 255;
      const x = idx % w, y = (idx / w) | 0;
      if (x > 0) { const nb = idx - 1; if (!visited[nb] && !isBorder(nb)) { visited[nb] = 1; queue[qT++] = nb; } }
      if (x < w - 1) { const nb = idx + 1; if (!visited[nb] && !isBorder(nb)) { visited[nb] = 1; queue[qT++] = nb; } }
      if (y > 0) { const nb = idx - w; if (!visited[nb] && !isBorder(nb)) { visited[nb] = 1; queue[qT++] = nb; } }
      if (y < h - 1) { const nb = idx + w; if (!visited[nb] && !isBorder(nb)) { visited[nb] = 1; queue[qT++] = nb; } }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Тонкие чёрные линии поверх — точный контур
  drawTrails("#000", Math.max(0.3, 0.3 * scale));

  return canvas.toDataURL("image/png");
}

// Реальные созвездия — нормализованные координаты [0..1] и линии между звёздами
const CONSTELLATIONS: {
  name: string;
  stars: [number, number][];
  lines: [number, number][];
}[] = [
    { name: "Orion", stars: [[0.42, 0.08], [0.60, 0.10], [0.28, 0.28], [0.52, 0.24], [0.74, 0.26], [0.38, 0.50], [0.66, 0.48], [0.30, 0.72], [0.44, 0.80], [0.58, 0.80], [0.72, 0.72]], lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6], [5, 7], [6, 10], [7, 8], [8, 9], [9, 10]] },
    { name: "Ursa Major", stars: [[0.08, 0.72], [0.20, 0.58], [0.34, 0.50], [0.48, 0.54], [0.62, 0.40], [0.74, 0.24], [0.88, 0.18], [0.30, 0.30], [0.18, 0.22], [0.10, 0.38]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [2, 7], [7, 8], [8, 9], [9, 2]] },
    { name: "Cassiopeia", stars: [[0.08, 0.42], [0.26, 0.22], [0.50, 0.36], [0.72, 0.14], [0.92, 0.30]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    { name: "Leo", stars: [[0.14, 0.62], [0.22, 0.38], [0.36, 0.20], [0.52, 0.28], [0.62, 0.42], [0.50, 0.56], [0.76, 0.58], [0.88, 0.46], [0.32, 0.70]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [3, 6], [6, 7], [5, 8]] },
    { name: "Scorpius", stars: [[0.32, 0.08], [0.44, 0.16], [0.52, 0.26], [0.56, 0.38], [0.52, 0.50], [0.44, 0.60], [0.38, 0.70], [0.34, 0.80], [0.42, 0.88], [0.54, 0.86], [0.62, 0.76], [0.20, 0.30], [0.14, 0.42]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [0, 11], [11, 12]] },
    { name: "Cygnus", stars: [[0.50, 0.06], [0.50, 0.28], [0.50, 0.54], [0.50, 0.80], [0.16, 0.30], [0.84, 0.30], [0.30, 0.20], [0.70, 0.20]], lines: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5], [4, 6], [5, 7]] },
    { name: "Lyra", stars: [[0.50, 0.10], [0.34, 0.32], [0.42, 0.54], [0.58, 0.54], [0.66, 0.32], [0.38, 0.72], [0.62, 0.72]], lines: [[0, 1], [0, 4], [1, 2], [2, 3], [3, 4], [1, 4], [2, 5], [3, 6], [5, 6]] },
    { name: "Boötes", stars: [[0.50, 0.08], [0.36, 0.24], [0.28, 0.46], [0.36, 0.66], [0.50, 0.74], [0.64, 0.66], [0.72, 0.46], [0.64, 0.24], [0.42, 0.42], [0.58, 0.42]], lines: [[0, 1], [0, 7], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [1, 8], [7, 9], [8, 9], [8, 3], [9, 5]] },
    { name: "Perseus", stars: [[0.50, 0.06], [0.40, 0.18], [0.28, 0.34], [0.20, 0.50], [0.30, 0.60], [0.44, 0.52], [0.58, 0.42], [0.68, 0.26], [0.60, 0.66], [0.72, 0.74], [0.56, 0.80]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 1], [5, 8], [8, 9], [8, 10], [0, 6]] },
    { name: "Gemini", stars: [[0.28, 0.08], [0.46, 0.08], [0.22, 0.22], [0.42, 0.22], [0.20, 0.38], [0.40, 0.38], [0.18, 0.56], [0.38, 0.56], [0.22, 0.72], [0.42, 0.70], [0.30, 0.86], [0.50, 0.84]], lines: [[0, 2], [2, 4], [4, 6], [6, 8], [8, 10], [1, 3], [3, 5], [5, 7], [7, 9], [9, 11], [0, 1], [6, 7]] },
    { name: "Aquila", stars: [[0.50, 0.12], [0.40, 0.30], [0.50, 0.44], [0.60, 0.30], [0.26, 0.50], [0.74, 0.50], [0.36, 0.66], [0.64, 0.66], [0.50, 0.80]], lines: [[0, 1], [0, 3], [1, 2], [2, 3], [1, 4], [3, 5], [4, 6], [5, 7], [2, 8]] },
    { name: "Taurus", stars: [[0.50, 0.08], [0.38, 0.20], [0.26, 0.34], [0.18, 0.50], [0.62, 0.20], [0.74, 0.34], [0.82, 0.50], [0.44, 0.50], [0.56, 0.50], [0.50, 0.68], [0.38, 0.80], [0.62, 0.80]], lines: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [1, 7], [4, 8], [7, 8], [7, 9], [8, 9], [9, 10], [9, 11]] },
    { name: "Virgo", stars: [[0.50, 0.06], [0.38, 0.18], [0.26, 0.28], [0.20, 0.44], [0.28, 0.58], [0.44, 0.64], [0.56, 0.64], [0.72, 0.58], [0.80, 0.44], [0.74, 0.28], [0.62, 0.18], [0.44, 0.80], [0.56, 0.80]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 0], [5, 11], [6, 12], [11, 12]] },
    { name: "Sagittarius", stars: [[0.50, 0.10], [0.36, 0.22], [0.28, 0.38], [0.36, 0.54], [0.50, 0.60], [0.64, 0.54], [0.72, 0.38], [0.64, 0.22], [0.42, 0.76], [0.58, 0.76], [0.30, 0.70], [0.70, 0.70]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [3, 10], [5, 11], [4, 8], [4, 9], [8, 9], [10, 11]] },
    { name: "Andromeda", stars: [[0.50, 0.10], [0.38, 0.24], [0.28, 0.40], [0.20, 0.58], [0.62, 0.22], [0.72, 0.36], [0.80, 0.52], [0.44, 0.70], [0.34, 0.82]], lines: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [2, 7], [7, 8]] },
    { name: "Hercules", stars: [[0.50, 0.08], [0.36, 0.20], [0.26, 0.36], [0.32, 0.52], [0.44, 0.60], [0.56, 0.60], [0.68, 0.52], [0.74, 0.36], [0.64, 0.20], [0.40, 0.76], [0.60, 0.76], [0.30, 0.86], [0.70, 0.86]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0], [3, 9], [6, 10], [9, 11], [10, 12], [4, 5]] },
  ];

function generateConstellationPoints(
  seed: number,
  W: number, H: number,
  _mouseX: number, _mouseY: number
): { x: number; y: number }[] {
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };

  // Каждый раз разное созвездие на основе seed
  const idx = Math.floor(rng() * CONSTELLATIONS.length);
  const constellation = CONSTELLATIONS[idx];

  const cx = W * 0.5;
  const cy = H * 0.5;
  const size = Math.min(W, H) * 0.72;

  const screenStars = constellation.stars.map(([nx, ny]) => ({
    x: cx + (nx - 0.5) * size,
    y: cy + (ny - 0.5) * size,
  }));

  const pts: { x: number; y: number }[] = [];
  const usedEdges = new Set<string>();
  const edges = constellation.lines;
  const edgeKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
  const getNeighbors = (node: number) =>
    edges.filter(([a, b]) => (a === node || b === node) && !usedEdges.has(edgeKey(a, b)))
      .map(([a, b]) => a === node ? b : a);

  const STEPS = 30; // много точек между звёздами = плавная линия
  const interpolate = (from: { x: number, y: number }, to: { x: number, y: number }) => {
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      pts.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    }
  };

  let cur = 0;
  pts.push(screenStars[cur]);

  let safety = 0;
  while (usedEdges.size < edges.length && safety++ < 500) {
    const neighbors = getNeighbors(cur);
    if (neighbors.length === 0) {
      // Ищем вершину с доступными рёбрами
      let found = false;
      for (const [a, b] of edges) {
        if (!usedEdges.has(edgeKey(a, b))) {
          interpolate(screenStars[cur], screenStars[a]);
          cur = a;
          found = true;
          break;
        }
      }
      if (!found) break;
      continue;
    }
    const next = neighbors[0];
    usedEdges.add(edgeKey(cur, next));
    interpolate(screenStars[cur], screenStars[next]);
    cur = next;
  }

  return pts;
}

// Реальные 3D фигуры — вершины и рёбра в 3D, проецируются на 2D
// 4D политопы — вершины в 4D пространстве и рёбра между ними
// Проекция: 4D → 3D (стереографическая) → 2D (перспективная)

// 8-cell (Tesseract) — 16 вершин, 32 ребра
function makeTesseract() {
  const verts: number[][] = [];
  for (let x of [-1, 1]) for (let y of [-1, 1]) for (let z of [-1, 1]) for (let w of [-1, 1])
    verts.push([x, y, z, w]);
  const edges: [number, number][] = [];
  for (let i = 0; i < 16; i++)
    for (let j = i + 1; j < 16; j++) {
      let diff = 0;
      for (let k = 0; k < 4; k++) if (verts[i][k] !== verts[j][k]) diff++;
      if (diff === 1) edges.push([i, j]);
    }
  return { name: "Tesseract (8-cell)", verts, edges };
}

// 16-cell — 8 вершин, 24 ребра (все пары кроме противоположных)
function make16Cell() {
  const verts: number[][] = [
    [1, 0, 0, 0], [-1, 0, 0, 0], [0, 1, 0, 0], [0, -1, 0, 0],
    [0, 0, 1, 0], [0, 0, -1, 0], [0, 0, 0, 1], [0, 0, 0, -1],
  ];
  const edges: [number, number][] = [];
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++) {
      const dot = verts[i].reduce((s, v, k) => s + v * verts[j][k], 0);
      if (dot === 0) edges.push([i, j]); // перпендикулярные = соединены
    }
  return { name: "16-cell", verts, edges };
}

// 24-cell — 24 вершины (все перестановки ±1,±1,0,0), 96 рёбер
function make24Cell() {
  const verts: number[][] = [];
  const perms = [[0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0]];
  for (const p of perms)
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      const v = [0, 0, 0, 0];
      v[p[0]] = s1; v[p[1]] = s2;
      // Проверяем дубликаты
      if (!verts.some(u => u.every((x, i) => x === v[i]))) verts.push(v);
    }
  const edges: [number, number][] = [];
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++) {
      const d2 = verts[i].reduce((s, v, k) => s + (v - verts[j][k]) ** 2, 0);
      if (Math.abs(d2 - 2) < 0.001) edges.push([i, j]); // ребро длины √2
    }
  return { name: "24-cell", verts, edges };
}

// 600-cell approximation — икосаэдрическая симметрия в 4D, 120 вершин
function make600Cell() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts: number[][] = [];
  // Перестановки (±1, ±1, ±1, ±1) / 2
  for (let a of [-1, 1]) for (let b of [-1, 1]) for (let c of [-1, 1]) for (let d of [-1, 1])
    verts.push([a / 2, b / 2, c / 2, d / 2]);
  // Чётные перестановки (0, ±1, ±φ, ±1/φ) / 2
  const vals = [[0, 1, phi, 1 / phi], [0, 1, -phi, 1 / phi], [0, 1, phi, -1 / phi],
  [0, -1, phi, 1 / phi], [0, 1, -phi, -1 / phi], [0, -1, phi, -1 / phi],
  [0, -1, -phi, 1 / phi], [0, -1, -phi, -1 / phi]];
  for (const [a, b, c, d] of vals) {
    // Все чётные перестановки 4 элементов
    for (const perm of [[a, b, c, d], [b, c, d, a], [c, d, a, b], [d, a, b, c],
    [a, c, b, d], [b, d, a, c], [c, a, d, b], [d, b, c, a],
    [a, d, c, b], [b, a, d, c], [c, b, a, d], [d, c, b, a]])
      if (!verts.some(u => u.every((x, i) => Math.abs(x - perm[i] / 2) < 0.001)))
        verts.push(perm.map(x => x / 2));
  }
  // Берём только первые 120 вершин и строим рёбра длины 1/φ
  const v120 = verts.slice(0, 120);
  const edgeLen = 1 / phi;
  const edges: [number, number][] = [];
  for (let i = 0; i < v120.length; i++)
    for (let j = i + 1; j < v120.length; j++) {
      const d2 = v120[i].reduce((s, v, k) => s + (v - v120[j][k]) ** 2, 0);
      if (Math.abs(d2 - edgeLen * edgeLen) < 0.02) edges.push([i, j]);
    }
  return { name: "600-cell (partial)", verts: v120, edges: edges.slice(0, 300) };
}

// 120-cell — двойственный к 600-cell, 600 вершин (упрощённая версия)
function make120Cell() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts: number[][] = [];
  // Подмножество вершин через φ-based координаты
  const coords = [1, phi, 1 / phi, 0];
  for (const a of coords) for (const b of coords) for (const c of coords) for (const d of coords) {
    if (Math.abs(a * a + b * b + c * c + d * d - (1 + phi * phi + 1 / (phi * phi))) < 0.1)
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) for (const sc of [-1, 1]) for (const sd of [-1, 1]) {
        const v = [sa * a, sb * b, sc * c, sd * d];
        const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        if (Math.abs(norm - Math.sqrt(8)) < 0.01)
          if (!verts.some(u => u.every((x, i) => Math.abs(x - v[i]) < 0.001)))
            verts.push(v);
      }
  }
  const v = verts.slice(0, 80);
  const edges: [number, number][] = [];
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++) {
      const d2 = v[i].reduce((s, x, k) => s + (x - v[j][k]) ** 2, 0);
      if (d2 < 2.5 && d2 > 0.1) edges.push([i, j]);
    }
  return { name: "120-cell (partial)", verts: v, edges: edges.slice(0, 200) };
}

// Проекция 4D → 2D: сначала стереографическая 4D→3D, потом перспективная 3D→2D
function project4D(
  v4: number[], rotXY: number, rotXZ: number, rotXW: number,
  scale: number, cx: number, cy: number
): { x: number; y: number } {
  // Поворот в 4D (плоскость XY)
  const c1 = Math.cos(rotXY), s1 = Math.sin(rotXY);
  let [x, y, z, w] = v4;
  const x1 = x * c1 - y * s1, y1 = x * s1 + y * c1;
  // Поворот в плоскости XZ
  const c2 = Math.cos(rotXZ), s2 = Math.sin(rotXZ);
  const x2 = x1 * c2 - z * s2, z2 = x1 * s2 + z * c2;
  // Поворот в плоскости XW
  const c3 = Math.cos(rotXW), s3 = Math.sin(rotXW);
  const x3 = x2 * c3 - w * s3, w3 = x2 * s3 + w * c3;
  // Стереографическая проекция 4D→3D
  const fov4 = 2.5;
  const p4 = fov4 / (fov4 - w3);
  const px = x3 * p4, py = y1 * p4, pz = z2 * p4;
  // Перспективная проекция 3D→2D
  const fov3 = 3.5;
  const p3 = fov3 / (fov3 + pz);
  return { x: cx + px * scale * p3, y: cy + py * scale * p3 };
}

// Аттрактор Лоренца — хаотическая траектория в 3D
function makeLorenzAttractor(): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  let x = 0.1, y = 0, z = 0;
  const sigma = 10, rho = 28, beta = 8 / 3, dt = 0.005;
  for (let i = 0; i < 8000; i++) {
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (i > 500) pts.push({ x, y, z }); // пропускаем начальный переходный процесс
  }
  return pts;
}

// Двойная спираль ДНК
function makeDNAHelix(): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const turns = 5, steps = 600;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * Math.PI * 2;
    const z = (i / steps) * 4 - 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t), z });
  }
  // Вторая нить со смещением π
  for (let i = steps; i >= 0; i--) {
    const t = (i / steps) * turns * Math.PI * 2 + Math.PI;
    const z = (i / steps) * 4 - 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t), z });
  }
  // Перекладины
  for (let i = 0; i <= turns * 4; i++) {
    const t = (i / (turns * 4)) * turns * Math.PI * 2;
    const z = (i / (turns * 4)) * 4 - 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t), z });
    pts.push({ x: Math.cos(t + Math.PI), y: Math.sin(t + Math.PI), z });
    pts.push({ x: Math.cos(t), y: Math.sin(t), z });
  }
  return pts;
}

// Тор (бублик)
function makeTorusKnot(p: number, q: number): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const steps = 800;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = Math.cos(q * t) + 2;
    pts.push({
      x: r * Math.cos(p * t),
      y: r * Math.sin(p * t),
      z: -Math.sin(q * t),
    });
  }
  return pts;
}

// Кривые Лиссажу в 3D
function makeLissajous3D(a: number, b: number, c: number, delta: number): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const steps = 1000;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({
      x: Math.sin(a * t + delta),
      y: Math.sin(b * t),
      z: Math.sin(c * t + delta * 0.5),
    });
  }
  return pts;
}

// Спираль Фибоначчи в 3D (Золотой угол)
function makeFibonacciSpiral(): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const n = 500, golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const t = i * golden;
    const r = Math.sqrt(i / n);
    pts.push({ x: r * Math.cos(t), y: i / n * 2 - 1, z: r * Math.sin(t) });
  }
  // Соединяем точки по порядку — спираль
  return pts;
}

// Проецируем массив 3D точек в 2D
function project3DPoints(
  pts3d: { x: number; y: number; z: number }[],
  rotX: number, rotY: number,
  scale: number, cx: number, cy: number
): { x: number; y: number }[] {
  return pts3d.map(({ x, y, z }) => {
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const x1 = x * cosY - z * sinY, z1 = x * sinY + z * cosY;
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const y1 = y * cosX - z1 * sinX, z2 = y * sinX + z1 * cosX;
    const fov = 5 / (5 + z2);
    return { x: cx + x1 * scale * fov, y: cy + y1 * scale * fov };
  });
}

// Генерирует контурные точки текста через canvas
function generateTextPoints(text: string, W: number, H: number): { x: number; y: number }[] {
  const SCALE = 4;
  const cW = W * SCALE, cH = H * SCALE;
  const offscreen = document.createElement("canvas");
  offscreen.width = cW; offscreen.height = cH;
  const ctx = offscreen.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cW, cH);

  const lines = ["I DO", "DESIGN"];
  let fontSize = cW * 0.30;
  ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  while (ctx.measureText(lines[1]).width > cW * 0.86 && fontSize > 20) {
    fontSize *= 0.92;
    ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  }

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineH = fontSize * 1.15;
  lines.forEach((line, i) => ctx.fillText(line, cW / 2, cH / 2 - lineH / 2 + i * lineH));

  const imgData = ctx.getImageData(0, 0, cW, cH);
  const data = imgData.data;
  const pts: { x: number; y: number }[] = [];
  const step = SCALE * 2;
  for (let y = step; y < cH - step; y += step) {
    for (let x = step; x < cW - step; x += step) {
      const gx =
        -data[((y - step) * cW + (x - step)) * 4] - 2 * data[((y) * cW + (x - step)) * 4] - data[((y + step) * cW + (x - step)) * 4]
        + data[((y - step) * cW + (x + step)) * 4] + 2 * data[((y) * cW + (x + step)) * 4] + data[((y + step) * cW + (x + step)) * 4];
      const gy =
        -data[((y - step) * cW + (x - step)) * 4] - 2 * data[((y - step) * cW + (x)) * 4] - data[((y - step) * cW + (x + step)) * 4]
        + data[((y + step) * cW + (x - step)) * 4] + 2 * data[((y + step) * cW + (x)) * 4] + data[((y + step) * cW + (x + step)) * 4];
      if (Math.sqrt(gx * gx + gy * gy) > 50) pts.push({ x: x / SCALE, y: y / SCALE });
    }
  }
  // Змейка по строкам
  const ss = step / SCALE;
  pts.sort((a, b) => {
    const ra = Math.floor(a.y / ss), rb = Math.floor(b.y / ss);
    if (ra !== rb) return ra - rb;
    return ra % 2 === 0 ? a.x - b.x : b.x - a.x;
  });
  return pts;
}

// Знаменитые картины как векторные контуры — нормализованные координаты [0..1]
// Каждый массив — один непрерывный путь пера
async function generateArtworkPoints(url: string, W: number, H: number): Promise<{ x: number, y: number }[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const SCALE = 0.5;
      const cW = Math.round(W * SCALE), cH = Math.round(H * SCALE);
      const imgScale = Math.min(cW / img.width, cH / img.height) * 0.90;
      const sw = Math.round(img.width * imgScale), sh = Math.round(img.height * imgScale);
      const ox = Math.round((cW - sw) / 2), oy = Math.round((cH - sh) / 2);
      const canvas = document.createElement("canvas");
      canvas.width = cW; canvas.height = cH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cW, cH);
      ctx.drawImage(img, ox, oy, sw, sh);
      const { data } = ctx.getImageData(0, 0, cW, cH);

      // S=2 — вдвое быстрее, достаточно деталей
      const S = 2;
      const edgePts: { x: number, y: number, m: number }[] = [];
      let maxMag = 0;
      for (let y = S; y < cH - S; y += S) {
        for (let x = S; x < cW - S; x += S) {
          const g = (px: number, py: number) => { const o = (Math.min(py, cH - 1) * cW + Math.min(px, cW - 1)) * 4; return data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114; };
          const gx = -g(x - S, y - S) - 2 * g(x - S, y) - g(x - S, y + S) + g(x + S, y - S) + 2 * g(x + S, y) + g(x + S, y + S);
          const gy = -g(x - S, y - S) - 2 * g(x, y - S) - g(x + S, y - S) + g(x - S, y + S) + 2 * g(x, y + S) + g(x + S, y + S);
          const m = Math.sqrt(gx * gx + gy * gy);
          if (m > maxMag) maxMag = m;
          edgePts.push({ x, y, m });
        }
      }
      const threshold = maxMag * 0.13;
      const strong = edgePts.filter(p => p.m > threshold);
      strong.sort((a, b) => b.m - a.m);
      const top = strong.slice(0, 60000);
      if (top.length < 10) { resolve([]); return; }

      const STEP = S;
      const grid = new Map<string, number>();
      top.forEach((p, i) => grid.set(Math.round(p.x / STEP) + ',' + Math.round(p.y / STEP), i));
      const used = new Set<number>();
      const result: { x: number, y: number }[] = [];
      const invScale = 1 / SCALE;
      const offX = (W - cW * invScale) / 2, offY = (H - cH * invScale) / 2;

      for (let si = 0; si < top.length; si++) {
        if (used.has(si)) continue;
        const stroke: { x: number, y: number }[] = [];
        let cur = si;
        while (cur !== -1 && !used.has(cur)) {
          used.add(cur);
          stroke.push({ x: top[cur].x * invScale + offX, y: top[cur].y * invScale + offY });
          let next = -1, bestD = Infinity;
          const gx0 = Math.round(top[cur].x / STEP), gy0 = Math.round(top[cur].y / STEP);
          for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
            if (!dr && !dc) continue;
            const ni = grid.get((gx0 + dc) + ',' + (gy0 + dr));
            if (ni !== undefined && !used.has(ni)) { const d = (top[ni].x - top[cur].x) ** 2 + (top[ni].y - top[cur].y) ** 2; if (d < bestD) { bestD = d; next = ni; } }
          }
          cur = bestD < (STEP * 3) ** 2 ? next : -1;
        }
        if (stroke.length >= 3) { result.push(...stroke, { x: NaN, y: NaN }); }
        if (result.length > 100000) break;
      }
      resolve(result);
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}

const ARTWORKS = ["/art1.png", "/art2.png", "/art3.png", "/art4.png", "/art5.png", "/art6.png", "/art7.png", "/art8.png", "/art9.png", "/art10.png"];

// Спираль на торе — линия обвивает бублик p раз по большому кругу и q по малому
function makeTorusSpiral(R: number, r: number, p: number, q: number): { x: number, y: number, z: number }[] {
  const pts = [];
  for (let i = 0; i <= 800; i++) {
    const t = (i / 800) * Math.PI * 2 * p;
    const phi = t * q / p;
    pts.push({
      x: (R + r * Math.cos(phi)) * Math.cos(t),
      y: (R + r * Math.cos(phi)) * Math.sin(t),
      z: r * Math.sin(phi),
    });
  }
  return pts;
}

// Клейновская бутылка — 4D объект проецированный в 3D
function makeKleinBottle(): { x: number, y: number, z: number }[] {
  const pts = [];
  const U = 40, V = 40;
  for (let ui = 0; ui <= U; ui++) {
    const u = (ui / U) * Math.PI * 2;
    for (let vi = 0; vi <= V; vi++) {
      const v = (vi / V) * Math.PI * 2;
      let x, y, z;
      if (u < Math.PI) {
        x = 3 * Math.cos(u) * (1 + Math.sin(u)) + (2 * (1 - Math.cos(u) / 2)) * Math.cos(u) * Math.cos(v);
        y = 8 * Math.sin(u) + (2 * (1 - Math.cos(u) / 2)) * Math.sin(u) * Math.cos(v);
      } else {
        x = 3 * Math.cos(u) * (1 + Math.sin(u)) + (2 * (1 - Math.cos(u) / 2)) * Math.cos(v + Math.PI);
        y = 8 * Math.sin(u);
      }
      z = (2 * (1 - Math.cos(u) / 2)) * Math.sin(v);
      pts.push({ x: x / 10, y: y / 10, z: z / 5 });
    }
    if (ui < U) pts.push({ x: NaN, y: NaN, z: NaN });
  }
  return pts;
}

// Поверхность Боя — проекция проективной плоскости
function makeBoysSurface(): { x: number, y: number, z: number }[] {
  const pts = [];
  const N = 50;
  for (let ui = 0; ui <= N; ui++) {
    const u = (ui / N) * Math.PI;
    for (let vi = 0; vi <= N; vi++) {
      const v = (vi / N) * Math.PI;
      const x = (Math.sqrt(2) * Math.cos(2 * u) * Math.cos(v) * Math.cos(v) + Math.cos(u) * Math.sin(2 * v)) / (2 - Math.sqrt(2) * Math.sin(3 * u) * Math.sin(2 * v));
      const y = (Math.sqrt(2) * Math.sin(2 * u) * Math.cos(v) * Math.cos(v) - Math.sin(u) * Math.sin(2 * v)) / (2 - Math.sqrt(2) * Math.sin(3 * u) * Math.sin(2 * v));
      const z = (3 * Math.cos(v) * Math.cos(v)) / (2 - Math.sqrt(2) * Math.sin(3 * u) * Math.sin(2 * v));
      pts.push({ x, y: y, z: z - 1 });
    }
    if (ui < N) pts.push({ x: NaN, y: NaN, z: NaN });
  }
  return pts;
}

// Аттрактор Томаса — хаотическая 3D траектория
function makeThomasAttractor(): { x: number, y: number, z: number }[] {
  const pts = [];
  let x = 1, y = 0, z = 0;
  const b = 0.208186, dt = 0.05;
  for (let i = 0; i < 12000; i++) {
    const dx = Math.sin(y) - b * x;
    const dy = Math.sin(z) - b * y;
    const dz = Math.sin(x) - b * z;
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (i > 500) pts.push({ x: x / 3, y: y / 3, z: z / 3 });
  }
  return pts;
}

// Аттрактор Рёсслера
function makeRosslerAttractor(): { x: number, y: number, z: number }[] {
  const pts = [];
  let x = 1, y = 0, z = 0;
  const a = 0.2, b = 0.2, c = 5.7, dt = 0.02;
  for (let i = 0; i < 15000; i++) {
    const dx = -y - z;
    const dy = x + a * y;
    const dz = b + z * (x - c);
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (i > 200) pts.push({ x: x / 15, y: y / 15, z: z / 15 - 0.5 });
  }
  return pts;
}

// Поверхность Эннепера — минимальная поверхность
function makeEnneperSurface(): { x: number, y: number, z: number }[] {
  const pts = [];
  const N = 40;
  for (let ui = 0; ui <= N; ui++) {
    const u = (ui / N) * 2 - 1;
    for (let vi = 0; vi <= N; vi++) {
      const v = (vi / N) * 2 - 1;
      const x = u - u * u * u / 3 + u * v * v;
      const y = v - v * v * v / 3 + v * u * u;
      const z = u * u - v * v;
      pts.push({ x: x / 3, y: y / 3, z: z / 3 });
    }
    if (ui < N) pts.push({ x: NaN, y: NaN, z: NaN });
  }
  return pts;
}

// 600-cell wireframe — красивейший 4D политоп
function make600CellWire(): { x: number, y: number, z: number, w: number }[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts: number[][] = [];
  // 8 пермутаций (±1,0,0,0)
  for (const s of [-1, 1]) { verts.push([s, 0, 0, 0]); verts.push([0, s, 0, 0]); verts.push([0, 0, s, 0]); verts.push([0, 0, 0, s]); }
  // 16 пермутаций (±½,±½,±½,±½)
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) for (const d of [-1, 1])
    verts.push([a / 2, b / 2, c / 2, d / 2]);
  // 96 пермутаций с φ
  const half_phi = phi / 2, half_inv = 1 / (2 * phi), half_1 = 0.5;
  const combos = [[0, half_1, half_inv, half_phi], [half_1, half_inv, half_phi, 0], [half_inv, half_phi, 0, half_1], [half_phi, 0, half_1, half_inv]];
  for (const [a, b, c, d] of combos)
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) for (const sc of [-1, 1]) for (const sd of [-1, 1])
      verts.push([sa * a, sb * b, sc * c, sd * d]);
  return verts.map(v => ({ x: v[0], y: v[1], z: v[2], w: v[3] || 0 }));
}


// Логотипы брендов — нормализованные координаты, будут масштабированы на экран
function makeBrandPoints(seed: number, W: number, H: number): { x: number, y: number }[] {
  const cx = W * 0.5, cy = H * 0.5;
  const sz = Math.min(W, H) * 0.35;
  // map [0..1] -> screen with padding
  const m = (nx: number, ny: number) => ({ x: cx + (nx - 0.5) * sz, y: cy + (ny - 0.5) * sz });
  const nan = { x: NaN, y: NaN };

  const logos: { x: number, y: number }[][] = [
    // Nike swoosh
    [m(0.1, 0.55), m(0.18, 0.45), m(0.30, 0.40), m(0.45, 0.42), m(0.60, 0.48), m(0.75, 0.58), m(0.90, 0.72), m(0.85, 0.70), m(0.65, 0.55), m(0.48, 0.50), m(0.32, 0.52), m(0.20, 0.58), m(0.12, 0.62), m(0.10, 0.55)],
    // Apple — окружность с вырезом
    ...[Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return m(0.5 + 0.4 * Math.cos(a), 0.5 + 0.4 * Math.sin(a)); }),
    [nan],
    Array.from({ length: 20 }, (_, i) => { const a = -0.5 + i / 19 * 1.0; return m(0.5 + 0.15 * Math.cos(a), 0.22 + 0.12 * Math.sin(a)); }),
    ],
    // Twitter/X — буква X
    [m(0.2, 0.2), m(0.8, 0.8), nan, m(0.8, 0.2), m(0.2, 0.8)],
    // Mercedes — три луча в круге
    ...[
      Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return m(0.5 + 0.45 * Math.cos(a), 0.5 + 0.45 * Math.sin(a)); }),
      [nan],
      [m(0.5, 0.05), m(0.5, 0.5), nan, m(0.5, 0.5), m(0.88, 0.75), nan, m(0.5, 0.5), m(0.12, 0.75)],
    ],
    // BMW — четыре квадранта
    ...[
      Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return m(0.5 + 0.45 * Math.cos(a), 0.5 + 0.45 * Math.sin(a)); }),
      [nan],
      Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return m(0.5 + 0.30 * Math.cos(a), 0.5 + 0.30 * Math.sin(a)); }),
      [nan],
      [m(0.5, 0.05), m(0.5, 0.95), nan, m(0.05, 0.5), m(0.95, 0.5)],
    ],
    // Audi — четыре кольца
    ...[0, 1, 2, 3].map(i => [
      ...Array.from({ length: 60 }, (_, j) => { const a = (j / 60) * Math.PI * 2; return m(0.15 + i * 0.23 + 0.11 * Math.cos(a), 0.5 + 0.11 * Math.sin(a)); }),
      nan,
    ]),
    // Olympic rings  
    ...[0, 1, 2, 3, 4].map(i => [
      ...Array.from({ length: 60 }, (_, j) => { const a = (j / 60) * Math.PI * 2; const row = i % 2 === 0 ? 0 : 0.1; return m(0.1 + i * 0.2 + 0.09 * Math.cos(a), 0.45 + row + 0.09 * Math.sin(a)); }),
      nan,
    ]),
    // Star of David (гексаграмма)
    [...Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return m(0.5 + 0.4 * Math.cos(a), 0.5 + 0.4 * Math.sin(a)); }),
      nan,
    ...Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * Math.PI * 2 + Math.PI / 2; return m(0.5 + 0.4 * Math.cos(a), 0.5 + 0.4 * Math.sin(a)); })],
    // Буква A (Adidas-стиль)
    [m(0.5, 0.1), m(0.1, 0.9), m(0.28, 0.9), m(0.5, 0.4), m(0.72, 0.9), m(0.9, 0.9), m(0.5, 0.1), nan, m(0.28, 0.65), m(0.72, 0.65)],
    // Спираль галактики
    ...Array.from({ length: 3 }, (_, arm) => [
      ...Array.from({ length: 80 }, (_, i) => {
        const t = i / 79 * Math.PI * 4;
        const r = 0.05 + t * 0.07;
        const offset = arm * Math.PI * 2 / 3;
        return m(0.5 + r * Math.cos(t + offset), 0.5 + r * Math.sin(t + offset));
      }),
      nan,
    ]),
  ];

  const idx = seed % logos.length;
  return (logos[idx] as any).flat ? (logos[idx] as any).flat() as { x: number, y: number }[] : logos[idx] as { x: number, y: number }[];
}

// Строит трейл из рёбер политопа
function buildEdgeTrail(edges: [number, number][], projected: { x: number, y: number }[]): { x: number, y: number }[] {
  const result: { x: number, y: number }[] = [];
  const NaN_pt = { x: NaN, y: NaN };
  for (const [a, b] of edges) {
    const pa = projected[a], pb = projected[b];
    if (!pa || !pb || isNaN(pa.x) || isNaN(pb.x)) continue;
    result.push(pa, pb, NaN_pt);
  }
  return result;
}

function generate3DShapePoints(
  seed: number,
  W: number, H: number,
  _mouseX: number, _mouseY: number
): { x: number; y: number }[] {
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };

  const cx = W * 0.5, cy = H * 0.5;
  const rotX = rng() * Math.PI * 2;
  const rotY = rng() * Math.PI * 2;
  const shapeType = Math.floor(rng() * 18); // 16 типов

  // Непрерывные кривые — проецируем напрямую
  // Автоматически масштабирует и центрирует точки по экрану
  const fitToScreen = (pts: { x: number, y: number }[]) => {
    const valid = pts.filter(p => !isNaN(p.x));
    if (valid.length === 0) return pts;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    valid.forEach(p => { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; });
    const fw = maxX - minX || 1, fh = maxY - minY || 1;
    const scale = Math.min(W / fw, H / fh);
    const ox = cx - (minX + fw / 2) * scale;
    const oy = cy - (minY + fh / 2) * scale;
    return pts.map(p => isNaN(p.x) ? p : { x: p.x * scale + ox, y: p.y * scale + oy });
  };

  const scaleAndProject = (pts3d: { x: number, y: number, z: number }[], sc: number) =>
    fitToScreen(project3DPoints(pts3d.filter(p => !isNaN(p.x)), rotX, rotY, sc, cx, cy));

  const withNaN = (pts3d: { x: number, y: number, z: number }[], sc: number) => {
    const result: { x: number, y: number }[] = [];
    for (const p of pts3d) {
      if (isNaN(p.x)) result.push({ x: NaN, y: NaN });
      else {
        const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        const x1 = p.x * cosY - p.z * sinY, z1 = p.x * sinY + p.z * cosY;
        const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        const y1 = p.y * cosX - z1 * sinX, z2 = p.y * sinX + z1 * cosX;
        const fov = 5 / (5 + z2);
        result.push({ x: cx + x1 * sc * fov, y: cy + y1 * sc * fov });
      }
    }
    return fitToScreen(result);
  };

  if (shapeType === 0) return scaleAndProject(makeThomasAttractor(), Math.min(W, H) * 0.18);
  if (shapeType === 1) return scaleAndProject(makeDNAHelix(), Math.min(W, H) * 0.18);
  if (shapeType === 2) {
    // Два вложенных торических узла — сложное переплетение
    const a = makeTorusKnot(5, 3); const b = makeTorusKnot(7, 4);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b], Math.min(W, H) * 0.09);
  }
  if (shapeType === 3) {
    // Три Лиссажу разных фаз — объёмная звезда
    const a = makeLissajous3D(3, 4, 5, 0); const b = makeLissajous3D(3, 4, 5, Math.PI / 3); const c = makeLissajous3D(3, 4, 5, Math.PI * 2 / 3);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b, { x: NaN, y: NaN, z: NaN }, ...c], Math.min(W, H) * 0.18);
  }
  if (shapeType === 4) {
    // 4D Tesseract + 16-cell вместе
    const s4D = Math.min(W, H) * 0.10;
    const rotXY = rng() * Math.PI * 2, rotXZ = rng() * Math.PI * 2, rotXW = rng() * Math.PI * 2;
    const t = makeTesseract(); const c16 = make16Cell();
    const projT = t.verts.map(v => project4D(v, rotXY, rotXZ, rotXW, s4D, cx, cy));
    const projC = c16.verts.map(v => project4D(v, rotXY + 0.5, rotXZ + 0.5, rotXW + 0.3, s4D, cx, cy));
    const ptsT = buildEdgeTrail(t.edges, projT);
    const ptsC = buildEdgeTrail(c16.edges, projC);
    return [...ptsT, { x: NaN, y: NaN }, ...ptsC];
  }
  if (shapeType === 5) return scaleAndProject(makeLissajous3D(3, 4, 5, rng() * Math.PI), Math.min(W, H) * 0.20);
  if (shapeType === 6) return scaleAndProject(makeLissajous3D(5, 7, 8, rng() * Math.PI), Math.min(W, H) * 0.19);
  if (shapeType === 7) return scaleAndProject(makeLissajous3D(7, 11, 13, rng() * Math.PI), Math.min(W, H) * 0.19);
  // Типы 8-16: плотные кривые — создают красивую мозаику
  if (shapeType === 8) {
    // Два торических узла + Лиссажу — плотное переплетение
    const a = makeTorusKnot(5, 3); const b = makeTorusKnot(7, 4);
    const c = makeLissajous3D(3, 5, 7, rng() * Math.PI);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b, { x: NaN, y: NaN, z: NaN }, ...c], Math.min(W, H) * 0.14);
  }
  if (shapeType === 9) {
    // ДНК + торический узел — биоморфная форма
    const a = makeDNAHelix(); const b = makeTorusKnot(5, 2);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b], Math.min(W, H) * 0.16);
  }
  if (shapeType === 10) {
    // Три Лиссажу разных фаз — объёмная звезда
    const a = makeLissajous3D(3, 4, 5, 0); const b = makeLissajous3D(3, 4, 5, Math.PI / 3);
    const c = makeLissajous3D(3, 4, 5, Math.PI * 2 / 3);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b, { x: NaN, y: NaN, z: NaN }, ...c], Math.min(W, H) * 0.18);
  }
  if (shapeType === 11) {
    // Аттрактор Томаса + торический узел
    const a = makeThomasAttractor(); const b = makeTorusKnot(7, 3);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b], Math.min(W, H) * 0.14);
  }
  if (shapeType === 12) {
    // Лиссажу 5:7:8 + 7:11:13
    const a = makeLissajous3D(5, 7, 8, rng() * Math.PI); const b = makeLissajous3D(7, 11, 13, rng() * Math.PI);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b], Math.min(W, H) * 0.17);
  }
  if (shapeType === 13) {
    // Торическая спираль 7:13 + узел 11:5
    const a = makeTorusSpiral(1.5, 0.5, 7, 13); const b = makeTorusSpiral(2, 0.6, 11, 17);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b], Math.min(W, H) * 0.15);
  }
  if (shapeType === 14) {
    // Клейновская бутылка + Лиссажу
    const a = makeKleinBottle(); const b = makeLissajous3D(4, 5, 7, rng() * Math.PI);
    return withNaN([...a, { x: NaN, y: NaN, z: NaN }, ...b.map(p => ({ ...p, z: 0 }))], Math.min(W, H) * 0.12);
  }
  if (shapeType === 15) {
    // Поверхность Боя + торический узел
    const a = makeBoysSurface(); const b = makeTorusKnot(9, 4);
    return withNaN([...a, { x: NaN, y: NaN, z: NaN }, ...b.map(p => ({ ...p, z: p.z || 0 }))], Math.min(W, H) * 0.11);
  }
  if (shapeType === 16) {
    // ДНК + три торических узла
    const a = makeDNAHelix(); const b = makeTorusKnot(3, 2); const c = makeTorusKnot(5, 3);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b, { x: NaN, y: NaN, z: NaN }, ...c], Math.min(W, H) * 0.14);
  }
  const scale4D = Math.min(W, H) * 0.09;
  const rotXY = rng() * Math.PI * 2, rotXZ = rng() * Math.PI * 2, rotXW = rng() * Math.PI * 2;
  const polytopes = [makeTesseract, make16Cell, make24Cell];
  const shape = polytopes[Math.floor(rng() * polytopes.length)]();
  const projected = shape.verts.map(v => project4D(v, rotXY, rotXZ, rotXW, scale4D, cx, cy));

  // Строим непрерывный трейл по рёбрам
  const pts: { x: number; y: number }[] = [];
  const used = new Set<string>();
  const key = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;

  let cur = 0;
  pts.push(projected[cur]);

  let safety = 0;
  while (used.size < shape.edges.length && safety++ < 2000) {
    const available = shape.edges.filter(([a, b]) =>
      (a === cur || b === cur) && !used.has(key(a, b))
    );

    if (available.length === 0) {
      const nextEdge = shape.edges.find(([a, b]) => !used.has(key(a, b)));
      if (!nextEdge) break;
      const next = nextEdge[0];
      const from = projected[cur], to = projected[next];
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        pts.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
      }
      cur = next;
      continue;
    }

    const [a, b] = available[0];
    const next = a === cur ? b : a;
    used.add(key(cur, next));

    const from = projected[cur], to = projected[next];
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      pts.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
    }
    cur = next;
  }

  return pts;
}


export default function Home() {
  const [videoSrc, setVideoSrc] = useState("/me.mp4");

  const videoRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);

  const [contactHovered, setContactHovered] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "", service: "ILLUSTRATION" });
  const [isSending, setIsSending] = useState(false);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const [imgVisible, setImgVisible] = useState(false);

  const scrollRef = useRef(0);
  const touchStartRef = useRef(0);
  const [pinkOpacity, setPinkOpacity] = useState(1);
  const [videoOpacity, setVideoOpacity] = useState(0);

  const floatingRefs = useRef<(HTMLDivElement | null)[]>(Array(IMG_COUNT).fill(null));
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);

  // Накопленные миниатюры узоров
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const thumbIdRef = useRef(0);
  const captureCountRef = useRef(0);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const autoTrailRef = useRef<{ x: number; y: number }[]>([]);
  const autoDrawActiveRef = useRef(false); // когда true — трейлы кубиков выключены

  // Слайдшоу фото mi1–mi5: случайные позиции, появляются каждые 5 сек
  const videoOpacityRef = useRef(0); // ref-версия для доступа в таймере

  const physState = useRef(
    FLOATING_INIT.map(() => ({
      x: 0, y: 0, vx: 0, vy: 0, ang: 0, rotSpeed: 0, initialized: false,
      trail: [] as { x: number; y: number }[],
    }))
  );
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const gyroRef = useRef({ gx: 0, gy: 0 });
  const shakeRef = useRef({ lastAcc: 0, lastShakeTime: 0 });
  const prevTextRectRef = useRef<DOMRect | null>(null);
  const prevBioRectRef = useRef<DOMRect | null>(null);

  const explodeFromPoint = (px: number, py: number, radius = 260, maxForce = 9000) => {
    physState.current.forEach(s => {
      if (!s.initialized) return;
      const dx = s.x - px, dy = s.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= radius) return;
      const t = 1 - dist / radius;
      const force = maxForce * t * t;
      const sd = Math.max(dist, 1);
      s.vx += (dx / sd) * force * (1 / 16);
      s.vy += (dy / sd) * force * (1 / 16);
      s.rotSpeed += ((Math.random() - 0.5) * 8) * t;
    });
    wordPhysRef.current.forEach(wp => {
      const dx = wp.x - px, dy = wp.y - py, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= radius) return;
      const t = 1 - dist / radius, force = maxForce * t * t, sd = Math.max(dist, 1);
      wp.vx += (dx / sd) * force * (1 / 16); wp.vy += (dy / sd) * force * (1 / 16);
    });
  };

  const GAP = 20;

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    const onOri = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0, b = Math.max(-90, Math.min(90, e.beta ?? 0));
      gyroRef.current.gx = g * 14; gyroRef.current.gy = b * 14;
    };
    const onMot = (e: DeviceMotionEvent) => {
      const raw = e.acceleration ?? e.accelerationIncludingGravity;
      if (!raw) return;
      const total = Math.sqrt((raw.x ?? 0) ** 2 + (raw.y ?? 0) ** 2 + (raw.z ?? 0) ** 2);
      const sh = shakeRef.current, delta = Math.abs(total - sh.lastAcc);
      sh.lastAcc = total;
      const now = Date.now();
      if (delta > 20 && now - sh.lastShakeTime > 700) {
        sh.lastShakeTime = now;
        explodeFromPoint(window.innerWidth / 2, window.innerHeight / 2, 9999, 60000);
      }
    };
    const add = () => {
      window.addEventListener("deviceorientation", onOri, true);
      window.addEventListener("devicemotion", onMot, true);
    };
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const DOE = DeviceOrientationEvent as any;
    if (isIOS && typeof DOE.requestPermission === "function") {
      window.addEventListener("touchstart", async function h() {
        try { if ((await DOE.requestPermission()) === "granted") add(); } catch (_) { }
        window.removeEventListener("touchstart", h);
      }, { once: true });
    } else { add(); }
    return () => {
      window.removeEventListener("deviceorientation", onOri, true);
      window.removeEventListener("devicemotion", onMot, true);
    };
  }, []);

  const ALL_IMAGES = [
    "/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg",
    "/8.jpg", "/9.jpg", "/10.jpg", "/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg",
    "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg", "/21.jpg"
  ];
  const ROWS = useMemo(() => [
    shuffleWithSeed(ALL_IMAGES, 1001), shuffleWithSeed(ALL_IMAGES, 2002),
    shuffleWithSeed(ALL_IMAGES, 3003), shuffleWithSeed(ALL_IMAGES, 4004),
    shuffleWithSeed(ALL_IMAGES, 5005),
  ], []);
  const REVERSED = [false, true, false, true, false];
  const SCROLL_PER_UNIT = 800;
  const TOTAL_SCROLL = 3 * SCROLL_PER_UNIT;

  const iDoDesignTextRef = useRef<HTMLDivElement>(null);
  const bioTextRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sync = () => {
      if (iDoDesignTextRef.current && bioTextRef.current) {
        const w = iDoDesignTextRef.current.getBoundingClientRect().width;
        bioTextRef.current.style.width = `${w}px`;
      }
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // Canvas resize
  useEffect(() => {
    const resize = () => {
      const c = trailCanvasRef.current; if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = window.innerWidth * dpr; c.height = window.innerHeight * dpr;
      c.style.width = window.innerWidth + "px"; c.style.height = window.innerHeight + "px";
      const ctx = c.getContext("2d"); if (ctx) ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = trailCanvasRef.current;

    const clearCanvas = () => {
      const c = trailCanvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    };

    const makeMosaicFromSnap = (pts: { x: number, y: number }[], snap: HTMLCanvasElement) => {
      if (pts.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      pts.forEach(p => {
        if (isNaN(p.x)) return;
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      });
      if (!isFinite(minX)) return;
      const pad = 10;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX += pad; maxY += pad;
      const cropW = Math.max(1, maxX - minX);
      const cropH = Math.max(1, maxY - minY);
      const dpr = window.devicePixelRatio || 1;
      // Thumbnail — снимок того что было нарисовано
      const crop = document.createElement("canvas");
      crop.width = Math.round(cropW * dpr);
      crop.height = Math.round(cropH * dpr);
      const ctx2 = crop.getContext("2d");
      if (ctx2) ctx2.drawImage(snap, minX * dpr, minY * dpr, cropW * dpr, cropH * dpr, 0, 0, crop.width, crop.height);
      const src = crop.toDataURL("image/png");
      const W = window.innerWidth, H = window.innerHeight;
      const tyPx = getCurrentTyPx();
      const isMobile = W <= 768;
      const DST_SIZE = isMobile ? 57 : 170;
      const PAD = 16;
      const findFreeSpot = (existing: Thumbnail[]) => {
        for (let attempt = 0; attempt < 60; attempt++) {
          const margin = 0.04;
          const x = (margin + Math.random() * (1 - 2 * margin - DST_SIZE / W)) * W;
          const y = (margin + Math.random() * (1 - 2 * margin - DST_SIZE / H)) * H - tyPx;
          const ok = existing.every(t =>
            x + DST_SIZE + PAD < t.dstX || x > t.dstX + DST_SIZE + PAD ||
            y + DST_SIZE + PAD < t.dstY || y > t.dstY + DST_SIZE + PAD
          );
          if (ok) return { dstX: x, dstY: y };
        }
        return { dstX: (0.04 + Math.random() * 0.88) * W, dstY: (0.04 + Math.random() * 0.88) * H - tyPx };
      };
      thumbIdRef.current++;
      const newId = thumbIdRef.current;
      setThumbnails(prev => {
        const { dstX, dstY } = findFreeSpot(prev);
        return [...prev, { id: newId, src, srcX: minX, srcY: minY - tyPx, srcW: cropW, srcH: cropH, dstX, dstY, dstSize: DST_SIZE, offsetY: 0 }];
      });
      const mosaicSrc = buildColoredMosaic([pts], minX, minY, cropW, cropH);
      if (mosaicSrc) setThumbnails(prev => prev.map(t => t.id === newId ? { ...t, src: mosaicSrc } : t));
    };

    const makeMosaic = (trails: { x: number, y: number }[][], _snap?: HTMLCanvasElement) => {
      const c = trailCanvasRef.current;
      if (!c || trails.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      trails.forEach(t => t.forEach(p => {
        if (isNaN(p.x)) return;
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }));
      if (!isFinite(minX)) return;
      const pad = 10;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX += pad; maxY += pad;
      const cropW = Math.max(1, maxX - minX);
      const cropH = Math.max(1, maxY - minY);
      const dpr = window.devicePixelRatio || 1;
      const crop = document.createElement("canvas");
      crop.width = Math.round(cropW * dpr);
      crop.height = Math.round(cropH * dpr);
      const ctx2 = crop.getContext("2d");
      if (ctx2) ctx2.drawImage(c, minX * dpr, minY * dpr, cropW * dpr, cropH * dpr, 0, 0, crop.width, crop.height);
      const src = crop.toDataURL("image/png");
      const W = window.innerWidth, H = window.innerHeight;
      const tyPx = getCurrentTyPx();
      const isMobile = W <= 768;
      const DST_SIZE = isMobile ? 57 : 170;
      const PAD = 16;
      const findFreeSpot = (existing: Thumbnail[]) => {
        for (let attempt = 0; attempt < 60; attempt++) {
          const margin = 0.04;
          const x = (margin + Math.random() * (1 - 2 * margin - DST_SIZE / W)) * W;
          const y = (margin + Math.random() * (1 - 2 * margin - DST_SIZE / H)) * H - tyPx;
          const ok = existing.every(t =>
            x + DST_SIZE + PAD < t.dstX || x > t.dstX + DST_SIZE + PAD ||
            y + DST_SIZE + PAD < t.dstY || y > t.dstY + DST_SIZE + PAD
          );
          if (ok) return { dstX: x, dstY: y };
        }
        return { dstX: (0.04 + Math.random() * 0.88) * W, dstY: (0.04 + Math.random() * 0.88) * H - tyPx };
      };
      thumbIdRef.current++;
      const newId = thumbIdRef.current;
      setThumbnails(prev => {
        const { dstX, dstY } = findFreeSpot(prev);
        return [...prev, { id: newId, src, srcX: minX, srcY: minY - tyPx, srcW: cropW, srcH: cropH, dstX, dstY, dstSize: DST_SIZE, offsetY: 0 }];
      });
      const mosaicSrc = buildColoredMosaic(trails, minX, minY, cropW, cropH);
      if (mosaicSrc) setThumbnails(prev => prev.map(t => t.id === newId ? { ...t, src: mosaicSrc } : t));
    };

    // Предзагрузка картин — по одной с задержкой, не блокируем UI
    const preloadedArtworks: ({ x: number, y: number }[])[] = new Array(ARTWORKS.length).fill(null);
    let artworkIdx = 0;
    ARTWORKS.forEach((url, i) => {
      setTimeout(() => {
        generateArtworkPoints(url, window.innerWidth, window.innerHeight).then(pts => {
          preloadedArtworks[i] = pts;
        });
      }, i * 1200 + 2000);
    });

    // Фаза 0: трейлы кубиков 4 сек → мозаика → картина
    const runPhase0 = () => {
      if (!activeRef.current) return;
      autoDrawActiveRef.current = false;
      schedTimer = setTimeout(() => {
        if (!activeRef.current) return;
        const trails = physState.current.filter(s => s.trail.length > 1).map(s => s.trail.slice());
        physState.current.forEach(s => { s.trail = []; });
        clearCanvas();
        makeMosaic(trails);
        schedTimer = setTimeout(runPhase3, 100); // → картина
      }, 4000);
    };

    // Фаза 1: 3D/4D фигура 4 сек → трейлы
    const runPhase1 = () => {
      if (!activeRef.current) return;
      const W = window.innerWidth, H = window.innerHeight;
      const pts = generate3DShapePoints(Math.floor(Math.random() * 999999), W, H, 0, 0);
      runDrawPhase(pts, runPhase0); // → трейлы
    };

    // Фаза 3: картина → геометрия
    const runPhase3 = () => {
      if (!activeRef.current) return;
      const W = window.innerWidth, H = window.innerHeight;
      const idx = artworkIdx % ARTWORKS.length;
      artworkIdx++;
      const url = ARTWORKS[idx];
      const startDraw = (pts: { x: number; y: number }[]) => {
        if (!activeRef.current) return;
        if (pts.length < 3) { runPhase1(); return; }
        runDrawPhase(pts, runPhase1); // → геометрия
      };
      const cached = preloadedArtworks[idx];
      if (cached && cached.length > 10) {
        startDraw(cached);
      } else {
        generateArtworkPoints(url, W, H).then(pts => {
          if (!activeRef.current) return;
          preloadedArtworks[idx] = pts;
          startDraw(pts);
        });
      }
    };

    runPhase0();

    const onMouseMove = (e: MouseEvent) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      activeRef.current = false;
      if (schedTimer) clearTimeout(schedTimer);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);
 > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const IMG_COUNT = 30;
const IMG_SIZE_DESKTOP = 60;
const IMG_SIZE_MOBILE = 20;
const getImgSize = () =>
  typeof window !== "undefined" && window.innerWidth <= 768
    ? IMG_SIZE_MOBILE
    : IMG_SIZE_DESKTOP;

const FLOATING_INIT = Array.from({ length: IMG_COUNT }, (_, i) => {
  const seed = i * 137 + 42;
  const r = (n: number) => ((seed * 1664525 + n * 1013904223) & 0x7fffffff) / 0x7fffffff;
  return {
    src: `/j${(i % 6) + 1}.jpg`,
    x: r(1) * 82 + 5,
    y: r(2) * 82 + 5,
    vx: (r(3) - 0.5) * 120,
    vy: (r(4) - 0.5) * 100,
    rotation: r(6) * 360,
    rotSpeed: (r(7) - 0.5) * 120,
    delay: r(8) * 400,
  };
});

type Vec2 = { x: number; y: number };

function getCorners(cx: number, cy: number, ang: number, S: number): Vec2[] {
  const h = S / 2, cos = Math.cos(ang), sin = Math.sin(ang);
  return [
    { x: cx + cos * (-h) - sin * (-h), y: cy + sin * (-h) + cos * (-h) },
    { x: cx + cos * (h) - sin * (-h), y: cy + sin * (h) + cos * (-h) },
    { x: cx + cos * (h) - sin * (h), y: cy + sin * (h) + cos * (h) },
    { x: cx + cos * (-h) - sin * (h), y: cy + sin * (-h) + cos * (h) },
  ];
}

function project(pts: Vec2[], ax: Vec2): [number, number] {
  let mn = Infinity, mx = -Infinity;
  for (const p of pts) {
    const d = p.x * ax.x + p.y * ax.y;
    if (d < mn) mn = d;
    if (d > mx) mx = d;
  }
  return [mn, mx];
}

function obbCollide(
  ax: number, ay: number, aAng: number,
  bx: number, by: number, bAng: number,
  S: number
): { overlap: number; nx: number; ny: number } | null {
  const cornersA = getCorners(ax, ay, aAng, S);
  const cornersB = getCorners(bx, by, bAng, S);
  const axes: Vec2[] = [
    { x: Math.cos(aAng), y: Math.sin(aAng) },
    { x: -Math.sin(aAng), y: Math.cos(aAng) },
    { x: Math.cos(bAng), y: Math.sin(bAng) },
    { x: -Math.sin(bAng), y: Math.cos(bAng) },
  ];
  let minOverlap = Infinity, minAxis: Vec2 = axes[0];
  for (const axis of axes) {
    const [a0, a1] = project(cornersA, axis);
    const [b0, b1] = project(cornersB, axis);
    const overlap = Math.min(a1, b1) - Math.max(a0, b0);
    if (overlap <= 0) return null;
    if (overlap < minOverlap) { minOverlap = overlap; minAxis = axis; }
  }
  const dx = ax - bx, dy = ay - by;
  const dot = dx * minAxis.x + dy * minAxis.y;
  const sign = dot < 0 ? -1 : 1;
  return { overlap: minOverlap, nx: minAxis.x * sign, ny: minAxis.y * sign };
}

// Тип для накопленных миниатюр узоров
type Thumbnail = {
  id: number;
  src: string;
  srcX: number; srcY: number; srcW: number; srcH: number;
  dstX: number; dstY: number; dstSize: number;
};

// Заливка как в Paint: линии-разделители создают области, flood-fill заливает каждую ярким цветом.
// Фон тоже получает случайный цвет. Белого и серого нет.
function buildColoredMosaic(
  trails: { x: number; y: number }[][],
  minX: number, minY: number,
  cropW: number, cropH: number
): string | null {
  const SIZE = 400;
  const scale = Math.min(SIZE / Math.max(cropW, cropH, 1), 4);
  const w = Math.max(4, Math.round(cropW * scale));
  const h = Math.max(4, Math.round(cropH * scale));

  const ALL: [number, number, number][] = [
    [255, 0, 60], [255, 80, 0], [255, 200, 0], [180, 255, 0],
    [0, 255, 80], [0, 255, 220], [0, 140, 255], [80, 0, 255],
    [200, 0, 255], [255, 0, 180], [255, 120, 120], [120, 255, 120],
    [120, 120, 255], [255, 220, 100], [100, 255, 220], [220, 100, 255],
  ];
  const COLORS = [...ALL].sort(() => Math.random() - 0.5);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  if (!trails.length || trails.every(t => t.length < 2)) {
    ctx.fillStyle = `rgb(${COLORS[0].join(',')})`;
    ctx.fillRect(0, 0, w, h);
    return canvas.toDataURL("image/png");
  }

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  // Рисуем разделители с учётом NaN разрывов и quadratic curves
  const drawTrails = (strokeColor: string, lineW: number) => {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    trails.forEach(trail => {
      if (trail.length < 2) return;
      ctx.beginPath();
      let penDown = false;
      let prevX = 0, prevY = 0;
      for (let j = 0; j < trail.length; j++) {
        const p = trail[j];
        if (isNaN(p.x)) {
          if (penDown) { ctx.stroke(); ctx.beginPath(); penDown = false; }
          continue;
        }
        const sx = (p.x - minX) * scale;
        const sy = (p.y - minY) * scale;
        if (!penDown) {
          ctx.moveTo(sx, sy);
          prevX = sx; prevY = sy;
          penDown = true;
        } else {
          const mx = (prevX + sx) / 2;
          const my = (prevY + sy) / 2;
          ctx.quadraticCurveTo(prevX, prevY, mx, my);
          prevX = sx; prevY = sy;
        }
      }
      if (penDown) ctx.stroke();
    });
  };



  // Разделители — как в оригинале
  drawTrails("#000", Math.max(2.5, 2.5 * scale));

  // Края canvas
  ctx.fillStyle = "#000";
  const bw = Math.max(2, Math.round(2 * scale));
  ctx.fillRect(0, 0, w, bw); ctx.fillRect(0, h - bw, w, bw);
  ctx.fillRect(0, 0, bw, h); ctx.fillRect(w - bw, 0, bw, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const n = w * h;
  const isBorder = (i: number) => data[i * 4] < 180;
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  const recentColors: number[] = [];

  for (let start = 0; start < n; start++) {
    if (visited[start] || isBorder(start)) continue;
    let ci = Math.floor(Math.random() * COLORS.length);
    for (let attempt = 0; attempt < 8; attempt++) {
      if (!recentColors.includes(ci)) break;
      ci = Math.floor(Math.random() * COLORS.length);
    }
    recentColors.push(ci); if (recentColors.length > 4) recentColors.shift();
    const [cr, cg, cb] = COLORS[ci];
    let qH = 0, qT = 0;
    queue[qT++] = start; visited[start] = 1;
    while (qH < qT) {
      const idx = queue[qH++];
      const o = idx * 4;
      data[o] = cr; data[o + 1] = cg; data[o + 2] = cb; data[o + 3] = 255;
      const x = idx % w, y = (idx / w) | 0;
      if (x > 0) { const nb = idx - 1; if (!visited[nb] && !isBorder(nb)) { visited[nb] = 1; queue[qT++] = nb; } }
      if (x < w - 1) { const nb = idx + 1; if (!visited[nb] && !isBorder(nb)) { visited[nb] = 1; queue[qT++] = nb; } }
      if (y > 0) { const nb = idx - w; if (!visited[nb] && !isBorder(nb)) { visited[nb] = 1; queue[qT++] = nb; } }
      if (y < h - 1) { const nb = idx + w; if (!visited[nb] && !isBorder(nb)) { visited[nb] = 1; queue[qT++] = nb; } }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Тонкие чёрные линии поверх — точный контур
  drawTrails("#000", Math.max(0.3, 0.3 * scale));

  return canvas.toDataURL("image/png");
}

// Реальные созвездия — нормализованные координаты [0..1] и линии между звёздами
const CONSTELLATIONS: {
  name: string;
  stars: [number, number][];
  lines: [number, number][];
}[] = [
    { name: "Orion", stars: [[0.42, 0.08], [0.60, 0.10], [0.28, 0.28], [0.52, 0.24], [0.74, 0.26], [0.38, 0.50], [0.66, 0.48], [0.30, 0.72], [0.44, 0.80], [0.58, 0.80], [0.72, 0.72]], lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6], [5, 7], [6, 10], [7, 8], [8, 9], [9, 10]] },
    { name: "Ursa Major", stars: [[0.08, 0.72], [0.20, 0.58], [0.34, 0.50], [0.48, 0.54], [0.62, 0.40], [0.74, 0.24], [0.88, 0.18], [0.30, 0.30], [0.18, 0.22], [0.10, 0.38]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [2, 7], [7, 8], [8, 9], [9, 2]] },
    { name: "Cassiopeia", stars: [[0.08, 0.42], [0.26, 0.22], [0.50, 0.36], [0.72, 0.14], [0.92, 0.30]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    { name: "Leo", stars: [[0.14, 0.62], [0.22, 0.38], [0.36, 0.20], [0.52, 0.28], [0.62, 0.42], [0.50, 0.56], [0.76, 0.58], [0.88, 0.46], [0.32, 0.70]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [3, 6], [6, 7], [5, 8]] },
    { name: "Scorpius", stars: [[0.32, 0.08], [0.44, 0.16], [0.52, 0.26], [0.56, 0.38], [0.52, 0.50], [0.44, 0.60], [0.38, 0.70], [0.34, 0.80], [0.42, 0.88], [0.54, 0.86], [0.62, 0.76], [0.20, 0.30], [0.14, 0.42]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [0, 11], [11, 12]] },
    { name: "Cygnus", stars: [[0.50, 0.06], [0.50, 0.28], [0.50, 0.54], [0.50, 0.80], [0.16, 0.30], [0.84, 0.30], [0.30, 0.20], [0.70, 0.20]], lines: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5], [4, 6], [5, 7]] },
    { name: "Lyra", stars: [[0.50, 0.10], [0.34, 0.32], [0.42, 0.54], [0.58, 0.54], [0.66, 0.32], [0.38, 0.72], [0.62, 0.72]], lines: [[0, 1], [0, 4], [1, 2], [2, 3], [3, 4], [1, 4], [2, 5], [3, 6], [5, 6]] },
    { name: "Boötes", stars: [[0.50, 0.08], [0.36, 0.24], [0.28, 0.46], [0.36, 0.66], [0.50, 0.74], [0.64, 0.66], [0.72, 0.46], [0.64, 0.24], [0.42, 0.42], [0.58, 0.42]], lines: [[0, 1], [0, 7], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [1, 8], [7, 9], [8, 9], [8, 3], [9, 5]] },
    { name: "Perseus", stars: [[0.50, 0.06], [0.40, 0.18], [0.28, 0.34], [0.20, 0.50], [0.30, 0.60], [0.44, 0.52], [0.58, 0.42], [0.68, 0.26], [0.60, 0.66], [0.72, 0.74], [0.56, 0.80]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 1], [5, 8], [8, 9], [8, 10], [0, 6]] },
    { name: "Gemini", stars: [[0.28, 0.08], [0.46, 0.08], [0.22, 0.22], [0.42, 0.22], [0.20, 0.38], [0.40, 0.38], [0.18, 0.56], [0.38, 0.56], [0.22, 0.72], [0.42, 0.70], [0.30, 0.86], [0.50, 0.84]], lines: [[0, 2], [2, 4], [4, 6], [6, 8], [8, 10], [1, 3], [3, 5], [5, 7], [7, 9], [9, 11], [0, 1], [6, 7]] },
    { name: "Aquila", stars: [[0.50, 0.12], [0.40, 0.30], [0.50, 0.44], [0.60, 0.30], [0.26, 0.50], [0.74, 0.50], [0.36, 0.66], [0.64, 0.66], [0.50, 0.80]], lines: [[0, 1], [0, 3], [1, 2], [2, 3], [1, 4], [3, 5], [4, 6], [5, 7], [2, 8]] },
    { name: "Taurus", stars: [[0.50, 0.08], [0.38, 0.20], [0.26, 0.34], [0.18, 0.50], [0.62, 0.20], [0.74, 0.34], [0.82, 0.50], [0.44, 0.50], [0.56, 0.50], [0.50, 0.68], [0.38, 0.80], [0.62, 0.80]], lines: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [1, 7], [4, 8], [7, 8], [7, 9], [8, 9], [9, 10], [9, 11]] },
    { name: "Virgo", stars: [[0.50, 0.06], [0.38, 0.18], [0.26, 0.28], [0.20, 0.44], [0.28, 0.58], [0.44, 0.64], [0.56, 0.64], [0.72, 0.58], [0.80, 0.44], [0.74, 0.28], [0.62, 0.18], [0.44, 0.80], [0.56, 0.80]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 0], [5, 11], [6, 12], [11, 12]] },
    { name: "Sagittarius", stars: [[0.50, 0.10], [0.36, 0.22], [0.28, 0.38], [0.36, 0.54], [0.50, 0.60], [0.64, 0.54], [0.72, 0.38], [0.64, 0.22], [0.42, 0.76], [0.58, 0.76], [0.30, 0.70], [0.70, 0.70]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [3, 10], [5, 11], [4, 8], [4, 9], [8, 9], [10, 11]] },
    { name: "Andromeda", stars: [[0.50, 0.10], [0.38, 0.24], [0.28, 0.40], [0.20, 0.58], [0.62, 0.22], [0.72, 0.36], [0.80, 0.52], [0.44, 0.70], [0.34, 0.82]], lines: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [2, 7], [7, 8]] },
    { name: "Hercules", stars: [[0.50, 0.08], [0.36, 0.20], [0.26, 0.36], [0.32, 0.52], [0.44, 0.60], [0.56, 0.60], [0.68, 0.52], [0.74, 0.36], [0.64, 0.20], [0.40, 0.76], [0.60, 0.76], [0.30, 0.86], [0.70, 0.86]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0], [3, 9], [6, 10], [9, 11], [10, 12], [4, 5]] },
  ];

function generateConstellationPoints(
  seed: number,
  W: number, H: number,
  _mouseX: number, _mouseY: number
): { x: number; y: number }[] {
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };

  // Каждый раз разное созвездие на основе seed
  const idx = Math.floor(rng() * CONSTELLATIONS.length);
  const constellation = CONSTELLATIONS[idx];

  const cx = W * 0.5;
  const cy = H * 0.5;
  const size = Math.min(W, H) * 0.72;

  const screenStars = constellation.stars.map(([nx, ny]) => ({
    x: cx + (nx - 0.5) * size,
    y: cy + (ny - 0.5) * size,
  }));

  const pts: { x: number; y: number }[] = [];
  const usedEdges = new Set<string>();
  const edges = constellation.lines;
  const edgeKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
  const getNeighbors = (node: number) =>
    edges.filter(([a, b]) => (a === node || b === node) && !usedEdges.has(edgeKey(a, b)))
      .map(([a, b]) => a === node ? b : a);

  const STEPS = 30; // много точек между звёздами = плавная линия
  const interpolate = (from: { x: number, y: number }, to: { x: number, y: number }) => {
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      pts.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    }
  };

  let cur = 0;
  pts.push(screenStars[cur]);

  let safety = 0;
  while (usedEdges.size < edges.length && safety++ < 500) {
    const neighbors = getNeighbors(cur);
    if (neighbors.length === 0) {
      // Ищем вершину с доступными рёбрами
      let found = false;
      for (const [a, b] of edges) {
        if (!usedEdges.has(edgeKey(a, b))) {
          interpolate(screenStars[cur], screenStars[a]);
          cur = a;
          found = true;
          break;
        }
      }
      if (!found) break;
      continue;
    }
    const next = neighbors[0];
    usedEdges.add(edgeKey(cur, next));
    interpolate(screenStars[cur], screenStars[next]);
    cur = next;
  }

  return pts;
}

// Реальные 3D фигуры — вершины и рёбра в 3D, проецируются на 2D
// 4D политопы — вершины в 4D пространстве и рёбра между ними
// Проекция: 4D → 3D (стереографическая) → 2D (перспективная)

// 8-cell (Tesseract) — 16 вершин, 32 ребра
function makeTesseract() {
  const verts: number[][] = [];
  for (let x of [-1, 1]) for (let y of [-1, 1]) for (let z of [-1, 1]) for (let w of [-1, 1])
    verts.push([x, y, z, w]);
  const edges: [number, number][] = [];
  for (let i = 0; i < 16; i++)
    for (let j = i + 1; j < 16; j++) {
      let diff = 0;
      for (let k = 0; k < 4; k++) if (verts[i][k] !== verts[j][k]) diff++;
      if (diff === 1) edges.push([i, j]);
    }
  return { name: "Tesseract (8-cell)", verts, edges };
}

// 16-cell — 8 вершин, 24 ребра (все пары кроме противоположных)
function make16Cell() {
  const verts: number[][] = [
    [1, 0, 0, 0], [-1, 0, 0, 0], [0, 1, 0, 0], [0, -1, 0, 0],
    [0, 0, 1, 0], [0, 0, -1, 0], [0, 0, 0, 1], [0, 0, 0, -1],
  ];
  const edges: [number, number][] = [];
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++) {
      const dot = verts[i].reduce((s, v, k) => s + v * verts[j][k], 0);
      if (dot === 0) edges.push([i, j]); // перпендикулярные = соединены
    }
  return { name: "16-cell", verts, edges };
}

// 24-cell — 24 вершины (все перестановки ±1,±1,0,0), 96 рёбер
function make24Cell() {
  const verts: number[][] = [];
  const perms = [[0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0]];
  for (const p of perms)
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      const v = [0, 0, 0, 0];
      v[p[0]] = s1; v[p[1]] = s2;
      // Проверяем дубликаты
      if (!verts.some(u => u.every((x, i) => x === v[i]))) verts.push(v);
    }
  const edges: [number, number][] = [];
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++) {
      const d2 = verts[i].reduce((s, v, k) => s + (v - verts[j][k]) ** 2, 0);
      if (Math.abs(d2 - 2) < 0.001) edges.push([i, j]); // ребро длины √2
    }
  return { name: "24-cell", verts, edges };
}

// 600-cell approximation — икосаэдрическая симметрия в 4D, 120 вершин
function make600Cell() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts: number[][] = [];
  // Перестановки (±1, ±1, ±1, ±1) / 2
  for (let a of [-1, 1]) for (let b of [-1, 1]) for (let c of [-1, 1]) for (let d of [-1, 1])
    verts.push([a / 2, b / 2, c / 2, d / 2]);
  // Чётные перестановки (0, ±1, ±φ, ±1/φ) / 2
  const vals = [[0, 1, phi, 1 / phi], [0, 1, -phi, 1 / phi], [0, 1, phi, -1 / phi],
  [0, -1, phi, 1 / phi], [0, 1, -phi, -1 / phi], [0, -1, phi, -1 / phi],
  [0, -1, -phi, 1 / phi], [0, -1, -phi, -1 / phi]];
  for (const [a, b, c, d] of vals) {
    // Все чётные перестановки 4 элементов
    for (const perm of [[a, b, c, d], [b, c, d, a], [c, d, a, b], [d, a, b, c],
    [a, c, b, d], [b, d, a, c], [c, a, d, b], [d, b, c, a],
    [a, d, c, b], [b, a, d, c], [c, b, a, d], [d, c, b, a]])
      if (!verts.some(u => u.every((x, i) => Math.abs(x - perm[i] / 2) < 0.001)))
        verts.push(perm.map(x => x / 2));
  }
  // Берём только первые 120 вершин и строим рёбра длины 1/φ
  const v120 = verts.slice(0, 120);
  const edgeLen = 1 / phi;
  const edges: [number, number][] = [];
  for (let i = 0; i < v120.length; i++)
    for (let j = i + 1; j < v120.length; j++) {
      const d2 = v120[i].reduce((s, v, k) => s + (v - v120[j][k]) ** 2, 0);
      if (Math.abs(d2 - edgeLen * edgeLen) < 0.02) edges.push([i, j]);
    }
  return { name: "600-cell (partial)", verts: v120, edges: edges.slice(0, 300) };
}

// 120-cell — двойственный к 600-cell, 600 вершин (упрощённая версия)
function make120Cell() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts: number[][] = [];
  // Подмножество вершин через φ-based координаты
  const coords = [1, phi, 1 / phi, 0];
  for (const a of coords) for (const b of coords) for (const c of coords) for (const d of coords) {
    if (Math.abs(a * a + b * b + c * c + d * d - (1 + phi * phi + 1 / (phi * phi))) < 0.1)
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) for (const sc of [-1, 1]) for (const sd of [-1, 1]) {
        const v = [sa * a, sb * b, sc * c, sd * d];
        const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        if (Math.abs(norm - Math.sqrt(8)) < 0.01)
          if (!verts.some(u => u.every((x, i) => Math.abs(x - v[i]) < 0.001)))
            verts.push(v);
      }
  }
  const v = verts.slice(0, 80);
  const edges: [number, number][] = [];
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++) {
      const d2 = v[i].reduce((s, x, k) => s + (x - v[j][k]) ** 2, 0);
      if (d2 < 2.5 && d2 > 0.1) edges.push([i, j]);
    }
  return { name: "120-cell (partial)", verts: v, edges: edges.slice(0, 200) };
}

// Проекция 4D → 2D: сначала стереографическая 4D→3D, потом перспективная 3D→2D
function project4D(
  v4: number[], rotXY: number, rotXZ: number, rotXW: number,
  scale: number, cx: number, cy: number
): { x: number; y: number } {
  // Поворот в 4D (плоскость XY)
  const c1 = Math.cos(rotXY), s1 = Math.sin(rotXY);
  let [x, y, z, w] = v4;
  const x1 = x * c1 - y * s1, y1 = x * s1 + y * c1;
  // Поворот в плоскости XZ
  const c2 = Math.cos(rotXZ), s2 = Math.sin(rotXZ);
  const x2 = x1 * c2 - z * s2, z2 = x1 * s2 + z * c2;
  // Поворот в плоскости XW
  const c3 = Math.cos(rotXW), s3 = Math.sin(rotXW);
  const x3 = x2 * c3 - w * s3, w3 = x2 * s3 + w * c3;
  // Стереографическая проекция 4D→3D
  const fov4 = 2.5;
  const p4 = fov4 / (fov4 - w3);
  const px = x3 * p4, py = y1 * p4, pz = z2 * p4;
  // Перспективная проекция 3D→2D
  const fov3 = 3.5;
  const p3 = fov3 / (fov3 + pz);
  return { x: cx + px * scale * p3, y: cy + py * scale * p3 };
}

// Аттрактор Лоренца — хаотическая траектория в 3D
function makeLorenzAttractor(): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  let x = 0.1, y = 0, z = 0;
  const sigma = 10, rho = 28, beta = 8 / 3, dt = 0.005;
  for (let i = 0; i < 8000; i++) {
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (i > 500) pts.push({ x, y, z }); // пропускаем начальный переходный процесс
  }
  return pts;
}

// Двойная спираль ДНК
function makeDNAHelix(): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const turns = 5, steps = 600;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * Math.PI * 2;
    const z = (i / steps) * 4 - 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t), z });
  }
  // Вторая нить со смещением π
  for (let i = steps; i >= 0; i--) {
    const t = (i / steps) * turns * Math.PI * 2 + Math.PI;
    const z = (i / steps) * 4 - 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t), z });
  }
  // Перекладины
  for (let i = 0; i <= turns * 4; i++) {
    const t = (i / (turns * 4)) * turns * Math.PI * 2;
    const z = (i / (turns * 4)) * 4 - 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t), z });
    pts.push({ x: Math.cos(t + Math.PI), y: Math.sin(t + Math.PI), z });
    pts.push({ x: Math.cos(t), y: Math.sin(t), z });
  }
  return pts;
}

// Тор (бублик)
function makeTorusKnot(p: number, q: number): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const steps = 800;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = Math.cos(q * t) + 2;
    pts.push({
      x: r * Math.cos(p * t),
      y: r * Math.sin(p * t),
      z: -Math.sin(q * t),
    });
  }
  return pts;
}

// Кривые Лиссажу в 3D
function makeLissajous3D(a: number, b: number, c: number, delta: number): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const steps = 1000;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({
      x: Math.sin(a * t + delta),
      y: Math.sin(b * t),
      z: Math.sin(c * t + delta * 0.5),
    });
  }
  return pts;
}

// Спираль Фибоначчи в 3D (Золотой угол)
function makeFibonacciSpiral(): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const n = 500, golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const t = i * golden;
    const r = Math.sqrt(i / n);
    pts.push({ x: r * Math.cos(t), y: i / n * 2 - 1, z: r * Math.sin(t) });
  }
  // Соединяем точки по порядку — спираль
  return pts;
}

// Проецируем массив 3D точек в 2D
function project3DPoints(
  pts3d: { x: number; y: number; z: number }[],
  rotX: number, rotY: number,
  scale: number, cx: number, cy: number
): { x: number; y: number }[] {
  return pts3d.map(({ x, y, z }) => {
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const x1 = x * cosY - z * sinY, z1 = x * sinY + z * cosY;
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const y1 = y * cosX - z1 * sinX, z2 = y * sinX + z1 * cosX;
    const fov = 5 / (5 + z2);
    return { x: cx + x1 * scale * fov, y: cy + y1 * scale * fov };
  });
}

// Генерирует контурные точки текста через canvas
function generateTextPoints(text: string, W: number, H: number): { x: number; y: number }[] {
  const SCALE = 4;
  const cW = W * SCALE, cH = H * SCALE;
  const offscreen = document.createElement("canvas");
  offscreen.width = cW; offscreen.height = cH;
  const ctx = offscreen.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cW, cH);

  const lines = ["I DO", "DESIGN"];
  let fontSize = cW * 0.30;
  ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  while (ctx.measureText(lines[1]).width > cW * 0.86 && fontSize > 20) {
    fontSize *= 0.92;
    ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  }

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineH = fontSize * 1.15;
  lines.forEach((line, i) => ctx.fillText(line, cW / 2, cH / 2 - lineH / 2 + i * lineH));

  const imgData = ctx.getImageData(0, 0, cW, cH);
  const data = imgData.data;
  const pts: { x: number; y: number }[] = [];
  const step = SCALE * 2;
  for (let y = step; y < cH - step; y += step) {
    for (let x = step; x < cW - step; x += step) {
      const gx =
        -data[((y - step) * cW + (x - step)) * 4] - 2 * data[((y) * cW + (x - step)) * 4] - data[((y + step) * cW + (x - step)) * 4]
        + data[((y - step) * cW + (x + step)) * 4] + 2 * data[((y) * cW + (x + step)) * 4] + data[((y + step) * cW + (x + step)) * 4];
      const gy =
        -data[((y - step) * cW + (x - step)) * 4] - 2 * data[((y - step) * cW + (x)) * 4] - data[((y - step) * cW + (x + step)) * 4]
        + data[((y + step) * cW + (x - step)) * 4] + 2 * data[((y + step) * cW + (x)) * 4] + data[((y + step) * cW + (x + step)) * 4];
      if (Math.sqrt(gx * gx + gy * gy) > 50) pts.push({ x: x / SCALE, y: y / SCALE });
    }
  }
  // Змейка по строкам
  const ss = step / SCALE;
  pts.sort((a, b) => {
    const ra = Math.floor(a.y / ss), rb = Math.floor(b.y / ss);
    if (ra !== rb) return ra - rb;
    return ra % 2 === 0 ? a.x - b.x : b.x - a.x;
  });
  return pts;
}

// Знаменитые картины как векторные контуры — нормализованные координаты [0..1]
// Каждый массив — один непрерывный путь пера
async function generateArtworkPoints(url: string, W: number, H: number): Promise<{ x: number, y: number }[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const SCALE = 0.5;
      const cW = Math.round(W * SCALE), cH = Math.round(H * SCALE);
      const imgScale = Math.min(cW / img.width, cH / img.height) * 0.90;
      const sw = Math.round(img.width * imgScale), sh = Math.round(img.height * imgScale);
      const ox = Math.round((cW - sw) / 2), oy = Math.round((cH - sh) / 2);
      const canvas = document.createElement("canvas");
      canvas.width = cW; canvas.height = cH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cW, cH);
      ctx.drawImage(img, ox, oy, sw, sh);
      const { data } = ctx.getImageData(0, 0, cW, cH);

      // S=2 — вдвое быстрее, достаточно деталей
      const S = 2;
      const edgePts: { x: number, y: number, m: number }[] = [];
      let maxMag = 0;
      for (let y = S; y < cH - S; y += S) {
        for (let x = S; x < cW - S; x += S) {
          const g = (px: number, py: number) => { const o = (Math.min(py, cH - 1) * cW + Math.min(px, cW - 1)) * 4; return data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114; };
          const gx = -g(x - S, y - S) - 2 * g(x - S, y) - g(x - S, y + S) + g(x + S, y - S) + 2 * g(x + S, y) + g(x + S, y + S);
          const gy = -g(x - S, y - S) - 2 * g(x, y - S) - g(x + S, y - S) + g(x - S, y + S) + 2 * g(x, y + S) + g(x + S, y + S);
          const m = Math.sqrt(gx * gx + gy * gy);
          if (m > maxMag) maxMag = m;
          edgePts.push({ x, y, m });
        }
      }
      const threshold = maxMag * 0.13;
      const strong = edgePts.filter(p => p.m > threshold);
      strong.sort((a, b) => b.m - a.m);
      const top = strong.slice(0, 60000);
      if (top.length < 10) { resolve([]); return; }

      const STEP = S;
      const grid = new Map<string, number>();
      top.forEach((p, i) => grid.set(Math.round(p.x / STEP) + ',' + Math.round(p.y / STEP), i));
      const used = new Set<number>();
      const result: { x: number, y: number }[] = [];
      const invScale = 1 / SCALE;
      const offX = (W - cW * invScale) / 2, offY = (H - cH * invScale) / 2;

      for (let si = 0; si < top.length; si++) {
        if (used.has(si)) continue;
        const stroke: { x: number, y: number }[] = [];
        let cur = si;
        while (cur !== -1 && !used.has(cur)) {
          used.add(cur);
          stroke.push({ x: top[cur].x * invScale + offX, y: top[cur].y * invScale + offY });
          let next = -1, bestD = Infinity;
          const gx0 = Math.round(top[cur].x / STEP), gy0 = Math.round(top[cur].y / STEP);
          for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
            if (!dr && !dc) continue;
            const ni = grid.get((gx0 + dc) + ',' + (gy0 + dr));
            if (ni !== undefined && !used.has(ni)) { const d = (top[ni].x - top[cur].x) ** 2 + (top[ni].y - top[cur].y) ** 2; if (d < bestD) { bestD = d; next = ni; } }
          }
          cur = bestD < (STEP * 3) ** 2 ? next : -1;
        }
        if (stroke.length >= 3) { result.push(...stroke, { x: NaN, y: NaN }); }
        if (result.length > 100000) break;
      }
      resolve(result);
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}

const ARTWORKS = ["/art1.png", "/art2.png", "/art3.png", "/art4.png", "/art5.png", "/art6.png", "/art7.png", "/art8.png", "/art9.png", "/art10.png"];

// Спираль на торе — линия обвивает бублик p раз по большому кругу и q по малому
function makeTorusSpiral(R: number, r: number, p: number, q: number): { x: number, y: number, z: number }[] {
  const pts = [];
  for (let i = 0; i <= 800; i++) {
    const t = (i / 800) * Math.PI * 2 * p;
    const phi = t * q / p;
    pts.push({
      x: (R + r * Math.cos(phi)) * Math.cos(t),
      y: (R + r * Math.cos(phi)) * Math.sin(t),
      z: r * Math.sin(phi),
    });
  }
  return pts;
}

// Клейновская бутылка — 4D объект проецированный в 3D
function makeKleinBottle(): { x: number, y: number, z: number }[] {
  const pts = [];
  const U = 40, V = 40;
  for (let ui = 0; ui <= U; ui++) {
    const u = (ui / U) * Math.PI * 2;
    for (let vi = 0; vi <= V; vi++) {
      const v = (vi / V) * Math.PI * 2;
      let x, y, z;
      if (u < Math.PI) {
        x = 3 * Math.cos(u) * (1 + Math.sin(u)) + (2 * (1 - Math.cos(u) / 2)) * Math.cos(u) * Math.cos(v);
        y = 8 * Math.sin(u) + (2 * (1 - Math.cos(u) / 2)) * Math.sin(u) * Math.cos(v);
      } else {
        x = 3 * Math.cos(u) * (1 + Math.sin(u)) + (2 * (1 - Math.cos(u) / 2)) * Math.cos(v + Math.PI);
        y = 8 * Math.sin(u);
      }
      z = (2 * (1 - Math.cos(u) / 2)) * Math.sin(v);
      pts.push({ x: x / 10, y: y / 10, z: z / 5 });
    }
    if (ui < U) pts.push({ x: NaN, y: NaN, z: NaN });
  }
  return pts;
}

// Поверхность Боя — проекция проективной плоскости
function makeBoysSurface(): { x: number, y: number, z: number }[] {
  const pts = [];
  const N = 50;
  for (let ui = 0; ui <= N; ui++) {
    const u = (ui / N) * Math.PI;
    for (let vi = 0; vi <= N; vi++) {
      const v = (vi / N) * Math.PI;
      const x = (Math.sqrt(2) * Math.cos(2 * u) * Math.cos(v) * Math.cos(v) + Math.cos(u) * Math.sin(2 * v)) / (2 - Math.sqrt(2) * Math.sin(3 * u) * Math.sin(2 * v));
      const y = (Math.sqrt(2) * Math.sin(2 * u) * Math.cos(v) * Math.cos(v) - Math.sin(u) * Math.sin(2 * v)) / (2 - Math.sqrt(2) * Math.sin(3 * u) * Math.sin(2 * v));
      const z = (3 * Math.cos(v) * Math.cos(v)) / (2 - Math.sqrt(2) * Math.sin(3 * u) * Math.sin(2 * v));
      pts.push({ x, y: y, z: z - 1 });
    }
    if (ui < N) pts.push({ x: NaN, y: NaN, z: NaN });
  }
  return pts;
}

// Аттрактор Томаса — хаотическая 3D траектория
function makeThomasAttractor(): { x: number, y: number, z: number }[] {
  const pts = [];
  let x = 1, y = 0, z = 0;
  const b = 0.208186, dt = 0.05;
  for (let i = 0; i < 12000; i++) {
    const dx = Math.sin(y) - b * x;
    const dy = Math.sin(z) - b * y;
    const dz = Math.sin(x) - b * z;
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (i > 500) pts.push({ x: x / 3, y: y / 3, z: z / 3 });
  }
  return pts;
}

// Аттрактор Рёсслера
function makeRosslerAttractor(): { x: number, y: number, z: number }[] {
  const pts = [];
  let x = 1, y = 0, z = 0;
  const a = 0.2, b = 0.2, c = 5.7, dt = 0.02;
  for (let i = 0; i < 15000; i++) {
    const dx = -y - z;
    const dy = x + a * y;
    const dz = b + z * (x - c);
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (i > 200) pts.push({ x: x / 15, y: y / 15, z: z / 15 - 0.5 });
  }
  return pts;
}

// Поверхность Эннепера — минимальная поверхность
function makeEnneperSurface(): { x: number, y: number, z: number }[] {
  const pts = [];
  const N = 40;
  for (let ui = 0; ui <= N; ui++) {
    const u = (ui / N) * 2 - 1;
    for (let vi = 0; vi <= N; vi++) {
      const v = (vi / N) * 2 - 1;
      const x = u - u * u * u / 3 + u * v * v;
      const y = v - v * v * v / 3 + v * u * u;
      const z = u * u - v * v;
      pts.push({ x: x / 3, y: y / 3, z: z / 3 });
    }
    if (ui < N) pts.push({ x: NaN, y: NaN, z: NaN });
  }
  return pts;
}

// 600-cell wireframe — красивейший 4D политоп
function make600CellWire(): { x: number, y: number, z: number, w: number }[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts: number[][] = [];
  // 8 пермутаций (±1,0,0,0)
  for (const s of [-1, 1]) { verts.push([s, 0, 0, 0]); verts.push([0, s, 0, 0]); verts.push([0, 0, s, 0]); verts.push([0, 0, 0, s]); }
  // 16 пермутаций (±½,±½,±½,±½)
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) for (const d of [-1, 1])
    verts.push([a / 2, b / 2, c / 2, d / 2]);
  // 96 пермутаций с φ
  const half_phi = phi / 2, half_inv = 1 / (2 * phi), half_1 = 0.5;
  const combos = [[0, half_1, half_inv, half_phi], [half_1, half_inv, half_phi, 0], [half_inv, half_phi, 0, half_1], [half_phi, 0, half_1, half_inv]];
  for (const [a, b, c, d] of combos)
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) for (const sc of [-1, 1]) for (const sd of [-1, 1])
      verts.push([sa * a, sb * b, sc * c, sd * d]);
  return verts.map(v => ({ x: v[0], y: v[1], z: v[2], w: v[3] || 0 }));
}


// Логотипы брендов — нормализованные координаты, будут масштабированы на экран
function makeBrandPoints(seed: number, W: number, H: number): { x: number, y: number }[] {
  const cx = W * 0.5, cy = H * 0.5;
  const sz = Math.min(W, H) * 0.35;
  // map [0..1] -> screen with padding
  const m = (nx: number, ny: number) => ({ x: cx + (nx - 0.5) * sz, y: cy + (ny - 0.5) * sz });
  const nan = { x: NaN, y: NaN };

  const logos: { x: number, y: number }[][] = [
    // Nike swoosh
    [m(0.1, 0.55), m(0.18, 0.45), m(0.30, 0.40), m(0.45, 0.42), m(0.60, 0.48), m(0.75, 0.58), m(0.90, 0.72), m(0.85, 0.70), m(0.65, 0.55), m(0.48, 0.50), m(0.32, 0.52), m(0.20, 0.58), m(0.12, 0.62), m(0.10, 0.55)],
    // Apple — окружность с вырезом
    ...[Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return m(0.5 + 0.4 * Math.cos(a), 0.5 + 0.4 * Math.sin(a)); }),
    [nan],
    Array.from({ length: 20 }, (_, i) => { const a = -0.5 + i / 19 * 1.0; return m(0.5 + 0.15 * Math.cos(a), 0.22 + 0.12 * Math.sin(a)); }),
    ],
    // Twitter/X — буква X
    [m(0.2, 0.2), m(0.8, 0.8), nan, m(0.8, 0.2), m(0.2, 0.8)],
    // Mercedes — три луча в круге
    ...[
      Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return m(0.5 + 0.45 * Math.cos(a), 0.5 + 0.45 * Math.sin(a)); }),
      [nan],
      [m(0.5, 0.05), m(0.5, 0.5), nan, m(0.5, 0.5), m(0.88, 0.75), nan, m(0.5, 0.5), m(0.12, 0.75)],
    ],
    // BMW — четыре квадранта
    ...[
      Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return m(0.5 + 0.45 * Math.cos(a), 0.5 + 0.45 * Math.sin(a)); }),
      [nan],
      Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return m(0.5 + 0.30 * Math.cos(a), 0.5 + 0.30 * Math.sin(a)); }),
      [nan],
      [m(0.5, 0.05), m(0.5, 0.95), nan, m(0.05, 0.5), m(0.95, 0.5)],
    ],
    // Audi — четыре кольца
    ...[0, 1, 2, 3].map(i => [
      ...Array.from({ length: 60 }, (_, j) => { const a = (j / 60) * Math.PI * 2; return m(0.15 + i * 0.23 + 0.11 * Math.cos(a), 0.5 + 0.11 * Math.sin(a)); }),
      nan,
    ]),
    // Olympic rings  
    ...[0, 1, 2, 3, 4].map(i => [
      ...Array.from({ length: 60 }, (_, j) => { const a = (j / 60) * Math.PI * 2; const row = i % 2 === 0 ? 0 : 0.1; return m(0.1 + i * 0.2 + 0.09 * Math.cos(a), 0.45 + row + 0.09 * Math.sin(a)); }),
      nan,
    ]),
    // Star of David (гексаграмма)
    [...Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return m(0.5 + 0.4 * Math.cos(a), 0.5 + 0.4 * Math.sin(a)); }),
      nan,
    ...Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * Math.PI * 2 + Math.PI / 2; return m(0.5 + 0.4 * Math.cos(a), 0.5 + 0.4 * Math.sin(a)); })],
    // Буква A (Adidas-стиль)
    [m(0.5, 0.1), m(0.1, 0.9), m(0.28, 0.9), m(0.5, 0.4), m(0.72, 0.9), m(0.9, 0.9), m(0.5, 0.1), nan, m(0.28, 0.65), m(0.72, 0.65)],
    // Спираль галактики
    ...Array.from({ length: 3 }, (_, arm) => [
      ...Array.from({ length: 80 }, (_, i) => {
        const t = i / 79 * Math.PI * 4;
        const r = 0.05 + t * 0.07;
        const offset = arm * Math.PI * 2 / 3;
        return m(0.5 + r * Math.cos(t + offset), 0.5 + r * Math.sin(t + offset));
      }),
      nan,
    ]),
  ];

  const idx = seed % logos.length;
  return (logos[idx] as any).flat ? (logos[idx] as any).flat() as { x: number, y: number }[] : logos[idx] as { x: number, y: number }[];
}

// Строит трейл из рёбер политопа
function buildEdgeTrail(edges: [number, number][], projected: { x: number, y: number }[]): { x: number, y: number }[] {
  const result: { x: number, y: number }[] = [];
  const NaN_pt = { x: NaN, y: NaN };
  for (const [a, b] of edges) {
    const pa = projected[a], pb = projected[b];
    if (!pa || !pb || isNaN(pa.x) || isNaN(pb.x)) continue;
    result.push(pa, pb, NaN_pt);
  }
  return result;
}

function generate3DShapePoints(
  seed: number,
  W: number, H: number,
  _mouseX: number, _mouseY: number
): { x: number; y: number }[] {
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };

  const cx = W * 0.5, cy = H * 0.5;
  const rotX = rng() * Math.PI * 2;
  const rotY = rng() * Math.PI * 2;
  const shapeType = Math.floor(rng() * 18); // 16 типов

  // Непрерывные кривые — проецируем напрямую
  // Автоматически масштабирует и центрирует точки по экрану
  const fitToScreen = (pts: { x: number, y: number }[]) => {
    const valid = pts.filter(p => !isNaN(p.x));
    if (valid.length === 0) return pts;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    valid.forEach(p => { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; });
    const fw = maxX - minX || 1, fh = maxY - minY || 1;
    const scale = Math.min(W / fw, H / fh);
    const ox = cx - (minX + fw / 2) * scale;
    const oy = cy - (minY + fh / 2) * scale;
    return pts.map(p => isNaN(p.x) ? p : { x: p.x * scale + ox, y: p.y * scale + oy });
  };

  const scaleAndProject = (pts3d: { x: number, y: number, z: number }[], sc: number) =>
    fitToScreen(project3DPoints(pts3d.filter(p => !isNaN(p.x)), rotX, rotY, sc, cx, cy));

  const withNaN = (pts3d: { x: number, y: number, z: number }[], sc: number) => {
    const result: { x: number, y: number }[] = [];
    for (const p of pts3d) {
      if (isNaN(p.x)) result.push({ x: NaN, y: NaN });
      else {
        const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        const x1 = p.x * cosY - p.z * sinY, z1 = p.x * sinY + p.z * cosY;
        const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        const y1 = p.y * cosX - z1 * sinX, z2 = p.y * sinX + z1 * cosX;
        const fov = 5 / (5 + z2);
        result.push({ x: cx + x1 * sc * fov, y: cy + y1 * sc * fov });
      }
    }
    return fitToScreen(result);
  };

  if (shapeType === 0) return scaleAndProject(makeThomasAttractor(), Math.min(W, H) * 0.18);
  if (shapeType === 1) return scaleAndProject(makeDNAHelix(), Math.min(W, H) * 0.18);
  if (shapeType === 2) {
    // Два вложенных торических узла — сложное переплетение
    const a = makeTorusKnot(5, 3); const b = makeTorusKnot(7, 4);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b], Math.min(W, H) * 0.09);
  }
  if (shapeType === 3) {
    // Три Лиссажу разных фаз — объёмная звезда
    const a = makeLissajous3D(3, 4, 5, 0); const b = makeLissajous3D(3, 4, 5, Math.PI / 3); const c = makeLissajous3D(3, 4, 5, Math.PI * 2 / 3);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b, { x: NaN, y: NaN, z: NaN }, ...c], Math.min(W, H) * 0.18);
  }
  if (shapeType === 4) {
    // 4D Tesseract + 16-cell вместе
    const s4D = Math.min(W, H) * 0.10;
    const rotXY = rng() * Math.PI * 2, rotXZ = rng() * Math.PI * 2, rotXW = rng() * Math.PI * 2;
    const t = makeTesseract(); const c16 = make16Cell();
    const projT = t.verts.map(v => project4D(v, rotXY, rotXZ, rotXW, s4D, cx, cy));
    const projC = c16.verts.map(v => project4D(v, rotXY + 0.5, rotXZ + 0.5, rotXW + 0.3, s4D, cx, cy));
    const ptsT = buildEdgeTrail(t.edges, projT);
    const ptsC = buildEdgeTrail(c16.edges, projC);
    return [...ptsT, { x: NaN, y: NaN }, ...ptsC];
  }
  if (shapeType === 5) return scaleAndProject(makeLissajous3D(3, 4, 5, rng() * Math.PI), Math.min(W, H) * 0.20);
  if (shapeType === 6) return scaleAndProject(makeLissajous3D(5, 7, 8, rng() * Math.PI), Math.min(W, H) * 0.19);
  if (shapeType === 7) return scaleAndProject(makeLissajous3D(7, 11, 13, rng() * Math.PI), Math.min(W, H) * 0.19);
  // Типы 8-16: плотные кривые — создают красивую мозаику
  if (shapeType === 8) {
    // Два торических узла + Лиссажу — плотное переплетение
    const a = makeTorusKnot(5, 3); const b = makeTorusKnot(7, 4);
    const c = makeLissajous3D(3, 5, 7, rng() * Math.PI);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b, { x: NaN, y: NaN, z: NaN }, ...c], Math.min(W, H) * 0.14);
  }
  if (shapeType === 9) {
    // ДНК + торический узел — биоморфная форма
    const a = makeDNAHelix(); const b = makeTorusKnot(5, 2);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b], Math.min(W, H) * 0.16);
  }
  if (shapeType === 10) {
    // Три Лиссажу разных фаз — объёмная звезда
    const a = makeLissajous3D(3, 4, 5, 0); const b = makeLissajous3D(3, 4, 5, Math.PI / 3);
    const c = makeLissajous3D(3, 4, 5, Math.PI * 2 / 3);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b, { x: NaN, y: NaN, z: NaN }, ...c], Math.min(W, H) * 0.18);
  }
  if (shapeType === 11) {
    // Аттрактор Томаса + торический узел
    const a = makeThomasAttractor(); const b = makeTorusKnot(7, 3);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b], Math.min(W, H) * 0.14);
  }
  if (shapeType === 12) {
    // Лиссажу 5:7:8 + 7:11:13
    const a = makeLissajous3D(5, 7, 8, rng() * Math.PI); const b = makeLissajous3D(7, 11, 13, rng() * Math.PI);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b], Math.min(W, H) * 0.17);
  }
  if (shapeType === 13) {
    // Торическая спираль 7:13 + узел 11:5
    const a = makeTorusSpiral(1.5, 0.5, 7, 13); const b = makeTorusSpiral(2, 0.6, 11, 17);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b], Math.min(W, H) * 0.15);
  }
  if (shapeType === 14) {
    // Клейновская бутылка + Лиссажу
    const a = makeKleinBottle(); const b = makeLissajous3D(4, 5, 7, rng() * Math.PI);
    return withNaN([...a, { x: NaN, y: NaN, z: NaN }, ...b.map(p => ({ ...p, z: 0 }))], Math.min(W, H) * 0.12);
  }
  if (shapeType === 15) {
    // Поверхность Боя + торический узел
    const a = makeBoysSurface(); const b = makeTorusKnot(9, 4);
    return withNaN([...a, { x: NaN, y: NaN, z: NaN }, ...b.map(p => ({ ...p, z: p.z || 0 }))], Math.min(W, H) * 0.11);
  }
  if (shapeType === 16) {
    // ДНК + три торических узла
    const a = makeDNAHelix(); const b = makeTorusKnot(3, 2); const c = makeTorusKnot(5, 3);
    return scaleAndProject([...a, { x: NaN, y: NaN, z: NaN }, ...b, { x: NaN, y: NaN, z: NaN }, ...c], Math.min(W, H) * 0.14);
  }
  const scale4D = Math.min(W, H) * 0.09;
  const rotXY = rng() * Math.PI * 2, rotXZ = rng() * Math.PI * 2, rotXW = rng() * Math.PI * 2;
  const polytopes = [makeTesseract, make16Cell, make24Cell];
  const shape = polytopes[Math.floor(rng() * polytopes.length)]();
  const projected = shape.verts.map(v => project4D(v, rotXY, rotXZ, rotXW, scale4D, cx, cy));

  // Строим непрерывный трейл по рёбрам
  const pts: { x: number; y: number }[] = [];
  const used = new Set<string>();
  const key = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;

  let cur = 0;
  pts.push(projected[cur]);

  let safety = 0;
  while (used.size < shape.edges.length && safety++ < 2000) {
    const available = shape.edges.filter(([a, b]) =>
      (a === cur || b === cur) && !used.has(key(a, b))
    );

    if (available.length === 0) {
      const nextEdge = shape.edges.find(([a, b]) => !used.has(key(a, b)));
      if (!nextEdge) break;
      const next = nextEdge[0];
      const from = projected[cur], to = projected[next];
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        pts.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
      }
      cur = next;
      continue;
    }

    const [a, b] = available[0];
    const next = a === cur ? b : a;
    used.add(key(cur, next));

    const from = projected[cur], to = projected[next];
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      pts.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
    }
    cur = next;
  }

  return pts;
}


function ThumbItem({ thumb }: { thumb: Thumbnail }) {
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current && thumb.src) {
      imgRef.current.src = thumb.src;
    }
  }, [thumb.src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => {
        if (!ref.current) return;
        ref.current.style.transition = [
          "left 1.4s cubic-bezier(0.65,0,0.35,1)",
          "top 1.4s cubic-bezier(0.65,0,0.35,1)",
          "width 1.4s cubic-bezier(0.65,0,0.35,1)",
          "height 1.4s cubic-bezier(0.65,0,0.35,1)",
          "border-radius 1.4s cubic-bezier(0.65,0,0.35,1)",
        ].join(",");
        ref.current.style.left = `${thumb.dstX}px`;
        ref.current.style.top = `${thumb.dstY}px`;
        ref.current.style.width = `${thumb.dstSize}px`;
        ref.current.style.height = `${thumb.dstSize}px`;
        ref.current.style.borderRadius = "16px";
      });
      return () => cancelAnimationFrame(r2);
    });
    return () => cancelAnimationFrame(r1);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: `${thumb.srcX}px`,
        top: `${thumb.srcY}px`,
        width: `${thumb.srcW}px`,
        height: `${thumb.srcH}px`,
        borderRadius: "0px",
        overflow: "hidden",
        opacity: 1,
        pointerEvents: "none",
      }}
    >
      <img ref={imgRef} src={thumb.src} alt="" style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
    </div>
  );
}