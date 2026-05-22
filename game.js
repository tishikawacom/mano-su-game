// 魔の巣 〜Insist on the highest standards〜
const MODES = {
  tomo: { label: 'とも モード（初級）', speed: 4, jumpForce: -13, gravity: 0.6, obstacleInterval: [120, 200], obstacleTypes: ['web', 'spider'], lives: 3, color: '#4ade80' },
  takeshi: { label: 'たけし モード（中級）', speed: 6, jumpForce: -14, gravity: 0.65, obstacleInterval: [80, 150], obstacleTypes: ['web', 'spider', 'bat'], lives: 2, color: '#facc15' },
  kazutaka: { label: 'かずたか モード（上級）', speed: 9, jumpForce: -15, gravity: 0.7, obstacleInterval: [50, 110], obstacleTypes: ['web', 'spider', 'bat', 'ghost'], lives: 1, color: '#ef4444' },
};

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getAudio() { if (!audioCtx) audioCtx = new AudioCtx(); return audioCtx; }
function playTone(freq, type, duration, gainVal = 0.3, delay = 0) {
  try {
    const ctx = getAudio(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + duration);
  } catch(e) {}
}
function sfxJump() { playTone(300,'square',0.08,0.25); playTone(450,'square',0.1,0.2,0.05); playTone(600,'square',0.12,0.15,0.1); }
function sfxHit() { [200,150,100,80].forEach((f,i)=>playTone(f,'sawtooth',0.1+i*0.02,0.4,i*0.05)); if(navigator.vibrate) navigator.vibrate([100,50,100]); }
function sfxGameover() { [300,250,200,150,100].forEach((f,i)=>playTone(f,'square',0.18,0.3,i*0.12)); if(navigator.vibrate) navigator.vibrate([200,100,200,100,400]); }
function sfxScore() { playTone(880,'square',0.06,0.15); playTone(1100,'square',0.06,0.12,0.07); }
function sfxStart() { [262,330,392,523].forEach((f,i)=>playTone(f,'square',0.15,0.2,i*0.1)); }

let state = { mode:null, score:0, hiScore:parseInt(localStorage.getItem('mano_hi')||'0'), frame:0, running:false, lives:3, invincible:0 };

const canvas = document.getElementById('game-canvas');
const ctx2 = canvas.getContext('2d');
const W = 800, H = 300;
canvas.width = W; canvas.height = H;
ctx2.imageSmoothingEnabled = false;

const player = { x:80, y:H-60, w:28, h:36, vy:0, grounded:true, animFrame:0, animTick:0 };
const GROUND_Y = H - 60;
let obstacles = [], nextObstacleIn = 100, bgX = 0;
let stars = Array.from({length:40}, ()=>({ x:Math.random()*W, y:Math.random()*(H*0.5), size:Math.random()<0.3?2:1, speed:Math.random()*0.5+0.2 }));
let particles = [];

function spawnParticles(x,y,color,count=8) {
  for(let i=0;i<count;i++) {
    const angle=(Math.PI*2*i)/count+Math.random()*0.5;
    particles.push({x,y,vx:Math.cos(angle)*(Math.random()*3+1),vy:Math.sin(angle)*(Math.random()*3+1),life:30+Math.random()*20,maxLife:50,color,size:Math.random()*4+2});
  }
}

function pixelRect(x,y,w,h,color) { ctx2.fillStyle=color; ctx2.fillRect(Math.floor(x),Math.floor(y),w,h); }

function drawPlayer(x,y,frame,invincible) {
  ctx2.globalAlpha = invincible>0?(Math.floor(invincible/4)%2===0?0.4:1):1;
  const c={body:'#8b5cf6',cape:'#6d28d9',face:'#fde68a',hair:'#1e1b4b',eye:'#1e1b4b',boot:'#374151',highlight:'#c4b5fd'};
  const px=Math.floor(x),py=Math.floor(y);
  pixelRect(px+8,py,12,4,c.hair); pixelRect(px+4,py+4,20,4,c.hair);
  pixelRect(px+6,py+8,16,12,c.face);
  pixelRect(px+9,py+11,3,3,c.eye); pixelRect(px+16,py+11,3,3,c.eye);
  pixelRect(px+4,py+20,20,10,c.body);
  pixelRect(px+2,py+20,24,14,c.cape); pixelRect(px+4,py+34,20,2,c.body);
  if(frame===0){pixelRect(px+6,py+32,6,4,c.boot);pixelRect(px+16,py+32,6,4,c.boot);}
  else{pixelRect(px+4,py+32,6,4,c.boot);pixelRect(px+18,py+32,6,4,c.boot);}
  pixelRect(px+6,py+8,3,3,c.highlight);
  ctx2.globalAlpha=1;
}

