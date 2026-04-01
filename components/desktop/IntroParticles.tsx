"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { IntroStage } from "@/types/davinci";

type IntroParticlesProps = {
  onComplete: () => void;
  onStageChange?: (stage: IntroStage) => void;
  pageRef: RefObject<HTMLElement | null>;
  rootRef: RefObject<HTMLElement | null>;
  topic: string;
};

type SamplePoint = {
  col: string;
  wx: number;
  wy: number;
};

type FontFamilies = {
  body: string;
  display: string;
};

const CFG = {
  alphaThreshold: 40,
  dustDurationBase: 2600,
  dustDurationRand: 1400,
  dustFadePow: 1.7,
  dustFadeStart: 0.38,
  dustSizeMax: 0.68,
  dustSizeMin: 0.1,
  dustVxMax: 0.82,
  dustVxMin: 0.18,
  dustVyRange: 0.4,
  maxParticles: 5000,
  waveRandom: 220,
  waveSpread: 760,
};

function getFontFamilies() {
  const styles = getComputedStyle(document.documentElement);

  return {
    body:
      styles.getPropertyValue("--font-body-family").trim() ||
      '"Noto Serif KR", serif',
    display:
      styles.getPropertyValue("--font-display-family").trim() ||
      '"Cormorant Garamond", serif',
  } satisfies FontFamilies;
}

class DustParticle {
  a = 1;
  col: string;
  drift: number;
  duration: number;
  elapsed = 0;
  r: number;
  started = false;
  tp: number;
  ts: number;
  vx: number;
  vy: number;
  x: number;
  y: number;

  constructor(x: number, y: number, col: string) {
    this.x = x;
    this.y = y;
    this.col = col;
    this.r = Math.random() * (CFG.dustSizeMax - CFG.dustSizeMin) + CFG.dustSizeMin;
    this.vx = Math.random() * (CFG.dustVxMax - CFG.dustVxMin) + CFG.dustVxMin;
    this.vy = (Math.random() - 0.5) * CFG.dustVyRange;
    this.tp = Math.random() * Math.PI * 2;
    this.ts = Math.random() * 0.018 + 0.008;
    this.duration = CFG.dustDurationBase + Math.random() * CFG.dustDurationRand;
    this.drift = (Math.random() - 0.55) * 0.00042;
  }

  tick(dt: number) {
    if (!this.started) {
      return;
    }

    this.elapsed += dt;
    const progress = Math.min(1, this.elapsed / this.duration);
    this.tp += this.ts;

    const speed = 0.16 + progress * progress * 1.95;
    this.x += this.vx * speed;
    this.y +=
      this.vy * speed +
      Math.sin(this.tp) * 0.18 +
      this.drift * this.elapsed * 0.004;

    this.a =
      progress < CFG.dustFadeStart
        ? 1
        : Math.pow(
            1 - (progress - CFG.dustFadeStart) / (1 - CFG.dustFadeStart),
            CFG.dustFadePow,
          );
  }

