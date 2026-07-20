// ==================== 主循环 ====================
// 慢动作效果（Boss击杀时触发，0.4秒持续时间内时间流速变慢）
let slowMotion={active:false, timer:0, scale:0.3};
function triggerSlowMotion(duration=0.5, scale=0.3){
  slowMotion.active=true;
  slowMotion.timer=duration;
  slowMotion.scale=scale;
}
// Hit-stop：极短时间冻结（0.03-0.1秒），打击感的核心
// 普通击杀不触发，精英/Boss击杀触发，让玩家有"打中了"的实感
let hitStop={active:false, timer:0};
function triggerHitStop(duration=0.05){
  // 慢动作期间不触发hit-stop（避免叠加卡顿）
  if(slowMotion.active) return;
  // 取较大值：连续击杀时延长冻结时间
  if(duration > hitStop.timer){
    hitStop.active=true;
    hitStop.timer=duration;
  }
}
function gameLoop(timestamp){
  try{
    if(!lastTime)lastTime=timestamp;
    // 暂停时dt=0，所有更新都停止（但绘制继续）
    let dt=isPaused ? 0 : Math.min((timestamp-lastTime)/1000,0.05);
    // Hit-stop：极短冻结（dt=0），强打击感
    if(hitStop.active && !isPaused){
      hitStop.timer-=dt;
      if(hitStop.timer<=0){
        hitStop.active=false;
      }
      dt=0; // 冻结期间所有更新归零，但绘制继续
    }
    // 慢动作：Boss击杀时短暂减速，强化击杀感
    if(slowMotion.active && !isPaused){
      slowMotion.timer-=dt;
      if(slowMotion.timer<=0){
        slowMotion.active=false;
      }else{
        dt*=slowMotion.scale; // 时间流速变慢
      }
    }
    lastTime=timestamp;
    gameTime+=dt;
    // 性能优化：每帧入口取一次 Date.now，避免后续数百次系统调用
    _NOW = Date.now();

    // 更新触摸控件可见性
    updateTouchControlsVisibility();

    // 低血量警告状态更新
    // 注意：Player 类属性是 health/maxHealth（非 hp/maxHp），属性名错误会导致警告永不触发
    if(player && player.alive && (gameState==='fighting' || gameState==='boss')){
      lowHpWarning.active = player.health > 0 && player.health <= player.maxHealth * 0.3;
    } else {
      lowHpWarning.active = false;
    }

    // 清屏
    drawBackground(dt);

    if(gameState==='fighting'){
      // 关卡倒计时
      levelTimer-=dt;
      if(levelTimer<=0){
        // 时间到，自动进入下一波（经验值模式：不触发升级）
        levelTimer=maxLevelTime;
        if(currentWave>=CONFIG.WAVES_PER_LEVEL){
          startBoss();
        }else{
          // 进入下一波
          currentWave++;
          showWaveAnnounce(`第 ${currentWave} 波`,'准备战斗！');
          enemies=[];enemyBullets=[];bullets=[];minions=minions.filter(m=>m.permanent&&m.alive);fireEffects=[];lightningStrikes=[];tornadoes=[];
          // 注意：不清空 drops，让玩家拾取遗留的经验球
          gameState='wavePrepare';
          gameTimeout(()=>{if(gameState!=='wavePrepare')return;startWave();},1500);
        }
      }
      // 敌人生成
      if(enemiesToSpawn>0){
        spawnTimer-=dt;
        if(spawnTimer<=0){spawnWaveEnemy(); enemiesToSpawn--; const diff=getDifficulty(); const baseInterval=Math.max(0.15,0.6-currentWave*0.06-currentLevel*0.04); spawnTimer=baseInterval*(diff.spawnIntervalMul||1);}
      }
      // 更新
      syncTouchToKeys(); updateTouchAim(); updateSkillBtnCD();
      if(player)player.update(dt);
      for(const m of minions)if(m.alive)m.update(dt);
      minions=minions.filter(m=>m.alive);
      for(const b of bullets)if(b.alive)b.update(dt);
      for(const e of enemies)if(e.alive)e.update(dt);
      for(const eb of enemyBullets)if(eb.alive)eb.update(dt);
      for(const d of drops)if(d.alive)d.update(dt);
      for(const p of pets)if(p.alive)p.update(dt);
      updateFireEffects(dt); updateLightningStrikes(dt); updateTornadoes(dt);
      // 碰撞
      checkCollisions();
      // 奇遇小怪定时生成
      adventureEnemyTimer-=dt;
      if(adventureEnemyTimer<=0){spawnAdventureEnemy(); adventureEnemyTimer=rand(20,35);}
      // 清理
      bullets=bullets.filter(b=>b.alive);
      enemies=enemies.filter(e=>e.alive);
      enemyBullets=enemyBullets.filter(eb=>eb.alive);
      drops=drops.filter(d=>d.alive);
      // 性能优化：掉落物上限保护（防止经验球堆积）
      if(drops.length>MAX_DROPS)drops=drops.slice(-MAX_DROPS);
      // 连击计时器递减
      if(comboTimer>0){comboTimer-=dt; if(comboTimer<=0){comboCount=0;}}
      // 性能优化：限制数组上限
      if(bullets.length>MAX_BULLETS)bullets=bullets.slice(-MAX_BULLETS);
      if(enemyBullets.length>MAX_ENEMY_BULLETS)enemyBullets=enemyBullets.slice(-MAX_ENEMY_BULLETS);
      if(fireEffects.length>MAX_FIRE_EFFECTS)fireEffects=fireEffects.slice(-MAX_FIRE_EFFECTS);
      if(enemies.length>MAX_ENEMIES)enemies=enemies.slice(-MAX_ENEMIES);
      // 绘制
      drawWarnings(dt);
      for(const d of drops)d.draw();
      drawFireEffects();
      for(const e of enemies)e.draw();
      for(const m of minions)m.draw();
      for(const p of pets)p.draw();
      for(const b of bullets)b.draw();
      for(const eb of enemyBullets)eb.draw();
      drawLightningStrikes();
      drawTornadoes();
      if(player&&player.alive)player.draw(); // 死亡后不绘制玩家本体（与 boss 分支保持一致，避免尸体+死亡动画叠加）
      updateParticles(dt); drawParticles();
      drawAimReticle(); // 瞄准准星（在玩家、粒子之上，让玩家始终能看见自己在瞄哪里）
      drawBossIndicator();
      updateFloatingTexts(dt); drawFloatingTexts();
      // 连击数显示（移到画面中央偏上，避开顶部HUD和底部摇杆/技能按钮）
      if(comboCount>=3){
        const comboAlpha=Math.min(1,comboTimer/2);
        const comboColor=comboCount>=10?'#ffd700':comboCount>=5?'#bc8cff':'#58a6ff';
        ctx.save();
        ctx.globalAlpha=comboAlpha;
        ctx.fillStyle=comboColor;
        ctx.font=`bold ${22+Math.min(comboCount,18)}px STKaiti,KaiTi,serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowColor=comboColor; ctx.shadowBlur=15;
        ctx.fillText(`${comboCount} 连击!`,CONFIG.WIDTH/2,CONFIG.HEIGHT*0.42);
        if(comboCount>=5){
          ctx.font='13px STKaiti,KaiTi,serif';
          ctx.fillStyle='#8b949e';
          ctx.shadowBlur=0;
          ctx.fillText(`分数加成 +${comboCount*5}%`,CONFIG.WIDTH/2,CONFIG.HEIGHT*0.42+25);
        }
        ctx.restore();
      }
      // 检查波次完成
      checkWaveComplete();
      updateUI(); updateTimerUI();
    }else if(gameState==='boss'){
      // Boss关倒计时（仅Boss存活时计时，避免Boss间隙误伤）
      if(boss&&boss.alive){
        levelTimer-=dt;
        if(levelTimer<=0){
          levelTimer=maxLevelTime;
          if(player)player.takeDamage(999);
        }
        // 时间挑战倒计时
        if(bossTimeChallenge&&bossTimeChallenge.active){
          bossTimeChallenge.time-=dt;
          if(bossTimeChallenge.time<=0){
            bossTimeChallenge.time=0;
            bossTimeChallenge.active=false;
            pushFloatingText(player.x,player.y-50,'⏰ 时间挑战失败','#8b949e',1.5);
          }
        }
      }
      // 更新
      syncTouchToKeys(); updateTouchAim(); updateSkillBtnCD();
      if(player)player.update(dt);
      for(const m of minions)if(m.alive)m.update(dt);
      minions=minions.filter(m=>m.alive);
      for(const b of bullets)if(b.alive)b.update(dt);
      for(const eb of enemyBullets)if(eb.alive)eb.update(dt);
      for(const d of drops)if(d.alive)d.update(dt);
      // 如果拾取经验触发升级面板（gameState变为'upgrade'），跳过后续Boss更新和碰撞，
      // 避免同一帧内Boss死亡导致onBossDefeated中的proceedToNextLevel被直接调用，
      // 之后玩家关闭升级面板时防御性保护又调用一次，造成currentLevel被递增两次（跳关）
      const _upgradeInterrupted = gameState !== 'boss';
      for(const p of pets)if(p.alive&&!_upgradeInterrupted)p.update(dt);
      // Boss安全更新
      const bossRef=boss;
      if(bossRef&&bossRef.alive&&!_upgradeInterrupted){bossRef.update(dt);bossRef.updateWrathClones(dt);bossRef.updateOrbitingOrbs(dt);}
      if(!_upgradeInterrupted){updateFireEffects(dt); updateLightningStrikes(dt); updateTornadoes(dt);}
      // Boss出场戏剧化动画更新（独立于Boss本体，确保即使Boss死亡也能完成淡出）
      if(typeof updateBossIntro==='function')updateBossIntro(dt);
      if(typeof updateBossDeathFx==='function')updateBossDeathFx(dt);
      updateDeathAnimation(dt);
      // 碰撞（仅当Boss存活且未触发升级面板）
      if(bossRef&&bossRef.alive&&!_upgradeInterrupted&&player&&player.alive)checkCollisions();
      // 清理
      bullets=bullets.filter(b=>b.alive);
      enemyBullets=enemyBullets.filter(eb=>eb.alive);
      drops=drops.filter(d=>d.alive);
      // 性能优化：掉落物上限保护
      if(drops.length>MAX_DROPS)drops=drops.slice(-MAX_DROPS);
      // 性能优化：限制数组上限
      if(bullets.length>MAX_BULLETS)bullets=bullets.slice(-MAX_BULLETS);
      if(enemyBullets.length>MAX_ENEMY_BULLETS)enemyBullets=enemyBullets.slice(-MAX_ENEMY_BULLETS);
      if(fireEffects.length>MAX_FIRE_EFFECTS)fireEffects=fireEffects.slice(-MAX_FIRE_EFFECTS);
      if(enemies.length>MAX_ENEMIES)enemies=enemies.slice(-MAX_ENEMIES);
      // 绘制
      drawWarnings(dt);
      for(const d of drops)d.draw();
      drawFireEffects();
      for(const m of minions)m.draw();
      for(const p of pets)p.draw();
      for(const b of bullets)b.draw();
      for(const eb of enemyBullets)eb.draw();
      if(bossRef&&bossRef.alive)bossRef.draw();
      drawLightningStrikes();
      drawTornadoes();
      if(player&&player.alive)player.draw();
      drawDeathAnimation();
      updateParticles(dt); drawParticles();
      drawAimReticle(); // 瞄准准星（Boss 战中也需要瞄准反馈）
      updateFloatingTexts(dt); drawFloatingTexts();
      // 连击计时器递减（Boss战中也保持）
      if(comboTimer>0){comboTimer-=dt; if(comboTimer<=0)comboCount=0;}
      // 连击数显示（移到画面中央偏上，避开顶部HUD和底部摇杆/技能按钮）
      if(comboCount>=3){
        const comboAlpha=Math.min(1,comboTimer/2);
        const comboColor=comboCount>=10?'#ffd700':comboCount>=5?'#bc8cff':'#58a6ff';
        ctx.save();
        ctx.globalAlpha=comboAlpha;
        ctx.fillStyle=comboColor;
        ctx.font=`bold ${22+Math.min(comboCount,18)}px STKaiti,KaiTi,serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowColor=comboColor; ctx.shadowBlur=15;
        ctx.fillText(`${comboCount} 连击!`,CONFIG.WIDTH/2,CONFIG.HEIGHT*0.42);
        if(comboCount>=5){
          ctx.font='13px STKaiti,KaiTi,serif';
          ctx.fillStyle='#8b949e';
          ctx.shadowBlur=0;
          ctx.fillText(`分数加成 +${comboCount*5}%`,CONFIG.WIDTH/2,CONFIG.HEIGHT*0.42+25);
        }
        ctx.restore();
      }
      // Boss出场戏剧化动画绘制（叠加在所有内容之上，确保戏剧感）
      if(typeof drawBossIntro==='function')drawBossIntro();
      // Boss死亡戏剧化动画绘制（缩小+变白+光柱+金色碎片）
      if(typeof drawBossDeathFx==='function')drawBossDeathFx();
      updateUI(); updateTimerUI(); updateBossUI();
    }else if(gameState==='upgrade'||gameState==='adventure'||gameState==='menu'||gameState==='gameover'||gameState==='wavePrepare'){
      // 静态界面：仅绘制玩家和粒子背景
      if(player){
        for(const d of drops)d.draw();
        for(const e of enemies)e.draw();
        for(const b of bullets)b.draw();
        if(gameState!=='menu'&&gameState!=='gameover')player.draw();
        updateParticles(dt); drawParticles();
        updateFloatingTexts(dt); drawFloatingTexts();
      }else{
        // 菜单背景动画粒子
        if(Math.random()<0.1){spawnParticles(rand(0,CONFIG.WIDTH),rand(0,CONFIG.HEIGHT),'#58a6ff',1);}
        updateParticles(dt); drawParticles();
      }
    }
  }catch(e){
    console.error('gameLoop error:',e);
  }
  requestAnimationFrame(gameLoop);
}

