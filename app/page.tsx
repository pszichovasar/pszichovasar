"use client";

import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const [progress, setProgress] = useState(0); // Общий прогресс сайта от 0 до 1
  const [videoSrc, setVideoSrc] = useState("/me.mp4");
  const [imgSize, setImgSize] = useState(140);

  const videoRef = useRef<HTMLVideoElement>(null);
  const maskVideoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLVideoElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Состояния для начального появления оверлея (входная анимация)
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [overlayBlur, setOverlayBlur] = useState(20);
  const [maskOpacity, setMaskOpacity] = useState(0);

  const maskPlayingRef = useRef(false);
  const maskFinishedRef = useRef(false);

  const [contactHovered, setContactHovered] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
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

  // Проверка на iOS устройства
  useEffect(() => {
    const isiPhone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isiPhone) {
      setVideoSrc("/iome.mp4");
    }
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.load();
  }, [videoSrc]);

  // Расчет размеров плиток
  useEffect(() => {
    const calcSize = () => {
      const vh = window.innerHeight;
      setImgSize(Math.floor((vh - GAP * 6) / 5));
    };
    calcSize();
    window.addEventListener("resize", calcSize);
    return () => window.removeEventListener("resize", calcSize);
  }, []);

  // Входная анимация оверлея и запуск маски при загрузке
  useEffect(() => {
    // Плавное появление оверлея из блюра при заходе
    let start = performance.now();
    const duration = 800; // 0.8 секунды на проявление

    const animateOverlayIn = (time: number) => {
      const timeFraction = Math.min((time - start) / duration, 1);
      setOverlayOpacity(timeFraction);
      setOverlayBlur((1 - timeFraction) * 20);

      if (timeFraction < 1) {
        requestAnimationFrame(animateOverlayIn);
      }
    };
    requestAnimationFrame(animateOverlayIn);

    // Запуск mask.mp4
    const maskVideo = maskVideoRef.current;
    if (!maskVideo) return;

    maskPlayingRef.current = true;
    maskVideo.currentTime = 0;
    maskVideo.play().catch(() => { });

    const fadeInMask = () => {
      setMaskOpacity((prev) => {
        if (prev >= 1) return 1;
        requestAnimationFrame(fadeInMask);
        return Math.min(1, prev + 0.04);
      });
    };
    fadeInMask();

    const handleTimeUpdate = () => {
      if (!maskVideo.duration) return;
      const timeLeft = maskVideo.duration - maskVideo.currentTime;

      if (timeLeft <= 0.1 && !maskFinishedRef.current) {
        maskFinishedRef.current = true;
      }

      if (timeLeft <= 1.5 && maskPlayingRef.current) {
        maskPlayingRef.current = false;
        const fadeOutMask = () => {
          setMaskOpacity((prev) => {
            if (prev <= 0) return 0;
            requestAnimationFrame(fadeOutMask);
            return Math.max(0, prev - 0.02);
          });
        };
        fadeOutMask();
      }
    };

    maskVideo.addEventListener("timeupdate", handleTimeUpdate);
    return () => maskVideo.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  // Виртуальный скролл со стопором маски
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (showContact) return;
      e.preventDefault();

      const speed = 0.0015;
      let next = currentProgressRef.current + e.deltaY * speed;

      if (!maskFinishedRef.current && next > 0.3) {
        next = 0.3;
      }

      next = Math.min(Math.max(next, 0), 1);
      currentProgressRef.current = next;
      setProgress(next);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (showContact) return;
      touchStartRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (showContact) return;
      e.preventDefault();

      const currentY = e.touches[0].clientY;
      const deltaY = touchStartRef.current - currentY;
      touchStartRef.current = currentY;

      const speed = 0.003;
      let next = currentProgressRef.current + deltaY * speed;

      if (!maskFinishedRef.current && next > 0.3) {
        next = 0.3;
      }

      next = Math.min(Math.max(next, 0), 1);
      currentProgressRef.current = next;
      setProgress(next);
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

  // Интерактивный таймлайн анимаций
  useEffect(() => {
    // Движение сетки
    const gridProgress = Math.min(progress / 0.65, 1);
    trackRefs.current.forEach((track, i) => {
      if (!track) return;
      const maxMove = track.scrollWidth / 2;
      if (directions[i]) {
        track.style.transform = `translate3d(${-gridProgress * maxMove}px, 0, 0)`;
      } else {
        track.style.transform = `translate3d(${-maxMove + gridProgress * maxMove}px, 0, 0)`;
      }
    });

    if (gridRef.current) {
      const scale = 1 - gridProgress * 0.05;
      gridRef.current.style.transform = `scale(${scale})`;
    }

    // === ИСЧЕЗНОВЕНИЕ СЕТКИ ЧЕРЕЗ БЛЮР И ОПАСИТИ (от 0.3 до 0.5) ===
    if (gridRef.current) {
      if (progress <= 0.3) {
        gridRef.current.style.opacity = "1";
        gridRef.current.style.filter = "blur(0px)";
      } else if (progress > 0.5) {
        gridRef.current.style.opacity = "0";
        gridRef.current.style.filter = "blur(30px)";
      } else {
        const gridFade = (progress - 0.3) / (0.5 - 0.3); // 0 -> 1
        gridRef.current.style.opacity = (1 - gridFade).toString();
        gridRef.current.style.filter = `blur(${gridFade * 30}px)`;
      }
    }

    // === УПРАВЛЕНИЕ ОВЕРЛЕЕМ ПО СКРОЛЛУ (от 0.5 до 0.68) ===
    // Начинает исчезать после сетки и полностью пропадает, когда вылезает "I'M A DESIGNER" (0.68)
    if (overlayRef.current) {
      if (progress <= 0.5) {
        overlayRef.current.style.opacity = overlayOpacity.toString();
        overlayRef.current.style.filter = `blur(${overlayBlur}px)`;
      } else if (progress > 0.68) {
        overlayRef.current.style.opacity = "0";
        overlayRef.current.style.filter = "blur(20px)";
      } else {
        const overlayProgress = (progress - 0.5) / (0.68 - 0.5); // 0 -> 1
        overlayRef.current.style.opacity = (1 - overlayProgress).toString();
        overlayRef.current.style.filter = `blur(${overlayProgress * 20}px)`;
      }
    }

    // === ПРОЯВЛЕНИЕ ВИДЕО 'ME' (от 0.5 до 0.65) ===
    if (videoRef.current) {
      if (progress <= 0.5) {
        videoRef.current.style.opacity = "0";
        videoRef.current.style.filter = "blur(20px)";
      } else if (progress > 0.65) {
        videoRef.current.style.opacity = "1";
        videoRef.current.style.filter = "blur(0px)";
      } else {
        const videoProgress = (progress - 0.5) / (0.65 - 0.5);
        const currentBlur = (1 - videoProgress) * 20;
        videoRef.current.style.opacity = videoProgress.toString();
        videoRef.current.style.filter = `blur(${currentBlur}px)`;
      }
    }

    // === ПОЯВЛЕНИЕ ТЕКСТА (от 0.68 до 0.9) ===
    if (textRef.current) {
      if (progress > 0.68) {
        const textProgress = Math.min((progress - 0.68) / 0.22, 1);
        textRef.current.style.opacity = textProgress.toString();
        textRef.current.style.transform = `translate3d(0, ${(1 - textProgress) * 30}px, 0)`;
        textRef.current.style.pointerEvents = "auto";
      } else {
        textRef.current.style.opacity = "0";
        textRef.current.style.transform = "translate3d(0, 30px, 0)";
        textRef.current.style.pointerEvents = "none";
      }
    }
  }, [progress, overlayOpacity, overlayBlur]);

  // Контакты и дополнительный блюр текста
  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;
    if (contactVisible) {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "0";
      textEl.style.filter = "blur(12px)";
    } else if (progress > 0.68) {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "1";
      textEl.style.filter = "blur(0px)";
      setTimeout(() => { if (textEl) textEl.style.transition = ""; }, 450);
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
    fontSize: "clamp(12px, 1.5vw, 15px)",
    padding: "6px 0",
    outline: "none",
    fontFamily: "'Arial Black', Gadget, sans-serif",
    textTransform: "uppercase",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "9px",
    letterSpacing: "0.2em",
    color: "#000",
    textTransform: "uppercase",
    fontFamily: "'Arial Black', Gadget, sans-serif",
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
        }

        * {
          font-family: 'Arial Black', Gadget, sans-serif !important;
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
        input::placeholder, textarea::placeholder { color: rgba(0,0,0,0.2); }
        
        .masked-grid {
          display: flex;
          flex-direction: column;
          position: relative;
          transition: transform 0.1s ease-out;
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
          .mobile-br { block; }
          
          .text-line {
            font-size: 8.5vw !important; 
          }
          .contact-trigger {
            font-size: 8.5vw !important;
            margin-top: 1.2em !important;
          }
        }
      `}</style>

      {/* Маска */}
      <video
        ref={maskVideoRef}
        src="/mask.mp4"
        muted
        playsInline
        preload="auto"
        className="mask-video-element"
        style={{ opacity: maskOpacity, display: maskOpacity > 0 ? "block" : "none" }}
      />

      {/* Модальное окно контактов */}
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
            aspectRatio: "1 / 1",
            padding: "clamp(24px, 5vw, 40px)",
            transform: contactVisible ? "translate3d(0, 0, 0)" : "translate3d(0, 60px, 0)",
            opacity: contactVisible ? 1 : 0,
            transition: "transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.5s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
              <div style={{ fontSize: "clamp(18px, 3.2vw, 28px)", fontWeight: 900, letterSpacing: "-0.01em", lineHeight: 1, color: "#000" }}>
                LET'S WORK
              </div>
              <button disabled={isSending} onClick={closeContact} style={{ background: "none", border: "none", color: "#000", fontSize: "24px", cursor: isSending ? "not-allowed" : "pointer", lineHeight: 1, padding: 0, marginTop: "-4px" }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(12px, 2.5vw, 20px)", flexGrow: 1, justifyContent: "center", margin: "16px 0" }}>
              {[
                { label: "YOUR NAME", key: "name" as const, type: "text" },
                { label: "EMAIL", key: "email" as const, type: "email" },
              ].map(({ label, key, type }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
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

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={labelStyle}>MESSAGE</label>
                <textarea ref={textareaRef} disabled={isSending} value={form.message} onChange={handleMessageChange} rows={1} style={{ ...inputStyle, resize: "none", overflow: "hidden", lineHeight: "1.4", transition: "height 0.25s ease", display: "block", verticalAlign: "bottom" }} />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSending}
              style={{
                background: "#000",
                color: "#fff",
                border: "none",
                padding: "14px 32px",
                fontSize: "10px",
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
      )}

      {/* ОВЕРЛЕЙ: Появляется через блюр на старте, исчезает строго по скроллу */}
      <video
        ref={overlayRef}
        autoPlay
        muted
        playsInline
        loop
        style={{
          position: "fixed", top: 0, left: 0,
          width: "100vw", height: "100vh",
          objectFit: "cover", zIndex: 9999,
          pointerEvents: "none",
          opacity: overlayOpacity,
          filter: `blur(${overlayBlur}px)`,
          willChange: "opacity, filter"
        }}
      >
        <source src="/overlay.mp4" type='video/mp4; codecs="hvc1"' />
        <source src="/overlay.webm" type="video/webm" />
      </video>

      {/* ОСНОВНОЙ ФИКСИРОВАННЫЙ КОНТЕЙНЕР */}
      <main style={{ position: "fixed", width: "100vw", height: "100vh", top: 0, left: 0, overflow: "hidden", background: "black" }}>

        {/* Видео заднего плана 'ME' */}
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
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1, pointerEvents: "none" }} />

        {/* Контейнер Сетки (Scene 1) */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", zIndex: 2, overflow: "hidden" }}>
          <div ref={gridRef} className="masked-grid" style={{ gap: `${GAP}px`, willChange: "transform, opacity, filter" }}>
            {rows.map((images, rowIndex) => {
              const looped = [...images, ...images];
              return (
                <div
                  key={rowIndex}
                  ref={(el) => { trackRefs.current[rowIndex] = el; }}
                  style={{ display: "flex", gap: `${GAP}px`, width: "max-content", paddingLeft: `${GAP}px`, paddingRight: `${GAP}px`, willChange: "transform" }}
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

        {/* Сцена Текста (Scene 2) */}
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
              {contactHovered ? "GET YOUR BEST DESIGN EVER" : "CONTACT ME"}
            </div>
          </div>
        </div>

      </main>
    </>
  );
}