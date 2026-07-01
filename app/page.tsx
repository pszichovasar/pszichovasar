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
  const SIZE = 280;
  const scale = Math.min(SIZE / Math.max(cropW, cropH, 1), 3);
  const w = Math.max(4, Math.round(cropW * scale));
  const h = Math.max(4, Math.round(cropH * scale));

  // 16 ярких цветов по всему спектру — явные RGB без HSL багов
  const ALL: [number, number, number][] = [
    [255, 0, 60], [255, 80, 0], [255, 200, 0], [180, 255, 0],
    [0, 255, 80], [0, 255, 220], [0, 140, 255], [80, 0, 255],
    [200, 0, 255], [255, 0, 180], [255, 120, 120], [120, 255, 120],
    [120, 120, 255], [255, 220, 100], [100, 255, 220], [220, 100, 255],
  ];
  // Случайное перемешивание → каждый узор уникален
  const COLORS = [...ALL].sort(() => Math.random() - 0.5);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Fallback — нет трейлов
  if (!trails.length || trails.every(t => t.length < 2)) {
    const [r, g, b] = COLORS[0];
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);
    return canvas.toDataURL("image/png");
  }

  // Тёмный фон (не чёрный, не белый — почти чёрный чтобы isLine работал)
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  // Разделители — тёмно-серые (не белые!) чтобы flood-fill их видел как границы
  ctx.strokeStyle = "#404040";
  ctx.lineWidth = Math.max(2, Math.round(2 * scale));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  trails.forEach(trail => {
    if (trail.length < 2) return;
    ctx.beginPath();
    ctx.moveTo((trail[0].x - minX) * scale, (trail[0].y - minY) * scale);
    for (let j = 1; j < trail.length; j++) {
      ctx.lineTo((trail[j].x - minX) * scale, (trail[j].y - minY) * scale);
    }
    ctx.stroke();
  });

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const n = w * h;

  // Граница = пиксель достаточно серый (R > 40)
  const isBorder = (i: number) => data[i * 4] > 25;
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  const recentColors: number[] = [];

  for (let start = 0; start < n; start++) {
    if (visited[start] || isBorder(start)) continue;
    // Выбираем случайный цвет, исключая последние 4 использованных
    let ci = Math.floor(Math.random() * COLORS.length);
    for (let attempt = 0; attempt < 8; attempt++) {
      if (!recentColors.includes(ci)) break;
      ci = Math.floor(Math.random() * COLORS.length);
    }
    recentColors.push(ci);
    if (recentColors.length > 4) recentColors.shift();
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

  // Закрашиваем края canvas чёрным чтобы убрать артефакты заливки
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, 3);
  ctx.fillRect(0, h - 3, w, 3);
  ctx.fillRect(0, 0, 3, h);
  ctx.fillRect(w - 3, 0, 3, h);

  // Тонкие чёрные линии поверх — аккуратный контур витража
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(0.5, 0.4 * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  trails.forEach(trail => {
    if (trail.length < 2) return;
    ctx.beginPath();
    ctx.moveTo((trail[0].x - minX) * scale, (trail[0].y - minY) * scale);
    for (let j = 1; j < trail.length; j++) {
      ctx.lineTo((trail[j].x - minX) * scale, (trail[j].y - minY) * scale);
    }
    ctx.stroke();
  });

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
async function generateArtworkPoints(url: string, W: number, H: number): Promise<{ x: number; y: number }[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(W / img.width, H / img.height) * 0.90;
      const sw = img.width * scale, sh = img.height * scale;
      const ox = (W - sw) / 2, oy = (H - sh) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, ox, oy, sw, sh);
      const { data } = ctx.getImageData(0, 0, W, H);

      // Шаг 1: Sobel на каждом пикселе (без прореживания)
      const S = 2; // очень мелкий шаг → плавные линии
      const cols = Math.floor(W / S);
      const rows = Math.floor(H / S);
      const mag = new Float32Array(cols * rows);
      let maxMag = 0;

      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const gv = (dc: number, dr: number) => {
            const px = Math.min((c + dc) * S, W - 1);
            const py = Math.min((r + dr) * S, H - 1);
            const o = (py * W + px) * 4;
            return data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114;
          };
          const gx = -gv(-1, -1) - 2 * gv(-1, 0) - gv(-1, 1) + gv(1, -1) + 2 * gv(1, 0) + gv(1, 1);
          const gy = -gv(-1, -1) - 2 * gv(0, -1) - gv(1, -1) + gv(-1, 1) + 2 * gv(0, 1) + gv(1, 1);
          const m = Math.sqrt(gx * gx + gy * gy);
          mag[r * cols + c] = m;
          if (m > maxMag) maxMag = m;
        }
      }

      // Шаг 2: Non-maximum suppression — оставляем только локальные максимумы
      // Это делает линии тонкими и чёткими (1 пиксель в ширину)
      const edge = new Uint8Array(cols * rows);
      const threshold = maxMag * 0.25;
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const m = mag[r * cols + c];
          if (m < threshold) continue;
          // Проверяем что это локальный максимум среди соседей
          let isMax = true;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              if (mag[(r + dr) * cols + (c + dc)] > m) { isMax = false; break; }
            }
            if (!isMax) break;
          }
          if (isMax) edge[r * cols + c] = 1;
        }
      }

      // Шаг 3: Трассировка контуров — обходим связные цепочки краёв
      // Каждый штрих = один непрерывный контур
      const visited = new Uint8Array(cols * rows);
      const result: { x: number; y: number }[] = [];
      const dirs8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

      // Строим штрихи начиная с сильнейших краёв
      const edgeList: [number, number, number][] = []; // [r, c, mag]
      for (let r = 1; r < rows - 1; r++)
        for (let c = 1; c < cols - 1; c++)
          if (edge[r * cols + c]) edgeList.push([r, c, mag[r * cols + c]]);
      edgeList.sort((a, b) => b[2] - a[2]); // сначала сильные

      for (const [sr, sc] of edgeList) {
        if (visited[sr * cols + sc]) continue;

        // Жадная трассировка контура
        const stroke: { x: number; y: number }[] = [];
        let r = sr, c = sc;

        while (edge[r * cols + c] && !visited[r * cols + c]) {
          visited[r * cols + c] = 1;
          stroke.push({ x: c * S, y: r * S });

          let next: [number, number] | null = null;
          let bestM = -1;
          for (const [dr, dc] of dirs8) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && edge[nr * cols + nc] && !visited[nr * cols + nc]) {
              const m = mag[nr * cols + nc];
              if (m > bestM) { bestM = m; next = [nr, nc]; }
            }
          }
          if (!next) break;
          [r, c] = next;
        }

        // Сглаживаем штрих — интерполируем через catmull-rom
        if (stroke.length >= 3) {
          const smoothed: { x: number; y: number }[] = [];
          smoothed.push(stroke[0]);
          for (let i = 1; i < stroke.length - 1; i++) {
            // Среднее между соседями — убирает ступеньки
            smoothed.push({
              x: (stroke[i - 1].x + stroke[i].x * 2 + stroke[i + 1].x) / 4,
              y: (stroke[i - 1].y + stroke[i].y * 2 + stroke[i + 1].y) / 4,
            });
          }
          smoothed.push(stroke[stroke.length - 1]);
          result.push(...smoothed);
          result.push({ x: NaN, y: NaN });
        } else if (stroke.length > 0) {
          result.push(...stroke);
          result.push({ x: NaN, y: NaN });
        }

        if (result.length > 8000) break;
      }

      resolve(result);
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}

