"use client";

import React, { useState, useRef, useEffect } from "react";

export default function Home() {
  const [gridProgress, setGridProgress] = useState(0);
  const gridSectionRef = useRef<HTMLElement>(null);
  // Состояния для формы
  const [contactHovered, setContactHovered] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "", service: "ILLUSTRATION" });
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const openContact = () => {
    setShowContact(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setContactVisible(true)));
  };

  const closeContact = () => {
    setContactVisible(false);
    setTimeout(() => setShowContact(false), 500);
  };

  // ОПРЕДЕЛЯЕМ МАССИВЫ КАРТИНОК (взято из вашего исходного кода)
  const row0 = ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg", "/8.jpg", "/9.jpg", "/10.jpg"];
  const row1 = ["/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg", "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg"];
  const rows = [row0, row1, [...row0].reverse(), [...row1].reverse(), row0];

  useEffect(() => {
    const handleScroll = () => {
      if (!gridSectionRef.current) return;
      const rect = gridSectionRef.current.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / window.innerHeight));
      setGridProgress(progress);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {showContact && (
        <div
          onClick={(e) => e.target === e.currentTarget && closeContact()}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: contactVisible ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)",
            transition: "background 0.5s ease",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <div style={{
            background: "#fff", color: "#000", width: "min(500px, 90vw)", padding: "40px",
            transform: contactVisible ? "translateY(0)" : "translateY(50px)",
            opacity: contactVisible ? 1 : 0, transition: "all 0.5s ease"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>LET'S WORK</h2>
              <button onClick={closeContact} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {[{ label: "YOUR NAME", key: "name", type: "text" }, { label: "EMAIL", key: "email", type: "email" }].map(({ label, key, type }) => (
                <div key={key}>
                  <label style={{ fontSize: "9px", display: "block", marginBottom: "5px" }}>{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value.toUpperCase() })}
                    style={{ width: "100%", padding: "8px 0", border: "none", borderBottom: "1.5px solid #000", outline: "none" }}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: "9px", display: "block", marginBottom: "5px" }}>SERVICE</label>
                <select
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  style={{ width: "100%", padding: "8px 0", border: "none", borderBottom: "1.5px solid #000", outline: "none", background: "none" }}
                >
                  <option>ILLUSTRATION</option>
                  <option>LOGO</option>
                  <option>MOTION</option>
                  <option>ANIMATION</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "9px", display: "block", marginBottom: "5px" }}>MESSAGE</label>
                <textarea
                  ref={textareaRef}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value.toUpperCase() })}
                  style={{ width: "100%", padding: "8px 0", border: "none", borderBottom: "1.5px solid #000", outline: "none", resize: "none" }}
                />
              </div>

              <button
                onClick={() => alert(`Отправка: ${form.name}, ${form.email}, ${form.service}`)}
                style={{ background: "#000", color: "#fff", border: "none", padding: "14px 32px", fontSize: "10px", marginTop: "10px", cursor: "pointer" }}
              >
                SEND
              </button>
            </div>
            <button onClick={() => alert("Отправка...")}>SEND</button>
          </div>
        </div>
      )}
      <style>{`
        html, body { margin: 0; padding: 0; width: 100%; background: black; color: white; font-family: 'Arial Black', Arial, sans-serif; text-transform: uppercase; }
        .section { width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
      `}</style>

      {/* Первая секция - Розовая */}
      <section className="section" style={{ background: "#ff00ff" }}>
        <h1 style={{ fontSize: "5vw" }}>WELCOME</h1>
      </section>

      {/* Вторая секция - Сетка */}
      <section ref={gridSectionRef} className="section" style={{ background: "black", flexDirection: "column", gap: "20px" }}>
        {rows.map((images, rowIndex) => {
          const isRightToLeft = rowIndex % 2 === 0;
          // Логика движения: при входе в секцию (progress 0) уводим за экран, при прокрутке (progress 1) ставим в центр
          const xOffset = isRightToLeft
            ? (1 - gridProgress) * 100
            : -(1 - gridProgress) * 100;

          return (
            <div
              key={rowIndex}
              style={{
                display: "flex",
                gap: "20px",
                transform: `translateX(${xOffset}%)`,
                transition: "transform 0.1s linear"
              }}
            >
              {images.map((img, i) => (
                <div key={i} style={{ width: "200px", height: "200px", flexShrink: 0, background: "#333", borderRadius: "12px" }}>
                  {/* <img src={img} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> */}
                </div>
              ))}
            </div>
          );
        })}
      </section>

      Теперь, когда у нас есть работающий скролл и ожившая сетка во второй секции, пора перейти к третьей секции — «I'm a designer» с видео на фоне.

      Сейчас эта секция пустая. Мы добавим туда видео и текстовый блок, который вы планировали.

      Что нужно сделать:
      Интегрировать видео: Оно должно быть зафиксировано или занимать фон всей секции.

      Добавить текст: Расположить его поверх видео.

      Логика появления: Сейчас сетка просто прокручивается. Обычно в таких проектах хочется, чтобы сетка "уходила", а видео "проявлялось".

      Вот обновленный код для третьей секции:

      TypeScript
      {/* Третья секция - Дизайнер */}
      <section className="section" style={{ background: "black" }}>
        {/* Видео на фоне */}
        <video
          src="/me.mp4" // Убедитесь, что путь к видео верный
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        />

        {/* Затемнение, чтобы текст читался лучше */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1 }} />

        {/* Текстовый контент */}
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "20px" }}>
          <h2 style={{ fontSize: "clamp(40px, 8vw, 120px)", margin: 0 }}>I'M A DESIGNER</h2>
          <p style={{ fontSize: "20px", marginTop: "20px" }}>ДОБРО ПОЖАЛОВАТЬ В МОЙ МИР</p>
        </div>
      </section>
    </>
  );
}