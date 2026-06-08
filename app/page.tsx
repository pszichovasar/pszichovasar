"use client";

import React, { useEffect, useRef, useState } from "react";

// ─── ДАННЫЕ ───────────────────────────────────────────────────────────────────

const ROW_DATA_0 = ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg", "/8.jpg", "/9.jpg", "/10.jpg"];
const ROW_DATA_1 = ["/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg", "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg"];
const ROW_DATA_2 = ["/10.jpg", "/9.jpg", "/8.jpg", "/7.jpg", "/6.jpg", "/5.jpg", "/4.jpg", "/3.jpg", "/2.jpg", "/1.jpg"];
const ROW_DATA_3 = ["/20.jpg", "/19.jpg", "/18.jpg", "/17.jpg", "/16.jpg", "/15.jpg", "/14.jpg", "/13.jpg", "/12.jpg", "/11.jpg"];
const ROW_DATA_4 = ["/5.jpg", "/15.jpg", "/2.jpg", "/12.jpg", "/8.jpg", "/18.jpg", "/4.jpg", "/14.jpg", "/9.jpg", "/19.jpg"];

const ROWS = [ROW_DATA_0, ROW_DATA_1, ROW_DATA_2, ROW_DATA_3, ROW_DATA_4];
const GRID_GAP = 20;

// ─── ТАЙМЛАЙН ─────────────────────────────────────────────────────────────────
//
//  0.00 – 0.15  →  розовая страница: текст исчезает
//  0.15 – 0.55  →  сетка въезжает из краёв экрана
//  0.55 – 0.75  →  сетка разъезжается обратно за края
//  0.75 – 1.00  →  видео + текст появляются
//
// ─────────────────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

function invlerp(a: number, b: number, v: number) {
  return Math.min(Math.max((v - a) / (b - a), 0), 1);
}

