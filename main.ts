// The World in One Image - Tuesday 24 November 2026.
// A newspaper front page drawn from scratch in pure Node: five stories
// that shaped the day, rendered as one 1024x1024 PNG.
// Node standard library only. No network, no clock, no fonts from disk:
// every letter is drawn from a small 5x7 bitmap alphabet defined below,
// and the PNG bytes are encoded by hand (zlib deflate, fixed level).
// Same input, same bytes, every run.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

const PAPER: RGB = [247, 242, 230];
const INK: RGB = [24, 24, 24];
const NAVY: RGB = [26, 38, 66];
const GOLD: RGB = [198, 158, 60];
const WHITE: RGB = [255, 255, 255];
const TEAL: RGB = [13, 106, 106];
const TEAL_SOFT: RGB = [214, 234, 231];
const CRIMSON: RGB = [166, 30, 30];
const CRIMSON_SOFT: RGB = [242, 222, 218];
const GREEN: RGB = [32, 122, 62];
const GREEN_SOFT: RGB = [216, 236, 219];
const EMBER: RGB = [206, 88, 16];
const EMBER_SOFT: RGB = [247, 226, 205];
const PURPLE: RGB = [86, 58, 138];
const PURPLE_SOFT: RGB = [230, 224, 244];
const SEA: RGB = [44, 104, 168];
const SKY: RGB = [205, 222, 238];
const FLAME_OUT: RGB = [232, 84, 8];
const FLAME_MID: RGB = [250, 164, 26];
const FLAME_IN: RGB = [255, 224, 102];
const SMOKE: RGB = [120, 124, 132];
const BALL: RGB = [176, 204, 48];
const DARK: RGB = [46, 48, 56];
const LINE: RGB = [190, 182, 164];

// ---------------------------------------------------------------- canvas
// One RGB framebuffer; every shape below is painted into it.
const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * W + xx) * 3;
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
    }
  }
}

function hline(x0: number, x1: number, y: number, c: RGB): void {
  if (y < 0 || y >= H) return;
  const a = Math.max(0, Math.min(x0, x1));
  const b = Math.min(W - 1, Math.max(x0, x1));
  for (let x = a; x <= b; x++) setPixel(x, y, c);
}

// Bresenham line, with a square brush of `thick` pixels.
function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB, thick: number): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(thick / 2);
  for (;;) {
    fillRect(x - half, y - half, thick, thick, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let dy = -r; dy <= r; dy++) {
    const span = Math.floor(Math.sqrt(r * r - dy * dy));
    hline(cx - span, cx + span, cy + dy, c);
  }
}

function ring(cx: number, cy: number, r: number, thick: number, c: RGB): void {
  fillCircle(cx, cy, r, c);
  fillCircle(cx, cy, r - thick, PAPER);
}

// Filled triangle by scanline interpolation between its three edges.
function fillTriangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB): void {
  const pts: Array<[number, number]> = [
    [ax, ay],
    [bx, by],
    [cx, cy],
  ].sort((p, q) => p[1] - q[1]);
  const [x0, y0] = pts[0];
  const [x1, y1] = pts[1];
  const [x2, y2] = pts[2];
  const lerpX = (xa: number, ya: number, xb: number, yb: number, y: number): number =>
    yb === ya ? xa : xa + ((xb - xa) * (y - ya)) / (yb - ya);
  for (let y = Math.ceil(y0); y <= Math.floor(y2); y++) {
    let xa: number;
    let xb: number;
    if (y < y1) {
      xa = lerpX(x0, y0, x2, y2, y);
      xb = lerpX(x0, y0, x1, y1, y);
    } else {
      xa = lerpX(x0, y0, x2, y2, y);
      xb = lerpX(x1, y1, x2, y2, y);
    }
    hline(Math.ceil(Math.min(xa, xb)), Math.floor(Math.max(xa, xb)), y, c);
  }
}

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph is 7 rows of 5 bits. Only capitals, digits and a few marks:
// every line of copy in this picture is written in capitals on purpose.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
};

const CHAR_W = 6; // 5 glyph columns + 1 blank column, in font units
const CHAR_H = 7;

function textWidth(s: string, scale: number): number {
  return s.length * CHAR_W * scale - scale;
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = GLYPHS[ch] ?? GLYPHS["?"];
    for (let row = 0; row < CHAR_H; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === "1") {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += CHAR_W * scale;
  }
}