// ==================== 事件监听 ====================
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if(k==='r'&&gameState==='gameover'){ if(_lastRunWasTrial)startBossTrial(); else if(typeof endlessMode!=='undefined'&&endlessMode)startEndlessMode(); else startGame(); }
  if(k===' ')e.preventDefault();
  // PC 端暂停快捷键：ESC 或 P 切换暂停（仅战斗中）
  if((k==='escape'||k==='p') && (gameState==='fighting'||gameState==='boss')){
    if(typeof togglePause==='function'){ e.preventDefault(); togglePause(); }
  }
});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
canvas.addEventListener('mousemove',e=>{
  const r=canvas.getBoundingClientRect();
  mouse.x=(e.clientX-r.left)*(canvas.width/r.width);
  mouse.y=(e.clientY-r.top)*(canvas.height/r.height);
});
canvas.addEventListener('mousedown',e=>{if(e.button===0)mouse.down=true;});
canvas.addEventListener('mouseup',e=>{if(e.button===0)mouse.down=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
// 手机端：阻止 canvas 上的触摸事件合成 mouse 事件，避免多指触摸 canvas 时
// 误触发 mousedown/mouseup 中断右摇杆射击
canvas.addEventListener('touchstart', e=>{
  // 仅在战斗中阻止，菜单状态下放行（让按钮 click 正常合成）
  if(isTouchDevice && touchConfirmed && (gameState==='fighting'||gameState==='boss')){
    e.preventDefault();
  }
}, {passive:false});
canvas.addEventListener('touchend', e=>{
  if(isTouchDevice && touchConfirmed && (gameState==='fighting'||gameState==='boss')){
    e.preventDefault();
  }
}, {passive:false});

// ==================== TapTap 试玩版容器适配 ====================
// TapTap 试玩版在 TapTap App 的 WebView 中运行：容器自动全屏横屏、自动处理实名+防沉迷
// 因此在 TapTap 内：跳过 rotateHint/fsRestoreHint/requestFullscreen/orientation.lock 等浏览器适配逻辑
// 检测方式：UA 包含 "TapTap"（容器注入的 UA 标识）或 window.__TAPTA__/window.TapTap 存在
const isInTapTap = (function(){
  try{
    const ua = (navigator.userAgent || '').toLowerCase();
    if(ua.indexOf('taptap') !== -1) return true;
    if(typeof window.__TAPTA__ !== 'undefined') return true;
    if(typeof window.TapTap !== 'undefined' && window.TapTap && typeof window.TapTap === 'object') return true;
    // URL 参数兜底（试玩版容器有时会注入 ?from=taptap）
    if(typeof URLSearchParams !== 'undefined'){
      const p = new URLSearchParams(window.location.search);
      if(p.get('from') === 'taptap' || p.get('taptap') === '1') return true;
    }
  }catch(e){}
  return false;
})();
// 暴露给其他模块使用（ui.js 的 showHomeTipIfMobile 也会用到）
if(typeof window !== 'undefined'){ window.isInTapTap = isInTapTap; }

// ==================== 手机端触摸控制 ====================
// iPadOS 13+ 在 Safari 默认请求桌面 UA（navigator.platform==='MacIntel'），需额外检测
const _isiPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
// 使用 pointer:coarse 检测纯触摸设备（手机/平板），iPadOS 桌面UA fallback
let isTouchDevice = (window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false) || _isiPadOS;
// 用户已主动关闭竖屏旋转提示遮罩，本次会话不再自动弹出
let _rotateHintDismissed = false;

// 竖屏旋转提示：仅手机端在竖屏时显示遮罩
const isInWechat = /MicroMessenger/i.test(navigator.userAgent);
function updateRotateHint(){
  const hint = document.getElementById('rotateHint');
  if(!hint) return;
  // TapTap 试玩版容器自动横屏，不需要旋转提示
  if(isInTapTap){ hint.classList.remove('show'); return; }
  const isPortrait = window.matchMedia('(orientation: portrait)').matches
    || (window.innerHeight > window.innerWidth);
  // 用户已主动关闭遮罩后，本次会话不再自动弹出（避免反复打扰）
  if(_rotateHintDismissed){
    hint.classList.remove('show');
    return;
  }
  // 仅触摸设备 + 竖屏 时显示
  if(isTouchDevice && isPortrait){
    hint.classList.add('show');
  }else{
    hint.classList.remove('show');
  }
}
window.addEventListener('orientationchange', updateRotateHint);
// 性能优化：resize 事件防抖，避免手机浏览器地址栏显隐时频繁触发
let _resizeTimer = null;
window.addEventListener('resize', ()=>{
  if(_resizeTimer) clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(updateRotateHint, 150);
});
window.addEventListener('load', updateRotateHint);
setTimeout(updateRotateHint, 300); // 初始延迟检测，避免某些机型取值不准

// 全屏播放（解决浏览器地址栏遮挡问题）
// 强制全屏策略：首次触摸/点击自动进入全屏 + 安卓锁横屏 + 退出时自动提示恢复
let _fsUserWantsExit = false; // 用户主动退出标记（短暂忽略恢复提示，避免双击退出全屏时立即弹回）
let _fsRestoredTimer = 0; // 主动退出后的冷却时间戳

function isFullscreenNow(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function enterFullscreen(){
  // TapTap 试玩版容器自动全屏，调用 requestFullscreen 会失败或导致容器异常
  if(isInTapTap) return false;
  const el = document.documentElement;
  const isFs = isFullscreenNow();
  if(isFs) return false;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.webkitEnterFullscreen;
  if(req){
    try{
      const p = req.call(el);
      if(p && p.catch){ p.catch(()=>{}); } // 忽略 reject（iOS Safari 无效等）
    }catch(e){ return false; }
  }else if(typeof el.webkitEnterFullscreen === 'function'){
    try{ el.webkitEnterFullscreen(); }catch(e){ return false; }
  }
  // 尝试锁定横屏（Android Chrome 支持，iOS Safari 静默失败）
  try{
    const so = screen.orientation || screen.mozOrientation || screen.msOrientation;
    if(so && typeof so.lock === 'function'){
      const p = so.lock('landscape');
      if(p && p.catch) p.catch(()=>{});
    }
  }catch(e){}
  return true;
}

function exitFullscreen(){
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
  if(exit){
    try{ exit.call(document); }catch(e){}
  }
  // 解除横屏锁定
  try{
    const so = screen.orientation || screen.mozOrientation || screen.msOrientation;
    if(so && typeof so.unlock === 'function') so.unlock();
  }catch(e){}
}

function toggleFullscreen(){
  if(!isFullscreenNow()){
    enterFullscreen();
  }else{
    exitFullscreen();
  }
}

// 显示"恢复全屏"遮罩
function showFsRestoreHint(){
  if(!isTouchDevice) return; // 电脑端不强制
  if(isInTapTap) return; // TapTap 容器已全屏，不弹恢复提示
  if(isFullscreenNow()) return;
  // 竖屏时由 rotateHint 遮罩接管，不重复弹
  const isPortrait = window.matchMedia('(orientation: portrait)').matches || (window.innerHeight > window.innerWidth);
  if(isPortrait) return;
  // 冷却期内不弹（用户刚主动退出）
  if(_fsRestoredTimer && Date.now() - _fsRestoredTimer < 1500) return;
  const h = document.getElementById('fsRestoreHint');
  if(h) h.classList.add('show');
}
function hideFsRestoreHint(){
  const h = document.getElementById('fsRestoreHint');
  if(h) h.classList.remove('show');
}

// 全屏状态变化监听：退出时自动弹恢复遮罩
document.addEventListener('fullscreenchange', () => {
  lastTime = 0;
  if(!isFullscreenNow()){
    // 退出全屏
    _fsRestoredTimer = Date.now();
    showFsRestoreHint();
  }else{
    hideFsRestoreHint();
  }
});
document.addEventListener('webkitfullscreenchange', () => {
  lastTime = 0;
  if(!isFullscreenNow()){
    _fsRestoredTimer = Date.now();
    showFsRestoreHint();
  }else{
    hideFsRestoreHint();
  }
});

// 恢复全屏遮罩：点击任意处重新进入全屏
(function(){
  const hint = document.getElementById('fsRestoreHint');
  if(!hint) return;
  const restore = (e)=>{
    e.preventDefault();
    e.stopPropagation();
    enterFullscreen();
    // 锁横屏
    try{
      const so = screen.orientation;
      if(so && typeof so.lock === 'function'){
        const p = so.lock('landscape');
        if(p && p.catch) p.catch(()=>{});
      }
    }catch(err){}
    hideFsRestoreHint();
  };
  hint.addEventListener('click', restore);
  hint.addEventListener('touchstart', restore, {passive:false});
})();

// 首次任意触摸/点击自动进入全屏（仅 Android Chrome 等支持 Fullscreen API 的浏览器生效）
// iOS Safari 不支持 requestFullscreen API，跳过自动全屏调用，由首页提示语引导用户「添加到主屏幕」
(function(){
  if(!isTouchDevice) return; // 电脑端不强制
  if(isInTapTap) return; // TapTap 容器自动全屏，不需要自动进入
  const _isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || _isiPadOS;
  if(_isiOS) return; // iOS Safari 无 Fullscreen API，跳过避免静默失败
  let _firstGestureDone = false;
  const autoEnter = ()=>{
    if(_firstGestureDone) return;
    _firstGestureDone = true;
    if(!isFullscreenNow()){
      enterFullscreen();
    }
    // 锁横屏
    try{
      const so = screen.orientation;
      if(so && typeof so.lock === 'function'){
        const p = so.lock('landscape');
        if(p && p.catch) p.catch(()=>{});
      }
    }catch(err){}
  };
  // 用 capture 阶段尽早响应，确保在用户手势上下文内调用 requestFullscreen
  document.addEventListener('touchstart', autoEnter, {passive:true, capture:true});
  document.addEventListener('click', autoEnter, {capture:true});
  // visibilitychange 回到页面时，若不在全屏则提示恢复
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible' && !isFullscreenNow()){
      setTimeout(showFsRestoreHint, 100);
    }
  });
  window.addEventListener('focus', ()=>{
    if(!isFullscreenNow()) setTimeout(showFsRestoreHint, 100);
  });
})();

