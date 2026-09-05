export const MAZES: string[] = [
  `#####################
#.........#.........#
#o###.###.#.###.###o#
#.###.###.#.###.###.#
#...................#
#.###.#.#####.#.###.#
#.....#...#...#.....#
#####.###.#.###.#####
#####.#.......#.#####
#####.#.##G##.#.#####
#.......#GGG#.......#
#####.#.#####.#.#####
#####.#.......#.#####
#####.#.#####.#.#####
#.........#.........#
#.###.###.#.###.###.#
#o..#.....P.....#..o#
###.#.#.#####.#.#.###
#...#.#...#...#.#...#
#.....###.#.###.....#
#####################`,
  `#####################
#o.......#.......o..#
#.#####.###.#####.#.#
#.#...#.....#...#...#
#.#.#.#####.#.#.###.#
#...#...#...#.#.....#
###.###.#.###.#####.#
#.......#.#.......#.#
#.#####.#.#.#####.#.#
#.#..GGG#.#.....#...#
#.#.##G##.###.#.###.#
#.#.....#...#.#...#.#
#.#####.###.#.###.#.#
#.....#.....#...#..o#
#####.#.#######.###.#
#o..#...#.....#.....#
#.#.#####.###.#####.#
#.#.......#P#.......#
#.#####.###.###.###.#
#.......#.......#...#
#####################`,
  `#####################
#o...#.........#...o#
#.##.#.#######.#.##.#
#.##...#.....#...##.#
#....#.#.###.#.#....#
####.#.#.#G#.#.#.####
#....#.#.###.#.#....#
#.####.#..G..#.####.#
#......#.###.#......#
######.#.#.#.#.######
#........#.#........#
######.#.#.#.#.######
#......#.###.#......#
#.####.#.....#.####.#
#....#.#######.#....#
####.#....P....#.####
#....#.#######.#....#
#.####.........####.#
#o...#####.#####...o#
#...................#
#####################`,
  `#####################
#.......#...#.......#
#o#####.#.#.#####.#o#
#.#...#.#.#.#...#.#.#
#...#.#.#.#.#.#.#...#
###.#.#...#...#.#.###
#...#.#####.###.#...#
#.###.....#.#...#.###
#.....###.#.#.###...#
#####.#GGG#.#...#.###
#.....#.G#..#.###...#
#.#####.##.##.#...#.#
#.#...#.....#.###.#.#
#.#.#.#####.#...#.#.#
#...#.....#.###.#...#
###.#####.#...#.###.#
#o......#.###.#....o#
#.#####.#..P..#####.#
#.....#.#####.#.....#
#.###...........###.#
#####################`,
];

export const MAZE_NAMES = ["Classique", "Spirale", "Cathédrale", "Dédale"];

export type ParsedMaze = {
  walls: Uint8Array;
  pellets: Uint8Array;
  power: Uint8Array;
  start: { x: number; y: number };
  ghosts: { x: number; y: number }[];
  total: number;
  cols: number;
  rows: number;
};

export function parseMaze(src: string): ParsedMaze {
  const lines = src.split("\n");
  const rows = lines.length;
  const cols = (lines[0] ?? "").length;
  const size = rows * cols;
  const walls = new Uint8Array(size);
  const pellets = new Uint8Array(size);
  const power = new Uint8Array(size);
  let start = { x: 1, y: 1 };
  const ghosts: { x: number; y: number }[] = [];

  for (let y = 0; y < rows; y++) {
    const line = lines[y] ?? "";
    for (let x = 0; x < cols; x++) {
      const c = line[x] ?? "#";
      const i = y * cols + x;
      if (c === "#") walls[i] = 1;
      if (c === ".") pellets[i] = 1;
      if (c === "o") power[i] = 1;
      if (c === "P") start = { x, y };
      if (c === "G") ghosts.push({ x, y });
    }
  }

  // Keep only what the player can actually reach from the start cell.
  const seen = new Uint8Array(size);
  const open: { x: number; y: number }[] = [];
  const queue: { x: number; y: number }[] = [start];
  seen[start.y * cols + start.x] = 1;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  while (queue.length) {
    const cur = queue.shift();
    if (!cur) break;
    open.push(cur);
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (walls[ni] || seen[ni]) continue;
      seen[ni] = 1;
      queue.push({ x: nx, y: ny });
    }
  }

  let total = 0;
  for (let i = 0; i < size; i++) {
    if (!seen[i]) {
      pellets[i] = 0;
      power[i] = 0;
    }
    if (pellets[i] || power[i]) total++;
  }

  const spawns = ghosts.filter((g) => seen[g.y * cols + g.x] === 1);
  const farthest = open
    .slice()
    .sort(
      (a, b) => Math.hypot(b.x - start.x, b.y - start.y) - Math.hypot(a.x - start.x, a.y - start.y),
    );
  let k = 0;
  while (spawns.length < 4) {
    spawns.push(farthest[k % Math.max(farthest.length, 1)] ?? start);
    k++;
  }

  return { walls, pellets, power, start, ghosts: spawns.slice(0, 4), total, cols, rows };
}
