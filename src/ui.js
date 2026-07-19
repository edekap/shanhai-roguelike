// ==================== UI更新 ====================
// 统一按钮绑定工具：同时绑定 click 和 touchstart，避免移动端 300ms 延迟
// click 加 _isSynthesizedClick 守卫防止触屏笔记本双触发
// touchstart 带 preventDefault 阻止合成 click 事件
// 检查 el.disabled 防止 disabled 按钮在 touchstart 上仍触发（HTML disabled 只阻止 click 不阻止 touchstart）
function _bindTap(el, handler){
  if(!el || typeof handler !== 'function') return;
  el.addEventListener('click', e=>{ if(el.disabled)return; if(typeof _isSynthesizedClick==='function'&&_isSynthesizedClick())return; handler(e); });
  el.addEventListener('touchstart', e=>{ if(el.disabled)return; e.preventDefault(); handler(e); }, {passive:false});
}
// 批量绑定：selector 下的所有元素
function _bindTapAll(selector, handler){
  document.querySelectorAll(selector).forEach(el=>_bindTap(el, handler));
}
// 装备菜单专用模态弹窗：z-index 100 高于 gearOverlay(30)/adventureOverlay(35)/bossCaptureOverlay(40)，
// 避免 #gearOverlay 内的二次确认弹窗被自身遮挡（旧代码用 #overlay z-index:20 会被 gearOverlay 盖住）
// 注意：align-items 用 flex-start 而非 center — center 在内容超高时会让顶部溢出无法滚动到达
function _showGearModal(html){
  let modal=document.getElementById('gearModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='gearModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:16px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);overflow-y:auto;-webkit-overflow-scrolling:touch';
    // 点击背景关闭（点在 modal 自身而非子元素时）
    modal.addEventListener('click',(e)=>{ if(e.target===modal)_hideGearModal(); });
    document.body.appendChild(modal);
  }
  modal.innerHTML=html;
  modal.style.display='flex';
  return modal;
}
function _hideGearModal(){
  const modal=document.getElementById('gearModal');
  if(modal)modal.style.display='none';
}
// 性能优化：缓存所有DOM引用，避免每帧调用getElementById
const _ui = {
  healthText:null, healthBar:null, shieldBarWrap:null, shieldBar:null,
  skillBar:null, scoreText:null, gameScore:null,
  xpLevel:null, xpText:null, xpBar:null,
  waveLabel:null, weaponText:null, petInfo:null, abilityInfo:null, relicInfo:null,
  bossBarFill:null, timerBar:null,
  // 脏标记缓存值，只在变化时写DOM
  _lastHealth:'', _lastShield:'', _lastSkill:-1, _lastScore:-1,
  _lastXp:'', _lastWave:'', _lastWeapon:'', _lastPet:'', _lastAbil:'', _lastRelics:'',
  _lastBossHp:-1, _lastTimerPct:-1, _lastTimerTxt:'', _initDone:false
};
function _initUICache(){
  if(_ui._initDone)return;
  _ui.healthText=document.getElementById('healthText');
  _ui.healthBar=document.getElementById('healthBar');
  _ui.shieldBarWrap=document.getElementById('shieldBarWrap');
  _ui.shieldBar=document.getElementById('shieldBar');
  _ui.skillBar=document.getElementById('skillBar');
  _ui.scoreText=document.getElementById('scoreText');
  _ui.gameScore=document.getElementById('gameScore');
  _ui.xpLevel=document.getElementById('xpLevel');
  _ui.xpText=document.getElementById('xpText');
  _ui.xpBar=document.getElementById('xpBar');
  _ui.waveLabel=document.getElementById('waveLabel');
  _ui.weaponText=document.getElementById('weaponText');
  _ui.petInfo=document.getElementById('petInfo');
  _ui.abilityInfo=document.getElementById('abilityInfo');
  _ui.relicInfo=document.getElementById('relicInfo');
  _ui.bossBarFill=document.getElementById('bossBarFill');
  _ui.timerBar=document.getElementById('timerBar');
  _ui._initDone=true;
}
function updateUI(){
  if(!player)return;
  if(!_ui._initDone)_initUICache();
  // 生命值（仅变化时写DOM）
  const hpTxt=`${Math.ceil(player.health)}/${player.maxHealth}`;
  if(hpTxt!==_ui._lastHealth){_ui.healthText.textContent=hpTxt;_ui._lastHealth=hpTxt;}
  const hpPct=Math.max(0,player.health/player.maxHealth*100)+'%';
  _ui.healthBar.style.width=hpPct;
  // 护盾
  const shTxt=player.shield>0?'block':'none';
  if(_ui._lastShield!==shTxt){
    _ui.shieldBarWrap.style.display=shTxt;
    _ui._lastShield=shTxt;
  }
  if(player.shield>0)_ui.shieldBar.style.width=(player.maxShield>0?player.shield/player.maxShield*100:0)+'%';
  // 技能CD
  const skPct=(player.maxSkillCooldown>0?(1-player.skillCooldown/player.maxSkillCooldown)*100:0);
  if(Math.abs(skPct-_ui._lastSkill)>1){_ui.skillBar.style.width=skPct+'%';_ui._lastSkill=skPct;}
  // 分数
  if(score!==_ui._lastScore){
    _ui.scoreText.textContent=score;
    _ui.gameScore.textContent=score;
    _ui._lastScore=score;
  }
  // 经验值
  const xpTxt=`${player.xp}/${player.xpToNext}`;
  if(xpTxt!==_ui._lastXp){
    _ui.xpLevel.textContent=player.xpLevel;
    _ui.xpText.textContent=xpTxt;
    _ui._lastXp=xpTxt;
  }
  _ui.xpBar.style.width=Math.min(100,player.xp/player.xpToNext*100)+'%';
  // 波次
  const wTxt=endlessMode?`♾️无尽${endlessWave}波 ${gameState==='boss'?'BOSS':'波次'+currentWave}`:`第${currentLevel}关 ${gameState==='boss'?'BOSS':'波次'+currentWave}`;
  if(wTxt!==_ui._lastWave){_ui.waveLabel.textContent=wTxt;_ui._lastWave=wTxt;}
  // 武器
  const ws=getWeaponStats(saveData.currentWeapon);
  let wt=ws.name; if(ws.stage>0)wt+='+'+'★'.repeat(ws.stage);
  if(wt!==_ui._lastWeapon){_ui.weaponText.textContent=wt;_ui._lastWeapon=wt;}
  // 宠物信息
  let petTxt='';
  if(saveData.selectedPet!==null&&saveData.ownedPets[saveData.selectedPet]){
    const p=saveData.ownedPets[saveData.selectedPet]; const pd=getPetDef(p.def);
    petTxt=`${pd.icon} ${pd.name} ★${p.stage+1}`;
  }
  if(petTxt!==_ui._lastPet){_ui.petInfo.textContent=petTxt;_ui._lastPet=petTxt;}
  // 技能信息
  const abs=[];
  if(player.specialEffects?.fireball)abs.push('🔥');
  if(player.specialEffects?.lightning)abs.push('⚡');
  if(player.specialEffects?.tornado)abs.push('🌪️');
  const abTxt=abs.join(' ');
  if(abTxt!==_ui._lastAbil){_ui.abilityInfo.textContent=abTxt;_ui._lastAbil=abTxt;}
  // 遗物信息
  let relicTxt='';
  if(activeRelics.length>0)relicTxt='✨ '+activeRelics.map(r=>r.icon).join(' ');
  if(relicTxt!==_ui._lastRelics){if(_ui.relicInfo)_ui.relicInfo.textContent=relicTxt;_ui._lastRelics=relicTxt;}
}
function updateBossUI(){
  if(!boss)return;
  if(!_ui._initDone)_initUICache();
  const pct=Math.max(0,boss.health/boss.maxHealth*100);
  if(Math.abs(pct-_ui._lastBossHp)>0.5){_ui.bossBarFill.style.width=pct+'%';_ui._lastBossHp=pct;}
}
function updateTimerUI(){
  if(!_ui._initDone)_initUICache();
  const tb=_ui.timerBar||document.getElementById('timerBar');
  const pct=Math.max(0,levelTimer/maxLevelTime*100);
  tb.style.width=pct+'%';
  let txt=Math.ceil(levelTimer)+'s';
  // 时间挑战显示
  if(bossTimeChallenge&&bossTimeChallenge.active&&gameState==='boss'){
    const t=Math.ceil(bossTimeChallenge.time);
    txt+=` | ⚡${t}s`;
    if(t<=10){tb.style.background='linear-gradient(90deg,#ff6347,#f85149)';tb.style.boxShadow='0 0 14px rgba(255,99,71,0.8)';}
    else if(t<=20){tb.style.background='linear-gradient(90deg,#ffd700,#f0883e)';tb.style.boxShadow='0 0 12px rgba(255,215,0,0.6)';}
    else{tb.style.background='linear-gradient(90deg,#3fb950,#58a6ff)';tb.style.boxShadow='0 0 10px rgba(63,185,80,0.5)';}
  }else{
    tb.style.background=''; tb.style.boxShadow='';
  }
  if(_ui.timerText)_ui.timerText.textContent=txt;
  else{const el=document.getElementById('timerText');if(el)_ui.timerText=el; if(_ui.timerText)_ui.timerText.textContent=txt;}
}