function drawSpiderObstacle(obs) {
  const x=Math.floor(obs.x),y=Math.floor(obs.y),t=obs.animTick,sc=obs.color||'#ef4444',leg='#6b7280';
  const lo=Math.sin(t*0.2)*3;
  pixelRect(x-10,y+4+lo,10,2,leg); pixelRect(x-10,y+8,10,2,leg); pixelRect(x-10,y+12-lo,10,2,leg);
  pixelRect(x+obs.w,y+4+lo,10,2,leg); pixelRect(x+obs.w,y+8,10,2,leg); pixelRect(x+obs.w,y+12-lo,10,2,leg);
  pixelRect(x+4,y,obs.w-8,4,sc); pixelRect(x+2,y+4,obs.w-4,8,sc); pixelRect(x+4,y+12,obs.w-8,6,sc);
  pixelRect(x+5,y+5,3,3,'#ff0000'); pixelRect(x+obs.w-8,y+5,3,3,'#ff0000');
  pixelRect(x+obs.w/2-1,y-40,2,40,'rgba(255,255,255,0.3)');
}

function drawWebObstacle(obs) {
  const x=Math.floor(obs.x),y=Math.floor(obs.y);
  ctx2.strokeStyle='rgba(200,200,200,0.7)'; ctx2.lineWidth=1;
  for(let r=4;r<=obs.w/2;r+=6){ctx2.beginPath();ctx2.arc(x+obs.w/2,y+obs.h/2,r,0,Math.PI*2);ctx2.stroke();}
  for(let a=0;a<8;a++){const ang=(a/8)*Math.PI*2;ctx2.beginPath();ctx2.moveTo(x+obs.w/2,y+obs.h/2);ctx2.lineTo(x+obs.w/2+Math.cos(ang)*obs.w/2,y+obs.h/2+Math.sin(ang)*obs.h/2);ctx2.stroke();}
}

function drawBatObstacle(obs) {
  const x=Math.floor(obs.x),y=Math.floor(obs.y),wf=Math.sin(obs.animTick*0.3)>0,bc='#7c3aed';
  if(wf){pixelRect(x-12,y+2,16,4,bc);pixelRect(x-8,y,8,2,bc);pixelRect(x+obs.w-4,y+2,16,4,bc);pixelRect(x+obs.w,y,8,2,bc);}
  else{pixelRect(x-12,y+8,16,4,bc);pixelRect(x-8,y+6,8,4,bc);pixelRect(x+obs.w-4,y+8,16,4,bc);pixelRect(x+obs.w,y+6,8,4,bc);}
  pixelRect(x+4,y+4,obs.w-8,12,bc);
  pixelRect(x+6,y+6,3,3,'#ff0000'); pixelRect(x+obs.w-9,y+6,3,3,'#ff0000');
}

function drawGhostObstacle(obs) {
  const x=Math.floor(obs.x),y=Math.floor(obs.y)+Math.sin(obs.animTick*0.08)*6,gc='rgba(192,132,252,0.85)';
  pixelRect(x+4,y,obs.w-8,6,gc); pixelRect(x+2,y+6,obs.w-4,12,gc); pixelRect(x,y+12,obs.w,6,gc);
  for(let i=0;i<4;i++) pixelRect(x+i*(obs.w/4),y+18,obs.w/4-2,4,gc);
  pixelRect(x+6,y+8,4,4,'#1e1b4b'); pixelRect(x+obs.w-10,y+8,4,4,'#1e1b4b');
}

function drawObstacle(obs) {
  obs.animTick=(obs.animTick||0)+1;
  if(obs.type==='spider') drawSpiderObstacle(obs);
  else if(obs.type==='web') drawWebObstacle(obs);
  else if(obs.type==='bat') drawBatObstacle(obs);
  else if(obs.type==='ghost') drawGhostObstacle(obs);
}

