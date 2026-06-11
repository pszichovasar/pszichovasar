"use client";

import React, { useEffect, useRef, useState } from "react";

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

  const GAP = 20;

  // 5 рядов по 20 уникальных картинок
  const ROWS = [
    ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg", "/8.jpg", "/9.jpg", "/10.jpg", "/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg", "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg"],
    ["/21.jpg", "/22.jpg", "/23.jpg", "/24.jpg", "/25.jpg", "/26.jpg", "/27.jpg", "/28.jpg", "/29.jpg", "/30.jpg", "/31.jpg", "/32.jpg", "/33.jpg", "/34.jpg", "/35.jpg", "/36.jpg", "/37.jpg", "/38.jpg", "/39.jpg", "/40.jpg"],
    ["/41.jpg", "/42.jpg", "/43.jpg", "/44.jpg", "/45.jpg", "/46.jpg", "/47.jpg", "/48.jpg", "/49.jpg", "/50.jpg", "/51.jpg", "/52.jpg", "/53.jpg", "/54.jpg", "/55.jpg", "/56.jpg", "/57.jpg", "/58.jpg", "/59.jpg", "/60.jpg"],
    ["/61.jpg", "/62.jpg", "/63.jpg", "/64.jpg", "/65.jpg", "/66.jpg", "/67.jpg", "/68.jpg", "/69.jpg", "/70.jpg", "/71.jpg", "/72.jpg", "/73.jpg", "/74.jpg", "/75.jpg", "/76.jpg", "/77.jpg", "/78.jpg", "/79.jpg", "/80.jpg"],
    ["/81.jpg", "/82.jpg", "/83.jpg", "/84.jpg", "/85.jpg", "/86.jpg", "/87.jpg", "/88.jpg", "/89.jpg", "/90.jpg", "/91.jpg", "/92.jpg", "/93.jpg", "/94.jpg", "/95.jpg", "/96.jpg", "/97.jpg", "/98.jpg", "/99.jpg", "/100.jpg"],
  ];

  // unit 0..1 — розовая
  // unit 1..2 — ряды едут справа налево
  // unit 2..3 — designer
  const SCROLL_PER_UNIT = 800;
  const TOTAL_SCROLL = 3 * SCROLL_PER_UNIT;

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
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      alert("PLEASE FILL IN ALL FIELDS");
      return;
    }
    setIsSending(true);
    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        alert("MESSAGE SENT SUCCESSFULLY!");
        setForm({ name: "", email: "", message: "", service: "ILLUSTRATION" });
        closeContact();
      } else {
        alert(`ERROR: ${data.error || 'UNKNOWN_ERROR'}`);
      }
    } catch (error: any) {
      alert(`FETCH_FAILED: ${error?.message || 'SERVER_UNREACHABLE'}`);
    } finally {
      setIsSending(false);
    }
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

  const getTileSize = () => {
    const vh = window.innerHeight;
    // 5 рядов + 6 промежутков (сверху, снизу и между рядами)
    return Math.floor((vh - GAP * 6) / 5);
  };

  const applyAnimations = (scrollY: number) => {
    const unit = scrollY / SCROLL_PER_UNIT;

    // Розовый фон
    const pink = Math.max(0, 1 - Math.max(0, (unit - 0.8) / 0.4));
    setPinkOpacity(pink);

    // Ряды картинок
    const vw = window.innerWidth;
    const tileSize = getTileSize();

    trackRefs.current.forEach((track, i) => {
      if (!track) return;
      const rowWidth = (tileSize + GAP) * 20 + GAP;
      const reversed = i === 1 || i === 3;
      const startX = reversed ? -rowWidth : vw;
      const endX = reversed ? vw : -rowWidth;
      if (unit < 1) {
        track.style.opacity = "0";
        track.style.transform = `translate3d(${startX}px, 0, 0)`;
      } else if (unit <= 2) {
        const t = unit - 1; // 0..1
        const x = startX + (endX - startX) * t;
        track.style.opacity = "1";
        track.style.transform = `translate3d(${x}px, 0, 0)`;
      } else {
        track.style.opacity = "0";
        track.style.transform = `translate3d(${endX}px, 0, 0)`;
      }
    });

    // Видео и текст
    const tPhase = Math.max(0, Math.min((unit - 2.2) / 0.5, 1));
    setVideoOpacity(tPhase);
    if (videoRef.current) videoRef.current.style.opacity = tPhase.toString();
    if (textRef.current) {
      textRef.current.style.opacity = tPhase.toString();
      textRef.current.style.transform = `translate3d(0, ${(1 - tPhase) * 40}px, 0)`;
      textRef.current.style.pointerEvents = tPhase > 0 ? "auto" : "none";
    }
  };

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
      scrollRef.current = Math.max(0, Math.min(scrollRef.current + delta * 2, TOTAL_SCROLL));
      applyAnimations(scrollRef.current);
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [showContact]);

  // Инициализация
  useEffect(() => {
    const vw = window.innerWidth;
    trackRefs.current.forEach((track, i) => {
      if (!track) return;
      const rowWidth = (Math.floor((window.innerHeight - 20 * 6) / 5) + 20) * 20 + 20;
      const reversed = i === 1 || i === 3;
      track.style.opacity = "0";
      track.style.transform = `translate3d(${reversed ? -rowWidth : window.innerWidth}px, 0, 0)`;
    });
    if (textRef.current) {
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

  // tileSize для JSX (SSR-safe)
  const tileSize = typeof window !== "undefined" ? getTileSize() : 140;

  return (
    <>
      <style>{`
        html, body {
          margin: 0; padding: 0;
          width: 100vw; height: 100vh;
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

      <main style={{ position: "fixed", width: "100vw", height: "100vh", top: 0, left: 0, overflow: "hidden" }}>

        {/* СЕКЦИЯ 1: РОЗОВЫЙ ФОН */}
        <div style={{ position: "absolute", inset: 0, background: "#F4A6C0", zIndex: 2, opacity: pinkOpacity, pointerEvents: "none" }} />

        {/* ВИДЕО */}
        <video ref={videoRef} src={videoSrc} muted loop autoPlay playsInline
          style={{ position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh", objectFit: "cover", zIndex: 0, opacity: 0 }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1, opacity: videoOpacity, pointerEvents: "none" }} />

        {/* СЕКЦИЯ 2: 5 РЯДОВ КАРТИНОК */}
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