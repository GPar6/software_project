const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const levelEl = document.querySelector("#level");
const bestScoreEl = document.querySelector("#bestScore");
const comboEl = document.querySelector("#combo");
const statusEl = document.querySelector("#status");
const startOverlay = document.querySelector("#startOverlay");
const resultOverlay = document.querySelector("#resultOverlay");
const resultEyebrow = document.querySelector("#resultEyebrow");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");
const nextLevelButton = document.querySelector("#nextLevelButton");
const nextPreview = document.querySelector("#nextPreview");
const pauseOverlay = document.querySelector("#pauseOverlay");

const COLORS = {
  red: "#ff5f70", blue: "#58a6ff", yellow: "#ffd84e", green: "#5ee28a", purple: "#bd7aff"
};
const PATTERNS = Object.keys(COLORS);
const BALL_RADIUS = 18;
const PATH_Y = 255;
const START_X = 115;
const END_X = 980;
const SHOOTER = { x: 550, y: 520 };
const LEVELS = [
  { id: "classic-01", speed: 8, patterns: ["red", "blue", "yellow"], balls: ["red", "blue", "blue", "yellow", "red", "yellow"] },
  { id: "classic-02", speed: 14, patterns: ["red", "blue", "yellow", "green"], balls: ["green", "red", "yellow", "blue", "blue", "green", "red", "yellow"] }
];
const BEST_SCORE_KEY = "hot-zuma-best-score";
let levelIndex = 0;

let state;
let lastTime = 0;
let rafId = 0;

function randomPattern(pool = PATTERNS) { return pool[Math.floor(Math.random() * pool.length)]; }
function makeBall(pattern) { return { pattern, x: 0 }; }

function resetGame() {
  const level = LEVELS[levelIndex];
  state = {
    status: "READY",
    score: 0,
    combo: 1,
    chainOffset: 0,
    chainSpeed: level.speed,
    levelId: level.id,
    patterns: level.patterns,
    balls: level.balls.map(makeBall),
    projectile: null,
    aimAngle: -Math.PI / 2,
    currentPattern: randomPattern(level.patterns),
    nextPattern: randomPattern(level.patterns),
    lastMatchAt: 0
  };
  state.balls.forEach((ball, index) => { ball.x = index * BALL_RADIUS * 2.05; });
  levelEl.textContent = String(levelIndex + 1).padStart(2, "0");
  bestScoreEl.textContent = localStorage.getItem(BEST_SCORE_KEY) || "0";
  pauseOverlay.classList.add("hidden");
  updateHud();
  draw();
}

