import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAZES, MAZE_NAMES, parseMaze, type ParsedMaze } from "@/lib/mazes";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pac-Arcade — Jeu Pac-Man jouable avec cartes qui changent" },
      {
        name: "description",
        content:
          "Jouez à Pac-Man dans le navigateur : flèches ou ZQSD, cartes qui changent toutes seules, choix du niveau, sur ordinateur, tablette et mobile.",
      },
      { property: "og:title", content: "Pac-Arcade — Jeu Pac-Man en ligne" },
      {
        property: "og:description",
        content:
          "Labyrinthes qui changent tout seuls, sélection de niveau et commandes tactiles : jouez à Pac-Man partout.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

type Dir = "up" | "down" | "left" | "right";
const VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DIRS: Dir[] = ["up", "down", "left", "right"];
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

type Mover = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
  dir: Dir;
  next: Dir;
  home: { x: number; y: number };
  color: string;
  eaten: boolean;
};

type Status = "menu" | "playing" | "paused" | "dead" | "cleared" | "gameover";

const GHOST_COLORS = ["#ff4d6d", "#5ce1ff", "#ffb35c", "#b28dff"];
const AUTO_SWAP_SECONDS = 30;
const FRIGHT_SECONDS = 7;

function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<Status>("menu");
  const [level, setLevel] = useState(1);
  const [mazeIndex, setMazeIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(3);
  const [autoSwap, setAutoSwap] = useState(true);
  const [swapIn, setSwapIn] = useState(AUTO_SWAP_SECONDS);

  const world = useRef<{
    maze: ParsedMaze;
    pac: Mover;
    ghosts: Mover[];
    remaining: number;
    fright: number;
    swapTimer: number;
    freeze: number;
  } | null>(null);
  const statusRef = useRef<Status>("menu");
  const autoRef = useRef(autoSwap);
  const levelRef = useRef(1);
  statusRef.current = status;
  autoRef.current = autoSwap;
  levelRef.current = level;

  const mazeSource = useMemo(() => MAZES[mazeIndex] ?? MAZES[0] ?? "", [mazeIndex]);

  const buildWorld = useCallback((src: string) => {
    const maze = parseMaze(src);
    const pac: Mover = {
      x: maze.start.x,
      y: maze.start.y,
      tx: maze.start.x,
      ty: maze.start.y,
      t: 0,
      dir: "left",
      next: "left",
      home: { ...maze.start },
      color: "#ffe14d",
      eaten: false,
    };
    const ghosts: Mover[] = maze.ghosts.map((g, i) => ({
      x: g.x,
      y: g.y,
      tx: g.x,
      ty: g.y,
      t: 0,
      dir: "up",
      next: "up",
      home: { ...g },
      color: GHOST_COLORS[i % GHOST_COLORS.length] ?? "#ffffff",
      eaten: false,
    }));
    world.current = {
      maze,
      pac,
      ghosts,
      remaining: maze.total,
      fright: 0,
      swapTimer: AUTO_SWAP_SECONDS,
      freeze: 1,
    };
    setSwapIn(AUTO_SWAP_SECONDS);
  }, []);

  const respawn = useCallback(() => {
    const w = world.current;
    if (!w) return;
    w.pac = { ...w.pac, x: w.pac.home.x, y: w.pac.home.y, tx: w.pac.home.x, ty: w.pac.home.y, t: 0 };
    w.ghosts = w.ghosts.map((g) => ({
      ...g,
      x: g.home.x,
      y: g.home.y,
      tx: g.home.x,
      ty: g.home.y,
      t: 0,
      eaten: false,
    }));
    w.fright = 0;
    w.freeze = 1;
  }, []);

  const startGame = useCallback(
    (lvl: number, maze: number) => {
      setLevel(lvl);
      setMazeIndex(maze);
      setScore(0);
      setLives(3);
      buildWorld(MAZES[maze] ?? MAZES[0] ?? "");
      setStatus("playing");
    },
    [buildWorld],
  );

  // Rebuild the maze whenever the selected map changes mid-game.
  const swapMap = useCallback(
    (next: number) => {
      setMazeIndex(next);
      buildWorld(MAZES[next] ?? MAZES[0] ?? "");
    },
    [buildWorld],
  );

  const passable = (maze: ParsedMaze, x: number, y: number) => {
    if (x < 0 || y < 0 || x >= maze.cols || y >= maze.rows) return false;
    return maze.walls[y * maze.cols + x] !== 1;
  };

  // ---- input ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      let d: Dir | null = null;
      if (k === "arrowup" || k === "z" || k === "w") d = "up";
      if (k === "arrowdown" || k === "s") d = "down";
      if (k === "arrowleft" || k === "q" || k === "a") d = "left";
      if (k === "arrowright" || k === "d") d = "right";
      if (k === " " || k === "p") {
        e.preventDefault();
        setStatus((s) => (s === "playing" ? "paused" : s === "paused" ? "playing" : s));
      }
      if (d) {
        e.preventDefault();
        const w = world.current;
        if (w) w.pac.next = d;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const press = useCallback((d: Dir) => {
    const w = world.current;
    if (w) w.pac.next = d;
  }, []);

  // touch swipe
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      sx = t.clientX;
      sy = t.clientY;
    };
    const end = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
      press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", end);
    };
  }, [press]);

  // ---- loop ----
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const w = world.current;
      const canvas = canvasRef.current;
      if (!w || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (statusRef.current === "playing") update(w, dt);
      draw(ctx, canvas, w);
    };

    const update = (w: NonNullable<typeof world.current>, dt: number) => {
      if (w.freeze > 0) {
        w.freeze -= dt;
        return;
      }
      const maze = w.maze;
      const lvl = levelRef.current;
      const pacSpeed = 5.2 + Math.min(lvl, 10) * 0.12;
      const ghostSpeed = 3.6 + Math.min(lvl, 12) * 0.22;

      if (w.fright > 0) w.fright = Math.max(0, w.fright - dt);

      if (autoRef.current) {
        w.swapTimer -= dt;
        setSwapIn(Math.max(0, Math.ceil(w.swapTimer)));
        if (w.swapTimer <= 0) {
          setMazeIndex((prev) => {
            const nxt = (prev + 1) % MAZES.length;
            buildWorld(MAZES[nxt] ?? "");
            return nxt;
          });
          return;
        }
      }

      // Pac-Man
      const pac = w.pac;
      pac.t += pacSpeed * dt;
      while (pac.t >= 1) {
        pac.t -= 1;
        pac.x = pac.tx;
        pac.y = pac.ty;
        const i = pac.y * maze.cols + pac.x;
        if (maze.pellets[i]) {
          maze.pellets[i] = 0;
          w.remaining--;
          setScore((s) => s + 10);
        } else if (maze.power[i]) {
          maze.power[i] = 0;
          w.remaining--;
          w.fright = FRIGHT_SECONDS;
          setScore((s) => s + 50);
        }
        if (w.remaining <= 0) {
          setStatus("cleared");
          pac.t = 0;
          return;
        }
        const nv = VEC[pac.next];
        if (passable(maze, pac.x + nv.x, pac.y + nv.y)) pac.dir = pac.next;
        const dv = VEC[pac.dir];
        if (passable(maze, pac.x + dv.x, pac.y + dv.y)) {
          pac.tx = pac.x + dv.x;
          pac.ty = pac.y + dv.y;
        } else {
          pac.tx = pac.x;
          pac.ty = pac.y;
          pac.t = 0;
          break;
        }
      }

      // Ghosts
      for (const g of w.ghosts) {
        const speed = g.eaten ? ghostSpeed * 1.6 : w.fright > 0 ? ghostSpeed * 0.65 : ghostSpeed;
        g.t += speed * dt;
        while (g.t >= 1) {
          g.t -= 1;
          g.x = g.tx;
          g.y = g.ty;
          if (g.eaten && g.x === g.home.x && g.y === g.home.y) g.eaten = false;
          const options = DIRS.filter((d) => passable(maze, g.x + VEC[d].x, g.y + VEC[d].y));
          const forward = options.filter((d) => d !== OPPOSITE[g.dir]);
          const pool = forward.length ? forward : options;
          const target = g.eaten ? g.home : { x: pac.x, y: pac.y };
          const flee = w.fright > 0 && !g.eaten;
          let choice = pool[Math.floor(Math.random() * pool.length)] ?? g.dir;
          if (Math.random() < (flee ? 0.55 : 0.8)) {
            let bestScore = flee ? -Infinity : Infinity;
            for (const d of pool) {
              const nx = g.x + VEC[d].x;
              const ny = g.y + VEC[d].y;
              const dist = Math.hypot(nx - target.x, ny - target.y);
              if (flee ? dist > bestScore : dist < bestScore) {
                bestScore = dist;
                choice = d;
              }
            }
          }
          g.dir = choice;
          const dv = VEC[g.dir];
          if (passable(maze, g.x + dv.x, g.y + dv.y)) {
            g.tx = g.x + dv.x;
            g.ty = g.y + dv.y;
          } else {
            g.tx = g.x;
            g.ty = g.y;
            g.t = 0;
            break;
          }
        }
      }

      // Collisions (compare interpolated positions)
      const px = pac.x + (pac.tx - pac.x) * pac.t;
      const py = pac.y + (pac.ty - pac.y) * pac.t;
      for (const g of w.ghosts) {
        if (g.eaten) continue;
        const gx = g.x + (g.tx - g.x) * g.t;
        const gy = g.y + (g.ty - g.y) * g.t;
        if (Math.hypot(gx - px, gy - py) < 0.6) {
          if (w.fright > 0) {
            g.eaten = true;
            setScore((s) => s + 200);
          } else {
            setLives((l) => {
              const left = l - 1;
              if (left <= 0) setStatus("gameover");
              else {
                setStatus("dead");
                window.setTimeout(() => {
                  respawn();
                  setStatus("playing");
                }, 900);
              }
              return Math.max(0, left);
            });
            return;
          }
        }
      }
    };

    const draw = (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      w: NonNullable<typeof world.current>,
    ) => {
      const maze = w.maze;
      const dpr = window.devicePixelRatio || 1;
      const cssSize = canvas.clientWidth;
      if (canvas.width !== Math.floor(cssSize * dpr)) {
        canvas.width = Math.floor(cssSize * dpr);
        canvas.height = Math.floor(cssSize * dpr);
      }
      const cell = (cssSize / maze.cols) * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < maze.rows; y++) {
        for (let x = 0; x < maze.cols; x++) {
          const i = y * maze.cols + x;
          if (maze.walls[i]) {
            ctx.fillStyle = "#141a4d";
            ctx.strokeStyle = "#4b5bff";
            ctx.lineWidth = Math.max(1, cell * 0.08);
            ctx.beginPath();
            ctx.roundRect(x * cell + cell * 0.08, y * cell + cell * 0.08, cell * 0.84, cell * 0.84, cell * 0.28);
            ctx.fill();
            ctx.stroke();
          } else if (maze.pellets[i]) {
            ctx.fillStyle = "#ffe9b0";
            ctx.beginPath();
            ctx.arc(x * cell + cell / 2, y * cell + cell / 2, cell * 0.1, 0, Math.PI * 2);
            ctx.fill();
          } else if (maze.power[i]) {
            const pulse = 0.22 + Math.sin(performance.now() / 180) * 0.05;
            ctx.fillStyle = "#7cf7ff";
            ctx.beginPath();
            ctx.arc(x * cell + cell / 2, y * cell + cell / 2, cell * pulse, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // ghosts
      for (const g of w.ghosts) {
        const gx = (g.x + (g.tx - g.x) * g.t) * cell + cell / 2;
        const gy = (g.y + (g.ty - g.y) * g.t) * cell + cell / 2;
        const r = cell * 0.38;
        ctx.fillStyle = g.eaten ? "#2b356b" : w.fright > 0 ? "#3d6bff" : g.color;
        ctx.beginPath();
        ctx.arc(gx, gy, r, Math.PI, 0);
        ctx.lineTo(gx + r, gy + r * 0.9);
        ctx.lineTo(gx + r * 0.4, gy + r * 0.5);
        ctx.lineTo(gx, gy + r * 0.9);
        ctx.lineTo(gx - r * 0.4, gy + r * 0.5);
        ctx.lineTo(gx - r, gy + r * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(gx - r * 0.35, gy - r * 0.1, r * 0.24, 0, Math.PI * 2);
        ctx.arc(gx + r * 0.35, gy - r * 0.1, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0b1030";
        ctx.beginPath();
        ctx.arc(gx - r * 0.3, gy - r * 0.05, r * 0.11, 0, Math.PI * 2);
        ctx.arc(gx + r * 0.4, gy - r * 0.05, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }

      // pac-man
      const pac = w.pac;
      const px = (pac.x + (pac.tx - pac.x) * pac.t) * cell + cell / 2;
      const py = (pac.y + (pac.ty - pac.y) * pac.t) * cell + cell / 2;
      const mouth = Math.abs(Math.sin(performance.now() / 90)) * 0.32 + 0.04;
      const base = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[pac.dir];
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, cell * 0.42, base + mouth * Math.PI, base - mouth * Math.PI);
      ctx.closePath();
      ctx.fill();
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [buildWorld, respawn]);

  useEffect(() => {
    setBest((b) => Math.max(b, score));
  }, [score]);

  // Level cleared -> next level, next map
  const nextLevel = useCallback(() => {
    const nextLvl = level + 1;
    const nextMap = (mazeIndex + 1) % MAZES.length;
    setLevel(nextLvl);
    setMazeIndex(nextMap);
    buildWorld(MAZES[nextMap] ?? "");
    setStatus("playing");
  }, [level, mazeIndex, buildWorld]);

  useEffect(() => {
    if (status === "menu" && !world.current) buildWorld(mazeSource);
  }, [status, mazeSource, buildWorld]);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="text-center">
          <h1 className="font-arcade text-3xl tracking-tight text-primary sm:text-4xl">PAC-ARCADE</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Flèches ou Z Q S D — les labyrinthes changent tout seuls.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-[0_0_40px_-12px_var(--glow)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="rounded-full bg-secondary px-3 py-1 font-semibold">Score {score}</span>
              <span className="rounded-full bg-secondary px-3 py-1">Record {best}</span>
              <span className="rounded-full bg-secondary px-3 py-1">Niveau {level}</span>
              <span className="rounded-full bg-secondary px-3 py-1">
                Vies {"♥".repeat(Math.max(0, lives)) || "—"}
              </span>
              {autoSwap ? (
                <span className="rounded-full bg-accent px-3 py-1 text-accent-foreground">
                  Nouvelle carte dans {swapIn}s
                </span>
              ) : null}
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[560px]">
              <canvas ref={canvasRef} className="h-full w-full touch-none rounded-xl bg-[var(--maze-bg)]" />
              {status !== "playing" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/85 px-6 text-center backdrop-blur-sm">
                  <p className="font-arcade text-xl text-primary">
                    {status === "menu"
                      ? "Prêt à jouer ?"
                      : status === "paused"
                        ? "Pause"
                        : status === "cleared"
                          ? "Labyrinthe terminé !"
                          : status === "gameover"
                            ? "Partie terminée"
                            : "Aïe !"}
                  </p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {status === "gameover"
                      ? `Score final : ${score}`
                      : status === "cleared"
                        ? "Passe au niveau suivant, la carte change aussi."
                        : "Utilise les flèches, Z Q S D, le pavé tactile ou glisse ton doigt."}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {status === "cleared" ? (
                      <button className="btn-arcade" onClick={nextLevel}>
                        Niveau suivant
                      </button>
                    ) : null}
                    {status === "paused" ? (
                      <button className="btn-arcade" onClick={() => setStatus("playing")}>
                        Reprendre
                      </button>
                    ) : null}
                    {status === "menu" ? (
                      <button className="btn-arcade" onClick={() => startGame(level, mazeIndex)}>
                        Jouer
                      </button>
                    ) : null}
                    {status === "gameover" ? (
                      <button className="btn-arcade" onClick={() => startGame(1, 0)}>
                        Rejouer
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Pavé tactile */}
            <div className="mx-auto mt-4 grid w-40 grid-cols-3 gap-2 sm:w-48">
              <span />
              <button className="dpad" onPointerDown={() => press("up")} aria-label="Haut">
                ▲
              </button>
              <span />
              <button className="dpad" onPointerDown={() => press("left")} aria-label="Gauche">
                ◀
              </button>
              <button
                className="dpad"
                onPointerDown={() => setStatus((s) => (s === "playing" ? "paused" : "playing"))}
                aria-label="Pause"
              >
                ❚❚
              </button>
              <button className="dpad" onPointerDown={() => press("right")} aria-label="Droite">
                ▶
              </button>
              <span />
              <button className="dpad" onPointerDown={() => press("down")} aria-label="Bas">
                ▼
              </button>
              <span />
            </div>
          </div>

          <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
            <div>
              <h2 className="font-arcade text-sm text-accent-foreground">Choisir un niveau</h2>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => startGame(n, (n - 1) % MAZES.length)}
                    className={`rounded-lg border px-0 py-2 text-sm font-semibold transition-colors ${
                      n === level
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Plus le niveau est haut, plus les fantômes sont rapides.
              </p>
            </div>

            <div>
              <h2 className="font-arcade text-sm text-accent-foreground">Labyrinthes</h2>
              <div className="mt-2 flex flex-col gap-2">
                {MAZE_NAMES.map((name, i) => (
                  <button
                    key={name}
                    onClick={() => swapMap(i)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      i === mazeIndex
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary px-3 py-2 text-sm">
              <span>Cartes qui changent seules</span>
              <input
                type="checkbox"
                checked={autoSwap}
                onChange={(e) => setAutoSwap(e.target.checked)}
                className="size-4 accent-[var(--pac)]"
              />
            </label>

            <div className="rounded-lg border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Commandes</p>
              <p className="mt-1">Ordinateur : flèches ou Z (haut), S (bas), Q (gauche), D (droite).</p>
              <p>Espace ou P : pause.</p>
              <p>Tablette / mobile : pavé tactile ou glissement du doigt.</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