function drawGround() {
  pixelRect(0,GROUND_Y+36,W,2,'#4b5563');
  for(let i=0;i<W;i+=8) pixelRect((i+Math.floor(bgX)%8),GROUND_Y+38,4,2,'#374151');
  pixelRect(0,GROUND_Y+37,W,1,'#6b7280');
}

function drawBackground() {
  ctx2.fillStyle='#0d0d1a'; ctx2.fillRect(0,0,W,H);
  stars.forEach(s=>{
    ctx2.fillStyle=s.size===2?'#e0e0e0':'#9ca3af';
    ctx2.fillRect(Math.floor(s.x),Math.floor(s.y),s.size,s.size);
    s.x-=s.speed*(state.mode?MODES[state.mode].speed/8:0.5);
    if(s.x<0){s.x=W;s.y=Math.random()*H*0.5;}
  });
  ctx2.fillStyle='#fef3c7'; ctx2.fillRect(W-80,20,30,30);
  ctx2.fillStyle='#0d0d1a'; ctx2.fillRect(W-72,16,30,30);
  ctx2.strokeStyle='rgba(100,100,150,0.15)'; ctx2.lineWidth=1;
  const wx=(W-120-bgX*0.3)%W;
  for(let r=10;r<=60;r+=12){ctx2.beginPath();ctx2.arc(wx,30,r,0,Math.PI*2);ctx2.stroke();}
}

function makeObstacle(mode) {
  const cfg=MODES[mode],types=cfg.obstacleTypes,type=types[Math.floor(Math.random()*types.length)];
  let y,w,h;
  if(type==='bat'||type==='ghost'){y=GROUND_Y-60-Math.random()*60;w=32;h=20;}
  else if(type==='web'){y=GROUND_Y-30;w=40+Math.random()*20;h=40;}
  else{y=GROUND_Y-24;w=28;h=24;if(Math.random()<0.3)y=GROUND_Y-80-Math.random()*40;}
  return{x:W+20,y,w,h,type,animTick:0,color:null};
}

function checkCollision(p,obs) {
  const m=6;
  return p.x+m<obs.x+obs.w-m&&p.x+p.w-m>obs.x+m&&p.y+m<obs.y+obs.h-m&&p.y+p.h-m>obs.y+m;
}

function fmtScore(n){return String(Math.floor(n)).padStart(5,'0');}

function updateScoreUI(){
  document.getElementById('score').textContent=fmtScore(state.score);
  document.getElementById('hi-score-game').textContent=fmtScore(state.hiScore);
}

function updateLivesUI(){
  const cfg=MODES[state.mode],total=cfg.lives,remaining=state.lives;
  let s='';
  for(let i=0;i<total;i++) s+=i<remaining?'❤️':'🖤';
  document.getElementById('lives').textContent=s;
}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

let animId=null;

function resetGame(mode){
  state.mode=mode; state.score=0; state.frame=0; state.running=true;
  state.lives=MODES[mode].lives; state.invincible=0;
  player.y=GROUND_Y; player.vy=0; player.grounded=true; player.animFrame=0; player.animTick=0;
  obstacles=[]; particles=[]; nextObstacleIn=100; bgX=0;
  document.getElementById('mode-indicator').textContent=MODES[mode].label;
  document.getElementById('mode-indicator').style.color=MODES[mode].color;
  updateScoreUI(); updateLivesUI();
}