// ==================== 背景绘制 ====================
// 静态背景（网格+边界）缓存到离屏canvas，避免每帧重画80+次stroke
let _bgCacheCanvas = null;
let _bgCacheCtx = null;
function _ensureBgCache(){
  if(_bgCacheCanvas) return;
  _bgCacheCanvas = document.createElement('canvas');
  _bgCacheCanvas.width = CONFIG.WIDTH;
  _bgCacheCanvas.height = CONFIG.HEIGHT;
  _bgCacheCtx = _bgCacheCanvas.getContext('2d');
  // 底色
  _bgCacheCtx.fillStyle = '#161b22';
  _bgCacheCtx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  // 网格
  _bgCacheCtx.strokeStyle = 'rgba(48,54,61,0.3)';
  _bgCacheCtx.lineWidth = 1;
  for(let x = 0; x < CONFIG.WIDTH; x += 40){
    _bgCacheCtx.beginPath();
    _bgCacheCtx.moveTo(x, 0);
    _bgCacheCtx.lineTo(x, CONFIG.HEIGHT);
    _bgCacheCtx.stroke();
  }
  for(let y = 0; y < CONFIG.HEIGHT; y += 40){
    _bgCacheCtx.beginPath();
    _bgCacheCtx.moveTo(0, y);
    _bgCacheCtx.lineTo(CONFIG.WIDTH, y);
    _bgCacheCtx.stroke();
  }
  // 边界
  _bgCacheCtx.strokeStyle = '#30363d';
  _bgCacheCtx.lineWidth = 3;
  _bgCacheCtx.strokeRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
}
function drawBackground(dt){
  _ensureBgCache();
  // 屏幕震动效果
  ctx.save();
  if(screenShake>0){
    ctx.translate(rand(-screenShake*10,screenShake*10),rand(-screenShake*10,screenShake*10));
    // 触发手机振动（仅在大震动时，避免过度反馈）
    if(screenShake > 0.5 && !window._lastVibrate){
      window._lastVibrate = true;
      vibrate(30);
      setTimeout(()=>{ window._lastVibrate = false; }, 200);
    }
    screenShake-=dt||0.016;
    if(screenShake<0)screenShake=0;
  }
  // 整体blit缓存背景（1次drawImage替代80+次stroke）
  ctx.drawImage(_bgCacheCanvas, 0, 0);
  ctx.restore();
  // 屏幕闪光效果
  if(screenFlash&&screenFlash.life>0){
    const a=screenFlash.life/screenFlash.maxLife;
    const c=screenFlash.color;
    const cr=parseInt(c.substr(1,2),16),cg=parseInt(c.substr(3,2),16),cb=parseInt(c.substr(5,2),16);
    ctx.fillStyle=`rgba(${cr},${cg},${cb},${a*0.4})`;
    ctx.fillRect(0,0,CONFIG.WIDTH,CONFIG.HEIGHT);
    screenFlash.life-=dt||0.016;
    if(screenFlash.life<=0)screenFlash=null;
  }
  // 低血量警告：屏幕边缘红色脉动
  if(lowHpWarning.active && player && player.alive){
    lowHpWarning.pulseTimer -= dt||0.016;
    const pulse = 0.5 + Math.sin(_NOW * 0.008) * 0.3; // 脉动频率
    const alpha = 0.15 + pulse * 0.2;
    // 四边缘红色渐变
    const edgeWidth = 80;
    const grad = ctx.createLinearGradient(0, 0, 0, edgeWidth);
    grad.addColorStop(0, `rgba(200,30,30,${alpha})`);
    grad.addColorStop(1, `rgba(200,30,30,0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.WIDTH, edgeWidth);
    // 下边缘
    const grad2 = ctx.createLinearGradient(0, CONFIG.HEIGHT - edgeWidth, 0, CONFIG.HEIGHT);
    grad2.addColorStop(0, `rgba(200,30,30,0)`);
    grad2.addColorStop(1, `rgba(200,30,30,${alpha})`);
    ctx.fillStyle = grad2;
    ctx.fillRect(0, CONFIG.HEIGHT - edgeWidth, CONFIG.WIDTH, edgeWidth);
    // 左边缘
    const grad3 = ctx.createLinearGradient(0, 0, edgeWidth, 0);
    grad3.addColorStop(0, `rgba(200,30,30,${alpha})`);
    grad3.addColorStop(1, `rgba(200,30,30,0)`);
    ctx.fillStyle = grad3;
    ctx.fillRect(0, 0, edgeWidth, CONFIG.HEIGHT);
    // 右边缘
    const grad4 = ctx.createLinearGradient(CONFIG.WIDTH - edgeWidth, 0, CONFIG.WIDTH, 0);
    grad4.addColorStop(0, `rgba(200,30,30,0)`);
    grad4.addColorStop(1, `rgba(200,30,30,${alpha})`);
    ctx.fillStyle = grad4;
    ctx.fillRect(CONFIG.WIDTH - edgeWidth, 0, edgeWidth, CONFIG.HEIGHT);
    // 心跳音效（每1.2秒一次）
    lowHpWarning.heartbeatTimer -= dt||0.016;
    if(lowHpWarning.heartbeatTimer <= 0){
      playSound('heartbeat');
      lowHpWarning.heartbeatTimer = 1.2;
    }
  }
}
function flashScreen(color,duration){
  screenFlash={color,life:duration,maxLife:duration};
}
function drawWarnings(dt){
  // 更新计时器（所有警告按timer/time过期，使用实际dt与技能计时器同步）
  for(const w of bossWarnings){if(w.timer!==undefined)w.timer-=dt;if(w.time!==undefined)w.time-=dt;}
  // 过滤：所有计时器归零的警告都移除（boss关联的也按timer过期，避免stale预警残留）
  bossWarnings=bossWarnings.filter(w=>(w.timer===undefined||w.timer>0)&&(w.time===undefined||w.time>0));
  for(const w of bossWarnings){
    const prog=1-(w.time!==undefined?w.time:w.timer!==undefined?w.timer:0)/((w.maxTime!==undefined?w.maxTime:w.maxTimer!==undefined?w.maxTimer:1));
    const a=0.2+prog*0.5;
    const pulse=0.6+Math.sin(_NOW*0.012)*0.3;
    const wc=w.color||'rgba(248,81,73';
    ctx.fillStyle=`${wc},${a*0.3})`; ctx.strokeStyle=`${wc},${a*pulse})`; ctx.lineWidth=3;
    // 通用：为所有圆形预警添加内层渐变光晕
    const drawWarnCircle=(x,y,r)=>{
      const grad=ctx.createRadialGradient(x,y,0,x,y,r);
      grad.addColorStop(0,`${wc},${a*0.5})`);
      grad.addColorStop(0.6,`${wc},${a*0.2})`);
      grad.addColorStop(1,`${wc},0)`);
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      // 旋转虚线外圈
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(_NOW*0.004);
      ctx.strokeStyle=`${wc},${a*pulse})`;
      ctx.setLineDash([12,6]);
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // 倒计时内圈
      if(prog<0.9){
        ctx.strokeStyle=`${wc},${a*0.6})`;
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(x,y,r*(1-prog),0,Math.PI*2); ctx.stroke();
      }
    };
    if(w.type==='special2'&&w.data){
      const d=w.data;
      if(d.beamType==='horizontal'){
        ctx.fillRect(0,d.y-50,CONFIG.WIDTH,100);
        ctx.strokeRect(0,d.y-50,CONFIG.WIDTH,100);
        if(prog>0.7){ctx.fillStyle=`${wc},${a*0.5})`;ctx.fillRect(0,d.y-50,CONFIG.WIDTH,100);}
      }else if(d.beamType==='vertical'){
        ctx.fillRect(d.x-50,0,100,CONFIG.HEIGHT);
        ctx.strokeRect(d.x-50,0,100,CONFIG.HEIGHT);
        if(prog>0.7){ctx.fillStyle=`${wc},${a*0.5})`;ctx.fillRect(d.x-50,0,100,CONFIG.HEIGHT);}
      }else if(d.beamType==='fan'){
        for(const ang of d.angles){
          ctx.beginPath();
          ctx.moveTo(d.x,d.y);
          ctx.arc(d.x,d.y,600,ang-0.15,ang+0.15);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }else if(d.beamType==='zone'){
        ctx.beginPath(); ctx.arc(d.x,d.y,d.radius,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(d.x,d.y,d.radius*0.3,0,Math.PI*2); ctx.stroke();
      }else if(d.beamType==='concentric'){
        // 计蒙洪水波纹预警：3个同心圆
        for(let i=0;i<3;i++){
          const r=d.radius?d.radius*(0.3+i*0.3):100*(i+1);
          ctx.beginPath(); ctx.arc(d.x,d.y,r,0,Math.PI*2); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(d.x,d.y,30,0,Math.PI*2); ctx.fill();
      }else if(d.positions){
        for(const p of d.positions){
          if(p.horizontal!==undefined&&p.length){
            // 穷奇虚空裂缝：长条形预警
            const w=p.horizontal?p.length:40;
            const h=p.horizontal?40:p.length;
            ctx.fillRect(p.x-w/2,p.y-h/2,w,h);
            ctx.strokeRect(p.x-w/2,p.y-h/2,w,h);
          }else{
            ctx.beginPath();ctx.arc(p.x,p.y,p.radius||60,0,Math.PI*2);ctx.fill();ctx.stroke();
          }
        }
      }
    }else if(w.type==='charge'&&w.data){
      const a2=w.data.angle;
      ctx.beginPath(); ctx.moveTo(w.data.startX,w.data.startY);
      ctx.lineTo(w.data.startX+Math.cos(a2)*500,w.data.startY+Math.sin(a2)*500);
      ctx.lineTo(w.data.startX+Math.cos(a2+0.1)*500,w.data.startY+Math.sin(a2+0.1)*500);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }else if(w.type==='eyeBeam'&&w.data){
      drawWarnCircle(w.data.x,w.data.y,w.data.radius);
    }else if(w.type==='meteor'&&w.data&&w.data.positions){
      for(const p of w.data.positions){drawWarnCircle(p.x,p.y,p.radius||60);}
    }else if(w.type==='teleport'&&w.boss){
      // 为Boss特殊攻击画范围预警圆
      drawWarnCircle(w.boss.x,w.boss.y,300);
    }else if(w.x!==undefined&&w.y!==undefined&&w.radius){
      // 直接给坐标和半径的预警圆（lavaFist落点等）
      drawWarnCircle(w.x,w.y,w.radius);
    }else if(w.type==='teleport'){
      ctx.strokeStyle=`rgba(63,185,80,${a})`; ctx.lineWidth=4;
      ctx.strokeRect(2,2,CONFIG.WIDTH-4,CONFIG.HEIGHT-4);
    }
  }
  // 绘制安全区全屏攻击预警（绿色=安全区，红屏=危险区）
  if(boss&&boss.alive&&boss.safeZoneActive&&boss.safeZoneData){
    const d=boss.safeZoneData;
    const prog=1-d.timer/d.maxTimer; // 0→1
    // 全屏红色危险覆盖（越接近触发越深）
    ctx.fillStyle=`rgba(248,81,73,${0.15+prog*0.25})`;
    ctx.fillRect(0,0,CONFIG.WIDTH,CONFIG.HEIGHT);
    // 安全区绿色圆（挖洞效果）
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();
    ctx.arc(d.x,d.y,d.radius,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
    // 安全区边框：绿色脉冲圈
    const pulse=0.7+Math.sin(_NOW*0.01)*0.3;
    ctx.strokeStyle=`rgba(63,185,80,${pulse})`;
    ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(d.x,d.y,d.radius,0,Math.PI*2); ctx.stroke();
    // 内圈虚线
    ctx.strokeStyle=`rgba(63,185,80,${pulse*0.5})`;
    ctx.lineWidth=2;
    ctx.setLineDash([10,8]);
    ctx.beginPath(); ctx.arc(d.x,d.y,d.radius*0.7,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    // 倒计时数字
    const secLeft=Math.ceil(d.timer);
    ctx.fillStyle=`rgba(63,185,80,${0.8+prog*0.2})`;
    ctx.font='bold 32px STKaiti,KaiTi,serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(secLeft+'s',d.x,d.y);
    // 接近触发时闪烁
    if(prog>0.7){
      ctx.fillStyle=`rgba(248,81,73,${(prog-0.7)*1.5})`;
      ctx.fillRect(0,0,CONFIG.WIDTH,CONFIG.HEIGHT);
    }
  }
  // ===== 刑天最终Boss技能预警 =====
  if(boss&&boss.alive&&boss.isFinalBoss){
    // 干戚横扫预警（旋转红色光圈+干戚图标）
    if(boss.halberdSweepActive&&boss.halberdSweepData){
      const d=boss.halberdSweepData;
      const prog=1-d.timer/d.maxTimer;
      const pulse=0.5+Math.sin(_NOW*0.018)*0.3;
      // 外圈：旋转的虚线
      ctx.save();
      ctx.translate(boss.x,boss.y);
      ctx.rotate(_NOW*0.003);
      ctx.strokeStyle=`rgba(139,0,0,${pulse+prog*0.3})`;
      ctx.lineWidth=5;
      ctx.setLineDash([20,10]);
      ctx.beginPath(); ctx.arc(0,0,d.radius,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // 内圈填充（渐变红）
      const grad=ctx.createRadialGradient(boss.x,boss.y,0,boss.x,boss.y,d.radius);
      grad.addColorStop(0,`rgba(139,0,0,${0.02+prog*0.08})`);
      grad.addColorStop(0.7,`rgba(255,69,0,${0.05+prog*0.15})`);
      grad.addColorStop(1,`rgba(139,0,0,${0.1+prog*0.2})`);
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.arc(boss.x,boss.y,d.radius,0,Math.PI*2); ctx.fill();
      // 旋转的干戚图标（3个方向）
      const iconAngle=_NOW*0.005;
      for(let i=0;i<3;i++){
        const a=iconAngle+(i/3)*Math.PI*2;
        const ix=boss.x+Math.cos(a)*d.radius;
        const iy=boss.y+Math.sin(a)*d.radius;
        ctx.save();
        ctx.translate(ix,iy);
        ctx.rotate(a+Math.PI/2);
        ctx.fillStyle=`rgba(255,69,0,${0.8+prog*0.2})`;
        ctx.font='bold 28px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('⚔️',0,0);
        ctx.restore();
      }
      // 倒计时数字
      ctx.fillStyle=`rgba(255,215,0,${0.9})`;
      ctx.font='bold 32px STKaiti,KaiTi,serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(Math.ceil(d.timer),boss.x,boss.y-d.radius-25);
    }
    // 天崩地裂预警（裂纹图案+脉动）
    if(boss.earthCrackActive&&boss.earthCrackData){
      const d=boss.earthCrackData;
      const prog=1-d.timer/d.maxTimer;
      for(const c of d.cracks){
        const pulse=0.5+Math.sin(_NOW*0.012+c.angle)*0.3;
        // 外圈虚线
        ctx.strokeStyle=`rgba(255,69,0,${pulse+prog*0.4})`;
        ctx.lineWidth=4;
        ctx.setLineDash([14,7]);
        ctx.beginPath(); ctx.arc(c.x,c.y,c.radius,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        // 内部填充
        const grad=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,c.radius);
        grad.addColorStop(0,`rgba(255,200,0,${0.15+prog*0.2})`);
        grad.addColorStop(1,`rgba(139,0,0,${0.05+prog*0.1})`);
        ctx.fillStyle=grad;
        ctx.beginPath(); ctx.arc(c.x,c.y,c.radius,0,Math.PI*2); ctx.fill();
        // 裂纹线
        ctx.strokeStyle=`rgba(255,69,0,${0.4+prog*0.4})`;
        ctx.lineWidth=2;
        for(let i=0;i<5;i++){
          const a=c.angle+(i/5)*Math.PI*2;
          ctx.beginPath();
          ctx.moveTo(c.x,c.y);
          ctx.lineTo(c.x+Math.cos(a)*c.radius,c.y+Math.sin(a)*c.radius);
          ctx.stroke();
        }
      }
    }
    // 战魂分身（紫色战魂，程序化绘制确保可见，带血量条）
    if(boss.wrathClonesActive){
      for(const cl of boss.wrathClones){
        if(!cl.alive)continue;
        cl.wobble+=0.03;
        if(cl.spawnTime>0)cl.spawnTime-=0.016;
        const spawnAlpha=cl.spawnTime>0?(0.5-cl.spawnTime)/0.5:1;
        ctx.save();
        ctx.globalAlpha=cl.alpha*spawnAlpha;
        ctx.translate(cl.x,cl.y);
        const ct=_NOW/200+cl.wobble;
        // 受击白色闪光
        if(cl.hitFlash>0){
          ctx.shadowColor='#ffffff';ctx.shadowBlur=30;
        }
        // 外层紫色光晕
        ctx.shadowColor=cl.hitFlash>0?'#ffffff':'#bc8cff'; ctx.shadowBlur=25;
        const auraPulse=0.5+Math.sin(ct*2)*0.5;
        ctx.strokeStyle=`rgba(188,140,255,${0.6+auraPulse*0.3})`;ctx.lineWidth=3;
        ctx.beginPath();ctx.arc(0,0,cl.size*1.3,0,Math.PI*2);ctx.stroke();
        ctx.shadowBlur=0;
        // 主体：紫色战魂球（渐变）
        const cGrad=ctx.createRadialGradient(0,-cl.size*0.3,0,0,0,cl.size*0.9);
        cGrad.addColorStop(0,cl.hitFlash>0?'rgba(255,255,255,0.95)':'rgba(216,180,254,0.9)');
        cGrad.addColorStop(0.5,'rgba(188,140,255,0.7)');
        cGrad.addColorStop(1,'rgba(88,28,135,0.4)');
        ctx.fillStyle=cGrad;
        ctx.beginPath();ctx.arc(0,0,cl.size*0.95,0,Math.PI*2);ctx.fill();
        // 中心战魂之眼（金色发光）
        const eyePulse=0.7+Math.sin(ct*4)*0.3;
        ctx.shadowColor='#ffd700';ctx.shadowBlur=10*eyePulse;
        ctx.fillStyle=`rgba(255,215,0,${0.9})`;
        ctx.beginPath();ctx.arc(0,-cl.size*0.15,cl.size*0.14,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;
        ctx.fillStyle='#1a0505';
        ctx.beginPath();ctx.arc(0,-cl.size*0.15,cl.size*0.06,0,Math.PI*2);ctx.fill();
        // 环绕能量粒子
        for(let i=0;i<6;i++){
          const a=ct*2+i*Math.PI/3;
          const r=cl.size*1.05+Math.sin(ct*3+i)*4;
          ctx.fillStyle=`rgba(216,180,254,${0.7+auraPulse*0.3})`;
          ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,3,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
        // 血量条（在分身上方）
        if(cl.hp<cl.maxHp){
          const barW=cl.size*1.6, barH=5;
          const bx=cl.x-barW/2, by=cl.y-cl.size*1.4;
          ctx.fillStyle='rgba(0,0,0,0.6)';
          ctx.fillRect(bx-1,by-1,barW+2,barH+2);
          ctx.fillStyle='#bc8cff';
          ctx.fillRect(bx,by,barW*(cl.hp/cl.maxHp),barH);
        }
      }
    }
  }
  // 绘制Boss活跃光波/引力井（实际效果）
  if(boss&&boss.alive){
    if(boss._beamActive&&boss._beamData){
      const d=boss._beamData; const t=d.timer/d.duration;
      ctx.globalAlpha=Math.max(0.3,1-t*0.5);
      const c=boss.color;
      const cr=parseInt(c.substr(1,2),16),cg=parseInt(c.substr(3,2),16),cb=parseInt(c.substr(5,2),16);
      if(d.beamType==='horizontal'){
        const grd=ctx.createLinearGradient(0,d.y-50,0,d.y+50);
        grd.addColorStop(0,`rgba(${cr},${cg},${cb},0)`);grd.addColorStop(0.5,`rgba(${cr},${cg},${cb},0.8)`);grd.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle=grd; ctx.fillRect(0,d.y-50,CONFIG.WIDTH,100);
      }else if(d.beamType==='vertical'){
        const grd=ctx.createLinearGradient(d.x-50,0,d.x+50,0);
        grd.addColorStop(0,`rgba(${cr},${cg},${cb},0)`);grd.addColorStop(0.5,`rgba(${cr},${cg},${cb},0.8)`);grd.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle=grd; ctx.fillRect(d.x-50,0,100,CONFIG.HEIGHT);
      }else if(d.beamType==='fan'){
        for(const ang of d.angles){
          const grd=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,600);
          grd.addColorStop(0,`rgba(${cr},${cg},${cb},0.9)`);grd.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);
          ctx.fillStyle=grd;
          ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.arc(d.x,d.y,600,ang-0.15,ang+0.15); ctx.closePath(); ctx.fill();
        }
      }
      ctx.globalAlpha=1;
    }
    if(boss._wellActive&&boss._wellData){
      const d=boss._wellData; const t=d.timer/d.duration;
      const c=boss.color;
      const cr=parseInt(c.substr(1,2),16),cg=parseInt(c.substr(3,2),16),cb=parseInt(c.substr(5,2),16);
      ctx.save(); ctx.translate(d.x,d.y);
      // 1. 中心深紫核心光晕（强）
      const coreGrad=ctx.createRadialGradient(0,0,0,0,0,40);
      coreGrad.addColorStop(0,`rgba(${cr},${cg},${cb},0.9)`);
      coreGrad.addColorStop(0.5,`rgba(75,0,130,0.7)`);
      coreGrad.addColorStop(1,`rgba(75,0,130,0)`);
      ctx.fillStyle=coreGrad;
      ctx.beginPath(); ctx.arc(0,0,40,0,Math.PI*2); ctx.fill();
      // 2. 范围填充（半透明深紫）
      const fillGrad=ctx.createRadialGradient(0,0,0,0,0,d.radius);
      fillGrad.addColorStop(0,`rgba(${cr},${cg},${cb},${0.3+t*0.2})`);
      fillGrad.addColorStop(0.5,`rgba(75,0,130,${0.2+t*0.15})`);
      fillGrad.addColorStop(1,`rgba(75,0,130,0)`);
      ctx.fillStyle=fillGrad;
      ctx.beginPath(); ctx.arc(0,0,d.radius,0,Math.PI*2); ctx.fill();
      // 3. 多重旋转弧线（加强）
      ctx.globalAlpha=0.8+t*0.2;
      for(let i=0;i<4;i++){
        ctx.save();
        ctx.rotate(_NOW/200+i*Math.PI/2);
        ctx.strokeStyle=`rgba(${cr},${cg},${cb},0.9)`;
        ctx.lineWidth=4;
        ctx.shadowColor=`rgba(${cr},${cg},${cb},0.8)`; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.arc(0,0,d.radius*(0.4+i*0.18),0,Math.PI*1.3); ctx.stroke();
        ctx.restore();
      }
      ctx.shadowBlur=0;
      // 4. 边缘脉冲圆环
      const pulseR=d.radius*(0.9+Math.sin(_NOW/150)*0.05);
      ctx.strokeStyle=`rgba(${cr},${cg},${cb},${0.7+t*0.3})`;
      ctx.lineWidth=5;
      ctx.beginPath(); ctx.arc(0,0,pulseR,0,Math.PI*2); ctx.stroke();
      // 5. 内部漩涡粒子
      ctx.fillStyle=`rgba(216,180,254,0.9)`;
      for(let i=0;i<8;i++){
        const ang=_NOW/400+i*Math.PI/4;
        const r=d.radius*0.3*(1+Math.sin(_NOW/300+i)*0.3);
        ctx.beginPath(); ctx.arc(Math.cos(ang)*r,Math.sin(ang)*r,3,0,Math.PI*2); ctx.fill();
      }
      ctx.restore(); ctx.globalAlpha=1;
    }
    // 计蒙洪水波纹绘制
    if(boss._floodActive&&boss._floodData){
      const d=boss._floodData;
      const c=boss.color;
      const cr=parseInt(c.substr(1,2),16),cg=parseInt(c.substr(3,2),16),cb=parseInt(c.substr(5,2),16);
      ctx.save();
      for(const w of d.waves){
        if(d.timer>=w.timer&&w.r>0){
          const fade=1-Math.min(1,w.r/w.maxR);
          ctx.strokeStyle=`rgba(${cr},${cg},${cb},${0.7*fade})`;
          ctx.lineWidth=6;
          ctx.beginPath();ctx.arc(d.x,d.y,w.r,0,Math.PI*2);ctx.stroke();
          // 内层水色填充
          ctx.fillStyle=`rgba(${cr},${cg},${cb},${0.15*fade})`;
          ctx.beginPath();ctx.arc(d.x,d.y,w.r,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}

// ==================== 游戏状态管理 ====================
function startGame(){
  _runToken++; // 跨局竞态防护：丢弃上一局残留的 gameTimeout 回调
  // 清空摇杆/触摸/按键状态：防止玩家手指仍按在摇杆上时死亡/返回主菜单，
  // 在新一局开始时角色朝旧方向自动移动+自动射击
  if(typeof resetTouchState==='function')resetTouchState();
  if(typeof _pushGameState==='function')_pushGameState(); // Android 后退键保护
  initAudio(); // 首次开始游戏时初始化音频
  startBGM('normal'); // 启动普通背景音乐
  // 预加载所有Boss图片：避免Boss战开始时图片未加载完显示fallback圆形
  // _bossImgLoadedSet 会去重，重复调用安全
  if(typeof loadAllBossImages==='function')loadAllBossImages();
  // 清理可能残留的死亡动画定时器（防御性：正常流程下gameOver已执行，此处兜底）
  if(deathTimeout){clearTimeout(deathTimeout); deathTimeout=null;}
  deathAnimation=null;
  gameState='wavePrepare'; score=0; gameTime=0; currentWave=1; currentLevel=1;
  // 清理旧Boss状态：防止二阶段setTimeout在新一局执行（玩家死亡时Boss可能还alive）
  if(boss)boss.alive=false;
  enemiesRemaining=0; enemiesToSpawn=0; spawnTimer=0; boss=null; bossWarnings=[];
  globalSlow=1; globalSlowTimer=0; bossHpMul=1; revivesUsed=0;
  comboCount=0; comboTimer=0; comboMax=0; // 重置连击
  bossTrialMode=false; bossTrialIndex=0; pendingSuperRevenge=false; godslayerBossesLeft=0;
  _lastRunWasTrial=false; // 普通冒险模式
  adventureEnemyTimer=15;
  endlessMode=false; endlessWave=0; activeRelics=[]; bossTimeChallenge=null; bossVariant=false; pendingEndlessNext=false;
  pendingFinalBoss=false; // 重置刑天触发标记
  resumeTrialAfterFinalBoss=false;
  pendingProceedNext=false; pendingTrialNext=false; prevGameState='fighting'; // 重置升级流程标记
  bullets=[]; enemies=[]; enemyBullets=[]; resetParticles(); floatingTexts=[]; drops=[]; minions=[];
  fireEffects=[]; lightningStrikes=[]; tornadoes=[]; pets=[];
  // 重置视觉/慢动作状态（死亡瞬间可能残留，否则会带入新局开场）
  screenShake=0;
  if(typeof screenFlash!=='undefined')screenFlash=0;
  if(typeof slowMotion!=='undefined'){slowMotion.active=false; slowMotion.timer=0;}
  if(typeof lowHpWarning!=='undefined'){lowHpWarning.active=false; lowHpWarning.pulseTimer=0; lowHpWarning.heartbeatTimer=0;}
  if(typeof pendingBossCapture!=='undefined')pendingBossCapture=false;
  if(typeof adventureEnemies!=='undefined')adventureEnemies=[];
  trialXingtianTriggered=false; // 兜底重置
  // 死亡复盘：重置本局统计
  resetRunStats();
  player=new Player();
  // 加载宠物
  if(saveData.selectedPet!==null&&saveData.ownedPets[saveData.selectedPet]){
    const pd=saveData.ownedPets[saveData.selectedPet]; const def=getPetDef(pd.def);
    if(def){const pet=new Pet(def,pd.stage); pets.push(pet);}
  }
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('bossHealthBar').classList.add('hidden');
  document.getElementById('upgradeOverlay').classList.add('hidden');
  showWaveAnnounce(`第 ${currentWave} 波`,'准备战斗！');
  gameTimeout(()=>{if(gameState!=='upgrade'&&gameState!=='wavePrepare')return;startWave();},1500); updateUI();
  // 检查神话套装是否激活，显示提示
  const _mythicCnt=Object.values(saveData.equippedGear).filter(g=>g&&g.rarity==='mythic').length;
  if(_mythicCnt>=4){
    setTimeout(()=>{
      pushFloatingText(CONFIG.WIDTH/2,CONFIG.HEIGHT/2-40,'🔥 神话套装已激活！','#ff4444',3);
      pushFloatingText(CONFIG.WIDTH/2,CONFIG.HEIGHT/2,'伤害×1.6 移速×1.3 生命×1.3','#ffd970',2.5);
      pushFloatingText(CONFIG.WIDTH/2,CONFIG.HEIGHT/2+30,'暴击+20% 暴伤+50% 穿透+2 吸血+3%','#ffd970',2.5);
    },1500);
  }
}
// 无尽模式：通关8关后进入无尽波次
function startEndlessMode(){
  // 先正常开始游戏，通关后自动进入无尽
  startGame();
  // startGame会重置endlessMode，所以这里再设置回来
  endlessMode=true; endlessWave=0; activeRelics=[]; pendingEndlessNext=false;
  showWaveAnnounce('♾️ 无尽模式','通关后将进入无尽挑战！');
}
// ==================== Roguelike遗物系统 ====================
function showRelicSelection(){
  if(!player)return;
  gameState='upgrade';
  // 过滤已拥有的遗物
  const available=RELIC_DEFS.filter(r=>!activeRelics.find(a=>a.id===r.id));
  if(available.length===0){
    showWaveAnnounce('遗物已满','所有遗物都已获得！');
    gameTimeout(()=>{if(gameState!=='upgrade'&&gameState!=='wavePrepare')return;startWave();},1500);
    return;
  }
  const sel=shuffle(available).slice(0,Math.min(3,available.length));
  const ov=document.getElementById('relicOverlay');
  let html='<h2 style="color:#bc8cff">✨ 遗物选择</h2><div class="deco-line"><span>本局有效 · 与永久装备区分</span></div><div class="upgrade-cards">';
  for(const r of sel){
    html+=`<div class="relic-card ${r.rarity} card-enter" data-relic="${r.id}" style="animation-delay:${sel.indexOf(r)*0.1}s"><div class="relic-icon">${r.icon}</div><div class="upgrade-name" style="color:${r.rarity==='epic'?'#f0883e':'#bc8cff'}">${r.name}</div><div class="upgrade-desc">${r.desc}</div><div class="upgrade-rarity ${r.rarity}">${r.rarity==='rare'?'稀有':'史诗'}</div></div>`;
  }
  html+='</div><button class="sec-btn" id="skipRelic" style="margin-top:16px">💰 跳过 (+200分)</button>';
  ov.innerHTML=html; ov.classList.remove('hidden');
  ov.querySelectorAll('.relic-card').forEach(card=>{
    const handler=()=>{
      const rid=card.dataset.relic;
      const r=RELIC_DEFS.find(x=>x.id===rid);
      if(r){
        activeRelics.push({id:r.id,name:r.name,icon:r.icon});
        applyRelicEffect(r.id,true);
        pushFloatingText(player.x,player.y-40,'获得遗物: '+r.name,'#bc8cff',2);
        ov.classList.add('hidden');
        // 关卡恢复后开始下一波
        const regen=player.regenPerLevel||0; if(regen>0)player.health=Math.min(player.health+regen,player.maxHealth);
        if(player.shieldRegen){player.shield=Math.min(player.shield+player.shieldRegen,player.maxShield);}
        enemies=[];enemyBullets=[];bullets=[];drops=[];minions=minions.filter(m=>m.permanent&&m.alive);fireEffects=[];lightningStrikes=[];tornadoes=[];
        showWaveAnnounce('✨ '+r.name,'遗物已激活！');
        gameTimeout(()=>{if(gameState!=='upgrade'&&gameState!=='wavePrepare')return;startWave();},1500);
      }
    };
    _bindTap(card,handler);
  });
  _bindTap(document.getElementById('skipRelic'),()=>{
    score+=200;
    ov.classList.add('hidden');
    enemies=[];enemyBullets=[];bullets=[];drops=[];minions=minions.filter(m=>m.permanent&&m.alive);fireEffects=[];lightningStrikes=[];tornadoes=[];
    showWaveAnnounce('跳过遗物','+200分');
    gameTimeout(()=>{if(gameState!=='upgrade'&&gameState!=='wavePrepare')return;startWave();},1500);
  });
}
// 应用遗物效果（首次获得时立即效果，其他在事件中查询activeRelics）
function applyRelicEffect(rid,immediate){
  if(!player)return;
  switch(rid){
    case 'glasscannon':
      player.bulletDamage*=1.5;
      player.maxHealth=Math.ceil(player.maxHealth*0.7);
      player.health=Math.min(player.health,player.maxHealth);
      break;
    case 'berserker':
      player._relicBerserker=true;
      break;
    case 'treasure':
      player._relicTreasure=true;
      break;
    case 'shieldwalk':
      player._relicShieldWalk=true;
      break;
    // 其他遗物效果在事件触发时查询（弹射/吸血/暴击连击/冰霜/爆破/多重施法）
  }
}
// 检查是否拥有遗物
function hasRelic(id){return activeRelics.some(r=>r.id===id);}
// 死亡动画：玩家炸开效果
let deathAnimation=null; // {x,y,t,maxT,particles:[]}
// 尝试复活：成功返回true并恢复半血，失败返回false
// 同时支持 Player.takeDamage 和 applyDirectDamage 两条伤害路径
function tryRevive(p){
  if(!p)return false;
  // 硬上限：整局最多复活2次（玩家反馈复活太强，无论来源都受限）
  if(revivesUsed>=2)return false;
  // 检查是否还有复活次数（revives）
  const totalAllowed=(p.revives||0);
  if(revivesUsed>=totalAllowed)return false;
  // 复活：消耗1次，恢复半血，2秒无敌
  revivesUsed++;
  p.health=Math.ceil(p.maxHealth*0.5);
  p.invincible=Math.max(p.invincible||0, 2);
  p.hitFlash=0;
  p.alive=true;
  // 复活特效
  spawnParticles(p.x,p.y,'#3fb950',40);
  pushFloatingText(p.x,p.y-30,'💀 复活!','#3fb950',1.8);
  flashScreen('#3fb950',0.3);
  playSound('shield'); // 用护盾音效模拟复活
  // 取消死亡动画（兜底：复活优先于死亡动画）
  if(deathAnimation){
    deathAnimation=null;
    if(deathTimeout){clearTimeout(deathTimeout); deathTimeout=null;}
  }
  updateUI();
  return true;
}
let deathTimeout=null; // 死亡动画结束后触发gameOver的定时器
function triggerDeathAnimation(){
  if(deathAnimation)return; // 防止重复触发
  playSound('death');
  const px=player.x, py=player.y;
  // 生成爆炸粒子
  const particles=[];
  for(let i=0;i<40;i++){
    const a=(i/40)*Math.PI*2+Math.random()*0.3;
    const sp=80+Math.random()*200;
    particles.push({x:px,y:py,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.8+Math.random()*0.4,maxLife:1.2,size:3+Math.random()*5,color:Math.random()<0.5?'#ffd700':(Math.random()<0.5?'#f85149':'#ff8c00')});
  }
  // 大爆炸环
  for(let i=0;i<20;i++){
    const a=(i/20)*Math.PI*2;
    particles.push({x:px,y:py,vx:Math.cos(a)*300,vy:Math.sin(a)*300,life:0.5,maxLife:0.5,size:8,color:'#fff8e0'});
  }
  deathAnimation={x:px,y:py,t:0,maxT:1.5,particles};
  // 隐藏玩家
  if(player)player.alive=false;
  // 1.2秒后触发gameOver — 使用 gameTimeout 获得跨局竞态保护（_runToken 自动校验）
  // 现有 clearTimeout(deathTimeout) 调用点无需修改，gameTimeout 返回的就是 setTimeout ID
  deathTimeout=gameTimeout(()=>{deathAnimation=null; deathTimeout=null; gameOver();},1200);
}
function updateDeathAnimation(dt){
  if(!deathAnimation)return;
  deathAnimation.t+=dt;
  for(const p of deathAnimation.particles){
    p.x+=p.vx*dt; p.y+=p.vy*dt;
    p.vx*=0.92; p.vy*=0.92;
    p.life-=dt;
  }
}
function drawDeathAnimation(){
  if(!deathAnimation)return;
  const da=deathAnimation;
  const progress=da.t/da.maxT;
  // 中心闪光
  if(progress<0.3){
    const flashR=100*(progress/0.3);
    const grad=ctx.createRadialGradient(da.x,da.y,0,da.x,da.y,flashR);
    grad.addColorStop(0,`rgba(255,255,255,${1-progress/0.3})`);
    grad.addColorStop(0.5,`rgba(255,200,50,${0.6*(1-progress/0.3)})`);
    grad.addColorStop(1,'rgba(255,100,0,0)');
    ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(da.x,da.y,flashR,0,Math.PI*2); ctx.fill();
  }
  // 爆炸环
  if(progress<0.5){
    const ringR=120*progress;
    ctx.strokeStyle=`rgba(255,217,112,${1-progress*2})`; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(da.x,da.y,ringR,0,Math.PI*2); ctx.stroke();
  }
  // 粒子
  for(const p of da.particles){
    if(p.life<=0)continue;
    const a=p.life/p.maxLife;
    ctx.fillStyle=p.color;
    ctx.globalAlpha=a;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*a,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
// 死亡提战力建议：根据死因/本局表现给出针对性提示
function generateDeathTip(){
  if(typeof runStats==='undefined' || !runStats)return '';
  const rs=runStats;
  const tips=[];
  const dc=rs.deathCause||'';
  // 根据死因给提示
  if(/九尾狐|魅惑|混乱/.test(dc)){
    tips.push('💖 九尾狐的魅惑可被「魅狐九尾环」反向利用，凑齐4件神话装备激活圆弧护盾');
  }
  if(/毕方|烈焰|火墙/.test(dc)){
    tips.push('🔥 毕方二阶段会铺满火墙，装备「凤羽炎冠」+移速符文可走位规避');
  }
  if(/相柳|毒|沼/.test(dc)){
    tips.push('☠️ 相柳毒伤持续掉血，「九蛇毒行靴」可反毒制敌，多带回复类强化');
  }
  if(/朱厌|震|吼/.test(dc)){
    tips.push('🦍 朱厌震吼有近身判定，「巨猿金甲」可反弹震退，保持中距离输出');
  }
  if(/烛龙|光|暗|熔岩/.test(dc)){
    tips.push('🌟 烛龙二阶段光暗交替，「烛龙首盔」5秒无敌可硬吃伤害');
  }
  if(/饕餮|吞噬/.test(dc)){
    tips.push('🕳️ 饕餮吞噬范围大，「吞噬之戒」可对位反制，优先堆血量上限');
  }
  if(/英招|风|疾/.test(dc)){
    tips.push('💨 英招速度极快，「风神疾行靴」+20%闪避是核心反制手段');
  }
  if(/计蒙|水|暴雨/.test(dc)){
    tips.push('🌧️ 计蒙暴雨密集弹幕，「雨师玄袍」减伤15%可大幅缓解');
  }
  if(/穷奇|混沌|分裂/.test(dc)){
    tips.push('🌀 穷奇弹幕分裂，「混沌虎冠」+1分裂可对位输出');
  }
  if(/刑天|干戚/.test(dc)){
    tips.push('⚔️ 刑天三阶段极强，建议已凑齐4件神话+觉醒天赋后再挑战');
  }
  // 根据DPS/伤害给提示
  const dps = rs.duration>0 ? Math.round(rs.damageDealt/rs.duration) : 0;
  if(dps>0 && dps<30){
    tips.push('⚡ DPS偏低，优先升级武器到三阶+选择伤害/暴击/穿透类强化');
  }
  // 根据装备品质给提示
  const equipped=GEAR_SLOTS.map(sl=>saveData.equippedGear[sl]).filter(Boolean);
  const mythicCnt=equipped.filter(g=>g.rarity==='mythic').length;
  const legendCnt=equipped.filter(g=>g.rarity==='legendary').length;
  if(mythicCnt<4){
    tips.push(`✨ 当前神话装备 ${mythicCnt}/4，凑齐4件不同Boss神话激活圆弧护盾（伤害×1.6/移速×1.3/血量×1.3/吸血+3%）`);
  }
  if(equipped.length<4){
    tips.push('🎒 装备槽未填满，打Boss试炼掉专属神话装备，刑天击败必掉一件未拥有的');
  }
  // 根据强化数量给提示
  if(rs.upgradesTaken.length<5){
    tips.push('📈 本局强化过少，多击杀小怪触发升级面板（每升级+1天赋点）');
  }
  // 根据受伤量给提示
  if(rs.damageTaken>200){
    tips.push('🩸 受伤过高，建议选「强韧/反伤护甲/能量护盾」类强化提升生存');
  }
  // 兜底：如果都没有触发
  if(tips.length===0){
    tips.push('💪 多打Boss试炼，凑齐4件神话装备激活圆弧护盾是质变');
    tips.push('📚 主菜单「图鉴」可查看Boss弱点与故事，了解机制才能更轻松');
  }
  // 取前3条展示
  const showTips=tips.slice(0,3);
  return `<div style="max-width:100%;width:100%;box-sizing:border-box;margin:6px auto;padding:10px 12px;background:linear-gradient(135deg,rgba(255,215,0,0.12),rgba(188,140,255,0.10));border:1px solid rgba(255,215,0,0.5);border-radius:8px;overflow-x:hidden;word-break:break-word">
    <div style="color:#ffd700;font-size:13px;font-weight:bold;margin-bottom:6px;letter-spacing:1px">💡 提战力小贴士</div>
    ${showTips.map(t=>`<div style="color:#d4c5a0;font-size:12px;line-height:1.7;margin:3px 0;word-break:break-word">▸ ${t}</div>`).join('')}
  </div>`;
}
function gameOver(){
  // 防重入：Boss 死亡触发的 onBossDefeated 与玩家死亡的 deathTimeout 可能同时调用 gameOver
  if(gameState==='gameover')return;
  _runToken++; // 跨局竞态防护：丢弃本局残留的 gameTimeout 回调，防止死亡界面被旧回调覆盖
  // 清理可能残留的死亡动画定时器（兜底：Boss 死亡触发的 gameOver 可能与 deathTimeout 重叠）
  if(deathTimeout){clearTimeout(deathTimeout); deathTimeout=null;}
  deathAnimation=null;
  // 清空摇杆/触摸状态：玩家死亡瞬间手指可能还按在摇杆上，避免点击"再来一局"时残留输入
  if(typeof resetTouchState==='function')resetTouchState();
  // 清理视觉状态：防止 screenShake 抖动、lowHpWarning 闪红等残留到死亡界面
  if(typeof screenShake!=='undefined')screenShake=0;
  if(typeof screenFlash!=='undefined')screenFlash=0;
  if(typeof slowMotion!=='undefined'){slowMotion.active=false; slowMotion.timer=0;}
  if(typeof lowHpWarning!=='undefined'){lowHpWarning.active=false; lowHpWarning.pulseTimer=0; lowHpWarning.heartbeatTimer=0;}
  gameState='gameover';
  stopBGM(); // 停止背景音乐
  // 隐藏所有可能打开的overlay，防止死亡界面被遮挡
  ['bossHealthBar','upgradeOverlay','adventureOverlay','bossCaptureOverlay','talentOverlay','charOverlay','weaponOverlay','petOverlay','rouletteOverlay','craftOverlay','gearOverlay','bondOverlay','pediaOverlay','relicOverlay','bagOverlay']
    .forEach(id=>{const el=document.getElementById(id);if(el)el.classList.add('hidden');});
  // 清理Boss状态：防止二阶段setTimeout在死亡界面期间继续执行（如毕方火墙、相柳毒弹等）
  if(boss)boss.alive=false;
  bossWarnings=[];
  comboCount=0; comboTimer=0; // 重置连击
  // 重置可能残留的局内状态（避免下次启动时泄漏）
  pendingEndlessNext=false;
  pendingProceedNext=false;
  pendingTrialNext=false;
  pendingFinalBoss=false;
  resumeTrialAfterFinalBoss=false;
  if(bossTimeChallenge)bossTimeChallenge.active=false;
  // 天赋点系统已改为：每升一级+1点（在Player.gainXp中发放），不再由得分获得
  saveData.totalScore+=score;
  // 记录无尽模式最佳波次
  if(endlessMode&&endlessWave>(saveData.bestEndlessWave||0)){
    saveData.bestEndlessWave=endlessWave;
  }
  saveSave();
  // 更新成就追踪
  const af=saveData.achievementFlags;
  af.totalRuns=(af.totalRuns||0)+1;
  if(score>(af.bestScore||0))af.bestScore=score;
  const wasTrial=_lastRunWasTrial; // 用独立标记，避免 bossTrialMode 被提前重置导致失效
  // 死亡复盘：补全局时长统计
  if(typeof runStats!=='undefined' && runStats){
    runStats.duration = Math.floor((Date.now()-runStats.startTime)/1000);
    runStats.goldEarned = score;
    af.totalKills=(af.totalKills||0)+runStats.kills;
    af.totalBossKills=(af.totalBossKills||0)+runStats.bossKills;
  }
  // 检查Boss试炼通关
  if(wasTrial&&bossTrialIndex>=trialBossOrder.length){
    af.trialCleared=true;
    // 设置对应难度的试炼通关标志（用于解锁后续难度）
    const diff=saveData.difficulty;
    if(!saveData.difficultyCleared)saveData.difficultyCleared={normal:false,hard:false,hell:false,godslayer:false};
    saveData.difficultyCleared[diff]=true;
    // 同步到成就标志
    if(diff==='normal')af.trialNormalCleared=true;
    else if(diff==='hard')af.trialHardCleared=true;
    else if(diff==='hell')af.trialHellCleared=true;
    else if(diff==='godslayer'){
      af.trialGodslayerCleared=true;
      // 弑神难度试炼通关：揭示作弊方法（首次揭示）
      if(!saveData.cheatRevealed){
        saveData.cheatRevealed=true;
        _showCheatReveal=true; // 标记，稍后在结算界面显示
      }
    }
  }
  // 检查成就解锁
  const newlyUnlocked=checkAchievements();
  // 牧场生蛋
  const newEggs=ranchLayEggs();
  // 成就解锁会修改saveData.totalScore（奖励积分），需补一次saveSave避免玩家关闭浏览器丢失
  if(newlyUnlocked.length>0 && !newEggs) saveSave();
  bossTrialMode=false;
  const ov=document.getElementById('overlay');
  ov.classList.remove('hidden');
  let achHtml='';
  if(newlyUnlocked.length>0){
    achHtml=`<div style="background:rgba(255,215,0,0.1);border:1px solid #ffd700;border-radius:8px;padding:10px;margin:8px 0"><div style="color:#ffd700;font-size:14px;font-weight:bold">🏆 成就解锁 ${newlyUnlocked.length} 个!</div>${newlyUnlocked.map(a=>`<div style="font-size:12px;color:#c9d1d9">${a.icon} ${a.name} +${a.reward}积分</div>`).join('')}</div>`;
  }
  // 死亡复盘：本局数据汇总（可折叠）
  let recapHtml='';
  if(typeof runStats!=='undefined' && runStats && runStats.startTime>0){
    const rs=runStats;
    const _fmtTime=(s)=>{const m=Math.floor(s/60),sec=s%60;return m>0?`${m}分${sec}秒`:`${sec}秒`;};
    const _dps = rs.duration>0 ? Math.round(rs.damageDealt/rs.duration) : 0;
    // Build回顾：装备
    const _equipBuild = GEAR_SLOTS.map(sl=>{
      const g=saveData.equippedGear[sl];
      if(!g)return null;
      const rc=GEAR_RARITIES[g.rarity].color;
      return `<span style="color:${rc};font-size:11px">${GEAR_SLOT_ICONS[sl]}${g.name}</span>`;
    }).filter(Boolean).join(' / ') || '<span style="color:#8b949e;font-size:11px">无装备</span>';
    // Build回顾：激活的装备联动
    const _synergies = (typeof activeGearSynergies!=='undefined' && activeGearSynergies.length>0)
      ? activeGearSynergies.map(s=>`<span style="display:inline-block;background:rgba(188,140,255,0.15);border:1px solid rgba(188,140,255,0.4);border-radius:3px;padding:1px 5px;margin:1px;font-size:10px;color:#bc8cff">${s.icon} ${s.name}</span>`).join('')
      : '<span style="color:#8b949e;font-size:11px">无激活联动</span>';
    // Build回顾：选过的强化
    const _upgrades = rs.upgradesTaken.length>0
      ? rs.upgradesTaken.map(u=>`<span style="display:inline-block;background:rgba(88,166,255,0.15);border:1px solid rgba(88,166,255,0.3);border-radius:3px;padding:1px 5px;margin:1px;font-size:10px;color:#58a6ff">${u}</span>`).join('')
      : '<span style="color:#8b949e;font-size:11px">无强化</span>';
    recapHtml=`
      <details style="max-width:520px;margin:6px auto;padding:6px 10px;background:rgba(22,27,34,0.7);border:1px solid rgba(136,144,150,0.3);border-radius:8px">
        <summary style="cursor:pointer;color:#bc8cff;font-size:13px;letter-spacing:1px">📊 死亡复盘（点击展开）</summary>
        <div style="margin-top:8px;font-size:11px">
          <div style="color:#f85149;margin-bottom:6px;font-size:12px;font-weight:bold">💀 死因：${rs.deathCause}</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px">
            <div style="background:rgba(13,17,23,0.7);padding:6px 8px;border-radius:5px"><span style="color:#8b949e">⏱ 局时长</span><br><b style="color:#c9d1d9">${_fmtTime(rs.duration)}</b></div>
            <div style="background:rgba(13,17,23,0.7);padding:6px 8px;border-radius:5px"><span style="color:#8b949e">⚔ 击杀数</span><br><b style="color:#3fb950">${rs.kills}</b> <span style="color:#8b949e;font-size:10px">(Boss ${rs.bossKills})</span></div>
            <div style="background:rgba(13,17,23,0.7);padding:6px 8px;border-radius:5px"><span style="color:#8b949e">💥 总伤害</span><br><b style="color:#ff6b6b">${Math.round(rs.damageDealt)}</b> <span style="color:#8b949e;font-size:10px">(DPS ${_dps})</span></div>
            <div style="background:rgba(13,17,23,0.7);padding:6px 8px;border-radius:5px"><span style="color:#8b949e">🩸 总受伤</span><br><b style="color:#f85149">${Math.round(rs.damageTaken)}</b></div>
            <div style="background:rgba(13,17,23,0.7);padding:6px 8px;border-radius:5px"><span style="color:#8b949e">🔥 最高连击</span><br><b style="color:#ffd700">${rs.maxCombo}</b></div>
            <div style="background:rgba(13,17,23,0.7);padding:6px 8px;border-radius:5px"><span style="color:#8b949e">⭐ 经验获得</span><br><b style="color:#bc8cff">${rs.xpEarned} XP</b></div>
          </div>
          <div style="background:rgba(13,17,23,0.7);padding:6px 8px;border-radius:5px;margin-bottom:6px">
            <div style="color:#ffd700;font-size:11px;margin-bottom:3px">🎒 装备Build</div>
            <div>${_equipBuild}</div>
            <div style="color:#bc8cff;font-size:11px;margin-top:5px;margin-bottom:3px">🔮 激活联动 (${(typeof activeGearSynergies!=='undefined'?activeGearSynergies.length:0)})</div>
            <div>${_synergies}</div>
          </div>
          <div style="background:rgba(13,17,23,0.7);padding:6px 8px;border-radius:5px">
            <div style="color:#58a6ff;font-size:11px;margin-bottom:3px">⚡ 强化Build (${rs.upgradesTaken.length}个)</div>
            <div>${_upgrades}</div>
          </div>
        </div>
      </details>`;
  }
  // 根据本局类型决定"再打一次"按钮的行为：试炼→再打一次试炼，其他→再来一局冒险
  const replayBtnId = wasTrial ? 'replayTrialBtn' : 'startBtn';
  const replayBtnText = wasTrial ? '🐉 再打一次试炼' : '⚔️ 再来一局';
  const replayBtnHandler = wasTrial ? 'startBossTrial' : 'startGame';
  const replayBtnStyle = wasTrial ? 'background:linear-gradient(135deg,#bc8cff,#8b5cf6);font-size:16px;padding:14px 28px;min-height:48px' : 'font-size:16px;padding:14px 28px;min-height:48px';
  const tipHtml=generateDeathTip();
  ov.innerHTML=`<div class="bg-runes"><span class="bg-rune">💀</span><span class="bg-rune">⚔</span><span class="bg-rune">🔥</span><span class="bg-rune">☠</span><span class="bg-rune">🌑</span><span class="bg-rune">💫</span></div><div style="position:relative;z-index:1;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;padding:10px;padding-top:24px"><h1 style="color:#f85149;animation:titleFloat 3s ease-in-out infinite;font-size:28px;margin:4px 0">游戏结束</h1><div class="deco-line" style="margin:4px 0"><span>${wasTrial?'试炼终结':endlessMode?'无尽止步':'冒险落幕'}</span></div>${wasTrial?'<p style="color:#bc8cff;font-size:13px;margin:4px 0">Boss试炼结束</p>':endlessMode?`<p style="color:#daa520;font-size:13px;margin:4px 0">♾️ 无尽模式 - 第 ${endlessWave} 波${endlessWave>0&&endlessWave>=(saveData.bestEndlessWave||0)?' <span style="color:#ffd700">🏆 新纪录!</span>':''}</p>`:`<p style="font-size:13px;margin:4px 0">你到达了第 ${currentLevel} 关 第 ${currentWave} 波</p>`}<div id="finalScore" class="card-enter" style="font-size:48px">${score}</div><p class="subtitle" style="margin:2px 0">本局得分</p>${achHtml}${tipHtml}${recapHtml}<div style="display:flex;gap:8px;justify-content:center;margin:8px 0;flex-wrap:wrap"><div class="stat-pill"><span class="pill-icon">🪙</span><span class="pill-value">+${score}</span><span class="pill-label">积分</span></div><div class="stat-pill" style="animation-delay:0.5s"><span class="pill-icon">⭐</span><span class="pill-value">${saveData.talentPoints||0}</span><span class="pill-label">天赋点</span></div>${newEggs>0?`<div class="stat-pill" style="animation-delay:1s;border-color:#3fb950"><span class="pill-icon">🥚</span><span class="pill-value">x${newEggs}</span><span class="pill-label">产蛋</span></div>`:''}</div><div style="display:flex;flex-direction:column;gap:8px;align-items:center;margin-top:6px;padding:12px 10px calc(12px + env(safe-area-inset-bottom, 0px));position:sticky;bottom:0;background:linear-gradient(180deg,transparent 0%,rgba(13,10,5,0.92) 25%);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:5"><button class="action-btn" id="${replayBtnId}" style="${replayBtnStyle}">${replayBtnText}</button><button class="sec-btn" id="backToMenuBtn" style="font-size:14px;padding:12px 24px;min-height:44px">🏠 返回主菜单</button><div class="subtitle" style="margin-top:2px;font-size:11px">按 R 键快速重新开始</div></div></div>`;
  saveSave();
  // 死亡界面按钮统一用 _bindTap（带 _isSynthesizedClick 守卫，防止触屏笔记本双触发）
  const startBtnEl=document.getElementById(replayBtnId);
  const backToMenuBtnEl=document.getElementById('backToMenuBtn');
  const replayHandler=wasTrial?startBossTrial:startGame;
  _bindTap(startBtnEl, replayHandler);
  _bindTap(backToMenuBtnEl, showMainMenu);
  // 弑神难度试炼首次通关：揭示开发者彩蛋（作弊方法）
  if(typeof _showCheatReveal!=='undefined' && _showCheatReveal){
    _showCheatReveal=false;
    setTimeout(()=>showCheatRevealModal(), 600);
  }
}

// 开发者彩蛋揭示弹窗（仅在弑神难度试炼首次通关后显示）
function showCheatRevealModal(){
  const html=`<div id="cheatRevealOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px)">
    <div style="background:linear-gradient(180deg,#1a0a2a,#2a1040);border:2px solid #bc8cff;border-radius:14px;max-width:480px;width:100%;padding:24px 22px;box-shadow:0 0 50px rgba(188,140,255,0.5);font-family:STKaiti,KaiTi,serif;text-align:center">
      <div style="font-size:48px;margin-bottom:8px">⚔️✨</div>
      <h2 style="color:#bc8cff;letter-spacing:4px;margin:0 0 8px;font-size:22px">弑神封印·开发者彩蛋</h2>
      <div style="color:#ffd970;font-size:13px;margin-bottom:16px;letter-spacing:1px">恭喜你通过弑神难度Boss试炼！</div>
      <div style="background:rgba(22,27,34,0.7);border:1px solid rgba(188,140,255,0.4);border-radius:10px;padding:14px;margin:10px 0;text-align:left">
        <div style="color:#ffd970;font-size:13px;margin-bottom:8px;text-align:center">✦ 开发者彩蛋 · 隐藏功能 ✦</div>
        <div style="color:#c9d1d9;font-size:13px;line-height:1.8">
          在主菜单 <b style="color:#bc8cff">连续点击「📖 图鉴」按钮 5 次</b><br>
          即可获得开发者祝福：<br>
          <span style="color:#ffd970">✦ +100,000 积分</span><br>
          <span style="color:#ffd970">✦ +50 天赋点</span>
        </div>
        <div style="color:#8b949e;font-size:11px;margin-top:10px;text-align:center">（每次点击间隔需在 7 秒内）</div>
      </div>
      <div style="color:#daa520;font-size:12px;margin:10px 0;letter-spacing:1px">这是开发者留给通关勇者的隐藏礼物<br>从此难度选择界面将显示彩蛋标记</div>
      <button id="cheatRevealCloseBtn" style="margin-top:14px;width:100%;padding:12px;background:linear-gradient(180deg,#bc8cff,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:bold;letter-spacing:3px;cursor:pointer;font-family:STKaiti,KaiTi,serif">✦ 收下这份战利品 ✦</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const closeBtn=document.getElementById('cheatRevealCloseBtn');
  const closeFn=(e)=>{
    if(e&&e.preventDefault)e.preventDefault();
    const el=document.getElementById('cheatRevealOverlay');
    if(el)el.remove();
  };
  _bindTap(closeBtn, closeFn);
}

