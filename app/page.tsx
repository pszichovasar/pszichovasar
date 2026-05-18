"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const scene1Ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const maskVideoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLVideoElement>(null);
  const [opacity, setOpacity] = useState(1);
  const [blur, setBlur] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [imgSize, setImgSize] = useState(140);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const maskOpacityRef = useRef(0);

  const row0 = ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg", "/8.jpg", "/9.jpg", "/10.jpg"];
  const row1 = ["/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg", "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg"];
  const row2 = ["/1.jpg", "/3.jpg", "/5.jpg", "/7.jpg", "/9.jpg", "/2.jpg", "/4.jpg", "/6.jpg", "/8.jpg", "/10.jpg"];
  const row3 = ["/11.jpg", "/13.jpg", "/15.jpg", "/17.jpg", "/19.jpg", "/12.jpg", "/14.jpg", "/16.jpg", "/18.jpg", "/20.jpg"];
  const row4 = ["/2.jpg", "/4.jpg", "/6.jpg", "/8.jpg", "/10.jpg", "/1.jpg", "/3.jpg", "/5.jpg", "/7.jpg", "/9.jpg"];

  const rows = [row0, row1, row2, row3, row4];
  const directions = [true, false, true, false, true];
  const trackRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const GAP = 20;

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

      const gridRect = grid.getBoundingClientRect();
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scaleX = gridRect.width / vw;
      const scaleY = gridRect.height / vh;
      const scale = Math.max(scaleX, scaleY);
      const scaledW = vw * scale;
      const scaledH = vh * scale;
      const offsetX = (scaledW - gridRect.width) / 2;
      const offsetY = (scaledH - gridRect.height) / 2;

      canvasRefs.current.forEach((canvas) => {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();

        const relX = rect.left - gridRect.left;
        const relY = rect.top - gridRect.top;
        const srcX = (relX + offsetX) / scale;
        const srcY = (relY + offsetY) / scale;
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

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [imgSize]);

  useEffect(() => {
    const handleScroll = () => {
      const scene = scene1Ref.current;
      const video = videoRef.current;
      const maskVideo = maskVideoRef.current;
      if (!scene || !video) return;

      const rect = scene.getBoundingClientRect();
      const progress = Math.min(Math.max(-rect.top / rect.height, 0), 1);

      // Двигаем ряды
      trackRefs.current.forEach((track, i) => {
        if (!track) return;
        const maxMove = track.scrollWidth / 2;
        if (directions[i]) {
          track.style.transform = `translateX(${-progress * maxMove}px)`;
        } else {
          track.style.transform = `translateX(${-maxMove + progress * maxMove}px)`;
        }
      });

      // Фоновое видео
      const fadeStart = 0.8;
      const fadeOpacity = Math.max((progress - fadeStart) / (1 - fadeStart), 0);
      video.style.opacity = String(fadeOpacity);

      const FADE_IN_START = 0.28;
      const FADE_IN_END = 0.40;
      const FADE_OUT_START = 0.52;
      const FADE_OUT_END = 0.64;

      let maskOpacity = 0;
      if (progress >= FADE_IN_START && progress < FADE_IN_END) {
        maskOpacity = (progress - FADE_IN_START) / (FADE_IN_END - FADE_IN_START);
      } else if (progress >= FADE_IN_END && progress <= FADE_OUT_START) {
        maskOpacity = 1;
      } else if (progress > FADE_OUT_START && progress <= FADE_OUT_END) {
        maskOpacity = 1 - (progress - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START);
      }

      maskOpacityRef.current = maskOpacity;

      if (maskVideo && maskVideo.duration) {
        const videoProgress = Math.min(
          Math.max((progress - FADE_IN_START) / (FADE_OUT_END - FADE_IN_START), 0),
          1
        );
        maskVideo.currentTime = videoProgress * maskVideo.duration;
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  let canvasIndex = 0;

  return (
    <>
      <video
        ref={maskVideoRef}
        src="/mask.mp4"
        muted
        playsInline
        preload="auto"
        style={{ display: "none" }}
      />

      {playCount < 3 && (
        <video
          ref={overlayRef}
          src="/overlay.webm"
          autoPlay
          muted
          playsInline
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            objectFit: "contain",
            zIndex: 9999,
            pointerEvents: "none",
            opacity: opacity,
            filter: `blur(${blur}px)`,
            transition: "opacity 0.1s linear, filter 0.1s linear",
          }}
          onTimeUpdate={() => {
            const v = overlayRef.current;
            if (!v) return;
            const timeLeft = v.duration - v.currentTime;
            if (timeLeft <= 1) {
              const t = timeLeft / 1;
              setOpacity(t);
              setBlur((1 - t) * 12);
            }
          }}
          onEnded={() => {
            setOpacity(0);
            setBlur(12);
          }}
        />
      )}

      <main style={{ background: "black", color: "white" }}>
        <section
          ref={scene1Ref}
          style={{
            height: "250vh",
            position: "relative",
            zIndex: 2,
            background: "transparent",
          }}
        >
          <video
            ref={videoRef}
            src="/me.mp4"
            muted
            loop
            autoPlay
            playsInline
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              objectFit: "cover",
              zIndex: 0,
              opacity: 0,
              transition: "opacity 0.3s ease",
            }}
          />

          <div
            style={{
              position: "sticky",
              top: 0,
              height: "100vh",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              zIndex: 2,
            }}
          >
            <div
              ref={gridRef}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: `${GAP}px`,
                paddingTop: `${GAP}px`,
                paddingBottom: `${GAP}px`,
                position: "relative",
              }}
            >
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
                      position: "relative",
                    }}
                  >
                    {looped.map((img, i) => {
                      const idx = canvasIndex++;
                      return (
                        <div
                          key={rowIndex + "-" + i}
                          style={{
                            width: `${imgSize}px`,
                            height: `${imgSize}px`,
                            borderRadius: "12px",
                            flexShrink: 0,
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <img
                            src={img}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                          <canvas
                            ref={(el) => { canvasRefs.current[idx] = el; }}
                            width={imgSize}
                            height={imgSize}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                            }}
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

        <section style={{ height: "100vh", background: "#111" }}>
          <h1 style={{ padding: 40 }}>End</h1>
        </section>
      </main>
    </>
  );
}