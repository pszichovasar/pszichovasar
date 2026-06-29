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

  // Слайдшоу фото mi1–mi5: случайные позиции, появляются каждые 5 сек
  const MI_PHOTOS = ["/mi1.jpg", "/mi2.jpg", "/mi3.jpg", "/mi4.jpg", "/mi5.jpg"];
  // Одна фото за раз: появляется, показывается ~3 сек, исчезает, через паузу следующая
  const [currentPhoto, setCurrentPhoto] = useState<{
    id: number; src: string;
    x: number; y: number;   // пиксели в координатах thumbContainer (экран минус tyPx)
    size: number;
    phase: "in" | "show" | "out";
  } | null>(null);
  const slideIdRef = useRef(0);
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Слайдшоу: по одному фото, анимация "двери лифта", без пересечений с узорами
  useEffect(() => {
    const isMobileDevice = window.innerWidth <= 768;
    const PHOTO_SIZE_MIN = isMobileDevice ? 120 : 340, PHOTO_SIZE_MAX = isMobileDevice ? 120 : 340;
    const SHOW_MS = 3000, IN_MS = 600, OUT_MS = 500, PAUSE_MS = 1500;

    const rectsOverlap = (
      ax: number, ay: number, aw: number, ah: number,
      bx: number, by: number, bw: number, bh: number,
      pad = 20
    ) => {
      return ax - pad < bx + bw && ax + aw + pad > bx &&
        ay - pad < by + bh && ay + ah + pad > by;
    };

    const findFreePosition = (size: number, occupied: { x: number; y: number; w: number; h: number }[]) => {
      const W = window.innerWidth, H = window.innerHeight;
      for (let attempt = 0; attempt < 40; attempt++) {
        const cx = size / 2 + Math.random() * (W - size);
        const cy = size / 2 + Math.random() * (H - size);
        const x = cx - size / 2, y = cy - size / 2;
        const ok = occupied.every(o => !rectsOverlap(x, y, size, size, o.x, o.y, o.w, o.h));
        if (ok) return { cx: cx / W * 100, cy: cy / H * 100 };
      }
      // Fallback: просто случайное место
      return {
        cx: (size / 2 + Math.random() * (W - size)) / W * 100,
        cy: (size / 2 + Math.random() * (H - size)) / H * 100,
      };
    };

    const showNext = () => {
      const src = MI_PHOTOS[Math.floor(Math.random() * MI_PHOTOS.length)];
      const size = PHOTO_SIZE_MIN + Math.random() * (PHOTO_SIZE_MAX - PHOTO_SIZE_MIN);
      const rot = (Math.random() - 0.5) * 20;
      const W = window.innerWidth, H = window.innerHeight;
      // Собираем занятые области: узоры (thumbnails через physState trail bboxes)
      const occupied = physState.current
        .filter(s => s.trail.length > 1)
        .map(s => {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of s.trail) {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
          }
          return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        });

      const { cx, cy } = findFreePosition(size, occupied);
      const tyPx = getCurrentTyPx();
      // cx/cy в % от экрана → пиксели, затем корректируем на tyPx контейнера
      const xPx = cx / 100 * W;
      const yPx = cy / 100 * H - tyPx;

      slideIdRef.current++;
      const id = slideIdRef.current;

      // Фаза IN
      setCurrentPhoto({ id, src, x: xPx, y: yPx, size, phase: "in" });

      // Фаза SHOW
      slideTimerRef.current = setTimeout(() => {
        setCurrentPhoto(p => p?.id === id ? { ...p, phase: "show" } : p);
        // Фаза OUT
        slideTimerRef.current = setTimeout(() => {
          setCurrentPhoto(p => p?.id === id ? { ...p, phase: "out" } : p);
          // Пауза → следующее фото
          slideTimerRef.current = setTimeout(() => {
            setCurrentPhoto(null);
            slideTimerRef.current = setTimeout(showNext, PAUSE_MS);
          }, OUT_MS);
        }, SHOW_MS);
      }, IN_MS);
    };

    slideTimerRef.current = setTimeout(showNext, 500);
    return () => { if (slideTimerRef.current) clearTimeout(slideTimerRef.current); };
  }, []);
  useEffect(() => {
    const capture = () => {
      const canvas = trailCanvasRef.current;
      if (!canvas) return;

      // Bounding box всех точек трейла
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      physState.current.forEach(s => {
        for (const p of s.trail) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      });

      if (minX === Infinity) {
        physState.current.forEach(s => { s.trail = []; });
        return;
      }

      const pad = 10;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = maxX + pad; maxY = maxY + pad;
      const cropW = Math.max(1, maxX - minX);
      const cropH = Math.max(1, maxY - minY);

      // Вырезаем PNG
      const dpr = window.devicePixelRatio || 1;
      const crop = document.createElement("canvas");
      crop.width = Math.round(cropW * dpr);
      crop.height = Math.round(cropH * dpr);
      const ctx = crop.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas,
          minX * dpr, minY * dpr, cropW * dpr, cropH * dpr,
          0, 0, crop.width, crop.height
        );
      }
      const src = crop.toDataURL("image/png");

      const tyPx = getCurrentTyPx();
      const H = window.innerHeight;

      const isMobileDevice = window.innerWidth <= 768;
      const dstSize = isMobileDevice ? 120 : 340;
      const margin = 0.05;
      const dstX = (margin + Math.random() * (1 - 2 * margin - dstSize / window.innerWidth)) * window.innerWidth;
      // dstY в координатах контейнера = случайная экранная Y - tyPx
      const dstY = (margin + Math.random() * (1 - 2 * margin - dstSize / H)) * H - tyPx;

      thumbIdRef.current++;
      const newThumbId = thumbIdRef.current;

      // Сначала показываем оригинальный трейл (он сразу летит на место)
      setThumbnails(prev => [...prev, {
        id: newThumbId,
        src,
        srcX: minX, srcY: minY - tyPx, srcW: cropW, srcH: cropH,
        dstX, dstY, dstSize,
        offsetY: 0,
      }]);

      // Асинхронно генерируем цветную мозаику через Nano Banana.
      // Отправляем PNG трейла как референс — белые контуры становятся
      // границами витражных ячеек, каждая заливается случайным цветом.
      fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: src }),
      })
        .then(r => r.json())
        .then(data => {
          if (!data.url) return;
          // Заменяем PNG трейла на готовую мозаику в том же месте
          setThumbnails(prev =>
            prev.map(t => t.id === newThumbId ? { ...t, src: data.url } : t)
          );
        })
        .catch(err => console.warn("Mosaic generation failed:", err));

      // Очищаем трейлы
      const c2 = canvas.getContext("2d");
      if (c2) c2.clearRect(0, 0, canvas.width, canvas.height);
      physState.current.forEach(s => { s.trail = []; });
    };

    const id = setInterval(capture, 10000);
    return () => clearInterval(id);
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
      if (trailCanvas) {
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
        <div ref={thumbContainerRef} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", transform: "translateY(110vh)", willChange: "transform", opacity: pinkOpacity * 0.5 }}>
          {currentPhoto && (
            <SlidePhoto key={currentPhoto.id} photo={currentPhoto} />
          )}
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

        {/* ТЕКСТ */}
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

      {/* КУРСОР */}
      <div ref={cursorRef} style={{ position: "fixed", top: 0, left: 0, width: "240px", height: "240px", pointerEvents: "none", zIndex: 999999, opacity: 0, willChange: "transform", transform: "translate(-9999px,-9999px)", marginLeft: "-120px", marginTop: "-120px", display: "none" }} className="cursor-el">
        <img src="/cursor.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      </div>
    </>
  );
}

