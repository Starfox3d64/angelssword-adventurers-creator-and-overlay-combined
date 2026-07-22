(function () {
  "use strict";
  var COLS = 10, ROWS = 20, BLOCK = 24;
  var SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]]
  };
  var NAMES = Object.keys(SHAPES);
  var DIFF = {
    easy:   { name: "Easy",   base: 700, step: 40, min: 280, scoreMul: 0.75 },
    normal: { name: "Normal", base: 550, step: 50, min: 120, scoreMul: 1 },
    hard:   { name: "Hard",   base: 380, step: 45, min: 70,  scoreMul: 1.35 },
    insane: { name: "Insane", base: 220, step: 30, min: 40,  scoreMul: 1.8 }
  };
  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var nextCanvas = document.getElementById("next");
  var holdCanvas = document.getElementById("hold");
  var nextCtx = nextCanvas ? nextCanvas.getContext("2d") : null;
  var holdCtx = holdCanvas ? holdCanvas.getContext("2d") : null;
  var board, bag, cur, next, hold, holdLocked, cx, cy;
  var score, lines, level, dropMs, timer, running, paused, gameOver;
  var difficulty = localStorage.getItem("as_tetris_diff") || "normal";
  var highScore = parseInt(localStorage.getItem("as_tetris_hi") || "0", 10) || 0;
  var ghostOn = localStorage.getItem("as_tetris_ghost") !== "0";
  var sfxOn = localStorage.getItem("as_tetris_sfx") !== "0";
  function beep(freq, dur) {
    if (!sfxOn) return;
    try {
      var ctx = window.__asAudioCtx || (window.__asAudioCtx = new (window.AudioContext || window.webkitAudioContext)());
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.frequency.value = freq;
      o.type = "square";
      g.gain.value = 0.04;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.05));
      o.stop(ctx.currentTime + (dur || 0.06));
    } catch (e) {}
  }

  function themeColors() {
    var s = getComputedStyle(document.documentElement);
    var out = [];
    for (var i = 1; i <= 7; i++) {
      out.push((s.getPropertyValue("--as-tetris-" + i) || "").trim() || "#888");
    }
    return out;
  }
  function emptyBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) {
      b[r] = [];
      for (var c = 0; c < COLS; c++) b[r][c] = 0;
    }
    return b;
  }
  function refillBag() {
    var a = NAMES.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    bag = bag.concat(a);
  }
  function takePiece() {
    if (bag.length < 3) refillBag();
    var name = bag.shift();
    return {
      name: name,
      type: NAMES.indexOf(name) + 1,
      shape: SHAPES[name].map(function (row) { return row.slice(); })
    };
  }
  function collide(px, py, sh) {
    for (var r = 0; r < sh.length; r++) {
      for (var c = 0; c < sh[r].length; c++) {
        if (!sh[r][c]) continue;
        var ny = py + r, nx = px + c;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }
  function merge() {
    var sh = cur.shape;
    for (var r = 0; r < sh.length; r++) {
      for (var c = 0; c < sh[r].length; c++) {
        if (sh[r][c] && cy + r >= 0) board[cy + r][cx + c] = cur.type;
      }
    }
  }
  function clearLines() {
    var cleared = 0;
    for (var r = ROWS - 1; r >= 0; r--) {
      var full = true;
      for (var c = 0; c < COLS; c++) if (!board[r][c]) { full = false; break; }
      if (full) {
        board.splice(r, 1);
        board.unshift([]);
        for (var c2 = 0; c2 < COLS; c2++) board[0][c2] = 0;
        cleared++;
        r++;
      }
    }
    if (cleared) {
      beep(200 + cleared * 120, 0.08);
      var pts = [0, 100, 300, 500, 800][cleared] || 800;
      var d = DIFF[difficulty] || DIFF.normal;
      score += Math.round(pts * level * d.scoreMul);
      lines += cleared;
      level = 1 + Math.floor(lines / 10);
      dropMs = Math.max(d.min, d.base - (level - 1) * d.step);
      // manual speed override
      var speedEl = document.getElementById("speed");
      if (speedEl && speedEl.dataset.manual === "1") {
        var manual = parseInt(speedEl.value, 10);
        if (!isNaN(manual) && manual > 0) dropMs = manual;
      }
      resetTimer();
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("as_tetris_hi", String(highScore));
      }
    }
  }
  function spawn() {
    cur = next || takePiece();
    next = takePiece();
    holdLocked = false;
    cx = 3;
    cy = 0;
    if (cur.name === "I") cy = -1;
    if (collide(cx, cy, cur.shape)) {
      running = false;
      gameOver = true;
      clearInterval(timer);
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("as_tetris_hi", String(highScore));
      }
    }
    drawNext();
    drawHold();
    updateHUD();
  }
  function rotate() {
    var sh = cur.shape;
    var N = sh.length;
    var rot = [];
    for (var r = 0; r < N; r++) {
      rot[r] = [];
      for (var c = 0; c < N; c++) rot[r][c] = sh[N - 1 - c][r];
    }
    // wall kicks
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!collide(cx + kicks[i], cy, rot)) {
        cur.shape = rot;
        cx += kicks[i];
        return;
      }
    }
  }
  function ghostY() {
    var y = cy;
    while (!collide(cx, y + 1, cur.shape)) y++;
    return y;
  }
  function softDrop() {
    if (!running || paused || gameOver) return;
    if (!collide(cx, cy + 1, cur.shape)) {
      cy++;
      score += 1;
      draw();
    } else {
      merge();
      beep(90, 0.03);
      clearLines();
      spawn();
      draw();
    }
  }
  function hardDrop() {
    if (!running || paused || gameOver) return;
    var dist = 0;
    while (!collide(cx, cy + 1, cur.shape)) { cy++; dist++; }
    score += dist * 2;
    merge();
    beep(90, 0.03);
    clearLines();
    spawn();
    draw();
  }
  function doHold() {
    if (!running || paused || gameOver || holdLocked) return;
    holdLocked = true;
    if (!hold) {
      hold = cur;
      spawn();
    } else {
      var t = hold;
      hold = cur;
      cur = t;
      cx = 3; cy = 0;
      if (cur.name === "I") cy = -1;
      if (collide(cx, cy, cur.shape)) {
        // swap back if can't place
        var t2 = hold; hold = cur; cur = t2;
      }
    }
    drawHold();
    draw();
  }
  function drawCell(x, y, color, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    for (var g = 0; g <= COLS; g++) {
      ctx.beginPath(); ctx.moveTo(g * BLOCK, 0); ctx.lineTo(g * BLOCK, ROWS * BLOCK); ctx.stroke();
    }
    for (var g2 = 0; g2 <= ROWS; g2++) {
      ctx.beginPath(); ctx.moveTo(0, g2 * BLOCK); ctx.lineTo(COLS * BLOCK, g2 * BLOCK); ctx.stroke();
    }
    var cols = themeColors();
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c]) drawCell(c, r, cols[board[r][c] - 1] || "#888");
      }
    }
    if (cur && running) {
      // ghost
      if (ghostOn) {
        var gy = ghostY();
        var shg = cur.shape;
        for (var r2 = 0; r2 < shg.length; r2++) {
          for (var c2 = 0; c2 < shg[r2].length; c2++) {
            if (shg[r2][c2] && gy + r2 >= 0) {
              drawCell(cx + c2, gy + r2, cols[cur.type - 1] || "#888", 0.22);
            }
          }
        }
      }
      var sh = cur.shape;
      for (var r3 = 0; r3 < sh.length; r3++) {
        for (var c3 = 0; c3 < sh[r3].length; c3++) {
          if (sh[r3][c3] && cy + r3 >= 0) {
            drawCell(cx + c3, cy + r3, cols[cur.type - 1] || "#888");
          }
        }
      }
    }
    if (gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, canvas.height / 2 - 30, canvas.width, 60);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--as-accent").trim() || "#c9a227";
      ctx.font = "bold 18px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
      ctx.font = "12px system-ui";
      ctx.fillText("Enter / R to restart", canvas.width / 2, canvas.height / 2 + 20);
    } else if (paused) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, canvas.height / 2 - 20, canvas.width, 40);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 + 6);
    }
    updateHUD();
  }
  function drawMini(ctx2, canvas2, piece) {
    if (!ctx2 || !canvas2) return;
    ctx2.fillStyle = "#0a0a0a";
    ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
    if (!piece) return;
    var cols = themeColors();
    var sh = piece.shape;
    var bs = 16;
    var ox = (canvas2.width - sh[0].length * bs) / 2;
    var oy = (canvas2.height - sh.length * bs) / 2;
    for (var r = 0; r < sh.length; r++) {
      for (var c = 0; c < sh[r].length; c++) {
        if (!sh[r][c]) continue;
        ctx2.fillStyle = cols[piece.type - 1];
        ctx2.fillRect(ox + c * bs + 1, oy + r * bs + 1, bs - 2, bs - 2);
      }
    }
  }
  function drawNext() { drawMini(nextCtx, nextCanvas, next); }
  function drawHold() { drawMini(holdCtx, holdCanvas, hold); }
  function updateHUD() {
    var el;
    if ((el = document.getElementById("score"))) el.textContent = score;
    if ((el = document.getElementById("lines"))) el.textContent = lines;
    if ((el = document.getElementById("level"))) el.textContent = level;
    if ((el = document.getElementById("hiscore"))) el.textContent = highScore;
    if ((el = document.getElementById("dropMs"))) el.textContent = dropMs + "ms";
    if ((el = document.getElementById("status"))) {
      el.textContent = gameOver ? "Game Over" : (paused ? "Paused" : (running ? "Playing" : "Ready"));
    }
  }
  function resetTimer() {
    clearInterval(timer);
    if (running && !paused) timer = setInterval(softDrop, dropMs);
  }
  function applyDifficulty(id, restart) {
    difficulty = DIFF[id] ? id : "normal";
    localStorage.setItem("as_tetris_diff", difficulty);
    var d = DIFF[difficulty];
    var label = document.getElementById("diffLabel");
    if (label) label.textContent = d.name;
    document.querySelectorAll("[data-diff]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-diff") === difficulty);
    });
    if (restart) start();
    else {
      dropMs = Math.max(d.min, d.base - (level - 1) * d.step);
      var speedEl = document.getElementById("speed");
      if (speedEl && parseInt(speedEl.value, 10) > 0) dropMs = parseInt(speedEl.value, 10);
      resetTimer();
      updateHUD();
    }
  }
  function start() {
    board = emptyBoard();
    bag = [];
    refillBag();
    next = null;
    hold = null;
    holdLocked = false;
    score = 0; lines = 0; level = 1;
    var d = DIFF[difficulty] || DIFF.normal;
    dropMs = d.base;
    var speedEl = document.getElementById("speed");
    if (speedEl && speedEl.dataset.manual === "1") {
      var mv = parseInt(speedEl.value, 10);
      if (!isNaN(mv) && mv > 0) dropMs = mv;
    }
    running = true; paused = false; gameOver = false;
    spawn();
    resetTimer();
    draw();
  }
  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    resetTimer();
    draw();
  }
  // UI
  document.getElementById("start").onclick = start;
  document.getElementById("pause").onclick = togglePause;
  document.querySelectorAll("[data-diff]").forEach(function (btn) {
    btn.onclick = function () { applyDifficulty(btn.getAttribute("data-diff"), true); };
  });
  var speedEl = document.getElementById("speed");
  if (speedEl) {
    speedEl.oninput = function () {
      speedEl.dataset.manual = "1";
      var v = parseInt(speedEl.value, 10);
      if (!isNaN(v) && v > 0) {
        dropMs = v;
        resetTimer();
        updateHUD();
      }
    };
  }
  var ghostEl = document.getElementById("ghostToggle");
  if (ghostEl) {
    ghostEl.checked = ghostOn;
    ghostEl.onchange = function () {
      ghostOn = ghostEl.checked;
      localStorage.setItem("as_tetris_ghost", ghostOn ? "1" : "0");
      draw();
    };
  }
  var sfxEl = document.getElementById("sfxToggle");
  if (sfxEl) {
    sfxEl.checked = sfxOn;
    sfxEl.onchange = function () {
      sfxOn = sfxEl.checked;
      localStorage.setItem("as_tetris_sfx", sfxOn ? "1" : "0");
    };
  }
  document.addEventListener("keydown", function (e) {
    if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," "].indexOf(e.key) >= 0) e.preventDefault();
    if (!running || paused || gameOver) {
      if (e.key === "Enter" || e.key === "r" || e.key === "R") start();
      if (e.key === "p" || e.key === "P") togglePause();
      return;
    }
    if (e.key === "ArrowLeft" && !collide(cx - 1, cy, cur.shape)) { cx--; draw(); }
    else if (e.key === "ArrowRight" && !collide(cx + 1, cy, cur.shape)) { cx++; draw(); }
    else if (e.key === "ArrowDown") softDrop();
    else if (e.key === "ArrowUp" || e.key === "x" || e.key === "X") { rotate(); draw(); }
    else if (e.key === " ") hardDrop();
    else if (e.key === "p" || e.key === "P") togglePause();
    else if (e.key === "c" || e.key === "C" || e.key === "Shift") { doHold(); }
  });
  window.addEventListener("as-theme-change", function () { draw(); drawNext(); drawHold(); });
  applyDifficulty(difficulty, false);
  start();
})();
