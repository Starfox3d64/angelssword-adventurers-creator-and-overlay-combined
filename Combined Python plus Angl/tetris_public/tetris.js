(function(){
  const COLS=10, ROWS=20, SIZE=24;
  const SHAPES={
    I:[[1,1,1,1]],
    O:[[1,1],[1,1]],
    T:[[0,1,0],[1,1,1]],
    S:[[0,1,1],[1,1,0]],
    Z:[[1,1,0],[0,1,1]],
    J:[[1,0,0],[1,1,1]],
    L:[[0,0,1],[1,1,1]]
  };
  const KEYS=Object.keys(SHAPES);
  const canvas=document.getElementById('c');
  const ctx=canvas.getContext('2d');
  let board, piece, x, y, score, lines, timer, paused, running;

  function colors(){
    const s=getComputedStyle(document.documentElement);
    return [1,2,3,4,5,6,7].map(i=>s.getPropertyValue('--as-tetris-'+i).trim()||'#888');
  }
  function empty(){ return Array.from({length:ROWS},()=>Array(COLS).fill(0)); }
  function randPiece(){
    const k=KEYS[Math.floor(Math.random()*KEYS.length)];
    return {shape:SHAPES[k].map(r=>r.slice()), type:KEYS.indexOf(k)+1};
  }
  function collide(px,py,sh){
    for(let r=0;r<sh.length;r++) for(let c=0;c<sh[r].length;c++){
      if(!sh[r][c]) continue;
      const ny=py+r, nx=px+c;
      if(nx<0||nx>=COLS||ny>=ROWS) return true;
      if(ny>=0 && board[ny][nx]) return true;
    }
    return false;
  }
  function merge(){
    piece.shape.forEach((row,r)=>row.forEach((v,c)=>{
      if(v && y+r>=0) board[y+r][x+c]=piece.type;
    }));
  }
  function clearLines(){
    let n=0;
    for(let r=ROWS-1;r>=0;r--){
      if(board[r].every(v=>v)){ board.splice(r,1); board.unshift(Array(COLS).fill(0)); n++; r++; }
    }
    if(n){ lines+=n; score+=[0,100,300,500,800][n]||800; }
  }
  function rotate(){
    const sh=piece.shape;
    const next=sh[0].map((_,i)=>sh.map(row=>row[i]).reverse());
    if(!collide(x,y,next)) piece.shape=next;
  }
  function draw(){
    const cols=colors();
    ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      if(board[r][c]){ ctx.fillStyle=cols[board[r][c]-1]; ctx.fillRect(c*SIZE+1,r*SIZE+1,SIZE-2,SIZE-2); }
    }
    if(piece) piece.shape.forEach((row,r)=>row.forEach((v,c)=>{
      if(v){ ctx.fillStyle=cols[piece.type-1]; ctx.fillRect((x+c)*SIZE+1,(y+r)*SIZE+1,SIZE-2,SIZE-2); }
    }));
    document.getElementById('score').textContent=score;
    document.getElementById('lines').textContent=lines;
  }
  function tick(){
    if(paused||!running) return;
    if(!collide(x,y+1,piece.shape)) y++;
    else { merge(); clearLines(); piece=randPiece(); x=3; y=0; if(collide(x,y,piece.shape)){ running=false; alert('Game Over — Score '+score); } }
    draw();
  }
  function start(){
    board=empty(); piece=randPiece(); x=3; y=0; score=0; lines=0; paused=false; running=true;
    clearInterval(timer); timer=setInterval(tick, 500); draw();
  }
  document.getElementById('start').onclick=start;
  document.getElementById('pause').onclick=()=>{ paused=!paused; };
  document.addEventListener('keydown',e=>{
    if(!running||paused) return;
    if(e.key==='ArrowLeft' && !collide(x-1,y,piece.shape)) x--;
    else if(e.key==='ArrowRight' && !collide(x+1,y,piece.shape)) x++;
    else if(e.key==='ArrowDown' && !collide(x,y+1,piece.shape)){ y++; score+=1; }
    else if(e.key==='ArrowUp') rotate();
    else if(e.key===' '){ while(!collide(x,y+1,piece.shape)){ y++; score+=2; } tick(); }
    draw();
  });
  window.addEventListener('as-theme-change', draw);
  start();
})();
