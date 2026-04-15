const canvas = document.getElementById("visual");
const ctx = canvas.getContext("2d");
const fileInput = document.getElementById("fileInput");
const playBtn = document.getElementById("playBtn");
const resetBtn = document.getElementById("resetBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const speedInput = document.getElementById("speed");
const smoothingInput = document.getElementById("smoothing");
const statusEl = document.getElementById("status");

let data = [];
let normalized = [];
let time = [];
let idx = 0;
let playing = false;
let lastTimestamp = 0;
let duration = 0;
let smoothFactor = parseFloat(smoothingInput.value);

const COLORS = {
  background: "#07090f",
  text: "#e6ecff",
  muted: "#9aa4c7",
  base: "#3a2f22",
  moss: "#1f3a2a",
  neon: "#7ef9ff",
  ember: "#ff6b4a",
  void: "#f3f7ff"
};

const ORBS = Array.from({ length: 24 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: 0.05 + Math.random() * 0.18,
  speed: 0.08 + Math.random() * 0.22,
  phase: Math.random() * Math.PI * 2
}));

const resizeCanvas = () => {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
};

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headerLine = lines.find((line) => !line.startsWith("#"));
  if (!headerLine) return [];
  const headers = headerLine.split(",").map((h) => h.trim());
  const headerIndex = (name) => headers.indexOf(name);
  const idxTime = headerIndex("time_sec");
  const idxAlpha = headerIndex("alpha_rms");
  const idxTheta = headerIndex("theta_rms");
  const idxBeta = headerIndex("beta_rms");
  const idxGamma = headerIndex("gamma_rms");

  const rows = [];
  for (const line of lines) {
    if (line.startsWith("#") || line === headerLine) continue;
    const parts = line.split(",");
    if (parts.length !== headers.length) continue;
    const t = parseFloat(parts[idxTime]);
    const alpha = parseFloat(parts[idxAlpha]);
    const theta = parseFloat(parts[idxTheta]);
    const beta = parseFloat(parts[idxBeta]);
    const gamma = parseFloat(parts[idxGamma]);
    if ([t, alpha, theta, beta, gamma].some((v) => Number.isNaN(v))) continue;
    const calmness = (alpha + theta) / Math.max(0.0001, beta + gamma);
    rows.push({ t, calmness, alpha, theta, beta, gamma });
  }
  return rows;
};

const normalize = (rows) => {
  const values = rows.map((r) => r.calmness);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return rows.map((r) => (r.calmness - min) / span);
};

const smoothSeries = (series, factor) => {
  if (series.length === 0) return [];
  const out = [series[0]];
  for (let i = 1; i < series.length; i++) {
    out[i] = out[i - 1] * factor + series[i] * (1 - factor);
  }
  return out;
};

const setStatus = (text) => {
  statusEl.textContent = text;
};

const lerp = (a, b, t) => a + (b - a) * t;

