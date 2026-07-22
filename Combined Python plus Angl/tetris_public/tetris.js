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
  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var nextCanvas = document.getElementById("next");
  var nextCtx = nextCanvas ? nextCanvas.getContext("2d") : null;
  var board, bag, cur, next, cx, cy, score, lines, level, dropMs, timer, running, paused, gameOver;

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
      lines += cleared;
      var pts = [0, 100, 300, 500, 800][cleared] || 800;
      score += pts * Math.max(1, level);
      level = 1 + Math.floor(lines / 10);
      dropMs = Math.max(80, 550 - (level - 1) * 40);
      resetTimer();
    }
  }
  function rotate() {
    var sh = cur.shape;
    var rows = sh.length, cols = sh[0].length;
    var nextSh = [];
    for (var c = 0; c < cols; c++) {
      nextSh[c] = [];
      for (var r = rows - 1; r >= 0; r--) nextSh[c].push(sh[r][c]);
    }
    // wall kicks
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!collide(cx + kicks[i], cy, nextSh)) {
        cur.shape = nextSh;
        cx += kicks[i];
        return;
      }
    }
  }
  function spawn() {
    cur = next || takePiece();
    next = takePiece();
    cx = 3;
    cy = 0;
    if (collide(cx, cy, cur.shape)) {
      running = false;
      gameOver = true;
      clearInterval(timer);
      draw();
    }
    drawNext();
  }
  function softDrop() {
    if (!running || paused || gameOver) return;
    if (!collide(cx, cy + 1, cur.shape)) {
      cy++;
      score += 1;
    } else {
      merge();
      clearLines();
      spawn();
    }
    draw();
  }
  function hardDrop() {
    if (!running || paused || gameOver) return;
    while (!collide(cx, cy + 1, cur.shape)) {
      cy++;
      score += 2;
    }
    merge();
    clearLines();
    spawn();
    draw();
  }
  function drawCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, 3);
  }
  function draw() {
    var cols = themeColors();
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
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c]) drawCell(c, r, cols[board[r][c] - 1]);
      }
    }
    if (cur && !gameOver) {
      // ghost
      var gy = cy;
      while (!collide(cx, gy + 1, cur.shape)) gy++;
      ctx.globalAlpha = 0.25;
      for (var r2 = 0; r2 < cur.shape.length; r2++) {
        for (var c2 = 0; c2 < cur.shape[r2].length; c2++) {
          if (cur.shape[r2][c2] && gy + r2 >= 0) drawCell(cx + c2, gy + r2, cols[cur.type - 1]);
        }
      }
      ctx.globalAlpha = 1;
      for (var r3 = 0; r3 < cur.shape.length; r3++) {
        for (var c3 = 0; c3 < cur.shape[r3].length; c3++) {
          if (cur.shape[r3][c3] && cy + r3 >= 0) drawCell(cx + c3, cy + r3, cols[cur.type - 1]);
        }
      }
    }
    var el;
    if ((el = document.getElementById("score"))) el.textContent = score;
    if ((el = document.getElementById("lines"))) el.textContent = lines;
    if ((el = document.getElementById("level"))) el.textContent = level;
    if ((el = document.getElementById("status"))) {
      el.textContent = gameOver ? "Game Over" : (paused ? "Paused" : (running ? "Playing" : "Ready"));
    }
  }
  function drawNext() {
    if (!nextCtx || !next) return;
    nextCtx.fillStyle = "#0a0a0a";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    var cols = themeColors();
    var sh = next.shape;
    var bs = 18;
    var ox = (nextCanvas.width - sh[0].length * bs) / 2;
    var oy = (nextCanvas.height - sh.length * bs) / 2;
    for (var r = 0; r < sh.length; r++) {
      for (var c = 0; c < sh[r].length; c++) {
        if (!sh[r][c]) continue;
        nextCtx.fillStyle = cols[next.type - 1];
        nextCtx.fillRect(ox + c * bs + 1, oy + r * bs + 1, bs - 2, bs - 2);
      }
    }
  }
  function resetTimer() {
    clearInterval(timer);
    if (running && !paused) timer = setInterval(softDrop, dropMs);
  }
  function start() {
    board = emptyBoard();
    bag = [];
    refillBag();
    next = null;
    score = 0; lines = 0; level = 1; dropMs = 550;
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
  document.getElementById("start").onclick = start;
  document.getElementById("pause").onclick = togglePause;
  document.addEventListener("keydown", function (e) {
    if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," "].indexOf(e.key) >= 0) e.preventDefault();
    if (!running || paused || gameOver) {
      if (e.key === "Enter" || e.key === "r" || e.key === "R") start();
      return;
    }
    if (e.key === "ArrowLeft" && !collide(cx - 1, cy, cur.shape)) { cx--; draw(); }
    else if (e.key === "ArrowRight" && !collide(cx + 1, cy, cur.shape)) { cx++; draw(); }
    else if (e.key === "ArrowDown") softDrop();
    else if (e.key === "ArrowUp") { rotate(); draw(); }
    else if (e.key === " ") hardDrop();
    else if (e.key === "p" || e.key === "P") togglePause();
  });
  window.addEventListener("as-theme-change", function () { draw(); drawNext(); });
  // Auto-start so the game plays immediately
  if (document.getElementById("start")) {
    start(); // auto
  } else {
    board = emptyBoard(); bag = []; cur = null; next = null;
    score = 0; lines = 0; level = 1; running = false; paused = false; gameOver = false;
    draw();
  }
})();