// 遮罩内全屏按钮：点击后关闭遮罩并尝试全屏（iOS 上全屏失败也不卡死用户）
(function(){
  const btn = document.getElementById('rhFullscreenBtn');
  if(!btn) return;
  // 微信内 webview 不支持 requestFullscreen，按钮文本改为「直接开始」，
  // 点击仅关闭遮罩（不调用 toggleFullscreen，避免静默失败让用户以为按钮坏了）
  if(isInWechat){
    btn.textContent = '✕ 暂不添加，直接开始游戏';
  }
  const dismiss = (e)=>{
    if(e && e.preventDefault) e.preventDefault();
    _rotateHintDismissed = true;
    const hint = document.getElementById('rotateHint');
    if(hint) hint.classList.remove('show');
    // 微信内跳过全屏调用；其他环境尝试全屏（iOS 静默失败，Android Chrome 生效）
    if(!isInWechat){
      try{ toggleFullscreen(); }catch(err){}
    }
  };
  // click 加 _isSynthesizedClick 守卫：触屏笔记本上 touchstart 已触发一次进入全屏，
  // 合成的 click 会再次调用 toggleFullscreen 导致退出全屏
  btn.addEventListener('click', e=>{ if(typeof _isSynthesizedClick==='function'&&_isSynthesizedClick())return; dismiss(e); });
  btn.addEventListener('touchstart', dismiss, {passive:false});
})();