function startGame() {
  resetGame();
  state.status = "PLAYING";
  startOverlay.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  pauseOverlay.classList.add("hidden");
  statusEl.textContent = "进行中";
  lastTime = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function loop(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;
  if (state.status === "PLAYING") update(delta);
  draw();
  rafId = requestAnimationFrame(loop);
}

function update(delta) {
  if (state.lastMatchAt && performance.now() - state.lastMatchAt > 3000 && state.combo !== 1) {
    state.combo = 1;
    updateHud();
  }
  state.chainOffset += state.chainSpeed * delta;
  if (state.chainOffset > 330) state.chainOffset = 330;
  const lastBall = state.balls[state.balls.length - 1];
  if (lastBall && getBallX(lastBall) > END_X) finish(false);

  const shot = state.projectile;
  if (!shot) return;
  shot.x += Math.cos(shot.angle) * shot.speed * delta;
  shot.y += Math.sin(shot.angle) * shot.speed * delta;
  if (shot.x < 0 || shot.x > canvas.width || shot.y < 0 || shot.y > canvas.height) {
    state.projectile = null;
    return;
  }
  for (let i = 0; i < state.balls.length; i++) {
    const ball = state.balls[i];
    const dx = shot.x - getBallX(ball);
    const dy = shot.y - PATH_Y;
    if (Math.hypot(dx, dy) < BALL_RADIUS * 2.1) {
      insertBall(i, shot.pattern);
      state.projectile = null;
      resolveMatches(i);
      return;
    }
  }
  if (Math.abs(shot.y - PATH_Y) < 18 && shot.x > START_X && shot.x < END_X) {
    const index = state.balls.findIndex(ball => shot.x < getBallX(ball));
    const insertAt = index === -1 ? state.balls.length : index;
    insertBall(insertAt, shot.pattern);
    state.projectile = null;
    resolveMatches(insertAt);
  }
}

function getBallX(ball) { return START_X + ball.x + state.chainOffset; }

function insertBall(index, pattern) {
  state.balls.splice(index, 0, makeBall(pattern));
  for (let i = 0; i < state.balls.length; i++) state.balls[i].x = i * BALL_RADIUS * 2.05;
}

function resolveMatches(index) {
  const target = state.balls[index];
  if (!target) return;
  let start = index;
  let end = index;
  while (start > 0 && state.balls[start - 1].pattern === target.pattern) start--;
  while (end < state.balls.length - 1 && state.balls[end + 1].pattern === target.pattern) end++;
  const count = end - start + 1;
  if (count < 3) return;
  state.balls.splice(start, count);
  state.score += (30 + Math.max(0, count - 3) * 10) * state.combo;
  state.combo = Math.min(5, state.combo + 1);
  state.lastMatchAt = performance.now();
  for (let i = 0; i < state.balls.length; i++) state.balls[i].x = i * BALL_RADIUS * 2.05;
  if (state.balls.length === 0) {
    finish(true);
    return;
  }
  // 消除后，原来分隔两段的球可能连成新的三连，继续判定连锁。
  const nextIndex = Math.min(start, state.balls.length - 1);
  if (state.balls[nextIndex]) resolveMatches(nextIndex);
  updateHud();
}

function shoot() {
  if (state.status !== "PLAYING" || state.projectile) return;
  state.projectile = { x: SHOOTER.x, y: SHOOTER.y, angle: state.aimAngle, speed: 680, pattern: state.currentPattern };
  state.currentPattern = state.nextPattern;
  state.nextPattern = randomPattern(state.patterns);
  updatePreview();
}

function finish(success) {
  if (state.status !== "PLAYING") return;
  state.status = success ? "SUCCESS" : "FAILED";
  const best = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
  if (state.score > best) localStorage.setItem(BEST_SCORE_KEY, String(state.score));
  statusEl.textContent = success ? "通关" : "失败";
  resultEyebrow.textContent = success ? "LEVEL COMPLETE" : "GAME OVER";
  resultTitle.textContent = success ? "漂亮！全部消除" : "球链抵达终点";
  resultText.textContent = `本局得分：${state.score}`;
  const hasNextLevel = success && levelIndex < LEVELS.length - 1;
  nextLevelButton.classList.toggle("hidden", !hasNextLevel);
  nextLevelButton.textContent = `进入第 ${levelIndex + 2} 关`;
  document.querySelector("#restartButton").textContent = hasNextLevel ? "重玩本关" : "重新开始";
  resultOverlay.classList.remove("hidden");
  updateHud();
}

function updateHud() {
  if (!state) return;
  scoreEl.textContent = state.score;
  bestScoreEl.textContent = localStorage.getItem(BEST_SCORE_KEY) || "0";
  comboEl.textContent = `×${state.combo}`;
  updatePreview();
}

function updatePreview() {
  if (!state) return;
  nextPreview.className = `ball-preview ${state.nextPattern}`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawTrack();
  if (!state) return;
  state.balls.forEach(drawBall);
  if (state.projectile) drawCircle(state.projectile.x, state.projectile.y, state.projectile.pattern, BALL_RADIUS);
  drawShooter();
  drawAimLine();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#2b2f52"); gradient.addColorStop(1, "#15182a");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff0b";
  for (let x = 30; x < canvas.width; x += 45) for (let y = 30; y < canvas.height; y += 45) ctx.fillRect(x, y, 2, 2);
}

function drawTrack() {
  ctx.save(); ctx.lineCap = "round";
  ctx.strokeStyle = "#0a0c16aa"; ctx.lineWidth = 68;
  ctx.beginPath(); ctx.moveTo(70, PATH_Y); ctx.lineTo(1030, PATH_Y); ctx.stroke();
  ctx.strokeStyle = "#555b7d"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(70, PATH_Y); ctx.lineTo(1030, PATH_Y); ctx.stroke();
  ctx.fillStyle = "#ff6070"; ctx.beginPath(); ctx.arc(END_X, PATH_Y, 11, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBall(ball) { drawCircle(getBallX(ball), PATH_Y, ball.pattern, BALL_RADIUS); }

function drawCircle(x, y, pattern, radius) {
  ctx.save();
  ctx.shadowColor = "#0009"; ctx.shadowBlur = 9; ctx.shadowOffsetY = 4;
  ctx.fillStyle = COLORS[pattern]; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.fillStyle = "#ffffff66"; ctx.beginPath(); ctx.arc(x - 6, y - 7, radius * .28, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

function drawShooter() {
  ctx.save(); ctx.translate(SHOOTER.x, SHOOTER.y); ctx.rotate(state.aimAngle);
  ctx.fillStyle = "#e9ecff"; ctx.fillRect(-14, -13, 72, 26);
  ctx.fillStyle = "#747cae"; ctx.fillRect(35, -18, 26, 36);
  ctx.restore();
  drawCircle(SHOOTER.x, SHOOTER.y, state.currentPattern, BALL_RADIUS);
}

function drawAimLine() {
  if (state.status !== "PLAYING") return;
  ctx.save(); ctx.strokeStyle = "#ffffff33"; ctx.setLineDash([8, 10]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(SHOOTER.x, SHOOTER.y); ctx.lineTo(SHOOTER.x + Math.cos(state.aimAngle) * 500, SHOOTER.y + Math.sin(state.aimAngle) * 500); ctx.stroke(); ctx.restore();
}

canvas.addEventListener("pointermove", event => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * canvas.width / rect.width;
  const y = (event.clientY - rect.top) * canvas.height / rect.height;
  state.aimAngle = Math.atan2(y - SHOOTER.y, x - SHOOTER.x);
});
canvas.addEventListener("pointerdown", shoot);
document.querySelector("#startButton").addEventListener("click", startGame);
document.querySelector("#restartButton").addEventListener("click", startGame);
nextLevelButton.addEventListener("click", () => {
  if (levelIndex >= LEVELS.length - 1) return;
  levelIndex += 1;
  startGame();
});
document.querySelector("#pauseButton").addEventListener("click", () => {
  if (!state || state.status === "READY" || state.status === "SUCCESS" || state.status === "FAILED") return;
  state.status = state.status === "PAUSED" ? "PLAYING" : "PAUSED";
  statusEl.textContent = state.status === "PAUSED" ? "已暂停" : "进行中";
  pauseOverlay.classList.toggle("hidden", state.status !== "PAUSED");
});
document.querySelector("#resumeButton").addEventListener("click", () => {
  if (!state || state.status !== "PAUSED") return;
  state.status = "PLAYING";
  statusEl.textContent = "进行中";
  pauseOverlay.classList.add("hidden");
});
document.addEventListener("keydown", event => {
  if (event.code === "Space") { event.preventDefault(); shoot(); }
  if (event.key.toLowerCase() === "p") document.querySelector("#pauseButton").click();
});

resetGame();