  draw(context: CanvasRenderingContext2D) {
    if (!this.started || this.a <= 0) {
      return;
    }

    context.save();
    context.globalAlpha = Math.max(0, this.a);
    context.fillStyle = this.col;
    context.beginPath();
    context.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function sampleElement(
  el: HTMLElement,
  root: HTMLElement,
  fonts: FontFamilies,
  typedTopic: string,
) {
  const rootRect = root.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const ex = rect.left - rootRect.left;
  const ey = rect.top - rootRect.top;
  const ew = Math.ceil(rect.width);
  const eh = Math.ceil(rect.height);

  if (ew < 2 || eh < 2) {
    return [] as SamplePoint[];
  }

  const pad = 6;
  const offscreen = document.createElement("canvas");
  offscreen.width = ew + pad * 2;
  offscreen.height = eh + pad * 2;
  const ctx = offscreen.getContext("2d");

  if (!ctx) {
    return [] as SamplePoint[];
  }

  const computed = window.getComputedStyle(el);
  const role = el.dataset.dustId ?? "";
  const centerX = ew / 2 + pad;
  const centerY = eh / 2 + pad;

  ctx.clearRect(0, 0, offscreen.width, offscreen.height);

  if (role === "brand") {
    ctx.font = `italic 11px ${fonts.display}`;
    ctx.fillStyle = "#8b6c42";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Leonardo / Da Vinci", centerX, centerY);
  } else if (role === "divider") {
    const gradient = ctx.createLinearGradient(0, 0, 0, offscreen.height);
    gradient.addColorStop(0, "rgba(196,168,130,0)");
    gradient.addColorStop(0.5, "rgba(196,168,130,0.85)");
    gradient.addColorStop(1, "rgba(196,168,130,0)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, offscreen.height);
    ctx.stroke();
  } else if (role === "title") {
    const fontSize = parseFloat(computed.fontSize) || 72;

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    ctx.font = `300 ${fontSize}px ${fonts.display}`;
    const davinciText = "다빈치 ";
    const davinciWidth = ctx.measureText(davinciText).width;

    ctx.font = `italic 300 ${fontSize}px ${fonts.display}`;
    const noteText = "노트";
    const noteWidth = ctx.measureText(noteText).width;

    const startX = centerX - (davinciWidth + noteWidth) / 2;

    ctx.font = `300 ${fontSize}px ${fonts.display}`;
    ctx.fillStyle = "#1a1208";
    ctx.fillText(davinciText, startX, centerY);

    ctx.font = `italic 300 ${fontSize}px ${fonts.display}`;
    ctx.fillStyle = "#8b6c42";
    ctx.fillText(noteText, startX + davinciWidth, centerY);
  } else if (role === "tagline") {
    ctx.font = `italic 14px ${fonts.display}`;
    ctx.fillStyle = "#c4a882";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("생각의 형태를 찾는 곳", centerX, centerY);
  } else if (role === "form") {
    const inputText = typedTopic.trim() || "첫 번째 주제를 입력해보세요";

    ctx.strokeStyle = "#c4a882";
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, ew, eh);
    ctx.font = `300 18px ${fonts.body}`;
    ctx.fillStyle = typedTopic.trim() ? "#1a1208" : "#d4b896";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(inputText, pad + 12, centerY);

    const buttonWidth = 98;
    ctx.fillStyle = "#8b6c42";
    ctx.fillRect(ew - buttonWidth + pad, pad, buttonWidth, eh);
    ctx.font = `italic 14px ${fonts.display}`;
    ctx.fillStyle = "#faf8f3";
    ctx.textAlign = "center";
    ctx.fillText("시작하기", ew - buttonWidth / 2 + pad, centerY);
  } else if (role === "hint") {
    ctx.font = `300 11px ${fonts.body}`;
    ctx.fillStyle = "#d4b896";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Enter로 바로 시작할 수 있어요", centerX, centerY);
  }

  const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height).data;
  const result: SamplePoint[] = [];

  for (let py = 0; py < offscreen.height; py += 1) {
    for (let px = 0; px < offscreen.width; px += 1) {
      const index = (py * offscreen.width + px) * 4;

      if (imageData[index + 3] <= CFG.alphaThreshold) {
        continue;
      }

      result.push({
        wx: ex + px - pad,
        wy: ey + py - pad,
        col: `rgb(${imageData[index]},${imageData[index + 1]},${imageData[index + 2]})`,
      });
    }
  }

  return result;
}

export function IntroParticles({
  onComplete,
  onStageChange,
  pageRef,
  rootRef,
  topic,
}: IntroParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const page = pageRef.current;

    if (!canvas || !root || !page) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: DustParticle[] = [];
    let animationFrame = 0;
    let lastTime = 0;
    let running = true;
    const timers: number[] = [];
    const fonts = getFontFamilies();

    const resize = () => {
      width = root.offsetWidth;
      height = root.offsetHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const finish = () => {
      if (!running) {
        return;
      }

      running = false;
      context.clearRect(0, 0, width, height);
      onStageChange?.("graph");
      onComplete();
    };

    const drawLoop = (time: number) => {
      if (!running) {
        return;
      }

      const dt = Math.min(time - lastTime, 50);
      lastTime = time;
      context.clearRect(0, 0, width, height);

      let alive = false;

      for (const particle of particles) {
        particle.tick(dt);
        particle.draw(context);

        if (particle.a > 0 || !particle.started) {
          alive = true;
        }
      }

      if (alive) {
        animationFrame = window.requestAnimationFrame(drawLoop);
        return;
      }

      finish();
    };

    const runSequence = () => {
      onStageChange?.("dusting");
      particles = [];

      page.style.transition = "opacity 520ms ease";
      page.style.opacity = "0";

      const elements = ["el0", "el1", "el2", "el3", "el4", "el5"];

      for (const id of elements) {
        const element = page.querySelector<HTMLElement>(`#${id}`);

        if (!element) {
          continue;
        }

        const samples = sampleElement(element, root, fonts, topic);
        const step =
          samples.length > CFG.maxParticles
            ? Math.ceil(samples.length / CFG.maxParticles)
            : 1;

        for (let index = 0; index < samples.length; index += step) {
          const sample = samples[index];
          const wave =
            (sample.wx / width) * CFG.waveSpread + Math.random() * CFG.waveRandom;
          const particle = new DustParticle(sample.wx, sample.wy, sample.col);

          timers.push(
            window.setTimeout(() => {
              particle.started = true;
            }, wave),
          );

          particles.push(particle);
        }
      }

      timers.push(
        window.setTimeout(() => {
          page.style.visibility = "hidden";
        }, 560),
      );

      animationFrame = window.requestAnimationFrame((time) => {
        lastTime = time;
        drawLoop(time);
      });
    };

    const boot = async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }

      if (!running) {
        return;
      }

      resize();
      runSequence();
    };

    void boot();
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [onComplete, onStageChange, pageRef, rootRef, topic]);

  return (
    <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-30" />
  );
}
