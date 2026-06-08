"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";

/**
 * КОНСТАНТЫ ДАННЫХ И КОНФИГУРАЦИИ
 * Мы выносим данные вовне компонента, чтобы структура была максимально
 * прозрачной и не перегружала тело функции.
 */

const ROW_DATA_0 = ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg", "/8.jpg", "/9.jpg", "/10.jpg"];
const ROW_DATA_1 = ["/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg", "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg"];
const ROW_DATA_2 = ["/10.jpg", "/9.jpg", "/8.jpg", "/7.jpg", "/6.jpg", "/5.jpg", "/4.jpg", "/3.jpg", "/2.jpg", "/1.jpg"];
const ROW_DATA_3 = ["/20.jpg", "/19.jpg", "/18.jpg", "/17.jpg", "/16.jpg", "/15.jpg", "/14.jpg", "/13.jpg", "/12.jpg", "/11.jpg"];
const ROW_DATA_4 = ["/5.jpg", "/15.jpg", "/2.jpg", "/12.jpg", "/8.jpg", "/18.jpg", "/4.jpg", "/14.jpg", "/9.jpg", "/19.jpg"];

const GRID_GAP = 20;

/**
 * ОСНОВНОЙ КОМПОНЕНТ САЙТА
 * Реализует сложную логику скролл-анимаций, работу с видео,
 * отправку форм и управление состоянием интерфейса.
 */