// 首页提示：在浏览器/微信打开时，提示全屏或添加到主屏幕
function showHomeTipIfMobile(){
  const tip = document.getElementById('homeFullscreenTip');
  if(!tip) return;
  const fsBtn = document.getElementById('fullscreenBtn');
  const bigBtn = document.getElementById('homeFullscreenBigBtn');
  // TapTap 试玩版容器自动全屏横屏、已实名认证，所有"全屏/添加主屏幕"提示都无意义
  if(typeof isInTapTap !== 'undefined' && isInTapTap){
    if(fsBtn) fsBtn.style.display = 'none';
    if(bigBtn) bigBtn.style.display = 'none';
    tip.classList.remove('show');
    return;
  }
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+ 桌面 UA
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  let html = '';

  // 微信内：提示在浏览器打开（iOS/Android 都适用）
  if(isInWechat){
    if(isIOS){
      html += '📲 微信内打不开，请按以下步骤：<br>';
      html += '① 点右上角 <b>···</b> → <b>在 Safari 中打开</b><br>';
      html += '② 在 Safari 里点底部 <b>分享 ↗</b> → <b>添加到主屏幕</b><br>';
      html += '③ 回桌面点图标，全屏横屏畅玩';
    }else{
      html += '📲 微信内打不开，请按以下步骤：<br>';
      html += '① 点右上角 <b>···</b> → <b>在浏览器打开</b><br>';
      html += '② 在浏览器里点菜单 <b>⋮</b> → <b>添加到主屏幕</b><br>';
      html += '③ 回桌面点图标，全屏横屏畅玩';
    }
    // 微信内隐藏全屏按钮（无效且误导）
    if(fsBtn) fsBtn.style.display = 'none';
    if(bigBtn) bigBtn.style.display = 'none';
  }else if(isStandalone){
    // 已经是主屏幕模式，全屏按钮已无意义，全部隐藏
    if(fsBtn) fsBtn.style.display = 'none';
    if(bigBtn) bigBtn.style.display = 'none';
    return; // 不显示提示
  }else if(isTouchDevice){
    if(isIOS){
      // iOS Safari 不支持 requestFullscreen API：隐藏全屏按钮，避免点击无效
      if(fsBtn) fsBtn.style.display = 'none';
      if(bigBtn) bigBtn.style.display = 'none';
      html += ' 📱 <b>请点底部「分享 ↗」→「添加到主屏幕」</b><br>回桌面点图标即可全屏横屏畅玩<br>横屏后可直接开始游戏（地址栏会自动收起）';
    }else{
      // Android Chrome 支持自动全屏 + 锁横屏
      // 绑定全屏按钮（仅绑一次），click 加 _isSynthesizedClick 守卫防止触屏笔记本双触发
      if(fsBtn && !fsBtn._bound){
        fsBtn._bound = true;
        fsBtn.addEventListener('click', e=>{ if(typeof _isSynthesizedClick==='function'&&_isSynthesizedClick())return; toggleFullscreen(); });
        fsBtn.addEventListener('touchstart', e=>{ e.preventDefault(); toggleFullscreen(); }, {passive:false});
      }
      if(bigBtn && !bigBtn._bound){
        bigBtn._bound = true;
        bigBtn.addEventListener('click', e=>{ if(typeof _isSynthesizedClick==='function'&&_isSynthesizedClick())return; toggleFullscreen(); });
        bigBtn.addEventListener('touchstart', e=>{ e.preventDefault(); toggleFullscreen(); }, {passive:false});
      }
      html += ' 📱 <b>触摸任意位置即自动全屏+锁横屏</b><br>无需手动操作，直接开玩<br>退出全屏会自动提示恢复';
    }
  }else{
    // PC 端：仅绑定全屏按钮，不显示提示
    if(fsBtn && !fsBtn._bound){
      fsBtn._bound = true;
      fsBtn.addEventListener('click', e=>{ if(typeof _isSynthesizedClick==='function'&&_isSynthesizedClick())return; toggleFullscreen(); });
    }
    if(bigBtn) bigBtn.style.display = 'none';
    return;
  }

  if(html){
    tip.innerHTML = html;
    tip.classList.add('show');
  }
}
// 运行时二次确认：只有真正发生过 touchstart 才启用触摸控制
let touchConfirmed = false;
let touchMoveX = 0, touchMoveY = 0; // 摇杆方向 (-1 to 1)
let touchFiring = false; // 是否正在射击
// 触摸移动向量（带模拟速度）
let touchMoveVec = {x:0, y:0, active:false};
const TOUCH_DEADZONE = 0.15; // 统一死区阈值

