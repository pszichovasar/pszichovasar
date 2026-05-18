"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const scene1Ref = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const [imgSize, setImgSize] = useState<number>(140);

  const GAP = 20;

  const row0 = ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg", "/8.jpg", "/9.jpg", "/10.jpg"];
  const row1 = ["/11.jpg", "/12.jpg", "/13.jpg", "/14.jpg", "/15.jpg", "/16.jpg", "/17.jpg", "/18.jpg", "/19.jpg", "/20.jpg"];
  const row2 = ["/1.jpg", "/3.jpg", "/5.jpg", "/7.jpg", "/9.jpg", "/2.jpg", "/4.jpg", "/6.jpg", "/8.jpg", "/10.jpg"];
  const row3 = ["/11.jpg", "/13.jpg", "/15.jpg", "/17.jpg", "/19.jpg", "/12.jpg", "/14.jpg", "/16.jpg", "/18.jpg", "/20.jpg"];
  const row4 = ["/2.jpg", "/4.jpg", "/6.jpg", "/8.jpg", "/10.jpg", "/1.jpg", "/3.jpg", "/5.jpg", "/7.jpg", "/9.jpg"];

  const rows = [row0, row1, row2, row3, row4];
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
    const handleScroll = () => {
      const scene = scene1Ref.current;
      if (!scene) return;

      const rect = scene.getBoundingClientRect();
      const progress = Math.min(Math.max(-rect.top / rect.height, 0), 1);

      trackRefs.current.forEach((track, i) => {
        if (!track) return;

        const maxMove = track.scrollWidth / 2;

        const x = directions[i]
          ? -progress * maxMove
          : -maxMove + progress * maxMove;

        track.style.transform = `translateX(${x}px)`;
      });
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  let canvasIndex = 0;

  // ✅ SAFE REF SETTERS (fix TypeScript forever)
  const setTrackRef = (index: number) => (el: HTMLDivElement | null) => {
    trackRefs.current[index] = el;
  };

  const setCanvasRef = (index: number) => (el: HTMLCanvasElement | null) => {
    canvasRefs.current[index] = el;
  };

  return (
    <main style={{ background: "black", color: "white" }}>
      <section
        ref={scene1Ref}
        style={{ height: "250vh", position: "relative" }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: `${GAP}px`,
              paddingTop: `${GAP}px`,
              paddingBottom: `${GAP}px`,
            }}
          >
            {rows.map((images, rowIndex) => {
              const looped = [...images, ...images];

              return (
                <div
                  key={rowIndex}
                  ref={setTrackRef(rowIndex)}
                  style={{
                    display: "flex",
                    gap: `${GAP}px`,
                    width: "max-content",
                    paddingLeft: `${GAP}px`,
                    paddingRight: `${GAP}px`,
                  }}
                >
                  {looped.map((img, i) => {
                    const idx = canvasIndex++;

                    return (
                      <div
                        key={`${rowIndex}-${i}`}
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
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />

                        <canvas
                          ref={setCanvasRef(idx)}
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
  );
}