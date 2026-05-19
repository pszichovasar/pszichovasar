"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const scene1Ref = useRef(null);
  const videoRef = useRef(null);
  const maskVideoRef = useRef(null);
  const overlayRef = useRef(null);
  const [opacity, setOpacity] = useState(1);
  const [blur, setBlur] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [imgSize, setImgSize] = useState(140);
  const canvasRefs = useRef([]);
  const animFrameRef = useRef(null);
  const gridRef = useRef(null);
  const maskOpacityRef = useRef(0);
  const maskTriggeredRef = useRef(false);
  const maskPlayingRef = useRef(false);
  const textRef = useRef(null);
  const textareaRef = useRef(null);
  const [contactHovered, setContactHovered] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const row0 = ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg", "/8.jpg", "/9.jpg", "/10.jpg"];
  const row1 = ["/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg", "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg"];
  const row2 = ["/1.jpg", "/3.jpg", "/5.jpg", "/7.jpg", "/9.jpg", "/2.jpg", "/4.jpg", "/6.jpg", "/8.jpg", "/10.jpg"];
  const row3 = ["/11.jpg", "/13.jpg", "/15.jpg", "/17.jpg", "/19.jpg", "/12.jpg", "/14.jpg", "/16.jpg", "/18.jpg", "/20.jpg"];
  const row4 = ["/2.jpg", "/4.jpg", "/6.jpg", "/8.jpg", "/10.jpg", "/1.jpg", "/3.jpg", "/5.jpg", "/7.jpg", "/9.jpg"];

  const rows = [row0, row1, row2, row3, row4];
  const directions = [true, false, true, false, true];
  const trackRefs = useRef([null, null, null, null, null]);
  const GAP = 20;

  const openContact = () => {
    setShowContact(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setContactVisible(true)));
  };

  const closeContact = () => {
    setContactVisible(false);
    setTimeout(() => setShowContact(false), 500);
  };

  // Авто-высота textarea
  const handleMessageChange = (e) => {
    setForm({ ...form, message: e.target.value });
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    }
  };

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

    const draw = () => {
      const grid = gridRef.current;
      if (!grid || !video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      const currentMaskOpacity = maskOpacityRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const scaleX = screenW / vw;
      const scaleY = screenH / vh;
      const scale = Math.max(scaleX, scaleY);
      const scaledW = vw * scale;
      const scaledH = vh * scale;
      const screenOffsetX = (scaledW - screenW) / 2;
      const screenOffsetY = (scaledH - screenH) / 2;

      canvasRefs.current.forEach((canvas) => {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        const srcX = (rect.left + screenOffsetX) / scale;
        const srcY = (rect.top + screenOffsetY) / scale;
        const srcW = rect.width / scale;
        const srcH = rect.height / scale;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (currentMaskOpacity > 0) {
          ctx.globalAlpha = currentMaskOpacity;
          ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
        }
      });

      animFrameRef.current = requestAnimationFrame(draw);
    };

    const handleTimeUpdate = () => {
      if (!video.duration) return;
      const timeLeft = video.duration - video.currentTime;
      if (timeLeft <= 1.5 && maskPlayingRef.current) {
        maskPlayingRef.current = false;
        const fadeOut = () => {
          if (maskOpacityRef.current <= 0) { maskOpacityRef.current = 0; return; }
          maskOpacityRef.current = Math.max(0, maskOpacityRef.current - 0.02);
          requestAnimationFrame(fadeOut);
        };
        fadeOut();
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [imgSize]);

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
      video.style.opacity = meOpacity;

      if (maskVideo && !maskTriggeredRef.current && progress >= TRIGGER_PROGRESS) {
        maskTriggeredRef.current = true;
        maskPlayingRef.current = true;
        maskVideo.currentTime = 0;
        maskVideo.play();
        const fadeIn = () => {
          if (maskOpacityRef.current >= 1) { maskOpacityRef.current = 1; return; }
          maskOpacityRef.current = Math.min(1, maskOpacityRef.current + 0.03);
          requestAnimationFrame(fadeIn);
        };
        fadeIn();
      }

      const scene1End = scene1.offsetTop + scene1.offsetHeight - window.innerHeight;

      if (textEl) {
        if (scrollY < scene1End) {
          textEl.style.transform = "translateY(200vh)";
          textEl.style.opacity = "0";
          textEl.style.filter = "blur(0px)";
        } else {
          const scene2ScrollY = scrollY - scene1End;
          const textProgress = Math.min(scene2ScrollY / (window.innerHeight * 3.5), 1);
          const translateY = Math.max(0, (1 - textProgress) * 200);
          const textOpacity = Math.min(textProgress * 2, 1);
          textEl.style.transform = `translateY(${translateY}vh)`;
          textEl.style.opacity = textOpacity;
          textEl.style.filter = "blur(0px)";
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Блюр текста когда открыта карточка
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
      // Убираем transition после завершения чтобы не мешал scroll-анимации
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

  let canvasIndex = 0;

  const inputStyle = {
    background: "transparent",
    border: "none",
    borderBottom: "1.5px solid #000",
    color: "#000",
    fontSize: "clamp(14px, 1.8vw, 17px)",
    padding: "10px 0",
    outline: "none",
    fontFamily: "'Arial Black', Arial, sans-serif",
    width: "100%",
  };

  const labelStyle = {
    fontSize: "10px",
    letterSpacing: "0.2em",
    color: "#000",
    textTransform: "uppercase",
    fontFamily: "'Arial Black', Arial, sans-serif",
  };

  return (
    <>
      <style>{`
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
      `}</style>

      <video ref={maskVideoRef} src="/mask.mp4" muted playsInline preload="auto" style={{ display: "none" }} />

      {/* Contact modal — центр экрана, квадрат */}
      {showContact && (
        <div
          onClick={(e) => e.target === e.currentTarget && closeContact()}
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
            fontFamily: "'Arial Black', Arial, sans-serif",
            transform: contactVisible ? "translateY(0)" : "translateY(60px)",
            opacity: contactVisible ? 1 : 0,
            transition: "transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.5s ease",
            // Высота адаптируется через padding + auto
            boxSizing: "border-box",
          }}>

            {/* Шапка */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px" }}>
              <div style={{
                fontSize: "clamp(20px, 3.5vw, 32px)",
                fontWeight: 900, letterSpacing: "-0.01em",
                lineHeight: 1, textTransform: "uppercase", color: "#000",
              }}>
                LET'S WORK
              </div>
              <button
                onClick={closeContact}
                style={{
                  background: "none", border: "none", color: "#000",
                  fontSize: "26px", cursor: "pointer", lineHeight: 1,
                  padding: 0, fontFamily: "inherit", marginTop: "-2px",
                }}
              >×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              {[
                { label: "YOUR NAME", key: "name", type: "text" },
                { label: "EMAIL", key: "email", type: "email" },
              ].map(({ label, key, type }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              ))}

              {/* Message — растёт по контенту */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={labelStyle}>MESSAGE</label>
                <textarea
                  ref={textareaRef}
                  value={form.message}
                  onChange={handleMessageChange}
                  rows={1}
                  style={{
                    ...inputStyle,
                    resize: "none",
                    overflow: "hidden",
                    lineHeight: "1.5",
                    transition: "height 0.25s ease",
                    display: "block",
                    verticalAlign: "bottom",
                  }}
                />
              </div>

              <button
                onClick={closeContact}
                style={{
                  marginTop: "12px",
                  background: "#000", color: "#fff",
                  border: "none", padding: "16px 36px",
                  fontSize: "11px", letterSpacing: "0.2em",
                  fontFamily: "'Arial Black', Arial, sans-serif",
                  fontWeight: 900, cursor: "pointer",
                  alignSelf: "flex-start", textTransform: "uppercase",
                }}
              >SEND</button>
            </div>
          </div>
        </div>
      )}

      {playCount < 3 && (
        <video
          ref={overlayRef} src="/overlay.webm" autoPlay muted playsInline
          style={{
            position: "fixed", top: 0, left: 0,
            width: "100vw", height: "100vh",
            objectFit: "contain", zIndex: 9999,
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
        />
      )}

      <main style={{ background: "black", color: "white" }}>

        {/* SCENE 1 */}
        <section ref={scene1Ref} style={{ height: "250vh", position: "relative", zIndex: 2 }}>
          <video
            ref={videoRef} src="/me.mp4" muted loop autoPlay playsInline
            style={{
              position: "fixed", top: 0, left: 0,
              width: "100vw", height: "100vh",
              objectFit: "cover", zIndex: 0,
              opacity: 0, transition: "opacity 0.3s ease",
            }}
          />
          <div style={{
            position: "fixed", top: 0, left: 0,
            width: "100vw", height: "100vh",
            background: "rgba(0,0,0,0.3)",
            zIndex: 1, pointerEvents: "none",
          }} />

          <div style={{
            position: "sticky", top: 0, height: "100vh",
            overflow: "hidden", display: "flex",
            alignItems: "center", zIndex: 2,
          }}>
            <div ref={gridRef} style={{
              display: "flex", flexDirection: "column",
              gap: `${GAP}px`, paddingTop: `${GAP}px`,
              paddingBottom: `${GAP}px`, position: "relative",
            }}>
              {rows.map((images, rowIndex) => {
                const looped = [...images, ...images];
                return (
                  <div
                    key={rowIndex}
                    ref={(el) => (trackRefs.current[rowIndex] = el)}
                    style={{
                      display: "flex", gap: `${GAP}px`,
                      width: "max-content",
                      paddingLeft: `${GAP}px`, paddingRight: `${GAP}px`,
                    }}
                  >
                    {looped.map((img, i) => {
                      const idx = canvasIndex++;
                      return (
                        <div key={rowIndex + "-" + i} style={{
                          width: `${imgSize}px`, height: `${imgSize}px`,
                          borderRadius: "12px", flexShrink: 0,
                          position: "relative", overflow: "hidden",
                        }}>
                          <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          <canvas
                            ref={(el) => (canvasRefs.current[idx] = el)}
                            width={imgSize} height={imgSize}
                            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SCENE 2 — текст */}
        <section style={{ height: "600vh", position: "relative", zIndex: 3, background: "transparent" }}>
          <div
            ref={textRef}
            style={{
              position: "sticky", top: 0, height: "100vh",
              display: "flex", flexDirection: "column",
              justifyContent: "center",
              padding: "0 clamp(24px, 6vw, 80px)",
              transform: "translateY(200vh)",
              opacity: 0,
              willChange: "transform, opacity",
            }}
          >
            <div style={{
              fontFamily: "'Arial Black', Arial, sans-serif",
              fontSize: "clamp(32px, 6.5vw, 88px)",
              fontWeight: 900, letterSpacing: "-0.01em",
              lineHeight: 1.0, color: "white", textTransform: "uppercase",
            }}>MY NAME IS ARTEM</div>

            <div style={{
              fontFamily: "'Arial Black', Arial, sans-serif",
              fontSize: "clamp(32px, 6.5vw, 88px)",
              fontWeight: 900, letterSpacing: "-0.01em",
              lineHeight: 1.0, color: "white", textTransform: "uppercase",
              marginTop: "0.05em",
            }}>I'M AN ILLUSTRATOR</div>

            <div
              className={shaking ? "shakeY" : ""}
              onMouseEnter={handleContactEnter}
              onMouseLeave={() => setContactHovered(false)}
              onClick={openContact}
              style={{
                fontFamily: "'Arial Black', Arial, sans-serif",
                fontSize: "clamp(32px, 6.5vw, 88px)",
                fontWeight: 900, letterSpacing: "-0.01em",
                lineHeight: 1.0, color: "white", textTransform: "uppercase",
                marginTop: "2em", cursor: "pointer",
                display: "inline-block", userSelect: "none",
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