// 全局最近一次 touchstart 时间戳：用于防止触屏笔记本上 click+touchstart 双触发
// （触屏笔记本 pointer 为 fine，isTouchDevice=false，但触摸仍会触发 touchstart）
let _lastTouchAt = 0;

// 全局 touchstart 监听器：仅用于标记 touchConfirmed，告知系统已发生过触摸
// 注意：不再调用 e.preventDefault()，避免在多指场景下阻断只绑 click 的按钮合成事件
// （如奇遇事件面板按钮在摇杆激活时点击失效）。多指手势和双击缩放由 CSS touch-action 控制
document.addEventListener('touchstart', e=>{
  touchConfirmed = true;
  _lastTouchAt = Date.now();
}, {passive:true});

// 阻止 iOS Safari 双指缩放（user-scalable=no 在 iOS 10+ 被忽略，需用 gesturestart 事件阻止）
// 避免玩家误操作双指缩放整个页面导致游戏布局错乱
document.addEventListener('gesturestart', e=>{ e.preventDefault(); }, {passive:false});
document.addEventListener('gesturechange', e=>{ e.preventDefault(); }, {passive:false});

// 双触发守卫：click 事件中若距上次 touchstart 不足 500ms，认为是 touch 合成的 click，跳过
// 用于 pauseBtn/pauseResumeBtn/pauseHomeBtn 等同时绑 click+touchstart 的按钮
function _isSynthesizedClick(){
  return (Date.now() - _lastTouchAt) < 500;
}

// 在非游戏状态下隐藏触摸控件
function updateTouchControlsVisibility(){
  const tc = document.getElementById('touchControls');
  if(!tc) return;
  const pb = document.getElementById('pauseBtn');
  const inBattle = (gameState === 'fighting' || gameState === 'boss');
  // 暂停时隐藏摇杆（避免透过半透明暂停遮罩看到摇杆残影，UX不干净）
  if(isTouchDevice && touchConfirmed && inBattle && !isPaused){
    tc.style.display = 'block';
  }else{
    tc.style.display = 'none';
  }
  // 暂停按钮：所有设备战斗中显示（PC和手机都能用）
  if(pb){
    pb.style.display = inBattle ? 'flex' : 'none';
    pb.textContent = isPaused ? '▶' : '⏸';
  }
}

// 虚拟摇杆（浮动摇杆：左半屏任意位置按下即出现，松手消失）
const joystickZone = document.getElementById('joystickZone');
const joystickThumb = document.getElementById('joystickThumb');
const joystickBase = document.getElementById('joystickBase');
let joystickActive = false;
let joystickStartX = 0, joystickStartY = 0;
let joystickTouchId = null; // 跟踪触摸点 identifier，防止两摇杆互相抢
const joystickRadius = 42; // 摇杆活动半径（缩小后）

