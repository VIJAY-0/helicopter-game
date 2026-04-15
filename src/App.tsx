/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, Play, RotateCcw, Trophy, Info, Github } from "lucide-react";

enum GameState {
  START,
  PLAYING,
  GAMEOVER,
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Obstacle {
  x: number;
  top: number;
  bottom: number;
  passed: boolean;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return Number(localStorage.getItem("heli_high_score") || 0);
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });

  const heli = useRef({ 
    x: 100, 
    y: 250, 
    velocity: 0, 
    angle: 0, 
    spin: 0,
    width: 60,
    height: 60
  });
  
  const faceImg = useRef<HTMLImageElement | null>(null);
  const crashParticles = useRef<Particle[]>([]);
  const obstacles = useRef<Obstacle[]>([]);
  const isHolding = useRef(false);
  const frameCount = useRef(0);
  const screenShake = useRef(0);

  const gravity = 0.25;
  const lift = -4.5;
  const OBS_W = 70;
  const GAP_RATIO = 0.55;

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = Math.min(window.innerHeight * 0.6, 500);
        setSize({ w: width, h: height });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const spawnObstacle = useCallback((width: number, height: number) => {
    const gap = height * GAP_RATIO;
    const minHeight = 50;
    const maxHeight = height - gap - minHeight;
    const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
    
    obstacles.current.push({
      x: width,
      top: topHeight,
      bottom: height - (topHeight + gap),
      passed: false,
    });
  }, []);

  const crash = useCallback(() => {
    setGameState(GameState.GAMEOVER);
    screenShake.current = 15;
    
    setHighScore((prev) => {
      const newHigh = Math.max(prev, score);
      localStorage.setItem("heli_high_score", newHigh.toString());
      return newHigh;
    });

    heli.current.spin = 0.3;

    // Explosion particles
    const colors = ["#ff4757", "#ffa502", "#2ed573", "#ffffff"];
    for (let i = 0; i < 40; i++) {
      crashParticles.current.push({
        x: heli.current.x + heli.current.width / 2,
        y: heli.current.y + heli.current.height / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }, [score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const update = () => {
      if (gameState !== GameState.PLAYING) {
        if (gameState === GameState.GAMEOVER) {
          if (heli.current.spin > 0) {
            heli.current.angle += heli.current.spin;
            heli.current.spin *= 0.98;
          }
          heli.current.velocity += gravity;
          heli.current.y += heli.current.velocity;
        }
      } else {
        heli.current.velocity += gravity;
        if (isHolding.current) {
          heli.current.velocity += lift * 0.25;
        }

        heli.current.y += heli.current.velocity;
        heli.current.angle = Math.max(-0.4, Math.min(0.4, heli.current.velocity * 0.05));

        obstacles.current.forEach((obs) => {
          obs.x -= 4;
          if (!obs.passed && obs.x + OBS_W < heli.current.x) {
            obs.passed = true;
            setScore((s) => s + 1);
          }
        });
        
        obstacles.current = obstacles.current.filter((o) => o.x > -OBS_W);

        if (frameCount.current % 100 === 0) {
          spawnObstacle(canvas.width, canvas.height);
        }

        const heliHitbox = {
          x: heli.current.x + 10,
          y: heli.current.y + 10,
          w: heli.current.width - 20,
          h: heli.current.height - 20,
        };

        obstacles.current.forEach((obs) => {
          if (
            heliHitbox.x < obs.x + OBS_W &&
            heliHitbox.x + heliHitbox.w > obs.x &&
            (heliHitbox.y < obs.top ||
              heliHitbox.y + heliHitbox.h > canvas.height - obs.bottom)
          ) {
            crash();
          }
        });

        if (heli.current.y < -50 || heli.current.y > canvas.height + 50) {
          crash();
        }
      }

      crashParticles.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.015;
      });
      crashParticles.current = crashParticles.current.filter((p) => p.life > 0);

      if (screenShake.current > 0) {
        screenShake.current *= 0.9;
        if (screenShake.current < 0.1) screenShake.current = 0;
      }

      frameCount.current++;
    };

    const draw = () => {
      ctx.save();
      
      if (screenShake.current > 0) {
        const dx = (Math.random() - 0.5) * screenShake.current;
        const dy = (Math.random() - 0.5) * screenShake.current;
        ctx.translate(dx, dy);
      }

      // Background - Sky Blue with Radial Gradient
      ctx.fillStyle = "#70a1ff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const radialGradient = ctx.createRadialGradient(
        canvas.width * 0.1, canvas.height * 0.2, 0,
        canvas.width * 0.1, canvas.height * 0.2, canvas.width * 0.4
      );
      radialGradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
      radialGradient.addColorStop(1, "transparent");
      ctx.fillStyle = radialGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Clouds decoration
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      const drawCloud = (x: number, y: number, w: number) => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, 40, 20);
        ctx.fill();
      };
      
      const cloudOffset = (frameCount.current * 0.5) % (canvas.width + 200);
      drawCloud(400 - cloudOffset, 50, 120);
      drawCloud(700 - cloudOffset, 120, 120);
      drawCloud(200 - cloudOffset, 250, 160);
      drawCloud(900 - cloudOffset, 80, 140);

      // Draw Obstacles - Accent Red with Thick Dark Borders
      obstacles.current.forEach((obs) => {
        ctx.fillStyle = "#ff4757";
        ctx.strokeStyle = "#2f3542";
        ctx.lineWidth = 4;
        
        // Top obstacle
        ctx.fillRect(obs.x, 0, OBS_W, obs.top);
        ctx.strokeRect(obs.x, -4, OBS_W, obs.top + 4);
        
        // Bottom obstacle
        ctx.fillRect(obs.x, canvas.height - obs.bottom, OBS_W, obs.bottom);
        ctx.strokeRect(obs.x, canvas.height - obs.bottom, OBS_W, obs.bottom + 4);
      });

      // Draw Player - Bamboo Copter (Take-copter) Style
      ctx.save();
      ctx.translate(heli.current.x + heli.current.width / 2, heli.current.y + heli.current.height / 2);
      ctx.rotate(heli.current.angle);

      // Face (Primary Body) - No circle clip, just the photo
      ctx.save();
      if (faceImg.current) {
        const img = faceImg.current;
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2;
        const sy = (img.height - s) / 3;
        // Draw image with slight rounded corners for a cleaner look
        ctx.beginPath();
        ctx.roundRect(-30, -30, 60, 60, 8);
        ctx.clip();
        ctx.drawImage(img, sx, sy, s, s, -30, -30, 60, 60);
      } else {
        ctx.fillStyle = "#ffa502";
        ctx.beginPath();
        ctx.roundRect(-30, -30, 60, 60, 8);
        ctx.fill();
        ctx.strokeStyle = "#2f3542";
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = "#2f3542";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PILOT", 0, 5);
      }
      ctx.restore();

      // Bamboo Copter (Take-copter)
      ctx.save();
      ctx.translate(0, -30); // Position on top of head
      
      // Base of the copter (Yellow)
      ctx.fillStyle = "#ffd32a";
      ctx.strokeStyle = "#2f3542";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-6, -8, 12, 10, 2);
      ctx.fill();
      ctx.stroke();

      // Propeller (Bamboo Fan)
      ctx.save();
      ctx.translate(0, -8);
      ctx.rotate(frameCount.current * 0.6); // Fast spin
      ctx.fillStyle = "#ffd32a";
      ctx.strokeStyle = "#2f3542";
      ctx.lineWidth = 2;
      
      // Draw two blades
      ctx.beginPath();
      ctx.roundRect(-25, -2, 50, 4, 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
      ctx.restore();

      ctx.restore();

      // Draw Particles
      crashParticles.current.forEach((p) => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#2f3542";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      ctx.restore();
    };

    const loop = () => {
      update();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, spawnObstacle, crash]);

  const handleStart = () => {
    setScore(0);
    heli.current = { 
      x: 100, 
      y: size.h / 2, 
      velocity: 0, 
      angle: 0, 
      spin: 0,
      width: 60,
      height: 60
    };
    obstacles.current = [];
    crashParticles.current = [];
    frameCount.current = 0;
    setGameState(GameState.PLAYING);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        faceImg.current = img;
      };
    }
  };

  return (
    <div className="min-h-screen bg-[#6366f1] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-[900px] bg-white rounded-[40px] border-[12px] border-[#2f3542] shadow-[0_20px_0_rgba(0,0,0,0.2)] overflow-hidden flex flex-col relative">
        {/* Top Bar */}
        <header className="h-20 px-10 flex items-center justify-between bg-[#2f3542] text-white">
          <div className="flex items-center gap-3 text-[28px] font-black tracking-tighter">
            <span>🚁</span>
            <span>HELI-FACE ARCADE</span>
          </div>
          <div className="flex gap-8 text-xl font-bold">
            <div className="bg-white/10 px-5 py-2 rounded-full">
              SCORE: <span className="text-[#2ed573]">{score.toLocaleString('en-US', { minimumIntegerDigits: 5 })}</span>
            </div>
            <div className="bg-white/10 px-5 py-2 rounded-full">
              BEST: <span className="text-[#ffa502]">{highScore.toLocaleString('en-US', { minimumIntegerDigits: 5 })}</span>
            </div>
          </div>
        </header>

        {/* Game Viewport */}
        <div 
          ref={containerRef}
          className="flex-1 relative bg-[#70a1ff] overflow-hidden"
          onMouseDown={() => {
            if (gameState === GameState.PLAYING) isHolding.current = true;
          }}
          onMouseUp={() => (isHolding.current = false)}
          onMouseLeave={() => (isHolding.current = false)}
          onTouchStart={() => {
            if (gameState === GameState.PLAYING) isHolding.current = true;
          }}
          onTouchEnd={() => (isHolding.current = false)}
        >
          <canvas
            ref={canvasRef}
            width={size.w}
            height={size.h}
            className="w-full h-full block"
          />

          {/* Overlays */}
          <AnimatePresence mode="wait">
            {gameState === GameState.START && (
              <motion.div 
                key="start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
              >
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="max-w-md bg-white p-10 rounded-[32px] border-8 border-[#2f3542] shadow-[0_10px_0_rgba(0,0,0,0.1)]"
                >
                  <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter text-[#2f3542]">Ready to Fly?</h2>
                  <p className="text-[#2f3542] mb-8 font-bold opacity-70">
                    Upload your face to become the pilot! Hold to fly up, release to fall.
                  </p>
                  
                  <button 
                    onClick={handleStart}
                    className="w-full py-4 bg-[#2ed573] hover:bg-[#26c167] text-white rounded-2xl font-black text-2xl border-b-[6px] border-[#21a455] transition-all active:translate-y-1 active:border-b-0"
                  >
                    START MISSION
                  </button>
                </motion.div>
              </motion.div>
            )}

            {gameState === GameState.GAMEOVER && (
              <motion.div 
                key="gameover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white p-10 rounded-[32px] border-8 border-[#2f3542] shadow-[0_10px_0_rgba(0,0,0,0.1)]"
                >
                  <h2 className="text-5xl font-black mb-2 uppercase tracking-tighter text-[#ff4757]">Mission Failed</h2>
                  <p className="text-[#2f3542] font-bold opacity-60 mb-8">You crashed into the obstacles!</p>
                  
                  <div className="grid grid-cols-2 gap-8 mb-10">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-widest text-[#2f3542] font-black opacity-40">Score</span>
                      <span className="text-4xl font-black text-[#2f3542]">{score}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-widest text-[#2f3542] font-black opacity-40">Best</span>
                      <span className="text-4xl font-black text-[#ffa502]">{highScore}</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleStart}
                    className="w-full py-4 bg-[#ff4757] hover:bg-[#ff3344] text-white rounded-2xl font-black text-2xl border-b-[6px] border-[#d63031] transition-all active:translate-y-1 active:border-b-0"
                  >
                    TRY AGAIN
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black/40 text-white px-5 py-1 rounded-full text-sm font-bold pointer-events-none">
            HOLD SPACE OR MOUSE TO FLY UP
          </div>
        </div>

        {/* Control Panel */}
        <div className="h-[120px] bg-[#f1f2f6] border-top-[4px] border-[#2f3542] flex items-center justify-around px-10">
          <label className="flex items-center gap-4 bg-white px-5 py-3 rounded-[20px] border-3 border-dashed border-[#ced4da] cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="text-3xl">🖼️</div>
            <div>
              <div className="font-black text-sm text-[#2f3542]">PILOT PHOTO</div>
              <div className="text-xs text-gray-400 font-bold">Click to change face...</div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>

          {gameState !== GameState.PLAYING && (
            <button 
              onClick={handleStart}
              className="px-10 py-4 bg-[#2ed573] hover:bg-[#26c167] text-white rounded-2xl font-black text-2xl border-b-[6px] border-[#21a455] transition-all active:translate-y-1 active:border-b-0"
            >
              START MISSION
            </button>
          )}

          <div className="flex gap-3">
            <div className="w-12 h-12 bg-[#ddd] border-b-4 border-gray-400 rounded-xl flex items-center justify-center font-black text-[#666]">ESC</div>
            <div className="w-12 h-12 bg-[#ddd] border-b-4 border-gray-400 rounded-xl flex items-center justify-center font-black text-[#666]">P</div>
          </div>
        </div>
      </div>
    </div>
  );
}
