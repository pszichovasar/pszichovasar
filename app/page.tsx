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

const IMG_COUNT = 50;
const IMG_SIZE_DESKTOP = 60;
const IMG_SIZE_MOBILE = 20;
const getImgSize = () =>
  typeof window !== "undefined" && window.innerWidth <= 768
    ? IMG_SIZE_MOBILE
    : IMG_SIZE_DESKTOP;

// SVG-маска в форме текста "FOR YOU" — растягивается под реальный размер текста
// через mask-size:100% 100%, поэтому viewBox подобран так, чтобы буквы заполняли
// почти всю область (как и настоящий текст с letter-spacing:-0.04em, font-weight:900).
const FOR_YOU_MASK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" preserveAspectRatio="none">
  <text x="0" y="82" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="100" letter-spacing="-4" fill="white">FOR YOU</text>
</svg>`;
const FOR_YOU_MASK_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(FOR_YOU_MASK_SVG)}")`;

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
  const h = S / 2;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
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
  let minOverlap = Infinity;
  let minAxis: Vec2 = axes[0];
  for (const axis of axes) {
    const [a0, a1] = project(cornersA, axis);
    const [b0, b1] = project(cornersB, axis);
    const overlap = Math.min(a1, b1) - Math.max(a0, b0);
    if (overlap <= 0) return null;
    if (overlap < minOverlap) { minOverlap = overlap; minAxis = axis; }
  }
  const dx = ax - bx;
  const dy = ay - by;
  const dot = dx * minAxis.x + dy * minAxis.y;
  const sign = dot < 0 ? -1 : 1;
  return { overlap: minOverlap, nx: minAxis.x * sign, ny: minAxis.y * sign };
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
  const iLetterRef = useRef<HTMLSpanElement>(null);
  const forYouTextRef = useRef<HTMLDivElement>(null);
  // Накопленные застывшие узоры — каждый: маленькая картинка (dataURL) поверх буквы "I"
  const [frozenPatterns, setFrozenPatterns] = useState<{
    id: number; src: string;
    originX: number; originY: number; // экранные координаты, откуда узор "прилетает"
    originW: number; originH: number; // исходный размер на экране (до уменьшения)
    animated: boolean; // true = уже долетел до финальной позиции
  }[]>([]);
  const frozenIdRef = useRef(0);
  // DOM-узлы застывших узоров — обновляем transform каждый кадр, чтобы следить за буквой "I"
  const frozenPatternRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Зеркало frozenPatterns в ref — чтобы анимационный цикл (замыкание с [] deps) видел актуальные данные
  const frozenPatternsRef = useRef<typeof frozenPatterns>([]);
  useEffect(() => { frozenPatternsRef.current = frozenPatterns; }, [frozenPatterns]);

  const physState = useRef(
    FLOATING_INIT.map(() => ({
      x: 0, y: 0,
      vx: 0, vy: 0,
      ang: 0,
      rotSpeed: 0,
      initialized: false,
      trail: [] as { x: number; y: number }[], // история позиций для трейла
    }))
  );
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const gyroRef = useRef({ gx: 0, gy: 0 });
  const shakeRef = useRef({ lastAcc: 0, lastShakeTime: 0 });
  // Предыдущий rect текста — для swept collision при быстром скролле
  const prevTextRectRef = useRef<DOMRect | null>(null);

  const explodeFromPoint = (px: number, py: number, radius: number = 260, maxForce: number = 9000) => {
    physState.current.forEach(s => {
      if (!s.initialized) return;
      const dx = s.x - px;
      const dy = s.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // За пределами радиуса — никакого воздействия вообще
      if (dist >= radius) return;

      // Внутри радиуса: плавный спад от центра к краю (0 на границе, max в центре)
      // Квадратичный falloff — мягче чем 1/dist², без резкого скачка
      const t = 1 - dist / radius;        // 0..1, 1 = прямо в курсоре
      const force = maxForce * t * t;     // квадратичное усиление к центру

      const safeDist = Math.max(dist, 1); // защита от деления на 0
      s.vx += (dx / safeDist) * force * (1 / 16); // нормируем под dt~16мс шаг
      s.vy += (dy / safeDist) * force * (1 / 16);
      s.rotSpeed += ((Math.random() - 0.5) * 8) * t;
    });
  };

  const GAP = 20;

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      const clampedBeta = Math.max(-90, Math.min(90, beta));
      gyroRef.current.gx = gamma * 14;
      gyroRef.current.gy = clampedBeta * 14;
    };
    const handleMotion = (e: DeviceMotionEvent) => {
      const raw = e.acceleration ?? e.accelerationIncludingGravity;
      if (!raw) return;
      const total = Math.sqrt((raw.x ?? 0) ** 2 + (raw.y ?? 0) ** 2 + (raw.z ?? 0) ** 2);
      const shake = shakeRef.current;
      const delta = Math.abs(total - shake.lastAcc);
      shake.lastAcc = total;
      const now = Date.now();
      if (delta > 20 && now - shake.lastShakeTime > 700) {
        shake.lastShakeTime = now;
        explodeFromPoint(window.innerWidth / 2, window.innerHeight / 2, 9999, 60000);
      }
    };
    const addListeners = () => {
      window.addEventListener("deviceorientation", handleOrientation, true);
      window.addEventListener("devicemotion", handleMotion, true);
    };
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const DOE = DeviceOrientationEvent as any;
    if (isIOS && typeof DOE.requestPermission === "function") {
      const handleFirstTouch = async () => {
        try { const res = await DOE.requestPermission(); if (res === "granted") addListeners(); } catch (_) { }
        window.removeEventListener("touchstart", handleFirstTouch);
      };
      window.addEventListener("touchstart", handleFirstTouch, { once: true });
    } else {
      addListeners();
    }
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      window.removeEventListener("devicemotion", handleMotion, true);
    };
  }, []);

  const ALL_IMAGES = [
    "/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg",
    "/8.jpg", "/9.jpg", "/10.jpg", "/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg",
    "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg", "/21.jpg"
  ];

  const ROWS = useMemo(() => [
    shuffleWithSeed(ALL_IMAGES, 1001),
    shuffleWithSeed(ALL_IMAGES, 2002),
    shuffleWithSeed(ALL_IMAGES, 3003),
    shuffleWithSeed(ALL_IMAGES, 4004),
    shuffleWithSeed(ALL_IMAGES, 5005),
  ], []);

  const REVERSED = [false, true, false, true, false];
  const SCROLL_PER_UNIT = 800;
  const TOTAL_SCROLL = 3 * SCROLL_PER_UNIT;

  // ref на сам текстовый span — чтобы getBoundingClientRect() давал точные границы слов
  const iDoDesignTextRef = useRef<HTMLDivElement>(null);

  // ── Canvas трейлов: ресайз под экран ────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const c = trailCanvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      c.style.width = window.innerWidth + "px";
      c.style.height = window.innerHeight + "px";
      const ctx = c.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Каждые 10 секунд: снимок трейлов → застывший узор над буквой "I" ───
  useEffect(() => {
    const SNAPSHOT_INTERVAL = 10000;

    const captureAndFreeze = () => {
      const canvas = trailCanvasRef.current;
      const letterEl = iLetterRef.current;
      if (!canvas || !letterEl) return;

      // Находим bounding box всех точек трейла, чтобы вырезать только нарисованную область
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      physState.current.forEach(s => {
        for (const p of s.trail) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      });

      // Если ничего не нарисовано — просто очищаем трейлы и выходим
      if (minX === Infinity) {
        physState.current.forEach(s => { s.trail = []; });
        return;
      }

      const pad = 10;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = maxX + pad;
      maxY = maxY + pad;
      const cropW = Math.max(1, maxX - minX);
      const cropH = Math.max(1, maxY - minY);

      // Вырезаем нарисованную область в отдельный маленький canvas
      const dpr = window.devicePixelRatio || 1;
      const crop = document.createElement("canvas");
      crop.width = cropW * dpr;
      crop.height = cropH * dpr;
      const cropCtx = crop.getContext("2d");
      if (cropCtx) {
        cropCtx.drawImage(
          canvas,
          minX * dpr, minY * dpr, cropW * dpr, cropH * dpr,
          0, 0, cropW * dpr, cropH * dpr
        );
        const dataUrl = crop.toDataURL("image/png");
        frozenIdRef.current += 1;
        setFrozenPatterns(prev => [...prev, {
          id: frozenIdRef.current,
          src: dataUrl,
          originX: minX,
          originY: minY,
          originW: cropW,
          originH: cropH,
          animated: false,
        }]);
      }

      // Очищаем canvas трейлов и сбрасываем историю — трейлы начинаются заново
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      physState.current.forEach(s => { s.trail = []; });
    };

    const intervalId = setInterval(captureAndFreeze, SNAPSHOT_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const DAMPING = 0.988;
    const MAX_SPEED = 1400;
    const BOUNCE = 0.35;
    const CORRECTION_BIAS = 0.4;

    const animate = (time: number) => {
      const dt = lastTimeRef.current
        ? Math.min((time - lastTimeRef.current) / 1000, 0.05)
        : 0.016;
      lastTimeRef.current = time;

      const W = window.innerWidth;
      const H = window.innerHeight;
      const S = getImgSize();
      const states = physState.current;

      states.forEach((s, i) => {
        if (!s.initialized) {
          s.x = FLOATING_INIT[i].x / 100 * W;
          s.y = FLOATING_INIT[i].y / 100 * H;
          s.vx = FLOATING_INIT[i].vx;
          s.vy = FLOATING_INIT[i].vy;
          s.ang = FLOATING_INIT[i].rotation * Math.PI / 180;
          s.rotSpeed = FLOATING_INIT[i].rotSpeed * Math.PI / 180;
          s.initialized = true;
        }
      });

      // OBB коллизии между картинками
      for (let i = 0; i < IMG_COUNT; i++) {
        for (let j = i + 1; j < IMG_COUNT; j++) {
          const a = states[i];
          const b = states[j];
          const result = obbCollide(a.x, a.y, a.ang, b.x, b.y, b.ang, S);
          if (!result) continue;
          const { overlap, nx, ny } = result;
          const correction = overlap * CORRECTION_BIAS;
          a.x += nx * correction;
          a.y += ny * correction;
          b.x -= nx * correction;
          b.y -= ny * correction;
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const relVn = dvx * nx + dvy * ny;
          if (relVn < 0) {
            const impulse = -(1 + BOUNCE) * relVn / 2;
            a.vx += impulse * nx;
            a.vy += impulse * ny;
            b.vx -= impulse * nx;
            b.vy -= impulse * ny;
          }
        }
      }

      // Интегрирование + стены
      const { gx, gy } = gyroRef.current;
      const ROT_DAMPING = 0.985;       // вращение тоже затухает со временем
      const MAX_ROT_SPEED = 14;        // рад/с — предел, чтобы не "бесило" после серии столкновений
      states.forEach((s, i) => {
        s.vx += gx * dt;
        s.vy += gy * dt;
        s.vx *= DAMPING;
        s.vy *= DAMPING;
        const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        if (sp > MAX_SPEED) { s.vx = s.vx / sp * MAX_SPEED; s.vy = s.vy / sp * MAX_SPEED; }

        // Вращение: лёгкое трение + жёсткий потолок скорости
        s.rotSpeed *= ROT_DAMPING;
        if (s.rotSpeed > MAX_ROT_SPEED) s.rotSpeed = MAX_ROT_SPEED;
        if (s.rotSpeed < -MAX_ROT_SPEED) s.rotSpeed = -MAX_ROT_SPEED;

        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.ang += s.rotSpeed * dt;
        const h = S / 2;
        if (s.x < h) { s.x = h; s.vx = Math.abs(s.vx) * BOUNCE; }
        if (s.x > W - h) { s.x = W - h; s.vx = -Math.abs(s.vx) * BOUNCE; }
        if (s.y < h) { s.y = h; s.vy = Math.abs(s.vy) * BOUNCE; }
        if (s.y > H - h) { s.y = H - h; s.vy = -Math.abs(s.vy) * BOUNCE; }
        const el = floatingRefs.current[i];
        if (el) {
          el.style.left = `${s.x - h}px`;
          el.style.top = `${s.y - h}px`;
          el.style.width = `${S}px`;
          el.style.height = `${S}px`;
          el.style.transform = `rotate(${s.ang}rad)`;
        }
      });

      // Коллизия с текстом "I DO DESIGN" — swept AABB (union prev+current rect)
      // Это предотвращает "пролёт насквозь" при быстром скролле
      const textEl = iDoDesignTextRef.current;
      if (textEl) {
        const r = textEl.getBoundingClientRect();
        const prev = prevTextRectRef.current;
        const textVisible = r.width > 10 && r.height > 10
          && r.top < H && r.bottom > 0 && r.left < W && r.right > 0;

        if (textVisible) {
          const half = S / 2;

          // Union rect: объединяем текущий и предыдущий rect текста
          // Так покрываем всё пространство, через которое текст прошёл за кадр
          const uL = Math.min(r.left, prev ? prev.left : r.left);
          const uR = Math.max(r.right, prev ? prev.right : r.right);
          const uT = Math.min(r.top, prev ? prev.top : r.top);
          const uB = Math.max(r.bottom, prev ? prev.bottom : r.bottom);

          // Minkowski sum: расширяем на half картинки
          const eL = uL - half;
          const eR = uR + half;
          const eT = uT - half;
          const eB = uB + half;

          for (let i = 0; i < IMG_COUNT; i++) {
            const s = states[i];
            if (!s.initialized) continue;

            if (s.x <= eL || s.x >= eR || s.y <= eT || s.y >= eB) continue;

            const dL = s.x - eL;
            const dR = eR - s.x;
            const dT = s.y - eT;
            const dB = eB - s.y;

            const minD = Math.min(dL, dR, dT, dB);
            let nx = 0, ny = 0;
            if (minD === dL) { nx = -1; }
            else if (minD === dR) { nx = 1; }
            else if (minD === dT) { ny = -1; }
            else { ny = 1; }

            s.x += nx * (minD + 0.5);
            s.y += ny * (minD + 0.5);

            const vn = s.vx * nx + s.vy * ny;
            if (vn < 0) {
              s.vx -= vn * nx * (1 + BOUNCE);
              s.vy -= vn * ny * (1 + BOUNCE);
            }
          }
        }

        // Сохраняем текущий rect для следующего кадра
        prevTextRectRef.current = textVisible ? r : null;
      }

      // ── Рисуем трейлы: только новый сегмент пути, без перерисовки всего ──
      // Так линия никогда не теряет прозрачность и не прерывается —
      // каждый кадр просто дорисовывается маленький отрезок поверх предыдущих.
      const trailCanvas = trailCanvasRef.current;
      if (trailCanvas) {
        const ctx = trailCanvas.getContext("2d");
        if (ctx) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.lineCap = "round";
          for (let i = 0; i < IMG_COUNT; i++) {
            const s = states[i];
            if (!s.initialized) continue;

            const last = s.trail[s.trail.length - 1];
            // Рисуем отрезок от предыдущей сохранённой точки к текущей позиции
            if (last) {
              ctx.beginPath();
              ctx.moveTo(last.x, last.y);
              ctx.lineTo(s.x, s.y);
              ctx.stroke();
            }
            s.trail.push({ x: s.x, y: s.y });
          }
        }
      }

      // ── Обновляем позицию застывших узоров: летят к области текста "FOR YOU" ──
      // Логика 1-в-1 как раньше с кругом над "I": каждый узор сам несёт свою маску
      // (теперь в форме текста вместо круга), которая активируется только после долёта.
      const forYouEl = forYouTextRef.current;
      if (forYouEl && frozenPatternRefs.current.size > 0) {
        const fr = forYouEl.getBoundingClientRect();

        frozenPatternRefs.current.forEach((el, id) => {
          const p = frozenPatternsRef.current.find(fp => fp.id === id);
          if (!p) return;

          if (p.animated) {
            // Растягиваем узор так, чтобы он полностью покрывал площадь текста "FOR YOU"
            const scaleX = fr.width / p.originW;
            const scaleY = fr.height / p.originH;
            const scale = Math.max(scaleX, scaleY);
            const curX = fr.left + fr.width / 2 - (p.originW * scale) / 2;
            const curY = fr.top + fr.height / 2 - (p.originH * scale) / 2;
            el.style.transform = `translate(${curX}px, ${curY}px) scale(${scale})`;

            // Маска в форме текста — позиционируем mask-position в ЛОКАЛЬНЫХ координатах
            // узора (его собственный width×height), так она ездит вместе с transform-ом
            // без рассинхрона и без манипуляций самим SVG-документом.
            const localX = (fr.left - curX) / scale;
            const localY = (fr.top - curY) / scale;
            const localW = fr.width / scale;
            const localH = fr.height / scale;
            el.style.maskImage = FOR_YOU_MASK_URL;
            el.style.webkitMaskImage = FOR_YOU_MASK_URL;
            el.style.maskRepeat = "no-repeat";
            el.style.webkitMaskRepeat = "no-repeat";
            el.style.maskPosition = `${localX}px ${localY}px`;
            el.style.webkitMaskPosition = `${localX}px ${localY}px`;
            el.style.maskSize = `${localW}px ${localH}px`;
            el.style.webkitMaskSize = `${localW}px ${localH}px`;

            // Маска включается ПЛАВНО и только когда узор уже долетел на место
            // (settled выставляется в transitionend-листенере ниже).
            el.style.opacity = el.dataset.settled === "true" ? "1" : "0";
          } else {
            // До начала перелёта — узор остаётся там, где был нарисован, без маски
            el.style.transform = `translate(${p.originX}px, ${p.originY}px) scale(1)`;
            el.style.maskImage = "none";
            el.style.webkitMaskImage = "none";
          }
        });
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // ── Запускаем "перелёт" нового узора к финальной позиции сразу после монтирования ──
  useEffect(() => {
    const unanimated = frozenPatterns.find(p => !p.animated);
    if (!unanimated) return;
    let raf2 = 0;
    // Двойной rAF — гарантирует что браузер применил начальные стили перед transition
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setFrozenPatterns(prev =>
          prev.map(p => p.id === unanimated.id ? { ...p, animated: true } : p)
        );
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [frozenPatterns]);

  const openImg = (src: string) => {
    setSelectedImg(src);
    requestAnimationFrame(() => requestAnimationFrame(() => setImgVisible(true)));
  };
  const closeImg = () => {
    setImgVisible(false);
    setTimeout(() => setSelectedImg(null), 400);
  };

  const hitTestFloating = (cx: number, cy: number): string | null => {
    const S = getImgSize();
    const h = S / 2;
    const states = physState.current;
    for (let i = IMG_COUNT - 1; i >= 0; i--) {
      const s = states[i];
      if (!s.initialized) continue;
      const dx = cx - s.x;
      const dy = cy - s.y;
      const cos = Math.cos(-s.ang);
      const sin = Math.sin(-s.ang);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= h && Math.abs(ly) <= h) {
        return FLOATING_INIT[i].src;
      }
    }
    return null;
  };

  const openContact = () => {
    setShowContact(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setContactVisible(true)));
  };
  const closeContact = () => {
    setContactVisible(false);
    setTimeout(() => setShowContact(false), 500);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm({ ...form, message: e.target.value.toUpperCase() });
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) { alert("PLEASE FILL IN ALL FIELDS"); return; }
    setIsSending(true);
    try {
      const response = await fetch('/api/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
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
    const isiPhone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isiPhone) setVideoSrc("/iome.mp4");
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.load();
      const handleCanPlay = () => video.play().catch(() => { });
      video.addEventListener('canplay', handleCanPlay);
      return () => video.removeEventListener('canplay', handleCanPlay);
    }
  }, [videoSrc]);

  const calcTileSize = () => Math.floor((window.innerHeight - GAP * 6) / 5);
  const getRowWidth = () => (calcTileSize() + GAP) * ALL_IMAGES.length + GAP;

  const iDoDesignRef = useRef<HTMLDivElement>(null);

  const applyAnimations = (scrollY: number, deltaY = 0) => {
    const unit = scrollY / SCROLL_PER_UNIT;
    setPinkOpacity(Math.max(0, 1 - Math.max(0, (unit - 0.8) / 0.4)));

    if (iDoDesignRef.current) {
      let ty: number;
      if (unit <= 0.35) {
        ty = (1 - unit / 0.35) * 110;
      } else if (unit <= 0.75) {
        ty = -((unit - 0.35) / 0.4) * 110;
      } else {
        ty = -110;
      }
      iDoDesignRef.current.style.transform = `translateY(${ty}vh)`;
      iDoDesignRef.current.style.opacity =
        unit < 0.02 ? "0" :
          unit < 0.08 ? String((unit - 0.02) / 0.06) :
            unit > 0.65 ? String(Math.max(0, 1 - (unit - 0.65) / 0.1)) :
              "1";
    }

    if (deltaY > 0 && unit < 0.9) {
      const pushForce = Math.min(deltaY * 18, 900);
      physState.current.forEach(s => {
        if (!s.initialized) return;
        s.vy -= pushForce;
        s.rotSpeed += (Math.random() - 0.5) * 4;
      });
    } else if (deltaY < 0 && unit < 0.9) {
      const pushForce = Math.min(Math.abs(deltaY) * 18, 900);
      physState.current.forEach(s => {
        if (!s.initialized) return;
        s.vy += pushForce;
        s.rotSpeed += (Math.random() - 0.5) * 4;
      });
    }

    const vw = window.innerWidth;
    const rowWidth = getRowWidth();

    trackRefs.current.forEach((track, i) => {
      if (!track) return;
      const rev = REVERSED[i];
      const offRight = vw;
      const offLeft = -rowWidth;
      const startX = rev ? offLeft : offRight;
      const endX = rev ? offRight : offLeft;
      if (unit < 1) {
        track.style.opacity = "0";
        track.style.transform = `translate3d(${startX}px, 0, 0)`;
      } else if (unit <= 2) {
        const x = startX + (endX - startX) * (unit - 1);
        track.style.opacity = "1";
        track.style.transform = `translate3d(${x}px, 0, 0)`;
      } else {
        track.style.opacity = "0";
        track.style.transform = `translate3d(${endX}px, 0, 0)`;
      }
    });

    const tPhase = Math.max(0, Math.min((unit - 2.2) / 0.5, 1));
    setVideoOpacity(tPhase);
    if (videoRef.current) videoRef.current.style.opacity = tPhase.toString();
    if (textRef.current) {
      textRef.current.style.opacity = tPhase.toString();
      textRef.current.style.transform = `translate3d(0, ${(1 - tPhase) * 40}px, 0)`;
      textRef.current.style.pointerEvents = tPhase > 0 ? "auto" : "none";
    }
  };

  const mainRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const lastScrollRef = useRef(0);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (showContact) return;
      e.preventDefault();
      scrollRef.current = Math.max(0, Math.min(scrollRef.current + e.deltaY, TOTAL_SCROLL));
      applyAnimations(scrollRef.current, e.deltaY);
    };
    let touchStartY = 0;
    let touchStartX = 0;
    let touchMoved = false;
    const handleTouchStart = (e: TouchEvent) => {
      if (showContact) return;
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      touchMoved = false;
      if (videoRef.current?.paused) videoRef.current.play().catch(() => { });
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (showContact) return;
      e.preventDefault();
      const dy = touchStartY - e.touches[0].clientY;
      const dx = Math.abs(touchStartX - e.touches[0].clientX);
      if (Math.abs(dy) > 5 || dx > 5) touchMoved = true;
      touchStartY = e.touches[0].clientY;
      scrollRef.current = Math.max(0, Math.min(scrollRef.current + dy * 2.5, TOTAL_SCROLL));
      applyAnimations(scrollRef.current, dy * 2.5);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (showContact || selectedImg) return;
      if (!touchMoved) {
        const t = e.changedTouches[0];
        if (cursorRef.current) {
          cursorRef.current.style.transition = "transform 0.9s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease";
          cursorRef.current.style.transform = `translate(${t.clientX}px, ${t.clientY}px)`;
          cursorRef.current.style.opacity = "1";
        }
        const hit = hitTestFloating(t.clientX, t.clientY);
        if (hit) { openImg(hit); } else { explodeFromPoint(t.clientX, t.clientY, 9999, 60000); }
      }
    };
    const el = mainRef.current;
    if (!el) return;
    window.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [showContact, selectedImg]);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) return;

    // Курсор показываем сразу и всегда отслеживаем — независимо от модалок
    if (cursorRef.current) {
      cursorRef.current.style.opacity = "1";
      cursorRef.current.style.transition = "none";
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transition = "none";
        cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        cursorRef.current.style.opacity = "1";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []); // пустой массив — вешается один раз, никогда не пересоздаётся

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) return;

    const handleExplodeAndClick = (e: MouseEvent) => {
      if (showContact || selectedImg) return;
      explodeFromPoint(e.clientX, e.clientY);
    };
    const handleClick = (e: MouseEvent) => {
      if (showContact || selectedImg) return;
      const hit = hitTestFloating(e.clientX, e.clientY);
      if (hit) openImg(hit);
    };

    window.addEventListener("mousemove", handleExplodeAndClick);
    const overlay = overlayRef.current;
    if (overlay) overlay.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("mousemove", handleExplodeAndClick);
      if (overlay) overlay.removeEventListener("click", handleClick);
    };
  }, [showContact, selectedImg]);

  useEffect(() => {
    const vw = window.innerWidth;
    const rowWidth = getRowWidth();
    trackRefs.current.forEach((track, i) => {
      if (!track) return;
      const rev = REVERSED[i];
      const startX = rev ? -rowWidth : vw;
      track.style.opacity = "0";
      track.style.transform = `translate3d(${startX}px, 0, 0)`;
    });
    if (textRef.current) {
      textRef.current.style.opacity = "0";
      textRef.current.style.transform = "translate3d(0, 40px, 0)";
      textRef.current.style.pointerEvents = "none";
    }
  }, []);

  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;
    textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
    textEl.style.filter = contactVisible ? "blur(12px)" : "blur(0px)";
  }, [contactVisible]);

  const handleContactEnter = () => {
    if (shaking) return;
    setShaking(true);
    setTimeout(() => { setShaking(false); setContactHovered(true); }, 400);
  };

  const inputStyle: React.CSSProperties = {
    background: "transparent", border: "none", borderBottom: "1.5px solid #000",
    color: "#000", fontSize: "clamp(13px, 1.5vw, 16px)", padding: "6px 0", outline: "none", width: "100%",
  };
  const labelStyle: React.CSSProperties = { fontSize: "9px", color: "#000" };

  const [tileSize, setTileSize] = useState(140);
  useEffect(() => {
    const update = () => setTileSize(calcTileSize());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <>
      <style>{`
        html, body {
          margin: 0; padding: 0; width: 100vw; height: 100vh;
          overflow: hidden; background: black; position: fixed;
          cursor: none !important;
        }
        * { font-family: 'Arial Black', Arial, sans-serif !important; text-transform: uppercase !important; box-sizing: border-box; cursor: none !important; }
        input, textarea, select { cursor: text !important; }
        button, [role="button"] { cursor: pointer !important; }
        @keyframes shakeY {
          0%{transform:translateY(0)}15%{transform:translateY(-8px)}30%{transform:translateY(8px)}
          45%{transform:translateY(-6px)}60%{transform:translateY(6px)}75%{transform:translateY(-3px)}
          90%{transform:translateY(3px)}100%{transform:translateY(0)}
        }
        .shakeY { animation: shakeY 0.4s ease forwards; }
        @keyframes heartbeat {
          0%{transform:scale(1)}5%{transform:scale(1.03)}10%{transform:scale(1)}
          15%{transform:scale(1.03)}20%{transform:scale(1)}100%{transform:scale(1)}
        }
        .heartbeat-wrapper { display:inline-block; transform-origin:center; animation:heartbeat 2s ease-in-out infinite; }
        input::placeholder, textarea::placeholder { color: rgba(0,0,0,0.2); }
        .text-line { font-weight:900!important; letter-spacing:-0.03em; line-height:0.92; color:white; }
        .desktop-br{display:inline} .mobile-br{display:none}
        .card-title{font-weight:900!important;letter-spacing:-0.02em}
        .card-label{font-weight:900!important;letter-spacing:0.1em}
        .card-input{font-weight:900!important;letter-spacing:-0.02em}
        .card-btn{font-weight:900!important;letter-spacing:0.15em}
        @keyframes floatIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        .floating-img {
          position: absolute;
          width: 75px;
          height: 75px;
          border-radius: 10px;
          overflow: hidden;
          pointer-events: none;
          will-change: transform, left, top;
          transform-origin: center center;
          animation: floatIn 0.4s ease forwards;
          animation-delay: var(--delay);
          opacity: 0;
          /* стартовый угол + лёгкий scale-in задаются инлайн через JS/style,
             чтобы не конфликтовать с transform от физики после монтирования */
          transform: scale(0.6) rotate(var(--rot));
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        }
        .floating-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        @media(max-width:768px){
          .floating-img { width: 25px; height: 25px; border-radius: 4px; }
        }
        @media(max-width:768px){
          .desktop-br{display:none}.mobile-br{display:block}
          .text-line{font-size:8.5vw!important;letter-spacing:-0.05em;-webkit-text-stroke:1.2px white;paint-order:stroke fill}
          .contact-trigger{font-size:8.5vw!important;margin-top:1.2em!important}
          .card-title{-webkit-text-stroke:0.8px #000;paint-order:stroke fill}
          .card-label{-webkit-text-stroke:0.3px #000;paint-order:stroke fill}
          .card-input{-webkit-text-stroke:0.4px #000;paint-order:stroke fill}
          .card-btn{-webkit-text-stroke:0.4px #fff;paint-order:stroke fill}
        }
      `}</style>

      {showContact && (
        <div onClick={(e) => e.target === e.currentTarget && !isSending && closeContact()}
          style={{ position: "fixed", inset: 0, zIndex: 10000, background: contactVisible ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)", transition: "background 0.5s ease", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", color: "#000", width: "min(520px,90vw)", padding: "clamp(24px,5vw,40px)", transform: contactVisible ? "translate3d(0,0,0)" : "translate3d(0,60px,0)", opacity: contactVisible ? 1 : 0, transition: "transform 0.5s cubic-bezier(0.32,0.72,0,1),opacity 0.5s ease", display: "flex", flexDirection: "column", gap: "clamp(20px,3vw,28px)" }}>
            {/* Заголовок */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="card-title" style={{ fontSize: "clamp(18px,3.2vw,28px)", lineHeight: 1 }}>LET'S WORK</div>
              <button disabled={isSending} onClick={closeContact} style={{ background: "none", border: "none", fontSize: "24px", cursor: "none" }}>×</button>
            </div>
            {/* Поля */}
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(12px,2vw,15px)" }}>
              {[{ label: "YOUR NAME", key: "name" as const, type: "text" }, { label: "EMAIL", key: "email" as const, type: "email" }].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="card-label" style={labelStyle}>{label}</label>
                  <input type={type} className="card-input" disabled={isSending} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value.toUpperCase() })} style={inputStyle} />
                </div>
              ))}
              <div>
                <label className="card-label" style={labelStyle}>SERVICE</label>
                <select className="card-input" style={{ ...inputStyle, cursor: "none", appearance: "none" }} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
                  <option>ILLUSTRATION</option><option>LOGO</option><option>MOTION</option><option>ANIMATION</option>
                </select>
              </div>
              <div>
                <label className="card-label" style={labelStyle}>MESSAGE</label>
                <textarea ref={textareaRef} className="card-input" disabled={isSending} value={form.message} onChange={handleMessageChange} rows={1}
                  style={{ ...inputStyle, resize: "none", overflow: "hidden", lineHeight: "1.4", display: "block", minHeight: "24px" }} />
              </div>
            </div>
            {/* Кнопка — всегда сразу под полями, фиксированный gap */}
            <button onClick={handleSubmit} disabled={isSending} className="card-btn"
              style={{ background: "#000", color: "#fff", border: "none", padding: "14px 32px", fontSize: "10px", cursor: "none", alignSelf: "flex-start" }}>
              {isSending ? "SENDING..." : "SEND"}
            </button>
          </div>
        </div>
      )}

      {selectedImg && (
        <div onClick={(e) => e.target === e.currentTarget && closeImg()}
          style={{ position: "fixed", inset: 0, zIndex: 10000, background: imgVisible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)", transition: "background 0.4s ease", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", color: "#000", width: "min(520px,90vw)", aspectRatio: "1/1", padding: "clamp(24px,5vw,40px)", transform: imgVisible ? "translate3d(0,0,0)" : "translate3d(0,60px,0)", opacity: imgVisible ? 1 : 0, transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1), opacity 0.4s ease", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
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
          {FLOATING_INIT.map((cfg, i) => (
            <div key={i} ref={(el) => { floatingRefs.current[i] = el; }} className="floating-img"
              style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, ["--delay" as any]: `${cfg.delay}ms`, ["--rot" as any]: `${cfg.rotation}deg` }}>
              <img src={cfg.src} alt="" />
            </div>
          ))}
          <div ref={overlayRef} style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: (showContact || !!selectedImg) ? "none" : "auto", cursor: "none" }} />
        </div>

        {/* CANVAS ТРЕЙЛОВ — тонкие белые линии (1px) за каждой картинкой */}
        <canvas
          ref={trailCanvasRef}
          style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none", opacity: pinkOpacity }}
        />

        {/* I DO DESIGN */}
        <div ref={iDoDesignRef} style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", transform: "translateY(110vh)", opacity: 0, willChange: "transform, opacity" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            {/* ref на сам текст — getBoundingClientRect() даст точные границы */}
            <div ref={iDoDesignTextRef} style={{ fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, fontSize: "clamp(28px, 7vw, 96px)", letterSpacing: "-0.04em", color: "white", textAlign: "center", lineHeight: 1, whiteSpace: "nowrap" }}>
              <span ref={iLetterRef} style={{ position: "relative", display: "inline-block" }}>I</span> DO DESIGN
            </div>
            {/* FOR YOU — невидимый сам по себе (только держит layout и даёт точные границы
                для getBoundingClientRect). Видимым текст становится по мере того,
                как узоры внутри маски закрашивают его форму. */}
            <div
              ref={forYouTextRef}
              style={{
                fontFamily: "'Arial Black', Arial, sans-serif",
                fontWeight: 900,
                fontSize: "clamp(28px, 7vw, 96px)",
                letterSpacing: "-0.04em",
                color: "transparent",
                textAlign: "left",
                lineHeight: 1,
                whiteSpace: "nowrap",
                marginTop: "0.15em",
              }}
            >
              FOR YOU
            </div>
          </div>
        </div>

        {/* ЗАСТЫВШИЕ УЗОРЫ — летят от исходной точки на экране к области текста "FOR YOU".
            Каждый узор сам несёт маску в форме текста, которая активируется только
            после долёта — ровно та же логика, что была с кругом над буквой "I". */}
        {frozenPatterns.map((p, idx) => (
          <div
            key={p.id}
            ref={(el) => {
              if (el) {
                frozenPatternRefs.current.set(p.id, el);
                // После завершения перелёта выключаем transition ТОЛЬКО для transform —
                // дальше узор следует за текстом "FOR YOU" мгновенно, синхронно.
                // Маска (opacity) получает свой плавный fade-in отдельной transition.
                if (!(el as any)._settledListenerAdded) {
                  (el as any)._settledListenerAdded = true;
                  el.addEventListener("transitionend", (e) => {
                    if (e.propertyName === "transform") {
                      el.style.transitionProperty = "opacity";
                      el.style.transitionDuration = "0.5s";
                      el.style.transitionTimingFunction = "ease";
                      el.dataset.settled = "true";
                    }
                  });
                }
              } else {
                frozenPatternRefs.current.delete(p.id);
              }
            }}
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: `${p.originW}px`,
              height: `${p.originH}px`,
              transformOrigin: "center center",
              transitionProperty: "transform",
              transitionDuration: "1.1s",
              transitionTimingFunction: "cubic-bezier(0.65, 0, 0.35, 1)",
              zIndex: 50000 + idx,
              pointerEvents: "none",
              opacity: 0,
              // Стартовое положение — там, где узор был нарисован, маски ещё нет
              transform: `translate(${p.originX}px, ${p.originY}px) scale(1)`,
              maskImage: "none",
              WebkitMaskImage: "none",
            }}
          >
            <img
              src={p.src}
              alt=""
              style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
            />
          </div>
        ))}

        <video ref={videoRef} src={videoSrc} muted loop autoPlay playsInline
          style={{ position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh", objectFit: "cover", zIndex: 0, opacity: 0 }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1, opacity: videoOpacity, pointerEvents: "none" }} />

        <div style={{ position: "absolute", inset: 0, zIndex: 3, overflow: "hidden", pointerEvents: "none", display: "flex", flexDirection: "column", justifyContent: "center", gap: `${GAP}px`, padding: `${GAP}px 0` }}>
          {ROWS.map((images, rowIndex) => (
            <div key={rowIndex} ref={(el) => { trackRefs.current[rowIndex] = el; }}
              style={{ display: "flex", gap: `${GAP}px`, paddingLeft: `${GAP}px`, width: "max-content", willChange: "transform", opacity: 0, flexShrink: 0 }}>
              {images.map((img, i) => (
                <div key={i} style={{ width: `${tileSize}px`, height: `${tileSize}px`, borderRadius: "12px", flexShrink: 0, overflow: "hidden" }}>
                  <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div ref={textRef} style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", padding: "0 clamp(20px,6vw,80px)", opacity: 0, transform: "translate3d(0,40px,0)", willChange: "transform,opacity", pointerEvents: "none" }}>
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

      {/* КУРСОР — вне <main>, поверх всех модалок */}
      <div ref={cursorRef} style={{ position: "fixed", top: 0, left: 0, width: "120px", height: "120px", pointerEvents: "none", zIndex: 999999, opacity: 0, willChange: "transform", transform: "translate(-9999px, -9999px)", marginLeft: "-60px", marginTop: "-60px" }}>
        <img src="/cursor.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      </div>
    </>
  );
}