function handleJoystickStart(e){
  e.preventDefault();
  // 守卫：已激活时忽略新手指，防止第二指触摸同区域劫持摇杆
  // 注意：必须同时检查 active 和 touchId — resetTouchState 会清空 touchId 但旧手指可能仍在屏幕上
  // 若仅检查 active，旧手指抬起时 touchend 找不到匹配 id 会跳过清理，但若新手指已接管则会误清新手指
  if(joystickActive || joystickTouchId !== null) return;
  const touch = e.changedTouches ? e.changedTouches[0] : e;
  joystickTouchId = touch.identifier;
  // 浮动摇杆：起始点为手指按下位置（base/thumb 是 joystickZone 的子元素，坐标相对 joystickZone）
  const zoneRect = joystickZone.getBoundingClientRect();
  joystickStartX = touch.clientX;
  joystickStartY = touch.clientY;
  // 把 base/thumb 中心移到手指位置（用 left/top + transform:translate(-50%,-50%)）
  joystickBase.style.left = (touch.clientX - zoneRect.left) + 'px';
  joystickBase.style.top = (touch.clientY - zoneRect.top) + 'px';
  joystickThumb.style.left = (touch.clientX - zoneRect.left) + 'px';
  joystickThumb.style.top = (touch.clientY - zoneRect.top) + 'px';
  joystickBase.style.opacity = '1';
  joystickThumb.style.opacity = '1';
  joystickActive = true;
  handleJoystickMove(e);
}
function handleJoystickMove(e){
  if(!joystickActive || joystickTouchId === null) return;
  e.preventDefault();
  // 通过 identifier 找到属于本摇杆的触摸点，避免和右摇杆互相抢
  let touch = null;
  if(e.touches){
    for(let i=0;i<e.touches.length;i++){
      if(e.touches[i].identifier === joystickTouchId){ touch = e.touches[i]; break; }
    }
    if(!touch) return;
  }else{ touch = e; }
  let dx = touch.clientX - joystickStartX;
  let dy = touch.clientY - joystickStartY;
  const d = Math.sqrt(dx*dx + dy*dy);
  if(d > joystickRadius){
    dx = (dx / d) * joystickRadius;
    dy = (dy / d) * joystickRadius;
  }
  touchMoveX = dx / joystickRadius;
  touchMoveY = dy / joystickRadius;
  // thumb 中心已对齐 start 点，再叠加方向偏移（注意保留 translate(-50%,-50%) 居中）
  joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function handleJoystickEnd(e){
  e.preventDefault();
  // 只有本摇杆的触摸点抬起时才释放
  if(e.changedTouches && joystickTouchId !== null){
    let isMine = false;
    for(let i=0;i<e.changedTouches.length;i++){
      if(e.changedTouches[i].identifier === joystickTouchId){ isMine = true; break; }
    }
    if(!isMine) return;
  }
  joystickActive = false;
  joystickTouchId = null;
  touchMoveX = 0;
  touchMoveY = 0;
  touchMoveVec.active = false;
  // 隐藏摇杆
  joystickBase.style.opacity = '0';
  joystickThumb.style.opacity = '0';
  joystickThumb.style.transform = 'translate(-50%, -50%)';
}
joystickZone.addEventListener('touchstart', handleJoystickStart, {passive:false});
joystickZone.addEventListener('touchmove', handleJoystickMove, {passive:false});
joystickZone.addEventListener('touchend', handleJoystickEnd, {passive:false});
joystickZone.addEventListener('touchcancel', handleJoystickEnd, {passive:false});

// 右摇杆：控制射击方向+自动射击（浮动摇杆：右半屏任意位置按下即出现，松手消失）
const aimJoystickZone = document.getElementById('aimJoystickZone');
const aimJoystickThumb = document.getElementById('aimJoystickThumb');
const aimJoystickBase = document.getElementById('aimJoystickBase');
let aimJoystickActive = false;
let aimJoystickStartX = 0, aimJoystickStartY = 0;
let aimJoystickX = 0, aimJoystickY = 0; // 射击方向 (-1 to 1)
let aimJoystickTouchId = null; // 跟踪触摸点 identifier，防止两摇杆互相抢
const aimJoystickRadius = 60; // 加大右摇杆半径(原38)，给手指更大操作空间，减少瞄准困难

function handleAimJoystickStart(e){
  e.preventDefault();
  // 守卫：已激活时忽略新手指，防止第二指触摸同区域劫持摇杆
  // 注意：必须同时检查 active 和 touchId — resetTouchState 会清空 touchId 但旧手指可能仍在屏幕上
  if(aimJoystickActive || aimJoystickTouchId !== null) return;
  const touch = e.changedTouches ? e.changedTouches[0] : e;
  aimJoystickTouchId = touch.identifier;
  // 浮动摇杆：起始点为手指按下位置（base/thumb 是 aimJoystickZone 的子元素，坐标相对 aimJoystickZone）
  const zoneRect = aimJoystickZone.getBoundingClientRect();
  aimJoystickStartX = touch.clientX;
  aimJoystickStartY = touch.clientY;
  aimJoystickBase.style.left = (touch.clientX - zoneRect.left) + 'px';
  aimJoystickBase.style.top = (touch.clientY - zoneRect.top) + 'px';
  aimJoystickThumb.style.left = (touch.clientX - zoneRect.left) + 'px';
  aimJoystickThumb.style.top = (touch.clientY - zoneRect.top) + 'px';
  aimJoystickBase.style.opacity = '1';
  aimJoystickThumb.style.opacity = '1';
  aimJoystickActive = true;
  mouse.down = true; // 激活即开始射击
  handleAimJoystickMove(e);
}
function handleAimJoystickMove(e){
  if(!aimJoystickActive || aimJoystickTouchId === null) return;
  e.preventDefault();
  // 通过 identifier 找到属于本摇杆的触摸点，避免和左摇杆互相抢
  let touch = null;
  if(e.touches){
    for(let i=0;i<e.touches.length;i++){
      if(e.touches[i].identifier === aimJoystickTouchId){ touch = e.touches[i]; break; }
    }
    if(!touch) return;
  }else{ touch = e; }
  let dx = touch.clientX - aimJoystickStartX;
  let dy = touch.clientY - aimJoystickStartY;
  const d = Math.sqrt(dx*dx + dy*dy);
  if(d > aimJoystickRadius){
    dx = (dx / d) * aimJoystickRadius;
    dy = (dy / d) * aimJoystickRadius;
  }
  aimJoystickX = dx / aimJoystickRadius;
  aimJoystickY = dy / aimJoystickRadius;
  aimJoystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function handleAimJoystickEnd(e){
  e.preventDefault();
  // 只有本摇杆的触摸点抬起时才释放
  if(e.changedTouches && aimJoystickTouchId !== null){
    let isMine = false;
    for(let i=0;i<e.changedTouches.length;i++){
      if(e.changedTouches[i].identifier === aimJoystickTouchId){ isMine = true; break; }
    }
    if(!isMine) return;
  }
  aimJoystickActive = false;
  aimJoystickTouchId = null;
  aimJoystickX = 0;
  aimJoystickY = 0;
  mouse.down = false; // 松开停止射击
  // 隐藏摇杆
  aimJoystickBase.style.opacity = '0';
  aimJoystickThumb.style.opacity = '0';
  aimJoystickThumb.style.transform = 'translate(-50%, -50%)';
}
aimJoystickZone.addEventListener('touchstart', handleAimJoystickStart, {passive:false});
aimJoystickZone.addEventListener('touchmove', handleAimJoystickMove, {passive:false});
aimJoystickZone.addEventListener('touchend', handleAimJoystickEnd, {passive:false});
aimJoystickZone.addEventListener('touchcancel', handleAimJoystickEnd, {passive:false});

// 技能按钮（同时绑 touchstart 和 click，确保手机端和PC端都能触发）
const skillBtn = document.getElementById('skillBtn');
function triggerSkill(){
  // 暂停时拒绝触发，避免玩家以为触发了但恢复后未释放
  if(typeof isPaused!=='undefined' && isPaused) return;
  if(player && player.skillCooldown <= 0){
    keys['f'] = true;
    setTimeout(()=>{ keys['f'] = false; }, 100);
  }
}
skillBtn.addEventListener('touchstart', e=>{
  e.preventDefault();
  triggerSkill();
}, {passive:false});
skillBtn.addEventListener('click', e=>{
  // 仅在非触摸设备生效（触摸设备已由 touchstart 处理）
  // 触屏笔记本 isTouchDevice=false，但触摸仍会触发 touchstart，靠时间戳守卫防止双触发
  if(isTouchDevice && touchConfirmed) return;
  if(_isSynthesizedClick()) return;
  triggerSkill();
});

// 暂停按钮（手机和PC通用）
const pauseBtn = document.getElementById('pauseBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
function togglePause(){
  if(gameState !== 'fighting' && gameState !== 'boss') return;
  isPaused = !isPaused;
  if(isPaused){
    // 暂停时清空摇杆/触摸状态：玩家可能用另一只手按暂停按钮，主手指仍按在摇杆上
    // 不清空会导致暂停期间摇杆视觉残留，且 touchmove 仍会触发更新摇杆位置
    if(typeof resetTouchState==='function')resetTouchState();
    pauseOverlay.classList.remove('hidden');
    pauseOverlay.style.display = 'flex';
    if(bgmGain)bgmGain.gain.value=0; // 暂停时静音BGM
  }else{
    pauseOverlay.classList.add('hidden');
    pauseOverlay.style.display = 'none';
    // 恢复BGM音量（与audio.js中startBGM保持一致：普通0.12/试炼0.14，原0.07/0.06是翻倍前的旧值）
    if(bgmGain)bgmGain.gain.value=bgmMode==='trial'?0.14:0.12;
  }
  vibrate(20);
  updateTouchControlsVisibility();
}

// ==================== Android 后退键处理 ====================
// 防止游戏中误按后退键直接退出页面，丢失进度
let _historyPushed = false; // 是否已推入历史记录
function _pushGameState(){
  if(_historyPushed) return;
  try{
    history.pushState({gameActive:true}, '');
    _historyPushed = true;
  }catch(e){}
}
function _clearGameState(){
  if(!_historyPushed) return;
  _historyPushed = false;
  // 不主动 history.back()，避免触发 popstate
}
window.addEventListener('popstate', e=>{
  // 游戏中按后退键：改为暂停（而不是退出）
  if(gameState==='fighting' || gameState==='boss'){
    if(!isPaused){
      togglePause();
    }
    // 重新推入历史记录，再次按后退键仍触发暂停而非退出
    try{ history.pushState({gameActive:true}, ''); }catch(e){}
  }else if(gameState==='upgrade' || gameState==='adventure'){
    // 升级/奇遇面板中：不处理，让用户先做选择
    try{ history.pushState({gameActive:true}, ''); }catch(e){}
  }else if(isPaused && (gameState==='fighting' || gameState==='boss')){
    // 暂停状态下按后退：继续暂停并保持历史
    try{ history.pushState({gameActive:true}, ''); }catch(e){}
  }
  // 其他状态（menu/gameover/wavePrepare）：允许后退，不拦截
});
function resumeFromPause(){
  if(isPaused){
    isPaused = false;
    if(bgmGain&&bgmGain.gain)bgmGain.gain.value=bgmMode==='trial'?0.14:0.12;
    pauseOverlay.classList.add('hidden');
    pauseOverlay.style.display = 'none';
    updateTouchControlsVisibility();
  }
}
function quitToMainMenu(){
  _runToken++; // 丢弃本局残留的 gameTimeout 回调，防止覆盖主菜单
  // 清理死亡动画定时器：防止 deathTimeout 回调在主菜单上弹出 gameOver
  if(typeof deathTimeout!=='undefined' && deathTimeout){clearTimeout(deathTimeout); deathTimeout=null;}
  if(typeof deathAnimation!=='undefined')deathAnimation=null;
  if(typeof resetTouchState==='function')resetTouchState(); // 清空摇杆/触摸状态
  isPaused = false;
  isPausedByVisibility = false;
  pauseOverlay.classList.add('hidden');
  pauseOverlay.style.display = 'none';
  gameState = 'menu';
  showMainMenu();
  updateTouchControlsVisibility();
}
pauseBtn.addEventListener('click', e=>{ if(_isSynthesizedClick())return; togglePause(); });
pauseBtn.addEventListener('touchstart', e=>{ e.preventDefault(); togglePause(); }, {passive:false});
document.getElementById('pauseResumeBtn').addEventListener('click', e=>{ if(_isSynthesizedClick())return; resumeFromPause(); });
document.getElementById('pauseResumeBtn').addEventListener('touchstart', e=>{ e.preventDefault(); resumeFromPause(); }, {passive:false});
document.getElementById('pauseHomeBtn').addEventListener('click', e=>{ if(_isSynthesizedClick())return; quitToMainMenu(); });
document.getElementById('pauseHomeBtn').addEventListener('touchstart', e=>{ e.preventDefault(); quitToMainMenu(); }, {passive:false});

// 触摸瞄准：右摇杆控制射击方向，左摇杆控制移动
function updateTouchAim(){
  if(!isTouchDevice || !touchConfirmed || !player) return;
  // 右摇杆激活且有明确方向（超出死区）时：射击方向跟随右摇杆
  if(aimJoystickActive && (Math.abs(aimJoystickX) > TOUCH_DEADZONE || Math.abs(aimJoystickY) > TOUCH_DEADZONE)){
    mouse.x = player.x + aimJoystickX * 400;
    mouse.y = player.y + aimJoystickY * 400;
  }else{
    // 右摇杆未激活 或 在死区内：自动瞄准最近敌人
    // （修复 b12：死区内也更新 mouse，避免射击方向卡住；
    //  修复 b13：无敌人时跟随移动方向，避免玩家朝固定方向射击）
    let nearest = null, nd = 500;
    for(const e of enemies){
      if(!e.alive) continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if(d < nd){ nd = d; nearest = e; }
    }
    if(boss && boss.alive){
      const d = dist(player.x, player.y, boss.x, boss.y);
      if(d < nd * 1.5){ nearest = boss; }
    }
    if(nearest){
      mouse.x = nearest.x;
      mouse.y = nearest.y;
    }else if(touchMoveVec.active){
      // 无敌人时：射击方向跟随移动方向（边走边射）
      mouse.x = player.x + touchMoveVec.x * 400;
      mouse.y = player.y + touchMoveVec.y * 400;
    }
    // 否则保持上次 mouse 坐标（不强制朝向初始位置）
  }
}

// 更新技能按钮CD状态
function updateSkillBtnCD(){
  if(!isTouchDevice || !touchConfirmed || !player) return;
  if(player.skillCooldown > 0){
    skillBtn.classList.add('cooldown');
    skillBtn.textContent = Math.ceil(player.skillCooldown) + 's';
  }else{
    skillBtn.classList.remove('cooldown');
    skillBtn.textContent = '技能';
  }
}

// 同步触摸输入：设置 touchMoveVec 供 Player.update 使用
function syncTouchToKeys(){
  if(!isTouchDevice || !touchConfirmed) return;
  if(joystickActive && (Math.abs(touchMoveX) > TOUCH_DEADZONE || Math.abs(touchMoveY) > TOUCH_DEADZONE)){
    touchMoveVec.x = touchMoveX;
    touchMoveVec.y = touchMoveY;
    touchMoveVec.active = true;
  }else{
    touchMoveVec.active = false;
  }
}

// ==================== 页面可见性暂停（手机切后台自动暂停）====================
let isPausedByVisibility = false;
let prevPausedState = false;
// 同步暂停面板显示状态
function syncPauseOverlay(){
  if(!pauseOverlay) return;
  if(isPaused){
    pauseOverlay.classList.remove('hidden');
    pauseOverlay.style.display = 'flex';
  }else{
    pauseOverlay.classList.add('hidden');
    pauseOverlay.style.display = 'none';
  }
}
// 清空所有触摸/摇杆状态：切后台或失焦时调用，避免回前台后玩家持续移动/射击
function resetTouchState(){
  if(typeof keys!=='undefined'){for(const k in keys)keys[k]=false;}
  if(typeof mouse!=='undefined')mouse.down=false;
  // 清空摇杆状态，防止 iOS 不触发 touchend 导致玩家持续移动
  if(typeof joystickActive!=='undefined'){
    joystickActive=false; joystickTouchId=null;
    // 浮动摇杆：重置时隐藏并归位
    if(typeof joystickBase!=='undefined'&&joystickBase)joystickBase.style.opacity='0';
    if(typeof joystickThumb!=='undefined'&&joystickThumb){
      joystickThumb.style.opacity='0';
      joystickThumb.style.transform='translate(-50%, -50%)';
    }
  }
  if(typeof aimJoystickActive!=='undefined'){
    aimJoystickActive=false; aimJoystickTouchId=null;
    if(typeof aimJoystickBase!=='undefined'&&aimJoystickBase)aimJoystickBase.style.opacity='0';
    if(typeof aimJoystickThumb!=='undefined'&&aimJoystickThumb){
      aimJoystickThumb.style.opacity='0';
      aimJoystickThumb.style.transform='translate(-50%, -50%)';
    }
  }
  if(typeof touchMoveX!=='undefined'){touchMoveX=0; touchMoveY=0;}
  if(typeof touchMoveVec!=='undefined')touchMoveVec.active=false;
  if(typeof touchFiring!=='undefined')touchFiring=false;
}
document.addEventListener('visibilitychange', () => {
  if(document.hidden){
    // 切到后台：清空所有输入状态防止卡住（iOS 切后台可能不触发 touchend）
    resetTouchState();
    // 切到后台：若正在战斗则暂停（仅记录一次 prevPausedState，避免 blur/visibilitychange 重复覆盖）
    if((gameState === 'fighting' || gameState === 'boss') && !isPausedByVisibility){
      prevPausedState = isPaused;
      isPaused = true;
      isPausedByVisibility = true;
      syncPauseOverlay();
    }
  }else{
    // 回到前台：恢复之前的暂停状态
    if(isPausedByVisibility){
      isPaused = prevPausedState;
      isPausedByVisibility = false;
      lastTime = 0; // 重置时间，避免累积大 dt
      syncPauseOverlay();
      // 尝试恢复AudioContext（切后台会被系统suspend）
      if(typeof audioCtx!=='undefined'&&audioCtx&&audioCtx.state==='suspended'){
        audioCtx.resume().catch(()=>{});
      }
      // 恢复BGM：切后台时BGM定时器链可能断裂，需要重启
      if(typeof bgmMode!=='undefined' && bgmMode && typeof startBGM==='function'){
        // 检查 BGM 是否已停（bgmPlaying 标志可能不准，靠 audioCtx 时间和 bgmTimer 状态判断）
        if(typeof bgmPlaying==='undefined' || !bgmPlaying || (typeof bgmTimer!=='undefined' && !bgmTimer)){
          startBGM(bgmMode);
        }
      }
    }
  }
});
// 窗口失焦也暂停（PC 玩家切窗口）
window.addEventListener('blur', () => {
  resetTouchState();
  // 仅当尚未被 visibilitychange 暂停时才设置 prevPausedState，避免覆盖
  if((gameState === 'fighting' || gameState === 'boss') && !isPaused && !isPausedByVisibility){
    prevPausedState = isPaused;
    isPaused = true;
    isPausedByVisibility = true;
    syncPauseOverlay();
  }
});
window.addEventListener('focus', () => {
  if(isPausedByVisibility){
    isPaused = prevPausedState;
    isPausedByVisibility = false;
    lastTime = 0;
    syncPauseOverlay();
    // focus 也尝试恢复 AudioContext（部分浏览器 visibilitychange 不触发但 focus 触发）
    if(typeof audioCtx!=='undefined'&&audioCtx&&audioCtx.state==='suspended'){
      audioCtx.resume().catch(()=>{});
    }
    // 恢复BGM：focus 触发时也尝试重启 BGM（与 visibilitychange 共用逻辑）
    if(typeof bgmMode!=='undefined' && bgmMode && typeof startBGM==='function'){
      if(typeof bgmPlaying==='undefined' || !bgmPlaying || (typeof bgmTimer!=='undefined' && !bgmTimer)){
        startBGM(bgmMode);
      }
    }
  }
});

// ==================== 手机振动反馈 ====================
function vibrate(pattern){
  if(!isTouchDevice || !touchConfirmed) return;
  try{
    if(navigator.vibrate) navigator.vibrate(pattern);
  }catch(e){}
}

// ==================== 初始化 ====================
loadSave();
showMainMenu();
// 首次进入游戏显示开场故事,否则显示更新公告
// 新手引导：首次进入或未看过教程时显示（与故事/公告串行，内部会等待它们关闭）
// 这些弹窗都是 position:fixed，会被浏览器地址栏/工具栏遮挡。
// 因此在触摸设备 + 非全屏 + 非standalone + 非微信 环境下，先显示全屏引导遮罩，
// 用户点击"全屏开始"后进入全屏，再继续显示故事/公告/教程。
const _showWelcomeFlow = () => {
  // 首次玩家：故事 → 故事关闭后看教程（跳过更新公告，避免三连弹窗劝退）
  // 老玩家：更新公告（如有新版本）→ 公告关闭后看教程（如未看过）
  if(!saveData.storyViewed){
    // 首次玩家：showOpeningStory 是同步模态弹窗，教程必须在故事关闭后才显示
    // 通过 hack：在 showOpeningStory 后监听 storyOverlay 的 remove 事件
    showOpeningStory();
    // 等待故事关闭后再显示教程（轮询检测 storyOverlay 是否被移除）
    if(!saveData.tutorialShown && typeof showTutorial === 'function'){
      const _waitStoryClose = setInterval(()=>{
        const el = document.getElementById('storyOverlay');
        if(!el){
          clearInterval(_waitStoryClose);
          if(!saveData.tutorialShown){
            showTutorial();
          }
        }
      }, 200);
    }
  }else{
    showUpdateNotice();
    // 老玩家：等待公告关闭后再显示教程（如未看过）
    if(!saveData.tutorialShown && typeof showTutorial === 'function'){
      const _waitNoticeClose = setInterval(()=>{
        const el = document.getElementById('noticeOverlay');
        if(!el){
          clearInterval(_waitNoticeClose);
          if(!saveData.tutorialShown){
            showTutorial();
          }
        }
      }, 200);
    }
  }
};
const _isStandaloneMode = () => {
  return window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
};
// 触摸设备 + 非standalone + 非微信 + 当前未全屏 → 需要全屏引导
const _needsInitialFullscreenGuide = () => {
  if(!isTouchDevice) return false;
  if(_isStandaloneMode()) return false;
  if(isInWechat) return false; // 微信内无法全屏，另有提示
  if(isFullscreenNow()) return false;
  return true;
};
const _showInitialFullscreenGuide = (onContinue) => {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let html = `<div id="initialFsGuide" style="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)">`;
  html += `<div style="max-width:440px;width:100%;text-align:center;padding:28px 24px;background:linear-gradient(180deg,#1a1408,#2a1f10);border:2px solid #ffd700;border-radius:16px;box-shadow:0 0 40px rgba(255,215,0,0.3);font-family:'STKaiti',KaiTi,serif">`;
  html += `<div style="font-size:56px;margin-bottom:14px">⛶</div>`;
  html += `<h2 style="color:#ffd700;letter-spacing:4px;margin:0 0 12px;font-size:20px;text-shadow:0 0 10px rgba(255,215,0,0.4)">横屏全屏体验更佳</h2>`;
  if(isIOS){
    // iOS Safari 不支持 requestFullscreen API，只能引导用户"添加到主屏幕"
    html += `<div style="color:#e0d8c8;font-size:13px;line-height:1.9;margin-bottom:18px">请将设备<b style="color:#ffd970">横屏旋转</b>，<br>然后点击下方按钮开始游戏。<br><span style="color:#8b949e;font-size:11px">如需完全无遮挡：点底部分享 ↗ → 添加到主屏幕</span></div>`;
    html += `<button id="initialFsStartBtn" style="width:100%;padding:14px;background:linear-gradient(135deg,#ffd970,#d4a020);color:#1a1f2e;border:none;border-radius:10px;font-size:16px;font-weight:bold;letter-spacing:3px;cursor:pointer;font-family:'STKaiti',KaiTi,serif;box-shadow:0 0 20px rgba(255,215,0,0.5)">✦ 横屏后点此开始 ✦</button>`;
  }else{
    // Android Chrome 支持自动全屏 + 锁横屏
    html += `<div style="color:#e0d8c8;font-size:13px;line-height:1.9;margin-bottom:18px">请将设备<b style="color:#ffd970">横屏旋转</b>，<br>点击下方按钮进入全屏模式，<br>地址栏/工具栏将自动隐藏。</div>`;
    html += `<button id="initialFsStartBtn" style="width:100%;padding:14px;background:linear-gradient(135deg,#ffd970,#d4a020);color:#1a1f2e;border:none;border-radius:10px;font-size:16px;font-weight:bold;letter-spacing:3px;cursor:pointer;font-family:'STKaiti',KaiTi,serif;box-shadow:0 0 20px rgba(255,215,0,0.5)">⛶ 全屏开始游戏</button>`;
    html += `<button id="initialFsSkipBtn" style="margin-top:10px;padding:6px 16px;background:transparent;color:#8b949e;border:none;font-size:11px;cursor:pointer;font-family:'STKaiti',KaiTi,serif">暂不全屏，直接开始 ⏭</button>`;
  }
  html += `</div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const closeAndContinue = () => {
    const el = document.getElementById('initialFsGuide');
    if(el) el.remove();
    if(onContinue) onContinue();
  };
  const startBtn = document.getElementById('initialFsStartBtn');
  const skipBtn = document.getElementById('initialFsSkipBtn');
  if(startBtn){
    const onStart = (e) => {
      if(e && e.preventDefault) e.preventDefault();
      // Android Chrome 尝试进入全屏；iOS 静默失败
      if(!isIOS){
        try{ toggleFullscreen(); }catch(err){}
      }
      closeAndContinue();
    };
    startBtn.addEventListener('click', e=>{ if(typeof _isSynthesizedClick==='function'&&_isSynthesizedClick())return; onStart(e); });
    startBtn.addEventListener('touchstart', onStart, {passive:false});
  }
  if(skipBtn){
    const onSkip = (e) => { if(e && e.preventDefault) e.preventDefault(); closeAndContinue(); };
    skipBtn.addEventListener('click', e=>{ if(typeof _isSynthesizedClick==='function'&&_isSynthesizedClick())return; onSkip(e); });
    skipBtn.addEventListener('touchstart', onSkip, {passive:false});
  }
};
if(_needsInitialFullscreenGuide()){
  _showInitialFullscreenGuide(_showWelcomeFlow);
}else{
  _showWelcomeFlow();
}
requestAnimationFrame(gameLoop);