function drawTextCentered(x: number, y: number, w: number, s: string, scale: number, c: RGB): void {
  drawText(x + Math.floor((w - textWidth(s, scale)) / 2), y, s, scale, c);
}

// Greedy word wrap: returns lines that fit inside maxW pixels.
function wrap(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------ panels
interface PanelOpts {
  tag: string;
  accent: RGB;
  band: RGB;
  headline: string[];
  summary: string;
  art: (bx: number, by: number, bw: number, bh: number) => void;
}

function drawPanel(x: number, y: number, w: number, h: number, o: PanelOpts): void {
  // Paper card with a thin ink frame.
  fillRect(x, y, w, h, WHITE);
  fillRect(x, y, w, 2, INK);
  fillRect(x, y + h - 2, w, 2, INK);
  fillRect(x, y, 2, h, INK);
  fillRect(x + w - 2, y, 2, h, INK);
  // Category bar.
  fillRect(x + 2, y + 2, w - 4, 36, o.accent);
  drawText(x + 18, y + 12, o.tag, 2, WHITE);
  // Headline lines, scale 3.
  let ty = y + 54;
  for (const line of o.headline) {
    drawText(x + 18, ty, line, 3, INK);
    ty += 27;
  }
  // Gold rule under the headline.
  fillRect(x + 18, ty + 2, 64, 4, GOLD);
  // Summary, scale 2, wrapped to the inner width.
  const sumLines = wrap(o.summary, w - 36, 2);
  let sy = ty + 16;
  for (const line of sumLines) {
    drawText(x + 18, sy, line, 2, INK);
    sy += 19;
  }
  // Picture band along the bottom of the card.
  const bandY = y + h - 118;
  fillRect(x + 2, bandY, w - 4, 116, o.band);
  fillRect(x + 2, bandY, w - 4, 2, LINE);
  o.art(x + 2, bandY, w - 4, 116);
}

// ------------------------------------------------------------- pictograms
// 1. COP31: a globe with a red crack running through it.
function artGlobe(bx: number, by: number, bw: number, bh: number): void {
  const cx = bx + Math.floor(bw / 2);
  const cy = by + Math.floor(bh / 2);
  ring(cx, cy, 46, 5, TEAL);
  // Latitude lines clipped to the disc by drawing short chords.
  hline(cx - 40, cx + 40, cy - 20, TEAL);
  hline(cx - 44, cx + 44, cy, TEAL);
  hline(cx - 40, cx + 40, cy + 20, TEAL);
  drawLine(cx, cy - 44, cx, cy + 44, TEAL, 3);
  // The crack: a jagged red bolt across the globe.
  drawLine(cx - 34, cy - 30, cx - 12, cy - 8, CRIMSON, 5);
  drawLine(cx - 12, cy - 8, cx - 26, cy + 8, CRIMSON, 5);
  drawLine(cx - 26, cy + 8, cx + 2, cy + 22, CRIMSON, 5);
  drawLine(cx + 2, cy + 22, cx + 30, cy + 34, CRIMSON, 5);
  // A small broken shard drifting off the disc.
  fillTriangle(cx + 40, cy - 34, cx + 58, cy - 22, cx + 44, cy - 8, CRIMSON);
}

// 2. Warship: a hull listing in the waves under a burst of fire.
function artShip(bx: number, by: number, bw: number, bh: number): void {
  const cx = bx + Math.floor(bw / 2);
  const cy = by + Math.floor(bh / 2);
  // Explosion starburst above the mast.
  const ex = cx + 30;
  const ey = cy - 34;
  fillCircle(ex, ey, 15, FLAME_OUT);
  fillCircle(ex, ey, 9, FLAME_MID);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    drawLine(
      ex + Math.round(Math.cos(a) * 14),
      ey + Math.round(Math.sin(a) * 14),
      ex + Math.round(Math.cos(a) * 26),
      ey + Math.round(Math.sin(a) * 26),
      FLAME_OUT,
      3,
    );
  }
  // Smoke puffs.
  fillCircle(cx - 58, cy - 30, 10, SMOKE);
  fillCircle(cx - 44, cy - 40, 8, SMOKE);
  // Mast and hull, listing to starboard.
  drawLine(cx - 6, cy + 6, cx - 2, cy - 30, DARK, 4);
  fillTriangle(cx - 62, cy + 6, cx + 48, cy + 6, cx + 34, cy + 34, DARK);
  fillTriangle(cx - 62, cy + 6, cx + 34, cy + 34, cx - 48, cy + 34, DARK);
  fillRect(cx - 52, cy + 10, 84, 5, GOLD);
  // Waves.
  for (let i = 0; i < 3; i++) {
    const wy = cy + 44 + i * 10;
    drawLine(bx + 24 + i * 18, wy, bx + 130 + i * 18, wy, SEA, 4);
    drawLine(bx + 190 + i * 14, wy, bx + 300 + i * 14, wy, SEA, 4);
  }
}

