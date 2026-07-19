// ==================== Boss图片资源 ====================
// v=9 主体占70%+周围透明边距，完全显示boss形象，无方形痕迹
const BOSS_IMG_VERSION = '9'; // 全局图片版本号（缓存破坏）
const BOSS_IMG_PATHS = {
  0: 'assets/bosses/jiuweihu_v2.png',  // 九尾狐
  1: 'assets/bosses/bifang_v2.png',  // 毕方
  2: 'assets/bosses/xiangliu_v2.png',  // 相柳
  3: 'assets/bosses/zhuyan_v2.png',    // 朱厌
  4: 'assets/bosses/zhulong_v2.png',   // 烛龙
  5: 'assets/bosses/taotie_v2.png',    // 饕餮
  6: 'assets/bosses/yingshao_v2.png',  // 英招
  7: 'assets/bosses/jimeng_v2.png',    // 计蒙
  8: 'assets/bosses/qiongqi_v2.png',   // 穷奇
  9: null   // 刑天（最终Boss，专用图通过 loadXingtianImages 加载）
};
// 帧能力表：标记每个Boss实际拥有哪些帧，避免对不存在的帧发起请求（消除 404）
// attack: -attack.png 主攻击帧；attack2: _a2.png 副攻击帧；move: _m.png 移动帧
const BOSS_FRAME_CAPABILITY = {
  0: {attack:true,  attack2:false, move:false}, // 九尾狐
  1: {attack:false, attack2:false, move:false}, // 毕方
  2: {attack:false, attack2:false, move:false}, // 相柳
  3: {attack:false, attack2:false, move:false}, // 朱厌
  4: {attack:true,  attack2:false, move:false}, // 烛龙
  5: {attack:false, attack2:false, move:false}, // 饕餮
  6: {attack:false, attack2:false, move:false}, // 英招
  7: {attack:false, attack2:false, move:false}, // 计蒙
  8: {attack:false, attack2:false, move:false}, // 穷奇
  9: {attack:true,  attack2:false, move:false}  // 刑天（专用图，通过 loadXingtianImages 加载，此处仅作能力表完整性标记）
};
const BOSS_IMAGES = {};
const BOSS_IMAGES_ATTACK = {};   // 主攻击帧 -attack.png（仅 capability 标记的Boss加载）
const BOSS_IMAGES_ATTACK2 = {};  // 副攻击帧 _a2.png
const BOSS_IMAGES_MOVE = {};
// 刑天专用：常态+攻击形态两张独立图（不通过BOSS_IMG_PATHS，因结构不同）
let XINGTIAN_IMG_IDLE = null;
let XINGTIAN_IMG_ATTACK = null;
let bossImagesLoaded = 0;
let bossImagesTotal = 0;
const _bossImgLoadedSet = new Set(); // 已加载的Boss索引集合
let _xingtianImgLoaded = false;
// 按需加载单个Boss的帧图片（依据 BOSS_FRAME_CAPABILITY 只请求存在的帧，消除 404）
function loadBossImagesForIdx(idx){
  idx = Number(idx); // 归一化为数字，避免字符串/数字键混用导致 Set 去重失效
  if(_bossImgLoadedSet.has(idx)) return; // 已加载
  _bossImgLoadedSet.add(idx);
  if(!BOSS_IMG_PATHS[idx]){ BOSS_IMAGES[idx]=null; return; }
  const base = BOSS_IMG_PATHS[idx];
  const ext = base.endsWith('.jpg') ? '.jpg' : '.png';
  const baseNoExt = base.replace(/\.png$|\.jpg$/, '');
  const cap = BOSS_FRAME_CAPABILITY[idx] || {attack:false, attack2:false, move:false};
  const versionSuffix = '?v=' + BOSS_IMG_VERSION;
  // 仅统计实际要加载的帧数（避免进度条卡在 404 帧上）
  const framesToLoad = 1 + (cap.attack?1:0) + (cap.attack2?1:0) + (cap.move?1:0);
  bossImagesTotal += framesToLoad;
  const onDone = ()=>{ bossImagesLoaded++; updateLoadingIndicator(); };
  // idle帧
  const img = new Image();
  img.onload = onDone;
  img.onerror = ()=>{ console.warn('Boss图片加载失败:', BOSS_IMG_PATHS[idx]); onDone(); };
  img.src = base + versionSuffix;
  BOSS_IMAGES[idx] = img;
  // 主攻击帧 -attack.png（仅 capability 标记的Boss加载，否则回退到 idle）
  if(cap.attack){
    const imgA = new Image();
    imgA.onload = onDone;
    imgA.onerror = ()=>{ BOSS_IMAGES_ATTACK[idx]=img; onDone(); };
    imgA.src = baseNoExt + '-attack' + ext + versionSuffix;
    BOSS_IMAGES_ATTACK[idx] = imgA;
  }else{
    BOSS_IMAGES_ATTACK[idx] = img; // 直接复用 idle
  }
  // 副攻击帧 _a2（仅 capability 标记的Boss加载，否则回退到 idle）
  if(cap.attack2){
    const imgA2 = new Image();
    imgA2.onload = onDone;
    imgA2.onerror = ()=>{ BOSS_IMAGES_ATTACK2[idx]=img; onDone(); };
    imgA2.src = baseNoExt + '_a2' + ext + versionSuffix;
    BOSS_IMAGES_ATTACK2[idx] = imgA2;
  }else{
    BOSS_IMAGES_ATTACK2[idx] = img;
  }
  // 移动帧 _m（仅 capability 标记的Boss加载，否则回退到 idle）
  if(cap.move){
    const imgM = new Image();
    imgM.onload = onDone;
    imgM.onerror = ()=>{ BOSS_IMAGES_MOVE[idx]=img; onDone(); };
    imgM.src = baseNoExt + '_m' + ext + versionSuffix;
    BOSS_IMAGES_MOVE[idx] = imgM;
  }else{
    BOSS_IMAGES_MOVE[idx] = img;
  }
}
// 按需加载刑天专用图片
function loadXingtianImages(){
  if(_xingtianImgLoaded) return;
  _xingtianImgLoaded = true;
  bossImagesTotal += 2;
  const versionSuffix = '?v=' + BOSS_IMG_VERSION;
  const xtIdle = new Image();
  xtIdle.onload = ()=>{ bossImagesLoaded++; updateLoadingIndicator(); };
  xtIdle.onerror = ()=>{ console.warn('刑天常态图加载失败'); bossImagesLoaded++; updateLoadingIndicator(); };
  xtIdle.src = 'assets/bosses/xingtian_idle_v14.png' + versionSuffix;
  XINGTIAN_IMG_IDLE = xtIdle;
  const xtAtk = new Image();
  xtAtk.onload = ()=>{ bossImagesLoaded++; updateLoadingIndicator(); };
  xtAtk.onerror = ()=>{ console.warn('刑天攻击形态图加载失败'); bossImagesLoaded++; updateLoadingIndicator(); };
  xtAtk.src = 'assets/bosses/xingtian_attack_v14.png' + versionSuffix;
  XINGTIAN_IMG_ATTACK = xtAtk;
}
// 预加载所有Boss图（图鉴菜单等需要展示所有Boss时调用）
function loadAllBossImages(){
  for(const idx in BOSS_IMG_PATHS){ loadBossImagesForIdx(idx); }
  loadXingtianImages();
}
// 更新加载进度提示（右上角小指示器）
function updateLoadingIndicator(){
  const el = document.getElementById('loadingIndicator');
  if(!el) return;
  if(bossImagesTotal === 0) return;
  if(bossImagesLoaded >= bossImagesTotal){
    el.style.display = 'none';
  }else{
    el.style.display = 'block';
    const pct = Math.floor(bossImagesLoaded / bossImagesTotal * 100);
    el.textContent = `加载中 ${pct}%`;
  }
}
// 攻击类型→帧映射（'a'=主攻击帧，'a2'=副攻击帧），不同攻击使用不同动作动画
const ATTACK_FRAME_MAP = {
  // 主帧 _a：撕咬/砸地/吐息/扑击/俯冲等核心攻击动作
  charmBullet:'a', fireFeather:'a', fireRain:'a', diveBomb:'a',
  poisonNine:'a', groundShock:'a', lavaPool:'a', lightBeam:'a',
  devourAtk:'a', tornadoSpin:'a', airDash:'a',
  waterJet:'a', rainStorm:'a', chaosBolt:'a', earthCrack:'a',
  // 副帧 _a2：横扫/光晕/喷毒/抬手/引力/风刃/虚空等特殊动作
  phantomClone:'a2', charmBeam:'a2',
  poisonSwamp:'a2', poisonSpray:'a2',
  rockThrow:'a2', rockBarrage:'a2',
  lavaFist:'a2', bulletAbsorb:'a2', gravityWell:'a2',
  windBlade:'a2', floodWave:'a2',
  voidRift:'a2', dimensionStorm:'a2',
  halberdSweep:'a2', wrathClones:'a2',
  safeZone:'a'
};
let gameState='menu';
let isPaused = false; // 游戏暂停状态（手动暂停/切后台暂停）
let score=0, gameTime=0, lastTime=0;
let currentWave=1, currentLevel=1;
// 连击系统
let comboCount=0, comboTimer=0, comboMax=0;
// 新系统状态
let endlessMode=false;          // 无尽模式开关
let endlessWave=0;              // 无尽模式当前波次
let activeRelics=[];            // 当前局内激活的遗物
let bossTimeChallenge=null;     // Boss时间挑战 {time, maxTime, active}
let bossVariant=false;          // 当前Boss是否为变异体
let pendingEndlessNext=false;   // 无尽Boss击败后等待玩家选完强化再进入下一波
let pendingProceedNext=false;  // Boss击败后触发了升级，等玩家选完强化再进入下一关
let pendingTrialNext=false;    // 试炼Boss击败后触发了升级，等玩家选完强化再继续试炼流程
let prevGameState='fighting';  // 升级面板出现前的游戏状态（用于选完强化后恢复）
// Roguelike遗物定义
const RELIC_DEFS = [
  { id:'bounce',    name:'弹射子弹', icon:'🎯', desc:'子弹击中敌人后弹射到附近敌人', rarity:'rare' },
  { id:'xpboost',   name:'智者之书', icon:'📖', desc:'击杀经验+50%', rarity:'rare' },
  { id:'critchain', name:'暴击连击', icon:'💥', desc:'暴击后2秒内下次暴击伤害+50%', rarity:'epic' },
  { id:'frost',     name:'冰霜附魔', icon:'❄️', desc:'子弹附带减速效果', rarity:'rare' },
  { id:'explode',   name:'爆破子弹', icon:'🎆', desc:'子弹击中时产生小爆炸', rarity:'epic' },
  { id:'glasscannon',name:'玻璃大炮', icon:'🔫', desc:'伤害+50%但生命-30%', rarity:'epic' },
  { id:'treasure',  name:'贪欲之眼', icon:'💰', desc:'击杀积分+50%，掉落率+10%', rarity:'rare' },
  { id:'shieldwalk',name:'护盾行者', icon:'🛡️', desc:'移动时缓慢恢复护盾', rarity:'rare' },
  { id:'multicast', name:'多重施法', icon:'✨', desc:'10%几率发射额外一轮子弹', rarity:'epic' },
  { id:'berserker', name:'狂战士', icon:'⚔️', desc:'生命低于50%时伤害+30%', rarity:'rare' }
];
let enemiesRemaining=0, enemiesToSpawn=0, spawnTimer=0;
let levelTimer=0, maxLevelTime=30;
let boss=null;
let globalSlow=1, globalSlowTimer=0;
let bossHpMul=1;
let revivesUsed=0;
let screenShake=0; // 屏幕震动效果
let screenFlash=null; // 屏幕闪光效果 {color,life,maxLife}
// 低血量警告状态
let lowHpWarning = { active:false, pulseTimer:0, heartbeatTimer:0 };
let adventureEnemyTimer=15;
let pendingBossCapture=null;
// 新增：Boss试炼/超级Boss复仇/弑神双Boss状态
let bossTrialMode=false;       // 是否处于Boss试炼模式
let _lastRunWasTrial=false;    // 上一局是否为试炼模式（gameOver 显示结算时用，避免 bossTrialMode 被提前重置导致 wasTrial 失效）
let _showCheatReveal=false;   // 弑神难度试炼首次通关后标记，触发作弊方法揭示弹窗
let bossTrialIndex=0;          // Boss试炼当前索引(0-5)
let trialBossOrder=[0,1,2,3,4,5]; // 试炼Boss顺序（随机打乱）
let pendingSuperRevenge=false; // 普通Boss死后是否触发超级Boss复仇
let pendingFinalBoss=false;   // 超级Boss死后是否触发刑天最终Boss
let resumeTrialAfterFinalBoss=false; // 刑天结束后是否继续试炼流程
let trialXingtianTriggered=false; // 本次试炼中刑天是否已触发过（限制最多一次）
let _level5FinalBossDone=false; // 冒险模式第5关后强制刑天已触发（防止decline后死循环）
let godslayerBossesLeft=0;     // 弑神难度剩余Boss数量

const keys={};
const mouse={x:CONFIG.WIDTH/2,y:CONFIG.HEIGHT/2,down:false};
let player=null;
let bullets=[], enemies=[], enemyBullets=[], particles=[], floatingTexts=[], drops=[], minions=[], bossWarnings=[];
let fireEffects=[]; // 火球术效果
let lightningStrikes=[]; // 雷击效果
let tornadoes=[]; // 龙卷风效果
let pets=[]; // 宠物
let adventureEnemies=[]; // 奇遇小怪

