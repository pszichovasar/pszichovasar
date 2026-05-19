"use client";

import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const scene1Ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const maskVideoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLVideoElement>(null);
  const [opacity, setOpacity] = useState(1);
  const [blur, setBlur] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [imgSize, setImgSize] = useState(140);
  const gridRef = useRef<HTMLDivElement>(null);
  const [maskOpacity, setMaskOpacity] = useState(0);
  const maskTriggeredRef = useRef(false);
  const maskPlayingRef = useRef(false);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [contactHovered, setContactHovered] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [isSending, setIsSending] = useState(false);

  // Стейт для динамической смены видео (по умолчанию для ПК идет /me.mp4)
  const [videoSrc, setVideoSrc] = useState("/me.mp4");

  const row0 = ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg", "/8.jpg", "/9.jpg", "/10.jpg"];
  const row1 = ["/11.jpg", "/13.jpg", "/15.jpg", "/17.jpg", "/19.jpg", "/12.jpg", "/14.jpg", "/16.jpg", "/18.jpg", "/20.jpg"];
  const row2 = ["/1.jpg", "/3.jpg", "/5.jpg", "/7.jpg", "/9.jpg", "/2.jpg", "/4.jpg", "/6.jpg", "/8.jpg", "/10.jpg"];
  const row3 = ["/11.jpg", "/13.jpg", "/15.jpg", "/17.jpg", "/19.jpg", "/12.jpg", "/14.jpg", "/16.jpg", "/18.jpg", "/20.jpg"];
  const row4 = ["/2.jpg", "/4.jpg", "/6.jpg", "/8.jpg", "/10.jpg", "/1.jpg", "/3.jpg", "/5.jpg", "/7.jpg", "/9.jpg"];

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
        setForm({ name: "", email: "", message: "" });
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

  // ОПРЕДЕЛЕНИЕ IPHONE / IOS УСТРОЙСТВ
  useEffect(() => {
    const isiPhone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isiPhone) {
      setVideoSrc("/iome.mp4");
    }
  }, []);

  // Перезагрузка видеоплеера при смене источника (Обязательно для корректной работы Safari)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [videoSrc]);

  useEffect(() => {
    const calcSize = () => {
      const vh = window.innerHeight;
      setImgSize(Math.floor((vh - GAP * 6) / 5));
    };
    calcSize();
    window.addEventListener("resize", calcSize);
    return () => window.removeEventListener("resize", calcSize);
  }, []);

  useEffect(() => {
    const video = maskVideoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!video.duration) return;
      const timeLeft = video.duration - video.currentTime;
      if (timeLeft <= 1.5 && maskPlayingRef.current) {
        maskPlayingRef.current = false;
        const fadeOut = () => {
          setMaskOpacity((prev) => {
            if (prev <= 0) return 0;
            requestAnimationFrame(fadeOut);
            return Math.max(0, prev - 0.02);
          });
        };
        fadeOut();
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  useEffect(() => {
    const TRIGGER_PROGRESS = 0.28;

    const handleScroll = () => {
      const scene1 = scene1Ref.current;
      const video = videoRef.current;
      const maskVideo = maskVideoRef.current;
      const textEl = textRef.current;
      if (!scene1 || !video) return;

      const scrollY = window.scrollY;
      const progress = Math.min(Math.max(-scene1.getBoundingClientRect().top / scene1.offsetHeight, 0), 1);

      trackRefs.current.forEach((track, i) => {
        if (!track) return;
        const maxMove = track.scrollWidth / 2;
        if (directions[i]) {
          track.style.transform = `translateX(${-progress * maxMove}px)`;
        } else {
          track.style.transform = `translateX(${-maxMove + progress * maxMove}px)`;
        }
      });

      const fadeStart = 0.8;
      const meOpacity = Math.max((progress - fadeStart) / (1 - fadeStart), 0);
      video.style.opacity = meOpacity.toString();

      if (maskVideo && !maskTriggeredRef.current && progress >= TRIGGER_PROGRESS) {
        maskTriggeredRef.current = true;
        maskPlayingRef.current = true;
        maskVideo.currentTime = 0;
        maskVideo.play();
        const fadeIn = () => {
          setMaskOpacity((prev) => {
            if (prev >= 1) return 1;
            requestAnimationFrame(fadeIn);
            return Math.min(1, prev + 0.03);
          });
        };
        fadeIn();
      }

      const scene1End = scene1.offsetTop + scene1.offsetHeight - window.innerHeight;

      if (textEl) {
        if (scrollY < scene1End) {
          textEl.style.transform = "translateY(120vh)";
          textEl.style.opacity = "0";
        } else {
          const scene2ScrollY = scrollY - scene1End;
          const textProgress = Math.min(scene2ScrollY / (window.innerHeight * 3.5), 1);
          const translateY = Math.max(0, (1 - textProgress) * 120);
          const textOpacity = Math.min(textProgress * 2, 1);
          textEl.style.transform = `translateY(${translateY}vh)`;
          textEl.style.opacity = textOpacity.toString();
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;
    if (contactVisible) {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "0";
      textEl.style.filter = "blur(12px)";
    } else {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "";
      textEl.style.filter = "blur(0px)";
      setTimeout(() => {
        if (textEl) textEl.style.transition = "";
      }, 450);
    }
  }, [contactVisible]);

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
    fontSize: "clamp(14px, 1.8vw, 17px)",
    padding: "10px 0",
    outline: "none",
    fontFamily: "'Arial Black', Gadget, sans-serif",
    textTransform: "uppercase",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "10px",
    letterSpacing: "0.2em",
    color: "#000",
    textTransform: "uppercase",
    fontFamily: "'Arial Black', Gadget, sans-serif",
  };

  return (
    <>
      <style>{`
        * {
          font-family: 'Arial Black', Gadget, sans-serif !important;
          text-transform: uppercase !important;
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
        input::placeholder, textarea::placeholder { color: rgba(0,0,0,0.2); }
        
        .masked-grid {
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .mask-video-element {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          object-fit: cover;
          pointer-events: none;
          mix-blend-mode: multiply;
          z-index: 5;
          will-change: opacity;
        }

        .text-line {
          font-weight: 900;
          letter-spacing: -0.01em;
          line-height: 1.0;
          color: white;
        }
        
        .desktop-br { display: inline; }
        .mobile-br { display: none; }

        @media (max-width: 768px) {
          .desktop-br { display: none; }
          .mobile-br { display: block; }
          
          .text-line {
            font-size: 8.5vw !important; 
          }
          .contact-trigger {
            font-size: 8.5vw !important;
            margin-top: 1.2em !important;
          }
        }
      `}</style>

      <video
        ref={maskVideoRef}
        src="/mask.mp4"
        muted
        playsInline
        preload="auto"
        className="mask-video-element"
        style={{ opacity: maskOpacity, display: maskOpacity > 0 ? "block" : "none" }}
      />

      {/* Contact modal */}
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
            background: "#fff",
            color: "#000",
            width: "min(520px, 90vw)",
            padding: "48px",
            transform: contactVisible ? "translateY(0)" : "translateY(60px)",
            opacity: contactVisible ? 1 : 0,
            transition: "transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.5s ease",
            boxSizing: "border-box",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px" }}>
              <div style={{ fontSize: "clamp(20px, 3.5vw, 32px)", fontWeight: 900, letterSpacing: "-0.01em", lineHeight: 1, color: "#000" }}>
                LET'S WORK
              </div>
              <button disabled={isSending} onClick={closeContact} style={{ background: "none", border: "none", color: "#000", fontSize: "26px", cursor: isSending ? "not-allowed" : "pointer", lineHeight: 1, padding: 0, marginTop: "-2px" }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              {[
                { label: "YOUR NAME", key: "name" as const, type: "text" },
                { label: "EMAIL", key: "email" as const, type: "email" },
              ].map(({ label, key, type }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    type={type}
                    disabled={isSending}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value.toUpperCase() })}
                    style={inputStyle}
                  />
                </div>
              ))}

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={labelStyle}>MESSAGE</label>
                <textarea ref={textareaRef} disabled={isSending} value={form.message} onChange={handleMessageChange} rows={1} style={{ ...inputStyle, resize: "none", overflow: "hidden", lineHeight: "1.5", transition: "height 0.25s ease", display: "block", verticalAlign: "bottom" }} />
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSending}
                style={{
                  marginTop: "12px",
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  padding: "16px 36px",
                  fontSize: "11px",
                  letterSpacing: "0.2em",
                  fontWeight: 900,
                  cursor: isSending ? "not-allowed" : "pointer",
                  alignSelf: "flex-start",
                  opacity: isSending ? 0.6 : 1
                }}
              >
                {isSending ? "SENDING..." : "SEND"}
              </button>
            </div>
          </div>
        </div>
      )}

      {playCount < 3 && (
        <video
          ref={overlayRef}
          autoPlay
          muted
          playsInline
          style={{
            position: "fixed", top: 0, left: 0,
            width: "100vw", height: "100vh",
            objectFit: "cover", zIndex: 9999,
            pointerEvents: "none", opacity,
            filter: `blur(${blur}px)`,
            transition: "opacity 0.1s linear, filter 0.1s linear",
          }}
          onTimeUpdate={() => {
            const v = overlayRef.current;
            if (!v) return;
            const timeLeft = v.duration - v.currentTime;
            if (timeLeft <= 1) { setOpacity(timeLeft); setBlur((1 - timeLeft) * 12); }
          }}
          onEnded={() => { setOpacity(0); setBlur(12); }}
        >
          <source src="/overlay.mp4" type='video/mp4; codecs="hvc1"' />
          <source src="/overlay.webm" type="video/webm" />
        </video>
      )}

      <main style={{ background: "black", color: "white" }}>

        {/* SCENE 1 */}
        <section ref={scene1Ref} style={{ height: "250vh", position: "relative", zIndex: 2 }}>
          {/* ФОНОВОЕ ВИДЕО С ПОДДЕРЖКОЙ ДИНАМИЧЕСКОГО СТАТУСА КАНАЛА */}
          <video
            ref={videoRef}
            src={videoSrc} // Используем переменную со ссылкой на видео
            muted
            loop
            autoPlay
            playsInline
            style={{
              position: "fixed", top: 0, left: 0,
              width: "100vw", height: "100vh",
              objectFit: "cover", zIndex: 0,
              opacity: 0, transition: "opacity 0.3s ease",
            }}
          />
          <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.3)", zIndex: 1, pointerEvents: "none" }} />

          <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", display: "flex", alignItems: "center", zIndex: 2 }}>
            <div ref={gridRef} className="masked-grid" style={{ gap: `${GAP}px`, paddingTop: `${GAP}px`, paddingBottom: `${GAP}px` }}>
              {rows.map((images, rowIndex) => {
                const looped = [...images, ...images];
                return (
                  <div
                    key={rowIndex}
                    ref={(el) => { trackRefs.current[rowIndex] = el; }}
                    style={{ display: "flex", gap: `${GAP}px`, width: "max-content", paddingLeft: `${GAP}px`, paddingRight: `${GAP}px` }}
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
        </section>

        {/* SCENE 2 */}
        <section style={{ height: "600vh", position: "relative", zIndex: 3, background: "transparent" }}>
          <div
            ref={textRef}
            style={{
              position: "sticky",
              top: "10vh",
              height: "75vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              padding: "0 clamp(20px, 6vw, 80px)",
              transform: "translateY(120vh)",
              opacity: 0,
              willChange: "transform, opacity",
            }}
          >
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
              {contactHovered ? "GET YOUR BEST DESIGN EVER" : "CONTACT ME"}
            </div>
          </div>
        </section>

        <section style={{ height: "40vh", background: "#000" }} />
      </main>
    </>
  );
}