// 3. Nvidia: three rising bars under a steep green arrow.
function artChart(bx: number, by: number, bw: number, bh: number): void {
  const base = by + bh - 22;
  const left = bx + 40;
  // Axes.
  drawLine(left, by + 16, left, base, INK, 3);
  drawLine(left, base, bx + bw - 30, base, INK, 3);
  // Bars, each taller than the last.
  const bars: Array<[number, number, RGB]> = [
    [left + 22, 26, GREEN],
    [left + 82, 46, GREEN],
    [left + 142, 66, GREEN],
  ];
  for (const [bx0, bh0, col] of bars) {
    fillRect(bx0, base - bh0, 44, bh0, col);
  }
  // Arrow climbing over the bars.
  drawLine(left + 30, base - 34, left + 104, base - 54, GREEN, 5);
  drawLine(left + 104, base - 54, left + 178, base - 84, GREEN, 5);
  fillTriangle(left + 178, base - 84, left + 152, base - 82, left + 172, base - 62, GREEN);
  // A small chip square riding the arrow tip.
  fillRect(left + 182, base - 96, 20, 20, NAVY);
  fillRect(left + 186, base - 92, 12, 12, GOLD);
}

// 4. Indonesia fire: a factory front with flames over its roof.
function artFire(bx: number, by: number, bw: number, bh: number): void {
  const cx = bx + Math.floor(bw / 2);
  const base = by + bh - 18;
  // Factory block with a sawtooth roof.
  fillRect(cx - 84, base - 44, 168, 44, DARK);
  fillTriangle(cx - 84, base - 44, cx - 56, base - 66, cx - 28, base - 44, DARK);
  fillTriangle(cx - 28, base - 44, cx, base - 66, cx + 28, base - 44, DARK);
  fillTriangle(cx + 28, base - 44, cx + 56, base - 66, cx + 84, base - 44, DARK);
  // Windows glowing from the fire inside.
  fillRect(cx - 66, base - 32, 18, 18, FLAME_MID);
  fillRect(cx - 9, base - 32, 18, 18, FLAME_MID);
  fillRect(cx + 48, base - 32, 18, 18, FLAME_MID);
  // Flames licking out of the roof.
  fillTriangle(cx - 52, base - 56, cx - 30, base - 96, cx - 8, base - 56, FLAME_OUT);
  fillTriangle(cx - 8, base - 56, cx + 14, base - 104, cx + 36, base - 56, FLAME_OUT);
  fillTriangle(cx + 36, base - 56, cx + 52, base - 88, cx + 66, base - 56, FLAME_OUT);
  fillTriangle(cx - 22, base - 56, cx - 6, base - 82, cx + 10, base - 56, FLAME_IN);
  fillTriangle(cx + 12, base - 56, cx + 24, base - 80, cx + 38, base - 56, FLAME_IN);
  // Smoke rising.
  fillCircle(cx - 74, base - 78, 9, SMOKE);
  fillCircle(cx + 78, base - 84, 8, SMOKE);
}

// 5. Tennis: a big ball with its curved seams, next to a small trophy.
function artTennis(bx: number, by: number, bw: number, bh: number): void {
  const cy = by + Math.floor(bh / 2);
  const cx = bx + bw - 130;
  // Trophy on the left of the ball.
  const tx = bx + 70;
  fillRect(tx - 16, cy - 34, 32, 30, GOLD);
  fillTriangle(tx - 16, cy - 4, tx + 16, cy - 4, tx, cy + 14, GOLD);
  fillRect(tx - 12, cy + 14, 24, 6, GOLD);
  fillRect(tx - 20, cy + 20, 40, 8, GOLD);
  drawLine(tx - 16, cy - 30, tx - 30, cy - 18, GOLD, 4);
  drawLine(tx + 16, cy - 30, tx + 30, cy - 18, GOLD, 4);
  // The ball: dark outline, green-yellow fill, white curved seams.
  fillCircle(cx, cy, 48, INK);
  fillCircle(cx, cy, 44, BALL);
  // Curved seams: two arcs drawn as short chord segments.
  for (let k = -3; k <= 3; k++) {
    const yy = cy + k * 12;
    const span = Math.floor(Math.sqrt(48 * 48 - (k * 12) * (k * 12)));
    const off = Math.round(14 * Math.cos((k * Math.PI) / 7));
    setPixel(cx - span + off, yy, WHITE);
    hline(cx - span + off, cx - span + off + 10, yy, WHITE);
    hline(cx + span - off - 10, cx + span - off, yy, WHITE);
  }
}