export default function Home() {

  // --- СОСТОЯНИЯ ---

  // Прогресс скролла от 0 до 1
  const [progress, setProgress] = useState<number>(0);

  // Источник видео (изменяется в зависимости от устройства)
  const [videoSrc, setVideoSrc] = useState<string>("/me.mp4");

  // Динамический размер плиток сетки
  const [imgSize, setImgSize] = useState<number>(140);

  // Состояние текста на розовом фоне
  const [statusText, setStatusText] = useState<string>("ERROR 404: LOADING FAILED");

  // Состояния для модального окна контактов
  const [contactHovered, setContactHovered] = useState<boolean>(false);
  const [shaking, setShaking] = useState<boolean>(false);
  const [showContact, setShowContact] = useState<boolean>(false);
  const [contactVisible, setContactVisible] = useState<boolean>(false);

  // Состояние данных формы
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
    service: "ILLUSTRATION"
  });

  // Состояние отправки
  const [isSending, setIsSending] = useState<boolean>(false);

  // --- РЕФЕРЕНСЫ (ссылки на элементы) ---

  const mainRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoOverlayRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeTextRef = useRef<HTMLDivElement>(null);

  // Рефы для математики скролла
  const touchStartRef = useRef<number>(0);
  const currentProgressRef = useRef<number>(0);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);

  // Группировка рядов для удобного маппинга
  const rows = [ROW_DATA_0, ROW_DATA_1, ROW_DATA_2, ROW_DATA_3, ROW_DATA_4];

  // --- ЭФФЕКТЫ И ЛОГИКА ---

  /**
   * Эффект: Установка текста ошибки и приветствия
   */
  useEffect(() => {
    const errorTimer = setTimeout(() => {
      setStatusText("WELCOME");
    }, 1000);

    return () => {
      clearTimeout(errorTimer);
    };
  }, []);

  /**
   * Эффект: Детекция iPhone для смены видео
   */
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isiPhone = /iPhone|iPad|iPod/i.test(userAgent);

    if (isiPhone) {
      setVideoSrc("/iome.mp4");
    }
  }, []);

  /**
   * Эффект: Обеспечение автовоспроизведения видео
   */
  useEffect(() => {
    const videoElement = videoRef.current;

    if (videoElement) {
      videoElement.load();
      const handleCanPlay = () => {
        videoElement.play().catch((err) => {
          console.warn("Autoplay was prevented:", err);
        });
      };
      videoElement.addEventListener('canplay', handleCanPlay);
      return () => {
        videoElement.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [videoSrc]);

  /**
   * Эффект: Расчет размеров элементов сетки при ресайзе окна
   */
  useEffect(() => {
    const calculateSize = () => {
      const windowHeight = window.innerHeight;
      const computedSize = Math.floor((windowHeight - GRID_GAP * 6) / 5);
      setImgSize(computedSize);
    };

    calculateSize();
    window.addEventListener("resize", calculateSize);
    return () => {
      window.removeEventListener("resize", calculateSize);
    };
  }, []);

  /**
   * Эффект: Логика скролла (колесо мыши и тач-события)
   */
  useEffect(() => {
    // Обработка колесика мыши
    const handleWheel = (e: WheelEvent) => {
      if (showContact) return;
      e.preventDefault();

      const scrollSpeed = 0.0015;
      let nextProgress = currentProgressRef.current + e.deltaY * scrollSpeed;

      // Ограничиваем прогресс от 0 до 1
      nextProgress = Math.min(Math.max(nextProgress, 0), 1);

      currentProgressRef.current = nextProgress;
      setProgress(nextProgress);
    };

    // Начало касания
    const handleTouchStart = (e: TouchEvent) => {
      if (showContact) return;
      touchStartRef.current = e.touches[0].clientY;

      // Попытка запустить видео при первом касании
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch((err) => console.log(err));
      }
    };

    // Движение пальцем
    const handleTouchMove = (e: TouchEvent) => {
      if (showContact) return;
      e.preventDefault();

      const currentY = e.touches[0].clientY;
      const deltaY = touchStartRef.current - currentY;
      touchStartRef.current = currentY;

      const touchSpeed = 0.002;
      let nextProgress = currentProgressRef.current + deltaY * touchSpeed;

      nextProgress = Math.min(Math.max(nextProgress, 0), 1);
      currentProgressRef.current = nextProgress;
      setProgress(nextProgress);
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

  /**
   * Эффект: Анимационный движок (Таймлайн)
   */
  useEffect(() => {
    const p = progress; // Прогресс для удобства

    // 1. Анимация исчезновения текста WELCOME
    if (welcomeTextRef.current) {
      const welcomeLimit = 0.15;
      const welcomeProgress = Math.min(p / welcomeLimit, 1);
      welcomeTextRef.current.style.opacity = (1 - welcomeProgress).toString();
      welcomeTextRef.current.style.filter = `blur(${welcomeProgress * 20}px)`;
    }

    // 2. Анимация сетки (Схождение рядов "как пальцы")
    // Прогресс 0.05 - 0.55
    const gridLimitStart = 0.05;
    const gridLimitEnd = 0.55;
    const gridAssemblyProgress = Math.min(Math.max((p - gridLimitStart) / (gridLimitEnd - gridLimitStart), 0), 1);

    trackRefs.current.forEach((track, i) => {
      if (!track) return;

      // Четные ряды (0, 2, 4) начинают слева, нечетные (1, 3) справа
      const isEven = i % 2 === 0;
      const direction = isEven ? -1 : 1;

      // Считаем смещение: от 50% экрана до 0%
      const offset = (1 - gridAssemblyProgress) * 50 * direction;

      track.style.transform = `translateX(${offset}%)`;
    });

    // 3. Анимация исчезновения сетки (затемнение и размытие)
    if (gridRef.current) {
      if (p > 0.6) {
        gridRef.current.style.opacity = "0";
        gridRef.current.style.filter = "blur(30px)";
      } else {
        const gridFadeStart = 0.4;
        const gridFadeEnd = 0.6;
        const gridFade = Math.max(0, (p - gridFadeStart) / (gridFadeEnd - gridFadeStart));
        gridRef.current.style.opacity = (1 - gridFade).toString();
        gridRef.current.style.filter = `blur(${gridFade * 30}px)`;
      }
    }

    // 4. Появление видео на фоне
    if (videoRef.current) {
      const videoStart = 0.3;
      const videoDuration = 0.25;
      const vidOpacity = Math.min(Math.max((p - videoStart) / videoDuration, 0), 1);
      videoRef.current.style.opacity = vidOpacity.toString();
    }

    // 5. Появление и выезд текстового блока
    if (textRef.current) {
      const textStart = 0.7;
      if (p > textStart) {
        const textProgress = Math.min((p - textStart) / 0.3, 1);
        textRef.current.style.opacity = textProgress.toString();
        textRef.current.style.transform = `translate3d(0, ${(1 - textProgress) * 150}px, 0)`;
        textRef.current.style.pointerEvents = "auto";
      } else {
        textRef.current.style.opacity = "0";
        textRef.current.style.transform = "translate3d(0, 150px, 0)";
        textRef.current.style.pointerEvents = "none";
      }
    }
  }, [progress]);

  /**
   * Эффект: Анимация при переключении видимости модального окна
   */
  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;

    if (contactVisible) {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "0";
      textEl.style.filter = "blur(12px)";
    } else if (progress > 0.7) {
      textEl.style.transition = "opacity 0.4s ease, filter 0.4s ease";
      textEl.style.opacity = "1";
      textEl.style.filter = "blur(0px)";
    }
  }, [contactVisible, progress]);

  // --- ХЭНДЛЕРЫ ---

  const openContact = () => {
    setShowContact(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setContactVisible(true);
      });
    });
  };

  const closeContact = () => {
    setContactVisible(false);
    setTimeout(() => {
      setShowContact(false);
    }, 500);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm({ ...form, message: e.target.value.toUpperCase() });

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      alert("PLEASE FILL IN ALL FIELDS");
      return;
    }

    setIsSending(true);

    try {
      // Имитация API запроса
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
      console.error("Submission failed:", error);
      alert(`FETCH_FAILED: ${error?.message || 'SERVER_UNREACHABLE'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleContactEnter = () => {
    if (shaking) return;
    setShaking(true);
    setTimeout(() => {
      setShaking(false);
      setContactHovered(true);
    }, 400);
  };

  // --- СТИЛИ ---

  const inputStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    borderBottom: "1.5px solid #000",
    color: "#000",
    fontSize: "clamp(13px, 1.5vw, 16px)",
    padding: "6px 0",
    outline: "none",
    width: "100%",
    marginTop: "8px"
  };

  // --- JSX РЕНДЕР ---

  return (
    <>
      {/* Глобальные стили для всей страницы */}
      <style>{`
        html, body { 
          margin: 0; padding: 0; 
          width: 100vw; height: 100vh; 
          overflow: hidden; 
          background: #ffbbc6; 
          font-family: 'Arial Black', Arial, sans-serif !important;
        }
        * { box-sizing: border-box; text-transform: uppercase !important; }
        
        .pink-overlay {
          position: fixed;
          inset: 0;
          z-index: 0;
          background: #ffbbc6;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .welcome-text {
          font-size: 5vw;
          color: #000;
          font-weight: 900;
          will-change: opacity, filter;
        }

        .main-container {
          position: fixed;
          width: 100vw; height: 100vh;
          top: 0; left: 0;
          z-index: 1;
        }

        .masked-grid {
          display: flex;
          flex-direction: column;
          gap: ${GRID_GAP}px;
          will-change: transform, opacity;
        }

        .row-track {
          display: flex;
          gap: ${GRID_GAP}px;
          width: max-content;
          will-change: transform;
        }

        @keyframes shakeY {
          0% { transform: translateY(0); }
          15% { transform: translateY(-8px); }
          30% { transform: translateY(8px); }
          45% { transform: translateY(-6px); }
          60% { transform: translateY(6px); }
          75% { transform: translateY(-3px); }
          90% { transform: translateY(3px); }
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
        
        .text-line { 
          font-weight: 900 !important; 
          letter-spacing: -0.03em; 
          line-height: 0.92; 
          color: white; 
        }
        
        @media (max-width: 768px) {
          .text-line { font-size: 8.5vw !important; -webkit-text-stroke: 1.2px white; }
        }
      `}</style>

      {/* 1. РОЗОВЫЙ СЛОЙ (Статичный) */}
      <div className="pink-overlay">
        <div ref={welcomeTextRef} className="welcome-text">
          {statusText}
        </div>
      </div>

      {/* 2. КОНТЕНТНЫЙ СЛОЙ */}
      <main className="main-container">

        {/* Видео подложка */}
        <video
          ref={videoRef}
          src={videoSrc}
          muted loop autoPlay playsInline
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", zIndex: 0,
            opacity: 0, pointerEvents: "none"
          }}
        />

        {/* Сетка картинок */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center",
          zIndex: 2, overflow: "hidden"
        }}>
          <div ref={gridRef} className="masked-grid">
            {rows.map((images, rowIndex) => (
              <div
                key={rowIndex}
                ref={(el) => { trackRefs.current[rowIndex] = el; }}
                className="row-track"
                style={{
                  paddingLeft: `${GRID_GAP}px`,
                  paddingRight: `${GRID_GAP}px`
                }}
              >
                {[...images, ...images].map((img, i) => (
                  <div key={i} style={{
                    width: `${imgSize}px`,
                    height: `${imgSize}px`,
                    borderRadius: "12px",
                    flexShrink: 0,
                    overflow: "hidden"
                  }}>
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

        {/* Текстовый слой (Основной текст) */}
        <div
          ref={textRef}
          style={{
            position: "absolute", inset: 0,
            zIndex: 10, display: "flex", alignItems: "center",
            padding: "0 80px", opacity: 0,
            transform: "translate3d(0, 150px, 0)",
            pointerEvents: "none"
          }}
        >
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
                fontSize: "88px", marginTop: "1.6em",
                cursor: "pointer", display: "inline-block"
              }}
            >
              <span className="heartbeat-wrapper">
                {contactHovered ? "GET YOUR BEST DESIGN EVER" : "CONTACT ME"}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. МОДАЛЬНОЕ ОКНО КОНТАКТОВ */}
      {showContact && (
        <div
          onClick={(e) => e.target === e.currentTarget && !isSending && closeContact()}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.5)", display: "flex",
            alignItems: "center", justifyContent: "center"
          }}
        >
          <div style={{
            background: "#fff", color: "#000", width: "min(520px, 90vw)",
            aspectRatio: "1 / 1", padding: "clamp(24px, 5vw, 40px)",
            transform: contactVisible ? "translate3d(0, 0, 0)" : "translate3d(0, 60px, 0)",
            opacity: contactVisible ? 1 : 0,
            transition: "transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.5s ease",
            display: "flex", flexDirection: "column", justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
              <div style={{ fontSize: "28px", fontWeight: 900 }}>LET'S WORK</div>
              <button onClick={closeContact} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ fontSize: "9px" }}>YOUR NAME</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: "9px" }}>EMAIL</label>
                <input
                  type="email"
                  value={form.email}
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
                  ref={textareaRef}
                  value={form.message}
                  onChange={handleMessageChange}
                  style={{ ...inputStyle, resize: "none", minHeight: "50px" }}
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              style={{
                background: "#000", color: "#fff", border: "none",
                padding: "14px 32px", fontSize: "10px", fontWeight: 900,
                cursor: "pointer", alignSelf: "flex-start"
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