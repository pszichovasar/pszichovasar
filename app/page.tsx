"use client";

import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const [progress, setProgress] = useState(0);
  const [videoSrc, setVideoSrc] = useState("/me.mp4");
  const [imgSize, setImgSize] = useState(140);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoOverlayRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
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
      ta.style.height = "auto"; // Сбрасываем высоту
      ta.style.height = ta.scrollHeight + "px"; // Подстраиваем под текст
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

  // Проверка на iOS устройства + установка правильного видео iome.mp4
  useEffect(() => {
    const isiPhone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isiPhone) {
      setVideoSrc("/iome.mp4");
    }
  }, []);

  // Жесткий запуск видео в Safari
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

  // Расчет размеров плиток
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

  // Виртуальный скролл
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (showContact) return;
      e.preventDefault();

      const speed = 0.0015;
      let next = currentProgressRef.current + e.deltaY * speed;

      next = Math.min(Math.max(next, 0), 1);
      currentProgressRef.current = next;
      setProgress(next);
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
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;

    // 1. ЛОГИКА СЕТКИ
    // Сетка работает от 0.0 до 0.7. После 0.7 она полностью уходит.
    const gridActiveStart = 0;
    const gridActiveEnd = 0.7;
    const gridProgress = Math.min(Math.max((progress - gridActiveStart) / (gridActiveEnd - gridActiveStart), 0), 1);

    trackRefs.current.forEach((track, i) => {
      if (!track || !rows[i]) return;
      const loopWidth = (imgSize + GAP) * rows[i].length;

      // РАВНОМЕРНОЕ ДВИЖЕНИЕ:
      // Базовая скорость теперь строго линейна относительно gridProgress
      const scrollSpeed = 0.5;
      const baseScroll = directions[i]
        ? -gridProgress * loopWidth * scrollSpeed
        : -loopWidth + (gridProgress * loopWidth * scrollSpeed);

      // ВХОД И ВЫХОД:
      // Сетка начинает движение из-за экрана (вход) и уходит за экран (выход)
      // Используем smoothstep-подобную логику для мягкости
      let entranceOffset = 0;
      const margin = screenWidth * 1.2;

      if (gridProgress < 0.2) {
        // Плавный вход
        const entry = 1 - (gridProgress / 0.2);
        entranceOffset = directions[i] ? entry * margin : -entry * margin;
      } else if (gridProgress > 0.8) {
        // Плавный выход
        const exit = (gridProgress - 0.8) / 0.2;
        entranceOffset = directions[i] ? -exit * margin : exit * margin;
      }

      track.style.transform = `translate3d(${baseScroll + entranceOffset}px, 0, 0)`;
      track.style.transition = "none"; // Убираем transition для мгновенного отклика
    });

    // 2. Видео и Текст (активируются только ПОСЛЕ сетки, т.е. после 0.7)
    const finalSectionProgress = Math.min(Math.max((progress - 0.7) / 0.3, 0), 1);

    if (videoRef.current) {
      videoRef.current.style.opacity = finalSectionProgress.toString();
    }

    if (textRef.current) {
      textRef.current.style.opacity = finalSectionProgress.toString();
      // Текст плавно поднимается вверх
      textRef.current.style.transform = `translate3d(0, ${(1 - finalSectionProgress) * 50}px, 0)`;
      textRef.current.style.pointerEvents = finalSectionProgress > 0.5 ? "auto" : "none";
    }
  }, [progress, imgSize]);

  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;
    if (contactVisible) {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "0";
      textEl.style.filter = "blur(12px)";
    } else if (progress > 0.85) { // Обновили триггер здесь
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
          transform-origin: center center; /* Фиксирует точку отсчета в центре текста */
          animation: heartbeat 2s ease-in-out infinite;
        }
        input::placeholder, textarea::placeholder { color: rgba(0,0,0,0.2); }
        
        .heartbeat-wrapper {
          display: inline-block;
          transform-origin: center center; /* Указываем, что точка пульсации — центр */
          animation: heartbeat 2s ease-in-out infinite;
        }
        .masked-grid {
          display: flex;
          flex-direction: column;
          position: relative;
          transition: transform 0.1s ease-out;
        }

        /* Текстовые линии главного экрана на Компьютере (чистый Arial Black без обводки) */
        .text-line {
          font-family: 'Arial Black', Arial, sans-serif !important;
          font-weight: 900 !important;
          letter-spacing: -0.03em;
          line-height: 0.92;
          color: white;
        }
        
        .desktop-br { display: inline; }
        .mobile-br { display: none; }

        /* Элементы выплывающей карточки на Компьютере (чистые) */
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

        /* Адаптив под мобильные устройства (iPhone) — хак с обводкой остается только тут */
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

          /* Карточка на мобилке: делаем шрифт жирнее через stroke */
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

      {/* МОДАЛЬНОЕ ОКНО КОНТАКТОВ */}
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
                    resize: "none",        // Запрещает пользователю менять размер мышкой
                    overflow: "hidden",    // Полностью скрывает скролл-бар
                    lineHeight: "1.4",
                    transition: "height 0.25s ease",
                    display: "block",
                    minHeight: "24px"      // Задает минимальную высоту, чтобы поле не схлопывалось
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

      {/* ОСНОВНОЙ ФИКСИРОВАННЫЙ КОНТЕЙНЕР */}
      <main style={{ position: "fixed", width: "100vw", height: "100vh", top: 0, left: 0, overflow: "hidden", background: "black" }}>
        {/* 1. РОЗОВАЯ СЕКЦИЯ */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "#ffc0cb", // Розовый цвет
          zIndex: 20, // Поверх всего
          transform: `translate3d(0, ${progress < 0.33 ? -progress * 300 : -100}vh, 0)`,
          transition: "transform 0.1s linear"
        }} />
        {/* Видео заднего плана */}
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
        <div ref={videoOverlayRef} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1, pointerEvents: "none", transition: "background 0.1s ease-out" }} />

        {/* Сетка картинок */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", zIndex: 2, overflow: "hidden" }}>
          <div ref={gridRef} className="masked-grid" style={{ gap: `${GAP}px`, willChange: "transform, opacity, filter" }}>
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

        {/* Текстовый слой */}
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