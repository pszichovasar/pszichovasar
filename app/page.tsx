"use client";

import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const [progress, setProgress] = useState(0); // Общий прогресс сайта от 0 до 1
  const [videoSrc, setVideoSrc] = useState("/me.mp4");
  const [imgSize, setImgSize] = useState(140);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoOverlayRef = useRef<HTMLDivElement>(null);
  const maskVideoRef = useRef<HTMLVideoElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Стейты для кинематографичного появления/исчезновения маски
  const [maskOpacity, setMaskOpacity] = useState(0);
  const [maskBlur, setMaskBlur] = useState(20);

  const maskPlayingRef = useRef(false);
  const maskFinishedRef = useRef(false);

  const [contactHovered, setContactHovered] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [isSending, setIsSending] = useState(false);

  // --- Стейты для радиального меню ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  // Обработчик для кликов по опциям меню
  const handleMenuOptionClick = (option: string) => {
    setIsMenuOpen(false);
    if (option === "CONTACT") {
      // Чтобы анимация закрытия кольца не конфликтовала с открытием контактов
      setTimeout(() => openContact(), 400);
    } else {
      alert(`NAVIGATING TO: ${option}`);
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

  // Улучшенный запуск маски
  useEffect(() => {
    const maskVideo = maskVideoRef.current;
    if (!maskVideo) return;

    let fallbackTimeout: NodeJS.Timeout;
    let animationFrameId: number;

    const startMaskPlayback = () => {
      if (maskPlayingRef.current) return;
      maskPlayingRef.current = true;

      maskVideo.currentTime = 0;

      fallbackTimeout = setTimeout(() => {
        maskFinishedRef.current = true;
      }, 3500);

      const playPromise = maskVideo.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            let currentOpacity = 0;
            let currentBlur = 20;

            const fadeInMask = () => {
              currentOpacity = Math.min(1, currentOpacity + 0.05);
              currentBlur = Math.max(0, currentBlur - 1);

              setMaskOpacity(currentOpacity);
              setMaskBlur(currentBlur);

              if (currentOpacity < 1 || currentBlur > 0) {
                animationFrameId = requestAnimationFrame(fadeInMask);
              }
            };
            animationFrameId = requestAnimationFrame(fadeInMask);
          })
          .catch((err) => {
            console.log("Автоплей маски заблокирован мобильной системой:", err);
            maskFinishedRef.current = true;
          });
      }
    };

    if (maskVideo.readyState >= 1) {
      startMaskPlayback();
    } else {
      maskVideo.addEventListener("loadedmetadata", startMaskPlayback, { once: true });
    }

    const handleTimeUpdate = () => {
      if (!maskVideo.duration) return;
      const timeLeft = maskVideo.duration - maskVideo.currentTime;

      if (timeLeft <= 0.15 && !maskFinishedRef.current) {
        maskFinishedRef.current = true;
        clearTimeout(fallbackTimeout);
      }

      if (timeLeft <= 1.5 && maskPlayingRef.current) {
        maskPlayingRef.current = false;
        cancelAnimationFrame(animationFrameId);

        let currentOpacity = 1;
        let currentBlur = 0;

        const fadeOutMask = () => {
          currentOpacity = Math.max(0, currentOpacity - 0.03);
          currentBlur = Math.min(20, currentBlur + 0.5);

          setMaskOpacity(currentOpacity);
          setMaskBlur(currentBlur);

          if (currentOpacity > 0 || currentBlur < 20) {
            animationFrameId = requestAnimationFrame(fadeOutMask);
          }
        };
        animationFrameId = requestAnimationFrame(fadeOutMask);
      }
    };

    const handleVideoEnded = () => {
      maskFinishedRef.current = true;
      setMaskOpacity(0);
      setMaskBlur(20);
      clearTimeout(fallbackTimeout);
    };

    maskVideo.addEventListener("timeupdate", handleTimeUpdate);
    maskVideo.addEventListener("ended", handleVideoEnded);

    return () => {
      maskVideo.removeEventListener("loadedmetadata", startMaskPlayback);
      maskVideo.removeEventListener("timeupdate", handleTimeUpdate);
      maskVideo.removeEventListener("ended", handleVideoEnded);
      cancelAnimationFrame(animationFrameId);
      clearTimeout(fallbackTimeout);
    };
  }, []);

  // Виртуальный скролл
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (showContact || isMenuOpen) return;
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
      if (showContact || isMenuOpen) return;
      touchStartRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (showContact || isMenuOpen) return;
      e.preventDefault();

      const currentY = e.touches[0].clientY;
      const deltaY = touchStartRef.current - currentY;
      touchStartRef.current = currentY;

      const speed = 0.002;
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
  }, [showContact, isMenuOpen]);

  // Анимации по скроллу
  useEffect(() => {
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

    if (gridRef.current) {
      if (progress <= 0.3) {
        gridRef.current.style.opacity = "1";
        gridRef.current.style.filter = "blur(0px)";
      } else if (progress > 0.5) {
        gridRef.current.style.opacity = "0";
        gridRef.current.style.filter = "blur(30px)";
      } else {
        const gridFade = (progress - 0.3) / (0.5 - 0.3);
        gridRef.current.style.opacity = (1 - gridFade).toString();
        gridRef.current.style.filter = `blur(${gridFade * 30}px)`;
      }
    }

    if (videoRef.current) {
      let baseBlur = 0;
      let baseOpacity = 0;

      if (progress <= 0.5) {
        baseOpacity = 0;
        baseBlur = 20;
      } else if (progress > 0.5 && progress <= 0.65) {
        const videoProgress = (progress - 0.5) / (0.65 - 0.5);
        baseOpacity = videoProgress;
        baseBlur = (1 - videoProgress) * 20;
      } else if (progress > 0.65 && progress <= 0.8) {
        baseOpacity = 1;
        baseBlur = 0;
      } else {
        const blurProgress = (progress - 0.8) / (1.0 - 0.8);
        baseOpacity = 1;
        baseBlur = blurProgress * 4;
      }

      videoRef.current.style.opacity = baseOpacity.toString();
      videoRef.current.style.filter = `blur(${baseBlur}px)`;
    }

    if (videoOverlayRef.current) {
      if (progress > 0.8) {
        const darkProgress = (progress - 0.8) / (1.0 - 0.8);
        videoOverlayRef.current.style.background = `rgba(0, 0, 0, ${0.3 + darkProgress * 0.3})`;
      } else {
        videoOverlayRef.current.style.background = "rgba(0, 0, 0, 0.3)";
      }
    }

    if (textRef.current) {
      if (progress > 0.65) {
        const textProgress = Math.min((progress - 0.65) / 0.2, 1);
        textRef.current.style.opacity = textProgress.toString();
        textRef.current.style.transform = `translate3d(0, ${(1 - textProgress) * 30}px, 0)`;
        textRef.current.style.pointerEvents = isMenuOpen ? "none" : "auto";
      } else {
        textRef.current.style.opacity = "0";
        textRef.current.style.transform = "translate3d(0, 30px, 0)";
        textRef.current.style.pointerEvents = "none";
      }
    }
  }, [progress, isMenuOpen]);

  // Скрытие основного текста при открытом меню или контактах
  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;
    if (contactVisible || isMenuOpen) {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "0";
      textEl.style.filter = "blur(12px)";
      textEl.style.pointerEvents = "none";
    } else if (progress > 0.65) {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "1";
      textEl.style.filter = "blur(0px)";
      textEl.style.pointerEvents = "auto";
      setTimeout(() => { if (textEl) textEl.style.transition = ""; }, 450);
    }
  }, [contactVisible, isMenuOpen, progress]);

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
    fontWeight: "normal",
    textTransform: "uppercase",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "9px",
    letterSpacing: "0.2em",
    color: "#000",
    textTransform: "uppercase",
    fontFamily: "'Arial Black', Gadget, sans-serif",
    fontWeight: "normal",
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
          font-weight: normal !important;
          font-stretch: normal !important;
          font-style: normal !important;
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
          display: block;
          will-change: opacity, filter;
          transform: translateZ(0);
        }

        .text-line {
          letter-spacing: -0.02em;
          line-height: 1.0;
          color: white;
        }
        
        .desktop-br { display: inline; }
        .mobile-br { display: none; }

        /* --- CSS АНИМАЦИЯ ПЛАВАНИЯ ДЛЯ МЕНЮ --- */
        @keyframes floatMenu {
          0% { transform: translate(0px, 0px) rotate(0deg); }
          25% { transform: translate(15px, -15px) rotate(3deg); }
          50% { transform: translate(-10px, 20px) rotate(-5deg); }
          75% { transform: translate(20px, 10px) rotate(4deg); }
          100% { transform: translate(0px, 0px) rotate(0deg); }
        }

        .floating-menu-container {
          animation: floatMenu 8s ease-in-out infinite;
        }

        .menu-option-text {
          cursor: pointer;
          transition: opacity 0.2s ease, fill 0.2s ease;
        }
        .menu-option-text:hover {
          fill: #ff3b30 !important; /* Подсветка опций красным при наведении */
        }

        @media (max-width: 768px) {
          .desktop-br { display: none; }
          .mobile-br { display: block; }
          
          .text-line {
            font-size: 6.5vw !important; 
          }
          .contact-trigger {
            font-size: 6.5vw !important;
            margin-top: 1.6em !important;
          }
        }
      `}</style>

      {/* Маска */}
      <video
        ref={maskVideoRef}
        src="/mask.mp4"
        muted
        autoPlay
        loop={false}
        playsInline
        preload="auto"
        className="mask-video-element"
        style={{
          opacity: maskOpacity,
          filter: `blur(${maskBlur}px)`
        }}
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
              <div style={{ fontSize: "clamp(18px, 3.2vw, 28px)", letterSpacing: "-0.01em", lineHeight: 1, color: "#000" }}>
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
            willChange: "opacity, filter"
          }}
        />
        {/* Интерактивный слой затемнения поверх видео */}
        <div ref={videoOverlayRef} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1, pointerEvents: "none", transition: "background 0.1s ease-out" }} />

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
            transform: "translate3d(0, 30px, 0)",
            willChange: "transform, opacity",
            pointerEvents: "none"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", justifyTemplate: "flex-start", width: "100%" }}>
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

        {/* --- ПЛАВАЮЩЕЕ КРАСНОЕ КОЛЬЦО-МЕНЮ --- */}
        <div
          style={{
            position: "fixed",
            // Если меню закрыто — оно аккуратно сидит в верхнем правом углу, если открыто — занимает весь экран по центру
            top: isMenuOpen ? 0 : "40px",
            right: isMenuOpen ? 0 : "40px",
            width: isMenuOpen ? "100vw" : "70px",
            height: isMenuOpen ? "100vh" : "70px",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "width 0.6s cubic-bezier(0.85, 0, 0.15, 1), height 0.6s cubic-bezier(0.85, 0, 0.15, 1), top 0.6s cubic-bezier(0.85, 0, 0.15, 1), right 0.6s cubic-bezier(0.85, 0, 0.15, 1)",
          }}
          className={isMenuOpen ? "" : "floating-menu-container"}
        >
          {/* Фон-затемнение под развернутым меню */}
          <div
            onClick={() => setIsMenuOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(10px)",
              opacity: isMenuOpen ? 1 : 0,
              pointerEvents: isMenuOpen ? "auto" : "none",
              transition: "opacity 0.6s ease"
            }}
          />

          <svg
            viewBox="0 0 1000 1000"
            onClick={() => !isMenuOpen && setIsMenuOpen(true)}
            style={{
              width: isMenuOpen ? "min(85vw, 85vh)" : "100%",
              height: isMenuOpen ? "min(85vw, 85vh)" : "100%",
              transform: isMenuOpen ? "rotate(0deg)" : "rotate(0deg)",
              transition: "width 0.6s cubic-bezier(0.85, 0, 0.15, 1), height 0.6s cubic-bezier(0.85, 0, 0.15, 1)",
              cursor: "pointer",
              position: "relative",
              zIndex: 2
            }}
          >
            <defs>
              {/* Невидимый путь-окружность, по которому пойдет скругленный текст */}
              {/* Смещаем начальную точку, чтобы текст распределялся эстетично */}
              <path
                id="textCirclePath"
                d="M 500,500 m -360,0 a 360,360 0 1,1 720,0 a 360,360 0 1,1 -720,0"
              />
            </defs>

            {/* Само кольцо */}
            <circle
              cx="500"
              cy="500"
              r={isMenuOpen ? "360" : "400"} // Слегка меняем радиус при раскрытии для динамики
              fill="none"
              stroke="#ff3b30" // Насыщенный красный
              strokeWidth={isMenuOpen ? "25" : "120"} // В свернутом состоянии выглядит как заполненный круг/толстое кольцо
              style={{
                transition: "stroke-width 0.6s cubic-bezier(0.85, 0, 0.15, 1), r 0.6s cubic-bezier(0.85, 0, 0.15, 1)"
              }}
            />

            {/* Крестик закрытия по центру кольца */}
            {isMenuOpen && (
              <g
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }}
                style={{ cursor: "pointer" }}
              >
                {/* Прозрачная увеличенная зона клика для крестика */}
                <circle cx="500" cy="500" r="60" fill="transparent" />
                <line x1="460" y1="460" x2="540" y2="540" stroke="white" strokeWidth="12" strokeLinecap="round" />
                <line x1="540" y1="460" x2="460" y2="540" stroke="white" strokeWidth="12" strokeLinecap="round" />
              </g>
            )}

            {/* Текст меню вдоль кольца */}
            <text
              fill="white"
              style={{
                fontFamily: "'Arial Black', Gadget, sans-serif",
                fontSize: "52px",
                letterSpacing: "4px",
                opacity: isMenuOpen ? 1 : 0,
                pointerEvents: isMenuOpen ? "auto" : "none",
                transition: "opacity 0.4s ease 0.2s", // Появляется с небольшой задержкой после раскрытия
              }}
            >
              {/* startOffset распределяет ссылки по периметру круга в % */}
              <textPath href="#textCirclePath" startOffset="8%" className="menu-option-text" onClick={(e) => { e.stopPropagation(); handleMenuOptionClick("ABOUT"); }}>
                ABOUT
              </textPath>
              <textPath href="#textCirclePath" startOffset="40%" className="menu-option-text" onClick={(e) => { e.stopPropagation(); handleMenuOptionClick("PORTFOLIO"); }}>
                PORTFOLIO
              </textPath>
              <textPath href="#textCirclePath" startOffset="75%" className="menu-option-text" onClick={(e) => { e.stopPropagation(); handleMenuOptionClick("CONTACT"); }}>
                CONTACT
              </textPath>
            </text>
          </svg>
        </div>

      </main>
    </>
  );
}