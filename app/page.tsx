"use client";

import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const [progress, setProgress] = useState(0);
  const [videoSrc, setVideoSrc] = useState("/me.mp4");
  const [imgSize, setImgSize] = useState(140);
  const [menuColor, setMenuColor] = useState("#e29ea9");

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoOverlayRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pinkSectionRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [contactHovered, setContactHovered] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "", service: "ILLUSTRATION" });
  const [isSending, setIsSending] = useState(false);

  const touchStartRef = useRef(0);
  const currentProgressRef = useRef(0);

  const row0 = ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg", "/8.jpg", "/9.jpg", "/10.jpg"];
  const row1 = ["/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg", "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg"];
  const row2 = ["/10.jpg", "/9.jpg", "/8.jpg", "/7.jpg", "/6.jpg", "/5.jpg", "/4.jpg", "/3.jpg", "/2.jpg", "/1.jpg"];
  const row3 = ["/20.jpg", "/19.jpg", "/18.jpg", "/17.jpg", "/16.jpg", "/15.jpg", "/14.jpg", "/13.jpg", "/12.jpg", "/11.jpg"];
  const row4 = ["/5.jpg", "/15.jpg", "/2.jpg", "/12.jpg", "/8.jpg", "/18.jpg", "/4.jpg", "/14.jpg", "/9.jpg", "/19.jpg"];

  const rows = [row0, row1, row2, row3, row4];
  const directions = [true, false, true, false, true];
  const trackRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const GAP = 20;

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
      console.error(error);
      alert(`FETCH_FAILED: ${error?.message || 'SERVER_UNREACHABLE'}`);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    const isiPhone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isiPhone) {
      setVideoSrc("/iome.mp4");
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.load();

      const handleCanPlay = () => {
        video.play().catch((err) => {
          console.log("Воспроизведение ожидается после первого тача", err);
        });
      };

      video.addEventListener('canplay', handleCanPlay);
      return () => video.removeEventListener('canplay', handleCanPlay);
    }
  }, [videoSrc]);

  useEffect(() => {
    const calcSize = () => {
      const vh = window.innerHeight;
      const computedSize = Math.floor((vh - GAP * 6) / 5);
      setImgSize(computedSize);

      trackRefs.current.forEach((track, i) => {
        if (!track || !rows[i]) return;
        const loopWidth = (computedSize + GAP) * rows[i].length;
        if (directions[i]) {
          track.style.transform = `translate3d(0px, 0, 0)`;
        } else {
          track.style.transform = `translate3d(${-loopWidth}px, 0, 0)`;
        }
      });
    };

    calcSize();
    const timer1 = setTimeout(calcSize, 50);
    const timer2 = setTimeout(calcSize, 300);

    window.addEventListener("resize", calcSize);
    return () => {
      window.removeEventListener("resize", calcSize);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (showContact) return;
      e.preventDefault();

      const speed = 0.0015;
      let next = currentProgressRef.current + e.deltaY * speed;

      next = Math.min(Math.max(next, 0), 1);
      currentProgressRef.current = next;
      setProgress(next);

      // Логика цвета меню: розовый на старте, белый на контенте
      setMenuColor(next < 0.2 ? "#e29ea9" : "#ffffff");
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (showContact) return;
      touchStartRef.current = e.touches[0].clientY;

      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => { });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (showContact) return;
      e.preventDefault();

      const currentY = e.touches[0].clientY;
      const deltaY = touchStartRef.current - currentY;
      touchStartRef.current = currentY;

      const speed = 0.002;
      let next = currentProgressRef.current + deltaY * speed;

      next = Math.min(Math.max(next, 0), 1);
      currentProgressRef.current = next;
      setProgress(next);
      setMenuColor(next < 0.2 ? "#e29ea9" : "#ffffff");
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

  useEffect(() => {
    // 1. Анимация розовой секции
    if (pinkSectionRef.current) {
      const pinkFadeProgress = Math.min(progress / 0.2, 1);
      pinkSectionRef.current.style.opacity = (1 - pinkFadeProgress).toString();
      pinkSectionRef.current.style.transform = `translate3d(0, ${-pinkFadeProgress * 40}px, 0)`;
      pinkSectionRef.current.style.pointerEvents = progress < 0.2 ? "auto" : "none";
    }

    // 2. Логика сетки (Grid) - исправлено появление и движение
    const gridProgress = Math.min(progress / 0.65, 1);

    trackRefs.current.forEach((track, i) => {
      if (!track || !rows[i]) return;
      const loopWidth = (imgSize + GAP) * rows[i].length;

      // Сетка плавно едет горизонтально в зависимости от прогресса
      const offset = directions[i] ? -gridProgress * loopWidth : -loopWidth + gridProgress * loopWidth;

      // Появление: сетка просто выезжает из "невидимости" без Y-смещений
      track.style.transform = `translate3d(${offset}px, 0, 0)`;
    });

    if (gridRef.current) {
      // Плавное появление сетки от 0.1 до 0.35 прогресса
      const opacity = progress < 0.1 ? 0 : progress > 0.35 ? 1 : (progress - 0.1) / 0.25;
      gridRef.current.style.opacity = opacity.toString();
      gridRef.current.style.filter = progress > 0.5 ? `blur(${(progress - 0.5) * 100}px)` : "blur(0px)";
      gridRef.current.style.transform = `scale(${1 - gridProgress * 0.02})`;
    }

    // 3. Видео и текст
    if (videoRef.current) {
      const vidOpacity = Math.min(Math.max((progress - 0.6) / 0.2, 0), 1);
      videoRef.current.style.opacity = vidOpacity.toString();
    }

    if (textRef.current) {
      if (progress > 0.85) {
        const textProgress = Math.min((progress - 0.85) / 0.15, 1);
        textRef.current.style.opacity = textProgress.toString();
        textRef.current.style.transform = `translate3d(0, ${(1 - textProgress) * 30}px, 0)`;
        textRef.current.style.pointerEvents = "auto";
      } else {
        textRef.current.style.opacity = "0";
        textRef.current.style.pointerEvents = "none";
      }
    }
  }, [progress, imgSize]);

  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;
    if (contactVisible) {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "0";
      textEl.style.filter = "blur(12px)";
    } else if (progress > 0.85) {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "1";
      textEl.style.filter = "blur(0px)";
    }
  }, [contactVisible, progress]);

  const handleContactEnter = () => {
    if (shaking) return;
    setShaking(true);
    setTimeout(() => {
      setShaking(false);
      setContactHovered(true);
    }, 400);
  };

  const inputStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    borderBottom: "1.5px solid #000",
    color: "#000",
    fontSize: "clamp(13px, 1.5vw, 16px)",
    padding: "6px 0",
    outline: "none",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "9px",
    color: "#000",
  };

  return (
    <>
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: black;
          position: fixed;
          perspective: 1000px;
          transform-style: preserve-3d;
        }
        
        * {
          font-family: 'Arial Black', Arial, sans-serif !important;
          text-transform: uppercase !important;
          box-sizing: border-box;
        }

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
          0% { transform: scale(1); }
          5% { transform: scale(1.03); }
          10% { transform: scale(1); }
          15% { transform: scale(1.03); }
          20% { transform: scale(1); }
          100% { transform: scale(1); }
        }

        .heartbeat-wrapper {
          display: inline-block;
          transform-origin: center center;
          animation: heartbeat 2s ease-in-out infinite;
        }
        input::placeholder, textarea::placeholder { color: rgba(0,0,0,0.2); }
        
        .masked-grid {
          display: flex;
          flex-direction: column;
          position: relative;
          transition: transform 0.1s ease-out;
        }

        .text-line {
          font-family: 'Arial Black', Arial, sans-serif !important;
          font-weight: 900 !important;
          letter-spacing: -0.03em;
          line-height: 0.92;
          color: white;
        }
        
        .nav-item {
            cursor: pointer;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
            transition: opacity 0.3s ease;
        }
        .nav-item:hover { opacity: 0.6; }

        .desktop-br { display: inline; }
        .mobile-br { display: none; }

        .card-title {
          font-family: 'Arial Black', Arial, sans-serif !important;
          font-weight: 900 !important;
          letter-spacing: -0.02em;
        }

        .card-label {
          font-family: 'Arial Black', Arial, sans-serif !important;
          font-weight: 900 !important;
          letter-spacing: 0.1em;
        }

        .card-input {
          font-family: 'Arial Black', Arial, sans-serif !important;
          font-weight: 900 !important;
          letter-spacing: -0.02em;
        }

        .card-btn {
          font-family: 'Arial Black', Arial, sans-serif !important;
          font-weight: 900 !important;
          letter-spacing: 0.15em;
        }

        @media (max-width: 768px) {
          .desktop-br { display: none; }
          .mobile-br { display: block; }
          
          .text-line {
            font-size: 8.5vw !important;
            letter-spacing: -0.05em;
            -webkit-text-stroke: 1.2px white;
            paint-order: stroke fill;
          }
          .contact-trigger {
            font-size: 8.5vw !important;
            margin-top: 1.2em !important;
          }

          .card-title {
            -webkit-text-stroke: 0.8px #000;
            paint-order: stroke fill;
          }
          .card-label {
            -webkit-text-stroke: 0.3px #000;
            paint-order: stroke fill;
          }
          .card-input {
            -webkit-text-stroke: 0.4px #000;
            paint-order: stroke fill;
          }
          .card-btn {
            -webkit-text-stroke: 0.4px #fff;
            paint-order: stroke fill;
          }
        }
      `}</style>

      {/* STICKY MENU */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
        padding: "40px 80px", display: "flex", justifyContent: "space-between",
        color: menuColor, fontSize: "11px", letterSpacing: "0.2em", transition: "color 0.4s ease"
      }}>
        <div style={{ fontWeight: 900 }}>ARTEM.DESIGN</div>
        <div style={{ display: "flex", gap: "40px", fontWeight: 700 }}>
          {["WORK", "PROCESS", "ABOUT", "CONTACT"].map(item => (
            <span key={item} className="nav-item" onClick={item === "CONTACT" ? openContact : undefined}>{item}</span>
          ))}
        </div>
      </nav>

      {showContact && (
        <div
          onClick={(e) => e.target === e.currentTarget && !isSending && closeContact()}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: contactVisible ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)",
            transition: "background 0.5s ease",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{
            background: "#fff", color: "#000", width: "min(520px, 90vw)", aspectRatio: "1 / 1",
            padding: "clamp(24px, 5vw, 40px)", transform: contactVisible ? "translate3d(0, 0, 0)" : "translate3d(0, 60px, 0)",
            opacity: contactVisible ? 1 : 0, transition: "transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.5s ease",
            display: "flex", flexDirection: "column", justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
              <div className="card-title" style={{ fontSize: "clamp(18px, 3.2vw, 28px)", fontWeight: 900, lineHeight: 1 }}>LET'S WORK</div>
              <button disabled={isSending} onClick={closeContact} style={{ background: "none", border: "none", fontSize: "24px", cursor: isSending ? "not-allowed" : "pointer" }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(12px, 2vw, 15px)", flexGrow: 1, justifyContent: "center" }}>
              {[{ label: "YOUR NAME", key: "name" as const, type: "text" }, { label: "EMAIL", key: "email" as const, type: "email" }].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="card-label" style={labelStyle}>{label}</label>
                  <input type={type} className="card-input" disabled={isSending} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value.toUpperCase() })} style={inputStyle} />
                </div>
              ))}

              <div>
                <label className="card-label" style={labelStyle}>SERVICE</label>
                <select
                  className="card-input"
                  style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                >
                  <option>ILLUSTRATION</option>
                  <option>LOGO</option>
                  <option>MOTION</option>
                  <option>ANIMATION</option>
                </select>
              </div>

              <div>
                <label className="card-label" style={labelStyle}>MESSAGE</label>
                <textarea
                  ref={textareaRef}
                  className="card-input"
                  disabled={isSending}
                  value={form.message}
                  onChange={handleMessageChange}
                  rows={1}
                  style={{
                    ...inputStyle,
                    resize: "none",
                    overflow: "hidden",
                    lineHeight: "1.4",
                    transition: "height 0.25s ease",
                    display: "block",
                    minHeight: "24px"
                  }}
                />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={isSending} className="card-btn" style={{ background: "#000", color: "#fff", border: "none", padding: "14px 32px", fontSize: "10px", fontWeight: 900, cursor: isSending ? "not-allowed" : "pointer", alignSelf: "flex-start" }}>
              {isSending ? "SENDING..." : "SEND"}
            </button>
          </div>
        </div>
      )}

      <main style={{ position: "fixed", width: "100vw", height: "100vh", top: 0, left: 0, overflow: "hidden", background: "black" }}>

        <div
          ref={pinkSectionRef}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            background: "#ffbbc6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            willChange: "opacity, transform"
          }}
        />

        <video
          ref={videoRef}
          src={videoSrc}
          muted
          loop
          autoPlay
          playsInline
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100vw", height: "100vh",
            objectFit: "cover", zIndex: 0,
            opacity: 0,
            willChange: "opacity"
          }}
        />
        <div ref={videoOverlayRef} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1, pointerEvents: "none", transition: "background 0.1s ease-out" }} />

        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", zIndex: 2, overflow: "hidden" }}>
          <div ref={gridRef} className="masked-grid" style={{ gap: `${GAP}px`, willChange: "transform, opacity, filter", opacity: 0 }}>
            {rows.map((images, rowIndex) => {
              const looped = [...images, ...images];
              return (
                <div
                  key={rowIndex}
                  ref={(el) => { trackRefs.current[rowIndex] = el; }}
                  style={{
                    display: "flex",
                    gap: `${GAP}px`,
                    width: "max-content",
                    paddingLeft: `${GAP}px`,
                    paddingRight: `${GAP}px`,
                    willChange: "transform"
                  }}
                >
                  {looped.map((img, i) => (
                    <div key={rowIndex + "-" + i} style={{ width: `${imgSize}px`, height: `${imgSize}px`, borderRadius: "12px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
                      <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div
          ref={textRef}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            padding: "0 clamp(20px, 6vw, 80px)",
            opacity: 0,
            transform: "translate3d(0, 30px, 0)",
            willChange: "transform, opacity",
            pointerEvents: "none"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", width: "100%" }}>
            <div className="text-line" style={{ fontSize: "clamp(32px, 6.5vw, 88px)" }}>
              MY NAME <span className="mobile-br" />IS ARTEM
            </div>

            <div className="text-line" style={{ fontSize: "clamp(32px, 6.5vw, 88px)", marginTop: "0.15em" }}>
              I'M A <span className="mobile-br" />DESIGNER
            </div>

            <div
              className={`text-line contact-trigger ${shaking ? "shakeY" : ""}`}
              onMouseEnter={handleContactEnter}
              onMouseLeave={() => setContactHovered(false)}
              onClick={openContact}
              style={{
                fontSize: "clamp(32px, 6.5vw, 88px)",
                marginTop: "1.6em",
                cursor: "pointer",
                display: "inline-block",
                userSelect: "none"
              }}
            >
              <span className="heartbeat-wrapper">
                {contactHovered ? "GET YOUR BEST DESIGN EVER" : "CONTACT ME"}
              </span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}