// ==================== 工具函数 ====================
function rand(a,b){return Math.random()*(b-a)+a;}
function randInt(a,b){return Math.floor(rand(a,b+1));}
function dist(x1,y1,x2,y2){return Math.sqrt((x2-x1)**2+(y2-y1)**2);}
// 平方距离比较（避免sqrt开销，用于碰撞检测热点路径）
function distSq(x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1;return dx*dx+dy*dy;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
// 性能优化：每帧入口取一次的全局时间戳，替代分散的 Date.now() 调用
let _NOW = 0;
// ==================== 性能优化：移动端全局禁用 shadow ====================
// shadowBlur 是 Canvas 在移动端 GPU 的最大性能杀手，触摸设备一律关闭
// IS_TOUCH_DEVICE/SHADOW_ENABLED 已在 ctx 初始化前定义
// shadow 劫持已在 ctx 创建后通过 setter 拦截安装（移动端 shadowBlur 永远为0）

// ==================== 粒子（对象池） ====================
// 对象池：预分配固定大小的粒子数组，active 标记是否在用，避免频繁 GC
const PARTICLE_POOL_SIZE = 300; // 池大小（略大于 MAX_PARTICLES_EFFECTIVE 以留余量）
const _particlePool = new Array(PARTICLE_POOL_SIZE);
const _particleActive = new Uint8Array(PARTICLE_POOL_SIZE); // 0=空闲 1=活跃
for(let i=0;i<PARTICLE_POOL_SIZE;i++){
  _particlePool[i] = {x:0,y:0,vx:0,vy:0,life:0,maxLife:0,color:'#fff',size:0};
}
let _particleActiveCount = 0; // 当前活跃数量

// 从池中取一个空闲粒子并初始化，返回该粒子对象（池满时返回 null）
function _acquireParticle(x,y,vx,vy,life,maxLife,color,size){
  if(_particleActiveCount >= PARTICLE_POOL_SIZE) return null;
  // 找空闲槽位（从上次位置往后找，减少从头扫描）
  for(let i=0;i<PARTICLE_POOL_SIZE;i++){
    const idx = (_particleCursor + i) % PARTICLE_POOL_SIZE;
    if(_particleActive[idx] === 0){
      const p = _particlePool[idx];
      p.x=x; p.y=y; p.vx=vx; p.vy=vy; p.life=life; p.maxLife=maxLife; p.color=color; p.size=size;
      _particleActive[idx] = 1;
      _particleActiveCount++;
      _particleCursor = (idx + 1) % PARTICLE_POOL_SIZE;
      return p;
    }
  }
  return null;
}
let _particleCursor = 0; // 游标，减少从头扫描

// 归还粒子到池（标记为空闲）
function _releaseParticle(idx){
  _particleActive[idx] = 0;
  _particleActiveCount--;
}

// 重置粒子池（新游戏/重开时调用）
function resetParticles(){
  _particleActive.fill(0);
  _particleActiveCount = 0;
  _particleCursor = 0;
}

// 统一的粒子生成函数（替代所有 particles.push({...})）
function spawnParticles(x,y,color,count){
  const cap = MAX_PARTICLES_EFFECTIVE;
  if(_particleActiveCount > cap) count = Math.min(count, 3);
  for(let i=0;i<count;i++){
    const a=rand(0,Math.PI*2), s=rand(30,150);
    _acquireParticle(x, y, Math.cos(a)*s, Math.sin(a)*s, rand(0.3,0.8), 0.8, color, rand(2,5));
  }
}

// 通用粒子生成（供特殊粒子效果调用，替代直接 push）
function spawnParticleRaw(x,y,vx,vy,life,maxLife,color,size){
  const cap = MAX_PARTICLES_EFFECTIVE;
  if(_particleActiveCount > cap) return;
  _acquireParticle(x, y, vx, vy, life, maxLife, color, size);
}

function updateParticles(dt){
  for(let i=0;i<PARTICLE_POOL_SIZE;i++){
    if(_particleActive[i]){
      const p = _particlePool[i];
      p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
      if(p.life <= 0) _releaseParticle(i);
    }
  }
}
function drawParticles(){
  // 性能优化：按颜色分组批量绘制（移动端减少状态切换）
  if(IS_TOUCH_DEVICE){
    // 移动端：按色分组
    const groups={};
    for(let i=0;i<PARTICLE_POOL_SIZE;i++){
      if(_particleActive[i]){
        const p = _particlePool[i];
        const c = p.color;
        if(!groups[c]) groups[c] = [];
        groups[c].push(p);
      }
    }
    for(const c in groups){
      ctx.fillStyle = c;
      for(const p of groups[c]){
        ctx.globalAlpha = p.life/p.maxLife;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
      }
    }
  }else{
    // PC端：原有逻辑
    for(let i=0;i<PARTICLE_POOL_SIZE;i++){
      if(_particleActive[i]){
        const p = _particlePool[i];
        ctx.globalAlpha = p.life/p.maxLife; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
      }
    }
  }
  ctx.globalAlpha=1;
}

// ==================== 浮动文字 ====================
const MAX_FLOATING_TEXTS=12;
const MAX_PARTICLES=250;      // 粒子上限（防止卡顿）
const MAX_BULLETS=300;        // 玩家子弹上限
const MAX_ENEMY_BULLETS=150;  // 敌方子弹上限
const MAX_FIRE_EFFECTS=80;    // 火焰/范围特效上限（虚空裂缝需要较大配额）
const MAX_DROPS=60;           // 掉落物上限（防止经验球堆积卡顿）
const MAX_ENEMIES=80;         // 敌人上限（防止弑神难度敌人堆积卡顿）
// 移动端性能优化：触摸设备降低粒子上限
const MAX_PARTICLES_EFFECTIVE = IS_TOUCH_DEVICE ? 150 : 250;
function pushFloatingText(x,y,text,color,life=1,size){
  // 添加随机水平偏移避免叠加
  const ox=rand(-15,15);
  const oy=rand(-10,5);
  floatingTexts.push({x:x+ox,y:y+oy,text,color,life,maxLife:life,size:size||0});
  // 限制数量：保留最新的
  if(floatingTexts.length>MAX_FLOATING_TEXTS){
    floatingTexts=floatingTexts.slice(-MAX_FLOATING_TEXTS);
  }
}
// 全屏Toast提示（用于菜单界面）
let toastTimer=null;
function showToast(text,color='#ffd970',duration=2500){
  let toast=document.getElementById('gameToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='gameToast';
    toast.style.cssText='position:fixed;top:15%;left:50%;transform:translateX(-50%);padding:12px 28px;border-radius:24px;font-size:15px;font-weight:bold;z-index:100000;pointer-events:none;opacity:0;transition:opacity 0.3s;backdrop-filter:blur(8px);font-family:STKaiti,KaiTi,serif;letter-spacing:1px;text-align:center;max-width:90vw;';
    document.body.appendChild(toast);
  }
  toast.textContent=text;
  toast.style.color=color;
  toast.style.background='rgba(13,10,5,0.92)';
  toast.style.border='1px solid '+color;
  toast.style.boxShadow='0 0 20px '+color+'44, 0 4px 16px rgba(0,0,0,0.5)';
  toast.style.opacity='1';
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{toast.style.opacity='0';},duration);
}
function updateFloatingTexts(dt){
  for(const t of floatingTexts){t.y-=40*dt;t.life-=dt;}
  floatingTexts=floatingTexts.filter(t=>t.life>0);
}
function drawFloatingTexts(){
  for(const t of floatingTexts){
    ctx.globalAlpha=Math.min(1,t.life*2);
    ctx.fillStyle=t.color;
    // 支持自定义字体大小（用于暴击/真伤等强调反馈）
    const _size=t.size||14;
    ctx.font=`bold ${_size}px Arial`;
    ctx.textAlign='center';
    // 大字体加阴影增强可读性
    if(_size>=18){
      ctx.shadowColor=t.color; ctx.shadowBlur=8;
    }
    ctx.fillText(t.text,t.x,t.y);
    ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;
}

// Boss方向指示器（手机端：Boss在屏幕边缘或被遮挡时显示方向箭头）
function drawBossIndicator(){
  if(!isTouchDevice || !touchConfirmed) return;
  if(!boss || !boss.alive || !player || !player.alive) return;
  // 计算Boss相对玩家的方向
  const dx = boss.x - player.x;
  const dy = boss.y - player.y;
  const d = Math.sqrt(dx*dx + dy*dy);
  // 只在Boss距离较远时显示指示器
  if(d < 250) return;
  const angle = Math.atan2(dy, dx);
  // 在玩家周围80px处绘制方向箭头
  const r = 80;
  const ax = player.x + Math.cos(angle) * r;
  const ay = player.y + Math.sin(angle) * r;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  // 红色三角形箭头
  ctx.fillStyle = 'rgba(248, 81, 73, 0.85)';
  ctx.strokeStyle = 'rgba(255, 137, 122, 0.9)';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#f85149';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ==================== 玩家 ====================
class Player {
  constructor(){
    this.x=CONFIG.WIDTH/2; this.y=CONFIG.HEIGHT/2;
    this.size=CONFIG.PLAYER.SIZE; this.speed=CONFIG.PLAYER.SPEED;
    this.health=CONFIG.PLAYER.MAX_HEALTH; this.maxHealth=CONFIG.PLAYER.MAX_HEALTH;
    this.angle=0; this.fireCooldown=0; this.baseFireCooldown=CONFIG.PLAYER.FIRE_COOLDOWN;
    this.alive=true; // 必须显式设置，否则死亡动画后新建Player不会显示
    this.invincible=0; this.walkPhase=0; this.moving=false;
    this.bulletSpeed=CONFIG.PLAYER.BULLET_SPEED; this.bulletDamage=CONFIG.PLAYER.BULLET_DAMAGE;
    this.bulletCount=1; this.bulletSpread=0; this.bulletPierce=0;
    this.bulletHoming=0; this.bulletSize=CONFIG.PLAYER.BULLET_SIZE;
    this.bounce=0; this.shield=0; this.maxShield=CONFIG.PLAYER.MAX_SHIELD;
    // 刑天干戚护盾CD/累计命中数（每局开始重置）
    this._xingtianShieldCD=0;
    this._xingtianHits=0;
    // 新天赋相关属性
    this.combatFuryStacks=0;     // 战斗狂当前层数
    this.combatFuryMax=0;        // 战斗狂最大层数（天赋等级×5,每层-3%cd,上限15%）
    this.combatFuryTimer=0;      // 战斗狂衰减计时器
    this.rageFuryStacks=0;       // 愤怒当前层数
    this.rageFuryMax=0;          // 愤怒最大层数（天赋等级×5,每层+3%dmg,上限15%）
    this.rageFuryTimer=0;        // 愤怒衰减计时器
    this.critChance=0; this.critDamage=2; this.baseCritChance=0;
    this.skillCooldown=0; this.maxSkillCooldown=10;
    this.elementTiers={}; this.elementEffects={}; this.finalUpgrades=[];
    this.specialTiers={}; this.specialEffects={}; this.finalSpecials=[];
    this.revives=0;
    this.applyWeaponStats(); this.applyTalents(); this.applyCharacterPassive(); this.applyCrafts();
    applyGearStats(this); applyBondEffects(this); applyGearSynergies(this);
    // 装备加成可能提升 maxHealth/maxShield，开局同步当前值到上限（满血满盾开局）
    this.health=this.maxHealth;
    this.shield=0; // 护盾初始为0，需通过装备/遗物获取（避免开局就有护盾过强）
    this.fireCooldown=this.baseFireCooldown;
    // 特殊技能计时器
    this.specialTimers={};
    // 皮肤特效状态
    this.skinTrailTimer=0; // 传说皮肤粒子拖尾计时
    this.skinAfterimages=[]; // 史诗皮肤走路残影
    // 经验值系统：升一级才能选一次强化，越高级需要的经验越多
    // 公式：xpToNext = floor(8 * 1.4^(level-1))，1→2需8xp，5→6需30xp，10→11需115xp
    // 早期升级快建立爽感，后期慢下来但不至于太 grind
    this.xp=0; this.xpLevel=1; this.xpToNext=this.computeXpToNext(1);
    // 圆弧护盾（4件Boss神话装备激活）：120°金色圆弧围绕玩家缓慢旋转，挡住弹幕
    // active:是否激活中 duration:剩余持续时间 angle:当前圆弧中心角度(弧度)
    this.arcShield={active:false, duration:0, angle:0, spinSpeed:1.2, span:Math.PI*2/3, radius:this.size+22};
  }
  // 计算升下一级所需经验（指数增长，1.4倍系数让升级速度合理）
  computeXpToNext(level){ return Math.floor(8*Math.pow(1.4,level-1)); }
  // 获得经验值，满经验自动触发升级
  gainXp(amount){
    if(!player||amount<=0)return;
    this.xp+=amount;
    // 局外经验累积：所有获得的经验都累积到局外，每1000经验奖励1天赋点
    saveData.totalXp=(saveData.totalXp||0)+amount;
    let leveledUp=false;
    while(this.xp>=this.xpToNext){
      this.xp-=this.xpToNext;
      this.xpLevel++;
      this.xpToNext=this.computeXpToNext(this.xpLevel);
      leveledUp=true;
      // 每升一级获得2天赋点（局外天赋系统，不再由得分获得）
      // 改为2点：让玩家升级后能明显感到变强，5%暴击/+1伤害等单点加成太微小
      saveData.talentPoints=(saveData.talentPoints||0)+2;
    }
    // 局外经验里程碑奖励：每1000经验额外+1天赋点
    const milestoneXp=Math.floor((saveData.totalXp||0)/1000)*1000;
    if(milestoneXp>(saveData.totalXpClaimed||0)){
      const bonus=Math.floor((milestoneXp-(saveData.totalXpClaimed||0))/1000);
      saveData.talentPoints=(saveData.talentPoints||0)+bonus;
      saveData.totalXpClaimed=milestoneXp;
      saveSave(); // 持久化里程碑奖励
      pushFloatingText(this.x,this.y-80,`🏆 里程碑奖励! +${bonus}天赋点`,'#bc8cff',2);
    }
    if(leveledUp){
      pushFloatingText(this.x,this.y-50,`升级! Lv.${this.xpLevel} (+1天赋点)`,'#ffd700',2);
      playSound('levelUp');
      spawnParticles(this.x,this.y,'#ffd700',30);
      saveSave(); // 持久化天赋点
      // 触发强化选择面板（暂停游戏）
      showUpgradeScreen();
    }
    updateUI();
  }
  applyTalents(){
    this.bulletDamage+=getTalentBonus('damage');
    this.baseFireCooldown*=Math.pow(0.9,getTalentBonus('firerate'));
    this.maxHealth+=getTalentBonus('health'); this.health=this.maxHealth;
    this.speed*=Math.pow(1.08,getTalentBonus('speed'));
    this.bulletCount+=getTalentBonus('multishot');
    if(this.bulletCount>1)this.bulletSpread+=0.12*getTalentBonus('multishot');
    this.bulletPierce+=getTalentBonus('pierce');
    this.critChance+=getTalentBonus('crit')*0.1;
    this.critDamage+=getTalentBonus('critdmg')*0.2;
    this.regenPerLevel=getTalentBonus('regen');
    // 新天赋：子弹反弹 / 子弹追踪（互斥）
    // 子弹反弹：子弹撞墙后反弹(每级+1次),利用Bullet类自带的bounce机制
    this.bounce+=getTalentBonus('ricochet');             // 每级+1次撞墙反弹
    this.bulletHoming+=getTalentBonus('homing')*1.5;     // 每级+1.5追踪强度（明显追踪）
    // 高级天赋：战斗狂 / 愤怒（互斥,2点）- 击中叠加层数有上限,衰减
    this.combatFuryMax=getTalentBonus('frenzy')*5;       // 战斗狂：5层上限,每层-3%cd(共-15%)
    this.rageFuryMax=getTalentBonus('rage')*5;           // 愤怒：5层上限,每层+3%dmg(共+15%)
  }
  applyCharacterPassive(){
    const c=getCurrentCharacter();
    this.maxSkillCooldown=c.skillCooldown; this.characterId=c.id;
    if(c.applyPassive)c.applyPassive(this);
    this.critChance+=this.baseCritChance;
  }
  applyWeaponStats(){
    const ws=getWeaponStats(saveData.currentWeapon);
    this.weaponId=saveData.currentWeapon;
    this.weaponStats=ws;
    this.baseFireCooldown=ws.fireCooldown;
    this.bulletDamage=ws.bulletDamage;
    this.bulletSpeed=ws.bulletSpeed;
    this.bulletSize=ws.bulletSize;
    this.bulletPierce=ws.pierce;
    this.bulletCount=ws.bulletCount;
    this.bulletSpread=ws.spread;
    this.critChance+=ws.critBonus;
  }
  applyCrafts(){
    const crafts=saveData.weaponCrafts[saveData.currentWeapon]||[];
    // 强化递减机制：同id词条叠加时效果急剧递减，避免堆叠超模
    // 第1个100%，第2个30%，第3个15%，第4个8%，第5个4%（5个同id词条总效果=1.57倍单词条）
    const DIMINISHING=[1.0, 0.3, 0.15, 0.08, 0.04];
    const counter={};
    for(const c of crafts){
      counter[c.id]=(counter[c.id]||0)+1;
      const stackIdx=counter[c.id]; // 第几个同类词条
      const effMul=DIMINISHING[Math.min(stackIdx-1, DIMINISHING.length-1)];
      const eff=c.value*effMul;
      if(c.id==='dmg')this.bulletDamage+=eff;
      else if(c.id==='cd')this.baseFireCooldown*=(1-eff);
      else if(c.id==='size')this.bulletSize+=eff;
      else if(c.id==='crit')this.critChance+=eff;
      else if(c.id==='pierce')this.bulletPierce+=Math.floor(eff); // 穿透取整
      else if(c.id==='count')this.bulletCount+=Math.floor(eff); // 子弹数取整
    }
  }
  update(dt){
    let dx=0,dy=0,mag=1;
    // 触摸摇杆输入（支持模拟速度和任意方向）
    if(touchMoveVec&&touchMoveVec.active){
      dx=touchMoveVec.x; dy=touchMoveVec.y;
      mag=Math.min(Math.sqrt(dx*dx+dy*dy),1);
    }else{
      // 键盘输入
      if(keys['w']||keys['arrowup'])dy-=1;
      if(keys['s']||keys['arrowdown'])dy+=1;
      if(keys['a']||keys['arrowleft'])dx-=1;
      if(keys['d']||keys['arrowright'])dx+=1;
    }
    this.moving=Math.abs(dx)>0.01||Math.abs(dy)>0.01;
    if(this.moving){
      const len=Math.sqrt(dx*dx+dy*dy); if(len>0){dx/=len; dy/=len;}
      let spd=this.speed*mag;
      if(this.quickfootTimer>0){spd*=2; this.quickfootTimer-=dt;}
      this.x+=dx*spd*dt; this.y+=dy*spd*dt;
      this.walkPhase+=dt*10;
    }
    this.x=clamp(this.x,this.size,CONFIG.WIDTH-this.size);
    this.y=clamp(this.y,this.size,CONFIG.HEIGHT-this.size);
    this.angle=Math.atan2(mouse.y-this.y,mouse.x-this.x);
    // 奇遇临时伤害增益倒计时
    if(this._adventureDmgBoostTime>0){this._adventureDmgBoostTime-=dt; if(this._adventureDmgBoostTime<=0){this._adventureDmgBoost=1;}}
    // 狂暴：击杀后攻速翻倍
    let actualFireCd=this.fireCooldown;
    if(this.rampageTimer&&this.rampageTimer>0){this.rampageTimer-=dt; actualFireCd-=dt*2;}
    else if(this.fireCooldown>0)actualFireCd-=dt;
    this.fireCooldown=Math.max(0,actualFireCd);
    // 刑天干戚战意增伤：计时器递减，归零后清空层数
    if(this.xingtianTimer&&this.xingtianTimer>0){
      this.xingtianTimer-=dt;
      if(this.xingtianTimer<=0){this.xingtianStacks=0;}
    }
    if(this.invincible>0)this.invincible-=dt;
    if(this._hazardTick&&this._hazardTick>0)this._hazardTick-=dt;
    if(this.skillCooldown>0)this.skillCooldown-=dt;
    if((mouse.down||keys[' '])&&this.fireCooldown<=0)this.shoot();
    if(keys['f']&&this.skillCooldown<=0)this.useSkill();
    // 皮肤特效：传说皮肤粒子拖尾
    const _skin=getEquippedSkin();
    if(_skin&&_skin.rarity==='legendary'){
      this.skinTrailTimer-=dt;
      if(this.skinTrailTimer<=0){
        this.skinTrailTimer=0.08;
        spawnParticleRaw(this.x+rand(-8,8),this.y+rand(-8,8),rand(-20,20),rand(-30,-10),0.6,0.6,_skin.color,rand(2,4));
      }
    }
    // 皮肤特效：史诗皮肤走路残影
    if(_skin&&_skin.rarity==='epic'&&this.moving){
      this._afterimageTimer=(this._afterimageTimer||0)-dt;
      if(this._afterimageTimer<=0){
        this._afterimageTimer=0.12;
        this.skinAfterimages.push({x:this.x,y:this.y,angle:this.angle,life:0.4,maxLife:0.4});
      }
    }
    // 更新残影生命
    for(const a of this.skinAfterimages)a.life-=dt;
    this.skinAfterimages=this.skinAfterimages.filter(a=>a.life>0);
    // 特殊技能自动触发
    this.updateSpecials(dt);
    // 全局减速
    if(globalSlowTimer>0){globalSlowTimer-=dt; if(globalSlowTimer<=0)globalSlow=1;}
    // Roguelike遗物：护盾行者（移动时缓慢恢复护盾）
    if(this._relicShieldWalk&&this.moving&&this.maxShield>0&&this.shield<this.maxShield){
      this._shieldWalkAcc=(this._shieldWalkAcc||0)+dt;
      if(this._shieldWalkAcc>=2){this._shieldWalkAcc=0; this.shield=Math.min(this.shield+1,this.maxShield); spawnParticles(this.x,this.y,'#58a6ff',3);}
    }
    // Build联动·不灭之躯：每5秒恢复1护盾
    if(this.shieldRegenPer5&&this.shieldRegenPer5>0&&this.maxShield>0&&this.shield<this.maxShield){
      this._shieldRegenAcc=(this._shieldRegenAcc||0)+dt;
      if(this._shieldRegenAcc>=5){this._shieldRegenAcc=0; this.shield=Math.min(this.shield+1,this.maxShield); spawnParticles(this.x,this.y,'#ffd700',4); pushFloatingText(this.x,this.y-30,'+1🛡️','#ffd700',0.6);}
    }
    // Roguelike遗物：暴击连击计时器
    if(this._relicCritChainTime&&this._relicCritChainTime>0){this._relicCritChainTime-=dt; if(this._relicCritChainTime<0)this._relicCritChainTime=0;}
    // 战斗狂/愤怒层数衰减：1.5秒未击中敌人则清空
    if(this.combatFuryMax>0){
      if(this.combatFuryTimer>0){this.combatFuryTimer-=dt; if(this.combatFuryTimer<=0)this.combatFuryStacks=0;}
    }
    if(this.rageFuryMax>0){
      if(this.rageFuryTimer>0){this.rageFuryTimer-=dt; if(this.rageFuryTimer<=0)this.rageFuryStacks=0;}
    }
    // 圆弧护盾：更新持续时间和旋转角度
    if(this.arcShield.active){
      this.arcShield.duration-=dt;
      this.arcShield.angle+=this.arcShield.spinSpeed*dt; // 缓慢旋转
      if(this.arcShield.duration<=0){
        this.arcShield.active=false;
        spawnParticles(this.x,this.y,'#ffd700',10);
      }
    }
    // Boss专属装备特殊效果：光暗交替（烛龙）每5秒1秒无敌
    if(this.lightCycle){
      this.lightCycleTimer-=dt;
      if(this.lightCycleTimer<=0){
        if(this.invincible<1)this.invincible=Math.max(this.invincible,1); // 1秒无敌
        this.lightCycleTimer=5; // 重置5秒CD
        spawnParticles(this.x,this.y,'#ffd700',12);
      }
    }
    // Boss专属装备特殊效果：相柳剧毒之足（移动留下毒沼）
    if(this.poisonWalk && this.moving){
      this.poisonWalkTimer=(this.poisonWalkTimer||0)-dt;
      if(this.poisonWalkTimer<=0){
        this.poisonWalkTimer=0.25; // 每0.25秒留一个毒沼
        // 玩家毒沼：用 fireEffects 实现，但加 isPlayerPoison 标记，绘制时用绿色光环区分
        fireEffects.push({
          x:this.x, y:this.y, radius:38, damage:0.5, life:2.5, maxLife:2.5,
          burnDmg:0.5, tick:0, chain:0,
          isPlayerPoison:true, // 关键：标记为玩家毒沼（视觉区分+只伤敌人）
          owner:'player'
        });
      }
    }
  }
  updateSpecials(dt){
    for(const[aid,effect]of Object.entries(this.specialEffects||{})){
      if(this.specialTimers[aid]===undefined)this.specialTimers[aid]=effect.interval||3;
      this.specialTimers[aid]-=dt;
      if(this.specialTimers[aid]<=0){
        this.specialTimers[aid]=effect.interval||3;
        this.triggerSpecial(aid,effect);
      }
    }
  }
  triggerSpecial(aid,effect){
    const fin=this.finalSpecials?.includes(aid);
    if(aid==='lightning'){
      // 自动追踪最近敌人雷击
      let target=null,nd=effect.range;
      for(const e of enemies){if(!e.alive)continue; const d=dist(this.x,this.y,e.x,e.y); if(d<nd){nd=d;target=e;}}
      if(boss&&boss.alive){const d=dist(this.x,this.y,boss.x,boss.y); if(d<nd*1.5){target=boss;}}
      if(target){
        const dmg=fin?effect.damage*2:effect.damage;
        lightningStrikes.push({x:target.x,y:target.y,life:0.5,dmg,chain:effect.chain||0,chainRange:effect.chainRange||150,chained:new Set()});
        spawnParticles(target.x,target.y,'#ffd700',15);
      }
    }else if(aid==='tornado'){
      // 释放龙卷风
      const tx=this.x+Math.cos(this.angle)*100;
      const ty=this.y+Math.sin(this.angle)*100;
      const dmg=fin?effect.damage*2:effect.damage;
      const rad=fin?effect.radius*2:effect.radius;
      tornadoes.push({x:tx,y:ty,vx:Math.cos(this.angle)*80,vy:Math.sin(this.angle)*80,radius:rad,damage:dmg,life:fin?999:effect.dur,maxLife:fin?999:effect.dur,tick:0});
    }
    // fireball 在子弹命中时触发，不在此处
  }
  shoot(){
    this.fireCooldown=this.baseFireCooldown;
    // 高级天赋：战斗狂（击中叠加攻速,每层-3%cd,上限15%）- 影响下次射击的冷却
    if(this.combatFuryMax>0&&this.combatFuryStacks>0){this.fireCooldown*=1-0.03*this.combatFuryStacks;}
    this.fireBullets(this.angle);
    // 双发：额外发射一次（无冷却消耗）
    if(this.doubleTap){this.fireBullets(this.angle+0.08);}
    // 装备多重射击：额外发射子弹
    if(this.multishot){
      for(let i=0;i<this.multishot;i++){
        this.fireBullets(this.angle+(i%2===0?0.15:-0.15)*(Math.floor(i/2)+1));
      }
    }
    // Roguelike遗物：多重施法（10%几率额外发射一轮）
    if(hasRelic('multicast')&&Math.random()<0.10){
      this.fireBullets(this.angle+0.2);
      pushFloatingText(this.x,this.y-30,'✨多重施法','#bc8cff',0.8);
    }
  }
  fireBullets(baseAngle){
    // 狂暴：生命低于30%伤害翻倍
    let dmgMul=(this.berserk&&this.health<this.maxHealth*0.3)?2:1;
    // 奇遇临时伤害增益
    if(this._adventureDmgBoost&&this._adventureDmgBoost>1)dmgMul*=this._adventureDmgBoost;
    // Roguelike遗物：狂战士（生命低于50%伤害+30%）
    if(this._relicBerserker&&this.health<this.maxHealth*0.5)dmgMul*=1.3;
    // 刑天干戚战意增伤：每层+5%伤害（最多3层=+15%）
    if(this.weaponId==='xingtiangeqi'&&this.xingtianStacks>0){dmgMul*=1+0.05*this.xingtianStacks;}
    // 刑天干戚血怒：血量越低伤害越高（最高+50%）
    if(this.weaponId==='xingtiangeqi'){
      const hpPct=this.health/this.maxHealth;
      const rageMul=1+(1-hpPct)*0.5; // 满血1x，残血1.5x
      dmgMul*=rageMul;
    }
    // Boss装备词条：战意不灭(刑天) - HP低于30%时伤害×1.5
    if(this.warWill && this.health < this.maxHealth*0.3){dmgMul*=1.5;}
    // 高级天赋：愤怒（击中叠加伤害,每层+3%,上限15%）
    if(this.rageFuryMax>0&&this.rageFuryStacks>0){dmgMul*=1+0.03*this.rageFuryStacks;}
    // 战斗狂攻速加成已在 shoot() 中应用到 this.fireCooldown
    // Roguelike遗物：暴击连击（暴击伤害+50%）
    let critMul=this.critDamage;
    if(this._relicCritChainTime&&this._relicCritChainTime>0){critMul*=1.5;}
    const count=this.bulletCount, spread=this.bulletSpread;
    for(let i=0;i<count;i++){
      let ba=baseAngle;
      if(count>1)ba=baseAngle-spread*(count-1)/2+spread*i;
      const bx=this.x+Math.cos(ba)*(this.size+4), by=this.y+Math.sin(ba)*(this.size+4);
      const isCrit=Math.random()<this.critChance;
      const dmg=isCrit?this.bulletDamage*critMul*dmgMul:this.bulletDamage*dmgMul;
      bullets.push(new Bullet(bx,by,ba,{speed:this.bulletSpeed,damage:dmg,pierce:this.bulletPierce,homing:this.bulletHoming,size:this.bulletSize,bounce:this.bounce,isCrit,elementEffects:{...this.elementEffects},finalUpgrades:[...this.finalUpgrades],specialEffects:{...this.specialEffects},finalSpecials:[...this.finalSpecials],lifesteal:this.lifesteal||0,weaponId:this.weaponId,chainCount:this.weaponId==='thunder'?2:0,voidTrail:this.weaponId==='voidbow',boomerang:this.weaponId==='xingtiangeqi',originX:this.x,originY:this.y,boomerangMaxDist:380+this.bulletSize*2,bulletExplode:this.bulletExplode||0,bulletSplit:this.bulletSplit||0}));
    }
  }
  useSkill(){
    const c=getCurrentCharacter(); this.skillCooldown=this.maxSkillCooldown;
    if(c.id==='default'){
      // 弹幕风暴：32发 + 2秒攻速翻倍
      for(let i=0;i<32;i++){
        const a=(i/32)*Math.PI*2;
        bullets.push(new Bullet(this.x+Math.cos(a)*(this.size+4),this.y+Math.sin(a)*(this.size+4),a,{speed:this.bulletSpeed*0.9,damage:this.bulletDamage,size:this.bulletSize,elementEffects:{...this.elementEffects},finalUpgrades:[...this.finalUpgrades],specialEffects:{...this.specialEffects},finalSpecials:[...this.finalSpecials],weaponId:this.weaponId,bulletExplode:this.bulletExplode||0,bulletSplit:this.bulletSplit||0}));
      }
      this.fireCooldown*=0.5; this._skillAtkBoost=2; this._skillAtkBoostTime=2;
      spawnParticles(this.x,this.y,'#58a6ff',40);
      pushFloatingText(this.x,this.y-30,'弹幕风暴!','#58a6ff',1.5);
    }else if(c.id==='ninja'){
      // 影分身：3个跟班8秒
      for(let i=0;i<3;i++){
        const a=i*(Math.PI*2/3);
        minions.push(new Minion(this.x+Math.cos(a)*40,this.y+Math.sin(a)*40));
      }
      spawnParticles(this.x,this.y,'#bc8cff',40);
      pushFloatingText(this.x,this.y-30,'影分身!','#bc8cff',1.5);
    }else if(c.id==='taoist'){
      // 道士：5张符箓环绕
      for(let i=0;i<5;i++)minions.push(new TaoistTalisman(this.x,this.y,i));
      spawnParticles(this.x,this.y,'#3fb950',35);
      pushFloatingText(this.x,this.y-30,'符箓阵!','#3fb950',1.5);
    }else if(c.id==='monk'){
      // 武僧：6秒无敌+回满血
      this.invincible=6;
      this.health=this.maxHealth;
      spawnParticles(this.x,this.y,'#f0883e',50);
      pushFloatingText(this.x,this.y-30,'金刚护体!','#f0883e',1.5);
    }else if(c.id==='shaman'){
      // 巫祝：元素风暴24发(冰+雷+火) + 强追踪
      for(let i=0;i<24;i++){
        const a=(i/24)*Math.PI*2;
        const el=i%3===0?'ice':(i%3===1?'lightning':'fire');
        const elEffects={};
        if(el==='ice')elEffects.ice={slow:0.7,slowDur:3,freezeChance:1,freezeDur:1.0};
        if(el==='lightning')elEffects.lightning={chain:3,damage:5,chainRange:200,chainDmg:0.6};
        const fireSpecial=el==='fire'?{fireball:{radius:90,burnDmg:1.2,burnDur:3,chain:1}}:{};
        bullets.push(new Bullet(this.x+Math.cos(a)*(this.size+4),this.y+Math.sin(a)*(this.size+4),a,{speed:this.bulletSpeed*0.85,damage:this.bulletDamage*1.5,size:this.bulletSize+3,homing:2.5,elementEffects:elEffects,finalUpgrades:[],specialEffects:fireSpecial,finalSpecials:[]}));
      }
      spawnParticles(this.x,this.y,'#daa520',50);
      pushFloatingText(this.x,this.y-30,'❄⚡🔥 元素乱舞!','#daa520',1.5);
    }else if(c.id==='engineer'){
      // 机关师：2座炮台12秒
      for(let i=0;i<2;i++){
        const off=i===0?-50:50;
        const tx=this.x+Math.cos(this.angle)*60+off, ty=this.y+Math.sin(this.angle)*60;
        minions.push(new EngineerTurret(tx,ty));
        spawnParticles(tx,ty,'#8b949e',25);
      }
      pushFloatingText(this.x,this.y-30,'机关炮台!','#8b949e',1.5);
    }
    // 魂器技能：与角色技能一同释放
    triggerArtifactSkill(this.x,this.y);
    // 圆弧护盾：4件不同Boss神话装备激活，与角色技能一同释放
    if(hasFourBossMythics()){
      this.arcShield.active=true;
      this.arcShield.duration=4; // 持续4秒
      this.arcShield.angle=this.angle; // 初始角度对准玩家朝向
      spawnParticles(this.x,this.y,'#ffd700',25);
      pushFloatingText(this.x,this.y-50,'✨ 圆弧护盾!','#ffd700',1.5);
    }
    updateUI();
  }
  takeDamage(dmg){
    if(!this.alive)return; // 已死亡不再受伤（防御性编程，避免延迟伤害重复扣血）
    if(this.invincible>0)return;
    // 闪避：概率免疫伤害
    if(this.dodgeChance&&Math.random()<this.dodgeChance){
      pushFloatingText(this.x,this.y-30,'闪避!','#58a6ff',0.8);
      spawnParticles(this.x,this.y,'#58a6ff',10); return;
    }
    if(this.shield>0){
      // 护盾免疫：消耗一次免疫层
      if(this.shieldImmune&&this.shieldImmune>0){this.shieldImmune--; this.invincible=0.8; pushFloatingText(this.x,this.y-30,'护盾免疫!','#58a6ff',1); spawnParticles(this.x,this.y,'#58a6ff',20); updateUI(); return;}
      this.shield--; this.invincible=0.5; spawnParticles(this.x,this.y,'#58a6ff',12); updateUI(); return;
    }
    // Boss装备词条：雨帘护体(计蒙) - 受到伤害-15%
    if(this.dmgReduction){dmg=Math.max(1,Math.ceil(dmg*(1-this.dmgReduction)));}
    this.health-=dmg; this.invincible=CONFIG.PLAYER.INVINCIBLE_TIME;
    // 死亡复盘：统计受伤量+死因
    if(typeof runStats!=='undefined' && dmg>0){
      runStats.damageTaken+=dmg;
      // 记录死因：当前攻击来源
      if(boss && boss.alive){
        runStats.deathCause=`被 ${boss.name} 击杀`;
        runStats.deathBy={type:'boss', idx:boss.bossIndex, name:boss.name};
      }else if(this._lastEnemyHitBy){
        runStats.deathCause=`被 ${this._lastEnemyHitBy} 击杀`;
        runStats.deathBy={type:'enemy', name:this._lastEnemyHitBy};
      }else{
        runStats.deathCause='被流弹击杀';
      }
    }
    // 疾跑：受伤后1秒移速翻倍
    if(this.quickfoot){this.quickfootTimer=1;}
    // 荆棘反伤
    if(this.thornsDmg){
      // 反弹伤害给最近的敌人或Boss
      let nearest=null,nd=150;
      for(const e of enemies){if(!e.alive)continue;const d=dist(this.x,this.y,e.x,e.y);if(d<nd){nd=d;nearest=e;}}
      if(boss&&boss.alive&&dist(this.x,this.y,boss.x,boss.y)<200)nearest=boss;
      if(nearest){nearest.takeDamage(this.thornsDmg); spawnParticles(nearest.x,nearest.y,'#c0c0c0',8);}
    }
    // Boss装备词条：朱厌猿王震吼 - 受击时震退周围敌人+小范围伤害
    if(this.apeRoar){
      let hitCount=0;
      for(const e of enemies){
        if(!e.alive)continue;
        const d=dist(this.x,this.y,e.x,e.y);
        if(d<120){
          e.takeDamage(this.apeRoarDmg);
          // 震退效果：将敌人推开
          if(d>0){const kx=(e.x-this.x)/d, ky=(e.y-this.y)/d; e.x+=kx*40; e.y+=ky*40;}
          hitCount++;
        }
      }
      if(boss&&boss.alive&&dist(this.x,this.y,boss.x,boss.y)<120){
        boss.takeDamage(this.apeRoarDmg); hitCount++;
      }
      if(hitCount>0){
        spawnParticles(this.x,this.y,'#daa520',15);
        pushFloatingText(this.x,this.y-40,`🦍 震吼!`,'#daa520',0.8);
      }
    }
    spawnParticles(this.x,this.y,'#f85149',15); updateUI();
    playSound('hurt');
    flashScreen('#cc0000', 0.15); // 受击全屏红屏反馈
    screenShake = Math.max(screenShake, 0.4); // 受击轻微震屏
    if(this.health<=0){
      if(!tryRevive(this)){
        triggerDeathAnimation();
      }
    }
  }
  heal(a){this.health=Math.min(this.health+a,this.maxHealth); spawnParticles(this.x,this.y,'#3fb950',15); updateUI();}
  addShield(a){this.shield=Math.min(this.shield+a,this.maxShield); spawnParticles(this.x,this.y,'#58a6ff',15); updateUI();}
  draw(){
    // 史诗皮肤：绘制走路残影（在主体之前）
    const _skin=getEquippedSkin();
    if(_skin&&_skin.rarity==='epic'&&this.skinAfterimages&&this.skinAfterimages.length>0){
      for(const a of this.skinAfterimages){
        ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle);
        ctx.globalAlpha=(a.life/a.maxLife)*0.4;
        ctx.fillStyle=_skin.color;
        ctx.beginPath();ctx.arc(0,0,this.size*0.9,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha=1;
    }
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);
    if(this.invincible>0&&Math.floor(this.invincible*12)%2===0)ctx.globalAlpha=0.4;
    const bob=this.moving?Math.sin(this.walkPhase)*2:Math.sin(_NOW/500)*1;
    const ch=getCurrentCharacter();
    const skin=getEquippedSkin();
    const playerColor=skin?skin.color:ch.color;
    const s=this.size;
    ctx.translate(0,bob);
    // 皮肤特效光环
    if(skin){
      if(skin.rarity==='legendary'){
        // 传说皮肤：脉冲光环
        const pulse=Math.sin(_NOW/200)*0.2+0.6;
        ctx.strokeStyle=`rgba(255,215,0,${pulse})`; ctx.lineWidth=2;
        ctx.shadowColor=skin.color; ctx.shadowBlur=15;
        ctx.beginPath(); ctx.arc(0,0,s+12,0,Math.PI*2); ctx.stroke();
        ctx.shadowBlur=0;
      }else if(skin.rarity==='epic'){
        // 史诗皮肤：紫色幻影
        ctx.strokeStyle=`rgba(155,122,255,${Math.sin(_NOW/300)*0.2+0.4})`; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(0,0,s+9,0,Math.PI*2); ctx.stroke();
      }
    }
    // 护盾光环
    if(this.shield>0){ctx.strokeStyle=`rgba(88,166,255,${0.5+Math.sin(_NOW/200)*0.2})`; ctx.lineWidth=2.5; ctx.shadowColor='#58a6ff'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(0,0,s+7,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0;}
    // 身体（圆形）
    ctx.fillStyle=playerColor; ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2;
    ctx.shadowColor=playerColor; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(0,0,s*0.9,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur=0;
    // 高光
    ctx.fillStyle='rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-s*0.3,-s*0.35,s*0.25,s*0.18,-0.5,0,Math.PI*2); ctx.fill();
    // 三角形帽子（古风头巾）
    ctx.fillStyle=playerColor; ctx.strokeStyle='rgba(212,160,23,0.8)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(-s*0.7,-s*0.5); ctx.lineTo(0,-s*1.3); ctx.lineTo(s*0.7,-s*0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 帽子飘带
    ctx.strokeStyle='rgba(212,160,23,0.6)'; ctx.lineWidth=1.5; ctx.lineCap='round';
    const rib=Math.sin(_NOW/300)*s*0.15;
    ctx.beginPath(); ctx.moveTo(-s*0.5,-s*0.55); ctx.quadraticCurveTo(-s*0.9,-s*0.4+rib,-s*1.1,-s*0.6+rib); ctx.stroke();
    // 武器（小弓/枪剪影，朝右）
    ctx.strokeStyle='#8b5a2b'; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(s*0.8,0,s*0.6,-0.9,0.9); ctx.stroke();
    ctx.strokeStyle='#d4a017'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(s*0.35,-s*0.5); ctx.lineTo(s*0.35,s*0.5); ctx.stroke();
    // 眼睛（朝向）
    const look=1;
    drawCartoonEye(s*0.2,-s*0.15,s*0.18,look);
    // 眉毛（英气）
    ctx.strokeStyle=ch.color; ctx.lineWidth=2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(s*0.05,-s*0.35); ctx.lineTo(s*0.35,-s*0.3); ctx.stroke();
    ctx.restore();
    // 圆弧护盾（在身体外绘制，不随身体旋转，独立的世界角度）
    if(this.arcShield.active){
      const ar=this.arcShield;
      ctx.save();
      ctx.translate(this.x,this.y);
      ctx.rotate(ar.angle);
      const r=ar.radius;
      const half=ar.span/2;
      // 外层金色光晕
      const grad=ctx.createRadialGradient(0,0,r-8,0,0,r+10);
      grad.addColorStop(0,'rgba(255,215,0,0)');
      grad.addColorStop(0.6,'rgba(255,215,0,0.4)');
      grad.addColorStop(1,'rgba(255,215,0,0)');
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.arc(0,0,r+8,-half,half); ctx.arc(0,0,r-8,half,-half,true); ctx.closePath(); ctx.fill();
      // 主圆弧（粗金色实线）
      ctx.strokeStyle='#ffd700'; ctx.lineWidth=5; ctx.lineCap='round';
      ctx.shadowColor='#ffd700'; ctx.shadowBlur=18;
      ctx.beginPath(); ctx.arc(0,0,r,-half,half); ctx.stroke();
      // 内层白色亮线
      ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=1.5; ctx.shadowBlur=0;
      ctx.beginPath(); ctx.arc(0,0,r,-half,half); ctx.stroke();
      // 旋转方向粒子尾迹
      const tailA=-half;
      for(let i=0;i<3;i++){
        const ta=tailA-i*0.05;
        const tx=Math.cos(ta)*r, ty=Math.sin(ta)*r;
        ctx.fillStyle=`rgba(255,215,0,${0.6-i*0.2})`;
        ctx.beginPath(); ctx.arc(tx,ty,3-i,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
    // 头顶血条（不随身体旋转）
    const barW=44,barH=5,barY=this.y-this.size-18;
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(this.x-barW/2-1,barY-1,barW+2,barH+2);
    const hpPct=Math.max(0,this.health/this.maxHealth);
    const hpGrad=ctx.createLinearGradient(this.x-barW/2,0,this.x+barW/2,0);
    hpGrad.addColorStop(0,'#f85149'); hpGrad.addColorStop(1,'#fb8548');
    ctx.fillStyle=hpGrad; ctx.fillRect(this.x-barW/2,barY,barW*hpPct,barH);
    // 护盾条
    if(this.shield>0){
      ctx.fillStyle='#58a6ff'; ctx.fillRect(this.x-barW/2,barY-barH-2,barW*(this.shield/this.maxShield),3);
    }
    // 技能CD条
    const cdPct=1-this.skillCooldown/this.maxSkillCooldown;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(this.x-barW/2-1,barY+barH+1,barW+2,4);
    const cdGrad=ctx.createLinearGradient(this.x-barW/2,0,this.x+barW/2,0);
    cdGrad.addColorStop(0,'#bc8cff'); cdGrad.addColorStop(1,'#d2a8ff');
    ctx.fillStyle=cdGrad; ctx.fillRect(this.x-barW/2,barY+barH+2,barW*cdPct,3);
    // CD就绪标记
    if(this.skillCooldown<=0){
      ctx.fillStyle='#d2a8ff'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center';
      ctx.fillText('F',this.x,barY+barH+12);
    }
  }
}

// ==================== 跟班 ====================
class Minion {
  constructor(x,y,permanent=false){
    this.x=x;this.y=y;this.size=14;this.alive=true;
    this.permanent=permanent; // permanent=true: 强化获得，永久存在；false: 技能召唤，临时存在
    this.lifetime=permanent?Infinity:5; // 永久灵仆不过期
    this.fireCooldown=0;this.angle=0;this.orbitAngle=rand(0,Math.PI*2);this.wobble=0;
  }
  update(dt){
    if(!this.permanent){ this.lifetime-=dt; if(this.lifetime<=0){this.alive=false; spawnParticles(this.x,this.y,'#bc8cff',15); return;} }
    this.wobble+=dt*5; this.orbitAngle+=dt*1.5;
    if(player){const tx=player.x+Math.cos(this.orbitAngle)*80,ty=player.y+Math.sin(this.orbitAngle)*80; this.x+=(tx-this.x)*5*dt; this.y+=(ty-this.y)*5*dt;}
    let target=null,nd=300;
    for(const e of enemies){if(!e.alive)continue; const d=dist(this.x,this.y,e.x,e.y); if(d<nd){nd=d;target=e;}}
    if(boss&&boss.alive){const d=dist(this.x,this.y,boss.x,boss.y); if(d<nd*1.5)target=boss;}
    if(target){
      this.angle=Math.atan2(target.y-this.y,target.x-this.x);
      if(this.fireCooldown<=0){
        this.fireCooldown=0.3;
        const ic=Math.random()<(player?.critChance||0);
        const dmg=ic?(player?.bulletDamage||1)*(player?.critDamage||2):(player?.bulletDamage||1);
        bullets.push(new Bullet(this.x,this.y,this.angle,{speed:500,damage:dmg,size:4,isCrit:ic,elementEffects:player?{...player.elementEffects}:{},finalUpgrades:player?[...player.finalUpgrades]:[],specialEffects:player?{...player.specialEffects}:{},finalSpecials:player?[...player.finalSpecials]:[]}));
      }
    }
    if(this.fireCooldown>0)this.fireCooldown-=dt;
  }
  draw(){
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.angle);
    ctx.globalAlpha=0.75+Math.sin(this.wobble)*0.2;
    const s=this.size;
    // 翅膀拍动
    const wing=Math.sin(this.wobble*3)*s*0.4;
    ctx.fillStyle='rgba(188,140,255,0.5)';ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(-s*0.6,-s*0.3,s*0.5,s*0.3+wing*0.3,-0.5,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(s*0.6,-s*0.3,s*0.5,s*0.3+wing*0.3,0.5,0,Math.PI*2);ctx.fill();ctx.stroke();
    // 发光身体
    ctx.fillStyle='#bc8cff';ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1.5;
    ctx.shadowColor='#bc8cff';ctx.shadowBlur=12;
    ctx.beginPath();ctx.arc(0,0,s*0.7,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;
    // 高光
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.beginPath();ctx.ellipse(-s*0.2,-s*0.25,s*0.18,s*0.12,-0.5,0,Math.PI*2);ctx.fill();
    // 眼睛
    drawCartoonEye(-s*0.2,-s*0.05,s*0.15,1);
    drawCartoonEye(s*0.2,-s*0.05,s*0.15,1);
    ctx.restore();
  }
}

// ==================== 道士符箓 ====================
class TaoistTalisman {
  constructor(x,y,idx){
    this.x=x;this.y=y;this.size=12;this.alive=true;this.lifetime=6;
    this.orbitAngle=(idx/3)*Math.PI*2;this.idx=idx;
    this.fireCooldown=0.5;this.angle=0;this.wobble=0;
  }
  update(dt){
    this.lifetime-=dt; if(this.lifetime<=0){this.alive=false; spawnParticles(this.x,this.y,'#3fb950',12); return;}
    this.wobble+=dt*4; this.orbitAngle+=dt*2.5;
    if(player){const tx=player.x+Math.cos(this.orbitAngle)*70,ty=player.y+Math.sin(this.orbitAngle)*70; this.x+=(tx-this.x)*6*dt; this.y+=(ty-this.y)*6*dt;}
    let target=null,nd=320;
    for(const e of enemies){if(!e.alive)continue; const d=dist(this.x,this.y,e.x,e.y); if(d<nd){nd=d;target=e;}}
    if(boss&&boss.alive){const d=dist(this.x,this.y,boss.x,boss.y); if(d<nd*1.5)target=boss;}
    if(target){
      this.angle=Math.atan2(target.y-this.y,target.x-this.x);
      if(this.fireCooldown<=0){
        this.fireCooldown=0.4;
        const ic=Math.random()<(player?.critChance||0);
        const dmg=ic?(player?.bulletDamage||1)*(player?.critDamage||2)*1.2:(player?.bulletDamage||1)*1.2;
        bullets.push(new Bullet(this.x,this.y,this.angle,{speed:600,damage:dmg,size:5,pierce:1,isCrit:ic,elementEffects:player?{...player.elementEffects}:{},finalUpgrades:player?[...player.finalUpgrades]:[],specialEffects:player?{...player.specialEffects}:{},finalSpecials:player?[...player.finalSpecials]:[]}));
      }
    }
    if(this.fireCooldown>0)this.fireCooldown-=dt;
  }
  draw(){
    ctx.save();ctx.translate(this.x,this.y);
    ctx.globalAlpha=0.8+Math.sin(this.wobble)*0.15;
    const s=this.size;
    ctx.rotate(this.angle);
    // 符箓本体（长方形纸符）
    ctx.fillStyle='#f5deb3';ctx.strokeStyle='#3fb950';ctx.lineWidth=1.5;
    ctx.shadowColor='#3fb950';ctx.shadowBlur=8;
    ctx.fillRect(-s*0.5,-s*0.7,s,s*1.4);
    ctx.strokeRect(-s*0.5,-s*0.7,s,s*1.4);
    ctx.shadowBlur=0;
    // 符文
    ctx.fillStyle='#3fb950';ctx.font=`bold ${s*0.8}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('符',0,0);
    ctx.restore();
  }
}

// ==================== 机关师炮台 ====================
class EngineerTurret {
  constructor(x,y){
    this.x=x;this.y=y;this.size=16;this.alive=true;this.lifetime=8;
    this.fireCooldown=0;this.angle=0;
  }
  update(dt){
    this.lifetime-=dt; if(this.lifetime<=0){this.alive=false; spawnParticles(this.x,this.y,'#8b949e',15); return;}
    let target=null,nd=350;
    for(const e of enemies){if(!e.alive)continue; const d=dist(this.x,this.y,e.x,e.y); if(d<nd){nd=d;target=e;}}
    if(boss&&boss.alive){const d=dist(this.x,this.y,boss.x,boss.y); if(d<nd*1.5)target=boss;}
    if(target){
      this.angle=Math.atan2(target.y-this.y,target.x-this.x);
      if(this.fireCooldown<=0){
        this.fireCooldown=0.15;
        const ic=Math.random()<(player?.critChance||0)*0.5;
        const dmg=(player?.bulletDamage||1)*0.7;
        bullets.push(new Bullet(this.x,this.y,this.angle,{speed:700,damage:dmg,size:4,pierce:1,isCrit:ic,elementEffects:player?{...player.elementEffects}:{},finalUpgrades:player?[...player.finalUpgrades]:[],specialEffects:player?{...player.specialEffects}:{},finalSpecials:player?[...player.finalSpecials]:[]}));
      }
    }
    if(this.fireCooldown>0)this.fireCooldown-=dt;
  }
  draw(){
    ctx.save();ctx.translate(this.x,this.y);
    const s=this.size;
    // 底座
    ctx.fillStyle='#3a3a3a';ctx.strokeStyle='#8b949e';ctx.lineWidth=1.5;
    ctx.shadowColor='#8b949e';ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(0,0,s,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;
    // 炮管
    ctx.rotate(this.angle);
    ctx.fillStyle='#5a5a5a';ctx.strokeStyle='#8b949e';
    ctx.fillRect(0,-s*0.3,s*1.2,s*0.6);
    ctx.strokeRect(0,-s*0.3,s*1.2,s*0.6);
    // 寿命指示器
    ctx.rotate(-this.angle);
    ctx.fillStyle='#f0883e';ctx.font='bold 9px sans-serif';ctx.textAlign='center';
    ctx.fillText(Math.ceil(this.lifetime)+'s',0,s+10);
    ctx.restore();
  }
}

// ==================== 子弹 ====================
class Bullet {
  constructor(x,y,angle,opts={}){
    this.x=x;this.y=y;this.angle=angle;this.size=opts.size||CONFIG.PLAYER.BULLET_SIZE;
    this.speed=opts.speed||CONFIG.PLAYER.BULLET_SPEED;this.damage=opts.damage||CONFIG.PLAYER.BULLET_DAMAGE;
    this.pierce=opts.pierce||0;this.homing=opts.homing||0;this.bounce=opts.bounce||0;
    this.hitEnemies=new Set();this.trail=[];this.alive=true;this.isCrit=opts.isCrit||false;
    this.elementEffects=opts.elementEffects||{};this.finalUpgrades=opts.finalUpgrades||[];
    this.specialEffects=opts.specialEffects||{};this.finalSpecials=opts.finalSpecials||[];
    this.chainedEnemies=new Set();this.lifesteal=opts.lifesteal||0;
    this.weaponId=opts.weaponId||null; // 武器ID，用于差异化视觉
    this.spin=Math.random()*Math.PI*2; // 旋转动画(震天锤用)
    // 武器攻击机制差异
    this.chainCount=opts.chainCount||0; // 雷神炮闪电链剩余跳跃次数
    this.hasExploded=false; // 震天锤是否已爆炸
    this.voidTrail=opts.voidTrail||false; // 虚空之弓是否留下虚空裂缝
    this.voidTimer=0; // 虚空之弓裂缝计时器
    // 刑天干戚专属：回旋斧机制
    this.boomerang=opts.boomerang||false; // 是否为回旋子弹
    this.boomerangTime=0; // 回旋时间
    this.boomerangMaxDist=opts.boomerangMaxDist||420; // 最大飞行距离
    this.boomerangPhase=0; // 0=飞出, 1=返回
    this.originX=opts.originX||x; // 起点X
    this.originY=opts.originY||y; // 起点Y
    // 奇遇/强化：爆破子弹（命中爆炸）
    this.bulletExplode=opts.bulletExplode||0;
    // 奇遇：子弹分裂（命中分裂出额外子弹，剩余可分裂次数）
    this.bulletSplit=opts.bulletSplit||0;
    // 分裂代数，防止伤害无限继承
    this.splitGen=opts.splitGen||0;
  }
  update(dt){
    // 诸葛连弩/神臂弓等高速武器减少trail长度以优化性能
    const maxTrail=(this.weaponId==='crossbow'||this.weaponId==='bow')?4:8;
    // 性能优化：复用对象，避免每帧 new {x,y}
    if(this.trail.length>=maxTrail){
      // 移动到队首（避免shift的O(n)）
      const t=this.trail.shift();
      t.x=this.x; t.y=this.y; this.trail.push(t);
    }else{
      this.trail.push({x:this.x,y:this.y});
    }
    // life属性：魂器子弹等可以设置life限制寿命
    if(this.life!==undefined){
      this.life-=dt;
      if(this.life<=0){this.alive=false; return;}
    }
    // 虚空之弓：飞行时留下虚空裂缝（持续1秒，对经过敌人造成伤害）
    if(this.voidTrail){
      this.voidTimer+=dt;
      if(this.voidTimer>=0.08){
        this.voidTimer=0;
        fireEffects.push({x:this.x,y:this.y,radius:22,damage:0.4,life:1,maxLife:1,burnDmg:0.4,tick:0,chain:0,voidRift:true});
      }
    }
    if(this.homing>0){
      let nearest=null,nd=200;
      for(const e of enemies){if(!e.alive||this.hitEnemies.has(e))continue; const d=dist(this.x,this.y,e.x,e.y); if(d<nd){nd=d;nearest=e;}}
      if(boss&&boss.alive&&!this.hitEnemies.has(boss)){const d=dist(this.x,this.y,boss.x,boss.y); if(d<nd*1.5)nearest=boss;}
      if(nearest){const ta=Math.atan2(nearest.y-this.y,nearest.x-this.x); let diff=ta-this.angle; while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2; this.angle+=diff*this.homing*dt;}
    }
    // 刑天干戚回旋机制：飞出最大距离后折返，折返时重置命中列表实现二次伤害
    if(this.boomerang){
      this.boomerangTime+=dt;
      if(this.boomerangPhase===0){
        // 飞出阶段
        this.x+=Math.cos(this.angle)*this.speed*dt;
        this.y+=Math.sin(this.angle)*this.speed*dt;
        const d=dist(this.x,this.y,this.originX,this.originY);
        if(d>=this.boomerangMaxDist){
          this.boomerangPhase=1; // 切换到返回阶段
          this.hitEnemies=new Set(); // 清空命中列表，允许二次伤害
          // 返回角度：朝向玩家当前位置
          if(player)this.angle=Math.atan2(player.y-this.y,player.x-this.x);
        }
      }else{
        // 返回阶段：追踪玩家
        if(player){
          const ta=Math.atan2(player.y-this.y,player.x-this.x);
          let diff=ta-this.angle; while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2;
          this.angle+=diff*5*dt; // 较强的追踪
        }
        this.x+=Math.cos(this.angle)*this.speed*1.2*dt;
        this.y+=Math.sin(this.angle)*this.speed*1.2*dt;
        // 回到玩家附近时消失
        if(player&&dist(this.x,this.y,player.x,player.y)<player.size+10){
          this.alive=false;
          spawnParticles(this.x,this.y,'#ff4500',10);
        }
      }
      // 旋转动画(回旋斧旋转更快)
      this.spin+=0.6;
      // 超时保护
      if(this.boomerangTime>4)this.alive=false;
    }else{
      this.x+=Math.cos(this.angle)*this.speed*dt; this.y+=Math.sin(this.angle)*this.speed*dt;
    }
    if(this.bounce>0){
      if(this.x<=this.size||this.x>=CONFIG.WIDTH-this.size){this.angle=Math.PI-this.angle;this.x=clamp(this.x,this.size,CONFIG.WIDTH-this.size);this.bounce--;spawnParticles(this.x,this.y,'#ffd700',4);}
      if(this.y<=this.size||this.y>=CONFIG.HEIGHT-this.size){this.angle=-this.angle;this.y=clamp(this.y,this.size,CONFIG.HEIGHT-this.size);this.bounce--;spawnParticles(this.x,this.y,'#ffd700',4);}
    }
    if(!this.boomerang){
      if(this.x<-30||this.x>CONFIG.WIDTH+30||this.y<-30||this.y>CONFIG.HEIGHT+30)this.alive=false;
    }
  }
  getBaseColor(){
    if(this.elementEffects.ice)return '#79c0ff';
    if(this.elementEffects.lightning)return '#fff700';
    if(this.specialEffects.fireball)return '#ff6b35';
    // 武器专属颜色
    if(this.weaponId==='thunder')return '#ffe066';
    if(this.weaponId==='voidbow')return '#c084fc';
    if(this.weaponId==='xingtiangeqi')return '#ff4500';
    if(this.weaponId==='crossbow')return '#a3e635';
    if(this.weaponId==='sniper')return '#60a5fa';
    if(this.weaponId==='hammer')return '#fb923c';
    if(this.weaponId==='shotgun')return '#fbbf24';
    if(this.weaponId==='bow')return '#34d399';
    return '#ffd700';
  }
  draw(){
    const c=this.getBaseColor();
    const critColor='#fffacd';
    const drawColor=this.isCrit?critColor:c;
    const cr=(col)=>`rgba(${parseInt(col.substr(1,2),16)},${parseInt(col.substr(3,2),16)},${parseInt(col.substr(5,2),16)},`;
    // 武器专属拖尾
    for(let i=0;i<this.trail.length;i++){
      const t=this.trail[i],a=(i/this.trail.length)*0.4,s=this.size*(i/this.trail.length)*0.8;
      ctx.fillStyle=this.isCrit?`rgba(255,250,205,${a})`:`${cr(c)}${a})`;
      if(this.weaponId==='thunder'){
        // 雷神炮：锯齿状闪电拖尾
        ctx.fillRect(t.x-s/2,t.y-s/2,s,s);
      }else if(this.weaponId==='voidbow'){
        // 虚空之弓：星点拖尾
        if(i%2===0)ctx.beginPath(),ctx.arc(t.x,t.y,s*0.6,0,Math.PI*2),ctx.fill();
      }else{
        ctx.beginPath();ctx.arc(t.x,t.y,s,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.fillStyle=drawColor; ctx.shadowColor=drawColor; ctx.shadowBlur=this.isCrit?22:(this.weaponId==='crossbow'?6:12);
    // 武器专属主体
    if(this.weaponId==='hammer'){
      // 震天锤：旋转方块
      this.spin+=0.3;
      ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.spin);
      ctx.fillRect(-this.size,-this.size,this.size*2,this.size*2);
      ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(255,255,255,0.8)';ctx.lineWidth=2;ctx.strokeRect(-this.size,-this.size,this.size*2,this.size*2);
      ctx.restore();
    }else if(this.weaponId==='thunder'){
      // 雷神炮：闪电球+电弧
      ctx.beginPath();ctx.arc(this.x,this.y,this.size,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      ctx.strokeStyle=`rgba(255,224,102,${0.6+Math.sin(_NOW/100)*0.3})`;ctx.lineWidth=1.5;
      for(let i=0;i<3;i++){
        const a=Math.random()*Math.PI*2, r1=this.size+2, r2=this.size+6+Math.random()*4;
        ctx.beginPath();ctx.moveTo(this.x+Math.cos(a)*r1,this.y+Math.sin(a)*r1);
        ctx.lineTo(this.x+Math.cos(a)*r2,this.y+Math.sin(a)*r2);ctx.stroke();
      }
    }else if(this.weaponId==='voidbow'){
      // 虚空之弓：紫黑洞口+空间裂缝
      ctx.beginPath();ctx.arc(this.x,this.y,this.size,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      // 空间裂缝环
      ctx.strokeStyle=`rgba(192,132,252,${0.7+Math.sin(_NOW/120)*0.2})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(this.x,this.y,this.size+4,0,Math.PI*2);ctx.stroke();
      // 旋转的小裂缝
      for(let i=0;i<3;i++){
        const a=_NOW/200+i*Math.PI*2/3;
        ctx.beginPath();ctx.moveTo(this.x+Math.cos(a)*(this.size+2),this.y+Math.sin(a)*(this.size+2));
        ctx.lineTo(this.x+Math.cos(a)*(this.size+8),this.y+Math.sin(a)*(this.size+8));ctx.stroke();
      }
    }else if(this.weaponId==='crossbow'){
      // 诸葛连弩：箭矢形（拉长椭圆）
      ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.angle);
      ctx.beginPath();ctx.ellipse(0,0,this.size*1.5,this.size*0.6,0,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      ctx.restore();
    }else if(this.weaponId==='sniper'){
      // 狙击枪：细长光束
      ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.angle);
      ctx.fillRect(-this.size*1.5,-this.size*0.4,this.size*3,this.size*0.8);
      ctx.shadowBlur=0;
      ctx.restore();
    }else if(this.weaponId==='bow'){
      // 神臂弓：青色箭头
      ctx.beginPath();ctx.arc(this.x,this.y,this.size,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
    }else if(this.weaponId==='xingtiangeqi'){
      // 刑天干戚：旋转的战斧(双刃斧头+红色火焰拖尾) — spin由update()递增，这里只读取
      ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.spin);
      const s=this.size;
      // 外层红色火焰光晕
      ctx.shadowColor='#ff4500'; ctx.shadowBlur=18;
      ctx.fillStyle='rgba(255,69,0,0.5)';
      ctx.beginPath();ctx.arc(0,0,s*1.6,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      // 斧柄：暗灰色长杆
      ctx.strokeStyle='#3a2a1a'; ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(0,-s*1.2);ctx.lineTo(0,s*1.2);ctx.stroke();
      // 上斧刃：银白色月牙(带红色镶边)
      ctx.fillStyle='#e8e8e8'; ctx.strokeStyle='#ff4500'; ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(0,-s*1.2);
      ctx.quadraticCurveTo(s*1.3,-s*1.0, s*0.9,-s*0.5);
      ctx.quadraticCurveTo(s*0.4,-s*0.85, 0,-s*0.6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // 下斧刃：对称
      ctx.beginPath();
      ctx.moveTo(0,s*1.2);
      ctx.quadraticCurveTo(s*1.3,s*1.0, s*0.9,s*0.5);
      ctx.quadraticCurveTo(s*0.4,s*0.85, 0,s*0.6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // 中心装饰：血红宝石
      ctx.fillStyle='#8b0000';
      ctx.beginPath();ctx.arc(0,0,s*0.3,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ff4500';
      ctx.beginPath();ctx.arc(0,0,s*0.15,0,Math.PI*2);ctx.fill();
      ctx.restore();
      // 回旋阶段标记：返回时拖尾更激烈
      if(this.boomerangPhase===1){
        ctx.fillStyle='rgba(255,69,0,0.3)';
        ctx.beginPath();ctx.arc(this.x,this.y,s*2.0,0,Math.PI*2);ctx.fill();
      }
    }else{
      // 默认：圆形子弹
      ctx.beginPath();ctx.arc(this.x,this.y,this.size,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
    }
    // 玩家子弹白色内核（区分敌方子弹）
    if(this.weaponId!=='hammer'&&this.weaponId!=='voidbow'&&this.weaponId!=='xingtiangeqi'){
      ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.beginPath();ctx.arc(this.x,this.y,Math.max(1,this.size*0.45),0,Math.PI*2);ctx.fill();
    }
    if(this.pierce>0){ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(this.x,this.y,this.size+2,0,Math.PI*2);ctx.stroke();}
    if(this.elementEffects.ice){ctx.strokeStyle='rgba(121,192,255,0.8)';ctx.lineWidth=1;for(let i=0;i<4;i++){const a=(i/4)*Math.PI*2+_NOW/500;ctx.beginPath();ctx.moveTo(this.x,this.y);ctx.lineTo(this.x+Math.cos(a)*(this.size+3),this.y+Math.sin(a)*(this.size+3));ctx.stroke();}}
    if(this.specialEffects.fireball){ctx.fillStyle='rgba(255,107,53,0.4)';ctx.beginPath();ctx.arc(this.x,this.y,this.size+3,0,Math.PI*2);ctx.fill();}
  }
}

// ==================== 敌方子弹 ====================
class EnemyBullet {
  constructor(x,y,angle,speed=180,size=6,color='#ff3860'){this.x=x;this.y=y;this.angle=angle;this.speed=speed;this.size=size;this.color=color;this.alive=true;this.trail=[];this.homing=0;this.life=8;}
  update(dt){
    // 拖尾长度3，对象池模式（避免GC）— 先判后 shift，net 0 增长
    if(this.trail.length>=3){
      const t=this.trail.shift();
      t.x=this.x; t.y=this.y;
      this.trail.push(t);
    }else{
      this.trail.push({x:this.x,y:this.y});
    }
    this.life-=dt; if(this.life<=0)this.alive=false;
    // 追踪：宠物子弹追踪敌人，敌方子弹追踪玩家
    if(this.homing>0){
      let target=null;
      if(this.fromPet){
        // 宠物子弹追踪最近的敌人或Boss
        let nd=400;
        for(const e of enemies){if(!e.alive)continue;const d=dist(this.x,this.y,e.x,e.y);if(d<nd){nd=d;target=e;}}
        if(boss&&boss.alive){const d=dist(this.x,this.y,boss.x,boss.y);if(d<nd*1.5)target=boss;}
      }else if(player){
        target=player;
      }
      if(target){
        const ta=Math.atan2(target.y-this.y,target.x-this.x);
        let diff=ta-this.angle; while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2;
        this.angle+=diff*this.homing*dt;
      }
    }
    this.x+=Math.cos(this.angle)*this.speed*dt; this.y+=Math.sin(this.angle)*this.speed*dt;
    if(this.x<-30||this.x>CONFIG.WIDTH+30||this.y<-30||this.y>CONFIG.HEIGHT+30)this.alive=false;
  }
  draw(){
    // 拖尾统一红色系（透明度降低，避免遮挡视线）
    for(let i=0;i<this.trail.length;i++){const t=this.trail[i],a=(i/this.trail.length)*0.22;ctx.fillStyle=`rgba(255,56,96,${a})`;ctx.beginPath();ctx.arc(t.x,t.y,this.size*(i/this.trail.length),0,Math.PI*2);ctx.fill();}
    // 红色外环（区分玩家子弹）
    ctx.strokeStyle='rgba(255,56,96,0.8)';ctx.lineWidth=2;ctx.shadowColor='#ff3860';ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(this.x,this.y,this.size+1.5,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    // 主体
    ctx.fillStyle=this.color;ctx.shadowColor=this.color;ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(this.x,this.y,this.size,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    // 深色内核（与玩家白色内核区分）
    ctx.fillStyle='rgba(80,0,20,0.7)';
    ctx.beginPath();ctx.arc(this.x,this.y,Math.max(1,this.size*0.4),0,Math.PI*2);ctx.fill();
  }
}

// ==================== 掉落物 ====================
class Drop {
  constructor(x,y,type,amount,gearData){
    this.x=x;this.y=y;this.type=type;this.amount=amount||0;
    this.gear=gearData||null; // 装备掉落（小怪1%概率）
    this.size= this.type==='xp'?10:(this.type==='gear'?14:12); this.alive=true;this.lifetime=10;
    this.wobble=rand(0,Math.PI*2);this.bobOffset=0;
    // 经验球被吸引但不会被立即拾取，给玩家主动拾取的体验
    this.xpPullRange=80; // 经验球吸引范围（小于磁铁范围，避免全屏吸）
  }
  update(dt){
    this.lifetime-=dt;this.wobble+=dt*3;this.bobOffset=Math.sin(this.wobble)*3;
    if(this.lifetime<=0){this.alive=false;return;}
    if(!player||!player.alive)return;
    const d=dist(this.x,this.y,player.x,player.y);
    // 经验球：进入吸引范围后飞向玩家，玩家触碰才拾取
    if(this.type==='xp'){
      if(d<this.xpPullRange){
        // 飞向玩家
        const sp=240*dt;
        const a=Math.atan2(player.y-this.y,player.x-this.x);
        this.x+=Math.cos(a)*sp; this.y+=Math.sin(a)*sp;
      }
      if(d<player.size+this.size){ this.pickup(); }
    }else{
      // 其他掉落物：磁铁范围内立即拾取
      const range=(player?.magnetRange||60);
      if(d<range)this.pickup();
    }
  }
  pickup(){
    this.alive=false;
    if(this.type==='health'){player.heal(2);pushFloatingText(this.x,this.y-10,'+2 HP','#3fb950',1);}
    else if(this.type==='shield'){player.addShield(2);pushFloatingText(this.x,this.y-10,'+2 护盾','#58a6ff',1);}
    else if(this.type==='coin'){score+=18;pushFloatingText(this.x,this.y-10,'+18','#f0883e',1);updateUI();}
    else if(this.type==='xp'){player.gainXp(this.amount);}
    else if(this.type==='gear'&&this.gear){
      // 装备掉落：直接放入背包
      saveData.gearBag.push(this.gear);
      const rar=(typeof GEAR_RARITIES!=='undefined'&&GEAR_RARITIES[this.gear.rarity])||{color:'#f0883e',name:'装备'};
      pushFloatingText(this.x,this.y-10,`+${rar.name||'装备'}`,rar.color||'#f0883e',1.4);
      spawnParticles(this.x,this.y,rar.color||'#f0883e',18);
      if(typeof runStats!=='undefined')runStats.gearsDropped=(runStats.gearsDropped||0)+1;
      saveSave();
    }
    spawnParticles(this.x,this.y,this.getColor(),10);
  }
  getColor(){
    if(this.type==='gear'&&this.gear){
      const rar=(typeof GEAR_RARITIES!=='undefined'&&GEAR_RARITIES[this.gear.rarity])||{color:'#f0883e'};
      return rar.color||'#f0883e';
    }
    return this.type==='health'?'#3fb950':this.type==='shield'?'#58a6ff':this.type==='xp'?'#bc8cff':'#f0883e';
  }
  draw(){
    ctx.save();ctx.translate(this.x,this.y+this.bobOffset);
    const c=this.getColor(),a=this.lifetime<3?(Math.sin(this.lifetime*8)*0.3+0.7):1;
    ctx.globalAlpha=a;ctx.shadowColor=c;ctx.shadowBlur=12;
    if(this.type==='health'){ctx.fillStyle=c;ctx.fillRect(-4,-8,8,16);ctx.fillRect(-8,-4,16,8);}
    else if(this.type==='shield'){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(10,-5);ctx.lineTo(8,8);ctx.lineTo(0,12);ctx.lineTo(-8,8);ctx.lineTo(-10,-5);ctx.closePath();ctx.fill();}
    else if(this.type==='xp'){
      // 经验球：紫色发光球体 + 内部高光
      const pulse=1+Math.sin(_NOW/200)*0.1;
      ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,0,this.size*0.8*pulse,0,Math.PI*2);ctx.fill();
      // 内部高光
      ctx.fillStyle='rgba(255,255,255,0.6)';ctx.beginPath();ctx.arc(-this.size*0.25,-this.size*0.25,this.size*0.25,0,Math.PI*2);ctx.fill();
      // 中心星形（小）
      ctx.fillStyle='#ffd970';ctx.beginPath();ctx.arc(0,0,this.size*0.2,0,Math.PI*2);ctx.fill();
    }else if(this.type==='gear'){
      // 装备掉落：旋转菱形+内部图标
      const rot=_NOW/600;
      ctx.rotate(rot);
      ctx.fillStyle=c;
      ctx.beginPath();ctx.moveTo(0,-this.size);ctx.lineTo(this.size,0);ctx.lineTo(0,this.size);ctx.lineTo(-this.size,0);ctx.closePath();ctx.fill();
      // 内部白色高光
      ctx.fillStyle='rgba(255,255,255,0.85)';ctx.beginPath();ctx.arc(0,0,this.size*0.35,0,Math.PI*2);ctx.fill();
      ctx.rotate(-rot);
      // 装备图标（部件名首字）
      const slotIcon={helmet:'🪖',armor:'🛡️',boots:'👟',ring:'💍'}[this.gear?.slot]||'⚔️';
      ctx.font=`${this.size}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(slotIcon,0,1);
    }else{ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,0,this.size*0.7,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
}

// ==================== 敌人 ====================
// 卡通眼睛辅助函数
function drawCartoonEye(x,y,r,look=0){
  // 性能优化：使用全局 _NOW 替代 Date.now()（每帧入口取一次）
  const now=_NOW||Date.now();
  const blink=Math.sin(now/600+x)>0.96?0.1:1;
  ctx.fillStyle='white';
  ctx.beginPath();ctx.ellipse(x,y,r,r*blink,0,0,Math.PI*2);ctx.fill();
  if(blink>0.5){
    const px=x+Math.sin(now/400+x)*r*0.25+look*r*0.3;
    const py=y+Math.cos(now/500+x)*r*0.1;
    ctx.fillStyle='#1a1a1a';
    ctx.beginPath();ctx.arc(px,py,r*0.55,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.beginPath();ctx.arc(px-r*0.22,py-r*0.22,r*0.18,0,Math.PI*2);ctx.fill();
  }
}
// 卡通小嘴辅助
function drawCartoonMouth(y,w,smile=true){
  ctx.strokeStyle='rgba(0,0,0,0.55)';ctx.lineWidth=1.8;ctx.lineCap='round';
  ctx.beginPath();
  if(smile)ctx.arc(0,y,w,0.2,Math.PI-0.2);
  else ctx.arc(0,y+w,w*0.8,Math.PI+0.2,Math.PI*2-0.2);
  ctx.stroke();
}
class Enemy {
  constructor(type='grunt',waveBonus=0){
    const td=CONFIG.ENEMY_TYPES[type]; this.type=type; this.size=td.size;
    const diff=getDifficulty();
    this.baseSpeed=td.speed*diff.enemySpdMul; this.speed=this.baseSpeed*(1+waveBonus*0.05);
    // HP成长曲线：线性+平方项（后期血量加速增长，匹配玩家强度）
    // 公式：base × (1 + waveBonus×grow + waveBonus²×grow2) × enemyHpMul
    const grow=diff.waveHpGrow||0.10;
    const grow2=diff.waveHpGrow2||0.004;
    this.maxHealth=Math.ceil(td.health*(1+waveBonus*grow+waveBonus*waveBonus*grow2)*diff.enemyHpMul); this.health=this.maxHealth;
    this.score=td.score; this.xp=td.xp||1; this.color=td.color; this.shape=td.shape; this.tier=td.tier;
    this.shoots=td.shoots||false; this.shootCooldown=td.shootCooldown||0;
    this.shootTimer=this.shootCooldown?rand(1,this.shootCooldown):0;
    this.invincibleTime=td.invincibleTime||0; this.taunt=td.taunt||false; this.suicidal=td.suicidal||false;
    this.splits=td.splits||0; this.splitInto=td.splitInto||null; // 分裂怪属性
    this.twoHealthBars=this.taunt; this.secondBar=this.taunt;
    this.armor=diff.enemyArmor||0; // 难度护甲减免（弑神35%减伤）
    const side=randInt(0,3);
    if(side===0){this.x=rand(40,CONFIG.WIDTH-40);this.y=-this.size-10;}
    else if(side===1){this.x=CONFIG.WIDTH+this.size+10;this.y=rand(40,CONFIG.HEIGHT-40);}
    else if(side===2){this.x=rand(40,CONFIG.WIDTH-40);this.y=CONFIG.HEIGHT+this.size+10;}
    else{this.x=-this.size-10;this.y=rand(40,CONFIG.HEIGHT-40);}
    this.wobble=rand(0,Math.PI*2); this.alive=true; this.hitFlash=0;
    this.angle=0; this.slowFactor=1; this.slowTimer=0; this.frozen=false; this.frozenTimer=0;
    this.animTime=0; this.walkPhase=0; this.attackAnim=0; this.attackAnimMax=0.3;  // 动画状态
  }
  update(dt){
    if(!player)return;
    if(this.slowTimer>0){this.slowTimer-=dt; if(this.slowTimer<=0)this.slowFactor=1;}
    if(this.frozenTimer>0){this.frozenTimer-=dt; if(this.frozenTimer<=0)this.frozen=false;}
    if(this.invincibleTime>0){this.invincibleTime-=dt;}
    if(this.frozen)return;
    // Boss装备词条：魅惑子弹(九尾狐) - 混乱状态攻击其他敌人
    if(this.charmed){
      this.charmed-=dt;
      if(this.charmed<=0){this.charmed=0; spawnParticles(this.x,this.y,'#ff69b4',5);}
      else{
        // 寻找最近的非魅惑敌人作为目标
        let target=null,nd=300;
        for(const e of enemies){
          if(e===this||!e.alive||e.charmed)continue;
          const d=dist(this.x,this.y,e.x,e.y);
          if(d<nd){nd=d;target=e;}
        }
        if(target){
          this.angle=Math.atan2(target.y-this.y,target.x-this.x);
          const sp=this.speed*this.slowFactor*globalSlow*0.8; // 稍微减速
          this.x+=Math.cos(this.angle)*sp*dt; this.y+=Math.sin(this.angle)*sp*dt;
          // 接触时对其他敌人造成伤害
          if(nd<this.size+target.size){
            target.takeDamage(3,this);
            spawnParticles(target.x,target.y,'#ff69b4',6);
          }
          return;
        }
        // 周围没有其他敌人时，原地徘徊
        const _wanderSp=this.speed*this.slowFactor*globalSlow*0.3;
        this.x+=Math.cos(this.angle+dt*2)*_wanderSp*dt;
        this.y+=Math.sin(this.angle+dt*2)*_wanderSp*dt;
        return;
      }
    }
    this.wobble+=dt*3; if(this.hitFlash>0)this.hitFlash-=dt;
    this.animTime+=dt; this.walkPhase+=dt*8; if(this.attackAnim>0)this.attackAnim-=dt;
    const d=dist(this.x,this.y,player.x,player.y);
    this.angle=Math.atan2(player.y-this.y,player.x-this.x);
    const sp=this.speed*this.slowFactor*globalSlow;
    if(this.suicidal){ // 自爆怪追踪
      this.x+=Math.cos(this.angle)*sp*dt; this.y+=Math.sin(this.angle)*sp*dt;
      if(d<this.size+player.size){this.explode(); return;}
    }else{
      this.x+=Math.cos(this.angle)*sp*dt; this.y+=Math.sin(this.angle)*sp*dt;
    }
    if(this.shoots&&this.shootTimer>0){this.shootTimer-=dt; if(this.shootTimer<=0&&d<450){this.shootTimer=this.shootCooldown; this.attackAnim=0.3; enemyBullets.push(new EnemyBullet(this.x,this.y,this.angle,200));}}
  }
  applyIceEffect(eff){if(eff.slow){this.slowFactor=1-eff.slow;this.slowTimer=eff.slowDur;}if(eff.freezeChance&&Math.random()<eff.freezeChance){this.frozen=true;this.frozenTimer=1.5;}}
  takeDamage(dmg,bullet){
    if(this.invincibleTime>0){spawnParticles(this.x,this.y,'#79c0ff',3); return;} // 无敌期间不受伤害
    // 击中音效（节流：每个怪0.05秒最多触发1次，避免音效叠加刺耳）
    const now=performance.now();
    if(!this._lastHitSnd||now-this._lastHitSnd>50){ playSound('hit'); this._lastHitSnd=now; }
    // 处决：低血量直接秒杀
    if(player&&player.executeThreshold&&this.health>0&&this.health<=this.maxHealth*player.executeThreshold&&!this.secondBar){
      this.health=0; spawnParticles(this.x,this.y,'#ff4444',20); pushFloatingText(this.x,this.y-15,'处决!','#ff4444',0.8);
      this.die(bullet); return;
    }
    // 难度护甲减伤（弑神难度小怪更硬）
    if(this.armor>0)dmg=dmg*(1-this.armor);
    this.health-=dmg; this.hitFlash=0.1; spawnParticles(this.x,this.y,this.color,3);
    // 死亡复盘：统计伤害输出（仅子弹造成的）
    if(typeof runStats!=='undefined' && dmg>0)runStats.damageDealt+=dmg;
    if(bullet){
      // 元素伤害可视化：不同颜色浮字
      if(bullet.elementEffects.ice)pushFloatingText(this.x,this.y-30,`❄${Math.ceil(dmg)}`,'#79c0ff',0.7);
      else if(bullet.elementEffects.lightning)pushFloatingText(this.x,this.y-30,`⚡${Math.ceil(dmg)}`,'#fff700',0.7);
      if(bullet.specialEffects&&bullet.specialEffects.fireball)pushFloatingText(this.x,this.y-42,`🔥${Math.ceil(dmg)}`,'#ff6b35',0.7);
      if(bullet.elementEffects.ice)this.applyIceEffect(bullet.elementEffects.ice);
      if(bullet.elementEffects.lightning)this.applyLightningEffect(bullet);
      // 火球术效果（标记为玩家产生的灼烧，享受burnBonusMul加成）
      if(bullet.specialEffects.fireball){
        const eff=bullet.specialEffects.fireball;
        fireEffects.push({x:this.x,y:this.y,radius:eff.radius,damage:eff.burnDmg,life:eff.burnDur,maxLife:eff.burnDur,burnDmg:eff.burnDmg,tick:0,chain:eff.chain||0,isPlayerFire:true});
        spawnParticles(this.x,this.y,'#ff6b35',15);
      }
      // Roguelike遗物：冰霜附魔
      if(hasRelic('frost')&&!bullet._relicFrost){
        this.applyIceEffect({slow:0.5,slowDur:1.5});
        spawnParticles(this.x,this.y,'#79c0ff',4);
      }
      // Roguelike遗物：弹射子弹
      if(hasRelic('bounce')&&!bullet._relicBounced){
        let nearest=null,nd=180;
        for(const e of enemies){if(!e.alive||e===this||bullet.hitEnemies.has(e))continue; const d=dist(this.x,this.y,e.x,e.y); if(d<nd){nd=d;nearest=e;}}
        if(boss&&boss.alive&&boss!==this&&!bullet.hitEnemies.has(boss)){const d=dist(this.x,this.y,boss.x,boss.y); if(d<nd*1.5)nearest=boss;}
        if(nearest){
          bullet._relicBounced=true;
          const a=Math.atan2(nearest.y-this.y,nearest.x-this.x);
          const nb=new Bullet(this.x,this.y,a,{damage:bullet.damage*0.6,size:bullet.size*0.8,speed:bullet.speed,pierce:0});
          nb._relicBounced=true; nb._relicFrost=bullet._relicFrost;
          bullets.push(nb);
          spawnParticles(this.x,this.y,'#bc8cff',6);
        }
      }
      // 天赋：子弹反弹（撞墙反弹）已在Bullet.update中通过bounce属性实现,
      // 天赋值通过fireBullets传入bullet.bounce,此处无需额外处理
      // 高级天赋：战斗狂/愤怒 - 击中敌人叠加层数（1.5秒未击中衰减,在Player.update中处理）
      if(player){
        if(player.combatFuryMax>0){
          player.combatFuryStacks=Math.min(player.combatFuryMax,player.combatFuryStacks+1);
          player.combatFuryTimer=1.5;
        }
        if(player.rageFuryMax>0){
          player.rageFuryStacks=Math.min(player.rageFuryMax,player.rageFuryStacks+1);
          player.rageFuryTimer=1.5;
        }
      }
      // Roguelike遗物：爆破子弹
      if(hasRelic('explode')&&!bullet._relicExploded){
        bullet._relicExploded=true;
        spawnParticles(this.x,this.y,'#ff6b35',15);
        for(const e of enemies){if(!e.alive||e===this)continue; if(dist(this.x,this.y,e.x,e.y)<60){e.takeDamage(bullet.damage*0.4,{...bullet,_relicExploded:true});}}
        if(boss&&boss.alive&&boss!==this&&dist(this.x,this.y,boss.x,boss.y)<60){boss.takeDamage(bullet.damage*0.4);}
      }
    }
    // Roguelike遗物：暴击连击
    if(bullet&&bullet.isCrit&&hasRelic('critchain')){
      player._relicCritChainTime=2;
      pushFloatingText(this.x,this.y-25,'⚡','#ffd700',0.8);
    }
    if(this.secondBar&&this.health<=0){this.secondBar=false; this.health=this.maxHealth; spawnParticles(this.x,this.y,'#8b949e',30); pushFloatingText(this.x,this.y-15,'第二管血!','#8b949e',1);}
    else if(this.health<=0){this.die(bullet);}
  }
  applyLightningEffect(bullet){
    const eff=bullet.elementEffects.lightning; if(!eff||eff.chain<=0)return;
    if(bullet.chainedEnemies.has(this))return; bullet.chainedEnemies.add(this);
    const targets=[]; for(const e of enemies){if(!e.alive||e===this||bullet.chainedEnemies.has(e))continue; const d=dist(this.x,this.y,e.x,e.y); if(d<eff.chainRange)targets.push({enemy:e,dist:d});}
    if(boss&&boss.alive&&!bullet.chainedEnemies.has(boss)){const d=dist(this.x,this.y,boss.x,boss.y); if(d<eff.chainRange*1.5)targets.push({enemy:boss,dist:d});}
    targets.sort((a,b)=>a.dist-b.dist); const ts=targets.slice(0,eff.chain);
    for(const t of ts){spawnParticles(this.x,this.y,'#ffd700',5); const cd=bullet.damage*eff.chainDmg; t.enemy.takeDamage(cd,{...bullet,chainedEnemies:new Set(bullet.chainedEnemies)});}
  }
  explode(){
    this.alive=false;
    // 连击系统：连续击杀获得分数加成
    comboCount++; comboTimer=2.0; if(comboCount>comboMax)comboMax=comboCount;
    const comboBonus=comboCount>=5?Math.floor(this.score*(1+comboCount*0.05)):this.score;
    score+=comboBonus;
    // 连击里程碑特效爆发：10/30/50时全屏震感+特殊提示
    if(comboCount===10){
      screenShake=Math.max(screenShake,0.4);
      pushFloatingText(this.x,this.y-50,'🔥 10连击!','#ffd700',1.5,28);
      spawnParticles(this.x,this.y,'#ffd700',20);
    }else if(comboCount===30){
      screenShake=Math.max(screenShake,0.6);
      pushFloatingText(this.x,this.y-50,'⚡ 30连击!','#bc8cff',2,32);
      spawnParticles(this.x,this.y,'#bc8cff',30);
    }else if(comboCount===50){
      screenShake=Math.max(screenShake,0.9);
      pushFloatingText(this.x,this.y-50,'👑 50连击!!','#ff4444',2.5,38);
      spawnParticles(this.x,this.y,'#ff4444',40);
    }
    // 经验值系统：自爆怪击杀也掉落经验球（遗物"智者之书"+50%）
    if(this.xp>0){
      const _xpAmt = hasRelic('xpboost') ? Math.ceil(this.xp*1.5) : this.xp;
      drops.push(new Drop(this.x,this.y,'xp',_xpAmt));
    }
    if(!this.isAdventure){enemiesRemaining--;} updateUI();
    spawnParticles(this.x,this.y,'#f0883e',40);
    pushFloatingText(this.x,this.y,`+${comboBonus}${comboCount>=5?` x${comboCount}`:''}`,comboCount>=10?'#ffd700':comboCount>=5?'#bc8cff':'#f0883e',1);
    // 自爆范围伤害
    if(player&&dist(this.x,this.y,player.x,player.y)<60)player.takeDamage(2);
    spawnParticles(this.x,this.y,'#ff6b35',25);
    checkWaveComplete();
  }
  die(killingBullet){
    this.alive=false;
    // 死亡复盘：统计击杀数和经验
    if(typeof runStats!=='undefined'){
      runStats.kills++;
      runStats.maxCombo=Math.max(runStats.maxCombo,comboCount);
      if(this.xp)runStats.xpEarned+=this.xp;
    }
    // 连击系统
    comboCount++; comboTimer=2.0; if(comboCount>comboMax)comboMax=comboCount;
    let gain=this.score;
    // 连击加成：5连击以上每多1连击+5%分数
    if(comboCount>=5)gain=Math.floor(gain*(1+comboCount*0.05));
    // Roguelike遗物：贪欲之眼
    if(hasRelic('treasure')){gain=Math.ceil(gain*1.5);}
    score+=gain;
    // 连击里程碑特效爆发：10/30/50时全屏震感+特殊提示
    if(comboCount===10){
      screenShake=Math.max(screenShake,0.4);
      pushFloatingText(this.x,this.y-50,'🔥 10连击!','#ffd700',1.5,28);
      spawnParticles(this.x,this.y,'#ffd700',20);
    }else if(comboCount===30){
      screenShake=Math.max(screenShake,0.6);
      pushFloatingText(this.x,this.y-50,'⚡ 30连击!','#bc8cff',2,32);
      spawnParticles(this.x,this.y,'#bc8cff',30);
    }else if(comboCount===50){
      screenShake=Math.max(screenShake,0.9);
      pushFloatingText(this.x,this.y-50,'👑 50连击!!','#ff4444',2.5,38);
      spawnParticles(this.x,this.y,'#ff4444',40);
    }
    // 击杀音效
    playSound('kill');
    // 经验值系统：击杀怪物掉落经验球，玩家拾取才获得经验（遗物"智者之书"+50%）
    if(this.xp>0){
      const _xpAmt = hasRelic('xpboost') ? Math.ceil(this.xp*1.5) : this.xp;
      drops.push(new Drop(this.x,this.y,'xp',_xpAmt));
    }
    if(!this.isAdventure){enemiesRemaining--;} updateUI();
    spawnParticles(this.x,this.y,this.color,20+this.size);
    pushFloatingText(this.x,this.y,`+${gain}${comboCount>=5?` x${comboCount}`:''}`,comboCount>=10?'#ffd700':comboCount>=5?'#bc8cff':'#f0883e',1);
    // 传说皮肤击杀特效：金色爆裂粒子
    if(player){
      const _skin=getEquippedSkin();
      if(_skin&&_skin.rarity==='legendary'){
        for(let i=0;i<12;i++){
          const a=(i/12)*Math.PI*2, sp=rand(80,200);
          spawnParticleRaw(this.x,this.y,Math.cos(a)*sp,Math.sin(a)*sp,0.5,0.5,_skin.color,rand(3,6));
        }
      }
    }
    // 吸血来源已全面移除（仅神话套装4件红装给一点点）
    // 刑天干戚专属：击杀回血+战意增伤（吸血削弱：+2→+1）
    if(killingBullet&&killingBullet.weaponId==='xingtiangeqi'&&player){
      const heal=1;
      player.health=Math.min(player.maxHealth,player.health+heal);
      spawnParticles(player.x,player.y,'#ff4500',5);
      pushFloatingText(player.x,player.y-30,`+${heal}`,'#ff4500',0.8);
      // 战意增伤：击杀后5秒内伤害+5%（可叠加3次）
      player.xingtianStacks=Math.min(3,(player.xingtianStacks||0)+1);
      player.xingtianTimer=5;
    }
    // 装备狂暴：击杀后2秒攻速翻倍（狂飙突进联动+1秒）
    if(player&&player.rampageOnKill){player.rampageTimer=2+(player.rampageBonusDur||0);}
    // Boss装备词条：饕餮吞噬之力 - 击杀回3%血量
    if(player && player.devourOnKill){
      const heal=Math.ceil(player.maxHealth*player.devourOnKill);
      player.health=Math.min(player.maxHealth,player.health+heal);
      spawnParticles(player.x,player.y,'#9d4edd',6);
      pushFloatingText(player.x,player.y-30,`+${heal}`,'#9d4edd',0.6);
    }
    let dropChance=0.15;
    if(hasRelic('treasure'))dropChance+=0.10;
    if(Math.random()<dropChance){const types=['health','shield','coin'];const w=[4,3,5];let tw=w.reduce((a,b)=>a+b,0);let r=Math.random()*tw;let sel='coin';for(let i=0;i<3;i++){r-=w[i];if(r<=0){sel=types[i];break;}}drops.push(new Drop(this.x,this.y,sel));}
    // 小怪1%概率掉普通/稀有装备（增加Build多样性，不与Boss掉落冲突）
    if(Math.random()<0.01 && typeof GEAR_SLOTS!=='undefined' && typeof generateGear==='function'){
      // 品质分布：70%普通、25%稀有、5%史诗
      const rr=Math.random();
      const rarity=rr<0.70?'common':rr<0.95?'rare':'epic';
      const slot=GEAR_SLOTS[randInt(0,GEAR_SLOTS.length-1)];
      try{
        const g=generateGear(slot,rarity);
        drops.push(new Drop(this.x,this.y,'gear',0,g));
      }catch(e){ /* generateGear 失败时静默，不影响掉落 */ }
    }
    // 成就追踪：击杀数
    saveData.achievementFlags.totalKills=(saveData.achievementFlags.totalKills||0)+1;
    // 奇遇小怪
    if(this.isAdventure){triggerAdventure();}
    if(killingBullet&&killingBullet.finalUpgrades?.includes('ice')&&this.slowFactor<1){
      spawnParticles(this.x,this.y,'#79c0ff',20);
      for(const e of enemies){if(!e.alive||e===this)continue; if(dist(this.x,this.y,e.x,e.y)<80){e.takeDamage(killingBullet.damage*0.5); if(e.applyIceEffect)e.applyIceEffect({slow:0.5,slowDur:1});}}
    }
    // 分裂怪：死亡后分裂成小怪
    if(this.splits&&this.splits>0&&this.splitInto){
      const td=CONFIG.ENEMY_TYPES[this.splitInto];
      if(td){
        for(let i=0;i<this.splits;i++){
          const child=new Enemy(this.splitInto,0);
          child.x=this.x+rand(-30,30); child.y=this.y+rand(-30,30);
          child.invincibleTime=1.0; // 1秒无敌时间
          child.isAdventure=this.isAdventure;
          enemies.push(child);
        }
        spawnParticles(this.x,this.y,this.color,30);
        pushFloatingText(this.x,this.y-15,'分裂!','#1a8a5c',1);
      }
    }
    checkWaveComplete();
  }
  draw(){
    ctx.save(); ctx.translate(this.x,this.y);
    // 行走动画：身体上下浮动+轻微挤压
    const bob=Math.sin(this.walkPhase)*this.size*0.06;
    const sq=1+Math.sin(this.walkPhase*2)*0.05;
    ctx.translate(0,bob);
    // 受击抖动
    if(this.hitFlash>0){ctx.translate(rand(-1.5,1.5),rand(-1.5,1.5));}
    ctx.scale(1,sq);
    let fc=this.hitFlash>0?'#ffffff':this.color;
    if(this.frozen)fc='#a8d8ff'; else if(this.slowFactor<1)fc='#79c0ff';
    if(this.invincibleTime>0)fc='#79c0ff';
    // 攻击动画前倾
    if(this.attackAnim>0){const t=this.attackAnim/(this.attackAnimMax||0.3); ctx.scale(1+t*0.15,1-t*0.1);}
    ctx.fillStyle=fc; ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=2;
    ctx.shadowColor=fc; ctx.shadowBlur=6;
    this.drawShape(fc);
    ctx.shadowBlur=0;
    // 无敌护盾
    if(this.invincibleTime>0){ctx.strokeStyle=`rgba(121,192,255,${0.5+Math.sin(_NOW/200)*0.3})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,this.size+5,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(121,192,255,0.15)';ctx.fill();}
    // 冰冻光环（巫祝冰元素）：明显冰晶圈
    if(this.frozen){
      ctx.strokeStyle=`rgba(168,216,255,${0.8+Math.sin(_NOW/200)*0.2})`;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(0,0,this.size+4,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='rgba(168,216,255,0.18)';ctx.beginPath();ctx.arc(0,0,this.size+3,0,Math.PI*2);ctx.fill();
      // 冰晶装饰
      for(let i=0;i<6;i++){
        const a=(i/6)*Math.PI*2+_NOW/1000;
        const r=this.size+5;
        ctx.fillStyle='rgba(220,240,255,0.9)';
        ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,2,0,Math.PI*2);ctx.fill();
      }
    }else if(this.slowFactor<1){
      // 减速光环（非冻结）：浅蓝圈
      ctx.strokeStyle=`rgba(121,192,255,${0.4+Math.sin(_NOW/300)*0.2})`;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(0,0,this.size+3,0,Math.PI*2);ctx.stroke();
    }
    // 嘲讽光环
    if(this.taunt){ctx.strokeStyle=`rgba(212,160,23,${0.4+Math.sin(_NOW/300)*0.2})`;ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,this.size+8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    // 自爆闪烁
    if(this.suicidal){ctx.fillStyle=`rgba(255,100,0,${0.3+Math.sin(_NOW/100)*0.3})`;ctx.beginPath();ctx.arc(0,0,this.size+3,0,Math.PI*2);ctx.fill();}
    ctx.restore();
    // 血条
    if(this.health<this.maxHealth||this.secondBar){
      const bw=this.size*2, bh=4;
      ctx.fillStyle='#1a1f2e'; ctx.fillRect(this.x-bw/2-1,this.y-this.size-11,bw+2,bh+2);
      ctx.fillStyle=this.secondBar?'#b0a090':'#a52838';
      ctx.fillRect(this.x-bw/2,this.y-this.size-10,bw*(this.health/this.maxHealth),bh);
    }
  }
  drawShape(fc){
    const s=this.size;
    const look=Math.cos(this.angle),lookY=Math.sin(this.angle);
    switch(this.shape){
      case'blob':{ // 小妖：绿色史莱姆
        const sqz=1+Math.sin(this.walkPhase*2)*0.12;
        ctx.save();ctx.scale(1,sqz);
        ctx.fillStyle=fc;ctx.beginPath();ctx.ellipse(0,0,s,s*0.85,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1.5;ctx.stroke();
        // 高光
        ctx.fillStyle='rgba(255,255,255,0.35)';
        ctx.beginPath();ctx.ellipse(-s*0.3,-s*0.4,s*0.25,s*0.15,-0.5,0,Math.PI*2);ctx.fill();
        ctx.restore();
        // 眼睛
        drawCartoonEye(-s*0.25,-s*0.1,s*0.16,look);
        drawCartoonEye(s*0.25,-s*0.1,s*0.16,look);
        // 嘴
        drawCartoonMouth(s*0.3,s*0.18,true);
        break;}
      case'imp':{ // 魍魉：紫色小鬼
        // 三角身体
        const wob=Math.sin(this.walkPhase)*s*0.1;
        ctx.fillStyle=fc;ctx.beginPath();
        ctx.moveTo(0,-s-wob);ctx.lineTo(s*0.9,s*0.7);ctx.lineTo(-s*0.9,s*0.7);ctx.closePath();
        ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1.5;ctx.stroke();
        // 小角
        ctx.fillStyle=fc;
        ctx.beginPath();ctx.moveTo(-s*0.4,-s*0.5);ctx.lineTo(-s*0.55,-s*1.15);ctx.lineTo(-s*0.2,-s*0.6);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(s*0.4,-s*0.5);ctx.lineTo(s*0.55,-s*1.15);ctx.lineTo(s*0.2,-s*0.6);ctx.closePath();ctx.fill();
        // 眼
        drawCartoonEye(-s*0.25,-s*0.05,s*0.15,look);
        drawCartoonEye(s*0.25,-s*0.05,s*0.15,look);
        // 尖牙嘴
        ctx.strokeStyle='rgba(0,0,0,0.55)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,s*0.3,s*0.22,0,Math.PI);ctx.stroke();
        ctx.fillStyle='white';ctx.beginPath();ctx.moveTo(-s*0.1,s*0.3);ctx.lineTo(-s*0.05,s*0.5);ctx.lineTo(0,s*0.3);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(s*0.1,s*0.3);ctx.lineTo(s*0.05,s*0.5);ctx.lineTo(0,s*0.3);ctx.closePath();ctx.fill();
        break;}
      case'golem':{ // 石灵：石头人
        const wob=Math.sin(this.walkPhase*1.5)*s*0.05;
        ctx.fillStyle=fc;
        ctx.beginPath();
        ctx.moveTo(-s*0.8,-s*0.6+wob);ctx.lineTo(-s*0.6,-s);ctx.lineTo(s*0.6,-s);ctx.lineTo(s*0.8,-s*0.6+wob);
        ctx.lineTo(s*0.7,s*0.8);ctx.lineTo(-s*0.7,s*0.8);ctx.closePath();
        ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=2;ctx.stroke();
        // 裂纹
        ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.moveTo(-s*0.3,-s*0.5);ctx.lineTo(-s*0.1,-s*0.2);ctx.lineTo(-s*0.3,s*0.1);ctx.stroke();
        ctx.beginPath();ctx.moveTo(s*0.3,s*0.1);ctx.lineTo(s*0.1,s*0.4);ctx.stroke();
        // 短腿
        ctx.fillStyle=fc;ctx.fillRect(-s*0.55,s*0.7,s*0.35,s*0.25);ctx.fillRect(s*0.2,s*0.7,s*0.35,s*0.25);
        ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.strokeRect(-s*0.55,s*0.7,s*0.35,s*0.25);ctx.strokeRect(s*0.2,s*0.7,s*0.35,s*0.25);
        // 眼
        drawCartoonEye(-s*0.3,-s*0.4,s*0.14,look);
        drawCartoonEye(s*0.3,-s*0.4,s*0.14,look);
        break;}
      case'shaman':{ // 巫祝：菱形+巫师帽
        // 帽子
        ctx.fillStyle='#3a1a5a';
        ctx.beginPath();ctx.moveTo(0,-s*1.4);ctx.lineTo(s*0.55,-s*0.5);ctx.lineTo(-s*0.55,-s*0.5);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(212,160,23,0.7)';ctx.lineWidth=1.5;ctx.stroke();
        ctx.fillStyle='#ffd970';ctx.beginPath();ctx.arc(s*0.25,-s*0.9,s*0.08,0,Math.PI*2);ctx.fill();
        // 菱形身体
        ctx.fillStyle=fc;ctx.beginPath();ctx.moveTo(0,-s*0.4);ctx.lineTo(s*0.85,0);ctx.lineTo(0,s*0.85);ctx.lineTo(-s*0.85,0);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1.5;ctx.stroke();
        // 法杖
        ctx.strokeStyle='#8b5a2b';ctx.lineWidth=2.5;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(s*0.9,-s*0.1);ctx.lineTo(s*1.2,s*0.5);ctx.stroke();
        ctx.fillStyle='#ffd970';ctx.shadowColor='#ffd970';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(s*1.2,s*0.5,s*0.13,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
        // 眼
        drawCartoonEye(-s*0.22,-s*0.1,s*0.13,look);
        drawCartoonEye(s*0.22,-s*0.1,s*0.13,look);
        break;}
      case'oni':{ // 巨灵：红色鬼
        const wob=Math.sin(this.walkPhase)*s*0.04;
        // 身体
        ctx.fillStyle=fc;ctx.beginPath();ctx.arc(0,0,s*0.95,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=2.5;ctx.stroke();
        // 独角
        ctx.fillStyle=fc;
        ctx.beginPath();ctx.moveTo(-s*0.35,-s*0.75);ctx.lineTo(-s*0.5,-s*1.25+wob);ctx.lineTo(-s*0.15,-s*0.8);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.moveTo(s*0.35,-s*0.75);ctx.lineTo(s*0.5,-s*1.25+wob);ctx.lineTo(s*0.15,-s*0.8);ctx.closePath();ctx.fill();ctx.stroke();
        // 獠牙
        ctx.fillStyle='white';
        ctx.beginPath();ctx.moveTo(-s*0.2,s*0.15);ctx.lineTo(-s*0.28,s*0.45);ctx.lineTo(-s*0.1,s*0.2);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(s*0.2,s*0.15);ctx.lineTo(s*0.28,s*0.45);ctx.lineTo(s*0.1,s*0.2);ctx.closePath();ctx.fill();
        // 凶眼
        ctx.fillStyle='#ffd970';
        ctx.beginPath();ctx.ellipse(-s*0.3,-s*0.2,s*0.18,s*0.12,-0.3,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(s*0.3,-s*0.2,s*0.18,s*0.12,0.3,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(-s*0.3,-s*0.2,s*0.07,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(s*0.3,-s*0.2,s*0.07,0,Math.PI*2);ctx.fill();
        break;}
      case'spider':{ // 蝎精：圆身体+多腿+毒刺
        // 8条腿
        ctx.strokeStyle=fc;ctx.lineWidth=2;ctx.lineCap='round';
        for(let i=0;i<4;i++){
          const a=Math.PI*0.3+i*Math.PI*0.13;
          const lp=Math.sin(this.walkPhase+i*0.5)*s*0.15;
          ctx.beginPath();ctx.moveTo(Math.cos(a)*s*0.5,Math.sin(a)*s*0.5);ctx.lineTo(Math.cos(a)*s*1.1,Math.sin(a)*s*0.9+lp);ctx.stroke();
          ctx.beginPath();ctx.moveTo(Math.cos(-a)*s*0.5,Math.sin(-a)*s*0.5);ctx.lineTo(Math.cos(-a)*s*1.1,Math.sin(-a)*s*0.9-lp);ctx.stroke();
        }
        // 身体
        ctx.fillStyle=fc;ctx.beginPath();ctx.arc(0,0,s*0.7,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1.5;ctx.stroke();
        // 毒刺
        ctx.fillStyle=fc;ctx.beginPath();ctx.moveTo(0,-s*0.6);ctx.lineTo(-s*0.15,-s*1.1);ctx.lineTo(s*0.15,-s*1.1);ctx.closePath();ctx.fill();ctx.stroke();
        // 眼
        drawCartoonEye(-s*0.22,-s*0.05,s*0.12,look);
        drawCartoonEye(s*0.22,-s*0.05,s*0.12,look);
        drawCartoonEye(-s*0.4,s*0.15,s*0.07,look);
        drawCartoonEye(s*0.4,s*0.15,s*0.07,look);
        break;}
      case'turtle':{ // 玄龟：龟壳+头脚
        // 四脚
        const lp=Math.sin(this.walkPhase)*s*0.1;
        ctx.fillStyle=fc;
        ctx.beginPath();ctx.ellipse(-s*0.7,-s*0.4,s*0.25,s*0.18+lp*0.1,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(s*0.7,-s*0.4,s*0.25,s*0.18-lp*0.1,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(-s*0.7,s*0.4,s*0.25,s*0.18-lp*0.1,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(s*0.7,s*0.4,s*0.25,s*0.18+lp*0.1,0,0,Math.PI*2);ctx.fill();
        // 头
        ctx.beginPath();ctx.arc(0,-s*0.95,s*0.35,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1.5;ctx.stroke();
        // 龟壳
        ctx.fillStyle=fc;ctx.beginPath();ctx.ellipse(0,0,s*0.95,s*0.7,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=2;ctx.stroke();
        // 龟壳花纹
        ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=1.2;
        for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*s*0.8,Math.sin(a)*s*0.6);ctx.stroke();}
        ctx.beginPath();ctx.ellipse(0,0,s*0.5,s*0.38,0,0,Math.PI*2);ctx.stroke();
        // 头上眼
        drawCartoonEye(0,-s*0.95,s*0.1,look);
        break;}
      case'troll':{ // 山魈：大块头+獠牙
        const wob=Math.sin(this.walkPhase)*s*0.04;
        // 身体
        ctx.fillStyle=fc;ctx.beginPath();ctx.ellipse(0,0,s*0.9,s*0.95,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=2.5;ctx.stroke();
        // 粗壮手臂
        ctx.fillStyle=fc;
        const ap=Math.sin(this.walkPhase)*s*0.12;
        ctx.beginPath();ctx.ellipse(-s*0.9,s*0.1+ap,s*0.3,s*0.5,-0.3,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.ellipse(s*0.9,s*0.1-ap,s*0.3,s*0.5,0.3,0,Math.PI*2);ctx.fill();ctx.stroke();
        // 獠牙
        ctx.fillStyle='white';
        ctx.beginPath();ctx.moveTo(-s*0.22,s*0.1);ctx.lineTo(-s*0.3,s*0.45);ctx.lineTo(-s*0.1,s*0.15);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(s*0.22,s*0.1);ctx.lineTo(s*0.3,s*0.45);ctx.lineTo(s*0.1,s*0.15);ctx.closePath();ctx.fill();
        // 鼻子
        ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.ellipse(0,s*0.05,s*0.15,s*0.12,0,0,Math.PI*2);ctx.fill();
        // 凶眼
        ctx.fillStyle='#ff6b6b';
        ctx.beginPath();ctx.ellipse(-s*0.32,-s*0.25,s*0.16,s*0.1,-0.2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(s*0.32,-s*0.25,s*0.16,s*0.1,0.2,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(-s*0.32,-s*0.25,s*0.06,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(s*0.32,-s*0.25,s*0.06,0,Math.PI*2);ctx.fill();
        break;}
      case'firechild':{ // 烈火童：火焰造型
        const fl=Math.sin(this.walkPhase*3)*0.15+1;
        // 外层火焰
        ctx.fillStyle=fc;ctx.shadowColor=fc;ctx.shadowBlur=12;
        ctx.beginPath();
        ctx.moveTo(0,-s*1.2*fl);
        ctx.quadraticCurveTo(s*0.9,-s*0.3,s*0.6,s*0.7);
        ctx.quadraticCurveTo(s*0.2,s*0.5,0,s*0.9);
        ctx.quadraticCurveTo(-s*0.2,s*0.5,-s*0.6,s*0.7);
        ctx.quadraticCurveTo(-s*0.9,-s*0.3,0,-s*1.2*fl);
        ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;
        // 内层亮焰
        ctx.fillStyle='#ffd970';
        ctx.beginPath();ctx.moveTo(0,-s*0.7*fl);ctx.quadraticCurveTo(s*0.4,-s*0.1,s*0.25,s*0.4);ctx.quadraticCurveTo(0,s*0.3,-s*0.25,s*0.4);ctx.quadraticCurveTo(-s*0.4,-s*0.1,0,-s*0.7*fl);ctx.closePath();ctx.fill();
        // 眼
        drawCartoonEye(-s*0.2,-s*0.05,s*0.13,look);
        drawCartoonEye(s*0.2,-s*0.05,s*0.13,look);
        // 嘴
        drawCartoonMouth(s*0.3,s*0.15,true);
        break;}
      default:{
        ctx.fillStyle=fc;ctx.beginPath();ctx.arc(0,0,s,0,Math.PI*2);ctx.fill();ctx.stroke();
        drawCartoonEye(-s*0.25,0,s*0.15,look);drawCartoonEye(s*0.25,0,s*0.15,look);
      }
    }
  }
}

// ==================== Boss ====================
// 山海经Boss定义（4普通+2超级）
const BOSS_TYPES = [
  { idx:0, name:'九尾狐', color:'#ff69b4', isSuper:false, attack:'charmBullet',  special:'phantomClone', special2:'charmBeam',    icon:'🦊', shape:'fox',
    desc:'魅惑与幻影大师，以分身和光波迷惑敌人' },
  { idx:1, name:'毕方',   color:'#ff4500', isSuper:false, attack:'fireFeather',  special:'fireRain',     special2:'diveBomb',      icon:'🐦', shape:'bird',
    desc:'天降烈火，以多区域轰炸和俯冲攻击著称' },
  { idx:2, name:'相柳',   color:'#7cfc00', isSuper:false, attack:'poisonNine',   special:'poisonSwamp',  special2:'poisonSpray',   icon:'🐍', shape:'snake',
    desc:'九头毒物，喷射毒液光波与蔓延毒沼' },
  { idx:3, name:'朱厌',   color:'#daa520', isSuper:false, attack:'rockThrow',    special:'groundShock',  special2:'rockBarrage',   icon:'🦍', shape:'ape',
    desc:'巨猿之力，震地冲击与巨石弹幕齐发' },
  { idx:4, name:'烛龙',   color:'#ff6347', isSuper:true,  attack:'lavaPool',     special:'lavaFist',     special2:'lightBeam',     icon:'🐉', shape:'dragon',
    desc:'熔岩与光束之龙，释放贯穿屏幕的光波' },
  { idx:5, name:'饕餮',   color:'#4b0082', isSuper:true,  attack:'devourAtk',    special:'bulletAbsorb', special2:'gravityWell',   icon:'👹', shape:'beast',
    desc:'吞噬万物，以引力井吸引并碾碎敌人' },
  { idx:6, name:'英招',   color:'#20b2aa', isSuper:false, attack:'windBlade',    special:'tornadoSpin',  special2:'airDash',       icon:'🦅', shape:'bird',
    desc:'人面马身，驾驭风暴与龙卷的飞行神兽' },
  { idx:7, name:'计蒙',   color:'#4682b4', isSuper:false, attack:'waterJet',     special:'rainStorm',    special2:'floodWave',     icon:'🐲', shape:'dragon',
    desc:'龙首人身，呼风唤雨召唤洪水与暴雨' },
  { idx:8, name:'穷奇',   color:'#6a0dad', isSuper:true,  attack:'chaosBolt',    special:'voidRift',     special2:'dimensionStorm',icon:'🐅', shape:'beast',
    desc:'有翼之虎，混沌化身，撕裂维度制造虚空' },
  { idx:9, name:'刑天',   color:'#8b0000', isSuper:true,  attack:'halberdSweep', special:'earthCrack',   special2:'wrathClones',   icon:'⚔️', shape:'giant',
    desc:'无头战神，以乳为目以脐为口，手持干戚永不屈服', isFinalBoss:true }
];
// ==================== Boss背景故事与弱点提示 ====================
const BOSS_LORE = {
  0: { // 九尾狐
    story:'青丘之山，有兽焉，其状如狐而九尾。其音如婴儿，能食人。食者不蛊。九尾狐以魅惑闻名，常化为人形混迹人间，以幻术迷惑猎物。',
    weakness:'⚠️ 弱点：分身只有1点血，优先清除分身再集火本体。魅惑光波可被护盾抵消。',
    skills:['魅惑子弹','幻影分身','魅惑光波']
  },
  1: { // 毕方
    story:'章峨之山，有鸟焉，其状如鹤，一足，赤文青身而白喙，名曰毕方。其鸣自叫也，见则其邑有讹火。毕方所过之处，烈火燎原。',
    weakness:'⚠️ 弱点：俯冲攻击有明显前摇，侧向闪避可躲。火雨范围固定，提前站位即可。',
    skills:['火焰羽毛','火雨轰炸','俯冲轰炸']
  },
  2: { // 相柳
    story:'共工之臣曰相柳氏，九首，以食于九山。相柳之所抵，厥为泽溪。禹杀相柳，其血腥，不可以树五谷种。其地多水，不可以居。',
    weakness:'⚠️ 弱点：毒沼可被火焰点燃清除。九头齐射时贴身绕圈可避开所有弹道。',
    skills:['九头毒液','毒沼蔓延','毒液喷射']
  },
  3: { // 朱厌
    story:'小次之山，有兽焉，其状如猿，而白首赤足，名曰朱厌，见则大兵。朱厌性烈好斗，一怒则山崩地裂，巨石如雨。',
    weakness:'⚠️ 弱点：震地冲击需跳跃躲避（远离地面）。巨石弹幕有固定轨迹，保持移动即可。',
    skills:['巨石投掷','震地冲击','岩石弹幕']
  },
  4: { // 烛龙
    story:'钟山之神，名曰烛阴，视为昼，瞑为夜，吹为冬，呼为夏，不饮，不食，不息，息为风。身长千里，人面蛇身赤色。',
    weakness:'⚠️ 弱点：光束攻击有蓄力时间，提前绕到背后安全。熔岩池可被冰系效果熄灭。',
    skills:['熔岩池','熔岩之拳','贯穿光束']
  },
  5: { // 饕餮
    story:'钩吾之山，有兽焉，其状如羊身人面，其目在腋下，虎齿人爪，其音如婴儿，名曰狍鸮，是食人。饕餮贪食无厌，吞噬万物。',
    weakness:'⚠️ 弱点：引力井有最大范围，远离即可。吞噬需贴身才生效，保持中距离输出。',
    skills:['吞噬攻击','子弹吸收','引力井']
  },
  6: { // 英招
    story:'槐江山，南望昆仑，其光熊熊，其气魂魂。神英招司之。其状马身而人面，虎文而鸟翼，徇于四海，其音如榴。',
    weakness:'⚠️ 弱点：龙卷风移动缓慢，侧向跑位即可。疾冲有直线预警，提前变向。',
    skills:['风刃','龙卷旋风','疾风冲刺']
  },
  7: { // 计蒙
    story:'光山，神计蒙处之。其状人身而龙首，恒游于漳渊，出入必有飘风暴雨。计蒙所至，云雾翻涌，洪水滔天。',
    weakness:'⚠️ 弱点：水柱攻击固定位置，提前移动。洪水波有间隙可通过。暴雨可被护盾抵挡。',
    skills:['水柱','暴雨狂澜','洪水波']
  },
  8: { // 穷奇
    story:'邽山，其上有兽焉，其状如牛，猬毛，名曰穷奇，音如獆狗，是食人。穷奇闻人斗则食直者，闻人忠信则啮其鼻。',
    weakness:'⚠️ 弱点：虚空裂缝有持续时间，观察颜色变化预判。维度风暴范围大但伤害低，硬抗也可。',
    skills:['混沌弹','虚空裂缝','维度风暴']
  },
  9: { // 刑天
    story:'刑天与帝至此争神，帝断其首，葬之常羊之山。乃以乳为目，以脐为口，操干戚以舞。刑天虽无首，战意不灭，永舞干戚。',
    weakness:'⚠️ 弱点：干戚横扫有距离限制，远离260px安全。地裂攻击有红色预警，提前闪避。战魂分身血量低可速清。',
    skills:['干戚横扫','地裂攻击','战魂分身']
  }
};
class Boss {
  constructor(level=1,isSuper=false,superIdx=null){
    this.level=level; this.x=CONFIG.WIDTH/2; this.y=CONFIG.HEIGHT*0.38;
    this.isSuper=isSuper;
    if(isSuper){ this.bossIndex = superIdx!==null ? superIdx : (Math.random()<0.33?4:(Math.random()<0.5?5:8)); }
    else {
      // 普通Boss循环：4原始 + 2新（英招/计蒙）
      const normalBosses=[0,1,2,3,6,7];
      this.bossIndex = normalBosses[(level-1)%normalBosses.length];
    }
    this.bossType=BOSS_TYPES[this.bossIndex];
    this.name=this.bossType.name; this.color=this.bossType.color;
    this.size=(isSuper?62:50)+level*6;
    const diff=getDifficulty();
    let baseHp=(120+level*55)*bossHpMul*diff.bossHpMul;
    if(isSuper) baseHp*=3; // 超级Boss血量3倍
    this.maxHealth=baseHp; this.health=this.maxHealth;
    this.armor=(diff.enemyArmor||0)*0.5; // Boss护甲为小怪的一半
    this.speed=(40+level*5)*(isSuper?0.85:1); this.alive=true; this.phase=1; this.attackTimer=2;
    this.moveAngle=0; this.targetX=CONFIG.WIDTH/2; this.targetY=CONFIG.HEIGHT*0.42;
    this.wobble=0; this.hitFlash=0;
    this.attackPattern=0; this.rage=false; this.specialCooldown=3; this.special2Cooldown=6;
    this.isCharging=false; this.chargeDirection={x:0,y:0}; this.chargeTimer=0;
    this.warningTime=0; this.warningType=null; this.warningData=null; this.warningIsSpecial2=false;
    this.slowFactor=1; this.slowTimer=0; this.frozen=false; this.frozenTimer=0;
    this.clones=[];          // 九尾狐分身
    this.jumping=false; this.jumpTimer=0; this.jumpFromY=0; this.jumpToY=0;  // 朱厌跳跃
    this.devourTimer=0;      // 饕餮吞噬计时
    this.fistTimer=0;        // 烛龙熔岩拳计时
    this._beamActive=false; this._beamData=null; this._wellActive=false; this._wellData=null; this._floodActive=false; this._floodData=null;
    this.attackAnim=0; this.attackType=null; this.breathPhase=0;  // 动画状态
    this.attackAnimMax=0.8;  // 攻击动画归一化基准（每次设置 attackAnim 时同步更新）
    this.movePhase=0;  // 移动动画相位（移动时递增）
    this.moving=false;  // 是否正在移动（用于动画帧切换）
    this.spawnAnim=1.0; // 出场动画（1→0）
    this.safeZoneTimer=18; // 安全区全屏攻击计时器（每18秒触发一次）
    this.safeZoneActive=false; this.safeZoneData=null;
    // 刑天最终Boss专属属性
    this.isFinalBoss=this.bossType.isFinalBoss||false;
    this.halberdSweepActive=false; this.halberdSweepData=null; // 干戚横扫
    this.earthCrackActive=false; this.earthCrackData=null; // 天崩地裂
    this.wrathClonesActive=false; this.wrathClones=[]; // 战魂分身
    this.orbitingOrbs=[]; // 刑天环绕战魂球（3个，围绕本体旋转，有接触伤害）
    this._orbTouchTick=0; // 环绕球接触伤害冷却
    // ===== 半血特殊机制（每个Boss独有，仅触发一次） =====
    this.halfHealthTriggered=false; // 是否已触发半血机制
    this.quarterHealthTriggered=false; // 是否已触发25%血二阶段机制
    this.invulnerable=false; // 临时无敌（九尾狐）
    this.invulnerableTimer=0; // 无敌计时
    this.stoneShield=false; // 石头护盾（朱厌）
    this.stoneShieldHp=0; // 护盾剩余血量
    this.finalBossPhase=0; // 刑天阶段(0=正常, 1=50%血狂暴, 2=25%血终极)
    // 刑天专属：初始化3个环绕战魂球（围绕本体旋转，有接触伤害）
    if(this.isFinalBoss){
      this.orbitingOrbs=[];
      for(let i=0;i<3;i++){
        this.orbitingOrbs.push({
          angle:(i/3)*Math.PI*2, // 初始角度
          radius:this.size*1.8, // 旋转半径
          speed:1.5, // 旋转速度
          size:this.size*0.35, // 球体大小
          x:0, y:0 // 实际位置（每帧更新）
        });
      }
    }
  }
  update(dt){
    this.wobble+=dt*2; if(this.hitFlash>0)this.hitFlash-=dt;
    this.breathPhase+=dt*2; if(this.attackAnim>0)this.attackAnim-=dt;
    if(this.spawnAnim>0)this.spawnAnim=Math.max(0,this.spawnAnim-dt*0.8); // 出场动画约1.25秒
    if(this.slowTimer>0){this.slowTimer-=dt; if(this.slowTimer<=0)this.slowFactor=1;}
    if(this.frozenTimer>0){this.frozenTimer-=dt; if(this.frozenTimer<=0)this.frozen=false;}
    // 修复：刑天专属技能（干戚横扫/天崩地裂）计时器在frozen时也递减
    // 避免：预警圆圈已消失但技能迟迟不爆发，或倒数卡在2/1很久才劈下来
    if(this.isFinalBoss){
      if(this.halberdSweepActive){
        this.halberdSweepData.timer-=dt;
        if(this.halberdSweepData.timer<=0)this.executeHalberdSweep();
      }
      if(this.earthCrackActive){
        this.earthCrackData.timer-=dt;
        if(this.earthCrackData.timer<=0)this.executeEarthCrack();
      }
    }
    if(this.frozen)return;
    // 朱厌跳跃中
    if(this.jumping){
      this.jumpTimer+=dt;
      const t=Math.min(1,this.jumpTimer/0.8);
      this.y=lerp(this.jumpFromY,this.jumpToY,t)-Math.sin(t*Math.PI)*150;
      if(t>=1){
        this.jumping=false; this.y=this.jumpToY;
        // 落地冲击波
        spawnParticles(this.x,this.y,'#daa520',60);
        if(player&&dist(this.x,this.y,player.x,player.y)<180)applyDirectDamage(player,3,'🪨落地冲击!',this.color);
        for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;enemyBullets.push(new EnemyBullet(this.x,this.y,a,220,9,'#cd5c5c'));}
      }
      return;
    }
    if(this.isCharging){
      this.chargeTimer-=dt; this.x+=this.chargeDirection.x*350*this.slowFactor*dt; this.y+=this.chargeDirection.y*350*this.slowFactor*dt;
      this.x=clamp(this.x,this.size,CONFIG.WIDTH-this.size); this.y=clamp(this.y,this.size,CONFIG.HEIGHT-this.size);
      this.movePhase+=dt*10; // 冲刺时快速摇摆
      this.moving=true;
      if(this.chargeTimer<=0){this.isCharging=false; spawnParticles(this.x,this.y,this.color,30);}
    }else{
      const d=dist(this.x,this.y,this.targetX,this.targetY);
      if(d<20){this.targetX=rand(this.size+30,CONFIG.WIDTH-this.size-30);this.targetY=rand(CONFIG.HEIGHT*0.30,CONFIG.HEIGHT*0.55); this.moving=false;}
      else{this.x+=(this.targetX-this.x)/d*this.speed*this.slowFactor*dt; this.y+=(this.targetY-this.y)/d*this.speed*this.slowFactor*dt; this.movePhase+=dt*6; this.moving=true;}
    }
    // 更新分身
    if(this.clones.length>0){
      for(const c of this.clones){c.timer-=dt; c.x+=Math.cos(c.angle)*60*dt; c.y+=Math.sin(c.angle)*60*dt; c.x=clamp(c.x,c.size,CONFIG.WIDTH-c.size); c.y=clamp(c.y,c.size,CONFIG.HEIGHT-c.size);}
      this.clones=this.clones.filter(c=>c.timer>0);
    }
    if(this.devourTimer>0){
      this.devourTimer-=dt;
      // 持续吸引玩家
      if(player){const a=Math.atan2(this.y-player.y,this.x-player.x);const d=dist(this.x,this.y,player.x,player.y);if(d<350&&d>10){player.x+=Math.cos(a)*60*dt;player.y+=Math.sin(a)*60*dt;}}
    }
    if(this.health<this.maxHealth*0.5&&!this.rage){this.rage=true;this.speed*=1.3;spawnParticles(this.x,this.y,this.color,40);showWaveAnnounce('狂暴！',`${this.name}进入狂暴状态`,true);}
    // ===== 半血特殊机制（仅触发一次） =====
    if(this.health<this.maxHealth*0.5&&!this.halfHealthTriggered&&!this.isFinalBoss){
      this.halfHealthTriggered=true;
      this.triggerHalfHealthSkill();
    }
    // ===== 25%血二阶段机制（仅触发一次，刑天已有3阶段机制跳过） =====
    if(this.health<this.maxHealth*0.25&&!this.quarterHealthTriggered&&!this.isFinalBoss&&this.alive){
      this.quarterHealthTriggered=true;
      this.triggerQuarterHealthSkill();
    }
    // 九尾狐无敌状态计时
    if(this.invulnerable){
      this.invulnerableTimer-=dt;
      if(this.invulnerableTimer<=0){
        this.invulnerable=false;
        spawnParticles(this.x,this.y,'#ff69b4',15);
      }
    }
    // 九尾狐半血后每5秒进入无敌1秒
    if(this.halfHealthTriggered&&this.bossIndex===0&&!this.invulnerable){
      this._foxInvulnCD=(this._foxInvulnCD||5)-dt;
      if(this._foxInvulnCD<=0){
        this._foxInvulnCD=5;
        this.invulnerable=true;
        this.invulnerableTimer=1.2;
        spawnParticles(this.x,this.y,'#ff69b4',25);
        pushFloatingText(this.x,this.y-40,'魅影闪避!','#ff69b4',1.5);
      }
    }
    this.updateBeam(dt);
    this.attackTimer-=dt; this.specialCooldown-=dt; this.special2Cooldown-=dt; this.warningTime-=dt;
    if(this.warningTime<=0&&this.warningType){
      if(this.warningIsSpecial2)this.executeSpecial2Attack(); else this.executeSpecialAttack();
      this.warningIsSpecial2=false;
      this.warningType=null;
      // 清理本Boss已过期的预警圈
      bossWarnings=bossWarnings.filter(w=>!w.boss||w.boss!==this);
    }
    // 试炼Boss随波次加快攻速（每波-8%，最多-40%）
    const trialSpd=this._trialIndex!=null?Math.max(0.6,1-this._trialIndex*0.08):1;
    // 难度影响：高难度下Boss特殊攻击更频繁（额外加快）
    const diffKey=saveData.difficulty;
    const specialSpdMul=(diffKey==='hard')?0.85:(diffKey==='hell')?0.7:(diffKey==='godslayer')?0.55:1;
    // 修复：刑天专属技能（halberdSweep/earthCrack）进行中时不触发新的special，避免覆盖halberdSweepData导致预警残留+倒数重置
    const xingtianSkillActive = this.isFinalBoss && (this.halberdSweepActive||this.earthCrackActive);
    // 刑天技能期间跳过普通攻击，避免doAttack重置attackType/attackAnim干扰技能动画
    if(this.attackTimer<=0){
      if(!xingtianSkillActive) this.doAttack();
      this.attackTimer=(this.rage?(this.isSuper?0.8:1.0):(this.isSuper?1.2:1.5-this.level*0.08))/getDifficulty().bossAtkMul*trialSpd;
    }
    if(this.specialCooldown<=0&&!this.isCharging&&this.warningTime<=0&&!this.jumping&&!xingtianSkillActive){this.startSpecialAttack(); this.specialCooldown=(this.rage?(this.isSuper?4:5):(this.isSuper?6:7))/getDifficulty().bossAtkMul*specialSpdMul*trialSpd;}
    // 第二特殊攻击（光波/多区域等互动型）
    if(this.special2Cooldown<=0&&!this.isCharging&&this.warningTime<=0&&!this.jumping&&!xingtianSkillActive){this.startSpecial2Attack(); this.special2Cooldown=(this.rage?(this.isSuper?7:8):(this.isSuper?9:10))/getDifficulty().bossAtkMul*specialSpdMul*trialSpd;}
    // 安全区全屏攻击：绿色预警圈=安全区，玩家须站在圈内躲避全屏伤害
    if(this.safeZoneActive){
      this.safeZoneData.timer-=dt;
      if(this.safeZoneData.timer<=0)this.executeSafeZoneAttack();
    }else{
      this.safeZoneTimer-=dt;
      if(this.safeZoneTimer<=0&&!this.isCharging&&this.warningTime<=0&&!this.jumping){
        this.startSafeZoneAttack();
        this.safeZoneTimer=(this.rage?15:22);
      }
    }
    // ===== 刑天最终Boss专属机制 =====
    if(this.isFinalBoss){
      // 阶段切换
      if(this.finalBossPhase===0&&this.health<this.maxHealth*0.5){
        this.finalBossPhase=1; this.rage=true;
        pushFloatingText(CONFIG.WIDTH/2,100,'⚔️ 刑天狂暴！攻速大增！','#8b0000',3);
        playSound('bossSkill'); spawnParticles(this.x,this.y,'#8b0000',60);
      }
      if(this.finalBossPhase===1&&this.health<this.maxHealth*0.25){
        this.finalBossPhase=2;
        pushFloatingText(CONFIG.WIDTH/2,100,'⚔️ 战魂不灭！刑天终极形态！','#ff0000',3);
        playSound('bossSkill'); spawnParticles(this.x,this.y,'#ff0000',80);
        // 终极阶段：召唤2个分身
        this.startWrathClones();
      }
      // 干戚横扫/天崩地裂计时器已移到frozen检查之前，确保冰冻时技能也能正常爆发
      // 战魂分身逻辑已移到updateWrathClones独立方法，不受frozen/jumping影响
    }
  }
  // 战魂分身完整逻辑：移动+射击+接触伤害，独立于Boss.update
  // 在主循环中每帧调用，确保Boss被frozen/jumping时分身依然活动并造成伤害
  updateWrathClones(dt){
    if(!this.wrathClonesActive||!player||!player.alive)return;
    for(const cl of this.wrathClones){
      if(!cl.alive)continue;
      cl.wobble+=dt*2;
      cl.attackTimer-=dt;
      if(cl.hitFlash>0)cl.hitFlash-=dt;
      // 1. 分身向玩家移动（追踪玩家）— 速度慢于玩家(240)，玩家可以跑掉
      const ang=Math.atan2(player.y-cl.y,player.x-cl.x);
      const spd=170; // 分身移动速度（慢于玩家240，给玩家逃生空间）
      cl.x+=Math.cos(ang)*spd*dt;
      cl.y+=Math.sin(ang)*spd*dt;
      cl.x=clamp(cl.x,30,CONFIG.WIDTH-30);
      cl.y=clamp(cl.y,30,CONFIG.HEIGHT-30);
      // 2. 分身定期向玩家射击（绕过无敌帧）— 连发3发追踪弹
      if(cl.attackTimer<=0){
        cl.attackTimer=1.2; // 每1.2秒射击一次（降低频率，给玩家反应时间）
        const baseA=Math.atan2(player.y-cl.y,player.x-cl.x);
        for(let k=-1;k<=1;k++){
          const a=baseA+k*0.18; // 三发扇形散射
          const eb=new EnemyBullet(cl.x,cl.y,a,320,12,'#bc8cff');
          eb.directHit=true;
          eb.directLabel='⚔️战魂弹!';
          enemyBullets.push(eb);
        }
        spawnParticles(cl.x,cl.y,'#bc8cff',10);
      }
      // 3. 分身接触伤害（绕过无敌帧，每0.4秒一次）
      const d=dist(cl.x,cl.y,player.x,player.y);
      if(d<100+player.size){
        cl._touchTick=(cl._touchTick||0)-dt;
        if(cl._touchTick<=0){
          cl._touchTick=0.4;
          applyDirectDamage(player,8,'⚔️战魂撞击!','#bc8cff');
          spawnParticles(player.x,player.y,'#bc8cff',18);
          screenShake=0.4;
        }
      }
    }
  }
  // ===== 刑天环绕战魂球更新（围绕本体旋转+接触伤害） =====
  updateOrbitingOrbs(dt){
    if(!this.isFinalBoss||!this.alive)return;
    const speedMul=this.finalBossPhase>=1?1.8:1.0; // 狂暴时加速
    for(const orb of this.orbitingOrbs){
      orb.angle+=orb.speed*speedMul*dt;
      orb.x=this.x+Math.cos(orb.angle)*orb.radius;
      orb.y=this.y+Math.sin(orb.angle)*orb.radius*0.7; // 椭圆轨道
      // 接触伤害（每0.5秒一次）
      if(player&&player.alive){
        const d=dist(orb.x,orb.y,player.x,player.y);
        if(d<orb.size+player.size){
          this._orbTouchTick-=dt;
          if(this._orbTouchTick<=0){
            this._orbTouchTick=0.5;
            applyDirectDamage(player,6,'⚔️战魂球!','#ff4500');
            spawnParticles(player.x,player.y,'#ff4500',12);
          }
        }
      }
    }
  }
  // ===== 刑天技能：干戚横扫（大开大合） =====
  startHalberdSweep(){
    this.halberdSweepActive=true;
    const r=260+this.level*15; // 扫击范围（加大）
    this.halberdSweepData={radius:r,timer:2.0,maxTimer:2.0,angle:0};
    playSound('warning');
    pushFloatingText(this.x,this.y-50,'⚔️ 干戚横扫！','#8b0000',2.5);
    screenShake=0.3;
    // 推入bossWarnings让预警系统也绘制
    bossWarnings.push({boss:this,x:this.x,y:this.y,radius:r,timer:2.0,maxTimer:2.0,color:'rgba(139,0,0'});
  }
  executeHalberdSweep(){
    const d=this.halberdSweepData;
    this.halberdSweepActive=false; this.halberdSweepData=null;
    screenShake=0.9; // 屏幕剧烈震动
    playSound('bossSkill');
    // 全屏红色闪光
    flashScreen('#8b0000',0.4);
    // 干戚横扫：仅对扫击范围内的玩家造成伤害（修复：原为全屏伤害bug）
    if(player&&player.alive){
      const dx=player.x-this.x, dy=player.y-this.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<=d.radius){
        applyDirectDamage(player,12,'⚔️干戚横扫!','#f85149');
        spawnParticles(player.x,player.y,'#f85149',40);
      }
    }
    // 专属横扫特效：半月形挥砍轨迹（明显的刀光弧线，绕boss一圈）
    // 用halberdSweepEffect标记，在fireEffects绘制中专门处理
    fireEffects.push({x:this.x,y:this.y,radius:d.radius,damage:0,life:1.2,maxLife:1.2,burnDmg:0,tick:0,chain:0,halberdSweepEffect:true});
    // 冲击波光环（多层扩散）
    fireEffects.push({x:this.x,y:this.y,radius:d.radius,damage:0,life:2.0,maxLife:2.0,burnDmg:0,tick:0,chain:0,hammerBlast:true});
    // 第二波：熔岩残留（持续伤害区，玩家踩入受伤）
    fireEffects.push({x:this.x,y:this.y,radius:d.radius*0.7,damage:0,life:3.5,maxLife:3.5,burnDmg:1.5,tick:0,chain:0,lavaPool:true,playerHazard:true});
    // 大量红色冲击波粒子（扩散环）
    for(let i=0;i<40;i++){
      const a=(i/40)*Math.PI*2;
      spawnParticles(this.x+Math.cos(a)*d.radius*0.5,this.y+Math.sin(a)*d.radius*0.5,'#8b0000',2);
    }
    spawnParticles(this.x,this.y,'#ff4500',100);
    spawnParticles(this.x,this.y,'#8b0000',50);
    // 弹幕环：12发火焰弹向外扩散
    for(let i=0;i<12;i++){
      const a=(i/12)*Math.PI*2;
      enemyBullets.push(new EnemyBullet(this.x,this.y,a,280,8,'#ff4500'));
    }
    // 清除本技能的预警（修复：原filter逻辑反了，导致当前boss预警被保留叠加）
    bossWarnings=bossWarnings.filter(w=>w.boss!==this);
  }
  // ===== 刑天技能：天崩地裂（大开大合） =====
  startEarthCrack(){
    this.earthCrackActive=true;
    // 在屏幕上生成7-9个裂纹区域（加大数量）
    const cracks=[];
    const count=7+this.finalBossPhase;
    for(let i=0;i<count;i++){
      cracks.push({x:rand(80,CONFIG.WIDTH-80),y:rand(120,CONFIG.HEIGHT-80),radius:rand(75,110),angle:rand(0,Math.PI*2)});
    }
    this.earthCrackData={cracks,timer:2.5,maxTimer:2.5};
    playSound('warning');
    pushFloatingText(CONFIG.WIDTH/2,80,'🌋 天崩地裂！','#ff4500',2.5);
    screenShake=0.4;
    // 推入预警
    for(const c of cracks){
      bossWarnings.push({boss:this,x:c.x,y:c.y,radius:c.radius,timer:2.5,maxTimer:2.5,color:'rgba(255,69,0'});
    }
  }
  executeEarthCrack(){
    const d=this.earthCrackData;
    this.earthCrackActive=false; this.earthCrackData=null;
    screenShake=1.0; // 屏幕剧烈震动
    playSound('bossSkill');
    flashScreen('#ff4500',0.5);
    // 统计玩家所在裂纹数，一次性结算伤害（避免被无敌帧吞掉）
    let hitCount=0;
    for(const c of d.cracks){
      // 爆炸冲击波（短暂视觉）
      fireEffects.push({x:c.x,y:c.y,radius:c.radius,damage:0,life:2.0,maxLife:2.0,burnDmg:0,tick:0,chain:0,hammerBlast:true});
      // 熔岩残留（持续伤害区，玩家踩进去会受伤）
      fireEffects.push({x:c.x,y:c.y,radius:c.radius*0.8,damage:0,life:4.5,maxLife:4.5,burnDmg:1.2,tick:0,chain:0,lavaPool:true,playerHazard:true});
      // 统计命中
      if(player&&player.alive&&dist(player.x,player.y,c.x,c.y)<c.radius){
        hitCount++;
      }
      // 每个裂纹点大量粒子
      spawnParticles(c.x,c.y,'#ff4500',50);
      spawnParticles(c.x,c.y,'#8b0000',25);
      // 每个裂纹喷射4发火焰弹
      for(let j=0;j<4;j++){
        const a=(j/4)*Math.PI*2+rand(-0.3,0.3);
        enemyBullets.push(new EnemyBullet(c.x,c.y,a,200,7,'#ff4500'));
      }
    }
    // 一次性结算所有裂纹伤害（每裂纹3点，最多9点）— 直接扣血绕过无敌帧
    if(hitCount>0&&player&&player.alive){
      const totalDmg=3*hitCount;
      applyDirectDamage(player,totalDmg,`地裂命中 x${hitCount}!`,'#ff4500');
      spawnParticles(player.x,player.y,'#ff4500',30);
    }
    // 清除本技能的预警（修复：原filter逻辑反了，导致当前boss预警被保留叠加）
    bossWarnings=bossWarnings.filter(w=>w.boss!==this);
  }
  // ===== 刑天技能：战魂分身 =====
  startWrathClones(){
    this.wrathClonesActive=true;
    this.attackAnim=1.0; this.attackAnimMax=1.0; this.attackType='wrathClones';
    this.wrathClones=[];
    const cloneCount=this.finalBossPhase>=2?3:2;
    for(let i=0;i<cloneCount;i++){
      const a=(i/cloneCount)*Math.PI*2;
      this.wrathClones.push({
        x:this.x+Math.cos(a)*180, y:this.y+Math.sin(a)*120,
        alive:true, alpha:0.7, attackTimer:1.5+i*0.5, wobble:0,
        spawnTime:0.5, // 出现动画
        hp:30, maxHp:30, // 战魂分身有血量，可以被玩家打掉
        size:this.size*0.7,
        hitFlash:0
      });
    }
    pushFloatingText(CONFIG.WIDTH/2,80,'⚔️ 战魂分身！击破它们！','#bc8cff',2.5);
    spawnParticles(this.x,this.y,'#bc8cff',50);
    screenShake=0.3;
  }
  // ===== 半血特殊机制：每个Boss独有技能 =====
  triggerHalfHealthSkill(){
    const idx=this.bossIndex;
    playSound('bossSkill');
    spawnParticles(this.x,this.y,this.color,60);
    if(idx===0){
      // 九尾狐：魅影闪避 — 进入无敌1.2秒，之后每5秒触发一次
      this.invulnerable=true; this.invulnerableTimer=1.2;
      this._foxInvulnCD=5;
      showWaveAnnounce('半血机制！','九尾狐：魅影闪避！',true);
      pushFloatingText(this.x,this.y-50,'🦊 魅影闪避!','#ff69b4',2);
    }else if(idx===1){
      // 毕方：烈焰爆发 — 短暂无敌后释放全屏火焰
      this.invulnerable=true; this.invulnerableTimer=1.5;
      gameTimeout(()=>{
        if(!this.alive)return;
        for(let i=0;i<12;i++){
          const a=(i/12)*Math.PI*2;
          const fx=this.x+Math.cos(a)*100, fy=this.y+Math.sin(a)*100;
          // playerHazard让玩家踩入火池受到持续伤害（否则火池只伤敌人不伤玩家，纯视觉无意义）
          fireEffects.push({x:fx,y:fy,radius:70,damage:1.0,life:3,maxLife:3,burnDmg:0.8,tick:0,chain:0,lavaPool:true,playerHazard:true});
        }
        spawnParticles(this.x,this.y,'#ff4500',60);
      },1500);
      showWaveAnnounce('半血机制！','毕方：烈焰爆发！',true);
      pushFloatingText(this.x,this.y-50,'🔥 烈焰爆发!','#ff4500',2);
    }else if(idx===2){
      // 相柳：毒雾护体 — 释放9个毒雾区域
      for(let i=0;i<9;i++){
        const a=(i/9)*Math.PI*2;
        const fx=this.x+Math.cos(a)*120, fy=this.y+Math.sin(a)*120;
        // playerHazard让玩家踩入毒雾受到持续伤害
        fireEffects.push({x:fx,y:fy,radius:55,damage:0.6,life:5,maxLife:5,burnDmg:0.6,tick:0,chain:0,playerHazard:true});
        spawnParticles(fx,fy,'#7cfc00',10);
      }
      showWaveAnnounce('半血机制！','相柳：毒雾护体！',true);
      pushFloatingText(this.x,this.y-50,'☠ 毒雾护体!','#7cfc00',2);
    }else if(idx===3){
      // 朱厌：石头护盾 — 获得护盾吸收伤害
      this.stoneShield=true;
      this.stoneShieldHp=this.maxHealth*0.25; // 护盾吸收25%最大血量
      showWaveAnnounce('半血机制！','朱厌：石头护盾！需打破护盾才能继续伤害',true);
      pushFloatingText(this.x,this.y-50,'🛡 石头护盾!','#8b6c5c',2);
      spawnParticles(this.x,this.y,'#8b6c5c',50);
    }else if(idx===4){
      // 烛龙：熔岩领域 — 大范围熔岩池
      for(let i=0;i<6;i++){
        const fx=rand(150,CONFIG.WIDTH-150), fy=rand(150,CONFIG.HEIGHT-200);
        // playerHazard让玩家踩入熔岩受到持续伤害
        fireEffects.push({x:fx,y:fy,radius:90,damage:1.2,life:5,maxLife:5,burnDmg:1.0,tick:0,chain:0,lavaPool:true,playerHazard:true});
        spawnParticles(fx,fy,'#ff6347',15);
      }
      showWaveAnnounce('半血机制！','烛龙：熔岩领域！',true);
      pushFloatingText(this.x,this.y-50,'🌋 熔岩领域!','#ff6347',2);
    }else if(idx===5){
      // 饕餮：吞噬黑洞 — 持续吸引玩家
      this.devourTimer=4; this.devourActive=true;
      fireEffects.push({x:this.x,y:this.y,radius:300,damage:0.8,life:4,maxLife:4,burnDmg:0,tick:0,chain:0,blackhole:true});
      showWaveAnnounce('半血机制！','饕餮：吞噬黑洞！',true);
      pushFloatingText(this.x,this.y-50,'🌀 吞噬黑洞!','#9370db',2);
    }else if(idx===6){
      // 英招：风刃风暴 — 持续风刃
      for(let i=0;i<4;i++){
        tornadoes.push({x:rand(100,CONFIG.WIDTH-100),y:rand(100,CONFIG.HEIGHT-150),vx:rand(-80,80),vy:rand(-80,80),life:6,maxLife:6,radius:60,damage:1.5,tick:0});
      }
      showWaveAnnounce('半血机制！','英招：风刃风暴！',true);
      pushFloatingText(this.x,this.y-50,'🌪 风刃风暴!','#58a6ff',2);
    }else if(idx===7){
      // 计蒙：水幕天华 — 释放水柱弹幕
      this.invulnerable=true; this.invulnerableTimer=1.0;
      gameTimeout(()=>{
        if(!this.alive)return;
        for(let i=0;i<24;i++){
          const a=(i/24)*Math.PI*2;
          enemyBullets.push(new EnemyBullet(this.x,this.y,a,200,8,'#58a6ff'));
        }
        spawnParticles(this.x,this.y,'#58a6ff',50);
      },1000);
      showWaveAnnounce('半血机制！','计蒙：水幕天华！',true);
      pushFloatingText(this.x,this.y-50,'💧 水幕天华!','#58a6ff',2);
    }else if(idx===8){
      // 穷奇：维度裂隙 — 释放虚空裂隙（玩家踩入受伤）
      for(let i=0;i<6;i++){
        const a=(i/6)*Math.PI*2;
        const fx=this.x+Math.cos(a)*150, fy=this.y+Math.sin(a)*150;
        fireEffects.push({x:fx,y:fy,radius:75,damage:0.8,life:5,maxLife:5,burnDmg:0.8,tick:0,chain:0,voidRift:true,playerHazard:true});
        spawnParticles(fx,fy,'#a855f7',12);
        // 生成时给玩家一次性伤害
        if(player&&player.alive&&dist(fx,fy,player.x,player.y)<75){
          applyDirectDamage(player,3,'维度裂隙!','#a855f7');
        }
      }
      this.invulnerable=true; this.invulnerableTimer=1.5;
      showWaveAnnounce('半血机制！','穷奇：维度裂隙！',true);
      pushFloatingText(this.x,this.y-50,'🌌 维度裂隙!','#a855f7',2);
    }
  }
  // 25%血量二阶段机制：每个Boss独有的"绝境爆发"
  triggerQuarterHealthSkill(){
    const idx=this.bossIndex;
    playSound('bossSkill');
    spawnParticles(this.x,this.y,this.color,80);
    spawnParticles(this.x,this.y,'#ff0000',30); // 红色暴怒粒子
    // 二阶段切换时清空旧子弹，给玩家反应时间（手机端屏幕小，旧子弹+新技能压力过大）
    enemyBullets=[];
    // 攻速大幅提升（二阶段共同点：进入绝境状态）
    this.attackTimer=Math.min(this.attackTimer,0.5);
    this.specialCooldown=Math.min(this.specialCooldown,1.5);
    this.special2Cooldown=Math.min(this.special2Cooldown,2.5);
    if(idx===0){
      // 九尾狐：魅影分身 — 创建2个分身持续10秒，分身射出幻影子弹
      // 注意：clones属性结构必须与executeSpecialAttack中phantomClone一致（timer/size/color），否则update/draw会失败
      this.clones=[];
      for(let i=0;i<2;i++){
        const a=(i/2)*Math.PI*2;
        const cx=this.x+Math.cos(a)*80, cy=this.y+Math.sin(a)*80;
        this.clones.push({x:cx,y:cy,size:this.size*0.6,timer:10,angle:a,color:i===0?'#ff69b4':'#daa520'});
      }
      showWaveAnnounce('二阶段！','九尾狐：魅影分身！分身射出幻影子弹',true);
      pushFloatingText(this.x,this.y-50,'✨ 魅影分身!','#ff69b4',2.5);
    }else if(idx===1){
      // 毕方：浴火重生 — 短暂无敌+恢复15%血量+释放环形火墙
      this.invulnerable=true; this.invulnerableTimer=2.0;
      const heal=Math.floor(this.maxHealth*0.15);
      this.health=Math.min(this.maxHealth,this.health+heal);
      gameTimeout(()=>{
        if(!this.alive)return;
        // 环形火墙：12个火池环绕Boss（playerHazard让玩家踩入受到持续伤害）
        for(let i=0;i<12;i++){
          const a=(i/12)*Math.PI*2;
          const fx=this.x+Math.cos(a)*150, fy=this.y+Math.sin(a)*150;
          fireEffects.push({x:fx,y:fy,radius:85,damage:1.5,life:6,maxLife:6,burnDmg:1.2,tick:0,chain:0,lavaPool:true,playerHazard:true});
        }
        spawnParticles(this.x,this.y,'#ff4500',80);
      },2000);
      showWaveAnnounce('二阶段！',`毕方：浴火重生！恢复${heal}血+火墙`,true);
      pushFloatingText(this.x,this.y-50,'🔥 浴火重生! +'+heal,'#ff4500',2.5);
    }else if(idx===2){
      // 相柳：九首齐发 — 9个方向同时射出毒弹幕
      this.invulnerable=true; this.invulnerableTimer=1.0;
      gameTimeout(()=>{
        if(!this.alive)return;
        for(let i=0;i<9;i++){
          const a=(i/9)*Math.PI*2;
          // 每个方向射出3连发毒弹
          for(let j=0;j<3;j++){
            enemyBullets.push(new EnemyBullet(this.x,this.y,a+(j-1)*0.1,180+j*30,7,'#7cfc00'));
          }
        }
        // 同时释放6个毒沼（playerHazard让玩家踩入受到持续伤害）
        for(let i=0;i<6;i++){
          const fx=rand(150,CONFIG.WIDTH-150), fy=rand(150,CONFIG.HEIGHT-200);
          fireEffects.push({x:fx,y:fy,radius:65,damage:0.8,life:6,maxLife:6,burnDmg:0.8,tick:0,chain:0,playerHazard:true});
        }
        spawnParticles(this.x,this.y,'#7cfc00',80);
      },1000);
      showWaveAnnounce('二阶段！','相柳：九首齐发！全屏毒弹幕',true);
      pushFloatingText(this.x,this.y-50,'🐉 九首齐发!','#7cfc00',2.5);
    }else if(idx===3){
      // 朱厌：巨猿践踏 — 连续3次大范围震击
      this.invulnerable=true; this.invulnerableTimer=2.5;
      for(let i=0;i<3;i++){
        gameTimeout(()=>{
          // 必须同时检查Boss存活、gameState、玩家存活，避免死亡动画窗口期内继续震击/位移已死亡玩家
          if(!this.alive||gameState!=='boss'||!player||!player.alive)return;
          this.attackAnim=1.0; this.attackAnimMax=1.0; this.attackType='jump';
          // 震击波：全屏范围伤害但远离Boss更安全
          fireEffects.push({x:this.x,y:this.y,radius:400,damage:2.5,life:0.8,maxLife:0.8,burnDmg:0,tick:0,chain:0,hammerBlast:true});
          screenShake=0.8;
          spawnParticles(this.x,this.y,'#8b6c5c',60);
          // 震退玩家
          const d=dist(this.x,this.y,player.x,player.y);
          if(d<400&&d>10){
            const a=Math.atan2(player.y-this.y,player.x-this.x);
            player.x+=Math.cos(a)*80;
            player.y+=Math.sin(a)*80;
          }
        }, i*800);
      }
      gameTimeout(()=>{if(this.alive&&gameState==='boss'){this.invulnerable=false;}}, 2500);
      showWaveAnnounce('二阶段！','朱厌：巨猿践踏！远离Boss！',true);
      pushFloatingText(this.x,this.y-50,'🦍 巨猿践踏!','#8b6c5c',2.5);
    }else if(idx===4){
      // 烛龙：光暗寂灭 — 5秒内随机落雷+全屏熔岩
      // 注意：lightningStrikes属性必须使用life/dmg（与updateLightningStrikes一致），并加isBossLightning标记对玩家造成伤害
      for(let i=0;i<10;i++){
        gameTimeout(()=>{
          if(!this.alive||gameState!=='boss')return; // 暂停期间推迟，跨局丢弃
          const fx=rand(100,CONFIG.WIDTH-100), fy=rand(100,CONFIG.HEIGHT-150);
          lightningStrikes.push({x:fx,y:fy,life:0.8,maxLife:0.8,dmg:3,radius:70,isBossLightning:true,struck:false});
          // playerHazard让熔岩池对玩家造成持续伤害
          fireEffects.push({x:fx,y:fy,radius:80,damage:1.0,life:4,maxLife:4,burnDmg:1.0,tick:0,chain:0,lavaPool:true,playerHazard:true});
        }, i*500);
      }
      showWaveAnnounce('二阶段！','烛龙：光暗寂灭！连续落雷+熔岩',true);
      pushFloatingText(this.x,this.y-50,'🌋 光暗寂灭!','#ff6347',2.5);
    }else if(idx===5){
      // 饕餮：暴食狂化 — 移速翻倍+攻速翻倍5秒+召唤3个分裂怪
      this.speed*=2; this.attackTimer*=0.5;
      gameTimeout(()=>{
        if(this.alive){this.speed/=2;}
      }, 5000);
      // 召唤3个分裂怪
      for(let i=0;i<3;i++){
        const a=(i/3)*Math.PI*2;
        const ex=this.x+Math.cos(a)*100, ey=this.y+Math.sin(a)*100;
        const e=new Enemy('splitter',currentWave+(currentLevel-1)*5);
        e.x=ex; e.y=ey;
        enemies.push(e);
      }
      showWaveAnnounce('二阶段！','饕餮：暴食狂化！移速攻速翻倍+召唤分裂怪',true);
      pushFloatingText(this.x,this.y-50,'🌀 暴食狂化!','#9370db',2.5);
    }else if(idx===6){
      // 英招：疾风冲刺 — 连续3次向玩家位置冲刺
      this.invulnerable=true; this.invulnerableTimer=3.0;
      for(let i=0;i<3;i++){
        gameTimeout(()=>{
          if(!this.alive||gameState!=='boss'||!player||!player.alive)return;
          this.isCharging=true;
          const a=Math.atan2(player.y-this.y,player.x-this.x);
          this.chargeDirection={x:Math.cos(a),y:Math.sin(a)};
          this.chargeTimer=0.8;
          // 冲刺路径上留下风刃
          for(let s=0;s<5;s++){
            gameTimeout(()=>{
              if(!this.alive||gameState!=='boss')return;
              const fx=this.x+rand(-30,30), fy=this.y+rand(-30,30);
              fireEffects.push({x:fx,y:fy,radius:50,damage:0,life:1.0,maxLife:1.0,burnDmg:0,tick:0,chain:0,windBlade:true});
            }, s*100);
          }
        }, i*1000);
      }
      gameTimeout(()=>{if(this.alive&&gameState==='boss'){this.invulnerable=false; this.isCharging=false;}}, 3000);
      showWaveAnnounce('二阶段！','英招：疾风冲刺！连续向玩家冲刺',true);
      pushFloatingText(this.x,this.y-50,'💨 疾风冲刺!','#58a6ff',2.5);
    }else if(idx===7){
      // 计蒙：暴雨降临 — 持续8秒全屏随机落雷
      // 注意：lightningStrikes属性必须使用life/dmg（与updateLightningStrikes一致），并加isBossLightning标记对玩家造成伤害
      for(let i=0;i<12;i++){
        gameTimeout(()=>{
          if(!this.alive||gameState!=='boss')return; // 暂停期间推迟，跨局丢弃
          const fx=rand(100,CONFIG.WIDTH-100), fy=rand(100,CONFIG.HEIGHT-150);
          lightningStrikes.push({x:fx,y:fy,life:0.7,maxLife:0.7,dmg:2.5,radius:80,isBossLightning:true,struck:false});
        }, i*650);
      }
      this.invulnerable=true; this.invulnerableTimer=1.5;
      showWaveAnnounce('二阶段！','计蒙：暴雨降临！8秒全屏落雷',true);
      pushFloatingText(this.x,this.y-50,'⛈ 暴雨降临!','#58a6ff',2.5);
    }else if(idx===8){
      // 穷奇：维度重叠 — 召唤6个维度裂隙+追踪虚空弹
      for(let i=0;i<6;i++){
        const a=(i/6)*Math.PI*2;
        const fx=this.x+Math.cos(a)*180, fy=this.y+Math.sin(a)*180;
        fireEffects.push({x:fx,y:fy,radius:85,damage:1.0,life:8,maxLife:8,burnDmg:1.0,tick:0,chain:0,voidRift:true,playerHazard:true});
      }
      // 5发追踪虚空弹
      for(let i=0;i<5;i++){
        gameTimeout(()=>{
          if(!this.alive||!player)return;
          const a=Math.atan2(player.y-this.y,player.x-this.x)+rand(-0.3,0.3);
          const eb=new EnemyBullet(this.x,this.y,a,140,8,'#a855f7');
          eb.homing=2.5; eb.homingTimer=3;
          enemyBullets.push(eb);
        }, i*400);
      }
      this.invulnerable=true; this.invulnerableTimer=2.0;
      showWaveAnnounce('二阶段！','穷奇：维度重叠！裂隙+追踪虚空弹',true);
      pushFloatingText(this.x,this.y-50,'🌌 维度重叠!','#a855f7',2.5);
    }
  }
  startSafeZoneAttack(){
    this.safeZoneActive=true;
    this.attackAnim=1.0; this.attackAnimMax=1.0; this.attackType='safeZone';
    // 安全区位置：随机但远离玩家，给玩家移动压力
    let sx,sy;
    if(player){
      // 放在距离玩家较远的位置，但不要太靠边
      let attempts=0;
      do{
        sx=rand(150,CONFIG.WIDTH-150);
        sy=rand(150,CONFIG.HEIGHT-150);
        attempts++;
      }while(dist(sx,sy,player.x,player.y)<300&&attempts<8);
    }else{sx=CONFIG.WIDTH/2;sy=CONFIG.HEIGHT/2;}
    const radius=100+this.level*5; // 安全区半径
    this.safeZoneData={x:sx,y:sy,radius:radius,timer:4.5,maxTimer:4.5};
    playSound('warning');
    pushFloatingText(CONFIG.WIDTH/2,80,'⚠ 绿圈=安全区！速躲入！','#3fb950',3);
  }
  executeSafeZoneAttack(){
    const d=this.safeZoneData;
    this.safeZoneActive=false; this.safeZoneData=null;
    // 全屏伤害：站在安全区外的玩家受到大量伤害
    if(player&&player.alive){
      const distToSafe=dist(player.x,player.y,d.x,d.y);
      if(distToSafe>d.radius){
        applyDirectDamage(player,4,'💥全屏伤害!','#ff4500'); // 全屏伤害3点（绕过无敌帧）
        spawnParticles(player.x,player.y,'#f85149',30);
        pushFloatingText(player.x,player.y-30,'全屏伤害!','#f85149',1.5);
      }else{
        // 成功躲避：奖励积分
        score+=100;
        pushFloatingText(player.x,player.y-30,'完美躲避! +100','#3fb950',1.5);
        spawnParticles(player.x,player.y,'#3fb950',15);
      }
    }
    // 视觉：全屏闪光+安全区外红色
    spawnParticles(d.x,d.y,'#3fb950',40);
  }
  startSpecialAttack(){
    // 刑天最终Boss：使用专属技能
    if(this.isFinalBoss){
      this.attackAnim=1.0; this.attackAnimMax=1.0;
      // 50%几率干戚横扫，50%几率天崩地裂
      if(Math.random()<0.5){this.attackType='halberdSweep';this.startHalberdSweep();}
      else{this.attackType='earthCrack';this.startEarthCrack();}
      return;
    }
    // 变异Boss使用混搭的special技能
    const sp=this.isVariant?(this._variantSpecial||this.bossType.special):this.bossType.special;
    this.warningType=sp; this.warningTime=1.5;
    this.attackAnim=0.8; this.attackAnimMax=0.8; this.attackType=sp;
    if(sp==='fireRain'||sp==='poisonSwamp'||sp==='lavaPool'){
      const cnt = sp==='lavaPool'?5:(4+this.level);
      const pos=[]; for(let i=0;i<cnt;i++)pos.push({x:rand(100,CONFIG.WIDTH-100),y:rand(100,CONFIG.HEIGHT-100),radius:55+rand(0,20)});
      this.warningData={positions:pos};
    }else if(sp==='phantomClone'){this.warningData={};}
    else if(sp==='groundShock'){if(player)this.warningData={x:player.x,y:player.y,radius:180};}
    else if(sp==='lavaFist'){this.warningData={};}
    else if(sp==='bulletAbsorb'){this.warningData={radius:300};}
    else if(sp==='tornadoSpin'){
      // 英招龙卷旋风：3个移动龙卷风预警
      const pos=[]; for(let i=0;i<3;i++)pos.push({x:rand(150,CONFIG.WIDTH-150),y:rand(150,CONFIG.HEIGHT-150),radius:70});
      this.warningData={positions:pos};
    }else if(sp==='rainStorm'){
      // 计蒙暴雨：5个圆形区域预警
      const cnt=5+Math.min(this.level,2);
      const pos=[]; for(let i=0;i<cnt;i++)pos.push({x:rand(80,CONFIG.WIDTH-80),y:rand(80,CONFIG.HEIGHT-80),radius:65});
      this.warningData={positions:pos};
    }else if(sp==='voidRift'){
      // 穷奇虚空裂缝：3道长条裂缝预警
      const pos=[];
      for(let i=0;i<3;i++){
        const isH=Math.random()<0.5;
        pos.push({x:rand(200,CONFIG.WIDTH-200),y:rand(200,CONFIG.HEIGHT-200),horizontal:isH,length:300});
      }
      this.warningData={positions:pos};
    }
    // 复用meteor的视觉警告（区域型）
    let warnType='meteor';
    if(sp==='groundShock')warnType='eyeBeam';
    else if(sp==='phantomClone'||sp==='lavaFist'||sp==='bulletAbsorb')warnType='teleport';
    bossWarnings.push({type:warnType,data:this.warningData,time:1.5,maxTime:1.5,boss:this});
  }
  executeSpecialAttack(){
    const sp=this.warningType,data=this.warningData; this.warningType=null; this.warningData=null;
    if(sp==='phantomClone'){
      // 九尾狐幻影分身：创建2个分身同时射击
      spawnParticles(this.x,this.y,this.color,35);
      this.clones=[];
      for(let i=0;i<2;i++){const a=(i/2)*Math.PI*2;this.clones.push({x:this.x+Math.cos(a)*80,y:this.y+Math.sin(a)*80,size:this.size*0.6,timer:6,angle:a,color:this.color});}
      // 分身+本体同时发射弹幕（减少弹数）
      const shooters=[{x:this.x,y:this.y},...this.clones];
      for(const sh of shooters){for(let i=0;i<4;i++){const a=(i/4)*Math.PI*2;enemyBullets.push(new EnemyBullet(sh.x,sh.y,a,170,7,this.color));}}
    }else if(sp==='fireRain'){
      // 毕方天降火雨
      if(data&&data.positions)for(const p of data.positions){
        spawnParticles(p.x,p.y,this.color,30);
        fireEffects.push({x:p.x,y:p.y,radius:p.radius,damage:0.5,life:2,maxLife:2,burnDmg:0.5,tick:0,chain:0,playerHazard:true});
        if(player&&player.alive&&dist(p.x,p.y,player.x,player.y)<p.radius)applyDirectDamage(player,2,'🔥火雨!',this.color);
        for(let i=0;i<2;i++){const a=(i/2)*Math.PI*2;enemyBullets.push(new EnemyBullet(p.x,p.y,a,140,6,this.color));}
      }
    }else if(sp==='poisonSwamp'){
      // 相柳毒沼蔓延
      if(data&&data.positions)for(const p of data.positions){
        spawnParticles(p.x,p.y,this.color,30);
        fireEffects.push({x:p.x,y:p.y,radius:p.radius,damage:0.4,life:3,maxLife:3,burnDmg:0.4,tick:0,chain:0,playerHazard:true});
        if(player&&player.alive&&dist(p.x,p.y,player.x,player.y)<p.radius)applyDirectDamage(player,2,'☠️毒沼!',this.color);
      }
    }else if(sp==='groundShock'){
      // 朱厌震地冲击：跳跃后落地产生冲击波
      this.jumping=true; this.jumpTimer=0; this.jumpFromY=this.y;
      this.jumpToY=clamp(data?data.y:CONFIG.HEIGHT/2,this.size+20,CONFIG.HEIGHT-this.size-20);
      this.x=clamp(data?data.x:this.x,this.size,CONFIG.WIDTH-this.size);
    }else if(sp==='lavaPool'){
      // 烛龙熔岩池：依次丢出5个熔岩池
      if(data&&data.positions){
        data.positions.forEach((p,i)=>{
          gameTimeout(()=>{
            if(!this.alive||gameState!=='boss')return;
            spawnParticles(p.x,p.y,this.color,35);
            fireEffects.push({x:p.x,y:p.y,radius:p.radius,damage:0.8,life:4,maxLife:4,burnDmg:0.8,tick:0,chain:0,playerHazard:true});
            if(player&&player.alive&&dist(p.x,p.y,player.x,player.y)<p.radius)applyDirectDamage(player,3,'🪨巨石!',this.color);
            for(let j=0;j<3;j++){const a=(j/3)*Math.PI*2;enemyBullets.push(new EnemyBullet(p.x,p.y,a,160,8,this.color));}
          },i*400);
        });
      }
    }else if(sp==='lavaFist'){
      // 烛龙熔岩巨拳：连续追击玩家（有预警，可躲避）
      this.fistTimer=4;
      const fistInterval=0.7;
      const doFist=()=>{
        if(!this.alive||this.fistTimer<=0||gameState!=='boss')return;
        if(player){
          // 记录拳头落点（玩家当前位置），延迟0.5s后判定伤害，给玩家躲避机会
          const fx=player.x,fy=player.y;
          // 预警标记（0.5秒预警，更明显）
          bossWarnings.push({boss:this,x:fx,y:fy,radius:90,timer:0.5,maxTimer:0.5,color:'rgba(255,102,0'});
          gameTimeout(()=>{
            if(!this.alive||gameState!=='boss')return;
            spawnParticles(fx,fy,this.color,50);
            // 落地爆炸效果
            fireEffects.push({x:fx,y:fy,radius:90,damage:0,life:1.0,maxLife:1.0,burnDmg:0,tick:0,chain:0,hammerBlast:true});
            // 判定时用玩家当前位置与落点比较，玩家移开则免伤
            if(player&&player.alive&&dist(fx,fy,player.x,player.y)<90)applyDirectDamage(player,3,'💥爆炸!','#ff4500');
            for(let i=0;i<4;i++){const a=(i/4)*Math.PI*2;enemyBullets.push(new EnemyBullet(fx,fy,a,180,9,this.color));}
          },500);
        }
        this.fistTimer-=fistInterval;
        if(this.fistTimer>0)gameTimeout(doFist,fistInterval*1000);
      };
      gameTimeout(doFist,200);
    }else if(sp==='bulletAbsorb'){
      // 饕餮弹幕吞噬：吸收玩家子弹后反弹
      this.devourTimer=3;
      const absorbed=bullets.filter(b=>b.alive&&dist(this.x,this.y,b.x,b.y)<300);
      for(const b of absorbed){
        b.alive=false;
        // 反弹为敌方子弹
        if(player){const a=Math.atan2(player.y-this.y,player.x-this.x)+rand(-0.3,0.3);enemyBullets.push(new EnemyBullet(this.x,this.y,a,260,9,this.color));}
      }
      spawnParticles(this.x,this.y,this.color,50);
    }else if(sp==='tornadoSpin'){
      // 英招龙卷旋风：召唤3个移动龙卷风
      if(data&&data.positions)for(const p of data.positions){
        spawnParticles(p.x,p.y,this.color,30);
        const a=rand(0,Math.PI*2);
        tornadoes.push({x:p.x,y:p.y,vx:Math.cos(a)*120,vy:Math.sin(a)*120,radius:80,damage:0.5,life:5,maxLife:5,tick:0});
      }
    }else if(sp==='rainStorm'){
      // 计蒙暴雨：多区域同时水柱
      if(data&&data.positions)for(const p of data.positions){
        spawnParticles(p.x,p.y,this.color,30);
        fireEffects.push({x:p.x,y:p.y,radius:p.radius,damage:0.5,life:2.5,maxLife:2.5,burnDmg:0.5,tick:0,chain:0,waterRift:true,playerHazard:true});
        if(player&&player.alive&&dist(p.x,p.y,player.x,player.y)<p.radius)applyDirectDamage(player,2,'💧暴雨!',this.color);
        for(let i=0;i<2;i++){const a=(i/2)*Math.PI*2;enemyBullets.push(new EnemyBullet(p.x,p.y,a,150,7,this.color));}
      }
    }else if(sp==='voidRift'){
      // 穷奇虚空裂缝：3道长条裂缝持续伤害（玩家踩入也受伤）
      if(data&&data.positions)for(const p of data.positions){
        spawnParticles(p.x,p.y,this.color,40);
        // 长条形裂缝（用多个小圆形拼接）
        const steps=6;
        for(let i=0;i<steps;i++){
          const t=i/(steps-1);
          const fx=p.x+(p.horizontal?(t-0.5)*p.length:0);
          const fy=p.y+(p.horizontal?0:(t-0.5)*p.length);
          // 添加playerHazard让玩家踩入裂缝受到持续伤害
          fireEffects.push({x:fx,y:fy,radius:35,damage:1.0,life:3,maxLife:3,burnDmg:1.0,tick:0,chain:0,voidRift:true,playerHazard:true});
          // 首次生成时给玩家一次性伤害判定
          if(player&&player.alive&&dist(fx,fy,player.x,player.y)<35){
            applyDirectDamage(player,2,'虚空裂隙!','#a855f7');
          }
        }
      }
    }
    bossWarnings=bossWarnings.filter(w=>w.boss!==this);
  }
  // ==================== 第二特殊攻击（互动型：光波/多区域） ====================
  startSpecial2Attack(){
    // 刑天最终Boss：special2也用专属技能（终极阶段才召唤分身）
    if(this.isFinalBoss){
      this.attackAnim=1.0; this.attackAnimMax=1.0;
      if(this.finalBossPhase>=1&&Math.random()<0.4){this.attackType='wrathClones';this.startWrathClones();}
      else if(Math.random()<0.5){this.attackType='halberdSweep';this.startHalberdSweep();}
      else{this.attackType='earthCrack';this.startEarthCrack();}
      return;
    }
    // 变异Boss使用混搭的special2技能
    const sp=this.isVariant?(this._variantSpecial2||this.bossType.special2):this.bossType.special2;
    this.warningType=sp; this.warningIsSpecial2=true; this.warningTime=1.8; // 更长预警时间给玩家反应
    this.attackAnim=1; this.attackAnimMax=1; this.attackType=sp;
    if(sp==='charmBeam'){
      // 九尾狐魅惑光波：水平贯穿光束
      this.warningData={beamType:'horizontal',y:this.y};
    }else if(sp==='diveBomb'){
      // 毕方俯冲轰炸：多个区域预警后同时打击
      const cnt=4+Math.min(this.level,3);
      const pos=[];
      for(let i=0;i<cnt;i++)pos.push({x:rand(80,CONFIG.WIDTH-80),y:rand(80,CONFIG.HEIGHT-80),radius:70});
      this.warningData={positions:pos};
    }else if(sp==='poisonSpray'){
      // 相柳毒液喷射：3条扇形光波
      const a0=Math.atan2(player.y-this.y,player.x-this.x);
      this.warningData={beamType:'fan',x:this.x,y:this.y,angles:[a0-0.5,a0,a0+0.5]};
    }else if(sp==='rockBarrage'){
      // 朱厌巨石弹幕：多个区域预警后同时打击
      const cnt=5+Math.min(this.level,2);
      const pos=[];
      for(let i=0;i<cnt;i++)pos.push({x:rand(80,CONFIG.WIDTH-80),y:rand(80,CONFIG.HEIGHT-80),radius:60});
      this.warningData={positions:pos};
    }else if(sp==='lightBeam'){
      // 烛龙光束：垂直贯穿光波
      this.warningData={beamType:'vertical',x:this.x};
    }else if(sp==='gravityWell'){
      // 饕餮引力井：大范围吸引区域
      this.warningData={beamType:'zone',x:player?player.x:CONFIG.WIDTH/2,y:player?player.y:CONFIG.HEIGHT/2,radius:200};
    }else if(sp==='airDash'){
      // 英招空中冲刺：闪烁到玩家附近造成范围伤害
      this.warningData={beamType:'zone',x:player?player.x:CONFIG.WIDTH/2,y:player?player.y:CONFIG.HEIGHT/2,radius:120};
    }else if(sp==='floodWave'){
      // 计蒙洪水波纹：从Boss位置发出3个同心圆波纹
      this.warningData={beamType:'concentric',x:this.x,y:this.y,radius:200};
    }else if(sp==='dimensionStorm'){
      // 穷奇维度风暴：全屏多区域+追踪弹
      const cnt=6+Math.min(this.level,2);
      const pos=[]; for(let i=0;i<cnt;i++)pos.push({x:rand(80,CONFIG.WIDTH-80),y:rand(80,CONFIG.HEIGHT-80),radius:60});
      this.warningData={positions:pos};
    }
    bossWarnings.push({type:'special2',subType:sp,data:this.warningData,time:1.8,maxTime:1.8,boss:this,color:'rgba(248,81,73'});
  }
  executeSpecial2Attack(){
    const sp=this.warningType,data=this.warningData; this.warningType=null; this.warningData=null;
    if(sp==='charmBeam'){
      // 九尾狐魅惑光波：水平贯穿光束，持续0.8秒
      this._beamActive=true; this._beamData={...data,duration:0.8,timer:0};
      spawnParticles(this.x,this.y,this.color,40);
    }else if(sp==='diveBomb'){
      // 毕方俯冲轰炸：同时打击所有预警区域
      if(data&&data.positions)for(const p of data.positions){
        spawnParticles(p.x,p.y,this.color,35);
        fireEffects.push({x:p.x,y:p.y,radius:p.radius,damage:0.6,life:2.5,maxLife:2.5,burnDmg:0.6,tick:0,chain:0,playerHazard:true});
        if(player&&player.alive&&dist(p.x,p.y,player.x,player.y)<p.radius)applyDirectDamage(player,3,'💥俯冲轰炸!',this.color);
        // 少量溅射弹（非弹幕海）
        for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2;enemyBullets.push(new EnemyBullet(p.x,p.y,a,120,7,this.color));}
      }
    }else if(sp==='poisonSpray'){
      // 相柳毒液喷射：3条扇形光波
      this._beamActive=true; this._beamData={...data,duration:0.7,timer:0};
      spawnParticles(this.x,this.y,this.color,35);
    }else if(sp==='rockBarrage'){
      // 朱厌巨石弹幕：同时打击所有预警区域
      if(data&&data.positions)for(const p of data.positions){
        spawnParticles(p.x,p.y,'#daa520',30);
        if(player&&dist(p.x,p.y,player.x,player.y)<p.radius)applyDirectDamage(player,3,'🪨巨石弹幕!','#cd5c5c');
        for(let i=0;i<2;i++){const a=(i/2)*Math.PI*2;enemyBullets.push(new EnemyBullet(p.x,p.y,a,140,8,'#cd5c5c'));}
      }
    }else if(sp==='lightBeam'){
      // 烛龙光束：垂直贯穿光波，持续1秒
      this._beamActive=true; this._beamData={...data,duration:1.0,timer:0};
      spawnParticles(this.x,this.y,this.color,50);
    }else if(sp==='gravityWell'){
      // 饕餮引力井：大范围吸引+爆炸
      this._wellActive=true; this._wellData={...data,duration:1.5,timer:0};
      spawnParticles(data.x,data.y,this.color,50);
    }else if(sp==='airDash'){
      // 英招空中冲刺：闪烁到玩家附近，造成范围伤害+风刃
      const oldX=this.x,oldY=this.y;
      this.x=clamp(data.x+rand(-30,30),this.size,CONFIG.WIDTH-this.size);
      this.y=clamp(data.y+rand(-30,30),this.size,CONFIG.HEIGHT-this.size);
      spawnParticles(oldX,oldY,this.color,30);
      spawnParticles(this.x,this.y,this.color,50);
      if(player&&dist(this.x,this.y,player.x,player.y)<data.radius+player.size)applyDirectDamage(player,3,'🌪️风刃!',this.color);
      // 8方向风刃
      for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;enemyBullets.push(new EnemyBullet(this.x,this.y,a,220,7,this.color));}
      // 范围爆炸视觉
      fireEffects.push({x:this.x,y:this.y,radius:data.radius,damage:0,life:1.0,maxLife:1.0,burnDmg:0,tick:0,chain:0,hammerBlast:true});
    }else if(sp==='floodWave'){
      // 计蒙洪水波纹：3个同心圆波纹扩散
      this._floodActive=true; this._floodData={x:data.x,y:data.y,timer:0,waves:[{r:0,maxR:200,timer:0},{r:0,maxR:350,timer:0.5},{r:0,maxR:500,timer:1.0}]};
      spawnParticles(data.x,data.y,this.color,40);
    }else if(sp==='dimensionStorm'){
      // 穷奇维度风暴：全屏多区域+追踪弹
      if(data&&data.positions)for(const p of data.positions){
        spawnParticles(p.x,p.y,this.color,30);
        fireEffects.push({x:p.x,y:p.y,radius:p.radius,damage:0.8,life:2,maxLife:2,burnDmg:0.8,tick:0,chain:0,voidRift:true,playerHazard:true});
        if(player&&player.alive&&dist(p.x,p.y,player.x,player.y)<p.radius)applyDirectDamage(player,3,'🌀虚空裂缝!',this.color);
      }
      // 6发追踪弹
      for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;const eb=new EnemyBullet(this.x,this.y,a,200,8,this.color);eb.homing=0.6;enemyBullets.push(eb);}
      spawnParticles(this.x,this.y,this.color,60);
    }
    bossWarnings=bossWarnings.filter(w=>w.boss!==this);
  }
  // 更新光波/引力井持续效果
  updateBeam(dt){
    if(this._beamActive&&this._beamData){
      const d=this._beamData; d.timer+=dt;
      const beamWidth=50;
      if(d.beamType==='horizontal'){
        // 水平光波：检查玩家是否在光波范围内
        if(player&&Math.abs(player.y-d.y)<beamWidth)player.takeDamage(dt*5);
        spawnParticles(this.x,d.y,this.color,3);
      }else if(d.beamType==='vertical'){
        // 垂直光波
        if(player&&Math.abs(player.x-d.x)<beamWidth)player.takeDamage(dt*6);
        spawnParticles(d.x,this.y,this.color,4);
      }else if(d.beamType==='fan'){
        // 扇形光波
        if(player){
          const a=Math.atan2(player.y-d.y,player.x-d.x);
          for(const fa of d.angles){
            if(Math.abs(((a-fa+Math.PI*3)%(Math.PI*2))-Math.PI)<0.15&&dist(d.x,d.y,player.x,player.y)<600){
              player.takeDamage(dt*5); break;
            }
          }
        }
        spawnParticles(d.x,d.y,this.color,3);
      }
      if(d.timer>=d.duration){this._beamActive=false; this._beamData=null; spawnParticles(this.x,this.y,this.color,20);}
    }
    if(this._wellActive&&this._wellData){
      const d=this._wellData; d.timer+=dt;
      // 吸引玩家
      if(player){
        const dx=d.x-player.x,dy=d.y-player.y,dist2=Math.sqrt(dx*dx+dy*dy);
        if(dist2<d.radius&&dist2>10){
          const pull=80*(1-dist2/d.radius);
          player.x+=dx/dist2*pull*dt; player.y+=dy/dist2*pull*dt;
        }
        // 距离很近时造成伤害
        if(dist2<60)player.takeDamage(dt*8);
      }
      spawnParticles(d.x+rand(-d.radius,d.radius),d.y+rand(-d.radius,d.radius),this.color,2);
      if(d.timer>=d.duration){
        // 最终爆炸
        this._wellActive=false;
        spawnParticles(d.x,d.y,this.color,60);
        if(player&&dist(d.x,d.y,player.x,player.y)<d.radius)applyDirectDamage(player,4,'💥引力爆炸!',this.color);
        for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;enemyBullets.push(new EnemyBullet(d.x,d.y,a,150,8,this.color));}
        this._wellData=null;
      }
    }
    // 计蒙洪水波纹：3个同心圆波纹扩散
    if(this._floodActive&&this._floodData){
      const d=this._floodData; d.timer+=dt;
      let allDone=true;
      for(const w of d.waves){
        if(d.timer>=w.timer){
          w.r+=180*dt; // 扩散速度
          // 检查玩家是否在波纹上（圆环判定）
          if(player){
            const pd=dist(d.x,d.y,player.x,player.y);
            if(Math.abs(pd-w.r)<25)player.takeDamage(dt*4);
          }
          spawnParticles(d.x+Math.cos(d.timer*3+w.timer)*w.r,d.y+Math.sin(d.timer*3+w.timer)*w.r,this.color,1);
          if(w.r<w.maxR)allDone=false;
        }else allDone=false;
      }
      if(allDone){this._floodActive=false; this._floodData=null; spawnParticles(d.x,d.y,this.color,30);}
    }
  }
  doAttack(){
    if(!player)return;
    const atk=this.bossType.attack;
    this.attackAnim=0.5; this.attackAnimMax=0.5; this.attackType=atk;
    if(atk==='charmBullet'){
      // 九尾狐魅惑弹幕：3方向扇形（减少弹数）
      const ba=Math.atan2(player.y-this.y,player.x-this.x);
      for(let i=-1;i<=1;i++){const a=ba+i*0.4;enemyBullets.push(new EnemyBullet(this.x,this.y+this.size*0.5,a,200+this.level*8,8,this.color));}
    }else if(atk==='fireFeather'){
      // 毕方火焰羽毛散射（减少弹数）
      const c=4+Math.min(this.level,3),ba=Math.atan2(player.y-this.y,player.x-this.x);
      for(let i=0;i<c;i++){const a=ba-0.5+(1.0/(c-1))*i;enemyBullets.push(new EnemyBullet(this.x,this.y,a,190+this.level*6,7,this.color));}
    }else if(atk==='poisonNine'){
      // 相柳九头毒液弹：5方向（原9方向太多）
      const c=5;
      for(let i=0;i<c;i++){const a=(i/c)*Math.PI*2+this.wobble*0.3;enemyBullets.push(new EnemyBullet(this.x,this.y,a,160+this.level*5,7,this.color));}
    }else if(atk==='rockThrow'){
      // 朱厌投掷巨石（分裂弹）
      const ba=Math.atan2(player.y-this.y,player.x-this.x);
      enemyBullets.push(new EnemyBullet(this.x,this.y,ba,200,12,this.color));
      enemyBullets.push(new EnemyBullet(this.x,this.y,ba+0.3,180,6,this.color));
      enemyBullets.push(new EnemyBullet(this.x,this.y,ba-0.3,180,6,this.color));
    }else if(atk==='lavaPool'){
      // 烛龙普通攻击：熔岩散射（减少弹数，3发）
      const c=3;
      for(let i=0;i<c;i++){const a=(i/c)*Math.PI*2+this.wobble;enemyBullets.push(new EnemyBullet(this.x,this.y,a,170,8,this.color));}
    }else if(atk==='devourAtk'){
      // 饕餮普通攻击：吸引弹幕（减少弹数）
      const c=4;
      for(let i=0;i<c;i++){const a=(i/c)*Math.PI*2;enemyBullets.push(new EnemyBullet(this.x,this.y,a,150,7,this.color));}
      if(player){const d=dist(this.x,this.y,player.x,player.y);if(d<400&&d>10){const a=Math.atan2(this.y-player.y,this.x-player.x);player.x+=Math.cos(a)*20;player.y+=Math.sin(a)*20;}}
    }else if(atk==='windBlade'){
      // 英招普通攻击：3发快速风刃（连射）
      const ba=Math.atan2(player.y-this.y,player.x-this.x);
      for(let i=-1;i<=1;i++){const a=ba+i*0.25;enemyBullets.push(new EnemyBullet(this.x,this.y,a,260+this.level*8,6,this.color));}
    }else if(atk==='waterJet'){
      // 计蒙普通攻击：5发水柱扇形
      const c=5,ba=Math.atan2(player.y-this.y,player.x-this.x);
      for(let i=0;i<c;i++){const a=ba-0.4+(0.8/(c-1))*i;enemyBullets.push(new EnemyBullet(this.x,this.y,a,200+this.level*6,7,this.color));}
    }else if(atk==='chaosBolt'){
      // 穷奇普通攻击：4发紫色追踪弹
      const ba=Math.atan2(player.y-this.y,player.x-this.x);
      for(let i=0;i<4;i++){const a=ba+(i-1.5)*0.2;const eb=new EnemyBullet(this.x,this.y,a,180,8,this.color);eb.homing=0.8;enemyBullets.push(eb);}
    }
  }
  applyIceEffect(eff){if(eff.slow){this.slowFactor=Math.min(this.slowFactor,1-eff.slow*0.5);this.slowTimer=eff.slowDur;}}
  takeDamage(dmg,bullet){
    // 防止Boss死后继续受到伤害（同一帧多颗子弹命中时避免die()被多次调用）
    if(!this.alive)return;
    // 九尾狐无敌状态：免疫所有伤害
    if(this.invulnerable){
      spawnParticles(this.x,this.y,'#ff69b4',5);
      pushFloatingText(this.x,this.y-this.size-5,'免疫','#ff69b4',0.6);
      return;
    }
    // 朱厌石头护盾：吸收伤害（溢出伤害传递到主逻辑处理，应用护甲/上限，避免双伤）
    if(this.stoneShield&&this.stoneShieldHp>0){
      if(dmg>=this.stoneShieldHp){
        // 护盾破碎：将溢出部分作为新 dmg 走主逻辑（应用护甲/上限），避免重复扣血
        dmg=dmg-this.stoneShieldHp;
        this.stoneShieldHp=0; this.stoneShield=false;
        spawnParticles(this.x,this.y,'#8b6c5c',40);
        pushFloatingText(this.x,this.y-this.size-10,'护盾破碎!','#daa520',1.5);
        showWaveAnnounce('破盾！','朱厌的石头护盾被击碎',true);
        if(dmg<=0)return; // 无溢出伤害，不再继续
        // 有溢出伤害时，让 dmg 走下方主逻辑（护甲/上限/扣血）
      }else{
        this.stoneShieldHp-=dmg;
        spawnParticles(this.x+rand(-this.size*0.5,this.size*0.5),this.y+rand(-this.size*0.5,this.size*0.5),'#8b6c5c',4);
        pushFloatingText(this.x,this.y-this.size-10,`🛡${Math.ceil(dmg)}`,'#8b6c5c',0.6);
        return;
      }
    }
    if(this.armor>0)dmg=dmg*(1-this.armor); // Boss护甲减伤
    // 伤害上限：每次受击最多扣一定比例最大血量（防止Boss被秒杀，保证半血机制能触发）
    const diff=getDifficulty();
    if(diff.bossDmgCap&&diff.bossDmgCap>0){
      const maxDmg=this.maxHealth*diff.bossDmgCap;
      if(dmg>maxDmg)dmg=maxDmg;
    }
    this.health-=dmg; this.hitFlash=0.08; spawnParticles(this.x+rand(-this.size*0.5,this.size*0.5),this.y+rand(-this.size*0.5,this.size*0.5),this.color,3);
    // 死亡复盘：Boss伤害统计
    if(typeof runStats!=='undefined' && dmg>0)runStats.damageDealt+=dmg;
    // Boss击中音效（节流：Boss 60ms 内最多1次，避免高频射击音效叠加刺耳）
    const now=performance.now();
    if(!this._lastHitSnd||now-this._lastHitSnd>60){ playSound('bossHit'); this._lastHitSnd=now; }
    // 元素伤害可视化：Boss也显示彩色伤害浮字
    if(bullet&&bullet.elementEffects){
      if(bullet.elementEffects.ice)pushFloatingText(this.x,this.y-this.size-10,`❄${Math.ceil(dmg)}`,'#79c0ff',0.8);
      else if(bullet.elementEffects.lightning)pushFloatingText(this.x,this.y-this.size-10,`⚡${Math.ceil(dmg)}`,'#fff700',0.8);
      if(bullet.specialEffects&&bullet.specialEffects.fireball)pushFloatingText(this.x+20,this.y-this.size-10,`🔥${Math.ceil(dmg)}`,'#ff6b35',0.8);
    }
    if(bullet&&bullet.elementEffects?.ice&&this.applyIceEffect)this.applyIceEffect(bullet.elementEffects.ice);
    if(bullet&&bullet.specialEffects?.fireball){const eff=bullet.specialEffects.fireball; fireEffects.push({x:this.x,y:this.y,radius:eff.radius,damage:eff.burnDmg,life:eff.burnDur,maxLife:eff.burnDur,burnDmg:eff.burnDmg,tick:0,chain:eff.chain||0});}
    // 天赋：子弹反弹（撞墙反弹）已在Bullet.update中通过bounce属性实现,此处无需额外处理
    // 高级天赋：战斗狂/愤怒 - 击中Boss也叠加层数
    if(player){
      if(player.combatFuryMax>0){
        player.combatFuryStacks=Math.min(player.combatFuryMax,player.combatFuryStacks+1);
        player.combatFuryTimer=1.5;
      }
      if(player.rageFuryMax>0){
        player.rageFuryStacks=Math.min(player.rageFuryMax,player.rageFuryStacks+1);
        player.rageFuryTimer=1.5;
      }
    }
    updateBossUI(); if(this.health<=0)this.die();
  }
  die(){
    // 防止die()被重复调用（同一帧多颗子弹命中Boss时，takeDamage可能多次触发die）
    // 根因：die()被多次调用会导致onBossDefeated多次执行，bossTrialIndex多次递增，
    //       bossTrialMode被提前重置为false后走非试炼分支调用proceedToNextLevel()跳关
    if(!this.alive)return;
    this.alive=false; const bonus=this.isSuper?600:200; score+=bonus*this.level;
    // 死亡复盘：Boss击杀统计
    if(typeof runStats!=='undefined'){
      runStats.bossKills++;
      runStats.kills++;
      runStats.maxCombo=Math.max(runStats.maxCombo,comboCount);
    }
    // 强化死亡爆炸：大量粒子+屏幕震动+冲击波
    spawnParticles(this.x,this.y,this.color,150);
    spawnParticles(this.x,this.y,'#ffd700',50);
    spawnParticles(this.x,this.y,'#ffffff',30);
    screenShake=this.isSuper?1.2:0.9; // Boss击杀屏幕剧烈震动
    // 慢动作：Boss击杀时短暂减速0.6秒，强化击杀爽感
    if(typeof triggerSlowMotion==='function'){
      triggerSlowMotion(this.isSuper?0.8:0.6, 0.25);
    }
    pushFloatingText(this.x,this.y-60,this.isSuper?'👑 超级Boss陨落!':'💥 Boss陨落!','#ffd700',2,32);
    // 山海残页掉落：每个Boss首次击败掉落对应残页（碎片化叙事）
    if(typeof SHANHAI_PAGES!=='undefined' && SHANHAI_PAGES[this.bossIndex] && saveData){
      if(!saveData.shanhaiPages)saveData.shanhaiPages=[];
      if(!saveData.shanhaiPages.includes(this.bossIndex)){
        saveData.shanhaiPages.push(this.bossIndex);
        // 收集齐10页：解锁山海图卷奖励（一次性5000积分）
        if(saveData.shanhaiPages.length>=10 && !saveData.shanhaiPagesRewardClaimed){
          saveData.shanhaiPagesRewardClaimed=true;
          saveData.totalScore=(saveData.totalScore||0)+5000;
          score+=5000;
          gameTimeout(()=>{
            if(gameState==='gameover'||gameState==='menu')return; // 跨局丢弃，避免在新局弹提示
            showToast(`🗺️ 山海图卷已开启！获得 5000 积分奖励`,'#ffd700',4500);
          }, 3000);
        }
        saveSave();
        // 延迟提示，避免被击杀特效淹没
        const _pageIdx=this.bossIndex;
        gameTimeout(()=>{
          if(gameState==='gameover'||gameState==='menu')return; // 跨局丢弃
          showToast(`📜 获得山海残页：${SHANHAI_PAGES[_pageIdx].title}`,'#ffd970',3500);
        }, 1500);
      }
    }
    // 死亡冲击波
    fireEffects.push({x:this.x,y:this.y,radius:this.size*4,damage:0,life:1.2,maxLife:1.2,burnDmg:0,tick:0,chain:0,hammerBlast:true});
    this._beamActive=false; this._beamData=null; this._wellActive=false; this._wellData=null; this._floodActive=false; this._floodData=null;
    this.safeZoneActive=false; this.safeZoneData=null; // 重置安全区攻击
    this.halberdSweepActive=false; this.halberdSweepData=null;
    this.earthCrackActive=false; this.earthCrackData=null;
    this.wrathClonesActive=false; this.wrathClones=[];
    pushFloatingText(this.x,this.y,`+${bonus*this.level} ${this.isSuper?'超级BOSS!':'BOSS!'}`,'#ffd700',2);
    drops.push(new Drop(this.x-30,this.y,'health')); drops.push(new Drop(this.x+30,this.y,'shield')); drops.push(new Drop(this.x,this.y+30,'coin')); drops.push(new Drop(this.x,this.y-30,'coin'));
    if(this.isSuper){drops.push(new Drop(this.x,this.y,'coin'));drops.push(new Drop(this.x-40,this.y-40,'coin'));drops.push(new Drop(this.x+40,this.y-40,'coin'));}
    enemyBullets=[];
    this.clones=[];
    // 变异Boss掉落更好：Boss宝宝概率+30%，装备掉落率+20%
    let petChance=0.15;
    let gearChance=0.7;
    if(this.isVariant){petChance+=0.30; gearChance+=0.20;}
    if(Math.random()<petChance){
      const petDef=getPetDef(this.bossIndex);
      if(petDef){pendingBossCapture=petDef; showBossCapture(petDef);}
    }
    if(Math.random()<gearChance && !this.isFinalBoss){
      // 刑天最终Boss跳过常规装备掉落（使用下方的 dropMissingBossMythic 必掉一件未拥有的Boss神话）
      const gear=dropGear(this.bossIndex,this.isSuper);
      // 变异Boss掉落高品质装备（提升一阶）
      if(this.isVariant&&gear.rarity!=='mythic'){
        const order=['common','rare','epic','legendary','mythic'];
        const idx=order.indexOf(gear.rarity);
        if(idx>=0&&idx<order.length-1){
          gear.rarity=order[idx+1];
          // 重新生成专属词条：神话品质用Boss专属词条，传说用普通传说词条
          if(gear.rarity==='mythic'){
            // 神话品质：使用Boss专属词条+专属装备名
            const bossDef=BOSS_GEAR_TABLE[this.bossIndex];
            if(bossDef){
              gear.name=bossDef.mythicName;
              gear.specialAffix={
                id:bossDef.affix.id, name:bossDef.affix.name, icon:bossDef.affix.icon,
                desc:bossDef.affix.desc, special:true, bossAffix:true, bossIdx:this.bossIndex
              };
            }
          }else if(gear.rarity==='legendary'){
            const pool=GEAR_LEGENDARY_AFFIXES;
            gear.specialAffix=pool[Math.floor(Math.random()*pool.length)];
          }
        }
      }
      saveData.gearBag.push(gear); saveSave();
      pushFloatingText(this.x,this.y+30,`获得装备: ${gear.name}!`,GEAR_RARITIES[gear.rarity].color,2);
    }
    // 超级Boss掉落魂器（20%概率，变异Boss40%；5次未掉则第6次必掉）
    if(this.isSuper){
      const artifactDef=getArtifactDef(this.bossIndex);
      if(artifactDef&&!saveData.ownedArtifacts.includes(this.bossIndex)){
        let artifactChance=0.20;
        if(this.isVariant)artifactChance=0.40;
        // 保底机制：连续5次未掉魂器，第6次必掉
        saveData.artifactPityCounter=(saveData.artifactPityCounter||0)+1;
        const pityDrop = saveData.artifactPityCounter>=6;
        if(pityDrop || Math.random()<artifactChance){
          saveData.ownedArtifacts.push(this.bossIndex);
          saveData.artifactPityCounter=0; // 重置保底计数
          // 不自动装备：玩家需在局外魂器菜单手动装备
          saveSave();
          // 醒目提示：浮字 + 屏幕公告 + 专属音效 + 大量粒子
          pushFloatingText(this.x,this.y+60,`✨ 获得魂器: ${artifactDef.name}!`,artifactDef.color,3);
          pushFloatingText(this.x,this.y-80,`(局外可装备)`,artifactDef.color,2);
          spawnParticles(this.x,this.y,artifactDef.color,80);
          spawnParticles(this.x,this.y,'#ffd700',40);
          screenShake=Math.max(screenShake,0.4);
          if(typeof playSound==='function')playSound('levelUp');
          // 屏幕中央公告
          showWaveAnnounce(pityDrop?'✨ 保底魂器！':'✨ 获得魂器！',`${artifactDef.icon} ${artifactDef.name} - 局外可装备`,true);
        }
      }else if(artifactDef&&saveData.ownedArtifacts.includes(this.bossIndex)){
        // 已拥有该魂器：不计数（避免已收集齐全后保底永远不重置）
        saveData.artifactPityCounter=0;
      }
    }
    // 更新Boss图鉴与成就追踪
    if(!saveData.bossPedia[this.bossIndex])saveData.bossPedia[this.bossIndex]={killed:true,killCount:0};
    saveData.bossPedia[this.bossIndex].killCount++;
    saveData.achievementFlags.totalBossKills++;
    if(this.isSuper)saveData.achievementFlags.superKills=(saveData.achievementFlags.superKills||0)+1;
    // 难度成就
    const diff=saveData.difficulty;
    if(diff==='hard')saveData.achievementFlags.hardCleared=true;
    if(diff==='hell')saveData.achievementFlags.hellCleared=true;
    if(diff==='godslayer')saveData.achievementFlags.godCleared=true;
    // 检查成就
    const newlyUnlocked=checkAchievements();
    if(newlyUnlocked.length>0){showAchievementNotifications(newlyUnlocked);saveSave();}
    bossHealthBar.classList.add('hidden'); boss=null; bossWarnings=[];
    // ===== 刑天最终Boss：掉落山海故事书 + 专属武器，显示胜利结算 =====
    if(this.isFinalBoss){
      // 掉落山海故事书
      saveData.hasShanHaiBook=true;
      // 掉落专属武器：刑天干戚
      let gotNewWeapon=false;
      if(!saveData.ownedWeapons.xingtiangeqi){
        saveData.ownedWeapons.xingtiangeqi=1; // 阶段1
        gotNewWeapon=true;
      }
      // 刑天击败必掉一件Boss神话装备（优先未拥有的Boss）
      const xingtianGear=dropMissingBossMythic();
      const wasNew=!getOwnedBossMythics().has(xingtianGear.bossIdx);
      saveData.gearBag.push(xingtianGear);
      // 屏幕公告
      spawnParticles(this.x,this.y,GEAR_RARITIES.mythic.color,80);
      if(wasNew){
        pushFloatingText(this.x,this.y-60,`✨ 神话装备: ${xingtianGear.name}!`,GEAR_RARITIES.mythic.color,3);
        showWaveAnnounce('✨ 神话装备掉落！',`${xingtianGear.name} - ${BOSS_GEAR_TABLE[xingtianGear.bossIdx]?BOSS_GEAR_TABLE[xingtianGear.bossIdx].affix.name:''}`,true);
      }else{
        pushFloatingText(this.x,this.y-60,`神话装备: ${xingtianGear.name}`,GEAR_RARITIES.mythic.color,2);
      }
      saveSave();
      spawnParticles(CONFIG.WIDTH/2,CONFIG.HEIGHT/2,'#ffd700',150);
      screenShake=0.8;
      // 显示胜利结算画面（不调用onBossDefeated，刑天有专属结算流程）
      // 改用 gameTimeout 让暂停期间不触发结算，避免覆盖暂停界面
      gameTimeout(()=>{
        // 守卫：若期间退出主菜单/暂停/已进入下一局，不触发结算（避免覆盖 UI）
        if(gameState!=='boss' && gameState!=='wavePrepare' && gameState!=='upgrade')return;
        if(resumeTrialAfterFinalBoss){
          // 从试炼触发的刑天：继续试炼流程
          // 注意：不在此时清除 resumeTrialAfterFinalBoss，由 onBossDefeated 的刑天分支处理
          onBossDefeated({isFinalBoss:true,isSuper:true,x:this.x,y:this.y});
        }else{
          // 正常关卡触发的刑天：显示胜利结算
          showFinalBossVictory(gotNewWeapon);
        }
      },1500);
      return; // 刑天不走普通流程
    }
    // ===== 超级Boss被击败后50%几率触发刑天 =====
    // 若触发刑天，则不立即调用onBossDefeated；等玩家选择（挑战/放弃）后再调用
    // 试炼模式中刑天最多出现一次（trialXingtianTriggered 标记）
    let triggeredFinalBoss=false;
    if(this.isSuper&&!this.isFinalBoss&&!endlessMode&&!pendingFinalBoss){
      const canTriggerXingtian = bossTrialMode ? !trialXingtianTriggered : true;
      if(canTriggerXingtian && Math.random()<0.5){
        pendingFinalBoss=true;
        triggeredFinalBoss=true;
        // 记录试炼状态，刑天结束后继续试炼流程
        if(bossTrialMode){resumeTrialAfterFinalBoss=true; trialXingtianTriggered=true;}
        showFinalBossPrompt();
      }
    }
    // 调用Boss击败处理（处理复仇/试炼/弑神双Boss）
    if(!triggeredFinalBoss){
      onBossDefeated(this);
    }
  }
  draw(){
    ctx.save();ctx.translate(this.x,this.y);
    // 出场动画：从大缩小+透明度渐变+光环
    if(this.spawnAnim>0){
      const sa=this.spawnAnim;
      const spawnScale=1+sa*1.5; // 从2.5倍缩小到1
      const spawnAlpha=1-sa; // 透明度0→1
      ctx.globalAlpha=spawnAlpha;
      ctx.scale(spawnScale,spawnScale);
      // 出场光环
      ctx.shadowColor=this.color; ctx.shadowBlur=60*sa;
      ctx.strokeStyle=`rgba(255,255,255,${sa*0.8})`;
      ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(0,0,this.size*(1+sa*2),0,Math.PI*2); ctx.stroke();
      // 出场粒子
      if(Math.random()<0.5){
        const a=Math.random()*Math.PI*2;
        spawnParticles(this.x+Math.cos(a)*this.size*(1+sa*2),this.y+Math.sin(a)*this.size*(1+sa*2),this.color,2);
      }
    }
    // 呼吸动画
    const breath=1+Math.sin(this.breathPhase)*0.04;
    const floatY=Math.sin(this.breathPhase*0.7)*this.size*0.03;
    ctx.translate(0,floatY);
    ctx.scale(breath,breath);
    // 狂暴/超级光效（只用shadow发光，不画圈）
    if(this.rage||this.isSuper){ctx.shadowColor=this.rage?'#ff3030':this.color;ctx.shadowBlur=this.isSuper?45:32;}
    // 变异Boss：紫色粒子环绕（不画圈）
    if(this.isVariant){
      ctx.shadowColor='#ff00ff'; ctx.shadowBlur=40;
      for(let i=0;i<6;i++){
        const a=this.breathPhase*2+i*Math.PI/3;
        const r=this.size*0.9+Math.sin(this.breathPhase*3+i)*8;
        ctx.fillStyle=`rgba(255,0,255,${0.6+Math.sin(this.breathPhase*3+i)*0.3})`;
        ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,4,0,Math.PI*2);ctx.fill();
      }
    }
    // 九尾狐无敌状态：粉色色调叠加+粒子（不画圈）
    if(this.invulnerable){
      ctx.shadowColor='#ff69b4'; ctx.shadowBlur=35;
      ctx.globalAlpha=0.3;
      ctx.fillStyle='#ff69b4';
      ctx.beginPath();ctx.arc(0,0,this.size*1.1,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
      for(let i=0;i<6;i++){
        const a=this.breathPhase*4+i*Math.PI/3;
        const r=this.size*0.95;
        ctx.fillStyle=`rgba(255,105,180,${0.7+Math.sin(this.breathPhase*5+i)*0.3})`;
        ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,3,0,Math.PI*2);ctx.fill();
      }
    }
    // 朱厌石头护盾：石头碎片环绕（不画圈）
    if(this.stoneShield&&this.stoneShieldHp>0){
      ctx.shadowColor='#8b6c5c'; ctx.shadowBlur=15;
      const shieldPct=this.stoneShieldHp/(this.maxHealth*0.25);
      for(let i=0;i<8;i++){
        const a=(i/8)*Math.PI*2+this.breathPhase*0.3;
        const r=this.size*0.9;
        ctx.fillStyle=`rgba(139,108,92,${0.5+shieldPct*0.4})`;
        ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,4+shieldPct*2,0,Math.PI*2);ctx.fill();
      }
    }
    // 受击抖动
    if(this.hitFlash>0){ctx.translate(rand(-2,2),rand(-2,2));}
    const s=this.size;
    // 攻击动画：不同攻击类型不同姿态（更生动的攻击动作）
    const t=_NOW/200;
    let atkScaleX=1,atkScaleY=1,atkRot=0,atkShake=0,atkLungeX=0,atkLungeY=0;
    if(this.attackAnim>0){
      const ap=this.attackAnim/(this.attackAnimMax||0.8); // 0~1 (1=刚开始攻击, 0=结束)
      const atk=this.attackType;
      // 计算朝向玩家的方向（用于lunge和sweep方向）
      let toPlayerAngle=0;
      if(player&&player.alive){toPlayerAngle=Math.atan2(player.y-this.y,player.x-this.x);}
      // 横扫挥击类：强力倾斜+横向拉伸+方向性lunge（像挥舞武器）
      if(atk==='lavaFist'||atk==='halberdSweep'||atk==='groundShock'||atk==='earthCrack'||atk==='rockBarrage'||atk==='dimensionStorm'||atk==='tornadoSpin'){
        atkRot=Math.sin(t*4)*0.18*ap; // 更大幅度摇摆
        atkScaleX=1+ap*0.25; atkScaleY=1-ap*0.08; // 横向拉伸
        atkLungeX=Math.cos(toPlayerAngle)*ap*12; // 向玩家方向lunge
        atkLungeY=Math.sin(toPlayerAngle)*ap*12;
      }
      // 撕咬/突进类：向玩家猛扑+垂直拉伸（像扑食猎物）
      else if(atk==='diveBomb'||atk==='airDash'||atk==='wrathClones'||atk==='phantomClone'){
        const lungeAmt=ap*25;
        atkLungeX=Math.cos(toPlayerAngle)*lungeAmt;
        atkLungeY=Math.sin(toPlayerAngle)*lungeAmt;
        atkScaleX=1-ap*0.1; atkScaleY=1+ap*0.2; // 垂直拉伸（扑击姿态）
        atkShake=ap*2;
      }
      // 蓄力/光束类：明显放大+发光（像蓄能爆发）
      else if(atk==='lightBeam'||atk==='bulletAbsorb'||atk==='safeZone'||atk==='charmBeam'||atk==='gravityWell'||atk==='voidRift'||atk==='poisonSwamp'){
        atkScaleX=1+ap*0.3; atkScaleY=1+ap*0.3; // 大幅放大
        atkRot=Math.sin(t*2)*0.03*ap; // 轻微摇摆
      }
      // 喷射类：后坐力后仰+轻微倾斜（像吐息/喷洒）
      else if(atk==='charmBullet'||atk==='fireFeather'||atk==='poisonNine'||atk==='rockThrow'||atk==='lavaPool'||atk==='devourAtk'||atk==='windBlade'||atk==='waterJet'||atk==='chaosBolt'||atk==='fireRain'||atk==='poisonSpray'||atk==='rainStorm'){
        atkScaleX=1+ap*0.12; atkScaleY=1-ap*0.06; // 略微后仰
        atkLungeX=-Math.cos(toPlayerAngle)*ap*8; // 后坐力后退
        atkLungeY=-Math.sin(toPlayerAngle)*ap*8;
        atkRot=Math.sin(t*5)*0.04*ap;
      }
      // 默认：轻微摇摆+放大
      else{
        atkScaleX=1+ap*0.15; atkScaleY=1+ap*0.15;
        atkRot=Math.sin(t*4)*0.05*ap;
      }
    }
    // 移动动画：移动时上下浮动+左右摇摆（像在走动）
    const moveBobY=Math.sin(this.movePhase)*this.size*0.04;
    const moveSwayX=Math.sin(this.movePhase*0.7)*this.size*0.02;
    ctx.translate(moveSwayX+atkLungeX,moveBobY+atkLungeY);
    ctx.scale(atkScaleX,atkScaleY);
    ctx.rotate(atkRot);
    if(atkShake>0)ctx.translate(rand(-atkShake,atkShake),rand(-atkShake,atkShake));
    // 绘制Boss图片
    const img=BOSS_IMAGES[this.bossIndex];
    // 刑天(最终Boss)：使用图片+程序化增强
    if(this.isFinalBoss){
      this.drawXingtian(s);
    }else if(img&&img.complete&&img.naturalWidth>0){
      // PNG透明背景图片直接绘制，2.2倍碰撞圈，确保Boss完整身体可见
      const imgS=s*2.2;
      // 动画帧切换：根据攻击类型选主帧(_a)或副帧(_a2)，移动时用_m帧，否则idle帧
      let drawImg=img;
      if(this.attackAnim>0){
        const frameType=ATTACK_FRAME_MAP[this.attackType]||'a';
        const aImg=frameType==='a2'?BOSS_IMAGES_ATTACK2[this.bossIndex]:BOSS_IMAGES_ATTACK[this.bossIndex];
        if(aImg&&aImg.complete&&aImg.naturalWidth>0)drawImg=aImg;
      }else if(this.moving){
        const mImg=BOSS_IMAGES_MOVE[this.bossIndex];
        if(mImg&&mImg.complete&&mImg.naturalWidth>0)drawImg=mImg;
      }
      ctx.drawImage(drawImg,-imgS,-imgS,imgS*2,imgS*2);
      // 受击白色闪光叠加
      if(this.hitFlash>0){
        ctx.save();
        ctx.globalAlpha=this.hitFlash*0.8;
        ctx.shadowColor='#ffffff';ctx.shadowBlur=20;
        ctx.drawImage(drawImg,-imgS,-imgS,imgS*2,imgS*2);
        ctx.restore();
      }
      // 攻击蓄力：粒子汇聚效果（不画圈）
      if(this.attackAnim>0){
        const ap=this.attackAnim/(this.attackAnimMax||0.8);
        const ec=this.color;
        const ecr=parseInt(ec.substr(1,2),16),ecg=parseInt(ec.substr(3,2),16),ecb=parseInt(ec.substr(5,2),16);
        ctx.shadowColor=this.color;ctx.shadowBlur=25*ap;
        // 蓄力粒子向中心汇聚（不画圆圈线）
        for(let i=0;i<8;i++){
          const a=t*2+i*Math.PI/4;
          const r=s*1.2+ap*15-Math.sin(t*3+i)*5;
          ctx.fillStyle=`rgba(${ecr},${ecg},${ecb},${0.7+ap*0.3})`;
          ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,3+ap*2,0,Math.PI*2);ctx.fill();
        }
        ctx.shadowBlur=0;
      }
      // 减速：冰晶粒子+蓝色色调（不画圈）
      if(this.slowFactor<1){
        ctx.save();
        ctx.globalAlpha=0.15;
        ctx.fillStyle='#a8d8ff';
        ctx.beginPath();ctx.arc(0,0,s*1.0,0,Math.PI*2);ctx.fill();
        ctx.restore();
        for(let i=0;i<5;i++){
          const a=(i/5)*Math.PI*2+_NOW/500;
          const r=s*0.9+Math.sin(_NOW/300+i)*5;
          ctx.fillStyle='rgba(220,240,255,0.9)';
          ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,2.5,0,Math.PI*2);ctx.fill();
        }
      }
    }else{
      // 图片未加载时的fallback：彩色圆形+名称首字
      ctx.fillStyle=this.hitFlash>0?'#ffffff':this.color;
      ctx.beginPath();ctx.arc(0,0,s,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle='#fff';ctx.font=`bold ${s*0.8}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(this.name[0]||'?',0,0);
    }
    // 移除纯装饰外圈，只保留功能性光环（无敌/护盾/蓄力）
    ctx.shadowBlur=0;
    ctx.restore();
    // 绘制分身（九尾狐）
    if(this.clones&&this.clones.length>0){
      for(const c of this.clones){
        ctx.save();ctx.translate(c.x,c.y);ctx.globalAlpha=0.6;ctx.scale(0.6,0.6);
        ctx.shadowColor=c.color;ctx.shadowBlur=10;
        const cImg=BOSS_IMAGES[this.bossIndex];
        if(cImg&&cImg.complete&&cImg.naturalWidth>0){
          const cS=c.size*2.2;
          ctx.drawImage(cImg,-cS,-cS,cS*2,cS*2);
        }else{
          ctx.fillStyle=c.color;
          ctx.beginPath();ctx.arc(0,0,c.size,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();ctx.globalAlpha=1;
      }
    }
    // 血量
    ctx.fillStyle=this.isSuper?'#bc8cff':'#ff6b6b';ctx.font='bold 14px Arial';ctx.textAlign='center';
    ctx.shadowColor=this.isSuper?'#bc8cff':'#ff6b6b';ctx.shadowBlur=8;
    ctx.fillText(`${this.name} ${Math.ceil(this.health)}/${this.maxHealth}`,this.x,this.y+this.size+24);
    ctx.shadowBlur=0;
  }
  // 刑天专属绘制：使用PNG图片+视觉增强（与其他boss统一风格）
  drawXingtian(s){
    const t=_NOW/300;
    // ===== 外层暗红能量粒子（不画圈）=====
    const auraPulse=0.5+Math.sin(t*2)*0.5;
    ctx.shadowColor='#8b0000';ctx.shadowBlur=15+auraPulse*10;
    for(let i=0;i<10;i++){
      const a=t*1.5+i*Math.PI/5;
      const r=s*1.2+Math.sin(t*2+i)*10;
      ctx.fillStyle=`rgba(139,0,0,${0.4+auraPulse*0.3})`;
      ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,3+auraPulse*2,0,Math.PI*2);ctx.fill();
    }
    ctx.shadowBlur=0;
    // ===== 主体：程序化绘制刑天 =====
    this.drawXingtianBody(s,t);
    // 攻击蓄力：粒子汇聚（不画圈）
    if(this.attackAnim>0){
      const ap=this.attackAnim/(this.attackAnimMax||0.8);
      ctx.shadowColor='#ff4500';ctx.shadowBlur=20*ap;
      for(let i=0;i<10;i++){
        const a=t*3+i*Math.PI/5;
        const r=s*1.3+ap*15-Math.sin(t*3+i)*8;
        ctx.fillStyle=`rgba(255,${60+Math.sin(t*2+i)*40},0,${0.7+ap*0.3})`;
        ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,4+ap*2,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;
    }
    // ===== 狂暴红色粒子（phase≥1，不画圈）=====
    if(this.rage){
      const ragePulse=0.5+Math.sin(t*5)*0.5;
      ctx.shadowColor='#ff0000';ctx.shadowBlur=20*ragePulse;
      for(let i=0;i<12;i++){
        const a=t*3+i*Math.PI/6;
        const r=s*1.3+Math.sin(t*4+i)*8;
        ctx.fillStyle=`rgba(255,${30+Math.sin(t*2+i)*30},0,${0.7+ragePulse*0.3})`;
        ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,4,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;
    }
    // ===== 终极形态：紫金战魂粒子（phase≥2，不画圈）=====
    if(this.finalBossPhase>=2){
      const ultPulse=0.5+Math.sin(t*7)*0.5;
      ctx.shadowColor='#bc8cff';ctx.shadowBlur=25*ultPulse;
      for(let i=0;i<8;i++){
        const a=t*2.5+i*Math.PI/4;
        const r=s*1.35+Math.sin(t*4+i)*6;
        ctx.shadowColor='#ffd700';ctx.shadowBlur=10;
        ctx.fillStyle=`rgba(255,215,0,${0.7+ultPulse*0.3})`;
        ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,4,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;
    }
    // ===== 减速：冰晶粒子（不画圈）=====
    if(this.slowFactor<1){
      for(let i=0;i<6;i++){
        const a=(i/6)*Math.PI*2+_NOW/500;
        const r=s*1.0+Math.sin(_NOW/300+i)*6;
        ctx.fillStyle='rgba(220,240,255,0.9)';
        ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,3,0,Math.PI*2);ctx.fill();
      }
    }
    // ===== 3个环绕战魂球（围绕刑天本体旋转，有接触伤害） =====
    // 注意：这里在ctx.translate(boss.x,boss.y)之后的局部坐标系中绘制
    for(const orb of this.orbitingOrbs){
      const ox=Math.cos(orb.angle)*orb.radius;
      const oy=Math.sin(orb.angle)*orb.radius*0.7; // 椭圆轨道
      ctx.save();
      ctx.translate(ox,oy);
      const orbPulse=0.7+Math.sin(t*4+orb.angle)*0.3;
      // 外层光晕
      ctx.shadowColor='#ff4500';ctx.shadowBlur=20*orbPulse;
      ctx.fillStyle=`rgba(255,69,0,${0.3+orbPulse*0.2})`;
      ctx.beginPath();ctx.arc(0,0,orb.size*1.5,0,Math.PI*2);ctx.fill();
      // 主体球（渐变）
      const orbGrad=ctx.createRadialGradient(0,0,0,0,0,orb.size);
      orbGrad.addColorStop(0,'#ffaa00');
      orbGrad.addColorStop(0.5,'#ff4500');
      orbGrad.addColorStop(1,'#8b0000');
      ctx.fillStyle=orbGrad;
      ctx.beginPath();ctx.arc(0,0,orb.size,0,Math.PI*2);ctx.fill();
      // 核心（白色发光）
      ctx.shadowColor='#ffffff';ctx.shadowBlur=10;
      ctx.fillStyle=`rgba(255,255,255,${orbPulse})`;
      ctx.beginPath();ctx.arc(0,0,orb.size*0.3,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      // 拖尾粒子
      for(let i=1;i<=3;i++){
        const ta=orb.angle-i*0.15;
        const tx=Math.cos(ta)*orb.radius;
        const ty=Math.sin(ta)*orb.radius*0.7;
        ctx.fillStyle=`rgba(255,69,0,${0.4-i*0.1})`;
        ctx.beginPath();ctx.arc(tx-ox,ty-oy,orb.size*0.3*(1-i*0.2),0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
  }
  // 刑天主体绘制：使用PNG图片（常态/攻击形态切换），图片未加载时回退到程序化绘制
  drawXingtianBody(s,t){
    const breath=1+Math.sin(t*1.5)*0.04;
    // 判断是否处于特殊攻击状态：干戚横扫/天崩地裂预警期间+战魂分身释放瞬间，显示攻击形态
    const inAttack = this.halberdSweepActive || this.earthCrackActive ||
                     (this.attackAnim>0 && this.attackType==='wrathClones');
    const xtImg = (inAttack && XINGTIAN_IMG_ATTACK && XINGTIAN_IMG_ATTACK.complete && XINGTIAN_IMG_ATTACK.naturalWidth>0)
                  ? XINGTIAN_IMG_ATTACK : XINGTIAN_IMG_IDLE;
    if(xtImg && xtImg.complete && xtImg.naturalWidth>0){
      // 图片绘制：2.2倍碰撞圈，确保刑天完整身体可见，与其他boss统一风格
      ctx.save();
      ctx.scale(breath,breath);
      const imgS=s*2.2;
      ctx.drawImage(xtImg,-imgS,-imgS,imgS*2,imgS*2);
      // 受击白色闪光叠加
      if(this.hitFlash>0){
        ctx.globalAlpha=this.hitFlash*0.8;
        ctx.shadowColor='#ffffff';ctx.shadowBlur=20;
        ctx.drawImage(xtImg,-imgS,-imgS,imgS*2,imgS*2);
        ctx.globalAlpha=1;
      }
      ctx.restore();
      return;
    }
    // ===== fallback：图片未加载时使用原程序化绘制（无头战神形象）=====
    const armSway=Math.sin(t*1.2)*0.12;
    const rageMode=this.finalBossPhase>=1;
    // ===== 0. 暗黑能量背景场（熔岩光环）=====
    ctx.save();
    ctx.scale(breath,breath);
    const auraR=s*1.3;
    const auraGrad=ctx.createRadialGradient(0,0,s*0.5,0,0,auraR);
    auraGrad.addColorStop(0,'rgba(255,50,0,0.3)');
    auraGrad.addColorStop(0.5,'rgba(139,0,0,0.2)');
    auraGrad.addColorStop(1,'rgba(20,0,0,0)');
    ctx.fillStyle=auraGrad;
    ctx.beginPath();ctx.arc(0,0,auraR,0,Math.PI*2);ctx.fill();
    ctx.restore();

    // ===== 1. 巨型躯干（宽阔的倒三角胸甲，深红到暗黑渐变）=====
    ctx.save();
    ctx.scale(breath,breath);
    const bodyGrad=ctx.createLinearGradient(0,-s*0.9,0,s*0.9);
    bodyGrad.addColorStop(0,'#2a0808');
    bodyGrad.addColorStop(0.2,'#5c1010');
    bodyGrad.addColorStop(0.5,'#8b0000');
    bodyGrad.addColorStop(0.8,'#4a0808');
    bodyGrad.addColorStop(1,'#1a0303');
    ctx.fillStyle=bodyGrad;
    // 宽肩巨躯（比原来更宽更大）
    ctx.beginPath();
    ctx.moveTo(-s*0.75,-s*0.75);                    // 左肩（更宽）
    ctx.quadraticCurveTo(-s*0.9,-s*0.3,-s*0.6,s*0.5); // 左腰
    ctx.quadraticCurveTo(-s*0.3,s*0.85,0,s*0.88);     // 底部
    ctx.quadraticCurveTo(s*0.3,s*0.85,s*0.6,s*0.5);   // 右腰
    ctx.quadraticCurveTo(s*0.9,-s*0.3,s*0.75,-s*0.75);// 右肩
    ctx.quadraticCurveTo(0,-s*0.95,-s*0.75,-s*0.75);  // 颈部（无头）
    ctx.closePath();
    ctx.fill();
    // 躯干厚重轮廓
    ctx.strokeStyle='#0a0202';ctx.lineWidth=3;ctx.stroke();
    // ===== 熔岩裂纹（胸口流淌的岩浆纹路，威慑力）=====
    ctx.strokeStyle=`rgba(255,${80+Math.sin(t*3)*30},0,0.7)`;
    ctx.lineWidth=2;ctx.shadowColor='#ff4500';ctx.shadowBlur=8;
    // 主裂纹（从肩到腰）
    for(let i=-1;i<=1;i+=2){
      ctx.beginPath();
      ctx.moveTo(i*s*0.3,-s*0.6);
      ctx.quadraticCurveTo(i*s*0.5,-s*0.2,i*s*0.35,s*0.3);
      ctx.quadraticCurveTo(i*s*0.25,s*0.5,i*s*0.2,s*0.7);
      ctx.stroke();
    }
    // 横向裂纹
    for(let i=0;i<4;i++){
      const y=-s*0.4+i*s*0.25;
      const w=s*0.4-i*s*0.05;
      ctx.beginPath();
      ctx.moveTo(-w,y);ctx.quadraticCurveTo(0,y+3,w,y);
      ctx.stroke();
    }
    ctx.shadowBlur=0;
    // 肌肉分隔线
    ctx.strokeStyle='rgba(255,80,30,0.5)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,-s*0.6);ctx.lineTo(0,s*0.2);ctx.stroke();
    // 胸肌下缘
    ctx.beginPath();ctx.moveTo(-s*0.55,-s*0.25);ctx.quadraticCurveTo(0,-s*0.05,s*0.55,-s*0.25);ctx.stroke();
    ctx.restore();

    // ===== 2. 血红巨眼（以乳为目，凶狠发光，rage时变红）=====
    const eyePulse=0.7+Math.sin(t*4)*0.3;
    const eyeColor=rageMode?'#ff0000':'#ffaa00';
    const eyeGlow=rageMode?'#ff3030':'#ff8800';
    ctx.save();
    for(const side of[-1,1]){
      const ex=side*s*0.35;
      const ey=-s*0.3;
      // 眼眶（深色凹陷）
      ctx.fillStyle='#0a0202';
      ctx.beginPath();ctx.arc(ex,ey,s*0.16,0,Math.PI*2);ctx.fill();
      // 眼球（发光，愤怒血红/金色）
      ctx.shadowColor=eyeGlow;ctx.shadowBlur=20*eyePulse;
      const eyeGrad=ctx.createRadialGradient(ex,ey,0,ex,ey,s*0.13);
      eyeGrad.addColorStop(0,'#ffffff');
      eyeGrad.addColorStop(0.3,eyeColor);
      eyeGrad.addColorStop(1,rageMode?'#8b0000':'#cc6600');
      ctx.fillStyle=eyeGrad;
      ctx.beginPath();ctx.arc(ex,ey,s*0.13,0,Math.PI*2);ctx.fill();
      // 瞳孔（竖瞳，凶猛）
      ctx.shadowBlur=0;
      ctx.fillStyle='#000';
      ctx.beginPath();ctx.ellipse(ex,ey,s*0.04,s*0.1,0,0,Math.PI*2);ctx.fill();
      // 高光
      ctx.fillStyle=`rgba(255,255,255,${eyePulse*0.8})`;
      ctx.beginPath();ctx.arc(ex-side*s*0.03,ey-s*0.03,s*0.025,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();

    // ===== 3. 巨口（以脐为口，大嘴+利獠牙，凶残）=====
    ctx.save();
    // 嘴巴（更大，张开时更凶）
    const mouthOpen=0.7+Math.sin(t*2)*0.3;
    ctx.fillStyle='#0a0202';
    ctx.beginPath();ctx.ellipse(0,s*0.4,s*0.3,s*0.15*mouthOpen,0,0,Math.PI*2);ctx.fill();
    // 嘴唇（暗红）
    ctx.strokeStyle='#5c1010';ctx.lineWidth=3;
    ctx.beginPath();ctx.ellipse(0,s*0.4,s*0.3,s*0.15*mouthOpen,0,0,Math.PI*2);ctx.stroke();
    // 獠牙（上下各4颗，更大更尖）
    ctx.fillStyle='#f5f0e0';
    ctx.shadowColor='#fff';ctx.shadowBlur=3;
    for(let i=0;i<4;i++){
      const x=-s*0.18+i*s*0.12;
      // 上獠牙
      ctx.beginPath();
      ctx.moveTo(x-s*0.028,s*0.32);ctx.lineTo(x+s*0.028,s*0.32);
      ctx.lineTo(x,s*0.32+s*0.12*mouthOpen);
      ctx.closePath();ctx.fill();
      // 下獠牙
      ctx.beginPath();
      ctx.moveTo(x-s*0.028,s*0.48);ctx.lineTo(x+s*0.028,s*0.48);
      ctx.lineTo(x,s*0.48-s*0.1*mouthOpen);
      ctx.closePath();ctx.fill();
    }
    ctx.shadowBlur=0;
    ctx.restore();

    // ===== 4. 巨臂（粗壮肌肉臂膀，向两侧大幅伸展）=====
    ctx.save();
    ctx.scale(breath,breath);
    // 左臂
    ctx.save();
    ctx.translate(-s*0.75,-s*0.45);
    ctx.rotate(-0.4+armSway);
    const armGrad=ctx.createLinearGradient(0,0,-s*0.6,s*0.6);
    armGrad.addColorStop(0,'#5c1010');
    armGrad.addColorStop(0.5,'#8b0000');
    armGrad.addColorStop(1,'#3a0808');
    ctx.fillStyle=armGrad;
    ctx.strokeStyle='#0a0202';ctx.lineWidth=2.5;
    // 粗壮手臂（比原来更粗）
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.quadraticCurveTo(-s*0.35,s*0.05,-s*0.6,s*0.45);
    ctx.quadraticCurveTo(-s*0.68,s*0.55,-s*0.55,s*0.68);
    ctx.quadraticCurveTo(-s*0.3,s*0.55,-s*0.15,s*0.35);
    ctx.quadraticCurveTo(-s*0.05,s*0.15,0,s*0.1);
    ctx.closePath();
    ctx.fill();ctx.stroke();
    // 肌肉纹理
    ctx.strokeStyle='rgba(255,60,0,0.4)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(-s*0.1,s*0.1);ctx.quadraticCurveTo(-s*0.3,s*0.3,-s*0.5,s*0.5);ctx.stroke();
    // 拳头
    ctx.fillStyle='#5c1010';
    ctx.beginPath();ctx.arc(-s*0.55,s*0.6,s*0.12,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#0a0202';ctx.stroke();
    ctx.restore();
    // 右臂
    ctx.save();
    ctx.translate(s*0.75,-s*0.45);
    ctx.rotate(0.4-armSway);
    ctx.fillStyle=armGrad;
    ctx.strokeStyle='#0a0202';ctx.lineWidth=2.5;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.quadraticCurveTo(s*0.35,s*0.05,s*0.6,s*0.45);
    ctx.quadraticCurveTo(s*0.68,s*0.55,s*0.55,s*0.68);
    ctx.quadraticCurveTo(s*0.3,s*0.55,s*0.15,s*0.35);
    ctx.quadraticCurveTo(s*0.05,s*0.15,0,s*0.1);
    ctx.closePath();
    ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(255,60,0,0.4)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(s*0.1,s*0.1);ctx.quadraticCurveTo(s*0.3,s*0.3,s*0.5,s*0.5);ctx.stroke();
    ctx.fillStyle='#5c1010';
    ctx.beginPath();ctx.arc(s*0.55,s*0.6,s*0.12,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#0a0202';ctx.stroke();
    ctx.restore();
    ctx.restore();

    // ===== 5. 巨型干戚武器（双手持巨斧+巨盾，发光威武）=====
    ctx.save();
    const halberdGlow=0.6+Math.sin(t*3)*0.4;
    // 左侧巨斧
    ctx.save();
    ctx.translate(-s*1.15,s*0.2);
    ctx.rotate(-0.6+armSway);
    // 斧柄（更长更粗）
    ctx.fillStyle='#3a1a0a';
    ctx.fillRect(-s*0.035,0,s*0.07,s*0.8);
    ctx.strokeStyle='#1a0a05';ctx.lineWidth=1;ctx.strokeRect(-s*0.035,0,s*0.07,s*0.8);
    // 巨斧头（更大，月牙形锋刃）
    ctx.shadowColor='#ff4500';ctx.shadowBlur=15*halberdGlow;
    const axeGrad=ctx.createLinearGradient(-s*0.3,0,0,0);
    axeGrad.addColorStop(0,'#e0e0e0');
    axeGrad.addColorStop(0.5,'#a8a8a8');
    axeGrad.addColorStop(1,'#666');
    ctx.fillStyle=axeGrad;
    ctx.beginPath();
    ctx.moveTo(0,-s*0.05);
    ctx.quadraticCurveTo(-s*0.35,-s*0.15,-s*0.3,s*0.05);
    ctx.quadraticCurveTo(-s*0.15,s*0.12,0,s*0.1);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle='#444';ctx.lineWidth=1.5;ctx.stroke();
    // 斧刃锋利高光
    ctx.strokeStyle=`rgba(255,255,255,${halberdGlow*0.8})`;ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(-s*0.3,-s*0.1);ctx.quadraticCurveTo(-s*0.2,-s*0.12,-s*0.05,-s*0.05);
    ctx.stroke();
    ctx.restore();
    // 右侧巨盾
    ctx.save();
    ctx.translate(s*1.15,s*0.2);
    ctx.rotate(0.6-armSway);
    // 盾柄
    ctx.fillStyle='#3a1a0a';
    ctx.fillRect(-s*0.035,0,s*0.07,s*0.8);
    // 巨盾（更大，圆形带尖刺）
    ctx.shadowColor='#ffd700';ctx.shadowBlur=12*halberdGlow;
    const shieldGrad=ctx.createRadialGradient(0,0,0,0,0,s*0.22);
    shieldGrad.addColorStop(0,'#8b0000');
    shieldGrad.addColorStop(0.7,'#5c1010');
    shieldGrad.addColorStop(1,'#2a0505');
    ctx.fillStyle=shieldGrad;
    ctx.beginPath();ctx.arc(0,0,s*0.22,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2.5;ctx.stroke();
    // 盾牌尖刺（8个方向）
    ctx.fillStyle='#a8a8a8';
    for(let i=0;i<8;i++){
      const a=(i/8)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*s*0.22,Math.sin(a)*s*0.22);
      ctx.lineTo(Math.cos(a)*s*0.28,Math.sin(a)*s*0.28);
      ctx.lineTo(Math.cos(a+0.15)*s*0.22,Math.sin(a+0.15)*s*0.22);
      ctx.closePath();ctx.fill();
    }
    // 盾牌中心金色图腾
    ctx.fillStyle='#ffd700';
    ctx.shadowColor='#ffd700';ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(0,0,s*0.06,0,Math.PI*2);ctx.fill();
    // 图腾十字纹
    ctx.strokeStyle='#8b0000';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-s*0.04,0);ctx.lineTo(s*0.04,0);
    ctx.moveTo(0,-s*0.04);ctx.lineTo(0,s*0.04);ctx.stroke();
    ctx.restore();
    ctx.restore();

    // ===== 6. 环绕暗黑能量粒子（威慑感）=====
    for(let i=0;i<8;i++){
      const a=t*1.5+i*Math.PI/4;
      const r=s*1.1+Math.sin(t*2+i)*8;
      const px=Math.cos(a)*r,py=Math.sin(a)*r;
      ctx.fillStyle=`rgba(255,${50+Math.sin(t*3+i)*30},0,${0.5+Math.sin(t*2+i)*0.3})`;
      ctx.shadowColor='#ff4500';ctx.shadowBlur=6;
      ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();
    }
    ctx.shadowBlur=0;

    // ===== 7. 受击白色闪光 =====
    if(this.hitFlash>0){
      ctx.save();
      ctx.globalAlpha=this.hitFlash*0.5;
      ctx.fillStyle='#ffffff';
      ctx.beginPath();
      ctx.moveTo(-s*0.75,-s*0.75);
      ctx.quadraticCurveTo(-s*0.9,-s*0.3,-s*0.6,s*0.5);
      ctx.quadraticCurveTo(-s*0.3,s*0.85,0,s*0.88);
      ctx.quadraticCurveTo(s*0.3,s*0.85,s*0.6,s*0.5);
      ctx.quadraticCurveTo(s*0.9,-s*0.3,s*0.75,-s*0.75);
      ctx.quadraticCurveTo(0,-s*0.95,-s*0.75,-s*0.75);
      ctx.closePath();ctx.fill();
      ctx.restore();
    }
  }
}

// ==================== 宠物类 ====================
class Pet {
  constructor(def,stage=0){
    this.def=def; this.stage=stage; this.x=0; this.y=0; this.size=18;
    this.alive=true; this.attackTimer=2; this.orbitAngle=0;
    this.attackAnim=0; this.glowPhase=0;
  }
  update(dt){
    if(!player)return;
    this.orbitAngle+=dt*1.2;
    this.glowPhase+=dt*3;
    if(this.attackAnim>0)this.attackAnim-=dt*3;
    // 饕餮仔：主动索敌，飞向最近敌人而非绕玩家转
    if(this.def.attack==='devour'){
      let nearestE=null,nd=520;
      for(const e of enemies){if(!e.alive)continue;const d=dist(this.x,this.y,e.x,e.y);if(d<nd){nd=d;nearestE=e;}}
      if(boss&&boss.alive){const d=dist(this.x,this.y,boss.x,boss.y);if(d<nd*1.4)nearestE=boss;}
      if(nearestE){
        const dx=nearestE.x-this.x,dy=nearestE.y-this.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d>5){this.x+=dx/d*180*dt;this.y+=dy/d*180*dt;}
      }else{
        const tx=player.x+Math.cos(this.orbitAngle)*100, ty=player.y+Math.sin(this.orbitAngle)*100;
        this.x+=(tx-this.x)*3*dt; this.y+=(ty-this.y)*3*dt;
      }
    }else{
      const tx=player.x+Math.cos(this.orbitAngle)*100, ty=player.y+Math.sin(this.orbitAngle)*100;
      this.x+=(tx-this.x)*3*dt; this.y+=(ty-this.y)*3*dt;
    }
    this.attackTimer-=dt;
    if(this.attackTimer<=0){this.attackTimer=Math.max(1.6, 2.8-this.stage*0.3); this.attack(); this.attackAnim=1; this.attackAnimMax=1;}
  }
  attack(){
    const evo=this.def.evoStats[this.stage];
    let target=null,nd=480;
    for(const e of enemies){if(!e.alive)continue;const d=dist(this.x,this.y,e.x,e.y);if(d<nd){nd=d;target=e;}}
    if(boss&&boss.alive){const d=dist(this.x,this.y,boss.x,boss.y);if(d<nd*1.5)target=boss;}
    if(!target){
      // 超级饕餮仔：即使无目标也释放吞噬吸引
      if(this.def.attack==='devour'){this.devourAttack(evo,8*evo.dmgMul*(this.def.isSuper?1.5:1),null);return;}
      return;
    }
    const dmg=8*evo.dmgMul*(this.def.isSuper?1.5:1);
    const atk=this.def.attack;
    if(atk==='charm'){
      // 魅惑减速周围敌人（粉色魅惑光环）
      spawnParticles(target.x,target.y,'#ff69b4',25);
      pushFloatingText(target.x,target.y-20,'魅惑!','#ff69b4',0.8);
      const r=100*evo.rangeMul;
      for(const e of enemies){if(!e.alive)continue;if(dist(target.x,target.y,e.x,e.y)<r){e.takeDamage(dmg*0.5);if(e.slowFactor!==undefined){e.slowFactor=Math.min(e.slowFactor,0.4);e.slowTimer=2;}}}
      if(boss&&boss.alive&&dist(target.x,target.y,boss.x,boss.y)<r){boss.takeDamage(dmg);if(boss.slowFactor!==undefined){boss.slowFactor=Math.min(boss.slowFactor,0.6);boss.slowTimer=2;}}
    }else if(atk==='fireRain'){
      // 天降火雨
      const cnt=evo.count||3;
      for(let i=0;i<cnt;i++){
        const mx=target.x+rand(-70,70),my=target.y+rand(-70,70);
        spawnParticles(mx,my,'#ff4500',20);
        fireEffects.push({x:mx,y:my,radius:55,damage:dmg*0.4,life:1.5,maxLife:1.5,burnDmg:dmg*0.4,tick:0,chain:0});
        for(const e of enemies){if(!e.alive)continue;if(dist(mx,my,e.x,e.y)<60)e.takeDamage(dmg);}
        if(boss&&boss.alive&&dist(mx,my,boss.x,boss.y)<60)boss.takeDamage(dmg);}
    }else if(atk==='poison'){
      // 九头毒液范围攻击
      spawnParticles(target.x,target.y,'#7cfc00',30);
      pushFloatingText(target.x,target.y-20,'中毒!','#7cfc00',0.8);
      const r=95*evo.rangeMul;
      for(const e of enemies){if(!e.alive)continue;if(dist(target.x,target.y,e.x,e.y)<r){e.takeDamage(dmg);if(e.slowFactor!==undefined){e.slowFactor=Math.min(e.slowFactor,0.5);e.slowTimer=2;}}}
      if(boss&&boss.alive&&dist(target.x,target.y,boss.x,boss.y)<r){boss.takeDamage(dmg);if(boss.slowFactor!==undefined){boss.slowFactor=Math.min(boss.slowFactor,0.7);boss.slowTimer=2;}}
    }else if(atk==='rockThrow'){
      // 投掷巨石分裂攻击
      const cnt=evo.count||1;
      for(let i=0;i<cnt;i++){
        const mx=target.x+rand(-40,40),my=target.y+rand(-40,40);
        spawnParticles(mx,my,'#daa520',25);
        pushFloatingText(mx,my-15,'-'+Math.ceil(dmg),'#daa520',0.6);
        for(const e of enemies){if(!e.alive)continue;if(dist(mx,my,e.x,e.y)<65)e.takeDamage(dmg);}
        if(boss&&boss.alive&&dist(mx,my,boss.x,boss.y)<65)boss.takeDamage(dmg);
        for(let j=0;j<4;j++){const a=(j/4)*Math.PI*2;const sx=mx+Math.cos(a)*45,sy=my+Math.sin(a)*45;spawnParticles(sx,sy,'#daa520',8);for(const e of enemies){if(!e.alive)continue;if(dist(sx,sy,e.x,e.y)<35)e.takeDamage(dmg*0.5);}}
      }
    }else if(atk==='lava'){
      // 熔岩池持续范围伤害
      const cnt=evo.count||3;
      for(let i=0;i<cnt;i++){
        const mx=target.x+rand(-80,80),my=target.y+rand(-80,80);
        spawnParticles(mx,my,'#ff6347',25);
        fireEffects.push({x:mx,y:my,radius:75,damage:dmg*0.5,life:3,maxLife:3,burnDmg:dmg*0.5,tick:0,chain:0});
        for(const e of enemies){if(!e.alive)continue;if(dist(mx,my,e.x,e.y)<75)e.takeDamage(dmg);}
        if(boss&&boss.alive&&dist(mx,my,boss.x,boss.y)<75)boss.takeDamage(dmg);}
    }else if(atk==='wind'){
      // 英招雏：风刃切割多个敌人
      const cnt=evo.count||2;
      spawnParticles(target.x,target.y,'#20b2aa',30);
      pushFloatingText(target.x,target.y-20,'风刃!','#20b2aa',0.8);
      for(let i=0;i<cnt;i++){
        const a=(i/cnt)*Math.PI*2;
        const fx=target.x+Math.cos(a)*120,fy=target.y+Math.sin(a)*120;
        spawnParticles(fx,fy,'#7fffd4',15);
        fireEffects.push({x:fx,y:fy,radius:50,damage:0,life:1.0,maxLife:1.0,burnDmg:0,tick:0,chain:0,windBlade:true});
        for(const e of enemies){if(!e.alive)continue;if(dist(fx,fy,e.x,e.y)<55)e.takeDamage(dmg);}
        if(boss&&boss.alive&&dist(fx,fy,boss.x,boss.y)<55)boss.takeDamage(dmg);
      }
    }else if(atk==='water'){
      // 计蒙子：水柱范围溅射攻击
      const r=70*(evo.rangeMul||1);
      spawnParticles(target.x,target.y,'#4682b4',35);
      pushFloatingText(target.x,target.y-20,'水柱!','#4682b4',0.8);
      fireEffects.push({x:target.x,y:target.y,radius:r,damage:0.5,life:1.5,maxLife:1.5,burnDmg:dmg*0.3,tick:0,chain:0,waterRift:true});
      for(const e of enemies){if(!e.alive)continue;if(dist(target.x,target.y,e.x,e.y)<r){e.takeDamage(dmg);if(e.slowFactor!==undefined){e.slowFactor=Math.min(e.slowFactor,0.6);e.slowTimer=1.5;}}}
      if(boss&&boss.alive&&dist(target.x,target.y,boss.x,boss.y)<r){boss.takeDamage(dmg);if(boss.slowFactor!==undefined){boss.slowFactor=Math.min(boss.slowFactor,0.7);boss.slowTimer=1.5;}}
    }else if(atk==='chaos'){
      // 穷奇崽：混沌弹幕追踪敌人
      const cnt=evo.count||3;
      spawnParticles(target.x,target.y,'#6a0dad',40);
      pushFloatingText(target.x,target.y-20,'混沌!','#9370db',1.0);
      for(let i=0;i<cnt;i++){
        const a=(i/cnt)*Math.PI*2+rand(-0.3,0.3);
        const eb=new EnemyBullet(this.x,this.y,a,200,dmg*0.4,'#9370db');
        eb.homing=1.2; eb.life=3; eb.fromPet=true;
        enemyBullets.push(eb);
      }
      // 范围混沌爆发
      fireEffects.push({x:target.x,y:target.y,radius:60,damage:0,life:1.0,maxLife:1.0,burnDmg:0,tick:0,chain:0,voidRift:true});
      for(const e of enemies){if(!e.alive)continue;if(dist(target.x,target.y,e.x,e.y)<65)e.takeDamage(dmg*0.5);}
      if(boss&&boss.alive&&dist(target.x,target.y,boss.x,boss.y)<65)boss.takeDamage(dmg*0.5);
    }else if(atk==='devour'){
      this.devourAttack(evo,dmg,target);
    }
  }
  // 饕餮仔吞噬吸引：以宠物当前位置为中心（已主动飞向敌人），大范围吸引+伤害
  devourAttack(evo,dmg=0,target=null){
    const r=170*(evo.rangeMul||1); // 满阶340范围
    const cx=this.x,cy=this.y;
    spawnParticles(cx,cy,'#4b0082',35);
    pushFloatingText(cx,cy-20,'吞噬!','#9370db',0.8);
    // 吞噬视觉警告圈（注意：drawWarnings检查的是w.radius，不是w.r，否则预警永远不显示）
    bossWarnings.push({x:cx,y:cy,radius:r,timer:0.5,maxTimer:0.5,color:'rgba(147,112,219'});
    for(const e of enemies){
      if(!e.alive)continue;
      const d=dist(cx,cy,e.x,e.y);
      if(d<r){
        const a=Math.atan2(cy-e.y,cx-e.x);
        const pull=Math.min(80,d*0.6);
        e.x+=Math.cos(a)*pull; e.y+=Math.sin(a)*pull;
        e.takeDamage(dmg);
        spawnParticles(e.x,e.y,'#9370db',6);
      }
    }
    if(boss&&boss.alive){
      const d=dist(cx,cy,boss.x,boss.y);
      if(d<r){const a=Math.atan2(cy-boss.y,cx-boss.x);boss.x+=Math.cos(a)*25;boss.y+=Math.sin(a)*25;boss.takeDamage(dmg*1.5);}
    }
  }
  draw(){
    ctx.save();ctx.translate(this.x,this.y);
    if(this.attackAnim>0){
      const pulseR=this.size+this.attackAnim*25;
      ctx.strokeStyle=this.def.isSuper?'rgba(255,215,0,'+this.attackAnim*0.6+')':'rgba(88,166,255,'+this.attackAnim*0.5+')';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,pulseR,0,Math.PI*2);ctx.stroke();
    }
    if(this.def.isSuper){
      const glow=0.5+Math.sin(this.glowPhase)*0.2;
      ctx.shadowColor='#ffd700';ctx.shadowBlur=15*glow;
    }
    const breath=1+Math.sin(this.glowPhase)*0.08;
    ctx.scale(breath,breath);
    // 优先使用Boss图片（缩小绘制为宝宝形态）
    const petImg=BOSS_IMAGES[this.def.bossIdx];
    if(petImg&&petImg.complete&&petImg.naturalWidth>0){
      ctx.save();
      ctx.beginPath();ctx.arc(0,0,this.size,0,Math.PI*2);ctx.clip();
      ctx.drawImage(petImg,-this.size,-this.size,this.size*2,this.size*2);
      ctx.restore();
      // 描边
      ctx.strokeStyle=this.def.isSuper?'#ffd970':'#58a6ff';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,this.size,0,Math.PI*2);ctx.stroke();
    }else{
      ctx.font='22px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(this.def.icon,0,0);
    }
    ctx.shadowBlur=0;
    ctx.fillStyle='#ffd700';ctx.font='bold 10px Arial';
    ctx.fillText('★'.repeat(this.stage+1),0,this.size+5);
    ctx.restore();
  }
}

// ==================== 特效更新与绘制 ====================
// 直接伤害辅助：绕过无敌帧扣血(用于刑天范围技能，避免伤害丢失)
// 考虑护盾/闪避，但不触发新的无敌帧，确保多段范围伤害全部生效
function applyDirectDamage(p,dmg,label,color){
  if(!p||!p.alive)return;
  // 闪避仍可生效
  if(p.dodgeChance&&Math.random()<p.dodgeChance){
    pushFloatingText(p.x,p.y-30,'闪避!','#58a6ff',0.8);
    spawnParticles(p.x,p.y,'#58a6ff',10); return;
  }
  // Boss装备词条：雨帘护体(计蒙) - 受到伤害-15%
  if(p.dmgReduction){dmg=Math.max(1,Math.ceil(dmg*(1-p.dmgReduction)));}
  // 护盾抵消（不触发invincible，避免吞掉后续伤害）
  if(p.shield>0){
    p.shield--; spawnParticles(p.x,p.y,'#58a6ff',12);
    pushFloatingText(p.x,p.y-30,'护盾抵消!','#58a6ff',0.8);
    updateUI(); return;
  }
  // 直接扣血
  p.health-=dmg;
  p.hitFlash=0.1;
  if(label)pushFloatingText(p.x,p.y-30,`${label} -${Math.ceil(dmg)}`,color||'#ff4500',1.2);
  spawnParticles(p.x,p.y,color||'#ff4500',15);
  flashScreen('#cc0000', 0.18); // 受击全屏红屏反馈（Boss技能伤害更明显）
  screenShake = Math.max(screenShake, 0.5);
  if(p.health<=0){
    if(!tryRevive(p)){
      triggerDeathAnimation();
    }
  }
  updateUI();
}
function updateFireEffects(dt){
  for(const f of fireEffects){
    f.life-=dt; f.tick-=dt;
    if(f.tick<=0){
      f.tick=0.3;
      // 玩家毒沼(isPlayerPoison)：只伤敌人，不伤玩家；享受poisonBonusMul加成
      if(f.isPlayerPoison){
        const dmgMul=player?.poisonBonusMul||1;
        const dmg=f.burnDmg*dmgMul;
        for(const e of enemies){if(!e.alive)continue;if(dist(f.x,f.y,e.x,e.y)<f.radius)e.takeDamage(dmg);}
        if(boss&&boss.alive&&dist(f.x,f.y,boss.x,boss.y)<f.radius)boss.takeDamage(dmg);
        continue; // 跳过后续玩家伤害判定
      }
      // 玩家产生的灼烧效果（fireball等）享受burnBonusMul加成
      const burnMul=(f.isPlayerFire&&player?.burnBonusMul)?player.burnBonusMul:1;
      const burnDmg=f.burnDmg*burnMul;
      for(const e of enemies){if(!e.alive)continue;if(dist(f.x,f.y,e.x,e.y)<f.radius)e.takeDamage(burnDmg);}
      if(boss&&boss.alive&&dist(f.x,f.y,boss.x,boss.y)<f.radius)boss.takeDamage(burnDmg);
      // 熔岩池/危险区域对玩家造成持续伤害（仅限标记了playerHazard的效果，绕过无敌帧）
      if(f.burnDmg>0&&f.playerHazard&&player&&player.alive&&dist(f.x,f.y,player.x,player.y)<f.radius){
        // 直接扣血，绕过无敌帧（用playerHazardTick控制频率）
        // 应用 dmgReduction（与 takeDamage/applyDirectDamage 保持一致，让装备减伤词条对熔岩池/毒雾生效）
        if(!player._hazardTick||player._hazardTick<=0){
          let hd=f.burnDmg;
          if(player.dmgReduction)hd=Math.max(1,Math.ceil(hd*(1-player.dmgReduction)));
          player.health-=hd;
          player._hazardTick=0.5; // 每0.5秒一次伤害
          spawnParticles(player.x,player.y,'#ff4500',8);
          pushFloatingText(player.x,player.y-30,`-${hd}`,'#ff4500',0.8);
          if(player.health<=0){
            // 与applyDirectDamage/takeDamage两条伤害路径保持一致：先尝试复活，复活失败才触发死亡动画
            if(!tryRevive(player))triggerDeathAnimation();
          }
          updateUI();
        }
      }
      // 连锁
      if(f.chain>0){
        let nearest=null,nd=f.radius*2;
        for(const e of enemies){if(!e.alive)continue;const d=dist(f.x,f.y,e.x,e.y);if(d> f.radius&&d<nd){nd=d;nearest=e;}}
        if(nearest){fireEffects.push({x:nearest.x,y:nearest.y,radius:f.radius*0.7,damage:f.burnDmg,life:1,maxLife:1,burnDmg:f.burnDmg,tick:0,chain:f.chain-1});}
      }
    }
  }
  fireEffects=fireEffects.filter(f=>f.life>0);
}
function drawFireEffects(){
  for(const f of fireEffects){
    if(!isFinite(f.x)||!isFinite(f.y)||!f.radius||f.radius<=0||!isFinite(f.radius))continue;
    const lifeRatio=f.life/f.maxLife;
    // 渐入渐出：开始0.15秒渐入，结束前0.2秒渐出，中间全程满alpha
    let fadeIn=1;
    const age=f.maxLife-f.life;
    if(age<0.15)fadeIn=age/0.15;
    else if(lifeRatio<0.2)fadeIn=lifeRatio/0.2;
    const a=Math.min(1,fadeIn)*0.85;
    const grad=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.radius);
    if(f.voidRift){
      // 虚空之弓裂缝：紫色（加强透明度和粒子感）
      grad.addColorStop(0,`rgba(216,180,254,${a*1.8})`);
      grad.addColorStop(0.4,`rgba(192,132,252,${a*1.4})`);
      grad.addColorStop(0.7,`rgba(168,85,247,${a*1.0})`);
      grad.addColorStop(1,`rgba(126,34,206,0)`);
    }else if(f.blackhole){
      // 饕餮黑洞：紫色漩涡(多层旋转环)
      grad.addColorStop(0,`rgba(88,28,135,${a*2.5})`);
      grad.addColorStop(0.3,`rgba(147,51,234,${a*1.8})`);
      grad.addColorStop(0.6,`rgba(192,132,252,${a*1.0})`);
      grad.addColorStop(1,`rgba(126,34,206,0)`);
    }else if(f.lavaPool){
      // 烛龙熔岩池：橙红冒泡
      grad.addColorStop(0,`rgba(255,220,100,${a*2.0})`);
      grad.addColorStop(0.4,`rgba(255,100,0,${a*1.5})`);
      grad.addColorStop(0.8,`rgba(200,40,0,${a*0.8})`);
      grad.addColorStop(1,`rgba(120,20,0,0)`);
    }else if(f.waterRift){
      // 计蒙水柱：蓝色（加强）
      grad.addColorStop(0,`rgba(147,197,253,${a*1.8})`);
      grad.addColorStop(0.5,`rgba(70,130,180,${a*1.2})`);
      grad.addColorStop(1,`rgba(30,80,150,0)`);
    }else if(f.windBlade){
      // 英招风刃：青绿色锐利新月
      grad.addColorStop(0,`rgba(167,243,208,${a*1.6})`);
      grad.addColorStop(0.6,`rgba(45,212,191,${a*1.0})`);
      grad.addColorStop(1,`rgba(20,184,166,0)`);
    }else if(f.hammerBlast){
      // 震天锤爆炸冲击波：橙色环
      grad.addColorStop(0,`rgba(251,146,60,${a*0.6})`);
      grad.addColorStop(0.7,`rgba(234,88,12,${a*0.8})`);
      grad.addColorStop(1,`rgba(124,45,18,0)`);
    }else if(f.isPlayerPoison){
      // 玩家毒沼(相柳装备效果)：明亮翠绿色光环+白色✨粒子标记
      // 与Boss原色毒沼(暗黄绿)明显区分：更鲜艳的薄荷绿+高亮白边
      grad.addColorStop(0,`rgba(167,243,208,${a*1.8})`);
      grad.addColorStop(0.4,`rgba(52,211,153,${a*1.4})`);
      grad.addColorStop(0.8,`rgba(16,185,129,${a*0.9})`);
      grad.addColorStop(1,`rgba(5,150,105,0)`);
    }else{
      // 火焰：加强默认透明度
      grad.addColorStop(0,`rgba(255,180,50,${a*1.5})`);
      grad.addColorStop(0.5,`rgba(255,100,0,${a*1.0})`);
      grad.addColorStop(1,`rgba(255,40,0,0)`);
    }
    // 维度裂隙跳过圆形径向背景(它使用自己的长条形绘制)
    if(!f.dimensionRift){
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(f.x,f.y,f.radius,0,Math.PI*2); ctx.fill();
    }
    // 玩家毒沼额外标记：白色高亮虚线边+✨粒子，让玩家一眼识别是自己的装备效果
    if(f.isPlayerPoison && a>0.1){
      ctx.save();
      // 白色虚线边（脉冲）
      const pulse=0.5+Math.sin(_NOW/200)*0.3;
      ctx.strokeStyle=`rgba(255,255,255,${a*pulse*0.9})`;
      ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.arc(f.x,f.y,f.radius-2,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      // 中心✨标记（小金色十字闪烁）
      ctx.strokeStyle=`rgba(255,255,255,${a*0.8})`;
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(f.x-4,f.y); ctx.lineTo(f.x+4,f.y);
      ctx.moveTo(f.x,f.y-4); ctx.lineTo(f.x,f.y+4);
      ctx.stroke();
      ctx.restore();
    }
    // 虚空裂缝额外绘制能量裂纹(穷奇维度裂隙用dimensionRift专属绘制，跳过)
    if(f.voidRift&&!f.dimensionRift&&a>0.05){
      ctx.save();
      ctx.strokeStyle=`rgba(216,180,254,${a*2})`;
      ctx.lineWidth=2;
      for(let i=0;i<4;i++){
        const ang=(_NOW/300+i*Math.PI/2)%Math.PI;
        const r1=f.radius*0.3,r2=f.radius*0.85;
        ctx.beginPath();
        ctx.moveTo(f.x+Math.cos(ang)*r1,f.y+Math.sin(ang)*r1);
        ctx.lineTo(f.x+Math.cos(ang)*r2,f.y+Math.sin(ang)*r2);
        ctx.stroke();
      }
      ctx.restore();
    }
    // 穷奇维度裂隙：长条形空间裂缝(撕裂动画)
    if(f.dimensionRift&&a>0.05){
      ctx.save();
      ctx.translate(f.x,f.y);
      ctx.rotate(f.riftAngle);
      const halfLen=f.riftLength/2;
      const halfW=f.riftWidth/2;
      const t=_NOW/200;
      // 渐入渐出：开始/结束时裂缝较短(撕裂/闭合动画)
      const lifePct=f.life/f.maxLife;
      const openFactor=lifePct>0.8?(1-lifePct)*5:(lifePct<0.2?lifePct*5:1);
      const curLen=halfLen*openFactor;
      // 裂缝核心：深紫色能量带(带渐变)
      const grad=ctx.createLinearGradient(-curLen,0,curLen,0);
      grad.addColorStop(0,'rgba(168,85,247,0)');
      grad.addColorStop(0.2,`rgba(192,132,252,${a*2})`);
      grad.addColorStop(0.5,`rgba(255,255,255,${a*3})`);
      grad.addColorStop(0.8,`rgba(192,132,252,${a*2})`);
      grad.addColorStop(1,'rgba(168,85,247,0)');
      ctx.fillStyle=grad;
      ctx.fillRect(-curLen,-halfW,curLen*2,halfW*2);
      // 裂缝边缘：发光紫色描边(锯齿状)
      ctx.strokeStyle=`rgba(216,180,254,${a*2.5})`;
      ctx.lineWidth=1.5;
      ctx.shadowColor='#a855f7'; ctx.shadowBlur=12;
      for(const side of [-1,1]){
        ctx.beginPath();
        for(let i=0;i<=20;i++){
          const px=-curLen+(i/20)*curLen*2;
          const py=side*halfW+Math.sin(t+i*0.7)*2;
          if(i===0)ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.stroke();
      }
      ctx.shadowBlur=0;
      // 裂缝中的能量火花(随机闪烁)
      for(let i=0;i<5;i++){
        const sx=(Math.random()-0.5)*curLen*1.8;
        const sy=(Math.random()-0.5)*halfW*1.5;
        ctx.fillStyle=`rgba(255,255,255,${a*3*Math.random()})`;
        ctx.fillRect(sx,sy,2,2);
      }
      ctx.restore();
    }
    // 饕餮黑洞：旋转漩涡环
    if(f.blackhole&&a>0.05){
      ctx.save();
      const t=_NOW/400;
      for(let ring=0;ring<3;ring++){
        ctx.strokeStyle=`rgba(192,132,252,${a*(2-ring*0.4)})`;
        ctx.lineWidth=2-ring*0.5;
        ctx.beginPath();
        for(let i=0;i<=40;i++){
          const ang=i/40*Math.PI*2+t*(ring+1)*0.7;
          const r=f.radius*(0.3+ring*0.25)*(1+Math.sin(ang*3+t)*0.1);
          const px=f.x+Math.cos(ang)*r, py=f.y+Math.sin(ang)*r;
          if(i===0)ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.stroke();
      }
      ctx.fillStyle=`rgba(20,5,30,${a*3})`;
      ctx.beginPath(); ctx.arc(f.x,f.y,f.radius*0.15,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    // 饕餮巨口：8个尖牙张合动画(只在devourMaw标记时显示)
    if(f.devourMaw&&a>0.05){
      ctx.save();
      const t=_NOW/600;
      // 张合周期：2秒一周期(0~0.5张开, 0.5~1闭合)
      const openPhase=(Math.sin(t*Math.PI)+1)/2; // 0~1
      const mouthR=f.radius*0.25*(1+openPhase*0.6); // 张开时中心扩大
      ctx.fillStyle=`rgba(15,3,25,${a*4})`;
      ctx.beginPath(); ctx.arc(f.x,f.y,mouthR,0,Math.PI*2); ctx.fill();
      // 8个三角形尖牙围绕中心
      const teeth=8;
      for(let i=0;i<teeth;i++){
        const ang=i/teeth*Math.PI*2+t*0.3;
        const innerR=mouthR*0.7;
        const outerR=mouthR+12+openPhase*8;
        ctx.fillStyle=`rgba(240,230,255,${a*2.5})`;
        ctx.strokeStyle=`rgba(192,132,252,${a*1.5})`;
        ctx.lineWidth=1;
        ctx.beginPath();
        ctx.moveTo(f.x+Math.cos(ang-0.1)*innerR, f.y+Math.sin(ang-0.1)*innerR);
        ctx.lineTo(f.x+Math.cos(ang)*outerR, f.y+Math.sin(ang)*outerR);
        ctx.lineTo(f.x+Math.cos(ang+0.1)*innerR, f.y+Math.sin(ang+0.1)*innerR);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    // 烛龙熔岩池：冒泡粒子
    if(f.lavaPool&&a>0.05){
      ctx.save();
      for(let i=0;i<3;i++){
        const ang=_NOW/200+i*2.1;
        const r=f.radius*0.5*(0.5+Math.sin(ang*1.3)*0.5);
        const bx=f.x+Math.cos(ang)*r, by=f.y+Math.sin(ang)*r;
        ctx.fillStyle=`rgba(255,${150+Math.sin(ang*3)*50},0,${a*2})`;
        ctx.beginPath(); ctx.arc(bx,by,3+Math.sin(ang*2)*2,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
    // 干戚横扫特效：半月形挥砍轨迹（明显的刀光弧线）
    if(f.halberdSweepEffect&&a>0.02){
      ctx.save();
      const sweepT=1-lifeRatio; // 0→1 随时间推进
      const sweepAngle=sweepT*Math.PI*4; // 旋转2圈
      // 刀光主弧线（月牙形，跟随挥砍方向）
      ctx.translate(f.x,f.y);
      ctx.rotate(sweepAngle);
      ctx.shadowColor='#ff4500';ctx.shadowBlur=20;
      ctx.strokeStyle=`rgba(255,100,0,${a*1.2})`;
      ctx.lineWidth=12;
      ctx.beginPath();
      ctx.arc(0,0,f.radius*0.9,-Math.PI*0.35,Math.PI*0.35);
      ctx.stroke();
      // 内层亮光（白色锋芒）
      ctx.shadowBlur=15;
      ctx.strokeStyle=`rgba(255,255,200,${a*0.9})`;
      ctx.lineWidth=4;
      ctx.beginPath();
      ctx.arc(0,0,f.radius*0.9,-Math.PI*0.3,Math.PI*0.3);
      ctx.stroke();
      // 外层暗红光晕
      ctx.shadowColor='#8b0000';ctx.shadowBlur=25;
      ctx.strokeStyle=`rgba(139,0,0,${a*0.6})`;
      ctx.lineWidth=20;
      ctx.beginPath();
      ctx.arc(0,0,f.radius*0.9,-Math.PI*0.4,Math.PI*0.4);
      ctx.stroke();
      ctx.shadowBlur=0;
      ctx.restore();
    }
  }
}
function updateLightningStrikes(dt){
  for(const ls of lightningStrikes){
    ls.life-=dt;
    // Boss落雷：对玩家造成伤害（绕过无敌帧，用struck标记只伤害一次）
    if(ls.isBossLightning){
      if(!ls.struck && player && player.alive && dist(ls.x,ls.y,player.x,player.y)<(ls.radius||60)){
        ls.struck=true;
        applyDirectDamage(player, ls.dmg||2, '⚡落雷!', '#ffd700');
        spawnParticles(player.x,player.y,'#ffd700',12);
      }
      continue; // Boss落雷不对敌人/Boss造成伤害，跳过下方玩家闪电链逻辑
    }
    if(ls.life>0.3){
      // 玩家闪电链：伤害敌人/Boss
      if(!ls.chained)ls.chained=new Set();
      // 伤害
      for(const e of enemies){if(!e.alive||ls.chained.has(e))continue;if(dist(ls.x,ls.y,e.x,e.y)<40){e.takeDamage(ls.dmg);ls.chained.add(e);}}
      if(boss&&boss.alive&&!ls.chained.has(boss)&&dist(ls.x,ls.y,boss.x,boss.y)<50){boss.takeDamage(ls.dmg);ls.chained.add(boss);}
      // 连锁
      if(ls.chain>0&&!ls.chainedDone){
        ls.chainedDone=true;
        let target=null,nd=ls.chainRange;
        for(const e of enemies){if(!e.alive||ls.chained.has(e))continue;const d=dist(ls.x,ls.y,e.x,e.y);if(d<nd){nd=d;target=e;}}
        if(target){lightningStrikes.push({x:target.x,y:target.y,life:0.4,dmg:ls.dmg*0.6,chain:ls.chain-1,chainRange:ls.chainRange,chained:new Set([...ls.chained,target])});}
      }
    }
  }
  lightningStrikes=lightningStrikes.filter(ls=>ls.life>0);
}
function drawLightningStrikes(){
  for(const ls of lightningStrikes){
    const a=Math.min(1,ls.life*2);
    ctx.strokeStyle=`rgba(255,215,0,${a})`; ctx.lineWidth=3; ctx.shadowColor='#ffd700'; ctx.shadowBlur=15;
    // 闪电形状
    ctx.beginPath(); ctx.moveTo(ls.x,ls.y-40);
    ctx.lineTo(ls.x-10,ls.y-15); ctx.lineTo(ls.x+5,ls.y-10);
    ctx.lineTo(ls.x-8,ls.y+10); ctx.lineTo(ls.x,ls.y+20);
    ctx.stroke(); ctx.shadowBlur=0;
    // 冲击波（使用maxLife归一化，避免ls.life>0.5时半径为负数导致arc抛错）
    const maxL=ls.maxLife||0.5;
    const progress=Math.max(0, Math.min(1, 1-ls.life/maxL));
    const radius=Math.max(0, (ls.radius||40)*progress);
    if(radius>0){
      ctx.strokeStyle=`rgba(255,215,0,${a*0.5})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(ls.x,ls.y,radius,0,Math.PI*2); ctx.stroke();
    }
  }
}
function updateTornadoes(dt){
  for(const t of tornadoes){
    t.life-=dt; t.tick-=dt;
    t.x+=t.vx*dt; t.y+=t.vy*dt;
    t.x=clamp(t.x,t.radius,CONFIG.WIDTH-t.radius); t.y=clamp(t.y,t.radius,CONFIG.HEIGHT-t.radius);
    if(t.tick<=0){
      t.tick=0.2;
      for(const e of enemies){
        if(!e.alive)continue;
        const d=dist(t.x,t.y,e.x,e.y);
        if(d<t.radius){
          e.takeDamage(t.damage);
          // 吸引敌人
          const a=Math.atan2(t.y-e.y,t.x-e.x);
          e.x+=Math.cos(a)*30; e.y+=Math.sin(a)*30;
        }
      }
      if(boss&&boss.alive&&dist(t.x,t.y,boss.x,boss.y)<t.radius)boss.takeDamage(t.damage);
      // 伤害玩家（Boss召唤的龙卷风）
      if(player&&dist(t.x,t.y,player.x,player.y)<t.radius){
        player.takeDamage(1);
        // 推开玩家
        const pa=Math.atan2(player.y-t.y,player.x-t.x);
        player.x+=Math.cos(pa)*40; player.y+=Math.sin(pa)*40;
        spawnParticles(player.x,player.y,'#7fffd4',5);
      }
    }
  }
  tornadoes=tornadoes.filter(t=>t.life>0);
}
function drawTornadoes(){
  for(const t of tornadoes){
    const a=Math.min(1,t.life/Math.min(t.maxLife,5));
    ctx.save(); ctx.translate(t.x,t.y);
    for(let i=0;i<3;i++){
      const r=t.radius*(0.5+i*0.25);
      ctx.strokeStyle=`rgba(121,192,255,${a*0.4})`; ctx.lineWidth=3;
      ctx.beginPath();
      for(let j=0;j<20;j++){
        const ang=(j/20)*Math.PI*2+_NOW/100+i;
        const px=Math.cos(ang)*r, py=Math.sin(ang)*r*0.7;
        if(j===0)ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
}
// ==================== 武器差异化命中效果 ====================
function triggerWeaponHitEffects(bullet,target){
  // 雷神炮：闪电链跳跃到附近敌人
  if(bullet.weaponId==='thunder'&&bullet.chainCount>0){
    bullet.chainCount--;
    let nearest=null,nd=180;
    for(const e of enemies){if(!e.alive||bullet.hitEnemies.has(e))continue;const d=dist(bullet.x,bullet.y,e.x,e.y);if(d<nd){nd=d;nearest=e;}}
    if(boss&&boss.alive&&!bullet.hitEnemies.has(boss)){const d=dist(bullet.x,bullet.y,boss.x,boss.y);if(d<nd*1.5)nearest=boss;}
    if(nearest){
      lightningStrikes.push({x:nearest.x,y:nearest.y,life:0.4,dmg:bullet.damage*0.5,chain:bullet.chainCount>0?1:0,chainRange:150,chained:new Set([target])});
      spawnParticles(bullet.x,bullet.y,'#ffe066',6);
    }
  }
  // 震天锤：命中时范围爆炸
  if(bullet.weaponId==='hammer'&&!bullet.hasExploded){
    bullet.hasExploded=true;
    const explodeR=55;
    for(const e of enemies){if(!e.alive||bullet.hitEnemies.has(e))continue;if(dist(bullet.x,bullet.y,e.x,e.y)<explodeR){e.takeDamage(bullet.damage*0.3,bullet);bullet.hitEnemies.add(e);}}
    if(boss&&boss.alive&&!bullet.hitEnemies.has(boss)&&dist(bullet.x,bullet.y,boss.x,boss.y)<explodeR){boss.takeDamage(bullet.damage*0.3,bullet);}
    spawnParticles(bullet.x,bullet.y,'#fb923c',18);
    // 爆炸冲击波视觉
    fireEffects.push({x:bullet.x,y:bullet.y,radius:explodeR,damage:0,life:0.8,maxLife:0.8,burnDmg:0,tick:0,chain:0,hammerBlast:true});
  }
  // 刑天干戚：战魂护盾 — 命中时叠加护盾(每命中5次+1护盾，5秒内置CD防止贴脸无敌)
  // 平衡参数（与 project_memory 一致）：5命中+1护盾，5秒CD；护盾已满时不累计也不触发CD
  if(bullet.weaponId==='xingtiangeqi'&&player&&!bullet._shieldAdded){
    bullet._shieldAdded=true;
    // 护盾已满：跳过累计和CD（避免空转浪费CD窗口）
    if(player.shield>=player.maxShield)return;
    const now=performance.now();
    const lastCD=player._xingtianShieldCD||0;
    if((now-lastCD)>=5000){
      player._xingtianHits=(player._xingtianHits||0)+1;
      if(player._xingtianHits>=5){
        // 每命中5次获得1点护盾，5秒CD限制防止贴脸叠盾
        player._xingtianHits=0;
        player._xingtianShieldCD=now;
        player.shield=Math.min(player.shield+1,player.maxShield); // 不超过maxShield
        spawnParticles(player.x,player.y,'#ff4500',6);
        pushFloatingText(player.x,player.y-40,'战魂护盾+1','#ff4500',0.6);
        updateUI();
      }
    }
  }
}
// ==================== 碰撞检测 ====================
function checkCollisions(){
  for(const bullet of bullets){
    if(!bullet.alive)continue;
    for(const enemy of enemies){
      if(!enemy.alive||bullet.hitEnemies.has(enemy))continue;
      // 受击框放大1.25倍(原0.8→1.0),让子弹更容易命中
      // 性能优化：平方距离比较避免sqrt
      const _r1=bullet.size+enemy.size*1.0;
      if(distSq(bullet.x,bullet.y,enemy.x,enemy.y)<_r1*_r1){
        // Boss装备词条：魅惑子弹(九尾狐) - 命中时概率让敌人混乱互殴2秒
        // 平衡限制：Boss/精英大怪(giant/taunt)免疫魅惑，避免强力敌人被轻易转化
        // 保命机制：在takeDamage之前判断，若本次伤害会秒杀小怪，魅惑时给予临时血量保命2秒
        if(player && player.charmBullet && !enemy.charmed && !enemy.isBoss
           && enemy.type!=='giant' && enemy.type!=='taunt'
           && Math.random()<player.charmBullet){
          // 如果即将被秒杀，给予临时血量保命（让小怪能活下来去打其他敌人）
          if(enemy.health <= bullet.damage){
            const _safeHP = Math.max(3, bullet.damage + 2); // 至少能扛2-3下攻击
            enemy.health = _safeHP;
            enemy.maxHealth = Math.max(enemy.maxHealth, _safeHP);
            enemy._charmProtected = true; // 标记：魅惑保护状态
            spawnParticles(enemy.x,enemy.y,'#ff69b4',8);
          }
          enemy.charmed=2; // 2秒混乱
          spawnParticles(enemy.x,enemy.y,'#ff69b4',10);
          pushFloatingText(enemy.x,enemy.y-30,'💖魅惑','#ff69b4',0.8);
        }
        enemy.takeDamage(bullet.damage,bullet);
        bullet.hitEnemies.add(enemy);
        // 暴击反馈：放大字号+显示伤害值+红色发光
        if(bullet.isCrit){
          pushFloatingText(enemy.x,enemy.y-15,`💥${Math.ceil(bullet.damage)}`,'#ff6b6b',0.8,22);
          spawnParticles(enemy.x,enemy.y,'#ff6b6b',6);
        }else{
          // 普通命中显示白色伤害数字
          pushFloatingText(enemy.x,enemy.y-15,`${Math.ceil(bullet.damage)}`,'#ffffff',0.5,13);
        }
        // 真伤/护盾穿透：紫色数字（高于普通伤害，单独显示）
        if(bullet.pierce && bullet.pierce>0){
          pushFloatingText(enemy.x+20,enemy.y-25,'✦','#bc8cff',0.6,16);
        }
        // 吸血
        if(bullet.lifesteal&&Math.random()<bullet.lifesteal&&player){player.heal(1); spawnParticles(enemy.x,enemy.y,'#3fb950',3);}
        // 爆破子弹：命中时范围爆炸（带强特效）
        if(bullet.bulletExplode){
          const explodeR=65;
          const explodeR2=explodeR*explodeR;
          // 视觉特效1：爆炸冲击波环（橙色，0.8秒）
          fireEffects.push({x:enemy.x,y:enemy.y,radius:explodeR,damage:0,life:0.5,maxLife:0.5,burnDmg:0,tick:0,chain:0,hammerBlast:true});
          // 视觉特效2：多色粒子（橙红+黄）
          spawnParticles(enemy.x,enemy.y,'#ff6347',16);
          spawnParticles(enemy.x,enemy.y,'#ffd700',10);
          spawnParticles(enemy.x,enemy.y,'#ff8c42',8);
          // 视觉特效3：屏幕震动（小幅度）
          screenShake=Math.max(screenShake,0.15);
          // 音效
          if(typeof playSound==='function')playSound('explode');
          // 范围伤害（平方距离比较）
          for(const e2 of enemies){if(!e2.alive||e2===enemy||bullet.hitEnemies.has(e2))continue; if(distSq(enemy.x,enemy.y,e2.x,e2.y)<explodeR2){e2.takeDamage(bullet.damage*0.4,bullet); bullet.hitEnemies.add(e2);}}
          if(boss&&boss.alive&&boss!==enemy&&distSq(enemy.x,enemy.y,boss.x,boss.y)<explodeR2){boss.takeDamage(bullet.damage*0.4,bullet);}
        }
        // 子弹分裂：命中分裂出2发，伤害减半，最多2代。Build联动·贯穿裂变：splitDmgMul加成
        if(bullet.bulletSplit>0&&bullet.splitGen<2){
          const splitN=2;
          // 默认分裂伤害为原弹50%，Build联动·贯穿裂变可提升至60%
          const splitMul=player?.splitDmgMul||0.5;
          const splitDmg=bullet.damage*splitMul;
          for(let s=0;s<splitN;s++){
            const sa=bullet.angle+(s===0?0.5:-0.5);
            const sb=new Bullet(bullet.x,bullet.y,sa,{
              speed:bullet.speed,damage:splitDmg,pierce:0,homing:0,size:bullet.size*0.8,
              isCrit:false,elementEffects:{...bullet.elementEffects},finalUpgrades:[...bullet.finalUpgrades],
              specialEffects:{...bullet.specialEffects},finalSpecials:[...bullet.finalSpecials],
              lifesteal:0,weaponId:bullet.weaponId,chainCount:0,voidTrail:false,boomerang:false,
              originX:bullet.x,originY:bullet.y,boomerangMaxDist:300,bulletExplode:0,
              bulletSplit:bullet.bulletSplit-1,splitGen:bullet.splitGen+1
            });
            bullets.push(sb);
          }
          spawnParticles(enemy.x,enemy.y,'#bc8cff',4);
        }
        // 武器差异化机制
        triggerWeaponHitEffects(bullet,enemy);
        if(bullet.pierce>0)bullet.pierce--; else bullet.alive=false;
        break;
      }
    }
    if(bullet.alive&&boss&&boss.alive&&!bullet.hitEnemies.has(boss)){
      // Boss受击框放大(原1.5→1.8),让子弹更容易命中Boss
      const _r2=bullet.size+boss.size*1.8;
      if(distSq(bullet.x,bullet.y,boss.x,boss.y)<_r2*_r2){
        const br=boss; boss.takeDamage(bullet.damage,bullet); bullet.hitEnemies.add(br);
        // Boss暴击反馈：更大字号+伤害值+红色发光
        if(bullet.isCrit&&boss){
          pushFloatingText(br.x,br.y-30,`💥${Math.ceil(bullet.damage)}`,'#ff6b6b',0.9,26);
          spawnParticles(br.x,br.y,'#ff6b6b',8);
        }else if(boss){
          pushFloatingText(br.x,br.y-25,`${Math.ceil(bullet.damage)}`,'#ffffff',0.5,15);
        }
        // 吸血
        if(bullet.lifesteal&&Math.random()<bullet.lifesteal&&player){player.heal(1); spawnParticles(br.x,br.y,'#3fb950',3);}
        // 武器差异化机制
        triggerWeaponHitEffects(bullet,br);
        if(bullet.pierce>0)bullet.pierce--; else bullet.alive=false;
      }
    }
    // 玩家子弹可以击破刑天的战魂分身（追踪球）
    if(bullet.alive&&boss&&boss.alive&&boss.wrathClonesActive){
      for(const cl of boss.wrathClones){
        if(!cl.alive||bullet.hitEnemies.has(cl))continue;
        const _r3=bullet.size+cl.size;
        if(distSq(bullet.x,bullet.y,cl.x,cl.y)<_r3*_r3){
          cl.hp-=bullet.damage;
          cl.hitFlash=0.3;
          bullet.hitEnemies.add(cl);
          spawnParticles(cl.x,cl.y,'#bc8cff',8);
          if(bullet.isCrit)pushFloatingText(cl.x,cl.y-15,'暴击!','#ff6b6b',0.6);
          if(cl.hp<=0){
            cl.alive=false;
            spawnParticles(cl.x,cl.y,'#bc8cff',30);
            pushFloatingText(cl.x,cl.y-20,'战魂击破!','#ffd700',1.5);
            screenShake=0.2;
          }
          if(bullet.pierce>0)bullet.pierce--; else bullet.alive=false;
          break;
        }
      }
    }
  }
  const edmg=Math.max(1,Math.round(getDifficulty().enemyDmgMul));
  for(const enemy of enemies){
    if(!enemy.alive||!player)continue;
    const _r4=enemy.size+player.size*0.7;
    if(distSq(enemy.x,enemy.y,player.x,player.y)<_r4*_r4){
      player.takeDamage(edmg);
      if(player.thorns&&enemy.alive){enemy.takeDamage(player.thorns); spawnParticles(enemy.x,enemy.y,'#c0c0c0',5);}
    }
  }
  if(boss&&boss.alive&&player){
    const _r5=boss.size*0.7+player.size*0.7;
    if(distSq(boss.x,boss.y,player.x,player.y)<_r5*_r5)player.takeDamage(boss.isCharging?edmg+3:edmg+2);
  }
  // 宠物发射的追踪弹：伤害敌人和Boss，不伤害玩家
  for(const eb of enemyBullets){
    if(!eb.alive)continue;
    if(eb.fromPet){
      for(const enemy of enemies){
        if(!enemy.alive)continue;
        const _r6=eb.size+enemy.size*0.8;
        if(distSq(eb.x,eb.y,enemy.x,enemy.y)<_r6*_r6){
          enemy.takeDamage(eb.damage||5);
          spawnParticles(eb.x,eb.y,eb.color,8);
          eb.alive=false; break;
        }
      }
      if(eb.alive&&boss&&boss.alive){
        const _r7=eb.size+boss.size*1.5;
        if(distSq(eb.x,eb.y,boss.x,boss.y)<_r7*_r7){
          boss.takeDamage(eb.damage||5);
          spawnParticles(eb.x,eb.y,eb.color,8);
          eb.alive=false;
        }
      }
    }else if(player){
      // 圆弧护盾阻挡判定：子弹在圆弧范围内且角度匹配则销毁子弹
      if(player.arcShield.active){
        const ar=player.arcShield;
        const dx=eb.x-player.x, dy=eb.y-player.y;
        const d=Math.sqrt(dx*dx+dy*dy);
        // 距离接近圆弧半径(±10px容差)
        if(d>ar.radius-12 && d<ar.radius+12){
          const ebAngle=Math.atan2(dy,dx);
          // 计算子弹角度与圆弧中心角度的差，归一化到[-PI,PI]
          let diff=ebAngle-ar.angle;
          while(diff>Math.PI)diff-=Math.PI*2;
          while(diff<-Math.PI)diff+=Math.PI*2;
          if(Math.abs(diff)<ar.span/2){
            // 在圆弧范围内：阻挡子弹
            eb.alive=false;
            spawnParticles(eb.x,eb.y,'#ffd700',10);
            continue;
          }
        }
      }
      // 普通敌方子弹：伤害玩家
      const _r8=eb.size+player.size*0.6;
      if(distSq(eb.x,eb.y,player.x,player.y)<_r8*_r8){
        if(eb.directHit){
          // 直接伤害（绕过无敌帧，战魂分身子弹等）
          applyDirectDamage(player,edmg+1,eb.directLabel||'⚔️直接命中!',eb.color);
        }else{
          // Boss战中子弹伤害更高（edmg是基础值，Boss子弹额外+1）
          const _bulletDmg = (boss&&boss.alive) ? edmg+1 : edmg;
          player.takeDamage(_bulletDmg);
        }
        eb.alive=false;spawnParticles(eb.x,eb.y,eb.color,8);
      }
    }
  }
}

