const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const comboEl = document.querySelector("#combo");
const statusEl = document.querySelector("#status");
const startOverlay = document.querySelector("#startOverlay");
const resultOverlay = document.querySelector("#resultOverlay");
const resultEyebrow = document.querySelector("#resultEyebrow");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");
const nextPreview = document.querySelector("#nextPreview");

const COLORS = {
  red: "#ff5f70", blue: "#58a6ff", yellow: "#ffd84e", green: "#5ee28a", purple: "#bd7aff"
};
const PATTERNS = Object.keys(COLORS);
const BALL_RADIUS = 18;
const PATH_Y = 255;
const START_X = 115;
const END_X = 980;
const SHOOTER = { x: 550, y: 520 };

let state;
let lastTime = 0;
let rafId = 0;

function randomPattern() { return PATTERNS[Math.floor(Math.random() * PATTERNS.length)]; }
function makeBall(pattern) { return { pattern, x: 0 }; }

function resetGame() {
  state = {
    status: "READY",
    score: 0,
    combo: 1,
    chainOffset: 0,
    chainSpeed: 20,
    balls: ["red", "blue", "blue", "green", "yellow", "purple", "purple", "red", "green", "yellow"].map(makeBall),
    projectile: null,
    aimAngle: -Math.PI / 2,
    currentPattern: randomPattern(),
    nextPattern: randomPattern(),
    lastMatchAt: 0
  };
  updateHud();
  draw();
}

function startGame() {
  resetGame();
  state.status = "PLAYING";
  startOverlay.classList.add("hidden");
  resultOverlay.classList.add("hidden");
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
  state.chainOffset += state.chainSpeed * delta;
  if (state.chainOffset > 330) state.chainOffset = 330;
  if (state.balls.length && getBallX(state.balls[0]) < 92) finish(false);

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
  if (state.balls.length === 0) finish(true);
  updateHud();
}

function shoot() {
  if (state.status !== "PLAYING" || state.projectile) return;
  state.projectile = { x: SHOOTER.x, y: SHOOTER.y, angle: state.aimAngle, speed: 680, pattern: state.currentPattern };
  state.currentPattern = state.nextPattern;
  state.nextPattern = randomPattern();
  updatePreview();
}

function finish(success) {
  if (state.status !== "PLAYING") return;
  state.status = success ? "SUCCESS" : "FAILED";
  statusEl.textContent = success ? "通关" : "失败";
  resultEyebrow.textContent = success ? "LEVEL COMPLETE" : "GAME OVER";
  resultTitle.textContent = success ? "漂亮！全部消除" : "球链抵达终点";
  resultText.textContent = `本局得分：${state.score}`;
  resultOverlay.classList.remove("hidden");
  updateHud();
}

function updateHud() {
  if (!state) return;
  scoreEl.textContent = state.score;
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
  ctx.fillStyle = "#ff6070"; ctx.beginPath(); ctx.arc(70, PATH_Y, 11, 0, Math.PI * 2); ctx.fill();
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
document.querySelector("#pauseButton").addEventListener("click", () => {
  if (!state || state.status === "READY" || state.status === "SUCCESS" || state.status === "FAILED") return;
  state.status = state.status === "PAUSED" ? "PLAYING" : "PAUSED";
  statusEl.textContent = state.status === "PAUSED" ? "已暂停" : "进行中";
});

resetGame();
