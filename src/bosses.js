// ==================== 波次与关卡 ====================
// 暂停感知 + 跨局竞态防护的游戏任务调度器
// 用于所有"流程类"setTimeout（波次切换、Boss生成、关卡切换等）
// 1. 暂停期间推迟执行（每100ms重试，恢复后自动触发）
// 2. 跨局竞态防护：startGame/startBossTrial/gameOver 时 _runToken++，
//    旧局残留的回调在新局中被静默丢弃，避免误触发（如暂停→退出→快速重开）
// 注意：Boss技能类setTimeout不使用此函数（那些已检查this.alive和gameState）
let _runToken = 0;
function gameTimeout(fn, delay){
  const token=_runToken;
  return setTimeout(()=>{
    if(typeof isPaused!=='undefined' && isPaused){
      // 暂停期间推迟执行（保留原token，恢复后若仍在同一局则触发）
      gameTimeout(fn, 100);
    }else if(_runToken===token){
      // token 匹配才执行：防止上一局残留回调在新局误触发
      fn();
    }
    // token 不匹配：静默丢弃（旧局回调，新局已开始）
  }, delay);
}

// ==================== Boss出场戏剧化系统 ====================
// 出场序列（总时长约2.0秒）：
//   0.0~0.35s  黑屏快速淡入（0→0.82 alpha），屏幕逐渐暗下来
//   0.35~0.50s 屏幕中央出现红色闪电状裂缝 + 短促屏震 + 低频轰鸣
//   0.50~0.95s 黑屏从中央向四周淡出，Boss轮廓（spawnAnim同步）渐显
//   0.95~1.60s Boss名字打字机显示（金色大字，逐字浮现）+ 副标题淡入
//   1.60~2.00s 名字放大并淡出，戏剧化结束，战斗正式开始
// 出场期间 Boss.frozen=true（玩家可移动，Boss不动不攻击），避免出场动画期间被秒杀
let bossIntro={active:false, timer:0, name:'', sub:'', color:'#ff6b6b', isFinalBoss:false, typedChars:0, _crackSeed:0};
function startBossIntro(b, title, sub){
  if(!b)return;
  bossIntro.active=true;
  bossIntro.timer=0;
  bossIntro.name=title||b.name||'BOSS';
  bossIntro.sub=sub||'';
  bossIntro.color=b.color||'#ff6b6b';
  bossIntro.isFinalBoss=!!b.isFinalBoss;
  bossIntro.typedChars=0;
  bossIntro._crackSeed=Math.floor(Math.random()*10000);
  // 出场期间冻结Boss，玩家可继续移动但Boss不攻击（spawnAnim自然结束时同时解冻）
  b.frozen=true; b.frozenTimer=2.0;
  // 出场瞬间静音BGM 0.1s，再让 bossSpawn 号角声穿透出来
  if(typeof playSound==='function')playSound('bossSpawn');
}
function updateBossIntro(dt){
  if(!bossIntro.active)return;
  const prevT=bossIntro.timer;
  bossIntro.timer+=dt;
  // 裂缝出现瞬间触发屏震（仅触发一次，跨过0.35s阈值时）
  if(prevT<0.35 && bossIntro.timer>=0.35){
    if(typeof screenShake!=='undefined')screenShake=Math.max(screenShake,0.6);
  }
  // 名字打字机：0.95s~1.60s 期间逐字显示
  if(bossIntro.timer>=0.95 && bossIntro.timer<=1.65){
    const progress=(bossIntro.timer-0.95)/0.70;
    bossIntro.typedChars=Math.min(bossIntro.name.length, Math.floor(progress*bossIntro.name.length)+1);
  }else if(bossIntro.timer>1.65){
    bossIntro.typedChars=bossIntro.name.length;
  }
  if(bossIntro.timer>=2.0){
    bossIntro.active=false;
  }
}
// 绘制Boss出场戏剧化动画（叠加在所有内容之上）
function drawBossIntro(){
  if(!bossIntro.active)return;
  const t=bossIntro.timer;
  const cx=CONFIG.WIDTH/2, cy=CONFIG.HEIGHT/2;
  // ===== 阶段0~2: 黑屏淡入/淡出 =====
  // 0.00~0.35s: alpha 0→0.82（淡入）
  // 0.35~0.95s: 保持/淡出（裂缝期间保持0.82，0.5s开始淡出到0）
  // 0.95~2.00s: 不再绘制黑屏（让玩家看到Boss本体和名字）
  let blackAlpha=0;
  if(t<0.35){
    blackAlpha=(t/0.35)*0.82;
  }else if(t<0.50){
    blackAlpha=0.82; // 裂缝期间保持
  }else if(t<0.95){
    blackAlpha=0.82*(1-(t-0.50)/0.45); // 淡出
  }
  if(blackAlpha>0.01){
    ctx.save();
    ctx.fillStyle=`rgba(0,0,0,${blackAlpha})`;
    ctx.fillRect(0,0,CONFIG.WIDTH,CONFIG.HEIGHT);
    ctx.restore();
  }
  // ===== 阶段1: 红色闪电裂缝（0.35~0.55s） =====
  if(t>=0.35 && t<0.55){
    const cp=(t-0.35)/0.20; // 0~1
    const crackAlpha=cp<0.5?cp*2:(1-cp)*2; // 中间最亮
    ctx.save();
    ctx.globalAlpha=crackAlpha;
    // 闪电状裂缝：从屏幕中心向8个方向辐射
    const seed=bossIntro._crackSeed;
    const baseColor=bossIntro.isFinalBoss?'255,80,40':'255,60,60';
    for(let i=0;i<8;i++){
      const angle=(i/8)*Math.PI*2+seed*0.001;
      const len=200+((seed+i*137)%180);
      ctx.strokeStyle=`rgba(${baseColor},1)`;
      ctx.lineWidth=3;
      ctx.shadowColor=`rgb(${baseColor})`;
      ctx.shadowBlur=20;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      let x=cx, y=cy;
      const steps=8;
      for(let s=1;s<=steps;s++){
        const sp=s/steps;
        const wobble=((seed+i*53+s*31)%100)/100-0.5;
        const px=cx+Math.cos(angle+wobble*0.3)*len*sp;
        const py=cy+Math.sin(angle+wobble*0.3)*len*sp;
        ctx.lineTo(px,py);
      }
      ctx.stroke();
      // 中心爆点
      ctx.fillStyle=`rgba(255,255,255,${crackAlpha})`;
      ctx.beginPath();ctx.arc(cx,cy,12,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  // ===== 阶段3~4: 名字打字机+副标题（0.95~2.00s） =====
  if(t>=0.95){
    let nameAlpha=1, subAlpha=1, nameScale=1;
    if(t<1.05){
      // 名字刚开始，淡入
      nameAlpha=(t-0.95)/0.10;
    }
    if(t>=1.10){
      // 副标题从1.10s开始淡入
      subAlpha=Math.min(1,(t-1.10)/0.30);
    }
    if(t>=1.65){
      // 整体淡出+放大
      const fp=(t-1.65)/0.35;
      nameAlpha=1-fp;
      subAlpha=1-fp;
      nameScale=1+fp*0.25;
    }
    // 名字打字机显示
    const nameSize=bossIntro.isFinalBoss?76:60;
    const visibleName=bossIntro.name.substring(0, bossIntro.typedChars);
    if(visibleName.length>0){
      ctx.save();
      ctx.globalAlpha=nameAlpha;
      ctx.font=`900 ${nameSize}px STKaiti,KaiTi,serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      // 名字下方光带（金色光晕横线）
      const glowColor=bossIntro.isFinalBoss?'#8b0000':'#ffd700';
      ctx.fillStyle=glowColor;
      ctx.shadowColor=glowColor;
      ctx.shadowBlur=40;
      // 字符逐个绘制（带轻微抖动效果）
      const totalW=ctx.measureText(visibleName).width;
      let charX=cx-totalW/2;
      for(let i=0;i<visibleName.length;i++){
        const ch=visibleName[i];
        const cw=ctx.measureText(ch).width;
        // 最新浮现的字额外放大+震动
        if(i===visibleName.length-1 && bossIntro.typedChars<bossIntro.name.length){
          const popT=(t-0.95-(i/bossIntro.name.length)*0.70);
          if(popT<0.10){
            const pop=1+(0.10-popT)*4;
            ctx.save();
            ctx.translate(charX+cw/2, cy-40);
            ctx.scale(pop*nameScale, pop*nameScale);
            ctx.fillText(ch, 0, 0);
            ctx.restore();
          }else{
            ctx.save();
            ctx.translate(charX+cw/2, cy-40);
            ctx.scale(nameScale, nameScale);
            ctx.fillText(ch, 0, 0);
            ctx.restore();
          }
        }else{
          ctx.save();
          ctx.translate(charX+cw/2, cy-40);
          ctx.scale(nameScale, nameScale);
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        }
        charX+=cw;
      }
      // 名字下方金色光带
      ctx.shadowBlur=20;
      ctx.fillStyle=`rgba(255,215,0,${nameAlpha*0.6})`;
      ctx.fillRect(cx-200, cy-40+nameSize/2+8, 400, 2);
      ctx.restore();
    }
    // 副标题
    if(bossIntro.sub && subAlpha>0.01){
      ctx.save();
      ctx.globalAlpha=subAlpha;
      ctx.font='500 22px STKaiti,KaiTi,serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#d4a017';
      ctx.shadowColor='#d4a017';
      ctx.shadowBlur=12;
      ctx.fillText(bossIntro.sub, cx, cy+30);
      ctx.restore();
    }
  }
}

// ==================== Boss死亡戏剧化系统 ====================
// 死亡序列（约1.6秒，叠加在现有粒子爆炸/慢动作之上）：
//   0.0~0.5s  Boss轮廓急速缩小+变白（白色光晕包裹Boss位置）
//   0.3~0.8s  全屏白闪+垂直金色光柱从Boss位置冲向天空（戏剧化高潮）
//   0.5~1.5s  持续生成金色碎片向外爆裂（金光闪闪的"陨落"感）
//   1.5~1.6s  特效结束（已有粒子/慢动作继续完成）
// 不影响Boss死亡逻辑（onBossDefeated/刑天/超级分支等照常执行），仅作视觉增强
let bossDeathFx={active:false, timer:0, x:0, y:0, size:50, color:'#ff6b6b', name:'', isSuper:false, isFinalBoss:false};
function startBossDeathFx(b){
  if(!b)return;
  bossDeathFx.active=true;
  bossDeathFx.timer=0;
  bossDeathFx.x=b.x;
  bossDeathFx.y=b.y;
  bossDeathFx.size=b.size||50;
  bossDeathFx.color=b.color||'#ff6b6b';
  bossDeathFx.name=b.name||'BOSS';
  bossDeathFx.isSuper=!!b.isSuper;
  bossDeathFx.isFinalBoss=!!b.isFinalBoss;
  // 死亡瞬间生成大量金色碎片粒子（叠加在die()已有粒子之上）
  if(typeof spawnParticles==='function'){
    spawnParticles(b.x, b.y, '#ffd700', 60);
    spawnParticles(b.x, b.y, '#ffffff', 30);
    if(b.isFinalBoss||b.isSuper){
      spawnParticles(b.x, b.y, '#ff6b6b', 40);
    }
  }
}
function updateBossDeathFx(dt){
  if(!bossDeathFx.active)return;
  bossDeathFx.timer+=dt;
  if(bossDeathFx.timer>=1.6){
    bossDeathFx.active=false;
  }
}
function drawBossDeathFx(){
  if(!bossDeathFx.active)return;
  const t=bossDeathFx.timer;
  const df=bossDeathFx;
  // ===== 阶段1: 0~0.5s Boss轮廓缩小+变白 =====
  if(t<0.5){
    const p=t/0.5;
    const scale=1-p*0.6; // 缩小到40%
    const alpha=1-p*0.3;
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(df.x, df.y);
    ctx.scale(scale, scale);
    // 白色光晕包裹
    const grad=ctx.createRadialGradient(0,0,0,0,0,df.size*1.6);
    grad.addColorStop(0,'rgba(255,255,255,0.85)');
    grad.addColorStop(0.5,'rgba(255,215,0,0.55)');
    grad.addColorStop(1,'rgba(255,215,0,0)');
    ctx.fillStyle=grad;
    ctx.beginPath();ctx.arc(0,0,df.size*1.6,0,Math.PI*2);ctx.fill();
    // 白色Boss轮廓
    ctx.fillStyle='rgba(255,255,255,0.75)';
    ctx.beginPath();ctx.arc(0,0,df.size,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  // ===== 阶段2: 0.3~0.8s 全屏白闪+垂直金色光柱 =====
  if(t>=0.3 && t<0.85){
    const p=(t-0.3)/0.55;
    const flashAlpha=p<0.5?p*2:(1-p)*2; // 中间最亮
    // 全屏白闪（仅前0.15秒，避免过度刺眼）
    if(t<0.5){
      ctx.save();
      ctx.fillStyle=`rgba(255,255,255,${flashAlpha*0.35})`;
      ctx.fillRect(0,0,CONFIG.WIDTH,CONFIG.HEIGHT);
      ctx.restore();
    }
    // 垂直金色光柱（从Boss位置冲向天空）
    ctx.save();
    const beamW=df.size*1.8*(1-p*0.2);
    const beamH=CONFIG.HEIGHT*1.3;
    const beamAlpha=flashAlpha*0.85;
    const beamGrad=ctx.createLinearGradient(0, df.y, 0, df.y-beamH);
    beamGrad.addColorStop(0,`rgba(255,255,255,${beamAlpha})`);
    beamGrad.addColorStop(0.25,`rgba(255,215,0,${beamAlpha*0.8})`);
    beamGrad.addColorStop(0.6,`rgba(255,180,40,${beamAlpha*0.4})`);
    beamGrad.addColorStop(1,'rgba(255,215,0,0)');
    ctx.fillStyle=beamGrad;
    ctx.fillRect(df.x-beamW/2, df.y-beamH, beamW, beamH);
    // 光柱底部圆形光晕
    const haloGrad=ctx.createRadialGradient(df.x, df.y, 0, df.x, df.y, df.size*3.2);
    haloGrad.addColorStop(0,`rgba(255,255,255,${beamAlpha})`);
    haloGrad.addColorStop(0.4,`rgba(255,215,0,${beamAlpha*0.6})`);
    haloGrad.addColorStop(1,'rgba(255,215,0,0)');
    ctx.fillStyle=haloGrad;
    ctx.beginPath();ctx.arc(df.x, df.y, df.size*3.2, 0, Math.PI*2);ctx.fill();
    // 光柱中心高亮线
    ctx.fillStyle=`rgba(255,255,255,${beamAlpha*0.9})`;
    ctx.fillRect(df.x-3, df.y-beamH, 6, beamH);
    ctx.restore();
  }
  // ===== 阶段3: 0.5~1.4s 持续生成金色碎片 =====
  if(t>=0.5 && t<1.4){
    if(typeof spawnParticles==='function' && Math.random()<0.55){
      const a=Math.random()*Math.PI*2;
      const r=df.size*0.4;
      spawnParticles(df.x+Math.cos(a)*r, df.y+Math.sin(a)*r, '#ffd700', 3);
    }
  }
}
function getWaveEnemyCount(wave){return Math.ceil((8+wave*4+Math.floor(wave/2)*3)*getDifficulty().enemyCountMul);}
function getWaveEnemyTypes(wave){
  const t=['grunt']; if(wave>=2)t.push('runner'); if(wave>=3)t.push('tank','spiky'); if(wave>=4)t.push('shooter','invincible'); if(wave>=5)t.push('giant','bomber');
  if(wave>=7)t.push('taunt');
  // 弑神难度额外加入分裂怪
  if(saveData.difficulty==='godslayer'&&wave>=4)t.push('splitter');
  return t;
}
function spawnWaveEnemy(){
  const wave=currentWave+(currentLevel-1)*5;
  const types=getWaveEnemyTypes(wave);
  const w={grunt:35,runner:20,spiky:12,tank:10,shooter:8,giant:3,invincible:7,bomber:8,taunt:4,splitter:5};
  const avail=types.filter(t=>w[t]); if(avail.length===0)return; let tw=avail.reduce((s,t)=>s+w[t],0); let r=Math.random()*tw; let sel=avail[0];
  for(const t of avail){r-=w[t];if(r<=0){sel=t;break;}}
  const waveBonus=currentWave-1+(currentLevel-1)*5;
  const e=new Enemy(sel,waveBonus);
  // 无尽模式：怪物按无尽波次增强（每波HP+15%、速度+2%）
  if(endlessMode&&endlessWave>0){
    const em=1+endlessWave*0.15; const sm=1+endlessWave*0.02;
    e.maxHealth=Math.ceil(e.maxHealth*em); e.health=e.maxHealth;
    e.speed*=sm; e.baseSpeed*=sm;
    e._endlessBuff=true;
  }
  enemies.push(e);
}
function startWave(){
  gameState='fighting';
  let te=getWaveEnemyCount(currentWave+(currentLevel-1)*5);
  // 无尽模式：每波多2只怪
  if(endlessMode&&endlessWave>0){te+=endlessWave*2;}
  enemiesToSpawn=te; enemiesRemaining=te; spawnTimer=0.5;
  maxLevelTime=CONFIG.LEVEL_TIME; levelTimer=maxLevelTime;
  updateUI();
}
function checkWaveComplete(){
  if(gameState!=='fighting')return;
  if(enemiesRemaining<=0&&enemiesToSpawn<=0&&enemies.every(e=>!e.alive)){
    // 经验值模式：不再每波自动触发升级，升级由经验值满触发
    // 直接进入下一波或Boss
    if(currentWave>=CONFIG.WAVES_PER_LEVEL){
      startBoss();
    }else{
      // 进入下一波（不触发升级面板）
      currentWave++;
      showWaveAnnounce(`第 ${currentWave} 波`,'准备战斗！');
      enemies=[];enemyBullets=[];bullets=[];minions=minions.filter(m=>m.permanent&&m.alive);fireEffects=[];lightningStrikes=[];tornadoes=[];
      // 注意：不清空 drops，让玩家拾取遗留的经验球
      gameState='wavePrepare';
      gameTimeout(()=>{if(gameState!=='wavePrepare')return;startWave();},1500);
    }
  }
}
function startBoss(){
  gameState='boss'; enemies=[]; enemyBullets=[]; minions=minions.filter(m=>m.permanent&&m.alive);
  // 按需加载当前Boss图片
  loadBossImagesForIdx(currentLevel);
  bossWarnings=[]; boss=new Boss(currentLevel);
  // Boss变异：10%概率遇到变异Boss，技能组合不同，掉落更好
  if(!endlessMode&&Math.random()<0.10){
    applyBossVariant(boss);
    bossVariant=true;
  }else{
    bossVariant=false;
  }
  // 弑神难度双Boss：设置剩余Boss数
  const diff=getDifficulty();
  godslayerBossesLeft=diff.bossCount-1;
  bossHealthBar.classList.remove('hidden');
  document.body.classList.add('boss-active'); // 通知 CSS 精简中间 panel，避免与 Boss 血条重叠
  bossName.style.color=''; // 重置颜色（刑天用红色，需清空）
  bossName.textContent=bossVariant?`变异BOSS - ${boss.name}`:`BOSS - ${boss.name}`;
  playBossSound(boss.bossIdx); // Boss专属音效
  const petDef=getPetDef(boss.bossIndex);
  updateBossUI();
  // 出场戏剧化动画（黑屏→裂缝→名字打字机），1.8秒后显示waveAnnounce
  startBossIntro(boss, boss.name, petDef?('⚡'+petDef.desc):'');
  gameTimeout(()=>{
    if(gameState!=='boss')return;
    showWaveAnnounce(bossVariant?'⚠️ 变异Boss!':'BOSS战！',`${boss.name} 出现了！${bossVariant?'\n🔥 变异体：技能混搭，掉落更佳！':''}${petDef?'\n⚡'+petDef.desc:''}`,true);
  }, 1900);
  maxLevelTime=CONFIG.BOSS_TIME; levelTimer=maxLevelTime;
  // 启动时间挑战
  startTimeChallenge();
}
// 应用Boss变异：血量+50%，攻速+30%，借用其他Boss的技能
function applyBossVariant(b){
  b.isVariant=true;
  b.maxHealth=Math.ceil(b.maxHealth*1.5); b.health=b.maxHealth;
  b.speed*=1.3;
  // 攻速+30%（缩短攻击和技能冷却）
  b.specialCooldown=Math.max(1, b.specialCooldown*0.7);
  b.special2Cooldown=Math.max(1, b.special2Cooldown*0.7);
  if(b.attackTimer)b.attackTimer*=0.7;
  // 借用其他Boss的special技能（混搭）
  const otherBosses=BOSS_TYPES.filter(x=>x.idx!==b.bossIndex&&!x.isSuper);
  if(otherBosses.length>0){
    const stolen=otherBosses[Math.floor(Math.random()*otherBosses.length)];
    b._variantSpecial=stolen.special;
    b._variantSpecial2=stolen.special2;
    b._variantName=stolen.name;
  }
  // 变异光晕颜色
  b.color='#ff00ff';
}
// 时间挑战：限时击杀Boss获得额外奖励
function startTimeChallenge(){
  if(bossTrialMode||endlessMode){bossTimeChallenge=null;return;}
  // 时间挑战：30秒内+500分，50秒内+200分（maxTime=50 保证50秒内击杀时active仍为true）
  bossTimeChallenge={time:50, maxTime:50, active:true, reward:0};
}
// 生成超级Boss复仇
function spawnSuperBoss(){
  gameState='boss'; enemies=[]; enemyBullets=[];
  // 清理残留的子弹/特效/掉落，避免上一波残留白嫖新Boss伤害或造成视觉污染
  bullets=[]; drops=[]; fireEffects=[]; lightningStrikes=[]; tornadoes=[];
  minions=minions.filter(m=>m.permanent&&m.alive);
  bossWarnings=[]; boss=new Boss(currentLevel,true);
  bossHealthBar.classList.remove('hidden');
  document.body.classList.add('boss-active'); // 通知 CSS 精简中间 panel，避免与 Boss 血条重叠 bossName.style.color=''; bossName.textContent=`超级BOSS - ${boss.name}`;
  const petDef=getPetDef(boss.bossIndex);
  updateBossUI();
  // 超级Boss出场戏剧化动画
  startBossIntro(boss, boss.name, petDef?('⚡'+petDef.desc):'');
  gameTimeout(()=>{
    if(gameState!=='boss')return;
    showWaveAnnounce('超级Boss复仇！',`${boss.name} 降临！${petDef?'\n⚡'+petDef.desc:''}`,true);
  }, 1900);
  maxLevelTime=CONFIG.BOSS_TIME*1.5; levelTimer=maxLevelTime;
}
// ===== 刑天最终Boss触发 =====
function showFinalBossPrompt(){
  // 暂停游戏，防止弹窗被Boss出场覆盖
  gameState='upgrade'; // 临时切换到upgrade状态暂停游戏循环
  // 第5关强制刑天：UI提示"通关之战"，decline按钮改为"进入无尽模式"
  const isLevel5Force = _level5FinalBossDone && !bossTrialMode && !resumeTrialAfterFinalBoss;
  const ov=document.getElementById('overlay');
  ov.classList.remove('hidden');
  ov.innerHTML=`
    <div style="text-align:center;max-width:500px;margin:auto">
      <h2 style="color:#8b0000;font-size:28px;text-shadow:0 0 20px #8b0000">${isLevel5Force?'⚔️ 通关之战 · 最终Boss':'⚔️ 最终Boss降临'}</h2>
      <p style="color:#c9d1d9;font-size:15px;margin:16px 0;line-height:1.8">
        ${isLevel5Force?'你已击败五大异兽，征服山海！<br>':''}大地震颤，战意冲天...<br>
        <span style="color:#ff6347;font-size:18px;font-weight:bold">刑天</span>，无头战神，感知到了你的气息。<br>
        「<span style="color:#bc8cff">吾虽无首，战意不灭！来战！</span>」<br><br>
        <span style="color:#8b949e;font-size:13px">刑天为最终Boss，拥有多阶段机制，难度极高。<br>击败后掉落山海故事书与专属武器。${isLevel5Force?'<br>或跳过刑天，直接进入无尽模式挑战':''}</span>
      </p>
      <div style="display:flex;gap:12px;justify-content:center;margin-top:20px">
        <button class="main-btn" id="acceptFinalBoss" style="background:linear-gradient(135deg,#8b0000,#ff4500);font-size:16px;padding:10px 30px">⚔️ 挑战刑天</button>
        <button class="sec-btn" id="declineFinalBoss" style="font-size:14px;padding:10px 24px">${isLevel5Force?'♾️ 进入无尽':'放弃'}</button>
      </div>
    </div>
  `;
  // 同时绑定 click 和 touchstart（带 preventDefault），避免移动端全局 touchend 监听器
  // 在 300ms 内连续触摸时 preventDefault 导致 click 不触发
  const acceptFinalBossBtn=document.getElementById('acceptFinalBoss');
  const declineFinalBossBtn=document.getElementById('declineFinalBoss');
  const declineFinalBossAction=()=>{
    pendingFinalBoss=false;
    pendingSuperRevenge=false; // 清除超级复仇标记（与 startFinalBoss 保持一致，避免泄漏到下一只Boss）
    ov.classList.add('hidden');
    gameState='boss'; // 恢复游戏状态
    // 若从试炼触发，放弃刑天后继续试炼流程
    if(resumeTrialAfterFinalBoss||bossTrialMode){
      // 试炼模式：放弃刑天后继续试炼流程（不调用 onBossDefeated，避免误入正常关卡流程）
      // 注意：bossTrialIndex 不再递增 — 普通Boss击败时已递增过，超级复仇Boss和刑天都是额外的
      // 之前这里递增会导致跳关（漏打一只试炼Boss）
      resumeTrialAfterFinalBoss=false;
      if(bossTrialIndex<trialBossOrder.length){
        gameTimeout(()=>{if(gameState!=='boss')return;spawnTrialBoss();},1500);
      }else{
        bossTrialMode=false; gameOver();
      }
    }else if(isLevel5Force){
      // 冒险5关后放弃刑天：直接进入无尽模式（不进入第6关）
      endlessMode=true; endlessWave=0;
      currentLevel=8; currentWave=1;
      bullets=[]; enemies=[]; enemyBullets=[]; drops=[];
      fireEffects=[]; lightningStrikes=[]; tornadoes=[];
      minions=minions.filter(m=>m.permanent&&m.alive);
      floatingTexts=[]; bossWarnings=[];
      if(boss)boss.alive=false; boss=null;
      showWaveAnnounce('♾️ 无尽模式','挑战无限波次！',true);
      gameTimeout(()=>{if(gameState!=='upgrade'&&gameState!=='wavePrepare')return;enterEndlessWave();},1500);
    }else{
      // 冒险模式（RNG触发）：继续正常流程
      onBossDefeated({isFinalBoss:false,isSuper:true});
    }
  };
  acceptFinalBossBtn.addEventListener('click',e=>{ if(typeof _isSynthesizedClick==='function'&&_isSynthesizedClick())return; startFinalBoss(); });
  acceptFinalBossBtn.addEventListener('touchstart',e=>{e.preventDefault();startFinalBoss();},{passive:false});
  declineFinalBossBtn.addEventListener('click',e=>{ if(typeof _isSynthesizedClick==='function'&&_isSynthesizedClick())return; declineFinalBossAction(); });
  declineFinalBossBtn.addEventListener('touchstart',e=>{e.preventDefault();declineFinalBossAction();},{passive:false});
}
function startFinalBoss(){
  pendingFinalBoss=false;
  pendingSuperRevenge=false; // 清除超级复仇标记，避免刑天死亡后流程错乱
  bossVariant=false; // 重置变异标记（与 startEndlessBoss 保持一致，避免上一只变异Boss的状态泄漏到刑天战）
  gameState='boss'; enemies=[]; enemyBullets=[]; bossWarnings=[];
  bullets=[]; resetParticles(); drops=[]; minions=minions.filter(m=>m.permanent&&m.alive); fireEffects=[];
  lightningStrikes=[]; tornadoes=[]; // 补清：前一Boss（如计蒙/穷奇）残留的闪电/龙卷不能带入刑天战
  // 按需加载刑天专用图片
  loadXingtianImages();
  // 创建刑天Boss
  boss=new Boss(currentLevel,true,9);
  boss.isFinalBoss=true;
  // 刑天血量：超级Boss基础 × 难度倍率 × 试炼倍率（若在试炼中）× 最终Boss加成
  const trialMul=(bossTrialMode||resumeTrialAfterFinalBoss)?getDifficulty().bossTrialHpMul:1;
  boss.maxHealth=Math.ceil(boss.maxHealth*3.0*trialMul); // 最终Boss血量3倍加成
  boss.health=boss.maxHealth;
  boss.name='刑天';
  boss.size=82+currentLevel*4; // 比普通Boss更大
  boss.armor=Math.max(boss.armor||0,0.15); // 刑天有基础护甲
  document.getElementById('overlay').classList.add('hidden');
  bossHealthBar.classList.remove('hidden');
  document.body.classList.add('boss-active'); // 通知 CSS 精简中间 panel，避免与 Boss 血条重叠
  bossName.textContent='⚔️ 最终Boss - 刑天';
  bossName.style.color='#8b0000';
  playBossSound(9);
  updateBossUI();
  // 刑天专属出场戏剧化动画（红色调）
  startBossIntro(boss, '刑天', '无头战神 · 战意不灭');
  gameTimeout(()=>{
    if(gameState!=='boss')return;
    showWaveAnnounce('最终Boss！','刑天 — 无头战神降临！',true);
    showToast('⚔️ 最终Boss刑天降临！','#8b0000',3000);
  }, 1900);
  maxLevelTime=CONFIG.BOSS_TIME*2.5; levelTimer=maxLevelTime; // 刑天给更多时间
}
// ===== 刑天击败后胜利结算 =====
function showFinalBossVictory(gotNewWeapon){
  gameState='upgrade'; // 暂停游戏
  const ov=document.getElementById('overlay');
  ov.classList.remove('hidden');
  ov.innerHTML=`
    <div style="text-align:center;max-width:560px;margin:auto">
      <h2 style="font-size:32px;color:#ffd700;text-shadow:0 0 25px rgba(255,215,0,0.6);margin-bottom:8px">🏆 胜利！</h2>
      <p style="color:#ff6347;font-size:18px;margin:8px 0 20px">刑天已陨落，战意长存！</p>
      <div style="background:rgba(13,10,5,0.85);border:1px solid rgba(255,215,0,0.3);border-radius:12px;padding:20px;margin:16px 0;line-height:2;text-align:left">
        <div style="color:#ffd700;font-size:15px;text-align:center;margin-bottom:12px">—— 战利品 ——</div>
        <div style="color:#d4c5a0">📖 <b style="color:#ffd700">山海故事</b> — 已解锁，可在主菜单阅读</div>
        ${gotNewWeapon?'<div style="color:#d4c5a0;margin-top:8px">⚔️ <b style="color:#8b0000">刑天干戚</b> — 专属武器已获得！</div>':'<div style="color:#8b949e;margin-top:8px">⚔️ 刑天干戚 — 已拥有</div>'}
        <div style="color:#d4c5a0;margin-top:8px">⭐ 获得分数：${score}</div>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;flex-wrap:wrap">
        <button class="main-btn" id="victoryReadBook" style="background:linear-gradient(135deg,#daa520,#ff8c00);font-size:15px;padding:10px 24px">📖 阅读山海故事</button>
        <button class="main-btn" id="victoryEndless" style="background:linear-gradient(135deg,#58a6ff,#1f6feb);font-size:15px;padding:10px 24px">♾️ 继续无尽挑战</button>
        <button class="sec-btn" id="victoryHome" style="font-size:14px;padding:10px 24px">🏠 返回主菜单</button>
      </div>
    </div>
  `;
  _bindTap(document.getElementById('victoryReadBook'),()=>{
    showShanHaiBook(true); // 读完书后回到胜利结算
  });
  _bindTap(document.getElementById('victoryEndless'),()=>{
    ov.classList.add('hidden');
    _runToken++; // 丢弃刑天战残留的 gameTimeout 回调，避免污染无尽第1波
    // 进入无尽模式（必须清理刑天战残留的子弹/特效/状态，否则会污染无尽第1波）
    endlessMode=true; endlessWave=0;
    gameState='wavePrepare';
    currentLevel=8; currentWave=1;
    pendingFinalBoss=false; pendingSuperRevenge=false;
    // 清理刑天战残留
    bullets=[]; enemies=[]; enemyBullets=[]; drops=[];
    fireEffects=[]; lightningStrikes=[]; tornadoes=[];
    minions=minions.filter(m=>m.permanent&&m.alive);
    floatingTexts=[]; bossWarnings=[];
    if(boss)boss.alive=false; boss=null;
    screenShake=0; if(typeof screenFlash!=='undefined')screenFlash=0;
    if(typeof slowMotion!=='undefined'){slowMotion.active=false; slowMotion.timer=0;}
    if(typeof lowHpWarning!=='undefined'){lowHpWarning.active=false; lowHpWarning.pulseTimer=0; lowHpWarning.heartbeatTimer=0;}
    showWaveAnnounce('♾️ 无尽模式','挑战无限波次！',true);
    gameTimeout(()=>{if(gameState!=='upgrade'&&gameState!=='wavePrepare')return;enterEndlessWave();},1500);
  });
  _bindTap(document.getElementById('victoryHome'),()=>{
    ov.classList.add('hidden');
    gameOver();
  });
}
// ===== 山海故事书阅读 =====
function showShanHaiBook(fromVictory=false){
  const ov=document.getElementById('overlay');
  ov.classList.remove('hidden');
  ov.innerHTML=`
    <div style="max-width:600px;margin:auto;text-align:left;font-family:STKaiti,KaiTi,serif">
      <h2 style="text-align:center;color:#ffd700;font-size:26px;text-shadow:0 0 15px rgba(255,215,0,0.5)">📖 山海故事</h2>
      <div style="background:rgba(13,10,5,0.85);border:1px solid rgba(255,215,0,0.3);border-radius:12px;padding:24px;margin-top:16px;line-height:2;font-size:14px;color:#d4c5a0;max-height:60vh;overflow-y:auto">
        <p style="color:#ffd700;font-size:16px;text-align:center;margin-bottom:16px">—— 天地初开，山海未分 ——</p>
        <p>远古之时，天地混沌，山海相连。天帝命 <b style="color:#ffd700">刑天</b> 为战神，掌管天地万兽。刑天手持 <b style="color:#8b0000">干戚</b>，以战止战，维护山海秩序。</p>
        <p style="margin-top:12px">然天帝驾崩，诸兽失去管束。<b style="color:#ff69b4">九尾狐</b> 以魅惑祸乱人间，<b style="color:#ff4500">毕方</b> 引烈火焚烧山林，<b style="color:#7cfc00">相柳</b> 九头吐毒污浊大地，<b style="color:#daa520">朱厌</b> 巨猿践踏城池。</p>
        <p style="margin-top:12px">更有超级异兽：<b style="color:#ff6347">烛龙</b> 吞吐熔岩照亮幽冥，<b style="color:#4b0082">饕餮</b> 张开巨口吞噬万物，<b style="color:#6a0dad">穷奇</b> 撕裂维度制造混沌。山海大乱，生灵涂炭。</p>
        <p style="margin-top:12px">刑天见状，怒而战之。然独木难支，刑天被诸兽围攻，<b style="color:#f85149">首级被斩</b>。刑天不甘，以乳为目，以脐为口，手持干戚继续战斗——「<b style="color:#8b0000">刑天舞干戚，猛志固常在</b>」。</p>
        <p style="margin-top:12px">刑天力竭倒下，干戚落入人间。天帝遗诏曰：「<b style="color:#ffd700">得干戚者，可号令山海</b>」。</p>
        <p style="margin-top:12px">你，一名流浪的 <b style="color:#58a6ff">山海猎人</b>，在废墟中发现了刑天遗留的干戚。你握住它的那一刻，感受到了刑天不灭的战意...</p>
        <p style="margin-top:12px;color:#ffd700;text-align:center;font-size:15px">「山海异兽为何要挨揍？因为它们祸乱人间。」</p>
        <p style="color:#ffd700;text-align:center;font-size:15px">「为何要揍你？因为你手握干戚，它们畏惧你。」</p>
        <p style="margin-top:12px;color:#8b949e;text-align:center;font-size:13px">从此，你踏上山海之旅，痛揍异兽，还山海以太平。</p>
        <p style="margin-top:16px;text-align:center;color:#ffd700">—— 你的故事，才刚刚开始 ——</p>
      </div>
      <div style="text-align:center;margin-top:16px">
        <button class="sec-btn" id="closeBook" style="font-size:14px;padding:8px 24px">合上书卷</button>
      </div>
    </div>
  `;
  _bindTap(document.getElementById('closeBook'),()=>{
    ov.classList.add('hidden');
    if(fromVictory){
      // 返回胜利结算
      showFinalBossVictory(false);
    }else{
      showMainMenu();
    }
  });
}
// Boss试炼模式：直接挑战Boss
function startBossTrial(){
  _runToken++; // 跨局竞态防护：丢弃上一局残留的 gameTimeout 回调
  // 清空摇杆/触摸/按键状态：同 startGame，防止上一局残留输入带入试炼
  if(typeof resetTouchState==='function')resetTouchState();
  if(typeof _pushGameState==='function')_pushGameState(); // Android 后退键保护
  initAudio(); // 确保音频已初始化
  startBGM('trial'); // 启动试炼激昂BGM
  // 预加载所有Boss图片：避免试炼Boss战开始时图片未加载完显示fallback圆形
  if(typeof loadAllBossImages==='function')loadAllBossImages();
  // 清理可能残留的死亡动画定时器（防御性）
  if(typeof deathTimeout!=='undefined'&&deathTimeout){clearTimeout(deathTimeout); deathTimeout=null;}
  if(typeof deathAnimation!=='undefined')deathAnimation=null;
  gameState='wavePrepare'; score=0; gameTime=0; currentWave=1; currentLevel=1;
  // 清理旧Boss状态：防止二阶段setTimeout在新一局执行（玩家死亡时Boss可能还alive）
  if(boss)boss.alive=false;
  enemiesRemaining=0; enemiesToSpawn=0; spawnTimer=0; boss=null; bossWarnings=[];
  globalSlow=1; globalSlowTimer=0; bossHpMul=1; revivesUsed=0;
  comboCount=0; comboTimer=0; comboMax=0; // 重置连击
  bossTrialMode=true; bossTrialIndex=0; pendingSuperRevenge=false; godslayerBossesLeft=0;
  _lastRunWasTrial=true; // 标记本局是试炼模式，供 gameOver 结算使用
  // 重置新增系统状态，避免从无尽模式带入遗物等
  endlessMode=false; endlessWave=0; activeRelics=[]; bossTimeChallenge=null; bossVariant=false; pendingEndlessNext=false;
  pendingFinalBoss=false; // 重置刑天触发标记
  resumeTrialAfterFinalBoss=false;
  trialXingtianTriggered=false; // 重置试炼刑天触发标记（每次试炼最多触发一次刑天）
  _level5FinalBossDone=false; // 重置冒险5关强制刑天标记
  // 死亡复盘：重置本局统计
  resetRunStats();
  // 重置升级流程标记，防止上一局普通模式遗留的 pendingProceedNext 在试炼升级后错误触发 proceedToNextLevel
  pendingProceedNext=false; pendingTrialNext=false; prevGameState='boss';
  adventureEnemyTimer=999999; // 试炼模式不生成奇遇小怪
  bullets=[]; enemies=[]; enemyBullets=[]; resetParticles(); floatingTexts=[]; drops=[]; minions=[];
  fireEffects=[]; lightningStrikes=[]; tornadoes=[]; pets=[];
  // 重置视觉/慢动作状态（同startGame，防止上一局残留）
  if(typeof screenShake!=='undefined')screenShake=0;
  if(typeof screenFlash!=='undefined')screenFlash=0;
  if(typeof slowMotion!=='undefined'){slowMotion.active=false; slowMotion.timer=0;}
  if(typeof lowHpWarning!=='undefined'){lowHpWarning.active=false; lowHpWarning.pulseTimer=0; lowHpWarning.heartbeatTimer=0;}
  if(typeof pendingBossCapture!=='undefined')pendingBossCapture=false;
  if(typeof adventureEnemies!=='undefined')adventureEnemies=[];
  // 随机打乱4个普通Boss顺序，最后追加2个超级Boss
  trialBossOrder=shuffle([0,1,2,3,6,7]);
  trialBossOrder.push(4,5,8);
  player=new Player();
  // 加载宠物
  if(saveData.selectedPet!==null&&saveData.ownedPets[saveData.selectedPet]){
    const pd=saveData.ownedPets[saveData.selectedPet]; const def=getPetDef(pd.def);
    if(def){const pet=new Pet(def,pd.stage); pets.push(pet);}
  }
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('bossHealthBar').classList.add('hidden');
  document.getElementById('upgradeOverlay').classList.add('hidden');
  // 直接生成第一个Boss
  spawnTrialBoss();
  updateUI();
}
// 生成试炼Boss
function spawnTrialBoss(){
  gameState='boss'; enemies=[]; enemyBullets=[];
  // 清理残留的子弹/特效/掉落，避免上一只Boss的残留物影响下一只
  bullets=[]; drops=[]; fireEffects=[]; lightningStrikes=[]; tornadoes=[];
  minions=minions.filter(m=>m.permanent&&m.alive);
  bossWarnings=[];
  const idx=trialBossOrder[bossTrialIndex]??0;
  // 按需加载试炼Boss图片
  loadBossImagesForIdx(idx);
  if(idx<4||idx===6||idx===7){
    boss=new Boss(currentLevel,false);
    boss.bossIndex=idx; boss.bossType=BOSS_TYPES[idx];
    boss.name=boss.bossType.name; boss.color=boss.bossType.color;
  }else{
    // 超级Boss
    boss=new Boss(currentLevel,true,idx);
  }
  // 试炼Boss血量按难度额外加成（弑神可达4倍）
  const trialMul=getDifficulty().bossTrialHpMul;
  if(trialMul&&trialMul>1){
    boss.maxHealth=Math.ceil(boss.maxHealth*trialMul);
    boss.health=boss.maxHealth;
  }
  // 试炼Boss随波次增强攻速
  boss._trialIndex=bossTrialIndex;
  bossHealthBar.classList.remove('hidden');
  document.body.classList.add('boss-active'); // 通知 CSS 精简中间 panel，避免与 Boss 血条重叠 bossName.style.color=''; bossName.textContent=`试炼 ${bossTrialIndex+1}/${trialBossOrder.length} - ${boss.name}`;
  playSound('bossSpawn'); // 试炼Boss出场号角声
  playBossSound(boss.bossIndex); // Boss专属音效
  updateBossUI(); showWaveAnnounce('Boss试炼！',`${boss.name} 出现了！`,true);
  maxLevelTime=CONFIG.BOSS_TIME*1.5; levelTimer=maxLevelTime;
}
function onBossDefeated(defeatedBoss){
  // 刑天被击败后：若之前从试炼触发，继续试炼流程
  if(defeatedBoss&&defeatedBoss.isFinalBoss&&resumeTrialAfterFinalBoss){
    resumeTrialAfterFinalBoss=false;
    // 试炼模式：刑天结束后给经验奖励，然后继续下一个试炼Boss
    if(player){
      const trialXp=100; // 刑天给100经验
      // 经验球掉落（每颗5xp，6颗共30xp；剩余70xp直接给玩家）
      const xpPerOrb=5;
      for(let i=0;i<6;i++){
        const dx=(Math.random()-0.5)*60, dy=(Math.random()-0.5)*60;
        drops.push(new Drop((defeatedBoss.x||CONFIG.WIDTH/2)+dx,(defeatedBoss.y||CONFIG.HEIGHT/2)+dy,'xp',xpPerOrb));
      }
      const beforeLv=player.xpLevel;
      player.gainXp(trialXp-6*xpPerOrb); // 直接给剩余经验
      // 如果触发了升级，等选完强化后再继续试炼流程
      if(player.xpLevel>beforeLv){
        // 刑天是额外的Boss（由超级复仇触发），不应再递增 bossTrialIndex
        // 用 _lastTrialWasSuperRevenge=true 让 applyUpgrade 走非递增分支
        player._lastTrialWasSuperRevenge=true;
        pendingTrialNext=true;
        return;
      }
    }
    // 没触发升级：直接继续试炼流程
    // 注意：bossTrialIndex 不再递增 — 普通Boss击败时已递增过，超级复仇Boss和刑天都是额外的
    // 之前这里递增会导致跳关（漏打一只试炼Boss）
    if(bossTrialIndex<trialBossOrder.length){
      gameTimeout(()=>{if(gameState!=='boss')return;spawnTrialBoss();},2000);
    }else{
      bossTrialMode=false; gameOver();
    }
    return;
  }
  // 时间挑战结算：在Boss击败时立即判定
  if(bossTimeChallenge&&bossTimeChallenge.active){
    const elapsed=bossTimeChallenge.maxTime-bossTimeChallenge.time;
    if(elapsed<=30){
      // 30秒内击杀：额外500分
      score+=500;
      pushFloatingText(player.x,player.y-50,'⚡ 时间挑战! +500','#ffd700',2);
      showWaveAnnounce('⚡ 时间挑战达成！','+500分奖励！',true);
    }else if(elapsed<=50){
      // 50秒内击杀：额外200分
      score+=200;
      pushFloatingText(player.x,player.y-50,'⚡ 时间挑战! +200','#f0883e',2);
    }
    bossTimeChallenge.active=false;
  }
  // 变异Boss额外奖励：+300分
  if(defeatedBoss&&defeatedBoss.isVariant){
    score+=300;
    pushFloatingText(defeatedBoss.x,defeatedBoss.y-60,'🔥 变异奖励! +300','#ff00ff',2);
  }
  // 经验值奖励：Boss击杀给大量经验（普通50/超级100/刑天200）
  const bossXpReward=defeatedBoss?.isFinalBoss?200:(defeatedBoss?.isSuper?100:50);
  // 无尽模式：无尽Boss被击败后直接进入下一波（不走普通关卡流程，不触发超级复仇）
  if(endlessMode&&defeatedBoss&&defeatedBoss._endlessWave){
    // 玩家恢复一些生命与护盾作为奖励
    if(player){
      const heal=Math.ceil(player.maxHealth*0.15);
      player.health=Math.min(player.maxHealth,player.health+heal);
      if(player.shieldRegen)player.shield=Math.min(player.shield+player.shieldRegen,player.maxShield);
      pushFloatingText(player.x,player.y-30,`+${heal} HP`,'#3fb950',1.5);
    }
    // 经验值奖励（如果满了会触发升级面板）
    const beforeLv=player?player.xpLevel:0;
    if(player)player.gainXp(bossXpReward);
    // 如果触发了升级，等选完强化再进入下一波无尽
    if(player&&player.xpLevel>beforeLv){
      pendingEndlessNext=true;
      return;
    }
    // 安全网：升级面板显示时延迟进入下一波，避免流程冲突
    if(gameState==='upgrade'){
      pendingEndlessNext=true;
      return;
    }
    // 没升级，直接进入下一波无尽
    enterEndlessWave();
    return;
  }
  // Boss试炼模式
  if(bossTrialMode){
    // 试炼Boss击杀给经验球掉落（让玩家拾取，体验更好）
    if(defeatedBoss&&player){
      const trialXp=defeatedBoss.isSuper?100:50;
      // 经验球掉落（每颗5xp，6颗共30xp；剩余直接给玩家）
      const xpPerOrb=5;
      for(let i=0;i<6;i++){
        const dx=(Math.random()-0.5)*60, dy=(Math.random()-0.5)*60;
        drops.push(new Drop(defeatedBoss.x+dx,defeatedBoss.y+dy,'xp',xpPerOrb));
      }
      // 直接给一部分经验（立即升级反馈）
      const beforeLv=player.xpLevel;
      player.gainXp(trialXp-6*xpPerOrb);
      // 如果触发了升级，等选完强化后再继续下一个试炼Boss
      if(player.xpLevel>beforeLv){
        // 标记：升级面板关闭后继续试炼流程（由 applyUpgrade 处理）
        // 记录是否为超级Boss复仇状态，applyUpgrade 据此决定是否递增索引
        player._lastTrialWasSuperRevenge=!!(defeatedBoss&&defeatedBoss.isSuper&&pendingSuperRevenge);
        if(player._lastTrialWasSuperRevenge)pendingSuperRevenge=false;
        pendingTrialNext=true;
        return;
      }
    }
    // 安全网：如果升级面板正在显示（玩家在试炼Boss战中拾取经验触发了升级，同时Boss被击杀），
    // 延迟试炼流程到选完强化后，避免setTimeout在upgrade状态时误返回导致卡关
    if(gameState==='upgrade'){
      if(player){
        player._lastTrialWasSuperRevenge=!!(defeatedBoss&&defeatedBoss.isSuper&&pendingSuperRevenge);
        if(player._lastTrialWasSuperRevenge)pendingSuperRevenge=false;
      }
      pendingTrialNext=true;
      return;
    }
    // 超级Boss复仇被击败：不增加索引，继续下一个试炼Boss
    if(defeatedBoss&&defeatedBoss.isSuper&&pendingSuperRevenge){
      pendingSuperRevenge=false;
      if(bossTrialIndex<trialBossOrder.length){
        gameTimeout(()=>{if(gameState!=='boss')return;spawnTrialBoss();},1500);
      }else{
        bossTrialMode=false; gameOver();
      }
      return;
    }
    bossTrialIndex++;
    if(bossTrialIndex<trialBossOrder.length){
      // 30%几率超级Boss复仇（在试炼中）
      if(!defeatedBoss.isSuper&&Math.random()<0.3){
        pendingSuperRevenge=true;
        gameTimeout(()=>{
          if(gameState!=='boss')return;
          spawnSuperBoss();
        },1500);
        return;
      }
      gameTimeout(()=>{
        if(gameState!=='boss')return;
        spawnTrialBoss();
      },1500);
      return;
    }else{
      // 试炼结束，进入结算
      bossTrialMode=false;
      gameOver();
      return;
    }
  }
  // 超级Boss复仇：复仇Boss被击败后给经验并进入下一关
  if(defeatedBoss&&defeatedBoss.isSuper&&pendingSuperRevenge){
    pendingSuperRevenge=false;
    // 经验值奖励
    const beforeLv=player?player.xpLevel:0;
    if(player)player.gainXp(bossXpReward);
    if(player&&player.xpLevel>beforeLv){
      pendingProceedNext=true;
      return;
    }
    // 安全网：升级面板显示时延迟进入下一关，避免跳关
    if(gameState==='upgrade'){
      pendingProceedNext=true;
      return;
    }
    proceedToNextLevel();
    return;
  }
  // 弑神难度：双Boss，第一个死后立即出现第二个
  if(godslayerBossesLeft>0){
    godslayerBossesLeft--;
    // 记录升级前等级，用于判断是否触发升级面板（升级会切gameState到'upgrade'导致setTimeout守卫失败）
    const beforeLv=player?player.xpLevel:0;
    if(player)player.gainXp(bossXpReward);
    const willLevelUp=player&&player.xpLevel>beforeLv;
    gameTimeout(()=>{
      // 即使触发了升级面板（gameState='upgrade'）也要生成第二只Boss，
      // 玩家选完强化后applyUpgrade会恢复到'boss'状态
      if(gameState!=='boss'&&gameState!=='upgrade')return;
      gameState='boss'; enemies=[]; enemyBullets=[];
      bossWarnings=[]; boss=new Boss(currentLevel,false);
      // 第二个Boss用不同类型（6个普通Boss循环）
      const normalBosses2=[0,1,2,3,6,7];
      boss.bossIndex=normalBosses2[(((currentLevel-1)+1)%normalBosses2.length)]; boss.bossType=BOSS_TYPES[boss.bossIndex];
      boss.name=boss.bossType.name; boss.color=boss.bossType.color;
      bossHealthBar.classList.remove('hidden');
  document.body.classList.add('boss-active'); // 通知 CSS 精简中间 panel，避免与 Boss 血条重叠 bossName.style.color=''; bossName.textContent=`BOSS2 - ${boss.name}`;
      updateBossUI(); showWaveAnnounce('第二只Boss！',`${boss.name} 出现了！`,true);
      maxLevelTime=CONFIG.BOSS_TIME; levelTimer=maxLevelTime;
    },willLevelUp?0:1500); // 若将升级则立即生成（升级面板期间），否则1.5秒后生成
    return;
  }
  // 普通Boss被击败后，30%几率超级Boss复仇
  if(defeatedBoss&&!defeatedBoss.isSuper&&Math.random()<0.3){
    pendingSuperRevenge=true;
    gameTimeout(()=>{
      // 允许 boss 和 upgrade 状态触发 — 玩家可能在1.5秒内拾取经验触发升级面板
      // applyUpgrade 会拦截 pendingSuperRevenge 防止跳关，但不会主动 spawn（避免双superBoss）
      if(gameState!=='boss'&&gameState!=='upgrade')return;
      spawnSuperBoss();
    },1500);
    return;
  }
  // 正常流程：给经验值，进入下一关
  // 安全保护：如果在试炼模式中意外走到这里，不能进入下一关
  if(bossTrialMode){
    console.warn('[安全保护] onBossDefeated 正常流程拦截：试炼模式中不应进入下一关');
    bossTrialIndex++;
    if(bossTrialIndex<trialBossOrder.length){
      gameTimeout(()=>{if(gameState!=='boss')return;spawnTrialBoss();},1500);
    }else{
      bossTrialMode=false; gameOver();
    }
    return;
  }
  const beforeLv=player?player.xpLevel:0;
  if(player)player.gainXp(bossXpReward);
  // 如果触发了升级，等玩家选完强化再进入下一关
  if(player&&player.xpLevel>beforeLv){
    pendingProceedNext=true;
    return;
  }
  // 安全网：如果升级面板正在显示（玩家在Boss战中拾取经验触发了升级，同时Boss被击杀），
  // 不能直接调用proceedToNextLevel，否则玩家关闭升级面板时防御性保护会再调用一次，导致跳关
  if(gameState==='upgrade'){
    pendingProceedNext=true;
    return;
  }
  proceedToNextLevel();
}
// 进入下一关/下一波（Boss击败后或升级完成后调用）
function proceedToNextLevel(){
  // 安全保护：试炼模式中绝对不能进入下一关
  if(bossTrialMode){
    console.warn('[安全保护] proceedToNextLevel 拦截：试炼模式中不应进入下一关');
    bossTrialIndex++;
    if(bossTrialIndex<trialBossOrder.length){
      gameTimeout(()=>{if(gameState!=='boss')return;spawnTrialBoss();},1500);
    }else{
      bossTrialMode=false; gameOver();
    }
    return;
  }
  // 冒险模式：通关5关后强制刑天（替代旧的8关+RNG机制，缩短单局时长）
  // _level5FinalBossDone 防止 decline 后再次进入此处导致死循环
  if(!endlessMode && !bossTrialMode && currentLevel>=5 && !_level5FinalBossDone){
    _level5FinalBossDone=true;
    startFinalBoss();
    return;
  }
  currentLevel++; currentWave=1;
  // 无尽模式：通关8关后进入无尽波次
  if(endlessMode&&currentLevel>8){enterEndlessWave();return;}
  showWaveAnnounce(`第 ${currentLevel} 关`,'新的挑战开始！',false);
  const regen=player.regenPerLevel||0; if(regen>0)player.health=Math.min(player.health+regen,player.maxHealth);
  // 护盾再生：每关恢复护盾
  if(player.shieldRegen){player.shield=Math.min(player.shield+player.shieldRegen,player.maxShield);}
  enemies=[];enemyBullets=[];bullets=[];minions=minions.filter(m=>m.permanent&&m.alive);fireEffects=[];lightningStrikes=[];tornadoes=[];
  // 注意：不清空 drops，让玩家拾取遗留的经验球
  gameState='wavePrepare';
  gameTimeout(()=>{if(gameState!=='wavePrepare')return;startWave();},2000);
  updateUI();
}
function showWaveAnnounce(title,sub,isBoss=false){
  document.getElementById('waveAnnounceTitle').textContent=title;
  document.getElementById('waveAnnounceSub').textContent=sub;
  const wa=document.getElementById('waveAnnounce');
  wa.className=isBoss?'boss':'';
  wa.classList.add('show');
  setTimeout(()=>wa.classList.remove('show'),1800);
}
function showUpgradeScreen(){
  if(gameState==='upgrade')return;
  // 记录升级前的游戏状态，选完强化后恢复
  prevGameState=gameState;
  gameState='upgrade'; enemyBullets=[]; bullets=[];
  const all=getAvailableUpgrades(); const sel=shuffle(all).slice(0,3);
  if(sel.length===0){
    // 没有可选升级，直接关闭面板恢复游戏
    gameState=prevGameState||'fighting';
    // 清理所有 pending 标记，防止残留导致下一局跳关/跳波
    const _pendProceed=pendingProceedNext;
    const _pendTrial=pendingTrialNext;
    const _pendEndless=pendingEndlessNext;
    pendingProceedNext=false; pendingTrialNext=false; pendingEndlessNext=false;
    if(bossTrialMode){
      // 试炼模式：进入下一只试炼 Boss 或结束试炼
      bossTrialIndex++;
      if(bossTrialIndex<trialBossOrder.length){
        gameTimeout(()=>{if(gameState!=='boss')return;spawnTrialBoss();},1500);
      }else{
        bossTrialMode=false; gameOver();
      }
    }else if(_pendEndless){
      enterEndlessWave();
    }else if(_pendTrial){
      bossTrialIndex++;
      if(bossTrialIndex<trialBossOrder.length){
        gameTimeout(()=>{if(gameState!=='boss')return;spawnTrialBoss();},1500);
      }else{
        bossTrialMode=false; gameOver();
      }
    }else if(prevGameState==='boss' && (!boss || !boss.alive)){
      proceedToNextLevel();
    }
    return;
  }
  const uc=document.getElementById('upgradeCards'); uc.innerHTML='';
  for(const up of sel){
    const card=document.createElement('div'); card.className=`upgrade-card ${up.rarity} card-enter`;
    card.style.animationDelay=(sel.indexOf(up)*0.1)+'s';
    let tt=''; if(up.element){if(up.isFinal)tt='最终升级';else tt=`阶段 ${up.tier}/3`;}
    if(up.special){if(up.isFinalSpecial)tt='最终升级';else tt=`阶段 ${up.tier}/3`;}
    card.innerHTML=`<div class="upgrade-icon">${up.icon}</div><div class="upgrade-name">${up.name}</div><div class="upgrade-desc">${up.desc}</div>${tt?`<div class="upgrade-tier">${tt}</div>`:''}<div class="upgrade-rarity ${up.rarity}">${up.rarity==='common'?'普通':up.rarity==='rare'?'稀有':up.rarity==='epic'?'史诗':'传说'}</div>`;
    _bindTap(card,()=>applyUpgrade(up)); uc.appendChild(card);
  }
  document.getElementById('upgradeSubtitle').textContent=`✨ 升级! Lv.${player?player.xpLevel:1} - 选择一项强化`;
  document.getElementById('upgradeOverlay').classList.remove('hidden');
}
function applyUpgrade(up){
  if(!player)return;
  up.apply(player); document.getElementById('upgradeOverlay').classList.add('hidden');
  // 局内升级后重算装备Build联动（幂等实现：仅对新增满足条件的联动调用apply，已应用的不重复）
  // 这样例如"暴击≥30%+射速≥25%"等条件型联动，在升级加暴击/射速后会自动激活
  try{ applyGearSynergies(player); }catch(e){ console.warn('applyGearSynergies失败:',e); }
  pushFloatingText(player.x,player.y-30,up.name+'!',up.rarity==='legendary'?'#ffd700':up.rarity==='epic'?'#f0883e':up.rarity==='rare'?'#bc8cff':'#58a6ff',1.5);
  // 死亡复盘：记录选过的强化
  if(typeof runStats!=='undefined' && up && up.name){
    runStats.upgradesTaken.push(up.name);
  }
  // ===== 安全保护：试炼模式优先级最高，绝不进入普通关卡流程 =====
  // 根因：pendingProceedNext 检查在 pendingTrialNext 之前，若两者同时为 true
  // （如上一局遗留或经验球拾取触发），会错误调用 proceedToNextLevel 导致跳关
  if(bossTrialMode){
    pendingProceedNext=false; // 强制清除，防止跳关
    if(pendingTrialNext){
      pendingTrialNext=false;
      gameState='boss';
      if(player&&player._lastTrialWasSuperRevenge){
        player._lastTrialWasSuperRevenge=false;
        if(bossTrialIndex<trialBossOrder.length){
          gameTimeout(()=>{if(gameState!=='boss')return;spawnTrialBoss();},1500);
        }else{
          bossTrialMode=false; gameOver();
        }
      }else{
        bossTrialIndex++;
        if(bossTrialIndex<trialBossOrder.length){
          if(Math.random()<0.3){
            pendingSuperRevenge=true;
            gameTimeout(()=>{if(gameState!=='boss')return;spawnSuperBoss();},1500);
          }else{
            gameTimeout(()=>{if(gameState!=='boss')return;spawnTrialBoss();},1500);
          }
        }else{
          bossTrialMode=false; gameOver();
        }
      }
    }else{
      // 试炼模式中战斗拾取经验触发的升级（非Boss击败）：恢复boss状态继续打
      gameState='boss';
    }
    return;
  }
  // ===== 非试炼模式 =====
  // 1) 无尽Boss击败后触发的升级：进入下一波无尽
  if(endlessMode&&pendingEndlessNext){
    pendingEndlessNext=false;
    enterEndlessWave();
    return;
  }
  // 1.5) 超级复仇挂起：普通Boss击败后30%触发超级复仇，1.5秒延迟内若玩家拾取经验触发升级，
  // 必须拦截"防御性跳关"，否则超级Boss复仇会被吞掉且 pendingSuperRevenge 残留污染下一只Boss
  // 注意：只清除标记 + 暂停跳关，不主动调用 spawnSuperBoss — 因为 onBossDefeated 已安排了
  // gameTimeout(()=>spawnSuperBoss(),1500)，主动调用会导致两只超级Boss 同时生成（覆盖引用+伤害丢失）
  if(pendingSuperRevenge){
    pendingSuperRevenge=false;
    gameState='boss'; // 保持 Boss 状态等待 onBossDefeated 的 gameTimeout 触发 spawnSuperBoss
    return;
  }
  // 2) 普通Boss击败后触发的升级：进入下一关
  if(pendingProceedNext){
    pendingProceedNext=false;
    proceedToNextLevel();
    return;
  }
  // 3) 战斗中经验满触发的升级：恢复原游戏状态
  // 防御性保护：如果升级前是Boss战状态，但Boss已经死了（boss=null或boss.alive=false），
  // 说明Boss在升级面板出现前就被击败了，但onBossDefeated的gainXp触发了升级。
  // 此时不能恢复gameState='boss'（会卡在空Boss战场），必须进入下一关。
  if(prevGameState==='boss' && (!boss || !boss.alive)){
    console.warn('[防御保护] 升级前Boss已死，强制进入下一关');
    proceedToNextLevel();
    return;
  }
  gameState=prevGameState||'fighting';
  updateUI();
}
// 进入无尽模式下一波
function enterEndlessWave(){
  gameState='wavePrepare';
  endlessWave++;
  currentLevel=8; currentWave=1;
  // 每5波生成强化Boss
  if(endlessWave%5===0){
    showWaveAnnounce(`♾️ 无尽 ${endlessWave} 波`,'⚠️ 强化Boss出现！',true);
    gameTimeout(()=>{if(gameState!=='upgrade'&&gameState!=='wavePrepare')return;startEndlessBoss();},2000);
  }else{
    showWaveAnnounce(`♾️ 无尽 ${endlessWave} 波`,'怪物无限增强，撑住！');
    // 每3波提供遗物选择
    if(endlessWave%3===0){
      gameTimeout(()=>{if(gameState!=='upgrade'&&gameState!=='wavePrepare')return;showRelicSelection();},1800);
    }else{
      const regen=player.regenPerLevel||0; if(regen>0)player.health=Math.min(player.health+regen,player.maxHealth);
      if(player.shieldRegen){player.shield=Math.min(player.shield+player.shieldRegen,player.maxShield);}
      enemies=[];enemyBullets=[];bullets=[];drops=[];minions=minions.filter(m=>m.permanent&&m.alive);fireEffects=[];lightningStrikes=[];tornadoes=[];
      gameTimeout(()=>{if(gameState!=='upgrade'&&gameState!=='wavePrepare')return;startWave();},2000);
    }
  }
  updateUI();
}
// 无尽模式强化Boss
function startEndlessBoss(){
  gameState='boss'; enemies=[]; enemyBullets=[]; minions=minions.filter(m=>m.permanent&&m.alive);
  bossWarnings=[]; bossVariant=false; // 无尽Boss不走变异系统，显式重置
  const isSuper=endlessWave>=10&&Math.random()<0.5;
  // 新增Boss加入无尽循环：普通Boss 0,1,2,3,6,7；超级Boss 4,5,8
  const superChoices=[4,5,8];
  const normalChoices=[0,1,2,3,6,7];
  const idx=isSuper?superChoices[Math.floor(Math.random()*superChoices.length)]:normalChoices[Math.floor(Math.random()*normalChoices.length)];
  boss=new Boss(currentLevel,isSuper,isSuper?idx:null);
  boss.bossIndex=idx; boss.bossType=BOSS_TYPES[idx];
  boss.name=boss.bossType.name; boss.color=boss.bossType.color;
  const endlessHpMul=1+endlessWave*0.15;
  boss.maxHealth=Math.ceil(boss.maxHealth*endlessHpMul);
  boss.health=boss.maxHealth;
  boss._endlessWave=endlessWave;
  bossHealthBar.classList.remove('hidden');
  document.body.classList.add('boss-active'); // 通知 CSS 精简中间 panel，避免与 Boss 血条重叠 bossName.style.color=''; bossName.textContent=`♾️ 无尽Boss - ${boss.name}`;
  updateBossUI(); showWaveAnnounce('无尽Boss！',`${boss.name} (血量x${endlessHpMul.toFixed(2)})`,true);
  maxLevelTime=CONFIG.BOSS_TIME+10; levelTimer=maxLevelTime;
}

// ==================== 奇遇系统 ====================
function spawnAdventureEnemy(){
  const e=new Enemy('spiky',currentLevel);
  e.isAdventure=true; e.color='#bc8cff'; e.size=20; e.score=30;
  enemies.push(e);
  pushFloatingText(e.x,e.y,'奇遇!','#bc8cff',1.5);
}
function triggerAdventure(){
  gameState='adventure';
  const ov=document.getElementById('adventureOverlay');
  const events=shuffle(ADVENTURE_EVENTS).slice(0,3);
  let html='<h2 style="color:#bc8cff">奇遇事件</h2><p class="subtitle">选择一个事件触发效果</p>';
  for(const ev of events){
    html+=`<div class="adventure-event" data-event="${ADVENTURE_EVENTS.indexOf(ev)}"><div style="font-size:28px;margin-bottom:6px">${ev.icon}</div><div style="font-size:14px">${ev.desc}</div></div>`;
  }
  html+='<button class="sec-btn" id="skipAdventure" style="margin-top:16px">跳过</button>';
  ov.innerHTML=html; ov.classList.remove('hidden');
  ov.querySelectorAll('.adventure-event').forEach(el=>{
    _bindTap(el,()=>{
      const idx=parseInt(el.dataset.event); const ev=ADVENTURE_EVENTS[idx];
      ev.apply();
      pushFloatingText(player.x,player.y-30,ev.desc+'!','#bc8cff',2);
      ov.classList.add('hidden'); gameState='fighting';
    });
  });
  _bindTap(document.getElementById('skipAdventure'),()=>{ov.classList.add('hidden');gameState='fighting';});
}

// ==================== Boss捕捉 ====================
function showBossCapture(def){
  const ov=document.getElementById('bossCaptureOverlay');
  ov.innerHTML=`
    <h2 style="color:#ffd700">🎉 Boss宝宝掉落！</h2>
    <div style="font-size:60px;margin:20px">${def.icon}</div>
    <h3>${def.name}</h3>
    <p class="subtitle">${def.desc}</p>
    <p class="subtitle">是否捕捉？(需要空闲宠物槽位)</p>
    <div>
      <button class="capture-btn capture-yes" id="captureYes">捕捉！</button>
      <button class="capture-btn capture-no" id="captureNo">放弃</button>
    </div>
  `;
  ov.classList.remove('hidden');
  _bindTap(document.getElementById('captureYes'),()=>{
    saveData.ownedPets.push({def:def.bossIdx,stage:0}); saveSave();
    ov.classList.add('hidden'); pendingBossCapture=null;
    pushFloatingText(CONFIG.WIDTH/2,CONFIG.HEIGHT/2,'捕捉成功!','#ffd700',2);
  });
  _bindTap(document.getElementById('captureNo'),()=>{ov.classList.add('hidden');pendingBossCapture=null;});
}

