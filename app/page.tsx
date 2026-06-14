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

// Параметры для 20 хаотично движущихся картинок на розовой секции
const FLOATING_IMAGES_CONFIG = Array.from({ length: 20 }, (_, i) => {
  const seed = i * 137 + 42;
  const pseudoRandom = (n: number) => ((seed * 1664525 + n * 1013904223) & 0x7fffffff) / 0x7fffffff;
  return {
    src: `/j${(i % 4) + 1}.jpg`,
    // Начальная позиция (% от экрана)
    x: pseudoRandom(1) * 90 + 5,
    y: pseudoRandom(2) * 85 + 5,
    // Скорость (vw/сек и vh/сек)
    vx: (pseudoRandom(3) - 0.5) * 0.25,
    vy: (pseudoRandom(4) - 0.5) * 0.22,
    // Размер (px)
    size: 80 + pseudoRandom(5) * 100,
    // Начальный угол поворота
    rotation: pseudoRandom(6) * 360,
    // Скорость вращения (градусов/сек)
    rotSpeed: (pseudoRandom(7) - 0.5) * 40,
    // Задержка появления (мс)
    delay: pseudoRandom(8) * 600,
  };
});

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

  const scrollRef = useRef(0);
  const touchStartRef = useRef(0);

  const [pinkOpacity, setPinkOpacity] = useState(1);
  const [videoOpacity, setVideoOpacity] = useState(0);

  // Состояние для плавающих картинок
  const floatingRefs = useRef<(HTMLDivElement | null)[]>(Array(20).fill(null));
  const floatingState = useRef(
    FLOATING_IMAGES_CONFIG.map(cfg => ({
      x: cfg.x,
      y: cfg.y,
      vx: cfg.vx,
      vy: cfg.vy,
      rotation: cfg.rotation,
      rotSpeed: cfg.rotSpeed,
    }))
  );
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const GAP = 20;
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

  // Анимация плавающих картинок
  useEffect(() => {
    const animate = (time: number) => {
      const dt = lastTimeRef.current ? Math.min((time - lastTimeRef.current) / 1000, 0.05) : 0.016;
      lastTimeRef.current = time;

      floatingState.current.forEach((state, i) => {
        state.x += state.vx * dt * 60;
        state.y += state.vy * dt * 60;
        state.rotation += state.rotSpeed * dt;

        // Отражение от краёв (с учётом размера картинки в %)
        const sizeVw = (FLOATING_IMAGES_CONFIG[i].size / window.innerWidth) * 100;
        const sizeVh = (FLOATING_IMAGES_CONFIG[i].size / window.innerHeight) * 100;

        if (state.x < 0) { state.x = 0; state.vx = Math.abs(state.vx); }
        if (state.x > 100 - sizeVw) { state.x = 100 - sizeVw; state.vx = -Math.abs(state.vx); }
        if (state.y < 0) { state.y = 0; state.vy = Math.abs(state.vy); }
        if (state.y > 100 - sizeVh) { state.y = 100 - sizeVh; state.vy = -Math.abs(state.vy); }

        const el = floatingRefs.current[i];
        if (el) {
          el.style.left = `${state.x}%`;
          el.style.top = `${state.y}%`;
          el.style.transform = `rotate(${state.rotation}deg)`;
        }
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

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

  const applyAnimations = (scrollY: number) => {
    const unit = scrollY / SCROLL_PER_UNIT;
    setPinkOpacity(Math.max(0, 1 - Math.max(0, (unit - 0.8) / 0.4)));

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

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (showContact) return;
      e.preventDefault();
      scrollRef.current = Math.max(0, Math.min(scrollRef.current + e.deltaY, TOTAL_SCROLL));
      applyAnimations(scrollRef.current);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (showContact) return;
      touchStartRef.current = e.touches[0].clientY;
      if (videoRef.current?.paused) videoRef.current.play().catch(() => { });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (showContact) return;
      e.preventDefault();
      const delta = touchStartRef.current - e.touches[0].clientY;
      touchStartRef.current = e.touches[0].clientY;
      scrollRef.current = Math.max(0, Math.min(scrollRef.current + delta * 2.5, TOTAL_SCROLL));
      applyAnimations(scrollRef.current);
    };

    const el = mainRef.current;
    if (!el) return;

    window.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, [showContact]);

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
        }
        * { font-family: 'Arial Black', Arial, sans-serif !important; text-transform: uppercase !important; box-sizing: border-box; }
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
          from { opacity: 0; transform: scale(0.7) rotate(var(--rot)); }
          to   { opacity: 1; transform: scale(1)   rotate(var(--rot)); }
        }
        .floating-img {
          position: absolute;
          border-radius: 12px;
          overflow: hidden;
          pointer-events: none;
          will-change: transform, left, top;
          animation: floatIn 0.5s ease forwards;
          animation-delay: var(--delay);
          opacity: 0;
        }
        .floating-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
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
          <div style={{ background: "#fff", color: "#000", width: "min(520px,90vw)", aspectRatio: "1/1", padding: "clamp(24px,5vw,40px)", transform: contactVisible ? "translate3d(0,0,0)" : "translate3d(0,60px,0)", opacity: contactVisible ? 1 : 0, transition: "transform 0.5s cubic-bezier(0.32,0.72,0,1),opacity 0.5s ease", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="card-title" style={{ fontSize: "clamp(18px,3.2vw,28px)", lineHeight: 1 }}>LET'S WORK</div>
              <button disabled={isSending} onClick={closeContact} style={{ background: "none", border: "none", fontSize: "24px", cursor: isSending ? "not-allowed" : "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(12px,2vw,15px)", flexGrow: 1, justifyContent: "center" }}>
              {[{ label: "YOUR NAME", key: "name" as const, type: "text" }, { label: "EMAIL", key: "email" as const, type: "email" }].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="card-label" style={labelStyle}>{label}</label>
                  <input type={type} className="card-input" disabled={isSending} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value.toUpperCase() })} style={inputStyle} />
                </div>
              ))}
              <div>
                <label className="card-label" style={labelStyle}>SERVICE</label>
                <select className="card-input" style={{ ...inputStyle, cursor: "pointer", appearance: "none" }} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
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
              style={{ background: "#000", color: "#fff", border: "none", padding: "14px 32px", fontSize: "10px", cursor: isSending ? "not-allowed" : "pointer", alignSelf: "flex-start" }}>
              {isSending ? "SENDING..." : "SEND"}
            </button>
          </div>
        </div>
      )}

      <main ref={mainRef} style={{ position: "fixed", width: "100vw", height: "100vh", top: 0, left: 0, overflow: "hidden", touchAction: "none" }}>

        {/* СЕКЦИЯ 1: РОЗОВЫЙ ФОН */}
        <div style={{ position: "absolute", inset: 0, background: "#F4A6C0", zIndex: 2, opacity: pinkOpacity, pointerEvents: "none" }}>
          {/* ПЛАВАЮЩИЕ КАРТИНКИ поверх розовой секции */}
          {FLOATING_IMAGES_CONFIG.map((cfg, i) => (
            <div
              key={i}
              ref={(el) => { floatingRefs.current[i] = el; }}
              className="floating-img"
              style={{
                width: `${cfg.size}px`,
                height: `${cfg.size}px`,
                left: `${cfg.x}%`,
                top: `${cfg.y}%`,
                ["--delay" as any]: `${cfg.delay}ms`,
                ["--rot" as any]: `${cfg.rotation}deg`,
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}
            >
              <img src={cfg.src} alt="" />
            </div>
          ))}
        </div>

        {/* ВИДЕО */}
        <video ref={videoRef} src={videoSrc} muted loop autoPlay playsInline
          style={{ position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh", objectFit: "cover", zIndex: 0, opacity: 0 }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1, opacity: videoOpacity, pointerEvents: "none" }} />

        {/* СЕКЦИЯ 2: 5 РЯДОВ */}
        <div style={{ position: "absolute", inset: 0, zIndex: 3, overflow: "hidden", pointerEvents: "none", display: "flex", flexDirection: "column", justifyContent: "center", gap: `${GAP}px`, padding: `${GAP}px 0` }}>
          {ROWS.map((images, rowIndex) => (
            <div
              key={rowIndex}
              ref={(el) => { trackRefs.current[rowIndex] = el; }}
              style={{ display: "flex", gap: `${GAP}px`, paddingLeft: `${GAP}px`, width: "max-content", willChange: "transform", opacity: 0, flexShrink: 0 }}
            >
              {images.map((img, i) => (
                <div key={i} style={{ width: `${tileSize}px`, height: `${tileSize}px`, borderRadius: "12px", flexShrink: 0, overflow: "hidden" }}>
                  <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* СЕКЦИЯ 3: ТЕКСТ */}
        <div ref={textRef} style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", padding: "0 clamp(20px,6vw,80px)", opacity: 0, transform: "translate3d(0,40px,0)", willChange: "transform,opacity", pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <div className="text-line" style={{ fontSize: "clamp(32px,6.5vw,88px)" }}>MY NAME <span className="mobile-br" />IS ARTEM</div>
            <div className="text-line" style={{ fontSize: "clamp(32px,6.5vw,88px)", marginTop: "0.15em" }}>I'M A <span className="mobile-br" />DESIGNER</div>
            <div className={`text-line contact-trigger ${shaking ? "shakeY" : ""}`}
              onMouseEnter={handleContactEnter} onMouseLeave={() => setContactHovered(false)} onClick={openContact}
              style={{ fontSize: "clamp(32px,6.5vw,88px)", marginTop: "1.6em", cursor: "pointer", display: "inline-block", userSelect: "none" }}>
              <span className="heartbeat-wrapper">{contactHovered ? "GET YOUR BEST DESIGN EVER" : "CONTACT ME"}</span>
            </div>
          </div>
        </div>

      </main>
    </>
  );
}