export default function Home() {

  // ── СОСТОЯНИЯ ───────────────────────────────────────────────────────────────

  const [progress, setProgress] = useState<number>(0);
  const [videoSrc, setVideoSrc] = useState<string>("/me.mp4");
  const [imgSize, setImgSize] = useState<number>(140);
  const [statusText, setStatusText] = useState<string>("ERROR 404: LOADING FAILED");
  const [contactHovered, setContactHovered] = useState<boolean>(false);
  const [shaking, setShaking] = useState<boolean>(false);
  const [showContact, setShowContact] = useState<boolean>(false);
  const [contactVisible, setContactVisible] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [form, setForm] = useState({
    name: "", email: "", message: "", service: "ILLUSTRATION"
  });

  // ── РЕФЫ ────────────────────────────────────────────────────────────────────

  const videoRef = useRef<HTMLVideoElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeTextRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const touchStartRef = useRef<number>(0);
  const progressRef = useRef<number>(0);

  // ── ЭФФЕКТЫ ─────────────────────────────────────────────────────────────────

  // Смена текста WELCOME через 1 сек
  useEffect(() => {
    const t = setTimeout(() => setStatusText("WELCOME"), 1000);
    return () => clearTimeout(t);
  }, []);

  // Детекция iPhone
  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/iPhone|iPad|iPod/i.test(ua)) setVideoSrc("/iome.mp4");
  }, []);

  // Автоплей видео
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.load();
    const onCanPlay = () => el.play().catch(() => { });
    el.addEventListener("canplay", onCanPlay);
    return () => el.removeEventListener("canplay", onCanPlay);
  }, [videoSrc]);

  // Размер плиток сетки по высоте окна
  useEffect(() => {
    const calc = () => {
      setImgSize(Math.floor((window.innerHeight - GRID_GAP * 6) / 5));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // Скролл — колесо и тач
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (showContact) return;
      e.preventDefault();
      let next = progressRef.current + e.deltaY * 0.0015;
      next = Math.min(Math.max(next, 0), 1);
      progressRef.current = next;
      setProgress(next);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (showContact) return;
      touchStartRef.current = e.touches[0].clientY;
      if (videoRef.current?.paused) videoRef.current.play().catch(() => { });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (showContact) return;
      e.preventDefault();
      const dy = touchStartRef.current - e.touches[0].clientY;
      touchStartRef.current = e.touches[0].clientY;
      let next = progressRef.current + dy * 0.002;
      next = Math.min(Math.max(next, 0), 1);
      progressRef.current = next;
      setProgress(next);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [showContact]);

  // ── АНИМАЦИОННЫЙ ДВИЖОК ─────────────────────────────────────────────────────
  useEffect(() => {
    const p = progress;

    // 1. РОЗОВАЯ СТРАНИЦА — текст исчезает 0.0 → 0.15
    if (welcomeTextRef.current) {
      const t = invlerp(0, 0.15, p);
      welcomeTextRef.current.style.opacity = (1 - t).toString();
      welcomeTextRef.current.style.filter = `blur(${t * 20}px)`;
    }

    // 2. СЕТКА — въезд 0.15 → 0.55 / разъезд 0.55 → 0.75
    const assembleT = invlerp(0.15, 0.55, p);   // 0→1 при въезде
    const dismissT = invlerp(0.55, 0.75, p);   // 0→1 при разъезде

    trackRefs.current.forEach((track, i) => {
      if (!track) return;
      // Чётные (0,2,4) — слева, нечётные (1,3) — справа
      const dir = i % 2 === 0 ? -1 : 1;
      const assembleOffset = (1 - assembleT) * 120 * dir;   // 120vw → 0
      const dismissOffset = dismissT * 120 * dir; // 0 → 120vw
      track.style.transform = `translateX(${assembleOffset + dismissOffset}vw)`;
    });

    // Видимость всего контейнера сетки (скрываем когда полностью уехала)
    if (gridRef.current) {
      gridRef.current.style.visibility = p > 0.76 ? "hidden" : "visible";
    }

    // 3. ВИДЕО — появляется 0.75 → 0.92
    if (videoRef.current) {
      videoRef.current.style.opacity = invlerp(0.75, 0.92, p).toString();
    }

    // 4. ТЕКСТ — выезжает снизу 0.80 → 1.0
    if (textRef.current) {
      const t = invlerp(0.80, 1.0, p);
      textRef.current.style.opacity = t.toString();
      textRef.current.style.transform = `translate3d(0, ${(1 - t) * 150}px, 0)`;
      textRef.current.style.pointerEvents = t > 0 ? "auto" : "none";
    }

  }, [progress]);

  // Блюр текста когда открыт контакт
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    if (contactVisible) {
      el.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      el.style.opacity = "0";
      el.style.filter = "blur(12px)";
    } else if (progress > 0.80) {
      el.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      el.style.opacity = "1";
      el.style.filter = "blur(0px)";
    }
  }, [contactVisible, progress]);

  // ── ХЭНДЛЕРЫ ────────────────────────────────────────────────────────────────

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
    if (!form.name || !form.email || !form.message) {
      alert("PLEASE FILL IN ALL FIELDS");
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("MESSAGE SENT SUCCESSFULLY!");
        setForm({ name: "", email: "", message: "", service: "ILLUSTRATION" });
        closeContact();
      } else {
        alert(`ERROR: ${data.error || "UNKNOWN_ERROR"}`);
      }
    } catch (err: any) {
      alert(`FETCH_FAILED: ${err?.message || "SERVER_UNREACHABLE"}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleContactEnter = () => {
    if (shaking) return;
    setShaking(true);
    setTimeout(() => { setShaking(false); setContactHovered(true); }, 400);
  };

  // ── СТИЛИ ───────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    borderBottom: "1.5px solid #000",
    color: "#000",
    fontSize: "clamp(13px, 1.5vw, 16px)",
    padding: "6px 0",
    outline: "none",
    width: "100%",
    marginTop: "8px",
  };

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        html, body {
          margin: 0; padding: 0;
          width: 100vw; height: 100vh;
          overflow: hidden;
          background: #ffbbc6;
          font-family: 'Arial Black', Arial, sans-serif !important;
        }
        * { box-sizing: border-box; text-transform: uppercase !important; }

        /* ── СЛОЙ 1: розовый фон ── */
        .pink-overlay {
          position: fixed; inset: 0; z-index: 0;
          background: #ffbbc6;
          display: flex; align-items: center; justify-content: center;
        }
        .welcome-text {
          font-size: 5vw; color: #000; font-weight: 900;
          will-change: opacity, filter;
        }

        /* ── СЛОЙ 2: сетка ── */
        .grid-layer {
          position: fixed; inset: 0; z-index: 1;
          display: flex; align-items: center;
          overflow: hidden;
          background: #ffbbc6;
        }
        .masked-grid {
          display: flex; flex-direction: column;
          gap: ${GRID_GAP}px;
        }
        .row-track {
          display: flex; gap: ${GRID_GAP}px;
          width: max-content;
          will-change: transform;
          padding: 0 ${GRID_GAP}px;
        }

        /* ── СЛОЙ 3: видео + текст ── */
        .video-layer {
          position: fixed; inset: 0; z-index: 2;
          pointer-events: none;
        }
        .video-overlay {
          position: absolute; inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 1;
        }

        /* ── ТЕКСТ ── */
        .text-layer {
          position: fixed; inset: 0; z-index: 3;
          display: flex; align-items: center;
          padding: 0 80px;
          opacity: 0;
          pointer-events: none;
          will-change: opacity, transform;
        }
        .text-line {
          font-weight: 900 !important;
          letter-spacing: -0.03em;
          line-height: 0.92;
          color: white;
        }
        @media (max-width: 768px) {
          .text-line { font-size: 8.5vw !important; -webkit-text-stroke: 1.2px white; }
          .text-layer { padding: 0 24px; }
        }

        /* ── АНИМАЦИИ ── */
        @keyframes shakeY {
          0%   { transform: translateY(0); }
          15%  { transform: translateY(-8px); }
          30%  { transform: translateY(8px); }
          45%  { transform: translateY(-6px); }
          60%  { transform: translateY(6px); }
          75%  { transform: translateY(-3px); }
          90%  { transform: translateY(3px); }
          100% { transform: translateY(0); }
        }
        .shakeY { animation: shakeY 0.4s ease forwards; }

        @keyframes heartbeat {
          0%   { transform: scale(1); }
          5%   { transform: scale(1.03); }
          10%  { transform: scale(1); }
          15%  { transform: scale(1.03); }
          20%  { transform: scale(1); }
          100% { transform: scale(1); }
        }
        .heartbeat-wrapper {
          display: inline-block;
          transform-origin: center center;
          animation: heartbeat 2s ease-in-out infinite;
        }
      `}</style>

      {/* ── СЛОЙ 1: РОЗОВЫЙ ФОН ─────────────────────────────────────────────── */}
      <div className="pink-overlay">
        <div ref={welcomeTextRef} className="welcome-text">
          {statusText}
        </div>
      </div>

      {/* ── СЛОЙ 2: СЕТКА ───────────────────────────────────────────────────── */}
      <div className="grid-layer">
        <div ref={gridRef} className="masked-grid">
          {ROWS.map((images, rowIndex) => (
            <div
              key={rowIndex}
              ref={(el) => { trackRefs.current[rowIndex] = el; }}
              className="row-track"
            >
              {[...images, ...images].map((img, i) => (
                <div
                  key={i}
                  style={{
                    width: `${imgSize}px`,
                    height: `${imgSize}px`,
                    borderRadius: "12px",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={img}
                    alt="gallery"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── СЛОЙ 3: ВИДЕО ───────────────────────────────────────────────────── */}
      <div className="video-layer">
        <video
          ref={videoRef}
          src={videoSrc}
          muted loop autoPlay playsInline
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            opacity: 0,
            willChange: "opacity",
          }}
        />
        {/* Чёрная прослойка 40% между видео и текстом */}
        <div className="video-overlay" />
      </div>

      {/* ── СЛОЙ 4: ТЕКСТ ───────────────────────────────────────────────────── */}
      <div ref={textRef} className="text-layer">
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>

          <div className="text-line" style={{ fontSize: "88px" }}>
            MY NAME IS ARTEM
          </div>
          <div className="text-line" style={{ fontSize: "88px", marginTop: "0.15em" }}>
            I'M A DESIGNER
          </div>

          <div
            className={`text-line ${shaking ? "shakeY" : ""}`}
            onClick={openContact}
            onMouseEnter={handleContactEnter}
            style={{
              fontSize: "88px",
              marginTop: "1.6em",
              cursor: "pointer",
              display: "inline-block",
            }}
          >
            <span className="heartbeat-wrapper">
              {contactHovered ? "GET YOUR BEST DESIGN EVER" : "CONTACT ME"}
            </span>
          </div>

        </div>
      </div>

      {/* ── МОДАЛЬНОЕ ОКНО ──────────────────────────────────────────────────── */}
      {showContact && (
        <div
          onClick={(e) => e.target === e.currentTarget && !isSending && closeContact()}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff", color: "#000",
              width: "min(520px, 90vw)", aspectRatio: "1 / 1",
              padding: "clamp(24px, 5vw, 40px)",
              transform: contactVisible ? "translate3d(0,0,0)" : "translate3d(0,60px,0)",
              opacity: contactVisible ? 1 : 0,
              transition: "transform 0.5s cubic-bezier(0.32,0.72,0,1), opacity 0.5s ease",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: "28px", fontWeight: 900 }}>LET'S WORK</div>
              <button
                onClick={closeContact}
                style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}
              >×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ fontSize: "9px" }}>YOUR NAME</label>
                <input
                  type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: "9px" }}>EMAIL</label>
                <input
                  type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value.toUpperCase() })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: "9px" }}>SERVICE</label>
                <select
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                >
                  <option>ILLUSTRATION</option>
                  <option>LOGO</option>
                  <option>MOTION</option>
                  <option>ANIMATION</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "9px" }}>MESSAGE</label>
                <textarea
                  ref={textareaRef} value={form.message}
                  onChange={handleMessageChange}
                  style={{ ...inputStyle, resize: "none", minHeight: "50px" }}
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              style={{
                background: "#000", color: "#fff",
                border: "none", padding: "14px 32px",
                fontSize: "10px", fontWeight: 900,
                cursor: "pointer", alignSelf: "flex-start",
              }}
            >
              {isSending ? "SENDING..." : "SEND"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}