// ==================== 牧场系统 ====================
// 牧场生蛋（每局游戏结束后调用）
function ranchLayEggs(){
  if(!saveData.ranchPets||saveData.ranchPets.length===0)return 0;
  if(saveData.eggs.length>=5)return 0; // 蛋最多5个
  let count=0;
  // 一局只出一个蛋
  let epicChance=0.3;
  for(const p of saveData.ranchPets){
    const def=getPetDef(p.def);
    if(def&&def.isSuper)epicChance+=0.1;
  }
  const isEpic=Math.random()<epicChance;
  let defIdx;
  if(isEpic){
    // 超级Boss：烛龙(4)/饕餮(5)/穷奇(8)，三选一
    defIdx=[4,5,8][randInt(0,2)];
  }else{
    // 普通 Boss：九尾狐(0)/毕方(1)/相柳(2)/朱厌(3)/英招(6)/计蒙(7)，六选一
    defIdx=[0,1,2,3,6,7][randInt(0,5)];
  }
  saveData.eggs.push({type:isEpic?'epic':'normal',def:defIdx});
  count++;
  saveSave();
  return count;
}
// 孵化蛋
function hatchEgg(idx){
  const egg=saveData.eggs[idx]; if(!egg)return;
  const def=getPetDef(egg.def);
  saveData.ownedPets.push({def:egg.def,stage:0});
  saveData.eggs.splice(idx,1);
  saveSave();
  // 显示孵化结果提示
  const name=def?def.name:'未知宠物';
  const icon=def?def.icon:'🐾';
  const rarity=egg.type==='epic'?'史诗':'普通';
  const color=egg.type==='epic'?'#bc8cff':'#3fb950';
  showToast(`🥚 孵化成功！获得${rarity}宠物 ${icon} ${name}！`,color,3000);
}
// 放入牧场
function putPetInRanch(ownedIdx){
  if(saveData.ranchPets.length>=3)return false;
  const p=saveData.ownedPets[ownedIdx]; if(!p)return false;
  saveData.ranchPets.push({def:p.def,stage:p.stage});
  // 从拥有列表移除（如果正选中此宠物则取消选择）
  if(saveData.selectedPet===ownedIdx)saveData.selectedPet=null;
  else if(saveData.selectedPet!==null&&saveData.selectedPet>ownedIdx)saveData.selectedPet--;
  saveData.ownedPets.splice(ownedIdx,1);
  saveSave();
  return true;
}
// 从牧场取回
function takePetFromRanch(ranchIdx){
  const p=saveData.ranchPets[ranchIdx]; if(!p)return false;
  saveData.ownedPets.push({def:p.def,stage:p.stage});
  saveData.ranchPets.splice(ranchIdx,1);
  saveSave();
  return true;
}
// 牧场菜单（Canvas互动版）
let ranchScene=null; // {canvas,ctx,w,h,pets:[],chickens:[],rafId,lastTime,running,clickTarget:null}
function showRanchMenu(){
  const ov=document.getElementById('petOverlay'); // 复用petOverlay
  ov.classList.remove('hidden');
  const canFeed=saveData.totalScore>=100;
  ov.innerHTML=`
    <h2 style="font-family:'STKaiti','KaiTi',serif">🐔 大荒牧场</h2>
    <p class="subtitle" style="margin-bottom:8px">点击场景呼唤宠物前来 · 100积分投放小鸡，宠物会抢着吃 · 每局结束自动产蛋</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:flex-start;max-width:760px;margin:0 auto">
      <div style="flex:1;min-width:320px;max-width:500px">
        <canvas id="ranchCanvas" width="480" height="300" style="width:100%;height:auto;border-radius:12px;border:2px solid rgba(63,185,80,0.5);box-shadow:0 8px 28px rgba(0,0,0,0.6),inset 0 0 20px rgba(0,0,0,0.4);cursor:pointer;background:#1a2818;display:block"></canvas>
        <div style="display:flex;gap:6px;justify-content:center;margin-top:8px;flex-wrap:wrap">
          <button class="sec-btn" id="feedBtn" style="${canFeed?'border-color:#3fb950;color:#3fb950':'opacity:0.4;cursor:not-allowed'};font-size:12px;padding:6px 16px">🍗 投喂小鸡 (100积分)</button>
          <button class="sec-btn" id="ranchManageBtn" style="border-color:#ffd970;color:#ffd970;font-size:12px;padding:6px 16px">📋 管理宠物</button>
          <button class="sec-btn" id="backFromRanch" style="font-size:12px;padding:6px 16px">返回</button>
        </div>
        <p style="font-size:11px;color:#8b949e;margin-top:6px;text-align:center">宠物 ${saveData.ranchPets.length}/3 · 小鸡存活15秒 · 蛋 ${saveData.eggs.length}/5</p>
      </div>
      <div id="ranchSidePanel" style="width:230px;max-height:340px;overflow-y:auto;background:rgba(22,27,34,0.7);border:1px solid rgba(63,185,80,0.3);border-radius:10px;padding:10px;text-align:left"></div>
    </div>
  `;
  const canvas=document.getElementById('ranchCanvas');
  initRanchScene(canvas);
  renderRanchSidePanel();
  _bindTap(document.getElementById('feedBtn'),()=>{
    if(saveData.totalScore<100)return;
    saveData.totalScore-=100; saveSave();
    spawnRanchChicken();
    const fb=document.getElementById('feedBtn');
    if(saveData.totalScore<100){fb.style.opacity=0.4;fb.style.cursor='not-allowed';fb.style.borderColor='';fb.style.color='';}
    renderRanchSidePanel();
  });
  _bindTap(document.getElementById('ranchManageBtn'),()=>{showRanchManageModal();});
  _bindTap(document.getElementById('backFromRanch'),()=>{stopRanchScene();ov.classList.add('hidden');showMainMenu();});
}
// 渲染侧边面板（牧场宠物+蛋+可放入）
function renderRanchSidePanel(){
  const panel=document.getElementById('ranchSidePanel'); if(!panel)return;
  let html='<div style="font-size:12px;color:#3fb950;font-weight:bold;margin-bottom:6px;letter-spacing:1px">🐐 牧场中 ('+saveData.ranchPets.length+'/3)</div>';
  if(saveData.ranchPets.length===0){html+='<div style="font-size:11px;color:#8b949e;margin-bottom:8px">空空如也，点管理放入</div>';}
  else{
    saveData.ranchPets.forEach((p,idx)=>{
      const def=getPetDef(p.def); if(!def)return;
      html+=`<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;margin-bottom:4px;background:rgba(13,17,23,0.6);border-radius:6px;border-left:2px solid ${def.isSuper?'#bc8cff':'#3fb950'}">
        <span style="font-size:20px">${def.icon}</span>
        <div style="flex:1;min-width:0"><div style="font-size:11px;color:#e6c8a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${def.name}</div><div style="font-size:9px;color:#ffd970">${'★'.repeat(p.stage+1)}</div></div>
        <button class="sec-btn" data-takeout="${idx}" style="font-size:10px;padding:2px 8px">取回</button>
      </div>`;
    });
  }
  html+='<div style="font-size:12px;color:#ffd970;font-weight:bold;margin:8px 0 6px;letter-spacing:1px">🥚 蛋 ('+saveData.eggs.length+'/5)</div>';
  if(saveData.eggs.length===0){html+='<div style="font-size:11px;color:#8b949e;margin-bottom:8px">放入宠物完成一局即产蛋</div>';}
  else{
    saveData.eggs.forEach((egg,idx)=>{
      const isEpic=egg.type==='epic';
      const eggColor=isEpic?'#bc8cff':'#8b949e';
      html+=`<div data-hatch="${idx}" style="display:flex;align-items:center;gap:6px;padding:4px 6px;margin-bottom:4px;background:rgba(13,17,23,0.6);border-radius:6px;cursor:pointer;border-left:2px solid ${eggColor}">
        <span style="font-size:18px">🥚</span>
        <div style="flex:1"><div style="font-size:11px;color:${eggColor}">${isEpic?'史诗蛋':'普通蛋'}</div><div style="font-size:9px;color:#3fb950">点击孵化</div></div>
      </div>`;
    });
  }
  panel.innerHTML=html;
  panel.querySelectorAll('[data-hatch]').forEach(el=>{
    _bindTap(el,()=>{hatchEgg(parseInt(el.dataset.hatch));renderRanchSidePanel();syncRanchPets();});
  });
  panel.querySelectorAll('[data-takeout]').forEach(el=>{
    _bindTap(el,e=>{e.stopPropagation();takePetFromRanch(parseInt(el.dataset.takeout));renderRanchSidePanel();syncRanchPets();});
  });
}
// 管理宠物弹窗（放入牧场）
function showRanchManageModal(){
  const side=document.getElementById('ranchSidePanel');
  let html='<div style="font-size:12px;color:#ffd970;font-weight:bold;margin-bottom:6px;letter-spacing:1px">📦 可放入宠物</div>';
  const available=[];
  saveData.ownedPets.forEach((p,idx)=>{if(p)available.push({idx,p});});
  if(available.length===0){html+='<div style="font-size:11px;color:#8b949e;margin-bottom:8px">没有可放入的宠物</div>';}
  else{
    available.forEach(({idx,p})=>{
      const def=getPetDef(p.def); if(!def)return;
      html+=`<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;margin-bottom:4px;background:rgba(13,17,23,0.6);border-radius:6px;border-left:2px solid ${def.isSuper?'#bc8cff':'#3fb950'}">
        <span style="font-size:20px">${def.icon}</span>
        <div style="flex:1;min-width:0"><div style="font-size:11px;color:#e6c8a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${def.name}</div><div style="font-size:9px;color:#ffd970">${'★'.repeat(p.stage+1)}</div></div>
        <button class="sec-btn" data-putin="${idx}" style="font-size:10px;padding:2px 8px;${saveData.ranchPets.length>=3?'opacity:0.4;cursor:not-allowed':''}" ${saveData.ranchPets.length>=3?'disabled':''}>放入</button>
      </div>`;
    });
  }
  html+=`<button class="sec-btn" id="ranchManageBack" style="font-size:11px;padding:4px 12px;margin-top:6px;width:100%">返回牧场</button>`;
  side.innerHTML=html;
  side.querySelectorAll('[data-putin]').forEach(el=>{
    _bindTap(el,e=>{e.stopPropagation();if(saveData.ranchPets.length>=3)return;putPetInRanch(parseInt(el.dataset.putin));syncRanchPets();renderRanchSidePanel();});
  });
  _bindTap(document.getElementById('ranchManageBack'),()=>{renderRanchSidePanel();});
}
// 初始化牧场场景
function initRanchScene(canvas){
  stopRanchScene(); // 停止旧的
  const ctx=canvas.getContext('2d');
  const w=canvas.width, h=canvas.height;
  // 从saveData构建宠物实体
  const pets=saveData.ranchPets.map((p,i)=>{
    const def=getPetDef(p.def);
    return {
      def:p.def, stage:p.stage, name:def?def.name:'?', isSuper:def?def.isSuper:false, icon:def?def.icon:'?',
      x: 60+Math.random()*(w-120), y: 60+Math.random()*(h-120),
      tx: 0, ty: 0, // 目标
      speed: 38+Math.random()*10, // 徘徊速度较慢
      state:'wander', wanderTimer: Math.random()*2, bobPhase: Math.random()*Math.PI*2,
      size: 18+p.stage*4, eatFlash:0,
    };
  });
  ranchScene={canvas,ctx,w,h,pets,chickens:[],rafId:null,lastTime:0,running:true,clickTarget:null,clickPulse:0,grassPhase:0};
  canvas.onclick=(e)=>{
    const rect=canvas.getBoundingClientRect();
    const sx=canvas.width/rect.width, sy=canvas.height/rect.height;
    const cx=(e.clientX-rect.left)*sx, cy=(e.clientY-rect.top)*sy;
    ranchScene.clickTarget={x:cx,y:cy}; ranchScene.clickPulse=1;
    // 所有宠物移动到点击位置（散开一点）
    ranchScene.pets.forEach((pet,i)=>{
      const ang=(i/ranchScene.pets.length)*Math.PI*2;
      pet.tx=cx+Math.cos(ang)*20; pet.ty=cy+Math.sin(ang)*20;
      pet.state='moveTo';
    });
  };
  ranchLoop(performance.now());
}
// 同步牧场宠物（放入/取回后调用）
function syncRanchPets(){
  if(!ranchScene||!ranchScene.running)return;
  const w=ranchScene.w, h=ranchScene.h;
  // 保留现有宠物的位置，新增的宠物加在随机位置
  const existingKeys=ranchScene.pets.map(p=>p.def+'_'+p.stage);
  const newPets=[];
  saveData.ranchPets.forEach(p=>{
    const def=getPetDef(p.def);
    newPets.push({def:p.def, stage:p.stage, name:def?def.name:'?', isSuper:def?def.isSuper:false, icon:def?def.icon:'?'});
  });
  // 重建pets数组，尽量保留位置
  ranchScene.pets=newPets.map((np,i)=>{
    const old=ranchScene.pets[i];
    if(old&&old.def===np.def&&old.stage===np.stage){
      return old; // 保留位置和状态
    }
    return {
      ...np, x:60+Math.random()*(w-120), y:60+Math.random()*(h-120), tx:0, ty:0,
      speed:38+Math.random()*10, state:'wander', wanderTimer:Math.random()*2, bobPhase:Math.random()*Math.PI*2,
      size:18+np.stage*4, eatFlash:0,
    };
  });
}
// 生成小鸡
function spawnRanchChicken(){
  if(!ranchScene)return;
  const w=ranchScene.w, h=ranchScene.h;
  ranchScene.chickens.push({
    x:30+Math.random()*(w-60), y:30+Math.random()*(h-60),
    wanderTimer:0, bobPhase:Math.random()*Math.PI*2, life:15, hop:0, dir:Math.random()*Math.PI*2,
  });
}
// 停止牧场场景
function stopRanchScene(){
  if(ranchScene){
    ranchScene.running=false;
    if(ranchScene.rafId)cancelAnimationFrame(ranchScene.rafId);
    ranchScene=null;
  }
}
// 牧场主循环
function ranchLoop(now){
  if(!ranchScene||!ranchScene.running)return;
  const dt=Math.min((now-ranchScene.lastTime)/1000,0.05)||0;
  ranchScene.lastTime=now;
  updateRanchScene(dt);
  renderRanchScene();
  ranchScene.rafId=requestAnimationFrame(ranchLoop);
}
// 更新牧场逻辑
function updateRanchScene(dt){
  const s=ranchScene; if(!s)return;
  s.grassPhase+=dt;
  if(s.clickPulse>0)s.clickPulse-=dt*1.5;
  // 更新小鸡
  for(let i=s.chickens.length-1;i>=0;i--){
    const c=s.chickens[i];
    c.life-=dt;
    c.bobPhase+=dt*6;
    c.wanderTimer-=dt;
    if(c.wanderTimer<=0){c.wanderTimer=0.8+Math.random()*1.5; c.dir=Math.random()*Math.PI*2; c.hop=1;}
    if(c.hop>0)c.hop-=dt*3;
    // 小鸡小范围走动
    const cs=12;
    c.x+=Math.cos(c.dir)*cs*dt;
    c.y+=Math.sin(c.dir)*cs*dt;
    if(c.x<20){c.x=20;c.dir=Math.PI-c.dir;} if(c.x>s.w-20){c.x=s.w-20;c.dir=Math.PI-c.dir;}
    if(c.y<20){c.y=20;c.dir=-c.dir;} if(c.y>s.h-20){c.y=s.h-20;c.dir=-c.dir;}
    if(c.life<=0){s.chickens.splice(i,1);}
  }
  // 更新宠物
  s.pets.forEach(pet=>{
    pet.bobPhase+=dt*3;
    if(pet.eatFlash>0)pet.eatFlash-=dt;
    // 有小鸡时优先抢食
    if(s.chickens.length>0){
      // 找最近的小鸡
      let nearest=null,nd=1e9;
      s.chickens.forEach(c=>{
        const d=Math.hypot(c.x-pet.x,c.y-pet.y);
        if(d<nd){nd=d;nearest=c;}
      });
      if(nearest){
        pet.tx=nearest.x; pet.ty=nearest.y; pet.state='chase';
        pet.speed=70+pet.stage*8; // 抢食跑得快
        if(nd<14){ // 吃到小鸡
          const ci=s.chickens.indexOf(nearest);
          if(ci>=0)s.chickens.splice(ci,1);
          pet.eatFlash=0.6;
          pet.state='wander'; pet.wanderTimer=1+Math.random()*2;
        } else {
          // 向小鸡移动
          const cdx=nearest.x-pet.x, cdy=nearest.y-pet.y, cd=Math.max(nd,0.01);
          pet.x+=cdx/cd*pet.speed*dt; pet.y+=cdy/cd*pet.speed*dt;
        }
        return;
      }
    } else if(pet.state==='chase'){
      pet.state='wander'; pet.wanderTimer=0; pet.speed=38+Math.random()*10;
    }
    // moveTo状态：移动到点击位置
    if(pet.state==='moveTo'){
      const dx=pet.tx-pet.x, dy=pet.ty-pet.y, d=Math.hypot(dx,dy);
      if(d<6){pet.state='wander';pet.wanderTimer=0.5+Math.random()*1.5;}
      else{pet.x+=dx/d*pet.speed*dt; pet.y+=dy/d*pet.speed*dt;}
      return;
    }
    // wander状态：随机徘徊
    pet.wanderTimer-=dt;
    if(pet.wanderTimer<=0){
      pet.wanderTimer=1.5+Math.random()*2.5;
      pet.tx=30+Math.random()*(s.w-60); pet.ty=30+Math.random()*(s.h-60);
    }
    if(pet.state==='wander'){
      const dx=pet.tx-pet.x, dy=pet.ty-pet.y, d=Math.hypot(dx,dy);
      if(d>4){pet.x+=dx/d*pet.speed*dt; pet.y+=dy/d*pet.speed*dt;}
    }
  });
}
// 渲染牧场
function renderRanchScene(){
  const s=ranchScene; if(!s)return;
  const {ctx,w,h}=s;
  // 草地背景渐变
  const g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#2a3d22'); g.addColorStop(0.5,'#1f2e18'); g.addColorStop(1,'#16210f');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  // 草地纹理（小草点）
  ctx.fillStyle='rgba(63,185,80,0.15)';
  for(let i=0;i<40;i++){
    const gx=(i*73)%w, gy=((i*137)+Math.sin(s.grassPhase*0.5+i)*2)%h;
    ctx.fillRect(gx,gy,2,4);
  }
  // 水池（右下角）
  ctx.fillStyle='rgba(74,155,142,0.35)';
  ctx.beginPath(); ctx.ellipse(w-60,h-50,40,25,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(88,166,255,0.4)'; ctx.lineWidth=1.5; ctx.stroke();
  // 水波纹
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
  const wr=Math.sin(s.grassPhase*2)*3+8;
  ctx.beginPath(); ctx.ellipse(w-60,h-50,wr,wr*0.6,0,0,Math.PI*2); ctx.stroke();
  // 远山剪影
  ctx.fillStyle='rgba(30,50,40,0.5)';
  ctx.beginPath(); ctx.moveTo(0,60);
  ctx.lineTo(w*0.2,30); ctx.lineTo(w*0.4,50); ctx.lineTo(w*0.6,25); ctx.lineTo(w*0.8,45); ctx.lineTo(w,35); ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath(); ctx.fill();
  // 点击波纹
  if(s.clickTarget&&s.clickPulse>0){
    ctx.strokeStyle=`rgba(255,217,112,${s.clickPulse*0.7})`; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(s.clickTarget.x,s.clickTarget.y,(1-s.clickPulse)*40,0,Math.PI*2); ctx.stroke();
  }
  // 渲染小鸡
  s.chickens.forEach(c=>{
    const bob=Math.sin(c.bobPhase)*1.5;
    const hopOff=c.hop>0?Math.sin(c.hop*Math.PI)*4:0;
    const cx=c.x, cy=c.y+bob-hopOff;
    // 阴影
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx,c.y+4,6,2,0,0,Math.PI*2); ctx.fill();
    // 小鸡身体（黄色）
    ctx.fillStyle='#ffd700'; ctx.beginPath(); ctx.arc(cx,cy,6,0,Math.PI*2); ctx.fill();
    // 小鸡头
    ctx.fillStyle='#ffe44d'; ctx.beginPath(); ctx.arc(cx+2,cy-3,3.5,0,Math.PI*2); ctx.fill();
    // 喙
    ctx.fillStyle='#ff8c00'; ctx.beginPath(); ctx.moveTo(cx+5,cy-3); ctx.lineTo(cx+8,cy-2); ctx.lineTo(cx+5,cy-1); ctx.fill();
    // 眼睛
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(cx+3,cy-3.5,0.8,0,Math.PI*2); ctx.fill();
    // 即将消失时闪烁
    if(c.life<3 && Math.floor(c.life*4)%2===0){
      ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(cx,cy,7,0,Math.PI*2); ctx.fill();
    }
  });
  // 渲染宠物
  s.pets.forEach(pet=>{
    const bob=Math.sin(pet.bobPhase)*2;
    const px=pet.x, py=pet.y+bob;
    const r=pet.size;
    // 阴影
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px,pet.y+r*0.8,r*0.9,r*0.3,0,0,Math.PI*2); ctx.fill();
    // 吃到小鸡的金光
    if(pet.eatFlash>0){
      ctx.fillStyle=`rgba(255,217,112,${pet.eatFlash*0.5})`; ctx.beginPath(); ctx.arc(px,py,r+8,0,Math.PI*2); ctx.fill();
    }
    // 宠物图片（圆形裁剪）
    const img=BOSS_IMAGES[pet.def];
    if(img&&img.complete&&img.naturalWidth>0){
      ctx.save();
      ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.clip();
      ctx.drawImage(img,px-r,py-r,r*2,r*2);
      ctx.restore();
    }else{
      // emoji fallback
      ctx.font=`${r*1.6}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(pet.icon,px,py);
    }
    // 边框
    ctx.strokeStyle=pet.isSuper?'#bc8cff':'#3fb950'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.stroke();
    // 阶段星
    ctx.font='10px Arial'; ctx.textAlign='center';
    ctx.fillStyle='#ffd970';
    ctx.fillText('★'.repeat(pet.stage+1),px,py+r+10);
  });
}

// ==================== 主菜单 ====================
// 图鉴作弊点击计数器（全局，不随主菜单重渲染而重置）
let _pediaClickCount=0, _pediaClickTimer=null;
function showMainMenu(){
  if(typeof _clearGameState==='function')_clearGameState(); // 清理 Android 后退键历史记录
  _runToken++; // 丢弃本局残留的 gameTimeout 回调，防止覆盖主菜单
  // 清理死亡动画定时器（兜底：showMainMenu 可被多路径调用）
  if(typeof deathTimeout!=='undefined' && deathTimeout){clearTimeout(deathTimeout); deathTimeout=null;}
  if(typeof deathAnimation!=='undefined')deathAnimation=null;
  // 清空摇杆/触摸状态（防御性：showMainMenu 可从多路径调用，确保不留残留）
  if(typeof resetTouchState==='function')resetTouchState();
  gameState='menu';
  stopBGM(); // 返回主菜单时停止背景音乐
  // 后台预加载所有Boss图片：用户在主菜单操作时图片就在加载，
  // 进入游戏时大概率已加载完，避免手机端网络慢导致Boss显示fallback圆形
  if(typeof loadAllBossImages==='function')loadAllBossImages();
  const ov=document.getElementById('overlay');
  ov.classList.remove('hidden');
  const diff=getDifficulty();
  const bonusDisabled=saveData.bonusClicks<=0;
  const playerLvl=getPlayerLevelInfo(); // 局外训练等级（基于累积经验）
  const petCount=saveData.ownedPets.length;
  const gearCount=saveData.gearBag.length+Object.values(saveData.equippedGear).filter(g=>g).length;
  const pediaCount=Object.keys(saveData.bossPedia||{}).length;
  const achCount=Object.keys(saveData.achievements||{}).length;
  const artCount=saveData.ownedArtifacts.length;
  // 烛龙固定作为头像（idx=4）
  const showcaseIdx=4;
  const showcaseBoss=BOSS_TYPES[showcaseIdx];
  const showcaseImg=BOSS_IMG_PATHS[showcaseIdx];
  ov.innerHTML=`
    <div class="bg-runes">
      <span class="bg-rune">龙</span><span class="bg-rune">虎</span><span class="bg-rune">雀</span>
      <span class="bg-rune">武</span><span class="bg-rune">鳞</span><span class="bg-rune">凤</span>
      <span class="bg-rune">龟</span><span class="bg-rune">蛇</span>
    </div>
    <div class="sj-layer-sky"></div>
    <div class="sj-layer-mountains">
      <svg viewBox="0 0 1600 600" preserveAspectRatio="none">
        <!-- 远山 青色 -->
        <path d="M0,600 L0,420 L120,360 L240,400 L380,300 L520,380 L680,280 L820,360 L960,300 L1120,380 L1280,320 L1440,380 L1600,340 L1600,600 Z" fill="rgba(74,155,142,0.35)"/>
        <!-- 中山 深青 -->
        <path d="M0,600 L0,480 L100,440 L220,470 L360,400 L500,460 L640,390 L780,450 L900,400 L1060,460 L1200,410 L1360,460 L1500,420 L1600,450 L1600,600 Z" fill="rgba(40,80,75,0.5)"/>
        <!-- 近山 大荒暗褐 -->
        <path d="M0,600 L0,540 L160,500 L320,540 L480,490 L640,530 L800,480 L960,520 L1120,490 L1280,530 L1440,495 L1600,525 L1600,600 Z" fill="rgba(45,32,20,0.65)"/>
      </svg>
    </div>
    <div class="sj-cloud-deco tl">山</div>
    <div class="sj-cloud-deco br">海</div>
    <div class="sj-main" style="position:relative;z-index:1;width:100%;margin:auto 0;padding:8px 0">
     <div class="sj-col-left" style="text-align:center">
      <div class="sj-title-wrap">
        <h1 class="title-shimmer" style="animation:titleFloat 3s ease-in-out infinite, shimmer 4s linear infinite;">山海经·揍异兽</h1>
        <div class="sj-title-seal">异兽讨伐录</div>
      </div>
      <div class="deco-line"><span>✦ 天庭 · 大荒 · 青山 ✦</span></div>

      <div class="sj-boss-showcase" id="bossShowcase">
        <div class="sj-boss-orbit2"></div>
        <div class="sj-boss-orbit"></div>
        <div class="sj-avatar-inner">
          ${showcaseImg?`<img src="${showcaseImg}" alt="${showcaseBoss.name}" onerror="this.style.display='none'">`:`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:70px">${showcaseBoss.icon}</div>`}
        </div>
        <div class="sj-corner-seal tl"></div><div class="sj-corner-seal tr"></div>
        <div class="sj-corner-seal bl"></div><div class="sj-corner-seal br"></div>
        <div class="sj-boss-label">烛龙 · 镇守</div>
      </div>

      <p class="subtitle" style="font-family:'STKaiti','KaiTi',serif;letter-spacing:2px;margin-top:8px;line-height:1.6;font-size:12px">
        ⚔️ 九大异兽 · 最终Boss<b style="color:#8b0000">刑天</b>
      </p>

      <div class="sj-scroll-frame" style="padding:6px 12px">
        <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:4px 0">
          <div class="stat-pill" style="border-color:#ffd700;box-shadow:0 0 10px rgba(255,215,0,0.4)"><span class="pill-icon">🎖️</span><span class="pill-value" style="color:#ffd700">${playerLvl.level}</span><span class="pill-label">等级</span></div>
          <div class="stat-pill"><span class="pill-icon">🪙</span><span class="pill-value">${saveData.totalScore}</span><span class="pill-label">积分</span></div>
          <div class="stat-pill"><span class="pill-icon">⭐</span><span class="pill-value">${saveData.talentPoints}</span><span class="pill-label">天赋</span></div>
          <div class="stat-pill"><span class="pill-icon">🐉</span><span class="pill-value">${petCount}</span><span class="pill-label">宠物</span></div>
          <div class="stat-pill"><span class="pill-icon">🎽</span><span class="pill-value">${gearCount}</span><span class="pill-label">装备</span></div>
          <div class="stat-pill"><span class="pill-icon">📖</span><span class="pill-value">${pediaCount}/${BOSS_TYPES.length}</span><span class="pill-label">图鉴</span></div>
          <div class="stat-pill"><span class="pill-icon">🔮</span><span class="pill-value">${artCount}/${SOUL_ARTIFACTS.length}</span><span class="pill-label">魂器</span></div>
          <div class="stat-pill"><span class="pill-icon">🏆</span><span class="pill-value">${achCount}</span><span class="pill-label">成就</span></div>
        </div>
        <div style="max-width:460px;margin:4px auto 2px;padding:0 6px">
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#ffd700">Lv.${playerLvl.level}</span><span style="color:#8b949e">${playerLvl.inLevel}/${playerLvl.needed} XP</span></div>
          <div style="height:5px;background:#1a1f2e;border-radius:3px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.6)"><div style="height:100%;width:${playerLvl.inLevel/playerLvl.needed*100}%;background:linear-gradient(90deg,#ffd700,#ff8c42);transition:width 0.3s;border-radius:3px;box-shadow:0 0 6px rgba(255,215,0,0.5)"></div></div>
        </div>
      </div>
     </div>

     <div class="sj-col-right">
      <div class="menu-section">
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
          <button class="action-btn" id="startBtn">⚔️ 开始冒险</button>
          <button class="action-btn trial" id="trialBtn">🐉 Boss试炼</button>
          <button class="action-btn endless" id="endlessBtn">♾️ 无尽模式 ${saveData.bestEndlessWave>0?`<span style="font-size:12px;opacity:0.9">最佳${saveData.bestEndlessWave}波</span>`:''}</button>
        </div>
      </div>

      <div class="menu-section" style="margin-top:4px">
        <div class="btn-grid">
          <button class="feature-btn fb-gold" id="talentBtn"><div class="fb-icon">🌟</div><div class="fb-name">天赋</div><div class="fb-tag">强化属性</div></button>
          <button class="feature-btn fb-gold" id="bagBtn"><div class="fb-icon">🎒</div><div class="fb-name">背包</div><div class="fb-tag">装备/武器/宠物</div></button>
          <button class="feature-btn fb-green" id="ranchBtn"><div class="fb-icon">🐔</div><div class="fb-name">牧场</div><div class="fb-tag">放养·产蛋</div></button>
          <button class="feature-btn fb-purple" id="bondBtn"><div class="fb-icon">🔗</div><div class="fb-name">羁绊</div><div class="fb-tag">被动加成</div></button>
          <button class="feature-btn fb-blue" id="pediaBtn"><div class="fb-icon">📖</div><div class="fb-name">图鉴</div><div class="fb-tag">成就记录</div></button>
        </div>
      </div>

      <div class="menu-section" style="margin-top:6px">
        <div class="diff-pills">
          ${Object.entries(DIFFICULTIES).map(([k,d])=>{
            const unlocked=isDifficultyUnlocked(k);
            const sel=saveData.difficulty===k;
            if(unlocked){
              return `<button class="diff-pill ${sel?'active':''}" data-diff="${k}" style="${sel?`border-color:${d.color};color:${d.color}`:''}">${d.icon} ${d.name}</button>`;
            }else{
              return `<button class="diff-pill" data-diff-lock="${k}" style="opacity:0.5;cursor:not-allowed;border-color:#555;color:#888" title="${getDifficultyUnlockHint(k)}">🔒 ${d.name}</button>`;
            }
          }).join('')}
        </div>
        ${(!saveData.difficultyCleared||!saveData.difficultyCleared.godslayer)?`<div style="text-align:center;font-size:10px;color:#bc8cff;margin-top:4px;letter-spacing:1px">⚔️ 通关弑神难度Boss试炼有惊喜！</div>`:''}
        ${saveData.cheatRevealed?`<div style="text-align:center;font-size:10px;color:#ffd970;margin-top:2px">✦ 开发者彩蛋已解锁 ✦</div>`:''}
      </div>

      <div style="margin:4px 0;text-align:center">
        <button class="sec-btn" id="bonusBtn" style="${bonusDisabled?'opacity:0.4;cursor:not-allowed':'border-color:#ffd700;color:#ffd700;animation:pulseGlow 2s ease-in-out infinite'}">🎁 新手礼包 +300积分 +1天赋点 (剩${saveData.bonusClicks}次)</button>
      </div>
     </div>

     <div class="sj-col-bottom" style="text-align:center">
      <div class="controls" style="margin:4px auto 2px">
        <div class="ctrl-item"><span class="key">WASD</span><span class="desc">移动</span></div>
        <div class="ctrl-item"><span class="key">鼠标</span><span class="desc">瞄准</span></div>
        <div class="ctrl-item"><span class="key">左键/空格</span><span class="desc">射击</span></div>
        <div class="ctrl-item"><span class="key">F</span><span class="desc">技能</span></div>
        <div class="ctrl-item"><span class="key">R</span><span class="desc">重开</span></div>
        <div class="ctrl-item"><span class="key">📱摇杆</span><span class="desc">手机端</span></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:4px 0;flex-wrap:wrap">
        <span class="subtitle" style="font-size:11px;margin:0">难度：${diff.icon} ${diff.name}</span>
        <button id="fullscreenBtn">⛶ 点我全屏</button>
        ${saveData.hasShanHaiBook?'<button id="bookBtn" style="margin:0;padding:4px 10px;font-size:11px;background:linear-gradient(135deg,#8b0000,#ffd700);color:#fff;border:1px solid #ffd700;border-radius:6px;cursor:pointer">📖 山海故事</button>':''}
      </div>
      <button id="homeFullscreenBigBtn">⛶ 点我全屏播放</button>
      <div id="homeFullscreenTip"></div>
      <div class="home-author" style="margin:4px 0;font-family:'STKaiti','KaiTi',serif;font-size:11px;letter-spacing:3px;color:#d4c5a0;opacity:0.85;text-shadow:0 0 8px rgba(255,215,0,0.4)">✦ <span style="color:#ffd970">Edeka</span> 制作 ✦</div>

      <details class="home-guide" style="margin:4px auto 8px;max-width:680px;padding:6px 12px;border:1px solid rgba(212,160,23,0.3);border-radius:8px;background:rgba(22,27,34,0.7);font-size:10px;color:#8b949e;text-align:left;backdrop-filter:blur(8px)">
        <summary style="cursor:pointer;color:#ffd970;font-size:11px;letter-spacing:1px">📖 新手指南（点击展开）</summary>
        <div style="margin-top:6px;line-height:1.6;font-size:10px">
          <div style="color:#f0883e">⚡ <b>核心</b>：WASD移动，鼠标瞄准射击。每关30秒（Boss关50秒），时间到自动进下一关。</div>
          <div style="color:#8b0000">⚔️ <b>最终Boss·刑天</b>：击败超级Boss后50%几率触发，掉落山海故事书与「刑天干戚」。</div>
          <div style="color:#bc8cff">🌟 <b>天赋</b>：升级获得天赋点，强化伤害/射速/生命等。🎒 <b>背包</b>：管理武器/宠物/装备/打造/抽奖。</div>
          <div style="color:#a855f7">🔮 <b>魂器</b>：击败超级Boss掉落，释放技能时附带魂器技。</div>
          <div style="color:#3fb950">🔫 <b>武器</b>：手枪→神臂弓→散弹→狙击→震天锤→连弩→雷神炮→虚空之弓，3阶段满阶。</div>
          <div style="color:#ffd700">🐉 <b>宠物</b>：抽奖或击败Boss获得，9种Boss宝宝进化3阶段。🎽 <b>装备</b>：5稀有度，3件合成，4神话激活套装。</div>
          <div style="color:#daa520">🔗 <b>羁绊</b>：收集Boss宝宝激活被动加成。🎰 <b>抽奖</b>：800积分/次。</div>
          <div style="color:#ff6347">🔥 <b>半血机制</b>：Boss半血触发独有特殊机制。💥 <b>连击</b>：5连击+5%分数/击。</div>
          <div style="color:#bc8cff">📊 <b>4大难度</b>：普通→困难→地狱→弑神，需通关前一难度Boss试炼解锁。</div>
        </div>
      </details>
      <button class="home-guide-mobile" id="homeGuideMobileBtn" style="margin:4px auto 6px;padding:4px 16px;border:1px solid rgba(212,160,23,0.4);border-radius:6px;background:rgba(22,27,34,0.8);color:#ffd970;font-size:11px;letter-spacing:1px;cursor:pointer;">📖 新手指南</button>
     </div>
    </div>
  `;
  _bindTap(document.getElementById('startBtn'),startGame);
  _bindTap(document.getElementById('trialBtn'),startBossTrial);
  _bindTap(document.getElementById('endlessBtn'),startEndlessMode);
  _bindTap(document.getElementById('talentBtn'),showTalentMenu);
  _bindTap(document.getElementById('bagBtn'),showBagMenu);
  _bindTap(document.getElementById('ranchBtn'),showRanchMenu);
  _bindTap(document.getElementById('bondBtn'),showBondMenu);
  // 手机端新手指南按钮：跳转到图鉴的新手指南tab
  const _guideMobileBtn = document.getElementById('homeGuideMobileBtn');
  if(_guideMobileBtn){
    _bindTap(_guideMobileBtn, (e)=>{ if(e&&e.stopPropagation)e.stopPropagation(); showPediaMenu('guide'); });
  }
  // 图鉴按钮：连续点击5次触发内置作弊（10万积分+50天赋点）
  const _pediaCheat=()=>{
    _pediaClickCount++;
    if(_pediaClickTimer)clearTimeout(_pediaClickTimer);
    _pediaClickTimer=setTimeout(()=>{_pediaClickCount=0;},7000);
    if(_pediaClickCount>=5){
      _pediaClickCount=0;
      saveData.totalScore+=100000;
      saveData.talentPoints+=50;
      saveSave();
      // 弹出居中提示
      const _toast=document.createElement('div');
      _toast.textContent='✦ 开发者奖励 +100,000积分 +50天赋点 ✦';
      _toast.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:20px 40px;background:linear-gradient(135deg,#2a1a0a,#5a3a1a);border:2px solid #ffd700;border-radius:12px;color:#ffd970;font-size:18px;font-weight:bold;letter-spacing:2px;text-shadow:0 0 10px rgba(255,215,0,0.6);z-index:99999;box-shadow:0 0 30px rgba(255,215,0,0.5);font-family:STKaiti,KaiTi,serif';
      document.body.appendChild(_toast);
      setTimeout(()=>{_toast.remove();showMainMenu();},1500);
      return true;
    }
    return false;
  };
  const _pediaBtnEl=document.getElementById('pediaBtn');
  _bindTap(_pediaBtnEl,()=>{
    if(_pediaCheat())return;
    showPediaMenu();
  });
  const bookBtn=document.getElementById('bookBtn');
  if(bookBtn)_bindTap(bookBtn,()=>showShanHaiBook(false));
  // 主菜单内容可能溢出，确保从顶部开始展示
  ov.scrollTop = 0;
  // 修复手机端滑动导致顶部按钮消失：仅触摸设备在主菜单状态下锁定overlay滚动,
  // 电脑端不锁定(视口足够,允许自由滚动查看底部教程/作者),
  // details/弹窗内部自带滚动不受影响。
  if(!ov._menuScrollLock){
    ov._menuScrollLock=true;
    const _isTouch = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
    if(_isTouch){
      ov.addEventListener('touchmove',(e)=>{
        // 仅当主菜单显示时锁定（其他菜单如背包/图鉴仍可滚动）
        if(gameState==='menu' && !ov.classList.contains('hidden')){
          // 若触摸发生在可滚动元素内部(details/弹窗)则放行
          let node=e.target;
          while(node && node!==ov){
            if(node.tagName==='DETAILS'||node.tagName==='SUMMARY'||node.id==='noticeOverlay'){
              return;
            }
            node=node.parentNode;
          }
          e.preventDefault();
        }
      },{passive:false});
      // 注：原 scroll 强制归零逻辑已移除 — 它会阻止 details 内容滚动
      // touchmove 的 preventDefault 已足够防止整体页面滑动，无需再强制 scrollTop=0
      // （地址栏收缩导致的微小滚动可接受，不影响主菜单布局）
    }
  }
  // 显示手机端全屏/添加到主屏幕提示
  try{ showHomeTipIfMobile(); }catch(e){}
  // 难度选择
  ov.querySelectorAll('[data-diff]').forEach(el=>{
    _bindTap(el,()=>{saveData.difficulty=el.dataset.diff;saveSave();showMainMenu();});
  });
  // 锁定难度点击提示
  ov.querySelectorAll('[data-diff-lock]').forEach(el=>{
    _bindTap(el,()=>{ flashMsg('🔒 '+getDifficultyUnlockHint(el.dataset.diffLock)); });
  });
  // +800积分按钮
  const bonusBtn=document.getElementById('bonusBtn');
  if(!bonusDisabled){
    _bindTap(bonusBtn,()=>{
      if(saveData.bonusClicks<=0)return;
      saveData.totalScore+=300; saveData.bonusClicks-=1; saveData.talentPoints=(saveData.talentPoints||0)+1; saveSave();
      showMainMenu();
    });
  }
}

// ==================== 天赋菜单 ====================
function showTalentMenu(){
  const ov=document.getElementById('talentOverlay');
  ov.classList.remove('hidden');
  // 局外经验进度
  const xpProgress=Math.floor((saveData.totalXp||0)%1000);
  const xpMilestones=Math.floor((saveData.totalXp||0)/1000);
  let html=`<h2>🌟 天赋系统</h2><p class="subtitle">当前天赋点: <span style="color:#f0883e;font-size:20px">${saveData.talentPoints}</span> | 每升一级+1天赋点（局内拾取经验球升级）</p>`;
  html+=`<div style="max-width:600px;margin:0 auto 20px;padding:12px 16px;border:1px solid rgba(188,140,255,0.3);border-radius:10px;background:rgba(22,27,34,0.7)">
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span style="color:#bc8cff">🏆 局外经验里程碑</span><span style="color:#8b949e">已达成 ${xpMilestones} 个里程碑 (+${xpMilestones}天赋点)</span></div>
    <div style="height:10px;background:#1a1f2e;border-radius:5px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.6)"><div style="height:100%;width:${xpProgress/10}%;background:linear-gradient(90deg,#bc8cff,#ffd970);transition:width 0.3s;border-radius:5px;box-shadow:0 0 8px rgba(188,140,255,0.5)"></div></div>
    <div style="text-align:center;font-size:11px;color:#8b949e;margin-top:4px">${xpProgress}/1000 到下一里程碑（每1000经验+1天赋点）</div>
  </div>`;
  html+=`<div class="talent-grid">`;
  for(const t of TALENTS){
    const lv=getTalentLevel(t.id); const maxed=lv>=t.maxLevel; const afford=saveData.talentPoints>=t.costPerLevel;
    // 互斥检查：如果已升级对方天赋,则禁用本天赋
    let lockedByMutual=false; let lockHint='';
    if(t.exclusiveWith && getTalentLevel(t.exclusiveWith)>0){
      lockedByMutual=true;
      const other=TALENTS.find(x=>x.id===t.exclusiveWith);
      lockHint=`已选「${other?other.name:t.exclusiveWith}」`;
    }
    // 高级天赋标记
    const advTag=t.advanced?'<span style="position:absolute;top:4px;right:6px;font-size:8px;color:#ff4444;background:rgba(255,68,68,0.15);padding:1px 4px;border-radius:3px">高级</span>':'';
    const branchTag=t.branch?`<div style="font-size:8px;color:#bc8cff;margin-top:2px;letter-spacing:1px">「${t.branch}」${t.exclusiveWith?'二选一':''}</div>`:'';
    const stateClass=maxed?'maxed':(!afford||lockedByMutual?'unaffordable':'');
    const lockDisplay=maxed?'已满级':(lockedByMutual?lockHint:t.costPerLevel+'点');
    html+=`<div class="talent-node ${stateClass}" data-talent="${t.id}" style="position:relative;${lockedByMutual?'opacity:0.45;cursor:not-allowed':''}">${advTag}<div class="talent-icon">${t.icon}</div><div class="talent-name">${t.name}</div><div class="talent-desc">${t.desc}</div>${branchTag}<div class="talent-level">Lv.${lv}/${t.maxLevel}</div><div class="talent-cost">${lockDisplay}</div></div>`;
  }
  html+=`</div><div class="panel-actions"><button class="sec-btn" id="resetTalentsBtn">🔄 重置天赋（全额返还）</button><button class="sec-btn" id="backFromTalent">返回</button></div>`;
  ov.innerHTML=html;
  ov.querySelectorAll('.talent-node').forEach(el=>{
    _bindTap(el,()=>{
      const id=el.dataset.talent;
      if(upgradeTalent(id))showTalentMenu();
      else{
        // 提示互斥或积分不足
        const t=TALENTS.find(x=>x.id===id);
        if(t&&t.exclusiveWith&&getTalentLevel(t.exclusiveWith)>0){
          const other=TALENTS.find(x=>x.id===t.exclusiveWith);
          flashMsg(`⚠️ 已选择「${other?other.name:t.exclusiveWith}」,无法同时选择「${t.name}」`);
        }
      }
    });
  });
  _bindTap(document.getElementById('resetTalentsBtn'),()=>{
    // 二次确认（避免误点）
    if(confirm('确定要重置所有天赋吗？将全额返还已消耗的天赋点。')){resetTalents();showTalentMenu();}
  });
  _bindTap(document.getElementById('backFromTalent'),()=>{ov.classList.add('hidden');showMainMenu();});
}

// ==================== 背包系统（统一入口）====================
function showBagMenu(){
  const ov=document.getElementById('bagOverlay'); ov.classList.remove('hidden');
  const curChar=getCurrentCharacter();
  const skin=getEquippedSkin();
  const weaponCount=Object.keys(saveData.ownedWeapons||{}).length;
  const petCount=saveData.ownedPets.length;
  const gearCount=saveData.gearBag.length;
  const craftCount=Object.values(saveData.weaponCrafts||{}).reduce((s,a)=>s+a.length,0);
  const skinCount=saveData.ownedSkins.length;
  const bondCount=saveData.unlockedCharacters.length;
  // 统计各稀有度装备数量
  const gearByRarity={};
  for(const g of saveData.gearBag){gearByRarity[g.rarity]=(gearByRarity[g.rarity]||0)+1;}
  let html='<h2>🎒 背包</h2>';
  html+=`<p class="subtitle">点击下方分类管理你的物品</p>`;
  html+=`<p style="font-size:18px;color:#f0883e">积分: ${saveData.totalScore} | 天赋点: ${saveData.talentPoints}</p>`;
  // 当前装备概览
  html+='<div style="background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px 18px;margin:10px 0;display:flex;gap:24px;align-items:center;flex-wrap:wrap;justify-content:center">';
  html+=`<div style="text-align:center"><div style="font-size:28px">${skin?skin.icon:curChar.icon}</div><div style="font-size:12px;color:#8b949e">${curChar.name}${skin?' · '+skin.name:''}</div></div>`;
  const curW=WEAPONS[saveData.currentWeapon];
  const stage=getWeaponStage(saveData.currentWeapon);
  html+=`<div style="text-align:center"><div style="font-size:28px">${curW?curW.icon:'?'}</div><div style="font-size:12px;color:#8b949e">${curW?curW.name+' ★'+(stage+1):'未装备'}</div></div>`;
  const selPet=saveData.selectedPet!=null?saveData.ownedPets[saveData.selectedPet]:null;
  if(selPet){const pd=getPetDef(selPet.def);html+=`<div style="text-align:center"><div style="font-size:28px">${pd.icon}</div><div style="font-size:12px;color:#8b949e">${pd.name} ★${selPet.stage+1}</div></div>`;}
  // 装备槽
  for(const slot of GEAR_SLOTS){
    const g=saveData.equippedGear[slot];
    if(g){
      const rar=GEAR_RARITIES[g.rarity];
      html+=`<div style="text-align:center"><div style="font-size:24px;color:${rar.color}">${GEAR_SLOT_ICONS[slot]}</div><div style="font-size:10px;color:${rar.color}">${rar.name}</div></div>`;
    }else{
      html+=`<div style="text-align:center;opacity:0.4"><div style="font-size:24px">${GEAR_SLOT_ICONS[slot]}</div><div style="font-size:10px;color:#8b949e">空</div></div>`;
    }
  }
  html+='</div>';
  // 背包分类按钮（网格布局，各配独特主题色便于区分）
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:560px;margin:14px auto">';
  html+=`<button class="feature-btn fb-blue" id="bagCharBtn" style="padding:12px 4px">
    <div class="fb-icon" style="font-size:26px">👤</div>
    <div class="fb-name">角色</div>
    <div class="fb-tag">${bondCount}/${Object.keys(CHARACTERS).length} · ${skinCount}皮肤</div>
  </button>`;
  html+=`<button class="feature-btn fb-red" id="bagWeaponBtn" style="padding:12px 4px">
    <div class="fb-icon" style="font-size:26px">🔫</div>
    <div class="fb-name">武器</div>
    <div class="fb-tag">${weaponCount}/${Object.keys(WEAPONS).length}武器</div>
  </button>`;
  html+=`<button class="feature-btn fb-green" id="bagPetBtn" style="padding:12px 4px">
    <div class="fb-icon" style="font-size:26px">🐉</div>
    <div class="fb-name">宠物</div>
    <div class="fb-tag">${petCount}只</div>
  </button>`;
  html+=`<button class="feature-btn fb-gold" id="bagGearBtn" style="padding:12px 4px">
    <div class="fb-icon" style="font-size:26px">⚔️</div>
    <div class="fb-name">装备</div>
    <div class="fb-tag">${gearCount}件</div>
  </button>`;
  html+=`<button class="feature-btn fb-cyan" id="bagCraftBtn" style="padding:12px 4px">
    <div class="fb-icon" style="font-size:26px">⚒️</div>
    <div class="fb-name">打造</div>
    <div class="fb-tag">${craftCount}词条</div>
  </button>`;
  html+=`<button class="feature-btn fb-gold" id="bagRouletteBtn" style="padding:12px 4px">
    <div class="fb-icon" style="font-size:26px">🎰</div>
    <div class="fb-name">抽奖</div>
    <div class="fb-tag">800分/次</div>
  </button>`;
  html+=`<button class="feature-btn fb-purple" id="bagArtifactBtn" style="padding:12px 4px">
    <div class="fb-icon" style="font-size:26px">🔮</div>
    <div class="fb-name">魂器</div>
    <div class="fb-tag">${saveData.ownedArtifacts.length}/${SOUL_ARTIFACTS.length}魂器</div>
  </button>`;
  html+=`<button class="feature-btn fb-blue" id="bagBondBtn" style="padding:12px 4px">
    <div class="fb-icon" style="font-size:26px">🔗</div>
    <div class="fb-name">羁绊</div>
    <div class="fb-tag">被动加成</div>
  </button>`;
  html+='</div>';
  // 套装效果显示（如果有4件神话装备）
  const mythicCount=Object.values(saveData.equippedGear).filter(g=>g&&g.rarity==='mythic').length;
  if(mythicCount>=4){
    html+='<div style="background:linear-gradient(90deg,#3a1a1a,#5a2a2a,#3a1a1a);border:1px solid #ff4444;border-radius:8px;padding:10px;margin-top:8px;color:#ffd970;font-weight:bold">🔥 神话套装已激活 (${mythicCount}/4)<br><span style="color:#ffa0a0;font-size:11px;font-weight:normal">伤害×1.6 | 移速×1.3 | 生命×1.3 | 暴击+20% | 暴伤+50% | 穿透+2 | 吸血+3%</span></div>';
  }
  html+='<div class="panel-actions"><button class="sec-btn" id="backFromBag">返回主菜单</button></div>';
  ov.innerHTML=html;
  ov.scrollTop=0;
  // 进入子菜单时先隐藏背包，避免遮挡
  const hideBagAndShow=(fn)=>()=>{ov.classList.add('hidden');fn();};
  _bindTap(document.getElementById('bagCharBtn'),hideBagAndShow(showCharMenu));
  _bindTap(document.getElementById('bagWeaponBtn'),hideBagAndShow(showWeaponMenu));
  _bindTap(document.getElementById('bagPetBtn'),hideBagAndShow(showPetMenu));
  _bindTap(document.getElementById('bagGearBtn'),hideBagAndShow(showGearMenu));
  _bindTap(document.getElementById('bagCraftBtn'),hideBagAndShow(showCraftMenu));
  _bindTap(document.getElementById('bagRouletteBtn'),hideBagAndShow(showRouletteMenu));
  _bindTap(document.getElementById('bagArtifactBtn'),hideBagAndShow(showArtifactMenu));
  _bindTap(document.getElementById('bagBondBtn'),hideBagAndShow(showBondMenu));
  _bindTap(document.getElementById('backFromBag'),()=>{ov.classList.add('hidden');showMainMenu();});
}

// ==================== 魂器菜单 ====================
function showArtifactMenu(){
  const ov=document.getElementById('artifactOverlay'); ov.classList.remove('hidden');
  let html='<h2>🔮 魂器</h2>';
  html+='<p class="subtitle">击败超级Boss有概率掉落对应魂器 · 装备魂器后释放技能时会自动附带魂器技能</p>';
  html+=`<p style="font-size:18px;color:#a855f7">已收集: ${saveData.ownedArtifacts.length}/${SOUL_ARTIFACTS.length}</p>`;
  // 说明
  html+=`<div style="max-width:680px;margin:0 auto 12px;padding:8px;border:1px solid rgba(168,85,247,0.3);border-radius:6px;font-size:11px;color:#8b949e;text-align:left">
    <div style="color:#c9d1d9;margin-bottom:4px">📜 <b>魂器机制</b></div>
    • 魂器在角色释放技能(C键)时<b>同时触发</b>，不占用技能冷却<br>
    • 变异超级Boss掉落概率更高(40% vs 20%)<br>
    • 同一时间只能装备1个魂器，可随时切换<br>
    • 已获得的魂器不会重复掉落
  </div>`;
  // 当前装备
  const equipped=getEquippedArtifact();
  if(equipped){
    html+=`<div class="section-title">当前装备</div>`;
    html+=`<div style="background:linear-gradient(180deg,#2a1a3a,#1a1f2e);border:2px solid ${equipped.color};border-radius:10px;padding:16px 24px;max-width:500px;margin:8px auto;box-shadow:0 0 20px ${equipped.color}66">
      <div style="display:flex;align-items:center;gap:16px">
        <div style="font-size:48px;text-shadow:0 0 12px ${equipped.color}">${equipped.icon}</div>
        <div style="text-align:left;flex:1">
          <div style="font-size:20px;color:${equipped.color};font-weight:bold">${equipped.name}</div>
          <div style="font-size:13px;color:#ffd970;margin-top:2px">✦ ${equipped.skillName}</div>
          <div style="font-size:12px;color:#c9d1d9;margin-top:4px">${equipped.desc}</div>
        </div>
        <button class="sec-btn" id="unequipArtifact" style="color:#f85149;border-color:#f85149">卸下</button>
      </div>
    </div>`;
  }else{
    html+=`<div class="section-title">当前装备</div>`;
    html+=`<div style="background:#161b22;border:1px dashed #30363d;border-radius:10px;padding:16px 24px;max-width:500px;margin:8px auto;color:#8b949e">未装备魂器 · 选中下方魂器装备</div>`;
  }
  // 魂器列表
  html+=`<div class="section-title">魂器图鉴</div>`;
  html+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;max-width:780px;width:100%">`;
  for(const art of SOUL_ARTIFACTS){
    const owned=saveData.ownedArtifacts.includes(art.bossIdx);
    const isEquipped=saveData.equippedArtifact===art.bossIdx;
    const bossDef=BOSS_TYPES.find(b=>b.idx===art.bossIdx);
    if(owned){
      html+=`<div style="background:linear-gradient(180deg,#2a1a3a,#161b22);border:2px solid ${isEquipped?'#ffd970':art.color};border-radius:10px;padding:14px;text-align:left;cursor:pointer;box-shadow:${isEquipped?'0 0 16px rgba(255,217,112,0.4)':'0 0 10px '+art.color+'33'};position:relative" data-equip-art="${art.bossIdx}">
        ${isEquipped?'<div style="position:absolute;top:6px;right:8px;font-size:11px;color:#ffd970;font-weight:bold">✓ 已装备</div>':''}
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="font-size:36px;text-shadow:0 0 10px ${art.color}">${art.icon}</div>
          <div>
            <div style="color:${art.color};font-weight:bold;font-size:15px">${art.name}</div>
            <div style="font-size:11px;color:#8b949e">来自: ${bossDef?bossDef.name:'未知Boss'}</div>
          </div>
        </div>
        <div style="font-size:13px;color:#ffd970;margin-bottom:4px">✦ ${art.skillName}</div>
        <div style="font-size:11px;color:#c9d1d9;line-height:1.5">${art.desc}</div>
        <div style="font-size:11px;color:#58a6ff;margin-top:8px;text-align:center">${isEquipped?'点击卸下':'点击装备'}</div>
      </div>`;
    }else{
      html+=`<div style="background:#0d1117;border:1px dashed #30363d;border-radius:10px;padding:14px;text-align:left;opacity:0.65">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="font-size:36px;filter:grayscale(1) brightness(0.5)">❓</div>
          <div>
            <div style="color:#8b949e;font-weight:bold;font-size:15px">??? 魂器</div>
            <div style="font-size:11px;color:#6e7681">来自: ${bossDef?bossDef.name:'未知Boss'} (未获得)</div>
          </div>
        </div>
        <div style="font-size:12px;color:#6e7681;line-height:1.5">击败 ${bossDef?bossDef.name:'该Boss'} 后有几率掉落<br>(变异Boss掉落率提升至40%)</div>
      </div>`;
    }
  }
  html+='</div>';
  html+='<div class="panel-actions"><button class="sec-btn" id="backFromArtifact">返回背包</button></div>';
  ov.innerHTML=html;
  ov.scrollTop=0;
  if(equipped){
    const uneq=ov.querySelector('#unequipArtifact');
    if(uneq)_bindTap(uneq,()=>{saveData.equippedArtifact=null;saveSave();showArtifactMenu();});
  }
  ov.querySelectorAll('[data-equip-art]').forEach(el=>{
    _bindTap(el,()=>{
      const idx=parseInt(el.dataset.equipArt);
      if(saveData.equippedArtifact===idx){saveData.equippedArtifact=null;}
      else{saveData.equippedArtifact=idx;}
      saveSave();
      showArtifactMenu();
    });
  });
  const back=ov.querySelector('#backFromArtifact');
  if(back)_bindTap(back,()=>{ov.classList.add('hidden');showBagMenu();});
}

// ==================== 角色菜单 ====================
function showCharMenu(){
  const ov=document.getElementById('charOverlay'); ov.classList.remove('hidden');
  let html='<h2>👤 角色选择</h2><p class="subtitle">每个角色拥有独特的被动和技能 · 点击角色切换</p>';
  html+=`<p style="font-size:18px;color:#f0883e">当前积分: ${saveData.totalScore}</p>`;
  html+='<div style="display:flex;flex-wrap:wrap;justify-content:center;margin-top:10px">';
  for(const[id,c]of Object.entries(CHARACTERS)){
    const unlocked=saveData.unlockedCharacters.includes(id);
    const sel=saveData.currentCharacter===id;
    html+=`<div class="char-card ${sel?'selected':''} ${!unlocked?'locked':''}" data-char="${id}"><div style="font-size:40px">${c.icon}</div><h3>${c.name}</h3><p style="font-size:12px;color:#8b949e">被动: ${c.passive}</p><p style="font-size:12px;color:#bc8cff">${c.skillName}</p><p style="font-size:11px;color:#8b949e">${c.skillDesc}</p>${!unlocked?`<p style="color:#f0883e;margin-top:6px">🪙 ${c.price}</p>`:''}</div>`;
  }
  html+='</div>';
  // 皮肤选择区域
  const curChar=getCurrentCharacter();
  const equippedSkinId=saveData.equippedSkins?.[saveData.currentCharacter];
  html+=`<div class="section-title" style="margin-top:20px">🎨 ${curChar.icon} ${curChar.name} 的皮肤</div>`;
  const skins=getSkinsForChar(saveData.currentCharacter);
  if(skins.length===0){
    html+='<p class="info-text">该角色暂无皮肤</p>';
  }else{
    html+='<div style="display:flex;flex-wrap:wrap;justify-content:center">';
    // 默认皮肤（无）
    html+=`<div class="char-card ${!equippedSkinId?'selected':''}" data-skin="" style="width:160px"><div style="font-size:32px">${curChar.icon}</div><h3>默认</h3><p style="font-size:11px;color:#8b949e">原始外观</p><p style="font-size:11px;color:#3fb950">已装备</p></div>`;
    for(const s of skins){
      const owned=saveData.ownedSkins.includes(s.id);
      const equipped=equippedSkinId===s.id;
      const rarColor=GEAR_RARITIES[s.rarity]?.color||'#8b949e';
      html+=`<div class="char-card ${equipped?'selected':''} ${!owned?'locked':''}" data-skin="${s.id}" style="width:160px">
        <div style="font-size:32px">${s.icon}</div>
        <h3>${s.name}</h3>
        <p style="font-size:11px;color:#8b949e">${s.desc}</p>
        <p style="font-size:10px;color:${rarColor};font-weight:bold">${GEAR_RARITIES[s.rarity]?.name||''}</p>
        ${equipped?'<p style="font-size:11px;color:#3fb950">已装备</p>':(owned?'<p style="font-size:10px;color:#4a9b8e">点击装备</p>':'<p style="font-size:10px;color:#8b949e">抽奖获取</p>')}
      </div>`;
    }
    html+='</div>';
  }
  html+='<div class="panel-actions"><button class="sec-btn" id="backFromChar">返回</button></div>';
  ov.innerHTML=html;
  ov.scrollTop=0;
  // 角色卡片点击：切换/解锁角色
  ov.querySelectorAll('[data-char]').forEach(el=>{
    _bindTap(el,e=>{
      if(e.target.closest('[data-skin]'))return;
      const id=el.dataset.char; const c=CHARACTERS[id];
      if(saveData.unlockedCharacters.includes(id)){selectCharacter(id);showCharMenu();}
      else{if(unlockCharacter(id))showCharMenu(); else flashMsg('积分不足！');}
    });
  });
  // 皮肤卡片点击：装备/卸下皮肤
  ov.querySelectorAll('[data-skin]').forEach(el=>{
    _bindTap(el,()=>{
      const sid=el.dataset.skin;
      if(!saveData.equippedSkins)saveData.equippedSkins={};
      if(sid===''){delete saveData.equippedSkins[saveData.currentCharacter];}
      else{
        if(!saveData.ownedSkins.includes(sid)){flashMsg('未拥有该皮肤');return;}
        saveData.equippedSkins[saveData.currentCharacter]=sid;
      }
      saveSave(); showCharMenu();
    });
  });
  _bindTap(document.getElementById('backFromChar'),()=>{ov.classList.add('hidden');showBagMenu();});
}

// ==================== 武器菜单 ====================
function showWeaponMenu(){
  const ov=document.getElementById('weaponOverlay'); ov.classList.remove('hidden');
  let html='<h2>🔫 武器商店</h2><p class="subtitle">按强度定价 · 积分购买与进阶 · 满阶段3★</p>';
  html+=`<p style="font-size:18px;color:#f0883e">当前积分: ${saveData.totalScore}</p>`;
  // 按 tier 升序展示（price=0且未拥有的武器为专属武器，不显示在商店中）
  const sorted=Object.entries(WEAPONS).sort((a,b)=>(a[1].tier||1)-(b[1].tier||1));
  html+='<div style="display:flex;flex-wrap:wrap;justify-content:center;margin-top:10px">';
  for(const[id,w]of sorted){
    const owned=saveData.ownedWeapons[id]||0;
    // 专属武器（price=0）未拥有时不显示在商店
    if(owned===0&&(w.price||0)===0&&id!=='pistol')continue;
    const sel=saveData.currentWeapon===id;
    const stage=owned>0?getWeaponStage(id):0;
    const maxStage=WEAPON_STAGE_MULTI.length-1; // 2 -> 3阶段(0/1/2)
    const isMax=stage>=maxStage;
    const stats=`伤害:${w.bulletDamage} 射速:${(1/w.fireCooldown).toFixed(1)}/s 子弹:${w.bulletCount||1} 穿透:${w.pierce||0}`;
    const tierColor=['#8b949e','#3fb950','#58a6ff','#bc8cff','#ffd700'][Math.min(4,(w.tier||1)-1)];
    let actionHtml='';
    if(owned>0){
      if(isMax){
        actionHtml=`<p style="color:#ffd700;font-weight:bold">满阶 ${'★'.repeat(stage+1)}</p>`;
      }else{
        const upPrice=w.upgradePrice*(stage+1);
        actionHtml=`<p style="color:#ffd700">阶段${stage+1} ${'★'.repeat(stage+1)}</p><button class="sec-btn" data-buy-upgrade="${id}" style="margin-top:6px;font-size:12px;padding:4px 10px">进阶 (${upPrice}分)</button>`;
      }
    }else{
      actionHtml=`<p style="color:#8b949e">未拥有</p><button class="main-btn" data-buy-weapon="${id}" style="margin-top:6px;font-size:12px;padding:4px 10px;${saveData.totalScore>=(w.price||0)?'':'opacity:0.5'}">购买 (${w.price||0}分)</button>`;
    }
    html+=`<div class="weapon-card ${sel?'selected':''} ${!owned?'locked':''}" data-weapon="${id}" style="position:relative">
      <div style="position:absolute;top:6px;right:8px;font-size:10px;color:${tierColor};font-weight:bold">T${w.tier||1}</div>
      <div style="font-size:36px">${w.icon}</div>
      <h3>${w.name}</h3>
      <p style="font-size:11px;color:#8b949e">${stats}</p>
      <p style="font-size:11px;color:#6e7681;margin:4px 0">${w.desc||''}</p>
      ${actionHtml}
      <div style="font-size:11px;color:#8b949e;margin-top:4px">${getCraftSummary(id)}</div>
      ${owned>0?'<p style="font-size:10px;color:#4a9b8e;margin-top:4px">点击卡片装备</p>':''}
    </div>`;
  }
  html+='</div><div class="panel-actions"><button class="sec-btn" id="backFromWeapon">返回</button></div>';
  ov.innerHTML=html;
  ov.scrollTop=0;
  // 卡片点击：装备武器
  ov.querySelectorAll('.weapon-card').forEach(el=>{
    _bindTap(el,e=>{
      if(e.target.closest('[data-buy-weapon]')||e.target.closest('[data-buy-upgrade]'))return;
      const id=el.dataset.weapon;
      if(saveData.ownedWeapons[id]){saveData.currentWeapon=id;saveSave();showWeaponMenu();}
    });
  });
  // 购买武器
  ov.querySelectorAll('[data-buy-weapon]').forEach(btn=>{
    _bindTap(btn,e=>{
      e.stopPropagation();
      const id=btn.dataset.buyWeapon;
      const w=WEAPONS[id]; if(!w)return;
      const price=w.price||0;
      if(saveData.totalScore<price){flashMsg('积分不足！');return;}
      saveData.totalScore-=price;
      saveData.ownedWeapons[id]=1; // 阶段1
      saveSave(); flashMsg(`🎉 已购买 ${w.name}！`);
      showWeaponMenu();
    });
  });
  // 进阶武器
  ov.querySelectorAll('[data-buy-upgrade]').forEach(btn=>{
    _bindTap(btn,e=>{
      e.stopPropagation();
      const id=btn.dataset.buyUpgrade;
      const w=WEAPONS[id]; if(!w)return;
      const stage=getWeaponStage(id);
      const maxStage=WEAPON_STAGE_MULTI.length-1;
      if(stage>=maxStage){flashMsg('已满阶！');return;}
      const price=w.upgradePrice*(stage+1);
      if(saveData.totalScore<price){flashMsg('积分不足！');return;}
      saveData.totalScore-=price;
      saveData.ownedWeapons[id]=(saveData.ownedWeapons[id]||0)+1;
      saveSave(); flashMsg(`⬆️ ${w.name} 升至阶段${stage+2}！`);
      showWeaponMenu();
    });
  });
  _bindTap(document.getElementById('backFromWeapon'),()=>{ov.classList.add('hidden');showBagMenu();});
}
function getCraftSummary(id){
  const crafts=saveData.weaponCrafts[id]||[]; if(crafts.length===0)return '无词条';
  return crafts.map(c=>`${c.name}+${c.value}`).join(', ');
}
function flashMsg(text){
  let el=document.getElementById('flashMsg');
  if(!el){el=document.createElement('div');el.id='flashMsg';el.style.cssText='position:fixed;top:calc(60px + env(safe-area-inset-top, 0px));left:50%;transform:translateX(-50%);background:#1a1f2e;color:#ffd970;padding:12px 24px;border-radius:8px;border:1px solid #ffd970;z-index:100000;font-size:16px;pointer-events:none;opacity:0;transition:opacity 0.3s;max-width:90vw;box-sizing:border-box;text-align:center;';document.body.appendChild(el);}
  el.textContent=text; el.style.opacity='1';
  clearTimeout(el._timer); el._timer=setTimeout(()=>{el.style.opacity='0';},1500);
}
// ==================== 通用翻页工具（手机友好） ====================
// 全局分页状态：每个overlay独立维护页码
const _pagedState={}; // key -> { page, pageSize, tab }
function getPagedState(key, init={page:1,pageSize:6,tab:null}){
  if(!_pagedState[key])_pagedState[key]={...init};
  return _pagedState[key];
}
function resetPagedState(key, init){ _pagedState[key]={...init}; }
// 生成分页导航HTML：上一页/页码/下一页
function pagedNavHTML(key, total, pageSize, page){
  const totalPages=Math.max(1, Math.ceil(total/pageSize));
  if(totalPages<=1)return '';
  return `<div class="paged-nav" data-paged-key="${key}">
    <button class="pg-btn" data-pg-prev="${key}" ${page<=1?'disabled':''}>◀ 上一页</button>
    <span class="pg-info">第 ${page}/${totalPages} 页</span>
    <button class="pg-btn" data-pg-next="${key}" ${page>=totalPages?'disabled':''}>下一页 ▶</button>
  </div>`;
}
// 绑定分页按钮（在 overlay 内查找）。rerender: 重新渲染函数
function bindPagedNav(overlay, rerender){
  if(!overlay)return;
  overlay.querySelectorAll('[data-pg-prev]').forEach(btn=>{
    _bindTap(btn,()=>{
      const k=btn.dataset.pgPrev; const s=_pagedState[k]; if(!s||s.page<=1)return;
      s.page--; rerender();
    });
  });
  overlay.querySelectorAll('[data-pg-next]').forEach(btn=>{
    _bindTap(btn,()=>{
      const k=btn.dataset.pgNext; const s=_pagedState[k]; if(!s)return;
      const totalPages=Math.max(1, Math.ceil(s._total/s.pageSize));
      if(s.page>=totalPages)return;
      s.page++; rerender();
    });
  });
}
// 记录总数用于翻页判断（在render时调用）
function pagedSetTotal(key, total){
  if(!_pagedState[key])_pagedState[key]={page:1,pageSize:6,tab:null};
  _pagedState[key]._total=total;
  // 若当前页超出总页数，回到第1页
  const totalPages=Math.max(1, Math.ceil(total/_pagedState[key].pageSize));
  if(_pagedState[key].page>totalPages)_pagedState[key].page=1;
}

// ==================== 宠物菜单 ====================
function showPetMenu(){
  const ov=document.getElementById('petOverlay'); ov.classList.remove('hidden');
  let html='<h2>🐉 宠物系统</h2><p class="subtitle">选择随行宠物 | Boss有15%几率掉落宝宝 | 同类宝宝可升阶</p>';
  html+=`<p style="font-size:14px;color:#f0883e">回收宠物 +500积分/只 | 升阶消耗1只同类宝宝</p>`;
  html+='<div class="section-title">已拥有宠物 ('+saveData.ownedPets.length+'只)</div>';
  if(saveData.ownedPets.length===0){
    html+='<p class="info-text">还没有宠物，击败Boss有几率获得！</p>';
  }else{
    // 翻页：每页6只
    const pst=getPagedState('pet',{page:1,pageSize:6});
    pagedSetTotal('pet', saveData.ownedPets.length);
    const pageSize=pst.pageSize;
    const totalPages=Math.max(1,Math.ceil(saveData.ownedPets.length/pageSize));
    if(pst.page>totalPages)pst.page=1;
    const start=(pst.page-1)*pageSize;
    const end=Math.min(start+pageSize, saveData.ownedPets.length);
    html+=pagedNavHTML('pet', saveData.ownedPets.length, pageSize, pst.page);
    html+='<div style="display:flex;flex-wrap:wrap;justify-content:center">';
    for(let i=start;i<end;i++){
      const p=saveData.ownedPets[i];
      const def=getPetDef(p.def); if(!def)continue;
      const sel=saveData.selectedPet===i;
      const evo=def.evoStats[p.stage];
      // 计算同类宝宝数量（不含自身）
      const sameCount=saveData.ownedPets.filter((pp,j)=>j!==i&&pp.def===p.def).length;
      const canEvolve=p.stage<2&&sameCount>0;
      let evoHint='';
      if(p.stage<2){
        evoHint=canEvolve?`<button class="sec-btn" style="margin-top:6px;font-size:11px;border-color:#ffd700;color:#ffd700" data-evolve="${i}">升阶 (消耗1只同类)</button>`:'<p style="font-size:10px;color:#8b949e;margin-top:4px">需要1只同类宝宝升阶</p>';
      }else{
        evoHint='<p style="color:#3fb950;font-size:12px">已满阶</p>';
      }
      html+=`<div class="pet-card ${sel?'selected':''}" data-pet="${i}" style="position:relative">
        <div style="font-size:36px">${def.icon}</div>
        <h3>${def.name}</h3>
        <p style="color:#ffd700">${'★'.repeat(p.stage+1)}</p>
        <p style="font-size:11px;color:#8b949e">${def.desc}</p>
        <p style="font-size:11px;color:#58a6ff">伤害x${evo.dmgMul}</p>
        ${canEvolve?`<p style="font-size:10px;color:#3fb950">同类x${sameCount}</p>`:''}
        ${evoHint}
        <button class="sec-btn" style="margin-top:4px;font-size:10px;border-color:#f85149;color:#f85149" data-recycle="${i}">回收 +500分</button>
      </div>`;
    }
    html+='</div>';
    if(saveData.selectedPet!==null){
      html+='<button class="sec-btn" id="unselectPet" style="margin-top:10px">取消选择宠物</button>';
    }
    // 一键回收：按Boss类型，除最高阶外全部回收
    const petGroups={};
    saveData.ownedPets.forEach((p,idx)=>{
      if(!petGroups[p.def])petGroups[p.def]=[];
      petGroups[p.def].push({idx,stage:p.stage});
    });
    const recyclableGroups=Object.entries(petGroups).filter(([def,pets])=>pets.length>1);
    if(recyclableGroups.length>0){
      html+='<div style="margin-top:12px;padding:10px;background:#161b22;border:1px solid #f85149;border-radius:8px;max-width:600px;margin-left:auto;margin-right:auto">';
      html+='<div style="color:#f85149;font-size:13px;margin-bottom:6px">🗑️ 一键回收（保留每类最高阶）</div>';
      for(const[defId,pets] of recyclableGroups){
        const def=getPetDef(parseInt(defId));
        if(!def)continue;
        // 找最高阶的索引
        const maxStage=Math.max(...pets.map(p=>p.stage));
        const toRecycle=pets.filter(p=>p.stage<maxStage);
        if(toRecycle.length===0)continue;
        const reward=toRecycle.reduce((s,p)=>s+500+p.stage*250,0);
        html+=`<button class="sec-btn" data-batch-recycle="${defId}" style="margin:3px;font-size:11px;border-color:#f85149;color:#f85149">${def.icon} ${def.name} 回收${toRecycle.length}只 +${reward}分</button>`;
      }
      html+='</div>';
    }
  }
  html+='<div class="panel-actions"><button class="sec-btn" id="backFromPet">返回</button></div>';
  ov.innerHTML=html;
  ov.querySelectorAll('.pet-card').forEach(el=>{
    _bindTap(el,e=>{
      if(e.target.dataset.evolve||e.target.dataset.recycle)return;
      const idx=parseInt(el.dataset.pet);
      saveData.selectedPet=saveData.selectedPet===idx?null:idx; saveSave(); showPetMenu();
    });
  });
  // 升阶：消耗1只同类宝宝
  ov.querySelectorAll('[data-evolve]').forEach(el=>{
    _bindTap(el,e=>{
      e.stopPropagation(); const idx=parseInt(el.dataset.evolve);
      const p=saveData.ownedPets[idx]; const def=getPetDef(p.def);
      // 找一只同类宝宝（不含自身）
      const sameIdx=saveData.ownedPets.findIndex((pp,i)=>i!==idx&&pp.def===p.def);
      if(sameIdx>=0){
        saveData.ownedPets.splice(sameIdx,1); // 消耗同类宝宝
        // 注意：如果删的在idx前面，idx要-1
        const idx_adj=sameIdx<idx?idx-1:idx;
        saveData.ownedPets[idx_adj].stage++;
        // 如果选中的宠物被消耗了，修正选择
        if(saveData.selectedPet===sameIdx)saveData.selectedPet=null;
        else if(saveData.selectedPet!==null&&sameIdx<saveData.selectedPet)saveData.selectedPet--;
        saveSave(); showPetMenu();
      }
    });
  });
  // 回收：500积分/只
  ov.querySelectorAll('[data-recycle]').forEach(el=>{
    _bindTap(el,e=>{
      e.stopPropagation(); const idx=parseInt(el.dataset.recycle);
      const p=saveData.ownedPets[idx]; const def=getPetDef(p.def);
      if(confirm(`确定回收 ${def.name} ★${p.stage+1}？获得${500+p.stage*250}积分`)){
        const reward=500+p.stage*250; // 高阶宠物回收给更多
        saveData.totalScore+=reward;
        saveData.ownedPets.splice(idx,1);
        if(saveData.selectedPet===idx)saveData.selectedPet=null;
        else if(saveData.selectedPet!==null&&idx<saveData.selectedPet)saveData.selectedPet--;
        saveSave(); showPetMenu();
      }
    });
  });
  // 批量回收：按Boss类型，保留最高阶，回收其余
  ov.querySelectorAll('[data-batch-recycle]').forEach(btn=>{
    _bindTap(btn,e=>{
      e.stopPropagation();
      const defId=parseInt(btn.dataset.batchRecycle);
      const def=getPetDef(defId);
      if(!def)return;
      // 找出该类型的所有宠物索引和阶段
      const petsList=saveData.ownedPets.map((p,i)=>({idx:i,def:p.def,stage:p.stage})).filter(p=>p.def===defId);
      if(petsList.length<=1)return;
      const maxStage=Math.max(...petsList.map(p=>p.stage));
      const toRecycle=petsList.filter(p=>p.stage<maxStage);
      if(toRecycle.length===0){showToast('没有可回收的宠物（所有同类都已满阶）','#8b949e',2000);return;}
      const reward=toRecycle.reduce((s,p)=>s+500+p.stage*250,0);
      if(confirm(`确定回收 ${toRecycle.length}只 ${def.name}（保留最高阶）？获得${reward}积分`)){
        // 从后往前删除，避免索引错位
        const indicesToDelete=toRecycle.map(p=>p.idx).sort((a,b)=>b-a);
        for(const idx of indicesToDelete){
          saveData.ownedPets.splice(idx,1);
          if(saveData.selectedPet===idx)saveData.selectedPet=null;
          else if(saveData.selectedPet!==null&&idx<saveData.selectedPet)saveData.selectedPet--;
        }
        saveData.totalScore+=reward;
        saveSave(); showPetMenu();
        showToast(`回收${toRecycle.length}只 ${def.name}，获得${reward}积分`,'#3fb950',2500);
      }
    });
  });
  const us=document.getElementById('unselectPet'); if(us)_bindTap(us,()=>{saveData.selectedPet=null;saveSave();showPetMenu();});
  // 翻页按钮绑定
  bindPagedNav(ov, showPetMenu);
  _bindTap(document.getElementById('backFromPet'),()=>{ov.classList.add('hidden');showBagMenu();});
}

// ==================== 轮盘抽奖（Boss宝宝/金装/皮肤）====================
const ROULETTE_PRICE=800;
let lastRouletteResult=null;
function showRouletteMenu(){
  const ov=document.getElementById('rouletteOverlay'); ov.classList.remove('hidden');
  let html='<h2>🎰 灵兽抽奖</h2><p class="subtitle">800分/次 · 可得Boss宝宝、传说装备、角色皮肤</p>';
  html+=`<p style="font-size:18px;color:#f0883e">当前积分: ${saveData.totalScore}</p>`;
  // 奖池预览
  html+='<div style="display:flex;gap:10px;margin:14px 0;flex-wrap:wrap;justify-content:center">';
  html+='<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px;text-align:center;width:130px"><div style="color:#58a6ff;font-weight:bold">🐉 Boss宝宝</div><div style="font-size:11px;color:#8b949e;margin-top:4px">50%概率</div><div style="font-size:11px;color:#6e7681">重复自动升阶</div></div>';
  html+='<div style="background:#161b22;border:1px solid #ffd700;border-radius:8px;padding:10px;text-align:center;width:130px"><div style="color:#ffd700;font-weight:bold">⚒️ 传说装备</div><div style="font-size:11px;color:#8b949e;margin-top:4px">35%概率</div><div style="font-size:11px;color:#6e7681">随机部位金装</div></div>';
  html+='<div style="background:#161b22;border:1px solid #bc8cff;border-radius:8px;padding:10px;text-align:center;width:130px"><div style="color:#bc8cff;font-weight:bold">✨ 角色皮肤</div><div style="font-size:11px;color:#8b949e;margin-top:4px">15%概率</div><div style="font-size:11px;color:#6e7681">当前角色池</div></div>';
  html+='</div>';
  if(lastRouletteResult){
    html+=`<div style="background:#1a1f2e;border:1px solid #ffd970;border-radius:8px;padding:12px;margin:10px 0">${lastRouletteResult}</div>`;
  }
  html+=`<button class="main-btn" id="spinBtn" ${saveData.totalScore<ROULETTE_PRICE?'style="opacity:0.5"':''}>抽奖 (${ROULETTE_PRICE}分)</button>`;
  html+='<div class="panel-actions"><button class="sec-btn" id="backFromRoulette">返回</button></div>';
  ov.innerHTML=html;
  _bindTap(document.getElementById('spinBtn'),()=>{
    if(saveData.totalScore<ROULETTE_PRICE){flashMsg('积分不足！');return;}
    saveData.totalScore-=ROULETTE_PRICE;
    const result=rollRoulette();
    lastRouletteResult=result.html;
    saveSave();
    showRouletteMenu();
  });
  _bindTap(document.getElementById('backFromRoulette'),()=>{ov.classList.add('hidden');showBagMenu();});
}
function rollRoulette(){
  const roll=Math.random();
  // 50% Boss宝宝, 35% 金装, 15% 皮肤
  if(roll<0.5){
    // Boss宝宝 - 优先抽未拥有的，重复则升阶
    const ownedIdx=new Set(saveData.ownedPets.map(p=>p.def));
    const missing=BOSS_PET_DEFS.filter(d=>!ownedIdx.has(d.bossIdx));
    let def;
    if(missing.length>0 && Math.random()<0.7){
      def=missing[randInt(0,missing.length-1)];
    }else{
      def=BOSS_PET_DEFS[randInt(0,BOSS_PET_DEFS.length-1)];
    }
    const existing=saveData.ownedPets.find(p=>p.def===def.bossIdx);
    if(existing){
      if(existing.stage>=2){
        // 满阶补偿
        const reward=500+existing.stage*250;
        saveData.totalScore+=reward;
        return {html:`<div style="color:#f0883e">🐉 抽到 <b>${def.icon} ${def.name}</b> (已满阶)</div><div style="color:#3fb950;font-size:13px">+${reward}积分补偿</div>`,text:'满阶补偿'};
      }else{
        existing.stage+=1;
        return {html:`<div style="color:#58a6ff">⬆️ <b>${def.icon} ${def.name}</b> 升至 ★${existing.stage+1}！</div>`,text:'升阶'};
      }
    }else{
      saveData.ownedPets.push({def:def.bossIdx,stage:0});
      return {html:`<div style="color:#58a6ff">🎉 新获得 <b>${def.icon} ${def.name}</b>！</div><div style="font-size:12px;color:#8b949e">${def.desc}</div>`,text:'新宠物'};
    }
  }else if(roll<0.85){
    // 传说(金)装备
    const slot=GEAR_SLOTS[randInt(0,GEAR_SLOTS.length-1)];
    const gear=generateGear(slot,'legendary');
    saveData.gearBag.push(gear);
    const rn=GEAR_RARITIES.legendary;
    return {html:`<div style="color:#ffd700">🎉 获得 <b>${GEAR_SLOT_ICONS[slot]} ${rn.name} ${gear.name}</b>！</div><div style="font-size:12px;color:#8b949e">${gear.stats.map(s=>`${s.name}+${s.value}`).join(', ')}</div>`,text:'金装'};
  }else{
    // 角色皮肤 - 仅抽当前角色未拥有的皮肤
    const charId=saveData.currentCharacter;
    const allSkins=getSkinsForChar(charId);
    const missing=allSkins.filter(s=>!saveData.ownedSkins.includes(s.id));
    if(missing.length===0){
      // 已拥有所有皮肤，给其他角色未拥有皮肤
      const otherMissing=Object.values(SKINS).filter(s=>s.charId!==charId && !saveData.ownedSkins.includes(s.id));
      if(otherMissing.length>0){
        const skin=otherMissing[randInt(0,otherMissing.length-1)];
        saveData.ownedSkins.push(skin.id);
        const char=CHARACTERS[skin.charId];
        return {html:`<div style="color:#bc8cff">🎉 获得皮肤 <b>${skin.icon} ${skin.name}</b>！</div><div style="font-size:12px;color:#8b949e">所属角色: ${char.icon} ${char.name}</div>`,text:'皮肤'};
      }else{
        const reward=1000;
        saveData.totalScore+=reward;
        return {html:`<div style="color:#bc8cff">✨ 抽到皮肤，但已全收集！</div><div style="color:#3fb950;font-size:13px">+${reward}积分补偿</div>`,text:'皮肤满补偿'};
      }
    }else{
      const skin=missing[randInt(0,missing.length-1)];
      saveData.ownedSkins.push(skin.id);
      return {html:`<div style="color:#bc8cff">🎉 新获得皮肤 <b>${skin.icon} ${skin.name}</b>！</div><div style="font-size:12px;color:#8b949e">${skin.desc}</div>`,text:'新皮肤'};
    }
  }
}

// ==================== 武器打造 ====================
const MAX_WEAPON_CRAFTS=4; // 每把武器最多4个词条（削弱：原5个过于强力）
function renderCraftList(){
  let lh='';
  for(const wid of Object.keys(WEAPONS)){
    const crafts=saveData.weaponCrafts[wid]||[]; if(crafts.length===0)continue;
    lh+=`<div class="craft-item"><div class="craft-item-name">${WEAPONS[wid].icon} ${WEAPONS[wid].name} <span style="color:#8b949e">(${crafts.length}/${MAX_WEAPON_CRAFTS})</span></div><div class="craft-item-affixes">${crafts.map(c=>`<span class="craft-affix rarity-${c.rarity}">${c.name}+${c.value}</span>`).join('')}</div></div>`;
  }
  return lh;
}
function showCraftMenu(){
  const ov=document.getElementById('craftOverlay'); ov.classList.remove('hidden');
  let html='<h2>⚒️ 武器打造</h2><p class="subtitle">300分打造一次 | 每把武器最多4个词条 | 满词条时可替换或舍弃</p>';
  html+=`<p style="font-size:18px;color:#f0883e">当前积分: ${saveData.totalScore}</p>`;
  html+='<div class="section-title">选择武器打造</div>';
  html+='<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:12px;width:100%;max-width:580px">';
  for(const[id,w]of Object.entries(WEAPONS)){
    if(!saveData.ownedWeapons[id])continue;
    const cnt=(saveData.weaponCrafts[id]||[]).length;
    html+=`<button class="sec-btn" data-craft-weapon="${id}">${w.icon} ${w.name} <span style="color:#8b949e;font-size:12px">${cnt}/${MAX_WEAPON_CRAFTS}</span></button>`;
  }
  html+='</div>';
  html+='<button class="main-btn" id="doCraftBtn" style="margin:6px 0 10px">打造 (300分)</button>';
  html+='<div id="craftResult" style="min-height:30px;margin:10px 0;width:100%;max-width:580px"></div>';
  html+='<div class="section-title">当前词条</div><div class="craft-list" id="craftListContainer">';
  html+=renderCraftList();
  html+='</div><div class="panel-actions"><button class="sec-btn" id="backFromCraft">返回</button></div>';
  ov.innerHTML=html;
  let selectedCraftWeapon=saveData.currentWeapon;
  // 高亮当前武器
  ov.querySelectorAll('[data-craft-weapon]').forEach(el=>{
    if(el.dataset.craftWeapon===selectedCraftWeapon)el.style.borderColor='#58a6ff';
    _bindTap(el,()=>{
      selectedCraftWeapon=el.dataset.craftWeapon;
      ov.querySelectorAll('[data-craft-weapon]').forEach(b=>b.style.borderColor='#30363d');
      el.style.borderColor='#58a6ff';
    });
  });
  // 打造按钮事件
  _bindTap(document.getElementById('doCraftBtn'),()=>{
    if(saveData.totalScore<300){document.getElementById('craftResult').textContent='积分不足！';return;}
    if(!saveData.weaponCrafts[selectedCraftWeapon])saveData.weaponCrafts[selectedCraftWeapon]=[];
    const crafts=saveData.weaponCrafts[selectedCraftWeapon];
    saveData.totalScore-=300;
    const result=rollCraft();
    if(crafts.length<MAX_WEAPON_CRAFTS){
      // 直接添加
      crafts.push(result);
      saveSave();
      document.getElementById('craftResult').innerHTML=`获得 <span class="rarity-${result.rarity}">${result.name}+${result.value}</span> 词条！(${crafts.length}/${MAX_WEAPON_CRAFTS})`;
      document.getElementById('craftListContainer').innerHTML=renderCraftList();
      refreshWeaponBtnCounts();
    }else{
      // 满词条：弹出替换/舍弃选择
      showCraftReplaceUI(selectedCraftWeapon,result);
    }
  });
  function refreshWeaponBtnCounts(){
    ov.querySelectorAll('[data-craft-weapon]').forEach(el=>{
      const wid=el.dataset.craftWeapon;
      const cnt=(saveData.weaponCrafts[wid]||[]).length;
      const w=WEAPONS[wid];
      el.innerHTML=`${w.icon} ${w.name} <span style="color:#8b949e;font-size:12px">${cnt}/${MAX_WEAPON_CRAFTS}</span>`;
    });
  }
  function showCraftReplaceUI(wid,newCraft){
    const res=document.getElementById('craftResult');
    let rh=`<div style="background:#161b22;padding:12px;border-radius:8px;border:1px solid #f0883e;margin:8px 0">`;
    rh+=`<div style="color:#f0883e;margin-bottom:8px">⚠️ ${WEAPONS[wid].name} 已满4词条！新获得：<span class="rarity-${newCraft.rarity}">${newCraft.name}+${newCraft.value}</span></div>`;
    rh+=`<div style="color:#8b949e;margin-bottom:6px;font-size:13px">选择一个已有词条进行替换，或舍弃新词条：</div>`;
    const crafts=saveData.weaponCrafts[wid];
    crafts.forEach((c,i)=>{
      rh+=`<button class="sec-btn" data-replace-idx="${i}" style="margin:4px;display:block;width:100%;text-align:left">替换 <span class="rarity-${c.rarity}">${c.name}+${c.value}</span> → <span class="rarity-${newCraft.rarity}">${newCraft.name}+${newCraft.value}</span></button>`;
    });
    rh+=`<button class="sec-btn" data-discard="1" style="margin:4px;display:block;width:100%;text-align:left;color:#8b949e">舍弃新词条</button>`;
    rh+=`</div>`;
    res.innerHTML=rh;
    res.querySelectorAll('[data-replace-idx]').forEach(btn=>{
      _bindTap(btn,()=>{
        const idx=parseInt(btn.dataset.replaceIdx);
        const old=crafts[idx];
        crafts[idx]=newCraft;
        saveSave();
        res.innerHTML=`已替换：<span class="rarity-${old.rarity}">${old.name}+${old.value}</span> → <span class="rarity-${newCraft.rarity}">${newCraft.name}+${newCraft.value}</span>`;
        document.getElementById('craftListContainer').innerHTML=renderCraftList();
      });
    });
    _bindTap(res.querySelector('[data-discard]'),()=>{
      res.innerHTML=`已舍弃 <span class="rarity-${newCraft.rarity}">${newCraft.name}+${newCraft.value}</span> 词条`;
    });
  }
  _bindTap(document.getElementById('backFromCraft'),()=>{ov.classList.add('hidden');showBagMenu();});
}

// ==================== 装备菜单 ====================
let selectedSynthUids=[];
let synthFilterRarity=null; // 合成筛选阶级，选中装备后只显示同阶级
let gearFilterSlot=null;    // 装备图鉴部位筛选
let gearFilterRarity=null;  // 装备图鉴稀有度筛选
// 装备分解回报：按稀有度给积分
const GEAR_DECOMPOSE_REWARDS={common:30,rare:80,epic:180,legendary:400,mythic:1000};
// 装备词条可视化：图标+数值条展示
// 根据词条类型计算相对强度（0-100%），渲染为进度条
function _renderStatBar(stat){
  if(!stat) return '';
  // 各词条的最大参考值（用于计算进度条百分比）
  const maxVals = {
    damage: 6,    // 伤害 1-2×3阶=6
    maxhp: 6,     // 生命
    speed: 30,    // 移速
    firerate: 0.24, // 射速
    crit: 0.30,   // 暴击率
    critdmg: 1.5, // 暴击伤害
    pierce: 3,    // 穿透
    shield: 6,    // 护盾
    regen: 6      // 回血
  };
  const max = maxVals[stat.id] || 5;
  const pct = Math.min(100, Math.round((stat.value / max) * 100));
  // 各词条颜色
  const colors = {
    damage:'#f85149', maxhp:'#3fb950', speed:'#58a6ff', firerate:'#ffa657',
    crit:'#bc8cff', critdmg:'#ff6b9d', pierce:'#79c0ff', shield:'#d2a8ff', regen:'#7ee787'
  };
  const c = colors[stat.id] || '#c9d1d9';
  const fmtVal = (stat.value < 1 ? Math.round(stat.value*100)/100 : stat.value);
  return `<div style="display:flex;align-items:center;gap:4px;margin:1px 0;font-size:9px">
    <span style="width:14px;text-align:center;flex-shrink:0">${stat.icon}</span>
    <div style="flex:1;height:8px;background:#0d1117;border-radius:4px;overflow:hidden;position:relative">
      <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,${c}88,${c});border-radius:4px;transition:width 0.3s"></div>
    </div>
    <span style="color:${c};font-weight:bold;min-width:28px;text-align:right;flex-shrink:0">+${fmtVal}</span>
  </div>`;
}
// 装备对比提示：显示装备此装备后与当前已装备的属性差值
// g: 背包中的装备对象，返回 HTML 字符串（差值提示条）
function _renderGearCompare(g){
  const cur=saveData.equippedGear[g.slot];
  if(!cur){
    // 当前槽位为空：所有属性都是增益
    let html='<div style="margin-top:3px;padding:3px 5px;background:rgba(63,185,80,0.1);border:1px solid rgba(63,185,80,0.3);border-radius:3px;font-size:9px">';
    html+='<span style="color:#3fb950">✓ 装备后：'+(g.stats||[]).map(s=>`+${s.value<1?Math.round(s.value*100)/100:s.value}${s.icon}`).join(' ')+'</span>';
    // Boss套装进度预览
    if(g.rarity==='mythic' && g.bossIdx!==undefined && g.bossIdx!==null){
      const set=new Set();
      for(const sl of GEAR_SLOTS){
        const e=saveData.equippedGear[sl];
        if(e && e.rarity==='mythic' && e.bossIdx!==undefined && e.bossIdx!==null && sl!==g.slot)set.add(e.bossIdx);
      }
      set.add(g.bossIdx);
      const cnt=set.size;
      if(cnt>=4)html+='<br><span style="color:#ffd700">✨ 装备后激活Boss神话套装(4/4)！</span>';
      else html+=`<br><span style="color:#8b949e">✨ Boss神话 ${cnt}/4</span>`;
    }
    html+='</div>';
    return html;
  }
  // 计算同词条差值
  const diffs=[];
  const curStats={};
  (cur.stats||[]).forEach(s=>{curStats[s.id]=(curStats[s.id]||0)+s.value;});
  const newStats={};
  (g.stats||[]).forEach(s=>{newStats[s.id]=(newStats[s.id]||0)+s.value;});
  const allIds=new Set([...Object.keys(curStats),...Object.keys(newStats)]);
  // 找词条图标（直接复用GEAR_STAT_POOL的icon，避免不一致）
  const iconMap=Object.fromEntries(GEAR_STAT_POOL.map(s=>[s.id,s.icon]));
  for(const id of allIds){
    const cv=curStats[id]||0, nv=newStats[id]||0;
    const diff=nv-cv;
    if(Math.abs(diff)>0.001){
      diffs.push({id, diff, icon:iconMap[id]||'•'});
    }
  }
  let html='';
  if(diffs.length>0){
    html='<div style="margin-top:3px;padding:3px 5px;background:rgba(22,27,34,0.7);border:1px solid rgba(136,144,150,0.3);border-radius:3px;font-size:9px">';
    html+='<span style="color:#8b949e">对比当前：';
    html+=diffs.map(d=>{
      const v=Math.abs(d.diff)<1?Math.round(Math.abs(d.diff)*100)/100:d.diff;
      const sign=d.diff>0?'+':'';
      const color=d.diff>0?'#3fb950':'#f85149';
      return `<span style="color:${color}">${sign}${v}${d.icon}</span>`;
    }).join(' ');
    html+='</span>';
    // Boss套装进度预览
    if(g.rarity==='mythic' && g.bossIdx!==undefined && g.bossIdx!==null){
      const set=new Set();
      for(const sl of GEAR_SLOTS){
        const e=saveData.equippedGear[sl];
        if(e && e.rarity==='mythic' && e.bossIdx!==undefined && e.bossIdx!==null && sl!==g.slot)set.add(e.bossIdx);
      }
      set.add(g.bossIdx);
      const cnt=set.size;
      const curCnt=((()=>{const s=new Set();for(const sl of GEAR_SLOTS){const e=saveData.equippedGear[sl];if(e&&e.rarity==='mythic'&&e.bossIdx!==undefined&&e.bossIdx!==null)s.add(e.bossIdx);}return s.size;})());
      if(cnt>curCnt){
        if(cnt>=4)html+='<br><span style="color:#ffd700">✨ 装备后激活Boss神话套装(4/4)！</span>';
        else html+=`<br><span style="color:#ffd700">✨ 装备后Boss神话 ${cnt}/4 (↑${cnt-curCnt})</span>`;
      }else if(curCnt>=4 && cnt<4){
        html+='<br><span style="color:#f85149">⚠ 装备后失去Boss神话套装!</span>';
      }
    }
    html+='</div>';
  }
  return html;
}
function showGearMenu(){
  const ov=document.getElementById('gearOverlay'); ov.classList.remove('hidden');
  const _essence=saveData.gearEssence||0;
  let html=`<h2>🎽 装备背包</h2>`;
  // 精魄数量显示
  html+=`<div style="text-align:center;margin:0 auto 8px;max-width:680px;padding:5px 10px;background:linear-gradient(90deg,rgba(188,140,255,0.1),rgba(88,166,255,0.1),rgba(188,140,255,0.1));border:1px solid #bc8cff;border-radius:6px">
    <span style="color:#bc8cff;font-size:13px;font-weight:bold;letter-spacing:1px">💠 装备精魄：${_essence}</span>
    <span style="color:#8b949e;font-size:10px;margin-left:8px">分解装备获得 · 用于定向重铸/升阶</span>
  </div>`;
  // 专属词条总览（可折叠）- 让玩家了解传说/神话词条功效
  html+=`<details style="max-width:680px;margin:0 auto 8px;padding:6px 10px;background:rgba(22,27,34,0.7);border:1px solid rgba(212,160,23,0.25);border-radius:6px">
    <summary style="cursor:pointer;color:#ffd970;font-size:12px;letter-spacing:1px">📜 专属词条功效总览（点击展开）</summary>
    <div style="margin-top:8px;font-size:11px;line-height:1.7">
      <div style="color:#ffd970;margin-bottom:4px">✨ 传说词条（金色）：</div>
      ${GEAR_LEGENDARY_AFFIXES.map(a=>`<div style="color:#c9d1d9;padding:1px 8px">${a.icon} <b style="color:#ffd970">${a.name}</b> - <span style="color:#8b949e">${a.desc}</span></div>`).join('')}
      <div style="color:#ff4444;margin:8px 0 4px">🔥 神话词条（红色）：</div>
      ${GEAR_MYTHIC_AFFIXES.map(a=>`<div style="color:#c9d1d9;padding:1px 8px">${a.icon} <b style="color:#ff4444">${a.name}</b> - <span style="color:#8b949e">${a.desc}</span></div>`).join('')}
      <div style="color:#ffd700;margin:8px 0 4px">👑 Boss专属神话词条（仅神话品质Boss装备）：</div>
      ${Object.entries(BOSS_GEAR_TABLE).map(([idx,def])=>{
        const b=BOSS_TYPES[idx];
        return `<div style="color:#c9d1d9;padding:1px 8px">${b.icon} <b style="color:#ffd700">${def.mythicName}</b> (${b.name}) - ${def.affix.icon} <b style="color:#ffd700">${def.affix.name}</b> - <span style="color:#8b949e">${def.affix.desc}</span></div>`;
      }).join('')}
      <div style="color:#ffd700;margin:8px 0 4px">✨ 4件不同Boss神话装备激活：</div>
      <div style="color:#c9d1d9;padding:1px 8px">⚜️ <b style="color:#ffd700">圆弧护盾</b> - <span style="color:#8b949e">技能键释放召唤120°金色光环围绕主角旋转4秒，挡住敌方弹幕</span></div>
      <div style="color:#bc8cff;margin:8px 0 4px">🔮 Build联动（同时满足条件时触发）：</div>
      ${(typeof GEAR_SYNERGIES!=='undefined'?GEAR_SYNERGIES:[]).map(s=>{
        const isActive=(typeof activeGearSynergies!=='undefined' && activeGearSynergies.some(a=>a.id===s.id));
        return `<div style="color:${isActive?'#bc8cff':'#8b949e'};padding:1px 8px${isActive?';background:rgba(188,140,255,0.08)':''}">${isActive?'✓':'○'} ${s.icon} <b style="color:#bc8cff">${s.name}</b> - <span style="color:#8b949e">${s.desc}</span></div>`;
      }).join('')}
    </div>
  </details>`;
  // ===== 已装备（横排4格） =====
  let mythicEquipped=0, legendaryEquipped=0;
  // 统计Boss神话套装进度（4件不同Boss的神话装备激活圆弧护盾）
  const _bossMythicSet=new Set();
  for(const slot of GEAR_SLOTS){
    const g=saveData.equippedGear[slot];
    if(g && g.rarity==='mythic' && g.bossIdx!==undefined && g.bossIdx!==null)_bossMythicSet.add(g.bossIdx);
  }
  const _bossMythicCnt=_bossMythicSet.size;
  html+=`<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:0 auto 6px;max-width:680px">`;
  for(const slot of GEAR_SLOTS){
    const g=saveData.equippedGear[slot];
    if(g&&g.rarity==='mythic')mythicEquipped++;
    if(g&&g.rarity==='legendary')legendaryEquipped++;
    const rc=g?GEAR_RARITIES[g.rarity].color:'#30363d';
    // Boss装备角标（显示来源Boss图标）
    const _bossIcon=(g && g.bossIdx!==undefined && g.bossIdx!==null && BOSS_TYPES[g.bossIdx])?BOSS_TYPES[g.bossIdx].icon:'';
    const _isBossMythic=g && g.rarity==='mythic' && g.bossIdx!==undefined && g.bossIdx!==null;
    html+=`<div style="background:#161b22;border:2px solid ${rc};border-radius:6px;padding:6px;width:155px;text-align:center;cursor:pointer;position:relative" data-unequip="${slot}">
      ${_bossIcon?`<div style="position:absolute;top:2px;right:4px;font-size:14px;${_isBossMythic?'filter:drop-shadow(0 0 3px #ffd700)':''}" title="${BOSS_TYPES[g.bossIdx].name}装备">${_bossIcon}</div>`:''}
      <div style="font-size:16px">${GEAR_SLOT_ICONS[slot]} <span style="font-size:10px;color:#8b949e">${GEAR_SLOT_NAMES[slot]}</span></div>
      ${g?`<div style="font-size:11px;color:${rc};font-weight:bold;margin-top:2px">${g.name}</div>
      <div style="margin-top:3px">${(g.stats||[]).map(s=>_renderStatBar(s)).join('')}</div>
      ${g.specialAffix?`<div style="font-size:9px;color:${g.rarity==='mythic'?'#ff4444':'#ffd700'};margin-top:3px;padding:2px 4px;background:${g.rarity==='mythic'?'rgba(255,68,68,0.1)':'rgba(255,215,0,0.1)'};border-radius:3px;${_isBossMythic?'border:1px solid #ffd700;':''}">${g.specialAffix.icon} ${g.specialAffix.name}${_isBossMythic?' 👑':''}</div>`:''}
      <div style="font-size:9px;color:#f85149;margin-top:2px">点击卸下</div>`:'<div style="font-size:10px;color:#8b949e;margin-top:4px">空</div>'}
    </div>`;
  }
  html+=`</div>`;
  // 套装提示
  if(mythicEquipped>=4)html+=`<div style="text-align:center;margin-bottom:4px;padding:4px;background:linear-gradient(90deg,#3a1a1a,#5a2a2a,#3a1a1a);border:1px solid #ff4444;border-radius:4px"><span style="color:#ff4444;font-size:11px;font-weight:bold">🔥 神话套装 ${mythicEquipped}/4 已激活！</span><br><span style="color:#ffa0a0;font-size:9px">伤害×1.6 移速×1.3 生命×1.3 暴击+20% 暴伤+50% 穿透+2 吸血+3%</span></div>`;
  else if(mythicEquipped>0)html+=`<div style="text-align:center;margin-bottom:4px"><span style="color:#ff4444;font-size:10px">🔥 神话 ${mythicEquipped}/4</span></div>`;
  // Boss神话套装进度（4件不同Boss激活圆弧护盾）
  if(_bossMythicCnt>=4){
    html+=`<div style="text-align:center;margin-bottom:4px;padding:4px;background:linear-gradient(90deg,#3a2a0a,#5a4015,#3a2a0a);border:1px solid #ffd700;border-radius:4px"><span style="color:#ffd700;font-size:11px;font-weight:bold">✨ Boss神话套装 ${_bossMythicCnt}/4 已激活！</span><br><span style="color:#ffe080;font-size:9px">技能键释放召唤圆弧护盾（120°金色光环挡弹幕，持续4秒）</span></div>`;
  }else if(_bossMythicCnt>0){
    html+=`<div style="text-align:center;margin-bottom:4px"><span style="color:#ffd700;font-size:10px">✨ Boss神话 ${_bossMythicCnt}/4（凑齐4件不同Boss激活圆弧护盾）</span></div>`;
  }else{
    html+=`<div style="text-align:center;margin-bottom:4px"><span style="color:#8b949e;font-size:9px">💡 击败Boss有几率掉落专属神话装备，凑齐4件不同Boss激活圆弧护盾</span></div>`;
  }
  if(legendaryEquipped>=2){
    const sets=[];if(legendaryEquipped>=2)sets.push('2件伤害+20%');if(legendaryEquipped>=3)sets.push('3件射速+30%');if(legendaryEquipped>=4)sets.push('4件回血');
    html+=`<div style="text-align:center;margin-bottom:4px"><span style="color:#ffd700;font-size:10px">✨ 传说 ${legendaryEquipped}/4 (${sets.join('|')})</span></div>`;
  }
  // ===== 合成选中条 =====
  if(selectedSynthUids.length>0){
    html+=`<div style="text-align:center;margin-bottom:4px;padding:4px;background:#1a1a2e;border:1px solid #ffd970;border-radius:4px">`;
    for(const uid of selectedSynthUids){
      const g=saveData.gearBag.find(x=>String(x.uid)===String(uid));
      if(g){const rc=GEAR_RARITIES[g.rarity].color;html+=`<span style="color:${rc};font-size:10px;margin:0 3px">${GEAR_SLOT_ICONS[g.slot]}${g.name}</span>`;}
    }
    html+=`<button class="sec-btn" id="clearSynth" style="margin-left:4px;font-size:9px;padding:1px 5px">清空</button></div>`;
  }
  html+=`<div style="text-align:center;margin-bottom:4px">`;
  html+=`<button class="main-btn" id="synthBtn" style="font-size:12px;padding:4px 16px" ${selectedSynthUids.length===3?'':'disabled'}>⚗️合成(${selectedSynthUids.length}/3)</button>`;
  if(selectedSynthUids.length===3){
    const gears=selectedSynthUids.map(uid=>saveData.gearBag.find(g=>String(g.uid)===String(uid)));
    const sameRarity=gears.every(g=>g&&g.rarity===gears[0].rarity);
    const isMythic=gears[0]&&gears[0].rarity==='mythic';
    if(!sameRarity)html+=` <span style="color:#f85149;font-size:10px">⚠需同品质</span>`;
    else if(isMythic)html+=` <span style="color:#f85149;font-size:10px">⚠神话不可合成</span>`;
    else html+=` <span style="color:#3fb950;font-size:10px">✓→${GEAR_RARITIES[GEAR_RARITY_ORDER[GEAR_RARITY_ORDER.indexOf(gears[0].rarity)+1]].name}</span>`;
  }
  html+=`</div>`;
  if(synthFilterRarity){
    const rc=GEAR_RARITIES[synthFilterRarity].color;
    const cnt=saveData.gearBag.filter(g=>g.rarity===synthFilterRarity).length;
    html+=`<div style="text-align:center;margin-bottom:4px;padding:3px;background:#161b22;border:1px solid ${rc};border-radius:4px"><span style="color:${rc};font-size:10px">筛选:${GEAR_RARITIES[synthFilterRarity].name}(${cnt}件)</span><button class="sec-btn" id="resetFilter" style="margin-left:4px;font-size:9px;padding:1px 5px">全部</button><button class="main-btn" id="oneClickSynth" style="margin-left:3px;font-size:10px;padding:2px 8px" ${cnt>=3?'':'disabled'}>一键合成(${Math.floor(cnt/3)}组)</button></div>`;
  }
  // ===== Tab页签：部位切换 =====
  html+=`<div style="display:flex;gap:4px;justify-content:center;margin-bottom:6px;flex-wrap:wrap">`;
  const tabs=[{slot:'',icon:'📋',name:'全部'},...GEAR_SLOTS.map(s=>({slot:s,icon:GEAR_SLOT_ICONS[s],name:GEAR_SLOT_NAMES[s]}))];
  for(const t of tabs){
    const active=(!gearFilterSlot&&t.slot==='')||(gearFilterSlot===t.slot);
    const cnt=t.slot?saveData.gearBag.filter(g=>g.slot===t.slot).length:saveData.gearBag.length;
    html+=`<button class="sec-btn" data-filter-slot="${t.slot}" style="font-size:11px;padding:4px 12px;${active?'border-color:#58a6ff;color:#58a6ff;background:rgba(88,166,255,0.1)':''}">${t.icon}${t.name}(${cnt})</button>`;
  }
  html+=`</div>`;
  // ===== 装备网格（翻页式，手机友好） =====
  let filteredGears=saveData.gearBag.slice();
  if(gearFilterSlot)filteredGears=filteredGears.filter(g=>g.slot===gearFilterSlot);
  if(gearFilterRarity)filteredGears=filteredGears.filter(g=>g.rarity===gearFilterRarity);
  if(synthFilterRarity)filteredGears=filteredGears.filter(g=>g.rarity===synthFilterRarity);
  // 按品质排序（高到低）
  filteredGears.sort((a,b)=>GEAR_RARITY_ORDER.indexOf(b.rarity)-GEAR_RARITY_ORDER.indexOf(a.rarity));
  // 翻页：每页8件
  const gst=getPagedState('gear',{page:1,pageSize:8});
  // 当筛选变化时重置页码（用一个标记检测）
  const _filterKey=`${gearFilterSlot||''}|${gearFilterRarity||''}|${synthFilterRarity||''}`;
  if(gst._lastFilter!==_filterKey){gst.page=1; gst._lastFilter=_filterKey;}
  pagedSetTotal('gear', filteredGears.length);
  const pageSize=gst.pageSize;
  const totalPages=Math.max(1,Math.ceil(filteredGears.length/pageSize));
  if(gst.page>totalPages)gst.page=1;
  const start=(gst.page-1)*pageSize;
  const end=Math.min(start+pageSize, filteredGears.length);
  // 顶部：一键合成（按品质分组）
  if(!synthFilterRarity&&!gearFilterRarity&&filteredGears.length>0){
    const rarityGroups={};
    for(const g of filteredGears){if(!rarityGroups[g.rarity])rarityGroups[g.rarity]=[];rarityGroups[g.rarity].push(g);}
    for(const rar of GEAR_RARITY_ORDER){
      const grp=rarityGroups[rar];
      if(!grp||grp.length<3||rar==='mythic')continue;
      const rc=GEAR_RARITIES[rar].color;
      html+=`<div style="text-align:center;margin-bottom:4px"><button class="sec-btn" data-oneslot-synth="${rar}" style="font-size:10px;padding:2px 8px;color:${rc};border-color:${rc}">⚡一键合成${GEAR_RARITIES[rar].name}(${Math.floor(grp.length/3)}组)</button></div>`;
    }
  }
  html+=pagedNavHTML('gear', filteredGears.length, pageSize, gst.page);
  html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;max-width:680px;margin:0 auto 10px">`;
  if(filteredGears.length===0){
    html+=`<div style="grid-column:1/-1;color:#8b949e;text-align:center;padding:20px">${saveData.gearBag.length===0?'背包空空如也，击败Boss获取装备！':'无符合条件的装备'}</div>`;
  }else{
    for(let i=start;i<end;i++){
      const g=filteredGears[i];
      const rc=GEAR_RARITIES[g.rarity].color;
      const selected=selectedSynthUids.some(u=>String(u)===String(g.uid));
      const canSynth=g.rarity!=='mythic';
      // Boss装备角标
      const _bossIcon=(g.bossIdx!==undefined && g.bossIdx!==null && BOSS_TYPES[g.bossIdx])?BOSS_TYPES[g.bossIdx].icon:'';
      const _isBossMythic=g.rarity==='mythic' && g.bossIdx!==undefined && g.bossIdx!==null;
      const _bossName=(_bossIcon && BOSS_TYPES[g.bossIdx])?BOSS_TYPES[g.bossIdx].name:'';
      html+=`<div style="background:#161b22;border:1px solid ${selected?'#ffd970':rc};border-left:3px solid ${rc};border-radius:5px;padding:6px;cursor:pointer;position:relative" data-equip="${g.uid}">
        ${_bossIcon?`<div style="position:absolute;top:2px;right:4px;font-size:14px;${_isBossMythic?'filter:drop-shadow(0 0 3px #ffd700)':''}" title="${_bossName}装备">${_bossIcon}</div>`:''}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:${rc};font-weight:bold;font-size:11px">${GEAR_SLOT_ICONS[g.slot]} ${g.name}${selected?' <span style="color:#ffd970">✓</span>':''}</span>
          <span style="color:#8b949e;font-size:9px">${GEAR_RARITIES[g.rarity].name}</span>
        </div>
        <div style="margin-top:3px">${(g.stats||[]).map(s=>_renderStatBar(s)).join('')}</div>
        ${g.specialAffix?`<div style="font-size:9px;color:${g.rarity==='mythic'?'#ff4444':'#ffd700'};margin-top:3px;padding:2px 4px;background:${g.rarity==='mythic'?'rgba(255,68,68,0.1)':'rgba(255,215,0,0.1)'};border-radius:3px;${_isBossMythic?'border:1px solid #ffd700;':''}">${g.specialAffix.icon} ${g.specialAffix.name}${_isBossMythic?' 👑':''}</div>`:''}
        ${_renderGearCompare(g)}
        <div style="display:flex;gap:2px;margin-top:3px;flex-wrap:wrap">
          <span style="font-size:8px;color:#58a6ff;flex:1">${selected?'取消':'装备'}</span>
          ${canSynth?`<button data-synth-btn="1" data-rar="${g.rarity}" class="sec-btn" style="font-size:8px;padding:1px 4px">${selected?'取消':'合成'}</button>`:''}
          ${g.rarity!=='mythic'?`<button data-ascend="${g.uid}" class="sec-btn" style="font-size:8px;padding:1px 4px;color:#bc8cff;border-color:#bc8cff" title="消耗${GEAR_ASCEND_COST[g.rarity].essence}精魄+${GEAR_ASCEND_COST[g.rarity].score}积分升阶">⬆升阶</button>`:''}
          <button data-decompose="${g.uid}" class="sec-btn" style="font-size:8px;padding:1px 4px;color:#f85149;border-color:#f85149" title="分解获得${GEAR_ESSENCE_REWARDS[g.rarity]}精魄+${GEAR_DECOMPOSE_REWARDS[g.rarity]}积分">分+${GEAR_DECOMPOSE_REWARDS[g.rarity]}💠${GEAR_ESSENCE_REWARDS[g.rarity]}</button>
        </div>
      </div>`;
    }
  }
  html+=`</div>`;
  // ===== 品质筛选 + 一键分解（紧凑横排） =====
  html+=`<div style="max-width:680px;margin:4px auto;display:flex;gap:3px;flex-wrap:wrap;justify-content:center;align-items:center">`;
  html+=`<span style="color:#8b949e;font-size:9px">品质:</span>`;
  html+=`<button class="sec-btn" data-filter-rarity="" style="font-size:9px;padding:1px 5px;${!gearFilterRarity?'border-color:#58a6ff;color:#58a6ff':''}">全部</button>`;
  for(const rar of GEAR_RARITY_ORDER){
    const rc=GEAR_RARITIES[rar].color;
    html+=`<button class="sec-btn" data-filter-rarity="${rar}" style="font-size:9px;padding:1px 5px;${gearFilterRarity===rar?`border-color:${rc};color:${rc}`:''}">${GEAR_RARITIES[rar].name}</button>`;
  }
  const decomposable=saveData.gearBag.filter(g=>['common','rare'].includes(g.rarity));
  if(decomposable.length>0){
    const totalReward=decomposable.reduce((s,g)=>s+GEAR_DECOMPOSE_REWARDS[g.rarity],0);
    const totalEssence=decomposable.reduce((s,g)=>s+(GEAR_ESSENCE_REWARDS[g.rarity]||0),0);
    html+=`<button class="sec-btn" id="oneClickDecompose" style="font-size:9px;padding:1px 5px;color:#f85149;border-color:#f85149">🔥分解${decomposable.length}件+${totalReward}分+${totalEssence}💠</button>`;
  }
  html+=`</div>`;
  // ===== 词条重铸（紧凑横排，可折叠） =====
  const rerollable=saveData.gearBag.filter(g=>g.specialAffix && !g.specialAffix.bossAffix);
  if(rerollable.length>0){
    html+=`<details style="max-width:680px;margin:4px auto 0"><summary style="color:#bc8cff;font-size:11px;cursor:pointer">🔮 词条重铸 · ${rerollable.length}件可重铸（随机300分或10精魄 / 定向${GEAR_REFORGE_COST.direct_legendary.essence}+${GEAR_REFORGE_COST.direct_legendary.score}分传说 / ${GEAR_REFORGE_COST.direct_mythic.essence}+${GEAR_REFORGE_COST.direct_mythic.score}分神话）</summary>`;
    html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px;margin-top:4px">`;
    for(const g of rerollable){
      const rc=GEAR_RARITIES[g.rarity].color;
      html+=`<div style="background:#161b22;border-left:2px solid ${rc};padding:4px;border-radius:3px;font-size:9px">
        <span style="color:${rc};font-weight:bold">${GEAR_SLOT_ICONS[g.slot]}${g.name}</span><br>
        <span style="color:${rc}">${g.specialAffix.icon}${g.specialAffix.name}</span>
        <button class="sec-btn" data-reroll="${g.uid}" style="float:right;font-size:8px;padding:1px 4px;color:#bc8cff;border-color:#bc8cff;margin-left:3px">随机</button>
        <button class="sec-btn" data-direct-reforge="${g.uid}" style="float:right;font-size:8px;padding:1px 4px;color:#ffd700;border-color:#ffd700">定向</button>
      </div>`;
    }
    html+=`</div></details>`;
  }
  html+=`<div class="panel-actions"><button class="sec-btn" id="backFromGear">返回</button></div>`;
  ov.innerHTML=html;
  ov.querySelectorAll('[data-unequip]').forEach(el=>{
    _bindTap(el,()=>{
      const slot=el.dataset.unequip;
      if(saveData.equippedGear[slot]){saveData.gearBag.push(saveData.equippedGear[slot]);saveData.equippedGear[slot]=null;saveSave();showGearMenu();}
    });
  });
  ov.querySelectorAll('[data-equip]').forEach(el=>{
    _bindTap(el,()=>{
      const uid=el.dataset.equip; // 保持字符串，避免浮点数精度问题
      const sidx=selectedSynthUids.findIndex(u=>String(u)===String(uid));
      if(sidx>=0){
        selectedSynthUids.splice(sidx,1);
        if(selectedSynthUids.length===0)synthFilterRarity=null;
        showGearMenu();
      }else{
        const idx=saveData.gearBag.findIndex(g=>String(g.uid)===String(uid));
        if(idx>=0){
          const g=saveData.gearBag.splice(idx,1)[0];
          if(saveData.equippedGear[g.slot])saveData.gearBag.push(saveData.equippedGear[g.slot]);
          saveData.equippedGear[g.slot]=g; saveSave();
        }
        showGearMenu();
      }
    });
    const synthBtn2=el.querySelector('[data-synth-btn]');
    if(synthBtn2)_bindTap(synthBtn2,e=>{
      e.stopPropagation();
      const uid=el.dataset.equip;
      const g=saveData.gearBag.find(x=>String(x.uid)===String(uid));
      if(!g)return;
      const sidx=selectedSynthUids.findIndex(u=>String(u)===String(uid));
      if(sidx>=0){
        selectedSynthUids.splice(sidx,1);
        if(selectedSynthUids.length===0)synthFilterRarity=null;
      }else{
        // 设置筛选阶级为该装备阶级，只允许同阶级
        synthFilterRarity=g.rarity;
        // 清空之前不同阶级的选中（注意uid可能是number或string，统一用String比较）
        selectedSynthUids=selectedSynthUids.filter(u=>{
          const gg=saveData.gearBag.find(x=>String(x.uid)===String(u));
          return gg&&gg.rarity===synthFilterRarity;
        });
        if(selectedSynthUids.length<3)selectedSynthUids.push(uid);
      }
      showGearMenu();
    });
  });
  // 单部位一键合成
  ov.querySelectorAll('[data-oneslot-synth]').forEach(btn=>{
    _bindTap(btn,()=>{
      const rar=btn.dataset.oneslotSynth;
      const slot=btn.dataset.slot;
      oneClickSynthesize(rar,slot);
    });
  });
  // 全局一键合成（所有部位同阶级）
  const oneClickBtn=document.getElementById('oneClickSynth');
  if(oneClickBtn)_bindTap(oneClickBtn,()=>{
    oneClickSynthesize(synthFilterRarity,null);
  });
  const synthBtn=document.getElementById('synthBtn');
  if(synthBtn)_bindTap(synthBtn,()=>{
    if(selectedSynthUids.length!==3)return;
    const result=synthesizeGears([...selectedSynthUids]);
    selectedSynthUids=[];
    synthFilterRarity=null;
    gearFilterSlot=null;
    gearFilterRarity=null;
    showGearMenu();
    setTimeout(()=>showSynthResult(result),50);
  });
  const clearBtn=document.getElementById('clearSynth');
  if(clearBtn)_bindTap(clearBtn,()=>{selectedSynthUids=[];synthFilterRarity=null;showGearMenu();});
  const resetFilterBtn=document.getElementById('resetFilter');
  if(resetFilterBtn)_bindTap(resetFilterBtn,()=>{synthFilterRarity=null;showGearMenu();});
  // 词条重铸：随机（支持积分或精魄支付）
  ov.querySelectorAll('[data-reroll]').forEach(btn=>{
    _bindTap(btn,()=>{
      const uid=btn.dataset.reroll; // 字符串比较，避免浮点数精度问题
      const g=saveData.gearBag.find(x=>String(x.uid)===String(uid));
      if(!g||!g.specialAffix)return;
      // 优先用精魄（10精魄），其次用积分（300积分）
      const canEssence=(saveData.gearEssence||0)>=GEAR_REFORGE_COST.random_essence;
      const canScore=(saveData.totalScore||0)>=GEAR_REFORGE_COST.random_score;
      if(!canEssence && !canScore){
        showSynthResult({success:false,msg:`积分不足（需${GEAR_REFORGE_COST.random_score}分）或精魄不足（需${GEAR_REFORGE_COST.random_essence}精魄）`});
        return;
      }
      // 优先用精魄（更便宜，让低分玩家有出路）
      if(canEssence){
        saveData.gearEssence-=GEAR_REFORGE_COST.random_essence;
      }else{
        saveData.totalScore-=GEAR_REFORGE_COST.random_score;
      }
      const pool=g.rarity==='mythic'?GEAR_MYTHIC_AFFIXES:GEAR_LEGENDARY_AFFIXES;
      // 排除当前词条
      const candidates=pool.filter(a=>a.id!==g.specialAffix.id);
      const newAff=candidates[randInt(0,candidates.length-1)];
      const oldName=g.specialAffix.name;
      g.specialAffix={id:newAff.id,name:newAff.name,icon:newAff.icon,desc:newAff.desc,special:true};
      saveSave();
      showGearMenu();
      setTimeout(()=>showSynthResult({success:true,msg:`随机重铸成功！${oldName} → ${newAff.icon} ${newAff.name}\n${newAff.desc}`}),50);
    });
  });
  // 词条定向重铸：弹出词条选择面板
  ov.querySelectorAll('[data-direct-reforge]').forEach(btn=>{
    _bindTap(btn,()=>{
      const uid=btn.dataset.directReforge;
      const g=saveData.gearBag.find(x=>String(x.uid)===String(uid));
      if(!g||!g.specialAffix)return;
      if(g.specialAffix.bossAffix){showSynthResult({success:false,msg:'Boss专属神话词条不可重铸'});return;}
      const isMythic=g.rarity==='mythic';
      const cost=isMythic?GEAR_REFORGE_COST.direct_mythic:GEAR_REFORGE_COST.direct_legendary;
      const pool=isMythic?GEAR_MYTHIC_AFFIXES:GEAR_LEGENDARY_AFFIXES;
      // 弹出词条选择面板
      let rh=`<div style="color:#ffd700;font-size:13px;margin-bottom:8px;font-weight:bold">🔮 定向重铸 - ${g.name}</div>`;
      rh+=`<div style="color:#8b949e;font-size:11px;margin-bottom:8px">当前：${g.specialAffix.icon} ${g.specialAffix.name}<br>消耗：${cost.essence}精魄 + ${cost.score}积分</div>`;
      rh+=`<div style="color:#8b949e;font-size:11px;margin-bottom:6px">选择目标词条：</div>`;
      rh+=`<div style="display:grid;grid-template-columns:1fr;gap:4px;max-height:50vh;overflow-y:auto">`;
      for(const aff of pool){
        if(aff.id===g.specialAffix.id)continue;
        rh+=`<button class="sec-btn" data-pick-affix="${aff.id}" style="font-size:11px;padding:6px 10px;text-align:left;color:${isMythic?'#ff4444':'#ffd700'};border-color:${isMythic?'#ff4444':'#ffd700'}">${aff.icon} <b>${aff.name}</b><br><span style="color:#8b949e;font-size:10px">${aff.desc}</span></button>`;
      }
      rh+=`</div>`;
      rh+=`<div style="text-align:center;margin-top:8px"><button class="sec-btn" id="cancelDirectReforge">取消</button></div>`;
      // 使用专用模态弹窗（z-index:100），避免被 #gearOverlay(z-index:30) 遮挡
      const modal=_showGearModal(`<div style="max-width:500px;width:100%;margin:auto;padding:16px;background:#161b22;border:1px solid #ffd700;border-radius:8px">${rh}</div>`);
      modal.querySelectorAll('[data-pick-affix]').forEach(b=>{
        _bindTap(b,()=>{
          const targetId=b.dataset.pickAffix;
          const result=directReforge(uid, targetId);
          _hideGearModal();
          showGearMenu();
          setTimeout(()=>showSynthResult(result),50);
        });
      });
      _bindTap(document.getElementById('cancelDirectReforge'),()=>{
        _hideGearModal();
      });
    });
  });
  // 装备升阶
  ov.querySelectorAll('[data-ascend]').forEach(btn=>{
    _bindTap(btn,e=>{
      e.stopPropagation();
      const uid=btn.dataset.ascend;
      const g=saveData.gearBag.find(x=>String(x.uid)===String(uid));
      if(!g)return;
      const cost=GEAR_ASCEND_COST[g.rarity];
      if(!cost)return;
      // 二次确认（消耗较大）：使用专用模态弹窗（z-index:100），避免被 #gearOverlay(z-index:30) 遮挡
      const newRarity=GEAR_RARITY_ORDER[GEAR_RARITY_ORDER.indexOf(g.rarity)+1];
      const newRarityDef=GEAR_RARITIES[newRarity];
      const modal=_showGearModal(`<div style="max-width:440px;width:100%;padding:16px;background:#161b22;border:1px solid #bc8cff;border-radius:8px;text-align:center">
        <div style="color:#bc8cff;font-size:14px;font-weight:bold;margin-bottom:8px">⬆ 装备升阶确认</div>
        <div style="color:#c9d1d9;font-size:12px;margin-bottom:8px">${GEAR_SLOT_ICONS[g.slot]} ${g.name} (${GEAR_RARITIES[g.rarity].name})</div>
        <div style="color:#8b949e;font-size:11px;margin-bottom:6px">→ 升阶为 <span style="color:${newRarityDef.color};font-weight:bold">${newRarityDef.name}</span> 品质</div>
        <div style="color:#f0883e;font-size:11px;margin-bottom:8px;padding:6px;background:rgba(255,136,62,0.08);border-radius:4px">⚠ 升阶会重新生成词条数值与专属词条<br>Boss传说装备升阶为神话后变为普通神话（失去Boss标记）</div>
        <div style="color:#ffd700;font-size:12px;margin-bottom:10px">消耗：${cost.essence}💠精魄 + ${cost.score}积分</div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button class="main-btn" id="confirmAscend" style="background:linear-gradient(135deg,#bc8cff,#58a6ff);font-size:13px;padding:8px 18px">确认升阶</button>
          <button class="sec-btn" id="cancelAscend" style="font-size:13px;padding:8px 18px">取消</button>
        </div>
      </div>`);
      _bindTap(document.getElementById('confirmAscend'),()=>{
        const result=ascendGear(uid);
        _hideGearModal();
        showGearMenu();
        setTimeout(()=>showSynthResult(result),50);
      });
      _bindTap(document.getElementById('cancelAscend'),()=>{_hideGearModal();});
    });
  });
  // 装备图鉴：部位筛选
  ov.querySelectorAll('[data-filter-slot]').forEach(btn=>{
    _bindTap(btn,()=>{
      gearFilterSlot=btn.dataset.filterSlot||null;
      showGearMenu();
    });
  });
  // 装备图鉴：稀有度筛选
  ov.querySelectorAll('[data-filter-rarity]').forEach(btn=>{
    _bindTap(btn,()=>{
      gearFilterRarity=btn.dataset.filterRarity||null;
      showGearMenu();
    });
  });
  // 一键分解低品质装备
  const oneClickDecompBtn=document.getElementById('oneClickDecompose');
  if(oneClickDecompBtn){
    _bindTap(oneClickDecompBtn,()=>{
      const decomposeRarities=['common','rare'];
      const decomposable=saveData.gearBag.filter(g=>decomposeRarities.includes(g.rarity));
      if(decomposable.length===0){flashMsg('没有可分解的装备');return;}
      const totalReward=decomposable.reduce((s,g)=>s+GEAR_DECOMPOSE_REWARDS[g.rarity],0);
      const totalEssence=decomposable.reduce((s,g)=>s+(GEAR_ESSENCE_REWARDS[g.rarity]||0),0);
      const uids=new Set(decomposable.map(g=>g.uid));
      saveData.gearBag=saveData.gearBag.filter(g=>!uids.has(g.uid));
      saveData.totalScore+=totalReward;
      saveData.gearEssence=(saveData.gearEssence||0)+totalEssence;
      saveSave();
      flashMsg(`🔥 已分解 ${decomposable.length}件装备，+${totalReward}积分 +${totalEssence}精魄`);
      showGearMenu();
    });
  }
  // 单件装备分解
  ov.querySelectorAll('[data-decompose]').forEach(btn=>{
    _bindTap(btn,e=>{
      e.stopPropagation();
      const uid=btn.dataset.decompose; // 字符串比较
      const idx=saveData.gearBag.findIndex(g=>String(g.uid)===String(uid));
      if(idx<0)return;
      const g=saveData.gearBag[idx];
      const reward=GEAR_DECOMPOSE_REWARDS[g.rarity]||30;
      const essence=GEAR_ESSENCE_REWARDS[g.rarity]||0;
      saveData.gearBag.splice(idx,1);
      saveData.totalScore+=reward;
      saveData.gearEssence=(saveData.gearEssence||0)+essence;
      // 同步清除合成选中
      const sidx=selectedSynthUids.findIndex(u=>String(u)===String(uid));
      if(sidx>=0)selectedSynthUids.splice(sidx,1);
      if(selectedSynthUids.length===0)synthFilterRarity=null;
      saveSave();
      flashMsg(`分解 ${g.name} +${reward}积分 +${essence}精魄`);
      showGearMenu();
    });
  });
  // 翻页按钮绑定
  bindPagedNav(ov, showGearMenu);
  _bindTap(document.getElementById('backFromGear'),()=>{selectedSynthUids=[];synthFilterRarity=null;gearFilterSlot=null;gearFilterRarity=null;ov.classList.add('hidden');showBagMenu();});
}
// 一键合成：批量合成指定阶级（可指定部位）的所有装备，每组3件
function oneClickSynthesize(rarity,slotFilter){
  let pool=saveData.gearBag.filter(g=>g.rarity===rarity&&rarity!=='mythic');
  if(slotFilter)pool=pool.filter(g=>g.slot===slotFilter);
  if(pool.length<3){showSynthResult({success:false,msg:'不足3件，无法合成'});return;}
  const groups=Math.floor(pool.length/3);
  let successCount=0,failCount=0;
  const newGears=[];
  for(let i=0;i<groups;i++){
    const uids=pool.slice(i*3,i*3+3).map(g=>g.uid);
    const result=synthesizeGears(uids);
    if(result.success){successCount++;if(result.gear)newGears.push(result.gear);}
    else failCount++;
  }
  let msg=`一键合成完成！共${groups}组：成功${successCount}次，失败${failCount}次`;
  if(newGears.length>0){
    const rarities={};
    for(const g of newGears){rarities[g.rarity]=(rarities[g.rarity]||0)+1;}
    msg+='\\n获得: '+Object.entries(rarities).map(([r,c])=>`${GEAR_RARITIES[r].name}x${c}`).join(', ');
  }
  selectedSynthUids=[];
  synthFilterRarity=null;
  gearFilterSlot=null;
  gearFilterRarity=null;
  showGearMenu();
  setTimeout(()=>showSynthResult({success:successCount>0,msg}),50);
}
function showSynthResult(result){
  const ov=document.getElementById('gearOverlay');
  let existing=ov.querySelector('#synthResultBanner');
  if(existing)existing.remove();
  const banner=document.createElement('div');
  banner.id='synthResultBanner';
  banner.style.cssText='position:sticky;top:0;background:#161b22;border:1px solid '+(result.success?'#3fb950':'#f85149')+';border-radius:6px;padding:10px;margin:8px 0;z-index:10;white-space:pre-line;text-align:center;color:'+(result.success?'#3fb950':'#f85149');
  banner.textContent=result.msg;
  const closeBtn=document.createElement('button');
  closeBtn.className='sec-btn';closeBtn.textContent='关闭';closeBtn.style.marginTop='6px';
  _bindTap(closeBtn,()=>banner.remove());
  banner.appendChild(closeBtn);
  ov.insertBefore(banner,ov.firstChild);
}

// ==================== 羁绊菜单 ====================
function showBondMenu(){
  const ov=document.getElementById('bondOverlay'); ov.classList.remove('hidden');
  let html=`<h2>🔗 羁绊系统</h2><p class="subtitle">通过收集Boss宝宝激活羁绊 | 羁绊效果在每局游戏开始时自动生效</p>`;
  // 羁绊说明
  html+=`<div style="max-width:680px;margin:0 auto 12px;padding:8px;border:1px solid #30363d;border-radius:6px;font-size:11px;color:#8b949e;text-align:left">
    <div style="color:#c9d1d9;margin-bottom:4px">💡 <b>羁绊机制</b></div>
    <div>· 羁绊根据你<b>当前拥有的Boss宝宝数量和种类</b>自动激活</div>
    <div>· 多个羁绊可同时生效，效果叠加</div>
    <div>· Boss宝宝通过击败Boss(30%几率)或牧场孵蛋获得</div>
    <div>· 超级Boss宝宝(烛龙/饕餮)可激活更强的羁绊</div>
  </div>`;
  const active=getActiveBonds();
  html+=`<div class="section-title">已激活羁绊 (${active.length}/${BONDS.length})</div>`;
  if(active.length>0){
    html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;max-width:700px;margin:0 auto 16px">`;
    for(const b of active){
      html+=`<div style="background:rgba(63,185,80,0.1);border:2px solid #3fb950;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:32px">${b.icon}</div>
        <div style="font-size:14px;font-weight:bold;color:#3fb950;margin-top:4px">${b.name}</div>
        <div style="font-size:11px;color:#8b949e;margin:4px 0">${b.desc}</div>
        <div style="font-size:12px;color:#ffd700;padding:4px 8px;background:rgba(255,215,0,0.1);border-radius:4px">⚡ ${b.effect.name}</div>
      </div>`;
    }
    html+=`</div>`;
  }else{
    html+=`<p style="color:#8b949e;text-align:center;padding:20px">尚未激活任何羁绊，继续收集Boss宝宝！</p>`;
  }
  html+=`<div class="section-title">全部羁绊</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;max-width:700px;margin:0 auto 16px">`;
  for(const b of BONDS){
    const isA=active.includes(b);
    html+=`<div style="background:#161b22;border:2px solid ${isA?'#3fb950':'#30363d'};border-radius:10px;padding:14px;text-align:center;${isA?'':'opacity:0.6'}">
      <div style="font-size:28px">${b.icon}</div>
      <div style="font-size:14px;font-weight:bold;margin-top:4px;color:${isA?'#3fb950':'#c9d1d9'}">${b.name} ${isA?'✓':'🔒'}</div>
      <div style="font-size:11px;color:#8b949e;margin:4px 0">${b.desc}</div>
      <div style="font-size:12px;color:#ffd700">${b.effect.name}</div>
    </div>`;
  }
  html+=`</div><div class="panel-actions"><button class="sec-btn" id="backFromBond">返回</button></div>`;
  ov.innerHTML=html;
  _bindTap(document.getElementById('backFromBond'),()=>{ov.classList.add('hidden');showMainMenu();});
}

// ==================== Boss图鉴与成就菜单 ====================
function showPediaMenu(initialTab){
  const ov=document.getElementById('pediaOverlay'); ov.classList.remove('hidden');
  loadAllBossImages(); // 图鉴需要展示所有Boss，预加载全部图片
  const st=getPagedState('pedia',{page:1,pageSize:6,tab:initialTab||'boss'});
  pagedSetTotal('pedia', st.tab==='boss'?BOSS_TYPES.length:(st.tab==='ach'?ACHIEVEMENTS.length:1));
  let html=`<h2>📖 山海图鉴</h2><p class="subtitle">已发现Boss与成就记录 | 解锁成就自动获得积分奖励</p>`;
  // 标签切换
  const _ownedBossMythics = typeof getOwnedBossMythics==='function' ? getOwnedBossMythics() : new Set();
  const _ownedWeaponCount = Object.keys(saveData.ownedWeapons||{}).length;
  const _totalWeaponCount = typeof WEAPONS!=='undefined' ? Object.keys(WEAPONS).length : 9;
  const _enemyKills = saveData.achievementFlags?.totalKills || 0;
  const _ownedPages = Array.isArray(saveData.shanhaiPages) ? saveData.shanhaiPages.length : 0;
  html+=`<div class="paged-tabs">
    <button class="pg-btn" data-pedia-tab="boss" ${st.tab==='boss'?'style="border-color:#58a6ff;color:#58a6ff;background:rgba(88,166,255,0.15)"':''}>🐉 Boss (${Object.keys(saveData.bossPedia).length}/${BOSS_TYPES.length})</button>
    <button class="pg-btn" data-pedia-tab="gear" ${st.tab==='gear'?'style="border-color:#ffd700;color:#ffd700;background:rgba(255,215,0,0.15)"':''}>🎽 装备 (${_ownedBossMythics.size}/10)</button>
    <button class="pg-btn" data-pedia-tab="weapon" ${st.tab==='weapon'?'style="border-color:#ff6347;color:#ff6347;background:rgba(255,99,71,0.15)"':''}>🔫 武器 (${_ownedWeaponCount}/${_totalWeaponCount})</button>
    <button class="pg-btn" data-pedia-tab="enemy" ${st.tab==='enemy'?'style="border-color:#bc8cff;color:#bc8cff;background:rgba(188,140,255,0.15)"':''}>👾 敌人</button>
    <button class="pg-btn" data-pedia-tab="page" ${st.tab==='page'?'style="border-color:#daa520;color:#daa520;background:rgba(218,165,32,0.15)"':''}>📜 残页 (${_ownedPages}/10)</button>
    <button class="pg-btn" data-pedia-tab="ach" ${st.tab==='ach'?'style="border-color:#ffd700;color:#ffd700;background:rgba(255,215,0,0.15)"':''}>🏆 成就 (${Object.keys(saveData.achievements).length}/${ACHIEVEMENTS.length})</button>
    <button class="pg-btn" data-pedia-tab="guide" ${st.tab==='guide'?'style="border-color:#3fb950;color:#3fb950;background:rgba(63,185,80,0.15)"':''}>📖 指南</button>
  </div>`;
  if(st.tab==='guide'){
    html+=`<div style="max-width:680px;margin:0 auto;padding:12px 16px;background:rgba(22,27,34,0.7);border:1px solid rgba(212,160,23,0.3);border-radius:10px;font-size:12px;color:#b0a090;line-height:1.8;text-align:left">
      <div style="color:#f0883e;margin-bottom:6px">⚡ <b>核心</b>：WASD移动，鼠标瞄准射击。每关30秒（Boss关50秒），时间到自动进下一关。</div>
      <div style="color:#8b0000;margin-bottom:6px">⚔️ <b>最终Boss·刑天</b>：击败超级Boss后50%几率触发，掉落山海故事书与「刑天干戚」。</div>
      <div style="color:#bc8cff;margin-bottom:6px">🌟 <b>天赋</b>：升级获得天赋点，强化伤害/射速/生命等。</div>
      <div style="color:#bc8cff;margin-bottom:6px">🎒 <b>背包</b>：管理武器/宠物/装备/打造/抽奖。</div>
      <div style="color:#a855f7;margin-bottom:6px">🔮 <b>魂器</b>：击败超级Boss掉落，释放技能时附带魂器技。</div>
      <div style="color:#3fb950;margin-bottom:6px">🔫 <b>武器</b>：手枪→神臂弓→散弹→狙击→震天锤→连弩→雷神炮→虚空之弓，3阶段满阶。</div>
      <div style="color:#ffd700;margin-bottom:6px">🐉 <b>宠物</b>：抽奖或击败Boss获得，9种Boss宝宝进化3阶段。</div>
      <div style="color:#ffd700;margin-bottom:6px">🎽 <b>装备</b>：5稀有度，3件合成，4神话激活套装。</div>
      <div style="color:#daa520;margin-bottom:6px">🔗 <b>羁绊</b>：收集Boss宝宝激活被动加成。🎰 <b>抽奖</b>：800积分/次。</div>
      <div style="color:#ff6347;margin-bottom:6px">🔥 <b>半血机制</b>：Boss半血触发独有特殊机制。💥 <b>连击</b>：5连击+5%分数/击。</div>
      <div style="color:#bc8cff;margin-bottom:6px">📊 <b>4大难度</b>：普通→困难→地狱→弑神，需通关前一难度Boss试炼解锁。</div>
      <div style="color:#8b949e;margin-top:8px;text-align:center;font-size:11px;letter-spacing:3px">✦ Edeka 制作 ✦</div>
    </div>`;
  }
  // ===== 装备图鉴：展示10件Boss红装收集情况 =====
  if(st.tab==='gear'){
    html+=`<div style="max-width:680px;margin:0 auto;padding:10px;background:rgba(22,27,34,0.7);border:1px solid rgba(212,160,23,0.3);border-radius:10px">
      <div style="text-align:center;color:#ffd700;font-size:13px;margin-bottom:8px">🎽 Boss专属神话装备收集 ${_ownedBossMythics.size}/10</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">`;
    for(let i=0;i<10;i++){
      const b=BOSS_TYPES[i];
      const def=BOSS_GEAR_TABLE[i];
      const owned=_ownedBossMythics.has(i);
      const slotName=GEAR_SLOT_NAMES[def.slot];
      const slotIcon=GEAR_SLOT_ICONS[def.slot];
      html+=`<div style="background:${owned?'rgba(255,215,0,0.08)':'rgba(13,17,23,0.7)'};border:1px solid ${owned?'#ffd700':'#30363d'};border-radius:6px;padding:8px;text-align:center;${owned?'':'opacity:0.6'}">
        <div style="font-size:24px">${owned?b.icon:'❓'}</div>
        <div style="font-size:11px;font-weight:bold;color:${owned?'#ffd700':'#8b949e'};margin-top:3px">${owned?def.mythicName:'未发现'}</div>
        <div style="font-size:9px;color:#8b949e;margin:2px 0">${slotIcon} ${slotName} · ${b.name}</div>
        ${owned?`<div style="font-size:9px;color:#bc8cff;padding:2px 4px;background:rgba(188,140,255,0.1);border-radius:3px;margin-top:2px">${def.affix.icon} ${def.affix.name}</div>
        <div style="font-size:9px;color:#8b949e;margin-top:3px;line-height:1.4">${def.affix.desc}</div>`:'<div style="font-size:9px;color:#8b949e;margin-top:4px">击败此Boss有几率掉落</div>'}
      </div>`;
    }
    html+=`</div>`;
    // 4件套提示
    if(_ownedBossMythics.size>=4){
      html+=`<div style="text-align:center;margin-top:10px;padding:8px;background:linear-gradient(90deg,#3a2a0a,#5a4015,#3a2a0a);border:1px solid #ffd700;border-radius:6px">
        <span style="color:#ffd700;font-size:13px;font-weight:bold">✨ Boss神话套装已激活！</span><br>
        <span style="color:#ffe080;font-size:11px">技能键释放召唤圆弧护盾（120°金色光环挡弹幕，持续4秒）</span>
      </div>`;
    }else{
      html+=`<div style="text-align:center;margin-top:10px;padding:6px;background:rgba(13,17,23,0.7);border-radius:6px">
        <span style="color:#8b949e;font-size:11px">💡 凑齐4件不同Boss的神话装备激活圆弧护盾（当前 ${_ownedBossMythics.size}/4）</span>
      </div>`;
    }
    html+=`</div>`;
  }
  // ===== 武器图鉴：展示所有武器+解锁条件 =====
  if(st.tab==='weapon'){
    html+=`<div style="max-width:680px;margin:0 auto;padding:10px;background:rgba(22,27,34,0.7);border:1px solid rgba(255,99,71,0.3);border-radius:10px">
      <div style="text-align:center;color:#ff6347;font-size:13px;margin-bottom:8px">🔫 武器收集 ${_ownedWeaponCount}/${_totalWeaponCount}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">`;
    if(typeof WEAPONS!=='undefined'){
      for(const wid in WEAPONS){
        const w=WEAPONS[wid];
        const owned=!!saveData.ownedWeapons[wid];
        const stage=saveData.ownedWeapons[wid]||0;
        html+=`<div style="background:${owned?'rgba(255,99,71,0.08)':'rgba(13,17,23,0.7)'};border:1px solid ${owned?'#ff6347':'#30363d'};border-radius:6px;padding:8px;text-align:center;${owned?'':'opacity:0.6'}">
          <div style="font-size:24px">${owned?(w.icon||'🔫'):'🔒'}</div>
          <div style="font-size:12px;font-weight:bold;color:${owned?'#ff6347':'#8b949e'};margin-top:3px">${owned?w.name:'未解锁'}</div>
          <div style="font-size:9px;color:#8b949e;margin:2px 0">${w.desc||''}</div>
          ${owned?`<div style="font-size:10px;color:#ffd700;margin-top:3px">阶段 ${stage}/3</div>`:`<div style="font-size:9px;color:#8b949e;margin-top:3px">价格: ${w.price||'?'} 积分</div>`}
        </div>`;
      }
    }
    html+=`</div></div>`;
  }
  // ===== 敌人图鉴：展示小怪种类+击杀数 =====
  if(st.tab==='enemy'){
    const enemyTypes=[
      {type:'grunt',name:'小兵',icon:'👾',color:'#8b949e',desc:'最基础的敌人，移动慢伤害低'},
      {type:'runner',name:'冲锋怪',icon:'🏃',color:'#58a6ff',desc:'速度极快，血量低'},
      {type:'spiky',name:'尖刺怪',icon:'🔺',color:'#ff6347',desc:'近战伤害高，反弹子弹'},
      {type:'tank',name:'坦克怪',icon:'🛡️',color:'#3fb950',desc:'血量极高，速度慢'},
      {type:'shooter',name:'射手怪',icon:'🎯',color:'#bc8cff',desc:'远程射击玩家'},
      {type:'giant',name:'巨型怪',icon:'🗿',color:'#daa520',desc:'巨型精英，血厚伤害高'},
      {type:'invincible',name:'无敌怪',icon:'✨',color:'#d2a8ff',desc:'短暂无敌，需抓时机'},
      {type:'bomber',name:'自爆怪',icon:'💥',color:'#ff4500',desc:'靠近玩家自爆'},
      {type:'taunt',name:'嘲讽怪',icon:'😤',color:'#f0883e',desc:'吸引玩家攻击'},
      {type:'splitter',name:'裂变怪',icon:'🔀',color:'#a855f7',desc:'死后分裂成小怪（弑神难度）'}
    ];
    html+=`<div style="max-width:680px;margin:0 auto;padding:10px;background:rgba(22,27,34,0.7);border:1px solid rgba(188,140,255,0.3);border-radius:10px">
      <div style="text-align:center;color:#bc8cff;font-size:13px;margin-bottom:8px">👾 敌人图鉴 | 累计击杀 ${_enemyKills} 个</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">`;
    for(const e of enemyTypes){
      html+=`<div style="background:rgba(13,17,23,0.7);border:1px solid ${e.color}44;border-radius:6px;padding:8px;text-align:center">
        <div style="font-size:24px">${e.icon}</div>
        <div style="font-size:12px;font-weight:bold;color:${e.color};margin-top:3px">${e.name}</div>
        <div style="font-size:9px;color:#8b949e;margin-top:2px;line-height:1.4">${e.desc}</div>
      </div>`;
    }
    html+=`</div></div>`;
  }
  // ===== 山海残页：碎片化叙事展示 =====
  if(st.tab==='page'){
    const pages=Array.isArray(saveData.shanhaiPages) ? saveData.shanhaiPages : [];
    const allCollected = pages.length >= 10;
    html+=`<div style="max-width:680px;margin:0 auto;padding:10px;background:rgba(22,27,34,0.7);border:1px solid rgba(218,165,32,0.4);border-radius:10px">`;
    // 收集进度头
    html+=`<div style="text-align:center;margin-bottom:10px">
      <div style="color:#daa520;font-size:14px;font-weight:bold;text-shadow:0 0 8px rgba(218,165,32,0.4)">📜 山海残页 · ${pages.length}/10</div>
      <div style="color:#8b949e;font-size:11px;margin-top:4px">击败各Boss首杀即得残页，集齐10页可解锁山海图卷</div>
      <div style="margin:8px auto 0;width:80%;height:6px;background:#0d1117;border-radius:3px;overflow:hidden;border:1px solid #30363d">
        <div style="width:${pages.length*10}%;height:100%;background:linear-gradient(90deg,#daa520,#ffd700);transition:width 0.3s"></div>
      </div>
    </div>`;
    // 山海图卷完成奖励提示
    if(allCollected){
      html+=`<div style="background:linear-gradient(135deg,#3a2a0a,#5a4015,#3a2a0a);border:2px solid #ffd700;border-radius:8px;padding:12px;margin:10px 0;text-align:center;box-shadow:0 0 20px rgba(255,215,0,0.3)">
        <div style="color:#ffd700;font-size:15px;font-weight:bold;letter-spacing:2px">🗺️ 山海图卷 · 已开启</div>
        <div style="color:#ffe080;font-size:11px;margin-top:6px;line-height:1.6">十卷残页合一，山海异兽之谜尽收眼底。<br>你已成为真正的山海猎人，万物有灵，皆为你所知。</div>
        <div style="color:#daa520;font-size:11px;margin-top:6px">奖励：+5000 积分（已发放）</div>
      </div>`;
    }else{
      const remaining = 10 - pages.length;
      html+=`<div style="background:rgba(13,17,23,0.7);border:1px dashed #daa52055;border-radius:6px;padding:8px;margin:8px 0;text-align:center">
        <span style="color:#8b949e;font-size:11px">💡 还需 ${remaining} 页残页即可解锁山海图卷</span>
      </div>`;
    }
    // 残页列表（按Boss顺序）
    html+=`<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:8px">`;
    for(let i=0;i<10;i++){
      const page=SHANHAI_PAGES[i];
      const owned=pages.includes(i);
      const b=BOSS_TYPES[i];
      if(owned){
        html+=`<div style="background:linear-gradient(135deg,rgba(218,165,32,0.08),rgba(13,17,23,0.7));border:1px solid #daa520;border-radius:8px;padding:12px 14px;font-family:STKaiti,KaiTi,serif">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="font-size:20px">${b.icon}</div>
            <div style="flex:1">
              <div style="color:#ffd700;font-size:14px;font-weight:bold;letter-spacing:1px">${page.title}</div>
              <div style="color:#8b949e;font-size:10px">源自 · ${b.name}</div>
            </div>
            <div style="color:#3fb950;font-size:18px">✓</div>
          </div>
          <div style="color:#d4c5a0;font-size:12px;line-height:1.9;padding:6px 10px;background:rgba(212,197,160,0.06);border-left:2px solid #d4c5a0;border-radius:0 4px 4px 0;margin-bottom:6px">「${page.original}」</div>
          <div style="color:#b0a090;font-size:11px;line-height:1.7;padding:4px 10px;border-left:2px solid #8b949e">${page.interpretation}</div>
        </div>`;
      }else{
        html+=`<div style="background:rgba(13,17,23,0.7);border:1px solid #30363d;border-radius:8px;padding:12px 14px;opacity:0.5;font-family:STKaiti,KaiTi,serif">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="font-size:20px;filter:grayscale(1)">❓</div>
            <div style="flex:1">
              <div style="color:#8b949e;font-size:13px;letter-spacing:1px">??? 之卷</div>
              <div style="color:#6e7681;font-size:10px">未发现 · 击败 ${b.name} 后获得</div>
            </div>
            <div style="color:#6e7681;font-size:16px">🔒</div>
          </div>
        </div>`;
      }
    }
    html+=`</div></div>`;
  }
  if(st.tab==='boss'){
    // Boss图鉴分页 - 可点击展开详情（背景故事/弱点/技能）
    const pageSize=st.pageSize;
    const totalPages=Math.max(1,Math.ceil(BOSS_TYPES.length/pageSize));
    if(st.page>totalPages)st.page=1;
    const start=(st.page-1)*pageSize;
    const end=Math.min(start+pageSize, BOSS_TYPES.length);
    html+=pagedNavHTML('pedia', BOSS_TYPES.length, pageSize, st.page);
    // 检查是否有展开的Boss（通过_pediaExpand标记）
    if(st._expandIdx===undefined) st._expandIdx=-1;
    html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;max-width:700px;margin:0 auto 10px">`;
    for(let i=start;i<end;i++){
      const b=BOSS_TYPES[i], p=saveData.bossPedia[i];
      const isSuper=b.isSuper;
      const petDef=getPetDef(i);
      const imgPath=BOSS_IMG_PATHS[i];
      const imgHtml=(p&&imgPath)?`<img src="${imgPath}" style="width:100%;height:100%;object-fit:cover">`:(p?`<div style="font-size:40px;line-height:80px">${b.icon}</div>`:'<div style="font-size:40px;line-height:80px">❓</div>');
      const isExpanded = (st._expandIdx === i);
      html+=`<div style="background:#161b22;border:2px solid ${p?b.color:'#30363d'};border-radius:8px;padding:12px;text-align:center;${p?'':'opacity:0.5'};cursor:${p?'pointer':'default'}" data-boss-card="${i}">
        <div style="width:80px;height:80px;margin:0 auto;border-radius:50%;overflow:hidden;border:2px solid ${p?b.color:'#30363d'};background:#0d1117">${imgHtml}</div>
        <div style="font-size:13px;font-weight:bold;color:${p?b.color:'#8b949e'};margin-top:6px">${p?b.name:'???'}</div>
        ${p&&petDef?`<div style="font-size:10px;color:#8b949e;margin-top:3px">${petDef.desc}</div>`:''}
        <div style="font-size:11px;color:#8b949e;margin-top:4px">${p?`击败${p.killCount}次`:''}</div>
        ${isSuper?'<div style="font-size:10px;color:#ffd700;margin-top:2px">超级Boss</div>':''}
        ${p?'<div style="font-size:10px;color:#58a6ff;margin-top:3px">'+(isExpanded?'▼ 收起':'📖 查看详情')+'</div>':''}
      </div>`;
      // 展开的详情面板
      if(isExpanded && p){
        const lore=BOSS_LORE[i];
        html+=`<div style="grid-column:1/-1;background:#0d1117;border:1px solid ${b.color};border-radius:8px;padding:14px 18px;margin:4px 0;text-align:left;max-width:680px;margin-left:auto;margin-right:auto">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="font-size:22px">${b.icon}</div>
            <div>
              <div style="font-size:16px;font-weight:bold;color:${b.color}">${b.name}</div>
              <div style="font-size:11px;color:#8b949e">${b.desc}</div>
            </div>
            ${isSuper?'<span style="margin-left:auto;font-size:10px;color:#ffd700;background:rgba(255,215,0,0.15);padding:2px 8px;border-radius:4px;border:1px solid #ffd700">超级Boss</span>':''}
            ${b.isFinalBoss?'<span style="margin-left:auto;font-size:10px;color:#ff4444;background:rgba(255,68,68,0.15);padding:2px 8px;border-radius:4px;border:1px solid #ff4444">最终Boss</span>':''}
          </div>
          <div style="font-size:11px;color:#8b949e;margin-bottom:8px">📜 <b style="color:#d4c5a0">山海经·背景故事</b></div>
          <div style="font-size:12px;color:#c9d1d9;line-height:1.8;margin-bottom:12px;padding:8px 12px;background:rgba(212,197,160,0.05);border-left:2px solid #d4c5a0;border-radius:0 4px 4px 0">${lore.story}</div>
          <div style="font-size:11px;color:#ff6347;margin-bottom:6px">⚔️ <b style="color:#ff6347">弱点提示</b></div>
          <div style="font-size:12px;color:#ffa0a0;line-height:1.7;margin-bottom:12px;padding:8px 12px;background:rgba(255,99,71,0.08);border-left:2px solid #ff6347;border-radius:0 4px 4px 0">${lore.weakness}</div>
          <div style="font-size:11px;color:#58a6ff;margin-bottom:6px">✨ <b style="color:#58a6ff">Boss技能</b></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${lore.skills.map((s,si)=>`<span style="font-size:11px;color:#c9d1d9;background:rgba(88,166,255,0.1);border:1px solid rgba(88,166,255,0.3);padding:3px 10px;border-radius:12px">${si+1}. ${s}</span>`).join('')}
          </div>
          ${petDef?`<div style="margin-top:10px;padding-top:8px;border-top:1px solid #30363d"><span style="font-size:11px;color:#daa520">🐾 宠物形态：</span><span style="font-size:11px;color:#c9d1d9">${petDef.desc}</span></div>`:''}
        </div>`;
      }
    }
    html+=`</div>`;
  }else if(st.tab==='ach'){
    // 成就分页（仅在成就tab显示，避免其他tab误渲染成就分页导致按钮"按不动"）
    const pageSize=st.pageSize;
    const totalPages=Math.max(1,Math.ceil(ACHIEVEMENTS.length/pageSize));
    if(st.page>totalPages)st.page=1;
    const start=(st.page-1)*pageSize;
    const end=Math.min(start+pageSize, ACHIEVEMENTS.length);
    html+=pagedNavHTML('pedia', ACHIEVEMENTS.length, pageSize, st.page);
    html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;max-width:700px;margin:0 auto 10px">`;
    for(let i=start;i<end;i++){
      const a=ACHIEVEMENTS[i];
      const u=saveData.achievements[a.id];
      html+=`<div style="background:#161b22;border:2px solid ${u?'#ffd700':'#30363d'};border-radius:8px;padding:12px;text-align:center;${u?'':'opacity:0.6'}">
        <div style="font-size:24px">${u?a.icon:'🔒'}</div>
        <div style="font-size:13px;font-weight:bold;color:${u?'#ffd700':'#c9d1d9'}">${a.name}</div>
        <div style="font-size:11px;color:#8b949e">${a.desc}</div>
        <div style="font-size:11px;color:#3fb950;margin-top:4px">+${a.reward}积分</div>
      </div>`;
    }
    html+=`</div>`;
  }
  html+=`<div class="panel-actions"><button class="sec-btn" id="backFromPedia">返回</button></div>`;
  ov.innerHTML=html;
  ov.scrollTop=0;
  // 标签切换
  ov.querySelectorAll('[data-pedia-tab]').forEach(btn=>{
    _bindTap(btn,()=>{
      st.tab=btn.dataset.pediaTab;
      st.page=1;
      showPediaMenu();
    });
  });
  // 翻页按钮
  bindPagedNav(ov, showPediaMenu);
  // Boss卡片点击展开/收起详情
  ov.querySelectorAll('[data-boss-card]').forEach(card=>{
    const idx=parseInt(card.dataset.bossCard);
    if(!saveData.bossPedia[idx]) return; // 未解锁的不可点击
    _bindTap(card, (e)=>{
      if(e&&e.stopPropagation)e.stopPropagation();
      st._expandIdx = (st._expandIdx === idx) ? -1 : idx;
      showPediaMenu(st.tab);
    });
  });
  _bindTap(document.getElementById('backFromPedia'),()=>{ov.classList.add('hidden');showMainMenu();});
}

