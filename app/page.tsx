"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const scene1Ref = useRef<HTMLElement | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const maskVideoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLVideoElement | null>(null);

  const [opacity, setOpacity] = useState<number>(1);
  const [blur, setBlur] = useState<number>(0);
  const [playCount] = useState<number>(0);
  const [imgSize, setImgSize] = useState<number>(140);

  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const animFrameRef = useRef<number | null>(null);
  const maskOpacityRef = useRef<number>(0);

  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);

  const GAP = 20;

  const rows = [
    ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg", "/8.jpg", "/9.jpg", "/10.jpg"],
    ["/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg", "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg"],
    ["/1.jpg", "/3.jpg", "/5.jpg", "/7.jpg", "/9.jpg", "/2.jpg", "/4.jpg", "/6.jpg", "/8.jpg", "/10.jpg"],
    ["/11.jpg", "/13.jpg", "/15.jpg", "/17.jpg", "/19.jpg", "/12.jpg", "/14.jpg", "/16.jpg", "/18.jpg", "/20.jpg"],
    ["/2.jpg", "/4.jpg", "/6.jpg", "/8.jpg", "/10.jpg", "/1.jpg", "/3.jpg", "/5.jpg", "/7.jpg", "/9.jpg"],
  ];

  const directions = [true, false, true, false, true];

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

      // 🔥 FIX: video может быть null или не готов
      if (!grid || !video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctxList = canvasRefs.current;
      const gridRect = grid.getBoundingClientRect();

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const scale = Math.max(
        gridRect.width / vw,
        gridRect.height / vh
      );

      const offsetX = (vw * scale - gridRect.width) / 2;
      const offsetY = (vh * scale - gridRect.height) / 2;

      ctxList.forEach((canvas) => {
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

        const opacity = maskOpacityRef.current;

        if (opacity > 0) {
          ctx.globalAlpha = opacity;
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
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scene = scene1Ref.current;
      const video = videoRef.current;
      const maskVideo = maskVideoRef.current;

      if (!scene || !video) return;

      const rect = scene.getBoundingClientRect();
      const progress = Math.min(Math.max(-rect.top / rect.height, 0), 1);

      trackRefs.current.forEach((track, i) => {
        if (!track) return;

        const maxMove = track.scrollWidth / 2;

        track.style.transform = directions[i]
          ? `translateX(${-progress * maxMove}px)`
          : `translateX(${-maxMove + progress * maxMove}px)`;
      });

      video.style.opacity = String(Math.max((progress - 0.8) / 0.2, 0));

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
        const t = (progress - FADE_IN_START) / (FADE_OUT_END - FADE_IN_START);
        maskVideo.currentTime = Math.max(0, Math.min(1, t)) * maskVideo.duration;
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  let canvasIndex = 0;

  return (
    <>
      <video ref={maskVideoRef} src="/overlay.webm" muted playsInline preload="auto" style={{ display: "none" }} />

      {playCount < 3 && (
        <video
          ref={overlayRef}
          src="/overlay.webm"
          autoPlay
          muted
          playsInline
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            objectFit: "contain",
            zIndex: 9999,
            pointerEvents: "none",
            opacity,
            filter: `blur(${blur}px)`,
          }}
          onTimeUpdate={() => {
            const v = overlayRef.current;
            if (!v || !v.duration) return;

            const timeLeft = v.duration - v.currentTime;

            if (timeLeft <= 1) {
              const t = timeLeft;
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
        <section ref={scene1Ref} style={{ height: "250vh" }}>
          <video
            ref={videoRef}
            src="/me.mp4"
            muted
            loop
            autoPlay
            playsInline
            style={{
              position: "fixed",
              inset: 0,
              width: "100vw",
              height: "100vh",
              objectFit: "cover",
              zIndex: 0,
              opacity: 0,
            }}
          />

          <div style={{ position: "sticky", top: 0, height: "100vh" }}>
            <div
              ref={gridRef}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: GAP,
                paddingTop: GAP,
                paddingBottom: GAP,
              }}
            >
              {rows.map((images, rowIndex) => (
                <div
                  key={rowIndex}
                  ref={(el) => (trackRefs.current[rowIndex] = el)}
                  style={{ display: "flex", gap: GAP }}
                >
                  {[...images, ...images].map((img, i) => {
                    const idx = canvasIndex++;

                    return (
                      <div
                        key={`${rowIndex}-${i}`}
                        style={{
                          width: imgSize,
                          height: imgSize,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                        <canvas
                          ref={(el) => (canvasRefs.current[idx] = el)}
                          width={imgSize}
                          height={imgSize}
                          style={{ position: "absolute", inset: 0 }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
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