const ARTWORKS = ["/art1.png", "/art2.png", "/art3.png", "/art4.png"];

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

  // Случайно выбираем тип фигуры
  const shapeType = Math.floor(rng() * 9);

  // Непрерывные кривые — проецируем напрямую
  if (shapeType === 0) {
    // Аттрактор Лоренца
    const pts3d = makeLorenzAttractor();
    const scale = Math.min(W, H) * 0.008;
    return project3DPoints(pts3d, rotX, rotY, scale, cx, cy);
  }
  if (shapeType === 1) {
    // ДНК двойная спираль
    const pts3d = makeDNAHelix();
    const scale = Math.min(W, H) * 0.28;
    return project3DPoints(pts3d, rotX, rotY, scale, cx, cy);
  }
  if (shapeType === 2) {
    // Торический узел (3,2) — трилистник
    const pts3d = makeTorusKnot(3, 2);
    const scale = Math.min(W, H) * 0.22;
    return project3DPoints(pts3d, rotX, rotY, scale, cx, cy);
  }
  if (shapeType === 3) {
    // Торический узел (5,3)
    const pts3d = makeTorusKnot(5, 3);
    const scale = Math.min(W, H) * 0.22;
    return project3DPoints(pts3d, rotX, rotY, scale, cx, cy);
  }
  if (shapeType === 4) {
    // Кривые Лиссажу 3:4:5
    const pts3d = makeLissajous3D(3, 4, 5, rng() * Math.PI);
    const scale = Math.min(W, H) * 0.32;
    return project3DPoints(pts3d, rotX, rotY, scale, cx, cy);
  }
  if (shapeType === 5) {
    // Кривые Лиссажу 2:3:4
    const pts3d = makeLissajous3D(2, 3, 4, rng() * Math.PI);
    const scale = Math.min(W, H) * 0.32;
    return project3DPoints(pts3d, rotX, rotY, scale, cx, cy);
  }
  if (shapeType === 6) {
    // Спираль Фибоначчи
    const pts3d = makeFibonacciSpiral();
    const scale = Math.min(W, H) * 0.38;
    return project3DPoints(pts3d, rotX, rotY, scale, cx, cy);
  }

  // 4D политопы с рёбрами
  const scale4D = Math.min(W, H) * 0.14;
  const rotXY = rng() * Math.PI * 2;
  const rotXZ = rng() * Math.PI * 2;
  const rotXW = rng() * Math.PI * 2;

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
  const MI_PHOTOS = ["/mi1.jpg", "/mi2.jpg", "/mi3.jpg", "/mi4.jpg", "/mi5.jpg"];
  const [artemPhoto, setArtemPhoto] = useState<{
    id: number; src: string; x: number; y: number; size: number;
    phase: "in" | "show" | "out";
  } | null>(null);
  const artemSlideIdRef = useRef(0);
  const artemTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Слайдшоу mi1–mi5 на секции "MY NAME IS ARTEM"
  useEffect(() => {
    const SIZE = 280;
    const SHOW = 3500, IN = 600, OUT = 500, PAUSE = 1200;
    let lastId = 0;

    const showNext = () => {
      // Показываем только когда секция видна
      if (videoOpacityRef.current < 0.3) {
        artemTimerRef.current = setTimeout(showNext, 1000);
        return;
      }
      const W = window.innerWidth, H = window.innerHeight;
      const src = MI_PHOTOS[Math.floor(Math.random() * MI_PHOTOS.length)];
      const x = SIZE / 2 + Math.random() * (W - SIZE);
      const y = SIZE / 2 + Math.random() * (H - SIZE);
      artemSlideIdRef.current++;
      const id = artemSlideIdRef.current;
      lastId = id;
      setArtemPhoto({ id, src, x, y, size: SIZE, phase: "in" });
      artemTimerRef.current = setTimeout(() => {
        setArtemPhoto(p => p?.id === id ? { ...p, phase: "show" } : p);
        artemTimerRef.current = setTimeout(() => {
          setArtemPhoto(p => p?.id === id ? { ...p, phase: "out" } : p);
          artemTimerRef.current = setTimeout(() => {
            setArtemPhoto(null);
            artemTimerRef.current = setTimeout(showNext, PAUSE);
          }, OUT);
        }, SHOW);
      }, IN);
    };

    artemTimerRef.current = setTimeout(showNext, 1000);
    return () => { if (artemTimerRef.current) clearTimeout(artemTimerRef.current); };
  }, []);

  useEffect(() => {
    const canvas = trailCanvasRef.current;

    const clearCanvas = () => {
      const c = trailCanvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    };

    const makeMosaic = (trails: { x: number, y: number }[][]) => {
      const c = trailCanvasRef.current;
      if (!c || trails.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      trails.forEach(t => t.forEach(p => {
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

    // Фаза 0: собираем трейлы кубиков → мозаика, затем через 10 сек фаза 1
    // Фаза 1: рисуем 3D фигуру 10 сек → мозаика, затем через 10 сек фаза 0
    let schedTimer: ReturnType<typeof setTimeout> | null = null;
    const activeRef = { current: true };
    let artworkIdx = 0;
    // Предзагружаем все картины сразу — чтобы в runPhase3 не было async задержки
    const preloadedArtworks: ({ x: number; y: number }[])[] = [];
    Promise.all(ARTWORKS.map(url =>
      generateArtworkPoints(url, window.innerWidth, window.innerHeight)
    )).then(results => {
      preloadedArtworks.push(...results);
      console.log("Artworks preloaded:", results.map(r => r.length));
    });

    // Общая функция отрисовки любого набора точек → мозаика → следующая фаза
    const runDrawPhase = (pts: { x: number; y: number }[], onDone: () => void) => {
      if (!activeRef.current || pts.length === 0) { onDone(); return; }
      autoDrawActiveRef.current = true;
      physState.current.forEach(s => { s.trail = []; });
      clearCanvas();
      const totalDuration = 10000;
      const startTime = performance.now();
      let idx = 0;
      // Максимальный прыжок между точками — если больше, поднимаем перо
      const maxJump = 20;
      const drawNext = () => {
        if (!activeRef.current || !autoDrawActiveRef.current) return;
        const c = trailCanvasRef.current;
        if (!c) return;
        const elapsed = performance.now() - startTime;
        const targetIdx = Math.min(Math.floor((elapsed / totalDuration) * pts.length), pts.length);
        if (targetIdx > idx) {
          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.lineWidth = 1.2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = "rgba(255,255,255,0.92)";
            ctx.beginPath();
            let penDown = false;
            let prevX = 0, prevY = 0;
            for (let i = idx; i <= targetIdx && i < pts.length; i++) {
              const p = pts[i];
              if (isNaN(p.x)) {
                if (penDown) { ctx.stroke(); ctx.beginPath(); penDown = false; }
              } else if (!penDown) {
                ctx.moveTo(p.x, p.y);
                prevX = p.x; prevY = p.y;
                penDown = true;
              } else {
                // Плавная кривая через средние точки
                const mx = (prevX + p.x) / 2;
                const my = (prevY + p.y) / 2;
                ctx.quadraticCurveTo(prevX, prevY, mx, my);
                prevX = p.x; prevY = p.y;
              }
            }
            if (penDown) ctx.stroke();
          }
          idx = targetIdx;
        }
        if (idx < pts.length) {
          requestAnimationFrame(drawNext);
        } else {
          if (!activeRef.current) return;
          autoDrawActiveRef.current = false;
          makeMosaic([pts]);
          clearCanvas();
          physState.current.forEach(s => { s.trail = []; });
          schedTimer = setTimeout(onDone, 100);
        }
      };
      requestAnimationFrame(drawNext);
    };

    // Фаза 0: трейлы кубиков 10 сек → мозаика
    const runPhase0 = () => {
      if (!activeRef.current) return;
      autoDrawActiveRef.current = false;
      schedTimer = setTimeout(() => {
        if (!activeRef.current) return;
        const trails = physState.current.filter(s => s.trail.length > 1).map(s => s.trail.slice());
        physState.current.forEach(s => { s.trail = []; });
        clearCanvas();
        makeMosaic(trails);
        schedTimer = setTimeout(runPhase1, 100);
      }, 10000);
    };

    // Фаза 1: 3D/4D фигура
    const runPhase1 = () => {
      if (!activeRef.current) return;
      const W = window.innerWidth, H = window.innerHeight;
      const pts = generate3DShapePoints(Math.floor(Math.random() * 999999), W, H, 0, 0);
      runDrawPhase(pts, runPhase3);
    };

    // Фаза 3: произведение искусства (синхронно из предзагруженного)
    const runPhase3 = () => {
      if (!activeRef.current) return;
      const idx = artworkIdx % ARTWORKS.length;
      artworkIdx++;
      const pts = preloadedArtworks[idx];
      console.log("Phase3: artwork", idx, "pts:", pts?.length ?? "not ready");
      if (pts && pts.length > 10) {
        runDrawPhase(pts, runPhase0);
      } else {
        // Ещё не загружено — грузим на месте
        const W = window.innerWidth, H = window.innerHeight;
        generateArtworkPoints(ARTWORKS[idx], W, H).then(loaded => {
          if (!activeRef.current) return;
          if (loaded.length > 10) runDrawPhase(loaded, runPhase0);
          else runPhase0();
        });
      }
    };

    // Старт
    runPhase0();

    const onMouseMove = (e: MouseEvent) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      activeRef.current = false;
      autoDrawActiveRef.current = false;
      if (schedTimer) clearTimeout(schedTimer);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  useEffect(() => {
    const DAMPING = 0.988, MAX_SPEED = 1400, BOUNCE = 0.35, CORRECTION_BIAS = 0.4;
    const ROT_DAMPING = 0.985, MAX_ROT_SPEED = 14;

    const animate = (time: number) => {
      const dt = lastTimeRef.current ? Math.min((time - lastTimeRef.current) / 1000, 0.05) : 0.016;
      lastTimeRef.current = time;
      const W = window.innerWidth, H = window.innerHeight, S = getImgSize();
      const states = physState.current;

      states.forEach((s, i) => {
        if (!s.initialized) {
          s.x = FLOATING_INIT[i].x / 100 * W; s.y = FLOATING_INIT[i].y / 100 * H;
          s.vx = FLOATING_INIT[i].vx; s.vy = FLOATING_INIT[i].vy;
          s.ang = FLOATING_INIT[i].rotation * Math.PI / 180;
          s.rotSpeed = FLOATING_INIT[i].rotSpeed * Math.PI / 180;
          s.initialized = true;
        }
      });

      for (let i = 0; i < IMG_COUNT; i++) {
        for (let j = i + 1; j < IMG_COUNT; j++) {
          const a = states[i], b = states[j];
          const r = obbCollide(a.x, a.y, a.ang, b.x, b.y, b.ang, S);
          if (!r) continue;
          const { overlap, nx, ny } = r, cor = overlap * CORRECTION_BIAS;
          a.x += nx * cor; a.y += ny * cor; b.x -= nx * cor; b.y -= ny * cor;
          const relVn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (relVn < 0) {
            const imp = -(1 + BOUNCE) * relVn / 2;
            a.vx += imp * nx; a.vy += imp * ny; b.vx -= imp * nx; b.vy -= imp * ny;
          }
        }
      }

      const { gx, gy } = gyroRef.current;
      states.forEach((s, i) => {
        s.vx += gx * dt; s.vy += gy * dt;
        s.vx *= DAMPING; s.vy *= DAMPING;
        const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        if (sp > MAX_SPEED) { s.vx = s.vx / sp * MAX_SPEED; s.vy = s.vy / sp * MAX_SPEED; }
        s.rotSpeed *= ROT_DAMPING;
        if (s.rotSpeed > MAX_ROT_SPEED) s.rotSpeed = MAX_ROT_SPEED;
        if (s.rotSpeed < -MAX_ROT_SPEED) s.rotSpeed = -MAX_ROT_SPEED;
        s.x += s.vx * dt; s.y += s.vy * dt; s.ang += s.rotSpeed * dt;
        const h = S / 2;
        if (s.x < h) { s.x = h; s.vx = Math.abs(s.vx) * BOUNCE; }
        if (s.x > W - h) { s.x = W - h; s.vx = -Math.abs(s.vx) * BOUNCE; }
        if (s.y < h) { s.y = h; s.vy = Math.abs(s.vy) * BOUNCE; }
        if (s.y > H - h) { s.y = H - h; s.vy = -Math.abs(s.vy) * BOUNCE; }
        const el = floatingRefs.current[i];
        if (el) {
          el.style.left = `${s.x - h}px`; el.style.top = `${s.y - h}px`;
          el.style.width = `${S}px`; el.style.height = `${S}px`;
          el.style.transform = `rotate(${s.ang}rad)`;
        }
      });

      // Коллизия с "I DO DESIGN" swept AABB
      const textEl = iDoDesignTextRef.current;
      if (textEl) {
        const r = textEl.getBoundingClientRect();
        const prev = prevTextRectRef.current;
        const vis = r.width > 10 && r.height > 10 && r.top < H && r.bottom > 0 && r.left < W && r.right > 0;
        if (vis) {
          const h = S / 2;
          const uL = Math.min(r.left, prev ? prev.left : r.left) - h;
          const uR = Math.max(r.right, prev ? prev.right : r.right) + h;
          const uT = Math.min(r.top, prev ? prev.top : r.top) - h;
          const uB = Math.max(r.bottom, prev ? prev.bottom : r.bottom) + h;
          for (let i = 0; i < IMG_COUNT; i++) {
            const s = states[i]; if (!s.initialized) continue;
            if (s.x <= uL || s.x >= uR || s.y <= uT || s.y >= uB) continue;
            const dL = s.x - uL, dR = uR - s.x, dT = s.y - uT, dB = uB - s.y;
            const minD = Math.min(dL, dR, dT, dB);
            let nx = 0, ny = 0;
            if (minD === dL) nx = -1; else if (minD === dR) nx = 1;
            else if (minD === dT) ny = -1; else ny = 1;
            s.x += nx * (minD + 0.5); s.y += ny * (minD + 0.5);
            const vn = s.vx * nx + s.vy * ny;
            if (vn < 0) { s.vx -= vn * nx * (1 + BOUNCE); s.vy -= vn * ny * (1 + BOUNCE); }
          }
        }
        prevTextRectRef.current = vis ? r : null;
      }

      // Трейлы
      const trailCanvas = trailCanvasRef.current;
      if (trailCanvas && !autoDrawActiveRef.current) {
        const ctx = trailCanvas.getContext("2d");
        if (ctx) {
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.lineCap = "round";
          states.forEach(s => {
            if (!s.initialized) return;
            const last = s.trail[s.trail.length - 1];
            if (last) { ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(s.x, s.y); ctx.stroke(); }
            s.trail.push({ x: s.x, y: s.y });
          });
        }
      } else if (autoDrawActiveRef.current) {
        // Очищаем трейлы кубиков чтобы они не накапливались
        states.forEach(s => { s.trail = []; });
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const openImg = (src: string) => {
    setSelectedImg(src);
    requestAnimationFrame(() => requestAnimationFrame(() => setImgVisible(true)));
  };
  const closeImg = () => { setImgVisible(false); setTimeout(() => setSelectedImg(null), 400); };

  const hitTestFloating = (cx: number, cy: number): string | null => {
    const S = getImgSize(), h = S / 2, states = physState.current;
    for (let i = IMG_COUNT - 1; i >= 0; i--) {
      const s = states[i]; if (!s.initialized) continue;
      const dx = cx - s.x, dy = cy - s.y;
      const cos = Math.cos(-s.ang), sin = Math.sin(-s.ang);
      if (Math.abs(dx * cos - dy * sin) <= h && Math.abs(dx * sin + dy * cos) <= h)
        return FLOATING_INIT[i].src;
    }
    return null;
  };

  const openContact = () => {
    setShowContact(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setContactVisible(true)));
  };
  const closeContact = () => { setContactVisible(false); setTimeout(() => setShowContact(false), 500); };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm({ ...form, message: e.target.value.toUpperCase() });
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) { alert("PLEASE FILL IN ALL FIELDS"); return; }
    setIsSending(true);
    try {
      const response = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (response.ok && data.success) {
        alert("MESSAGE SENT SUCCESSFULLY!");
        setForm({ name: "", email: "", message: "", service: "ILLUSTRATION" });
        closeContact();
      } else { alert(`ERROR: ${data.error || 'UNKNOWN_ERROR'}`); }
    } catch (error: any) { alert(`FETCH_FAILED: ${error?.message || 'SERVER_UNREACHABLE'}`); }
    finally { setIsSending(false); }
  };

  useEffect(() => {
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) setVideoSrc("/iome.mp4");
  }, []);

  useEffect(() => {
    const video = videoRef.current; if (!video) return;
    video.load();
    const h = () => video.play().catch(() => { });
    video.addEventListener('canplay', h);
    return () => video.removeEventListener('canplay', h);
  }, [videoSrc]);

  const calcTileSize = () => Math.floor((window.innerHeight - GAP * 6) / 5);
  const getRowWidth = () => (calcTileSize() + GAP) * ALL_IMAGES.length + GAP;

  const iDoDesignRef = useRef<HTMLDivElement>(null);
  const thumbContainerRef = useRef<HTMLDivElement>(null);
  const thumbPatternRef = useRef<HTMLDivElement>(null);

  // Текущий сдвиг iDoDesignRef в пикселях (нужен для корректировки координат)
  const getCurrentTyPx = () => {
    const unit = scrollRef.current / SCROLL_PER_UNIT;
    let ty: number;
    if (unit <= 0.35) ty = (1 - unit / 0.35) * 110;
    else if (unit <= 0.75) ty = -((unit - 0.35) / 0.4) * 110;
    else ty = -110;
    return ty / 100 * window.innerHeight;
  };

  const applyAnimations = (scrollY: number, deltaY = 0) => {
    const unit = scrollY / SCROLL_PER_UNIT;
    setPinkOpacity(Math.max(0, 1 - Math.max(0, (unit - 0.8) / 0.4)));
    if (iDoDesignRef.current) {
      let ty: number;
      if (unit <= 0.35) ty = (1 - unit / 0.35) * 110;
      else if (unit <= 0.75) ty = -((unit - 0.35) / 0.4) * 110;
      else ty = -110;
      iDoDesignRef.current.style.transform = `translateY(${ty}vh)`;
      iDoDesignRef.current.style.opacity =
        unit < 0.02 ? "0" : unit < 0.08 ? String((unit - 0.02) / 0.06)
          : unit > 0.65 ? String(Math.max(0, 1 - (unit - 0.65) / 0.1)) : "1";
    }
    // thumbContainer двигается вместе с iDoDesignRef (тот же translateY)
    if (thumbContainerRef.current) {
      const unit2 = scrollY / SCROLL_PER_UNIT;
      let ty2: number;
      if (unit2 <= 0.35) ty2 = (1 - unit2 / 0.35) * 110;
      else if (unit2 <= 0.75) ty2 = -((unit2 - 0.35) / 0.4) * 110;
      else ty2 = -110;
      thumbContainerRef.current.style.transform = `translateY(${ty2}vh)`;
      if (thumbPatternRef.current) {
        thumbPatternRef.current.style.transform = `translateY(${ty2}vh)`;
      }
    }
    if (deltaY > 0 && unit < 0.9) physState.current.forEach(s => { if (!s.initialized) return; s.vy -= Math.min(deltaY * 18, 900); s.rotSpeed += (Math.random() - 0.5) * 4; });
    else if (deltaY < 0 && unit < 0.9) physState.current.forEach(s => { if (!s.initialized) return; s.vy += Math.min(Math.abs(deltaY) * 18, 900); s.rotSpeed += (Math.random() - 0.5) * 4; });
    const vw = window.innerWidth, rw = getRowWidth();
    trackRefs.current.forEach((track, i) => {
      if (!track) return;
      const rev = REVERSED[i], oR = vw, oL = -rw;
      const sX = rev ? oL : oR, eX = rev ? oR : oL;
      if (unit < 1) { track.style.opacity = "0"; track.style.transform = `translate3d(${sX}px,0,0)`; }
      else if (unit <= 2) { const x = sX + (eX - sX) * (unit - 1); track.style.opacity = "1"; track.style.transform = `translate3d(${x}px,0,0)`; }
      else { track.style.opacity = "0"; track.style.transform = `translate3d(${eX}px,0,0)`; }
    });

    const tPhase = Math.max(0, Math.min((unit - 2.2) / 0.5, 1));
    setVideoOpacity(tPhase);
    videoOpacityRef.current = tPhase;
    if (videoRef.current) videoRef.current.style.opacity = tPhase.toString();
    if (textRef.current) {
      textRef.current.style.opacity = tPhase.toString();
      textRef.current.style.transform = `translate3d(0,${(1 - tPhase) * 40}px,0)`;
      textRef.current.style.pointerEvents = tPhase > 0 ? "auto" : "none";
    }
  };

  const mainRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (showContact) return; e.preventDefault();
      scrollRef.current = Math.max(0, Math.min(scrollRef.current + e.deltaY, TOTAL_SCROLL));
      applyAnimations(scrollRef.current, e.deltaY);
    };
    let tSY = 0, tSX = 0, tMoved = false;
    const onTS = (e: TouchEvent) => {
      if (showContact) return; tSY = e.touches[0].clientY; tSX = e.touches[0].clientX; tMoved = false;
      videoRef.current?.paused && videoRef.current.play().catch(() => { });
    };
    const onTM = (e: TouchEvent) => {
      if (showContact) return; e.preventDefault();
      const dy = tSY - e.touches[0].clientY, dx = Math.abs(tSX - e.touches[0].clientX);
      if (Math.abs(dy) > 5 || dx > 5) tMoved = true; tSY = e.touches[0].clientY;
      scrollRef.current = Math.max(0, Math.min(scrollRef.current + dy * 2.5, TOTAL_SCROLL));
      applyAnimations(scrollRef.current, dy * 2.5);
    };
    const onTE = (e: TouchEvent) => {
      if (showContact || selectedImg) return;
      if (!tMoved) {
        const t = e.changedTouches[0];
        if (cursorRef.current) {
          cursorRef.current.style.transition = "transform 0.9s cubic-bezier(0.16,1,0.3,1),opacity 0.3s ease";
          cursorRef.current.style.transform = `translate(${t.clientX}px,${t.clientY}px)`;
          cursorRef.current.style.opacity = "1";
        }
        const hit = hitTestFloating(t.clientX, t.clientY);
        if (hit) openImg(hit); else explodeFromPoint(t.clientX, t.clientY, 9999, 60000);
      }
    };
    const el = mainRef.current; if (!el) return;
    window.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTS, { passive: true });
    el.addEventListener("touchmove", onTM, { passive: false });
    el.addEventListener("touchend", onTE, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTS);
      el.removeEventListener("touchmove", onTM);
      el.removeEventListener("touchend", onTE);
    };
  }, [showContact, selectedImg]);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); if (isMobile) return;
    if (cursorRef.current) { cursorRef.current.style.opacity = "1"; cursorRef.current.style.transition = "none"; }
    const onMM = (e: MouseEvent) => {
      if (cursorRef.current) { cursorRef.current.style.transition = "none"; cursorRef.current.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; cursorRef.current.style.opacity = "1"; }
    };
    window.addEventListener("mousemove", onMM);
    return () => window.removeEventListener("mousemove", onMM);
  }, []);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); if (isMobile) return;
    const onMM = (e: MouseEvent) => { if (showContact || selectedImg) return; explodeFromPoint(e.clientX, e.clientY); };
    const onClick = (e: MouseEvent) => { if (showContact || selectedImg) return; const hit = hitTestFloating(e.clientX, e.clientY); if (hit) openImg(hit); };
    window.addEventListener("mousemove", onMM);
    const ov = overlayRef.current; if (ov) ov.addEventListener("click", onClick);
    return () => { window.removeEventListener("mousemove", onMM); if (ov) ov.removeEventListener("click", onClick); };
  }, [showContact, selectedImg]);

  useEffect(() => {
    const vw = window.innerWidth, rw = getRowWidth();
    trackRefs.current.forEach((track, i) => {
      if (!track) return; const rev = REVERSED[i]; const sX = rev ? -rw : vw;
      track.style.opacity = "0"; track.style.transform = `translate3d(${sX}px,0,0)`;
    });
    if (textRef.current) { textRef.current.style.opacity = "0"; textRef.current.style.transform = "translate3d(0,40px,0)"; textRef.current.style.pointerEvents = "none"; }
  }, []);

  useEffect(() => {
    const el = textRef.current; if (!el) return;
    el.style.transition = "opacity 0.4s ease,filter 0.4s ease";
    el.style.filter = contactVisible ? "blur(12px)" : "blur(0px)";
  }, [contactVisible]);

  const handleContactEnter = () => {
    if (shaking) return; setShaking(true);
    setTimeout(() => { setShaking(false); setContactHovered(true); }, 400);
  };

  const inputStyle: React.CSSProperties = { background: "transparent", border: "none", borderBottom: "1.5px solid #000", color: "#000", fontSize: "clamp(13px,1.5vw,16px)", padding: "6px 0", outline: "none", width: "100%" };
  const labelStyle: React.CSSProperties = { fontSize: "9px", color: "#000" };

  const [tileSize, setTileSize] = useState(140);
  useEffect(() => {
    const upd = () => setTileSize(calcTileSize());
    upd(); window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0;width:100vw;height:100vh;overflow:hidden;background:black;position:fixed;cursor:none!important;}
        *{font-family:'Arial Black',Arial,sans-serif!important;text-transform:uppercase!important;box-sizing:border-box;cursor:none!important;}
        input,textarea,select{cursor:text!important;}
        button,[role="button"]{cursor:pointer!important;}
        @keyframes shakeY{0%{transform:translateY(0)}15%{transform:translateY(-8px)}30%{transform:translateY(8px)}45%{transform:translateY(-6px)}60%{transform:translateY(6px)}75%{transform:translateY(-3px)}90%{transform:translateY(3px)}100%{transform:translateY(0)}}
        .shakeY{animation:shakeY 0.4s ease forwards;}
        @keyframes heartbeat{0%{transform:scale(1)}5%{transform:scale(1.03)}10%{transform:scale(1)}15%{transform:scale(1.03)}20%{transform:scale(1)}100%{transform:scale(1)}}
        .heartbeat-wrapper{display:inline-block;transform-origin:center;animation:heartbeat 2s ease-in-out infinite;}
        input::placeholder,textarea::placeholder{color:rgba(0,0,0,0.2);}
        .text-line{font-weight:900!important;letter-spacing:-0.03em;line-height:0.92;color:white;}
        .desktop-br{display:inline}.mobile-br{display:none}
        .card-title{font-weight:900!important;letter-spacing:-0.02em}
        .card-label{font-weight:900!important;letter-spacing:0.1em}
        .card-input{font-weight:900!important;letter-spacing:-0.02em}
        .card-btn{font-weight:900!important;letter-spacing:0.15em}
        @keyframes floatIn{from{opacity:0;}to{opacity:1;}}
        .floating-img{position:absolute;width:75px;height:75px;border-radius:10px;overflow:hidden;pointer-events:none;will-change:transform,left,top;transform-origin:center center;animation:floatIn 0.4s ease forwards;animation-delay:var(--delay);opacity:0;transform:scale(0.6) rotate(var(--rot));box-shadow:0 4px 16px rgba(0,0,0,0.18);}
        .floating-img img{width:100%;height:100%;object-fit:cover;display:block;}
        @media(max-width:768px){.floating-img{width:25px;height:25px;border-radius:4px;}}
        @media(max-width:768px){
          .desktop-br{display:none}.mobile-br{display:block}
          .text-line{font-size:8.5vw!important;letter-spacing:-0.05em;-webkit-text-stroke:1.2px white;paint-order:stroke fill}
          .contact-trigger{font-size:8.5vw!important;margin-top:1.2em!important}
          .card-title{-webkit-text-stroke:0.8px #000;paint-order:stroke fill}
          .card-label{-webkit-text-stroke:0.3px #000;paint-order:stroke fill}
          .card-input{-webkit-text-stroke:0.4px #000;paint-order:stroke fill}
          .card-btn{-webkit-text-stroke:0.4px #fff;paint-order:stroke fill}
          .cursor-el{display:none!important;}
        }
        @media(min-width:769px){
          .cursor-el{display:block!important;}
        }
        /* Миниатюры узоров: анимация перелёта */
        .thumb-item{
          position:fixed;
          pointer-events:none;
          transform-origin:top left;
          /* Начальный масштаб 1 (полный размер), финальный 0.25 — задаём через inline style */
        }
      `}</style>

      {showContact && (
        <div onClick={e => e.target === e.currentTarget && !isSending && closeContact()}
          style={{ position: "fixed", inset: 0, zIndex: 10000, background: contactVisible ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)", transition: "background 0.5s ease", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", color: "#000", width: "min(520px,90vw)", padding: "clamp(24px,5vw,40px)", transform: contactVisible ? "translate3d(0,0,0)" : "translate3d(0,60px,0)", opacity: contactVisible ? 1 : 0, transition: "transform 0.5s cubic-bezier(0.32,0.72,0,1),opacity 0.5s ease", display: "flex", flexDirection: "column", gap: "clamp(20px,3vw,28px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="card-title" style={{ fontSize: "clamp(18px,3.2vw,28px)", lineHeight: 1 }}>LET'S WORK</div>
              <button disabled={isSending} onClick={closeContact} style={{ background: "none", border: "none", fontSize: "24px", cursor: "none" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(12px,2vw,15px)" }}>
              {[{ label: "YOUR NAME", key: "name" as const, type: "text" }, { label: "EMAIL", key: "email" as const, type: "email" }].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="card-label" style={labelStyle}>{label}</label>
                  <input type={type} className="card-input" disabled={isSending} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value.toUpperCase() })} style={inputStyle} />
                </div>
              ))}
              <div>
                <label className="card-label" style={labelStyle}>SERVICE</label>
                <select className="card-input" style={{ ...inputStyle, cursor: "none", appearance: "none" }} value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>
                  <option>ILLUSTRATION</option><option>LOGO</option><option>MOTION</option><option>ANIMATION</option>
                </select>
              </div>
              <div>
                <label className="card-label" style={labelStyle}>MESSAGE</label>
                <textarea ref={textareaRef} className="card-input" disabled={isSending} value={form.message} onChange={handleMessageChange} rows={1}
                  style={{ ...inputStyle, resize: "none", overflow: "hidden", lineHeight: "1.4", display: "block", minHeight: "24px" }} />
              </div>
            </div>
            <button onClick={handleSubmit} disabled={isSending} className="card-btn"
              style={{ background: "#000", color: "#fff", border: "none", padding: "14px 32px", fontSize: "10px", cursor: "none", alignSelf: "flex-start" }}>
              {isSending ? "SENDING..." : "SEND"}
            </button>
          </div>
        </div>
      )}

      {selectedImg && (
        <div onClick={e => e.target === e.currentTarget && closeImg()}
          style={{ position: "fixed", inset: 0, zIndex: 10000, background: imgVisible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)", transition: "background 0.4s ease", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", color: "#000", width: "min(520px,90vw)", aspectRatio: "1/1", padding: "clamp(24px,5vw,40px)", transform: imgVisible ? "translate3d(0,0,0)" : "translate3d(0,60px,0)", opacity: imgVisible ? 1 : 0, transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1),opacity 0.4s ease", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="card-title" style={{ fontSize: "clamp(18px,3.2vw,28px)", lineHeight: 1 }}>WORK</div>
              <button onClick={closeImg} style={{ background: "none", border: "none", fontSize: "24px", cursor: "none", color: "#000" }}>×</button>
            </div>
            <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px,3vw,24px) 0" }}>
              <img src={selectedImg} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", borderRadius: "4px" }} />
            </div>
          </div>
        </div>
      )}

      <main ref={mainRef} style={{ position: "fixed", width: "100vw", height: "100vh", top: 0, left: 0, overflow: "hidden", touchAction: "none" }}>

        {/* ЧЁРНЫЙ ФОН */}
        <div style={{ position: "absolute", inset: 0, background: "#000", zIndex: 2, opacity: pinkOpacity, pointerEvents: "none" }}>
          {/* CANVAS ТРЕЙЛОВ — за картинками */}
          <canvas ref={trailCanvasRef} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5 }} />
          <div ref={overlayRef} style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: (showContact || !!selectedImg) ? "none" : "auto", cursor: "none" }} />
        </div>

        {/* Картинки и узоры — ниже кубиков */}
        {/* Картинки — полностью непрозрачные, исчезают только со скроллом */}
        <div ref={thumbContainerRef} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", transform: "translateY(110vh)", willChange: "transform", opacity: pinkOpacity }}>
        </div>

        {/* Узоры — 50% прозрачность */}
        <div ref={thumbPatternRef} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", transform: "translateY(110vh)", willChange: "transform", opacity: pinkOpacity * 0.5 }}>
          {thumbnails.map(t => (
            <ThumbItem key={t.id} thumb={t} />
          ))}
        </div>

        {/* КУБИКИ — поверх картинок и узоров */}
        <div style={{ position: "absolute", inset: 0, zIndex: 4, opacity: pinkOpacity, pointerEvents: "none" }}>
          {FLOATING_INIT.map((cfg, i) => (
            <div key={i} ref={el => { floatingRefs.current[i] = el; }} className="floating-img"
              style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, ["--delay" as any]: `${cfg.delay}ms`, ["--rot" as any]: `${cfg.rotation}deg` }}>
              <img src={cfg.src} alt="" />
            </div>
          ))}
        </div>

        {/* I DO DESIGN */}
        <div ref={iDoDesignRef} style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", transform: "translateY(110vh)", opacity: 0, willChange: "transform,opacity" }}>
          <div ref={iDoDesignTextRef} style={{ fontFamily: "'Arial Black',Arial,sans-serif", fontWeight: 900, fontSize: "clamp(28px,7vw,96px)", letterSpacing: "-0.04em", color: "white", textAlign: "center", lineHeight: 1, whiteSpace: "nowrap" }}>
            I DO DESIGN
          </div>
        </div>

        <video ref={videoRef} src={videoSrc} muted loop autoPlay playsInline
          style={{ position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh", objectFit: "cover", zIndex: 0, opacity: 0 }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1, opacity: videoOpacity, pointerEvents: "none" }} />

        {/* 5 РЯДОВ */}
        <div style={{ position: "absolute", inset: 0, zIndex: 3, overflow: "hidden", pointerEvents: "none", display: "flex", flexDirection: "column", justifyContent: "center", gap: `${GAP}px`, padding: `${GAP}px 0` }}>
          {ROWS.map((images, rowIndex) => (
            <div key={rowIndex} ref={el => { trackRefs.current[rowIndex] = el; }}
              style={{ display: "flex", gap: `${GAP}px`, paddingLeft: `${GAP}px`, width: "max-content", willChange: "transform", opacity: 0, flexShrink: 0 }}>
              {images.map((img, i) => (
                <div key={i} style={{ width: `${tileSize}px`, height: `${tileSize}px`, borderRadius: "12px", flexShrink: 0, overflow: "hidden" }}>
                  <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ТЕКСТ + слайдшоу картинок поверх */}
        <div ref={textRef} style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", padding: "0 clamp(20px,6vw,80px)", opacity: 0, transform: "translate3d(0,40px,0)", willChange: "transform,opacity", pointerEvents: "none" }}>
          {/* Картинки слайдшоу поверх текста */}
          {artemPhoto && <ArtemSlidePhoto key={artemPhoto.id} photo={artemPhoto} />}
          <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <div className="text-line" style={{ fontSize: "clamp(32px,6.5vw,88px)" }}>MY NAME <span className="mobile-br" />IS ARTEM</div>
            <div className="text-line" style={{ fontSize: "clamp(32px,6.5vw,88px)", marginTop: "0.15em" }}>I'M A <span className="mobile-br" />DESIGNER</div>
            <div className={`text-line contact-trigger ${shaking ? "shakeY" : ""}`}
              onMouseEnter={handleContactEnter} onMouseLeave={() => setContactHovered(false)} onClick={openContact}
              style={{ fontSize: "clamp(32px,6.5vw,88px)", marginTop: "1.6em", cursor: "none", userSelect: "none", display: "block", lineHeight: 0.92, minHeight: "1.85em", overflow: "visible" }}>
              <span className="heartbeat-wrapper">{contactHovered ? "GET YOUR BEST DESIGN EVER" : "CONTACT ME"}</span>
            </div>
          </div>
        </div>

      </main>

      {/* КУРСОР */}
      <div ref={cursorRef} style={{ position: "fixed", top: 0, left: 0, width: "240px", height: "240px", pointerEvents: "none", zIndex: 999999, opacity: 0, willChange: "transform", transform: "translate(-9999px,-9999px)", marginLeft: "-120px", marginTop: "-120px", display: "none" }} className="cursor-el">
        <img src="/cursor.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      </div>
    </>
  );
}

// ArtemSlidePhoto — картинка на секции "MY NAME IS ARTEM", анимация "двери лифта"
function ArtemSlidePhoto({ photo }: {
  photo: { id: number; src: string; x: number; y: number; size: number; phase: string }
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.transition = "none";
    el.style.clipPath = "inset(0 50% 0 50%)";
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => {
        el.style.transition = "clip-path 0.6s cubic-bezier(0.16,1,0.3,1)";
        el.style.clipPath = "inset(0 0% 0 0%)";
      });
      return () => cancelAnimationFrame(r2);
    });
    return () => cancelAnimationFrame(r1);
  }, []);

  useEffect(() => {
    if (photo.phase !== "out") return;
    const el = ref.current; if (!el) return;
    el.style.transition = "clip-path 0.5s cubic-bezier(0.65,0,0.35,1)";
    el.style.clipPath = "inset(0 50% 0 50%)";
  }, [photo.phase]);

  return (
    <div ref={ref} style={{
      position: "absolute",
      left: `${photo.x}px`, top: `${photo.y}px`,
      width: `${photo.size}px`, height: `${photo.size}px`,
      transform: "translate(-50%, -50%)",
      borderRadius: "16px", overflow: "hidden",
      boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      pointerEvents: "none", zIndex: 11,
      clipPath: "inset(0 50% 0 50%)",
    }}>
      <img src={photo.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

// ThumbItem: position:absolute внутри thumbContainerRef.
// imgRef позволяет обновить src без перемонтирования когда мозаика готова.
function ThumbItem({ thumb }: { thumb: Thumbnail }) {
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Обновляем src картинки когда приходит URL от Pollinations (без ремонтирования)
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