const hexToRgb = (hex) => {
  const value = hex.replace("#", "");
  const bigint = parseInt(value, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
};

const mixColor = (a, b, t) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${Math.round(lerp(ca.r, cb.r, t))}, ${Math.round(lerp(ca.g, cb.g, t))}, ${Math.round(lerp(ca.b, cb.b, t))})`;
};

const getMoodPalette = (value) => {
  if (value < 0.33) {
    return [COLORS.base, COLORS.ember, COLORS.moss];
  }
  if (value < 0.66) {
    return [COLORS.moss, COLORS.neon, COLORS.base];
  }
  return [COLORS.neon, COLORS.void, COLORS.moss];
};

const draw = (currentIndex, timestamp = 0) => {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, w, h);

  if (normalized.length === 0) return;

  const currentValue = normalized[currentIndex] ?? normalized[normalized.length - 1];
  const [c1, c2, c3] = getMoodPalette(currentValue);
  const pulse = 0.5 + Math.sin(timestamp * 0.001) * 0.08;

  const bgGradient = ctx.createRadialGradient(w * 0.5, h * 0.45, 80, w * 0.5, h * 0.45, Math.max(w, h) * 0.7);
  bgGradient.addColorStop(0, mixColor(c1, c2, pulse));
  bgGradient.addColorStop(0.55, mixColor(c2, c3, 0.5));
  bgGradient.addColorStop(1, COLORS.background);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, w, h);

  ORBS.forEach((orb, i) => {
    const phase = orb.phase + timestamp * 0.0002 * orb.speed;
    const ox = (orb.x + Math.sin(phase + i) * 0.08) * w;
    const oy = (orb.y + Math.cos(phase * 1.3) * 0.1) * h;
    const radius = orb.r * Math.min(w, h) * (0.6 + currentValue * 0.8);
    const color = i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3;
    const orbGradient = ctx.createRadialGradient(ox, oy, radius * 0.1, ox, oy, radius);
    orbGradient.addColorStop(0, mixColor(color, COLORS.void, 0.2));
    orbGradient.addColorStop(1, "rgba(7, 9, 15, 0)");
    ctx.fillStyle = orbGradient;
    ctx.beginPath();
    ctx.arc(ox, oy, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  const veil = ctx.createLinearGradient(0, 0, w, h);
  veil.addColorStop(0, "rgba(7, 9, 15, 0.65)");
  veil.addColorStop(0.5, "rgba(7, 9, 15, 0.2)");
  veil.addColorStop(1, "rgba(7, 9, 15, 0.7)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = COLORS.text;
  ctx.font = "14px Inter, sans-serif";
  ctx.fillText(`Estado mental: ${(currentValue * 100).toFixed(1)}%`, 24, 32);

  const t = time[currentIndex] ?? time[time.length - 1];
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`Tiempo: ${t.toFixed(1)}s`, 24, h - 20);
};

const animate = (timestamp) => {
  if (!playing) return;
  if (!lastTimestamp) lastTimestamp = timestamp;
  const delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  const speed = parseFloat(speedInput.value);
  const step = delta * speed;

  if (time.length > 1) {
    const targetTime = (time[idx] ?? 0) + step;
    while (idx < time.length - 1 && time[idx] < targetTime) {
      idx++;
    }
    if (idx >= time.length - 1) {
      idx = time.length - 1;
      playing = false;
      playBtn.textContent = "▶ Reproducir";
    }
  }

  draw(idx, timestamp);
  requestAnimationFrame(animate);
};

const loadData = (rows) => {
  data = rows;
  time = rows.map((r) => r.t);
  duration = time[time.length - 1] ?? 0;
  const normalizedRaw = normalize(rows);
  smoothFactor = parseFloat(smoothingInput.value);
  normalized = smoothSeries(normalizedRaw, smoothFactor);
  idx = 0;
  lastTimestamp = 0;
  setStatus(`listo (${duration.toFixed(1)}s)`);
  draw(idx);
};

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCSV(reader.result);
    if (!rows.length) {
      setStatus("error: CSV inválido");
      return;
    }
    loadData(rows);
  };
  reader.readAsText(file);
});

playBtn.addEventListener("click", () => {
  if (!data.length) return;
  playing = !playing;
  playBtn.textContent = playing ? "⏸ Pausar" : "▶ Reproducir";
  if (playing) {
    lastTimestamp = 0;
    requestAnimationFrame(animate);
  }
});

resetBtn.addEventListener("click", () => {
  idx = 0;
  playing = false;
  playBtn.textContent = "▶ Reproducir";
  draw(idx);
});

fullscreenBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    canvas.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

smoothingInput.addEventListener("input", () => {
  if (!data.length) return;
  const normalizedRaw = normalize(data);
  normalized = smoothSeries(normalizedRaw, parseFloat(smoothingInput.value));
  draw(idx);
});

speedInput.addEventListener("input", () => {
  if (data.length) setStatus(`listo (${duration.toFixed(1)}s)`);
});

// Primer render
setStatus("sin datos");
draw(0);