// SlidePhoto: анимация "двери лифта" (clip-path раздвигается из центра при появлении,
// сдвигается к центру при исчезновении). phase управляется из родителя.
function SlidePhoto({ photo }: {
  photo: { id: number; src: string; x: number; y: number; size: number; phase: string }
}) {
  const ref = useRef<HTMLDivElement>(null);

  // При монтировании: стартуем с закрытого clip-path, потом через двойной rAF открываем
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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

  // При переходе в фазу "out" — закрываем clip-path к центру
  useEffect(() => {
    if (photo.phase !== "out") return;
    const el = ref.current;
    if (!el) return;
    el.style.transition = "clip-path 0.5s cubic-bezier(0.65,0,0.35,1)";
    el.style.clipPath = "inset(0 50% 0 50%)";
  }, [photo.phase]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: `${photo.x}px`,
        top: `${photo.y}px`,
        width: `${photo.size}px`,
        height: `${photo.size}px`,
        transform: `translate(-50%, -50%)`,
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        pointerEvents: "none",
        zIndex: 2,
        clipPath: "inset(0 50% 0 50%)", // начальное состояние (до монтирования)
      }}
    >
      <img src={photo.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

// ThumbItem: position:absolute внутри thumbContainerRef.
// imgRef позволяет обновить src без перемонтирования когда Pollinations возвращает URL.
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