function gameLoop(){
  if(!state.running) return;
  const cfg=MODES[state.mode];
  state.frame++;
  state.score+=0.1;
  if(state.score>state.hiScore) state.hiScore=state.score;
  if(state.frame%6===0) updateScoreUI();
  if(Math.floor(state.score)%100===0&&state.frame%6===0&&state.score>10) sfxScore();
  player.vy+=cfg.gravity; player.y+=player.vy;
  if(player.y>=GROUND_Y){player.y=GROUND_Y;player.vy=0;player.grounded=true;}
  player.animTick++;
  if(player.grounded&&player.animTick%10===0) player.animFrame=1-player.animFrame;
  bgX+=cfg.speed*0.3;
  nextObstacleIn--;
  if(nextObstacleIn<=0){
    obstacles.push(makeObstacle(state.mode));
    const[min,max]=cfg.obstacleInterval;
    nextObstacleIn=Math.max(40,min+Math.floor(Math.random()*(max-min))-Math.floor(state.score/200));
  }
  for(let i=obstacles.length-1;i>=0;i--){
    obstacles[i].x-=cfg.speed+state.score/500;
    if(obstacles[i].x+obstacles[i].w<-20) obstacles.splice(i,1);
  }
  if(state.invincible>0){state.invincible--;}
  else{
    for(const obs of obstacles){
      if(checkCollision(player,obs)){
        sfxHit();
        spawnParticles(player.x+player.w/2,player.y+player.h/2,cfg.color,12);
        state.lives--; updateLivesUI();
        state.invincible=90;
        if(state.lives<=0){endGame();return;}
        break;
      }
    }
  }
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.life--;
    if(p.life<=0) particles.splice(i,1);
  }
  drawBackground(); drawGround();
  particles.forEach(p=>{
    ctx2.globalAlpha=p.life/p.maxLife;
    ctx2.fillStyle=p.color;
    ctx2.fillRect(Math.floor(p.x),Math.floor(p.y),Math.ceil(p.size),Math.ceil(p.size));
    ctx2.globalAlpha=1;
  });
  obstacles.forEach(obs=>drawObstacle(obs));
  drawPlayer(player.x,player.y,player.animFrame,state.invincible);
  if(state.frame%600<10){ctx2.fillStyle='rgba(255,107,53,0.15)';ctx2.fillRect(0,0,W,H);}
  animId=requestAnimationFrame(gameLoop);
}

function endGame(){
  state.running=false; sfxGameover();
  localStorage.setItem('mano_hi',Math.floor(state.hiScore));
  document.getElementById('hi-score').textContent=fmtScore(state.hiScore);
  document.getElementById('final-score').textContent=fmtScore(state.score);
  document.getElementById('final-hi').textContent=fmtScore(state.hiScore);
  const msgs=['もっと高い基準を！','魔の巣に飲み込まれた...','Insist on the highest standards!','再挑戦で最高を目指せ！'];
  document.getElementById('gameover-msg').textContent=msgs[Math.floor(Math.random()*msgs.length)];
  showScreen('gameover-screen');
}

function doJump(){
  if(!state.running) return;
  if(player.grounded){player.vy=MODES[state.mode].jumpForce;player.grounded=false;sfxJump();}
}

document.addEventListener('keydown',e=>{
  if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();doJump();}
});
canvas.addEventListener('click',doJump);
canvas.addEventListener('touchstart',e=>{e.preventDefault();doJump();},{passive:false});

let selectedMode=null;
document.querySelectorAll('.mode-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    selectedMode=btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
  });
  btn.addEventListener('dblclick',()=>{ selectedMode=btn.dataset.mode; startGame(selectedMode); });
  btn.addEventListener('keydown',e=>{
    if(e.code==='Enter'||e.code==='Space'){
      e.preventDefault();
      if(selectedMode===btn.dataset.mode) startGame(selectedMode);
      else{selectedMode=btn.dataset.mode;document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');}
    }
  });
});

document.addEventListener('keydown',e=>{
  if(e.code==='Space'&&document.getElementById('title-screen').classList.contains('active')){
    e.preventDefault();
    if(selectedMode) startGame(selectedMode);
    else{selectedMode='tomo';document.querySelector('[data-mode="tomo"]').classList.add('selected');}
  }
});

function startGame(mode){ sfxStart(); showScreen('game-screen'); resetGame(mode); if(animId) cancelAnimationFrame(animId); animId=requestAnimationFrame(gameLoop); }

document.getElementById('retry-btn').addEventListener('click',()=>{ if(state.mode) startGame(state.mode); });
document.getElementById('title-btn').addEventListener('click',()=>{ showScreen('title-screen'); document.getElementById('hi-score').textContent=fmtScore(state.hiScore); });
document.getElementById('hi-score').textContent=fmtScore(state.hiScore);
document.getElementById('game-screen').addEventListener('touchstart',e=>{e.preventDefault();doJump();},{passive:false});