// ------------------------------------------------------------------ page
// Masthead: navy band, the date in huge capitals, one gold rule.
fillRect(0, 0, W, 148, NAVY);
drawTextCentered(0, 26, W, "24 NOVEMBER 2026", 7, WHITE);
drawTextCentered(0, 96, W, "TUESDAY - THE WORLD IN ONE IMAGE", 2, GOLD);
fillRect(0, 144, W, 4, GOLD);

const GX = 12; // outer margin
const GW = 12; // gutter
const PW = Math.floor((W - GX * 2 - GW) / 2); // 494
const PX2 = GX + PW + GW;

drawPanel(GX, 160, PW, 326, {
  tag: "CLIMATE",
  accent: TEAL,
  band: TEAL_SOFT,
  headline: ["COP31 TALKS COLLAPSE", "NO DEAL ON FOSSIL FUELS"],
  summary: "UN CLIMATE SUMMIT IN TURKEY ENDS WITHOUT AGREEMENT.",
  art: artGlobe,
});

drawPanel(PX2, 160, PW, 326, {
  tag: "WAR AT SEA",
  accent: CRIMSON,
  band: CRIMSON_SOFT,
  headline: ["RUSSIAN WARSHIP SUNK", "AT BENGHAZI PORT"],
  summary:
    "DRONE STRIKE SINKS SHIP IN LIBYA PORT. WAR SPREADS FAR BEYOND UKRAINE. ALSO: CARGO SHIP HIT IN GULF OF FINLAND.",
  art: artShip,
});

drawPanel(GX, 498, PW, 326, {
  tag: "MARKETS",
  accent: GREEN,
  band: GREEN_SOFT,
  headline: ["HUANG BACK AS NVIDIA CEO", "TRUMP PUSHED FOR RETURN"],
  summary: "US MARKETS SOAR. NVIDIA VALUE UP ABOUT 1 TRILLION.",
  art: artChart,
});

drawPanel(PX2, 498, PW, 326, {
  tag: "INDONESIA",
  accent: EMBER,
  band: EMBER_SOFT,
  headline: ["FACTORY FIRE KILLS 24", "CANDY PLANT BLAZE"],
  summary: "AT LEAST 24 DEAD. RESCUERS SEARCH FOR MISSING WORKERS.",
  art: artFire,
});

// Bottom strip: sport, full width, ball and trophy on the right.
{
  const x = GX;
  const y = 836;
  const w = W - GX * 2;
  const h = 176;
  fillRect(x, y, w, h, WHITE);
  fillRect(x, y, w, 2, INK);
  fillRect(x, y + h - 2, w, 2, INK);
  fillRect(x, y, 2, h, INK);
  fillRect(x + w - 2, y, 2, h, INK);
  fillRect(x + 2, y + 2, w - 4, 36, PURPLE);
  drawText(x + 18, y + 12, "SPORT", 2, WHITE);
  drawText(x + 18, y + 62, "ALCARAZ WINS ATP FINALS", 4, INK);
  drawText(x + 18, y + 104, "MAIDEN TITLE IN TURIN. BEATS ZVEREV IN THE FINAL.", 2, INK);
  fillRect(x + 18, y + 134, 64, 4, GOLD);
  // Ball + trophy art, right-hand side.
  const bandX = x + 640;
  fillRect(bandX, y + 40, w - 640 - 2, h - 42, PURPLE_SOFT);
  artTennis(bandX, y + 40, w - 640 - 2, h - 42);
}

// ------------------------------------------------------------ PNG encode
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const png = encodePng();

// Output directory: created if missing, never deleted or emptied.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), png);
console.log(`wrote ${join(outDir, "entry.png")} (${png.length} bytes, ${W}x${H})`);
