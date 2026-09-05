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
  walls: boolean[][];
  pellets: boolean[][];
  power: boolean[][];
  start: { x: number; y: number };
  ghosts: { x: number; y: number }[];
  total: number;
  cols: number;
  rows: number;
};

export function parseMaze(src: string): ParsedMaze {
  const grid = src.split("\n").map((r) => r.split(""));
  const rows = grid.length;
  const cols = grid[0].length;
  const walls: boolean[][] = [];
  const pellets: boolean[][] = [];
  const power: boolean[][] = [];
  let start = { x: 1, y: 1 };
  const ghosts: { x: number; y: number }[] = [];

  for (let y = 0; y < rows; y++) {
    walls[y] = [];
    pellets[y] = [];
    power[y] = [];
    for (let x = 0; x < cols; x++) {
      const c = grid[y][x];
      walls[y][x] = c === "#";
      pellets[y][x] = c === ".";
      power[y][x] = c === "o";
      if (c === "P") start = { x, y };
      if (c === "G") ghosts.push({ x, y });
    }
  }

  // Only keep pellets on cells reachable from the player start.
  const seen = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  const queue = [start];
  seen[start.y][start.x] = true;
  const open: { x: number; y: number }[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    open.push(cur);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (walls[ny][nx] || seen[ny][nx]) continue;
      seen[ny][nx] = true;
      queue.push({ x: nx, y: ny });
    }
  }

  let total = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!seen[y][x]) {
        pellets[y][x] = false;
        power[y][x] = false;
      }
      if (pellets[y][x] || power[y][x]) total++;
    }
  }

  // Make sure ghosts spawn on reachable ground, far from the player.
  const spawns = ghosts.filter((g) => seen[g.y][g.x]);
  while (spawns.length < 4) {
    const far = open
      .slice()
      .sort(
        (a, b) =>
          Math.hypot(b.x - start.x, b.y - start.y) - Math.hypot(a.x - start.x, a.y - start.y),
      )[spawns.length % open.length];
    spawns.push(far ?? start);
  }

  return { walls, pellets, power, start, ghosts: spawns.slice(0, 4), total, cols, rows };
}
