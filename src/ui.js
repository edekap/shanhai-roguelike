// ==================== UI更新 ====================
// 统一按钮绑定工具：同时绑定 click 和 touchstart，避免移动端 300ms 延迟
// click 加 _isSynthesizedClick 守卫防止触屏笔记本双触发
// touchstart 带 preventDefault 阻止合成 click 事件
// 检查 el.disabled 防止 disabled 按钮在 touchstart 上仍触发（HTML disabled 只阻止 click 不阻止 touchstart）
// 天赋菜单记忆：玩家点击天赋后重渲染会丢失滚动位置，用这两个变量记录并恢复
let _talentMenuLastId=null;     // 上次点击的天赋id（用于重渲染后高亮闪烁）
let _talentMenuScrollTop=0;     // 上次点击时的滚动位置（用于重渲染后恢复）
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
// 自定义确认弹窗（不调用浏览器原生 confirm，避免破坏全屏）
// 用法：_confirmDialog('提示文案', onYes, onNo?)
function _confirmDialog(message, onYes, onNo, opts){
  opts = opts || {};
  const yesText = opts.yesText || '确定';
  const noText = opts.noText || '取消';
  const yesColor = opts.yesColor || '#f85149';
  const title = opts.title || '请确认';
  const html = `<div style="max-width:380px;width:100%;margin:auto;padding:18px 16px;background:linear-gradient(180deg,#1a1f2e,#0d1117);border:1px solid ${yesColor};border-radius:10px;box-shadow:0 0 24px rgba(0,0,0,0.6);text-align:center">
    <div style="color:${yesColor};font-size:15px;font-weight:bold;margin-bottom:8px;letter-spacing:1px">${title}</div>
    <div style="color:#c9d1d9;font-size:13px;line-height:1.6;margin-bottom:14px;word-break:break-word">${message}</div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="sec-btn" id="_confirmNo" style="flex:1;min-width:100px;padding:10px 14px;min-height:44px">${noText}</button>
      <button class="sec-btn" id="_confirmYes" style="flex:1;min-width:100px;padding:10px 14px;min-height:44px;background:linear-gradient(135deg,${yesColor},#a52838);color:#fff8e0;border-color:${yesColor}">${yesText}</button>
    </div>
  </div>`;
  const modal = _showGearModal(html);
  const yesBtn = document.getElementById('_confirmYes');
  const noBtn = document.getElementById('_confirmNo');
  const cleanup = ()=>{
    _hideGearModal();
    yesBtn.removeEventListener('click', yesHandler);
    noBtn.removeEventListener('click', noHandler);
  };
  const yesHandler = ()=>{ cleanup(); if(onYes)onYes(); };
  const noHandler = ()=>{ cleanup(); if(onNo)onNo(); };
  yesBtn.addEventListener('click', yesHandler);
  noBtn.addEventListener('click', noHandler);
  // 触屏防双触发
  if(typeof _bindTap==='function'){
    _bindTap(yesBtn, ()=>{});
    _bindTap(noBtn, ()=>{});
  }
  return modal;
}
// ==================== 战斗中Boss图鉴快捷按钮 ====================
// 战斗中点击血条旁的📖按钮，弹出当前Boss的背景故事/弱点/技能
// 自动暂停游戏，关闭后恢复（仅当未被玩家手动暂停时才恢复）
let _bossPediaPausedByUs = false;
function showBossWeaknessModal(){
  // 清理可能残留的上一次监听器（防御性：避免重复调用导致监听器泄漏）
  if(_bossPediaBgHandler){
    const oldModal = document.getElementById('gearModal');
    if(oldModal) oldModal.removeEventListener('click', _bossPediaBgHandler);
    _bossPediaBgHandler = null;
  }
  if(typeof boss==='undefined' || !boss){
    if(typeof _showSaveToast==='function')_showSaveToast('当前没有Boss');
    return;
  }
  const idx = (typeof boss.bossIndex==='number') ? boss.bossIndex : (typeof boss.bossIdx==='number' ? boss.bossIdx : 0);
  const b = (typeof BOSS_TYPES!=='undefined') ? BOSS_TYPES[idx] : null;
  const lore = (typeof BOSS_LORE!=='undefined') ? BOSS_LORE[idx] : null;
  if(!b || !lore){
    if(typeof _showSaveToast==='function')_showSaveToast('暂无该Boss的图鉴信息');
    return;
  }
  // 自动暂停游戏（仅当游戏在战斗中且未暂停时）
  if(typeof isPaused!=='undefined' && !isPaused && typeof gameState!=='undefined' && (gameState==='fighting' || gameState==='boss')){
    if(typeof togglePause==='function'){
      togglePause();
      _bossPediaPausedByUs = true;
    }
  }else{
    _bossPediaPausedByUs = false;
  }
  const isSuper = !!b.isSuper;
  const isFinalBoss = !!b.isFinalBoss;
  const isVariant = !!boss.isVariant;
  // 模态弹窗HTML（移动端友好：大字号、可滚动、底部固定关闭按钮）
  const html = `
    <div style="background:linear-gradient(180deg,#1a1410,#0d0a08);border:2px solid ${b.color};border-radius:14px;padding:0;max-width:480px;width:100%;margin:12px auto;box-shadow:0 0 40px ${b.color}66, 0 12px 40px rgba(0,0,0,0.8);overflow:hidden;font-family:'STKaiti','KaiTi','Microsoft YaHei',serif">
      <div style="background:linear-gradient(135deg,${b.color}33,${b.color}11);padding:16px 18px;border-bottom:1px solid ${b.color}55;display:flex;align-items:center;gap:12px">
        <div style="font-size:36px;filter:drop-shadow(0 0 8px ${b.color}aa)">${b.icon}</div>
        <div style="flex:1;text-align:left">
          <div style="font-size:22px;font-weight:900;color:${b.color};text-shadow:0 0 10px ${b.color}66;letter-spacing:2px">${boss.name||b.name}</div>
          <div style="font-size:11px;color:#8b949e;margin-top:3px">${b.desc}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">
          ${isFinalBoss?'<span style="font-size:10px;color:#ff4444;background:rgba(255,68,68,0.18);padding:2px 8px;border-radius:4px;border:1px solid #ff4444;font-weight:bold">最终Boss</span>':''}
          ${isSuper?'<span style="font-size:10px;color:#ffd700;background:rgba(255,215,0,0.18);padding:2px 8px;border-radius:4px;border:1px solid #ffd700;font-weight:bold">超级Boss</span>':''}
          ${isVariant?'<span style="font-size:10px;color:#bc8cff;background:rgba(188,140,255,0.18);padding:2px 8px;border-radius:4px;border:1px solid #bc8cff;font-weight:bold">⚡变异</span>':''}
        </div>
      </div>
      <div style="padding:14px 18px;max-height:55vh;overflow-y:auto;-webkit-overflow-scrolling:touch">
        <div style="font-size:12px;color:#d4c5a0;margin-bottom:6px;letter-spacing:1px">📜 <b>山海经·背景故事</b></div>
        <div style="font-size:13px;color:#c9d1d9;line-height:1.85;margin-bottom:14px;padding:10px 12px;background:rgba(212,197,160,0.06);border-left:3px solid #d4c5a0;border-radius:0 6px 6px 0;text-align:left">${lore.story}</div>
        <div style="font-size:12px;color:#ff6347;margin-bottom:6px;letter-spacing:1px">⚔️ <b>弱点提示</b></div>
        <div style="font-size:13px;color:#ffa0a0;line-height:1.8;margin-bottom:14px;padding:10px 12px;background:rgba(255,99,71,0.10);border-left:3px solid #ff6347;border-radius:0 6px 6px 0;text-align:left">${lore.weakness}</div>
        <div style="font-size:12px;color:#58a6ff;margin-bottom:8px;letter-spacing:1px">✨ <b>Boss技能</b></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          ${lore.skills.map((s,si)=>`<span style="font-size:12px;color:#c9d1d9;background:rgba(88,166,255,0.12);border:1px solid rgba(88,166,255,0.35);padding:4px 12px;border-radius:14px">${si+1}. ${s}</span>`).join('')}
        </div>
      </div>
      <div style="padding:12px 18px;border-top:1px solid #30363d;background:rgba(13,10,8,0.6);position:sticky;bottom:0">
        <button class="sec-btn" id="bossPediaCloseBtn" style="width:100%;padding:12px;font-size:15px;letter-spacing:2px;background:linear-gradient(135deg,${b.color}44,#1a1f2e);border-color:${b.color}99;color:${b.color}">✕ 关闭（继续战斗）</button>
      </div>
    </div>`;
  const modal = _showGearModal(html);
  // 关闭弹窗的统一处理：隐藏弹窗 + 若我们暂停了游戏则恢复
  const _closeBossPedia = ()=>{
    _hideGearModal();
    // 清理一次性背景点击监听器，避免污染后续 _showGearModal 调用
    if(modal && _bossPediaBgHandler){
      modal.removeEventListener('click', _bossPediaBgHandler);
      _bossPediaBgHandler = null;
    }
    if(_bossPediaPausedByUs && typeof isPaused!=='undefined' && isPaused && typeof togglePause==='function'){
      togglePause();
    }
    _bossPediaPausedByUs = false;
  };
  // 绑定关闭按钮
  const closeBtn = document.getElementById('bossPediaCloseBtn');
  if(closeBtn){
    _bindTap(closeBtn, _closeBossPedia);
  }
  // 一次性背景点击监听器：原_showGearModal已绑定背景点击关闭，但不会恢复暂停
  // 这里追加一个监听器，仅在本次弹窗期间生效，关闭时移除
  if(modal){
    _bossPediaBgHandler = (e)=>{ if(e.target===modal) _closeBossPedia(); };
    modal.addEventListener('click', _bossPediaBgHandler);
  }
}
let _bossPediaBgHandler = null;
// 绑定战斗中Boss图鉴快捷按钮（静态HTML元素，脚本加载时绑定一次）
(function _initBossPediaBtn(){
  const btn = document.getElementById('bossPediaBtn');
  if(btn){
    _bindTap(btn, ()=>{
      // 战斗中且Boss存在时才打开（避免主菜单误触）
      if(typeof gameState!=='undefined' && (gameState==='fighting' || gameState==='boss') && typeof boss!=='undefined' && boss){
        showBossWeaknessModal();
      }
    });
  }
})();
// ==================== 进度填充感系统 ====================
// 主菜单5大功能按钮上展示X/Y进度，满进度时变金色+✦徽章，激发收集欲
// 返回 fb-tag 内部HTML（含进度数字+可选满进度徽章）
// 满进度时返回的HTML带 .fb-tag-full 类，由CSS渲染金色样式
function _progressTag(current, total, labelIfEmpty){
  if(typeof total!=='number' || total<=0) return labelIfEmpty||'';
  const cur = Math.max(0, Math.min(total, current||0));
  const full = cur >= total;
  if(full){
    return `<span class="fb-tag-full">✦ ${cur}/${total} 完成</span>`;
  }
  return `<span class="fb-tag-progress">${cur}<span class="fb-tag-sep">/</span>${total}</span>`;
}
// 计算各模块当前进度（统一入口，便于维护）
function _getModuleProgress(){
  // 天赋：已点亮天赋数 / 总天赋数（互斥分支按已点亮计算）
  const talentCur = Object.keys(saveData.talents||{}).filter(k=>(saveData.talents[k]||0)>0).length;
  const talentTotal = (typeof TALENTS!=='undefined') ? TALENTS.length : 13;
  // 牧场：放养中的不同Boss宠物种类数 / 总Boss宠物种类数
  let ranchPets = 0;
  try { ranchPets = Array.isArray(saveData.ranchPets) ? new Set(saveData.ranchPets.filter(p=>p&&p.def!==undefined).map(p=>p.def)).size : 0; } catch(e){ ranchPets = 0; }
  const ranchTotal = (typeof BOSS_PET_DEFS!=='undefined') ? BOSS_PET_DEFS.length : 9;
  // 羁绊：已激活的羁绊数 / 总羁绊数（try-catch 保护，避免 ownedPets 元素异常导致整个主菜单崩溃）
  let bondCur = 0;
  try { if(typeof BONDS!=='undefined' && typeof getActiveBonds==='function') bondCur = getActiveBonds().length; } catch(e){ bondCur = 0; }
  const bondTotal = (typeof BONDS!=='undefined') ? BONDS.length : 6;
  // 图鉴：Boss击杀种类 + 成就解锁数 的综合完成度
  const bossCur = Object.keys(saveData.bossPedia||{}).length;
  const bossTotal = (typeof BOSS_TYPES!=='undefined') ? BOSS_TYPES.length : 10;
  const achCur = Object.keys(saveData.achievements||{}).length;
  const achTotal = (typeof ACHIEVEMENTS!=='undefined') ? ACHIEVEMENTS.length : 23;
  // 图鉴综合进度：Boss击杀 + 成就解锁 / (Boss总数 + 成就总数)
  const pediaCur = bossCur + achCur;
  const pediaTotal = bossTotal + achTotal;
  // 背包：装备+武器+宠物+魂器 综合完成度
  let gearCur = 0;
  try { if(typeof getOwnedBossMythics==='function') gearCur = getOwnedBossMythics().size; } catch(e){ gearCur = 0; }
  const gearTotal = 10; // 10个Boss对应10件神话装备
  const weaponCur = Object.keys(saveData.ownedWeapons||{}).length;
  const weaponTotal = (typeof WEAPONS!=='undefined') ? Object.keys(WEAPONS).length : 9;
  let petCur = 0;
  try { petCur = new Set((saveData.ownedPets||[]).filter(p=>p&&p.def!==undefined).map(p=>p.def)).size; } catch(e){ petCur = 0; }
  const petTotal = (typeof BOSS_PET_DEFS!=='undefined') ? BOSS_PET_DEFS.length : 9;
  const artCur = (saveData.ownedArtifacts||[]).length;
  const artTotal = (typeof SOUL_ARTIFACTS!=='undefined') ? SOUL_ARTIFACTS.length : 3;
  // 背包综合进度（4个子项求和）
  const bagCur = gearCur + weaponCur + petCur + artCur;
  const bagTotal = gearTotal + weaponTotal + petTotal + artTotal;
  return {
    talent: {cur:talentCur, total:talentTotal},
    bag: {cur:bagCur, total:bagTotal, subs:[
      {name:'装备', cur:gearCur, total:gearTotal},
      {name:'武器', cur:weaponCur, total:weaponTotal},
      {name:'宠物', cur:petCur, total:petTotal},
      {name:'魂器', cur:artCur, total:artTotal},
    ]},
    ranch: {cur:Math.min(ranchPets, ranchTotal), total:ranchTotal},
    bond: {cur:bondCur, total:bondTotal},
    pedia: {cur:pediaCur, total:pediaTotal, subs:[
      {name:'Boss', cur:bossCur, total:bossTotal},
      {name:'成就', cur:achCur, total:achTotal},
    ]},
  };
}



// 性能优化：缓存所有DOM引用，避免每帧调用getElementById
const _ui = {
  healthText:null, healthBar:null, shieldBarWrap:null, shieldBar:null,
  skillBar:null, scoreText:null, gameScore:null,
  xpLevel:null, xpText:null, xpBar:null,
  waveLabel:null, weaponText:null, petInfo:null, abilityInfo:null, relicInfo:null,
  bossBarFill:null, timerBar:null, trialProgress:null,
  // 脏标记缓存值，只在变化时写DOM
  _lastHealth:'', _lastShield:'', _lastSkill:-1, _lastScore:-1,
  _lastXp:'', _lastWave:'', _lastWeapon:'', _lastPet:'', _lastAbil:'', _lastRelics:'',
  _lastBossHp:-1, _lastTimerPct:-1, _lastTimerTxt:'', _lastProgress:'', _initDone:false
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
  _ui.trialProgress=document.getElementById('trialProgress');
  _ui._initDone=true;
}
function updateUI(){
  if(!player)return;
  if(!_ui._initDone)_initUICache();
  // 生命值（仅变化时写DOM）
  const hpTxt=`${Math.ceil(player.health)}/${player.maxHealth}`;
  if(hpTxt!==_ui._lastHealth){_ui.healthText.textContent=hpTxt;_ui._lastHealth=hpTxt;}
  // 血条宽度：阈值降到0.1%，让任何扣血都立即反映到血条（transition 0.05s 几乎瞬时）
  const hpRatio=player.health/player.maxHealth;
  const hpPct=Math.max(0,hpRatio*100);
  if(Math.abs(hpPct-_ui._lastHpPct)>0.1){_ui.healthBar.style.width=hpPct+'%';_ui._lastHpPct=hpPct;}
  // 玩家低血裂纹：血量<30%时血条变暗+震动+脉冲红光（强化"濒死"危机感）
  const lowHpFlag=hpRatio<=0.30 && hpRatio>0;
  if(lowHpFlag!==_ui._lastLowHp){_ui.healthBar.classList.toggle('lowhp-crack',lowHpFlag);_ui._lastLowHp=lowHpFlag;}
  // 护盾
  const shTxt=player.shield>0?'block':'none';
  if(_ui._lastShield!==shTxt){
    _ui.shieldBarWrap.style.display=shTxt;
    _ui._lastShield=shTxt;
  }
  if(player.shield>0){
    const shPct=player.maxShield>0?player.shield/player.maxShield*100:0;
    if(Math.abs(shPct-_ui._lastShieldPct)>0.1){_ui.shieldBar.style.width=shPct+'%';_ui._lastShieldPct=shPct;}
  }
  // 技能CD
  const skPct=(player.maxSkillCooldown>0?(1-player.skillCooldown/player.maxSkillCooldown)*100:0);
  if(Math.abs(skPct-_ui._lastSkill)>0.1){_ui.skillBar.style.width=skPct+'%';_ui._lastSkill=skPct;}
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
  // 性能优化：经验条宽度仅在变化>1%时才写DOM
  const xpPct=Math.min(100,player.xp/player.xpToNext*100);
  if(Math.abs(xpPct-_ui._lastXpPct)>1){_ui.xpBar.style.width=xpPct+'%';_ui._lastXpPct=xpPct;}
  // 波次显示：冒险/无尽模式正常显示；试炼模式进度通过 #trialProgress 单独展示（Boss血条已含Boss名）
  let wTxt;
  let progressTxt=''; // 顶部 #trialProgress 内容（仅Boss战时显示，避免与waveLabel重复）
  const isBossFight = (gameState==='boss') || document.body.classList.contains('boss-active');
  if(bossTrialMode){
    // 试炼模式：waveLabel 显示"试炼 X/N"，Boss战时通过 #trialProgress 同步显示（waveLabel会被CSS隐藏）
    const total = (typeof trialBossOrder!=='undefined' && trialBossOrder.length) ? trialBossOrder.length : 9;
    const idx = (typeof bossTrialIndex!=='undefined') ? Math.min(bossTrialIndex+1, total) : 1;
    wTxt = `⚔️ 试炼 ${idx}/${total}`;
    if(isBossFight) progressTxt = wTxt; // Boss战时waveLabel被隐藏，用#trialProgress补显示
  }else if(endlessMode){
    wTxt = `♾️无尽${endlessWave}波 ${gameState==='boss'?'BOSS':'波次'+currentWave}`;
    if(isBossFight) progressTxt = `♾️ 无尽 ${endlessWave}波 · BOSS`;
  }else{
    wTxt = `第${currentLevel}/5关 ${gameState==='boss'?'BOSS':'波次'+currentWave}`;
    if(isBossFight) progressTxt = `📜 第${currentLevel}/5关 · BOSS`;
  }
  if(wTxt!==_ui._lastWave){_ui.waveLabel.textContent=wTxt;_ui._lastWave=wTxt;}
  // 更新顶部进度指示器（仅Boss战时显示，避免与waveLabel重复）
  if(progressTxt!==_ui._lastProgress){
    if(_ui.trialProgress){
      _ui.trialProgress.textContent=progressTxt;
      _ui.trialProgress.style.display=progressTxt?'block':'none';
    }
    _ui._lastProgress=progressTxt;
  }
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
  if(!boss){
    // Boss 不存在时清理狂暴徽章，避免新 Boss 出现前残留显示
    const _bd=document.getElementById('bossEnrageBadge');
    if(_bd && !_bd.classList.contains('hidden')){
      _bd.classList.add('hidden'); _bd.classList.remove('enraged');
      _ui._lastEnrageState=undefined; _ui._lastEnrageSec=undefined;
    }
    return;
  }
  if(!_ui._initDone)_initUICache();
  const pct=Math.max(0,boss.health/boss.maxHealth*100);
  if(Math.abs(pct-_ui._lastBossHp)>0.5){_ui.bossBarFill.style.width=pct+'%';_ui._lastBossHp=pct;}
  // 分段血条阶段切换：跨过66.66%/33.33%时触发一次金色脉冲闪光
  // 视觉上让玩家感受到"Boss进入下一阶段"的反馈（如半血机制/狂暴切换）
  if(_ui._lastBossSeg===undefined)_ui._lastBossSeg=Math.ceil(pct/33.33);
  const seg=Math.ceil(pct/33.33);
  if(seg<_ui._lastBossSeg){
    const flash=document.getElementById('bossPhaseFlash');
    if(flash){
      flash.classList.remove('flash');
      void flash.offsetWidth; // 强制reflow，让动画可重启
      flash.classList.add('flash');
    }
    // Boss本体阶段切换闪光（红色warning flash）
    if(boss)boss.hitFlash=Math.max(boss.hitFlash||0,0.4);
  }
  _ui._lastBossSeg=seg;
  // Boss低血金震：血量<25%时血条整体金色脉动，强化"即将击杀"的紧张感
  // 性能优化：仅在状态切换时改 classList，避免每帧 add/remove 触发样式重算
  if(_ui.bossBarFill){
    const lowFlag=pct<=25 && pct>0;
    if(lowFlag!==_ui._lastBossLowHp){
      _ui.bossBarFill.classList.toggle('boss-lowhp-shake',lowFlag);
      _ui._lastBossLowHp=lowFlag;
    }
  }
  // ===== 狂暴倒计时徽章更新 =====
  // 仅当 boss._enrageTimer 字段存在时才显示（避免非Boss实体未定义时报错）
  if(boss._enrageTimer!==undefined){
    const badge=document.getElementById('bossEnrageBadge');
    if(badge){
      if(boss._enraged){
        // 已狂暴：显示"🔥 狂暴中"红色脉冲徽章
        if(_ui._lastEnrageState!==1){
          badge.classList.remove('hidden');
          badge.classList.add('enraged');
          badge.textContent='🔥 狂暴中';
          _ui._lastEnrageState=1;
        }
      }else{
        // 未狂暴：显示倒计时（仅在最后30秒显示，避免开局就给压力）
        const secLeft=Math.ceil(boss._enrageTimer);
        if(secLeft<=30){
          if(_ui._lastEnrageState!==2 || _ui._lastEnrageSec!==secLeft){
            badge.classList.remove('hidden','enraged');
            badge.textContent=`⏰ ${secLeft}s 后狂暴`;
            _ui._lastEnrageState=2;
            _ui._lastEnrageSec=secLeft;
          }
        }else{
          // 30秒以上：隐藏徽章（同时移除 enraged 类，避免下次显示时残留红色样式）
          if(_ui._lastEnrageState!==0){
            badge.classList.add('hidden');
            badge.classList.remove('enraged');
            _ui._lastEnrageState=0;
          }
        }
      }
    }
  }
}
function updateTimerUI(){
  if(!_ui._initDone)_initUICache();
  const tb=_ui.timerBar||document.getElementById('timerBar');
  const pct=Math.max(0,levelTimer/maxLevelTime*100);
  // 性能优化：宽度仅在变化>1%时才写DOM
  if(Math.abs(pct-_ui._lastTimerPct)>1){tb.style.width=pct+'%';_ui._lastTimerPct=pct;}
  let txt=Math.ceil(levelTimer)+'s';
  // 时间挑战显示
  if(bossTimeChallenge&&bossTimeChallenge.active&&gameState==='boss'){
    const t=Math.ceil(bossTimeChallenge.time);
    txt+=` | ⚡${t}s`;
    // 性能优化：仅在档位变化时才写 style（10/20秒阈值切换）
    const tier=t<=10?'red':t<=20?'yellow':'green';
    if(tier!==_ui._lastTimerTier){
      if(tier==='red'){tb.style.background='linear-gradient(90deg,#ff6347,#f85149)';tb.style.boxShadow='0 0 14px rgba(255,99,71,0.8)';}
      else if(tier==='yellow'){tb.style.background='linear-gradient(90deg,#ffd700,#f0883e)';tb.style.boxShadow='0 0 12px rgba(255,215,0,0.6)';}
      else{tb.style.background='linear-gradient(90deg,#3fb950,#58a6ff)';tb.style.boxShadow='0 0 10px rgba(63,185,80,0.5)';}
      _ui._lastTimerTier=tier;
    }
  }else{
    // 性能优化：仅在 tier 变化时清空 style
    if(_ui._lastTimerTier!=='normal'){
      tb.style.background=''; tb.style.boxShadow='';
      _ui._lastTimerTier='normal';
    }
  }
  if(_ui._lastTimerTxt!==txt){
    if(_ui.timerText)_ui.timerText.textContent=txt;
    else{const el=document.getElementById('timerText');if(el)_ui.timerText=el; if(_ui.timerText)_ui.timerText.textContent=txt;}
    _ui._lastTimerTxt=txt;
  }
}

// ==================== 背景绘制 ====================
// 静态背景（网格+边界）缓存到离屏canvas，避免每帧重画80+次stroke
let _bgCacheCanvas = null;
let _bgCacheCtx = null;
// 视差背景层缓存：远山剪影 + 云海波浪，预绘制一次，绘制时按玩家位置偏移
let _bgParallaxClouds = null; // 云海层（最远，慢速）
let _bgParallaxMountains = null; // 远山层（中远，中速）
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

  // ===== 视差背景层预绘制：云海（最远层） =====
  // 浅金色透明云海波浪，营造山海经古风氛围
  _bgParallaxClouds = document.createElement('canvas');
  _bgParallaxClouds.width = CONFIG.WIDTH;
  _bgParallaxClouds.height = CONFIG.HEIGHT;
  const ccx = _bgParallaxClouds.getContext('2d');
  // 4层云海波浪，越靠下越浓
  const cloudLayers = [
    {y: CONFIG.HEIGHT * 0.55, alpha: 0.04, color: '212,160,23', amp: 18, freq: 0.008, speed: 0},
    {y: CONFIG.HEIGHT * 0.68, alpha: 0.06, color: '212,160,23', amp: 22, freq: 0.011, speed: 0},
    {y: CONFIG.HEIGHT * 0.80, alpha: 0.08, color: '165,40,56', amp: 26, freq: 0.013, speed: 0},
    {y: CONFIG.HEIGHT * 0.92, alpha: 0.10, color: '165,40,56', amp: 30, freq: 0.016, speed: 0},
  ];
  for(const cl of cloudLayers){
    ccx.fillStyle = `rgba(${cl.color},${cl.alpha})`;
    ccx.beginPath();
    ccx.moveTo(0, cl.y);
    for(let x = 0; x <= CONFIG.WIDTH; x += 4){
      const y = cl.y + Math.sin(x * cl.freq) * cl.amp + Math.sin(x * cl.freq * 2.3) * cl.amp * 0.4;
      ccx.lineTo(x, y);
    }
    ccx.lineTo(CONFIG.WIDTH, CONFIG.HEIGHT);
    ccx.lineTo(0, CONFIG.HEIGHT);
    ccx.closePath();
    ccx.fill();
  }

  // ===== 视差背景层预绘制：远山（中远层） =====
  // 3层山峦剪影，深紫蓝色，越远越淡
  _bgParallaxMountains = document.createElement('canvas');
  _bgParallaxMountains.width = CONFIG.WIDTH;
  _bgParallaxMountains.height = CONFIG.HEIGHT;
  const mcx = _bgParallaxMountains.getContext('2d');
  const mountainLayers = [
    {y: CONFIG.HEIGHT * 0.55, color: 'rgba(40,30,55,0.35)', amp: 60, freq: 0.005, seed: 1},
    {y: CONFIG.HEIGHT * 0.68, color: 'rgba(30,25,45,0.50)', amp: 75, freq: 0.007, seed: 2},
    {y: CONFIG.HEIGHT * 0.82, color: 'rgba(20,18,35,0.65)', amp: 90, freq: 0.009, seed: 3},
  ];
  for(const ml of mountainLayers){
    mcx.fillStyle = ml.color;
    mcx.beginPath();
    mcx.moveTo(0, CONFIG.HEIGHT);
    mcx.lineTo(0, ml.y);
    for(let x = 0; x <= CONFIG.WIDTH; x += 6){
      // 多频率叠加生成自然山形
      const y = ml.y - Math.abs(Math.sin(x * ml.freq + ml.seed)) * ml.amp
                       - Math.sin(x * ml.freq * 2.7 + ml.seed * 1.3) * ml.amp * 0.3;
      mcx.lineTo(x, y);
    }
    mcx.lineTo(CONFIG.WIDTH, CONFIG.HEIGHT);
    mcx.closePath();
    mcx.fill();
  }
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
  // ===== 视差背景层：远山+云海，根据玩家位置产生微小位移，营造场景纵深感 =====
  // 仅在战斗/Boss状态绘制（菜单等静态界面不需要）
  if(_bgParallaxClouds && _bgParallaxMountains && player && (gameState==='fighting'||gameState==='boss')){
    // 视差偏移：玩家相对屏幕中心的位移 × 系数（远层慢，近层快）
    const px = (player.x - CONFIG.WIDTH/2);
    // 云海（最远层，慢速）：偏移 ±0.03 × WIDTH ≈ ±24px
    const cloudOffsetX = -px * 0.04;
    ctx.drawImage(_bgParallaxClouds, cloudOffsetX, 0);
    ctx.drawImage(_bgParallaxClouds, cloudOffsetX + CONFIG.WIDTH, 0); // 拼接右半部分避免边缘缝隙
    // 远山（中远层，中速）：偏移 ±0.08 × WIDTH ≈ ±48px
    const mtnOffsetX = -px * 0.08;
    ctx.drawImage(_bgParallaxMountains, mtnOffsetX, 0);
    ctx.drawImage(_bgParallaxMountains, mtnOffsetX + CONFIG.WIDTH, 0);
  }
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
    // 绘制追踪光束（special3多道光束同时存在）
    if(boss._trackingBeamActive&&boss._trackingBeamActive.length>0){
      const c=boss.color;
      const cr=parseInt(c.substr(1,2),16),cg=parseInt(c.substr(3,2),16),cb=parseInt(c.substr(5,2),16);
      for(const d of boss._trackingBeamActive){
        const t=d.timer/d.duration;
        ctx.globalAlpha=Math.max(0.3,1-t*0.5);
        if(d.beamType==='horizontal'){
          const grd=ctx.createLinearGradient(0,d.y-50,0,d.y+50);
          grd.addColorStop(0,`rgba(${cr},${cg},${cb},0)`);grd.addColorStop(0.5,`rgba(${cr},${cg},${cb},0.9)`);grd.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);
          ctx.fillStyle=grd; ctx.fillRect(0,d.y-50,CONFIG.WIDTH,100);
          ctx.fillStyle=`rgba(255,200,150,${0.6*(1-t)})`;
          ctx.fillRect(0,d.y-3,CONFIG.WIDTH,6);
        }else{
          const grd=ctx.createLinearGradient(d.x-50,0,d.x+50,0);
          grd.addColorStop(0,`rgba(${cr},${cg},${cb},0)`);grd.addColorStop(0.5,`rgba(${cr},${cg},${cb},0.9)`);grd.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);
          ctx.fillStyle=grd; ctx.fillRect(d.x-50,0,100,CONFIG.HEIGHT);
          ctx.fillStyle=`rgba(255,200,150,${0.6*(1-t)})`;
          ctx.fillRect(d.x-3,0,6,CONFIG.HEIGHT);
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
  if(typeof _level5FinalBossDone!=='undefined')_level5FinalBossDone=false; // 兜底重置
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
  // 检查神话套装是否激活，显示提示（使用 gameTimeout 防止跨局残留）
  const _mythicCnt=Object.values(saveData.equippedGear).filter(g=>g&&g.rarity==='mythic').length;
  if(_mythicCnt>=4){
    gameTimeout(()=>{
      pushFloatingText(CONFIG.WIDTH/2,CONFIG.HEIGHT/2-40,'🔥 神话套装已激活！','#ff4444',3);
      pushFloatingText(CONFIG.WIDTH/2,CONFIG.HEIGHT/2,'伤害×1.6 移速×1.3 生命×1.3','#ffd970',2.5);
      pushFloatingText(CONFIG.WIDTH/2,CONFIG.HEIGHT/2+30,'暴击+20% 暴伤+50% 穿透+2 吸血+3%','#ffd970',2.5);
    },1500);
  }
  // 手机端首次进入游戏：提示摇杆自动锁定机制（持久化记录，仅首次玩家显示）
  // 使用 saveData.aimTipShown 持久化，避免每次开浏览器都弹
  // 改用中央卡片提示（比浮字更明显），玩家点击关闭
  if(isTouchDevice && !saveData.aimTipShown){
    saveData.aimTipShown = true;
    saveSave();
    gameTimeout(()=>{
      _showAimTipModal();
    }, 3000);
  }
}
// 自瞄提示模态弹窗（首次玩家专属，必须点击关闭，不会错过）
function _showAimTipModal(){
  const html = `<div style="max-width:340px;text-align:center;padding:20px 18px;font-family:'STKaiti',KaiTi,serif">
    <div style="font-size:48px;margin-bottom:10px">🎯</div>
    <h3 style="color:#ffd970;letter-spacing:2px;margin:0 0 12px;font-size:18px">自动锁定机制</h3>
    <div style="color:#e0d8c8;font-size:13px;line-height:1.9;margin-bottom:16px">
      <div style="background:rgba(255,215,0,0.1);border-left:3px solid #ffd970;padding:8px 10px;margin:6px 0;border-radius:4px;text-align:left">
        <div style="color:#ffd970;font-weight:bold">📲 右半屏按下不动</div>
        <div style="color:#d4c5a0;font-size:12px;margin-top:2px">自动锁定射程内最近敌人</div>
      </div>
      <div style="background:rgba(188,140,255,0.1);border-left:3px solid #bc8cff;padding:8px 10px;margin:6px 0;border-radius:4px;text-align:left">
        <div style="color:#bc8cff;font-weight:bold">👆 滑动手指</div>
        <div style="color:#d4c5a0;font-size:12px;margin-top:2px">手动瞄准射击方向</div>
      </div>
      <div style="background:rgba(88,166,255,0.08);border-left:3px solid #58a6ff;padding:8px 10px;margin:6px 0;border-radius:4px;text-align:left">
        <div style="color:#58a6ff;font-weight:bold">✨ 浮动摇杆</div>
        <div style="color:#d4c5a0;font-size:12px;margin-top:2px">左/右半屏任意位置按下即出现摇杆，松手消失，不挡视野</div>
      </div>
    </div>
    <button id="aimTipCloseBtn" style="width:100%;padding:12px;background:linear-gradient(135deg,#ffd970,#d4a020);color:#1a1f2e;border:none;border-radius:8px;font-size:15px;font-weight:bold;letter-spacing:2px;cursor:pointer;font-family:'STKaiti',KaiTi,serif">✦ 知道了，开始战斗 ✦</button>
  </div>`;
  const modal = _showGearModal(html);
  const closeBtn = document.getElementById('aimTipCloseBtn');
  if(closeBtn){
    _bindTap(closeBtn, ()=>{ _hideGearModal(modal); });
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
  // 性能优化：用索引替代 indexOf，避免 O(n²) 复杂度
  for(let _ri=0;_ri<sel.length;_ri++){
    const r=sel[_ri];
    html+=`<div class="relic-card ${r.rarity} card-enter" data-relic="${r.id}" style="animation-delay:${_ri*0.1}s"><div class="relic-icon">${r.icon}</div><div class="upgrade-name" style="color:${r.rarity==='epic'?'#f0883e':'#bc8cff'}">${r.name}</div><div class="upgrade-desc">${r.desc}</div><div class="upgrade-rarity ${r.rarity}">${r.rarity==='rare'?'稀有':'史诗'}</div></div>`;
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
  playSound('levelUp'); // 复活：用升级音效（shield case 不存在）
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
  deathAnimation={x:px,y:py,t:0,maxT:1.6,particles};
  // 隐藏玩家
  if(player)player.alive=false;
  // 1.6秒后触发gameOver — 使用 gameTimeout 获得跨局竞态保护（_runToken 自动校验）
  // 现有 clearTimeout(deathTimeout) 调用点无需修改，gameTimeout 返回的就是 setTimeout ID
  // 延长到1.6秒是为了让"魂魄飞出+漩涡"轮回动画有充足时间呈现
  deathTimeout=gameTimeout(()=>{deathAnimation=null; deathTimeout=null; gameOver();},1600);
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
  // ===== 轮回动画：魂魄飞出+金色漩涡（progress 0.3~1.0） =====
  // 在爆炸闪光结束后（progress>0.3）开始呈现轮回戏剧化：
  //   - 0.3~0.5 屏幕暗红色蒙版渐入
  //   - 0.4~0.8 玩家位置出现金色魂魄（光球向上飘起）
  //   - 0.6~1.0 屏幕中央出现金色漩涡（旋转粒子环），魂魄被吸入
  if(progress>=0.30){
    const cx=CONFIG.WIDTH/2, cy=CONFIG.HEIGHT/2;
    // 暗红色蒙版（progress 0.3→1.0 alpha 0→0.7）
    const darkAlpha=Math.min(0.7, (progress-0.30)/0.70 * 0.7);
    ctx.save();
    ctx.fillStyle=`rgba(20,5,5,${darkAlpha})`;
    ctx.fillRect(0,0,CONFIG.WIDTH,CONFIG.HEIGHT);
    ctx.restore();
    // 金色魂魄（从玩家位置向上飘起，progress 0.4~0.9）
    if(progress>=0.40 && progress<0.95){
      const sp=(progress-0.40)/0.55; // 0~1
      const soulX=da.x + Math.sin(sp*Math.PI*2)*15; // 轻微左右摆动
      const soulY=da.y - sp*100; // 向上飘
      const soulAlpha=sp<0.7?1:(1-(sp-0.7)/0.3); // 后段淡出（被吸入）
      const soulScale=0.8+sp*0.5;
      ctx.save();
      ctx.globalAlpha=soulAlpha;
      // 魂魄光晕
      const sgrad=ctx.createRadialGradient(soulX,soulY,0,soulX,soulY,20*soulScale);
      sgrad.addColorStop(0,'rgba(255,255,255,1)');
      sgrad.addColorStop(0.4,'rgba(255,215,0,0.85)');
      sgrad.addColorStop(1,'rgba(255,215,0,0)');
      ctx.fillStyle=sgrad;
      ctx.beginPath();ctx.arc(soulX,soulY,20*soulScale,0,Math.PI*2);ctx.fill();
      // 魂魄核心
      ctx.fillStyle='#fff8e0';
      ctx.beginPath();ctx.arc(soulX,soulY,5*soulScale,0,Math.PI*2);ctx.fill();
      ctx.restore();
      // 魂魄拖尾粒子
      if(Math.random()<0.5){
        spawnParticles(soulX, soulY, '#ffd700', 1);
      }
    }
    // 金色漩涡（屏幕中央，progress 0.6~1.0）
    if(progress>=0.60){
      const vp=(progress-0.60)/0.40; // 0~1
      const vAlpha=vp<0.7?1:(1-(vp-0.7)/0.3);
      const vRotate=_NOW*0.005; // 旋转角度
      const vRadius=80+vp*60; // 漩涡半径扩大
      ctx.save();
      ctx.globalAlpha=vAlpha;
      // 漩涡中心黑洞
      const vgrad=ctx.createRadialGradient(cx,cy,0,cx,cy,vRadius*1.2);
      vgrad.addColorStop(0,'rgba(0,0,0,0.85)');
      vgrad.addColorStop(0.5,'rgba(60,30,10,0.6)');
      vgrad.addColorStop(0.9,'rgba(212,160,23,0.3)');
      vgrad.addColorStop(1,'rgba(212,160,23,0)');
      ctx.fillStyle=vgrad;
      ctx.beginPath();ctx.arc(cx,cy,vRadius*1.2,0,Math.PI*2);ctx.fill();
      // 漩涡旋转粒子环（3层）
      for(let ring=0;ring<3;ring++){
        const r=vRadius*(0.6+ring*0.2);
        const segs=24+ring*4;
        for(let i=0;i<segs;i++){
          const a=(i/segs)*Math.PI*2+vRotate*(1+ring*0.3);
          const px=cx+Math.cos(a)*r;
          const py=cy+Math.sin(a)*r;
          const sz=2+ring;
          ctx.fillStyle=`rgba(255,${215-ring*30},${100+ring*40},${0.7-ring*0.15})`;
          ctx.beginPath();ctx.arc(px,py,sz,0,Math.PI*2);ctx.fill();
        }
      }
      // 漩涡中心金色光点（吸引魂魄）
      ctx.fillStyle=`rgba(255,255,255,${vAlpha})`;
      ctx.beginPath();ctx.arc(cx,cy,8,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  }
}
// 死亡复盘条形图：横向条形图直观展示本局各项数据
function _genRecapBar(label, value, max, color){
  const v=Number(value)||0;
  const m=Math.max(0.0001, Number(max)||1);
  const pct=Math.min(100, Math.max(2, (v/m)*100)); // 最小2%保证可见
  return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:10px">
    <div style="width:78px;color:#b0a090;text-align:right;letter-spacing:0.3px">${label}</div>
    <div style="flex:1;height:10px;background:rgba(0,0,0,0.5);border-radius:5px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
      <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,${color}aa,${color});border-radius:5px;box-shadow:0 0 6px ${color}88;transition:width 0.8s ease"></div>
    </div>
    <div style="width:50px;color:${color};font-weight:bold;text-align:right">${v}</div>
  </div>`;
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
  // 取前1条展示（紧凑一行布局，避免手机端溢出）
  const showTips=tips.slice(0,1);
  return `<div style="max-width:520px;width:100%;box-sizing:border-box;margin:3px auto;padding:4px 8px;background:linear-gradient(135deg,rgba(255,215,0,0.12),rgba(188,140,255,0.10));border:1px solid rgba(255,215,0,0.5);border-radius:4px;overflow-x:hidden;word-break:break-word;font-size:10px;color:#d4c5a0;line-height:1.4">
    <span style="color:#ffd700;font-weight:bold">💡</span> ${showTips[0]||''}
  </div>`;
}

// ==================== 宝箱系统 ====================
// 局末按表现发放宝箱：铜/银/金/紫/橙 5档
// 品质判定：基于本局得分、Boss击杀数、模式（试炼/无尽/冒险）、是否通关
// 开箱时机：主菜单点击"📦 宝箱"按钮，依次开箱（带动画）
const CHEST_TYPES = {
  bronze: { name:'铜宝箱', color:'#cd7f32', glow:'#a0522d', icon:'🥉', rewards:{score:[50,150],   gearChance:0,    gearRarity:null,        talent:0} },
  silver: { name:'银宝箱', color:'#c0c0c0', glow:'#d8d8d8', icon:'🥈', rewards:{score:[150,400],  gearChance:0.15, gearRarity:'rare',      talent:0} },
  gold:   { name:'金宝箱', color:'#ffd700', glow:'#ffaa00', icon:'🥇', rewards:{score:[400,1000], gearChance:0.35, gearRarity:'epic',      talent:0} },
  purple: { name:'紫宝箱', color:'#bc8cff', glow:'#9d5cff', icon:'🔮', rewards:{score:[1000,2500],gearChance:0.60, gearRarity:'legendary', talent:1} },
  orange: { name:'橙宝箱', color:'#ff6b35', glow:'#ff8c00', icon:'🎃', rewards:{score:[2500,5000],gearChance:1.00, gearRarity:'epic', mythicChance:0.30, talent:3} },
};
const CHEST_QUALITY_ORDER = ['bronze','silver','gold','purple','orange'];

// 根据本局表现判定宝箱品质
function evaluateChestQuality(rs, wasTrial, endlessWave, currentLevel, bossTrialIndex){
  if(!rs) return 'bronze';
  const sc = rs.goldEarned || 0;
  const bk = rs.bossKills || 0;
  // 橙箱：通关弑神试炼 OR 极高表现
  if(wasTrial && saveData.difficulty==='godslayer' && typeof trialBossOrder!=='undefined' && bossTrialIndex>=trialBossOrder.length) return 'orange';
  if(sc>=10000 || bk>=5) return 'orange';
  // 紫箱：通关任意难度试炼 OR 高分 OR 无尽10波+
  if(wasTrial && typeof trialBossOrder!=='undefined' && bossTrialIndex>=trialBossOrder.length) return 'purple';
  if(endlessWave>=10) return 'purple';
  if(sc>=5000 || bk>=3) return 'purple';
  // 金箱：中高分
  if(sc>=2000 || bk>=2) return 'gold';
  // 银箱：基础表现
  if(sc>=500 || bk>=1) return 'silver';
  // 铜箱：参与就给
  return 'bronze';
}

// 在局末（gameOver）调用：根据本局表现生成宝箱并存入 pendingChests
function grantRunChest(){
  if(typeof runStats==='undefined' || !runStats || !runStats.startTime) return null;
  const quality = evaluateChestQuality(runStats, _lastRunWasTrial, endlessWave, currentLevel, bossTrialIndex);
  const chest = {
    quality,
    source: _lastRunWasTrial ? 'trial' : (endlessMode ? 'endless' : 'run'),
    ts: Date.now(),
    runScore: runStats.goldEarned || 0,
    runBossKills: runStats.bossKills || 0,
  };
  if(!saveData.pendingChests) saveData.pendingChests = [];
  saveData.pendingChests.push(chest);
  // 限制最多8个未开宝箱，防止囤积：超限时自动开掉最旧的（直接发奖励到积分）
  while(saveData.pendingChests.length > 8){
    const old = saveData.pendingChests.shift();
    const r = CHEST_TYPES[old.quality].rewards;
    const bonus = Math.floor(r.score[0] + Math.random()*(r.score[1]-r.score[0]));
    saveData.totalScore = (saveData.totalScore||0) + bonus;
  }
  saveSave();
  return chest;
}

// 开箱抽奖：返回奖励详情并发放到存档
function _openChestRoll(chest){
  const def = CHEST_TYPES[chest.quality];
  const r = def.rewards;
  const scoreGain = Math.floor(r.score[0] + Math.random()*(r.score[1]-r.score[0]));
  const result = { quality: chest.quality, score: scoreGain, gear: null, talent: r.talent || 0 };
  // 装备奖励
  if(r.gearRarity && Math.random() < r.gearChance){
    let rarity = r.gearRarity;
    // 橙箱有概率出神话
    if(r.mythicChance && Math.random() < r.mythicChance){
      rarity = 'mythic';
    }
    const slot = GEAR_SLOTS[randInt(0, GEAR_SLOTS.length-1)];
    result.gear = generateGear(slot, rarity);
  }
  // 发放奖励
  saveData.totalScore = (saveData.totalScore||0) + scoreGain;
  if(result.talent > 0){
    saveData.talentPoints = (saveData.talentPoints||0) + result.talent;
  }
  if(result.gear){
    saveData.gearBag.push(result.gear);
  }
  // 更新统计
  if(!saveData.chestHistory) saveData.chestHistory = {bronze:0, silver:0, gold:0, purple:0, orange:0};
  saveData.chestHistory[chest.quality] = (saveData.chestHistory[chest.quality]||0) + 1;
  saveSave();
  // 每日目标：开箱进度更新
  _updateDailyGoalsOnChestOpen();
  return result;
}

// 开箱动画 overlay
let _chestOpenState = null;
let _chestStylesInjected = false;
function _ensureChestStyles(){
  if(_chestStylesInjected) return;
  _chestStylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
.chest-container{position:relative;width:200px;height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.chest-glow{position:absolute;width:280px;height:280px;border-radius:50%;pointer-events:none;filter:blur(8px)}
.chest-glow-idle{animation:chestGlowIdle 2.4s ease-in-out infinite}
.chest-glow-pulse{animation:chestGlowPulse 0.3s ease-in-out infinite}
@keyframes chestGlowIdle{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.15);opacity:0.9}}
@keyframes chestGlowPulse{0%,100%{transform:scale(1);opacity:0.7}50%{transform:scale(1.3);opacity:1}}
.chest-body{position:relative;width:160px;height:140px;border:3px solid #cd7f32;border-radius:12px 12px 8px 8px;overflow:visible;z-index:2}
.chest-lid{position:absolute;top:0;left:-3px;right:-3px;height:50px;border-radius:12px 12px 0 0;box-shadow:0 4px 8px rgba(0,0,0,0.4);transform-origin:center bottom;transition:transform 0.3s}
.chest-base{position:absolute;bottom:0;left:0;right:0;height:95px;border-radius:0 0 8px 8px}
.chest-lock{position:absolute;top:38px;left:50%;transform:translateX(-50%);width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;z-index:3}
.chest-label{margin-top:14px;font-size:16px;font-weight:bold;letter-spacing:2px;font-family:STKaiti,KaiTi,serif}
.chest-shake{animation:chestShake 0.08s ease-in-out infinite}
@keyframes chestShake{0%,100%{transform:translateX(0) rotate(0)}25%{transform:translateX(-4px) rotate(-1deg)}75%{transform:translateX(4px) rotate(1deg)}}
.chest-burst{animation:chestBurst 0.6s ease-out forwards}
@keyframes chestBurst{0%{transform:scale(1)}40%{transform:scale(1.15)}70%{transform:scale(1.3)}100%{transform:scale(1.5);opacity:0}}
.chest-burst-flash{position:absolute;width:400px;height:400px;border-radius:50%;pointer-events:none;animation:chestFlash 0.6s ease-out forwards;z-index:4}
@keyframes chestFlash{0%{opacity:0;transform:scale(0.3)}30%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2)}}
.chest-burst-body{animation:chestBodyBurst 0.5s ease-out forwards}
@keyframes chestBodyBurst{0%{transform:scale(1)}100%{transform:scale(1.4);opacity:0.3}}
.chest-lid-fly{animation:chestLidFly 0.6s ease-out forwards}
@keyframes chestLidFly{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(-120px) rotate(-25deg);opacity:0}}
.chest-lock-fly{animation:chestLockFly 0.5s ease-out forwards}
@keyframes chestLockFly{0%{transform:translateX(-50%) translateY(0)}100%{transform:translateX(-50%) translateY(-80px);opacity:0}}
.chest-rays{position:absolute;width:500px;height:500px;border-radius:50%;pointer-events:none;animation:chestRays 0.8s linear forwards;z-index:1;opacity:0}
@keyframes chestRays{0%{opacity:0;transform:scale(0.2) rotate(0)}30%{opacity:0.8}100%{opacity:0;transform:scale(2) rotate(180deg)}}
@keyframes pulseGlow{0%,100%{box-shadow:0 0 12px rgba(255,215,0,0.4)}50%{box-shadow:0 0 24px rgba(255,215,0,0.8)}}
@keyframes cardEnter{0%{opacity:0;transform:translateY(20px) scale(0.95)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes titleFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
`;
  document.head.appendChild(style);
}
function openChestOverlay(){
  if(!saveData.pendingChests || saveData.pendingChests.length===0){
    _showSaveToast('暂无待开宝箱，多打几局就有了');
    return;
  }
  _ensureChestStyles();
  const chest = saveData.pendingChests[0];
  let ov = document.getElementById('chestOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'chestOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '';
  ov.style.display = 'flex';
  _chestOpenState = { chest, phase: 'idle', result: null };
  _renderChestOverlay();
}

function _renderChestOverlay(){
  const ov = document.getElementById('chestOverlay');
  if(!ov || !_chestOpenState) return;
  const st = _chestOpenState;
  const def = CHEST_TYPES[st.chest.quality];
  const remaining = (saveData.pendingChests||[]).length;
  const srcLabel = st.chest.source==='trial'?'Boss试炼':st.chest.source==='endless'?'无尽模式':'冒险模式';

  if(st.phase === 'idle' || st.phase === 'shaking'){
    const shakeClass = st.phase === 'shaking' ? ' chest-shake' : '';
    const glowClass = st.phase === 'shaking' ? 'chest-glow-pulse' : 'chest-glow-idle';
    ov.innerHTML = `
      <div style="color:#ffd700;font-size:13px;letter-spacing:2px;margin-bottom:10px;text-shadow:0 0 8px rgba(255,215,0,0.5)">📦 待开宝箱 ${remaining} 个</div>
      <div style="color:#8b949e;font-size:11px;margin-bottom:20px">来源：${srcLabel} · 本局 ${st.chest.runScore||0}分 / ${st.chest.runBossKills||0}Boss</div>
      <div class="chest-container${shakeClass}" id="chestBox">
        <div class="chest-glow ${glowClass}" style="background:radial-gradient(circle, ${def.glow}88 0%, transparent 70%)"></div>
        <div class="chest-body" style="border-color:${def.color};box-shadow:0 0 40px ${def.glow}aa, inset 0 0 20px ${def.color}44">
          <div class="chest-lid" style="background:linear-gradient(180deg, ${def.color}, ${def.glow})"></div>
          <div class="chest-base" style="background:linear-gradient(180deg, ${def.glow}, ${def.color})"></div>
          <div class="chest-lock" style="background:${def.color};box-shadow:0 0 12px ${def.glow}">${def.icon}</div>
        </div>
        <div class="chest-label" style="color:${def.color};text-shadow:0 0 8px ${def.glow}">${def.name}</div>
      </div>
      ${st.phase==='idle' ? `<button class="action-btn" id="chestOpenBtn" style="margin-top:28px;background:linear-gradient(135deg,${def.color},${def.glow});font-size:16px;padding:14px 36px;min-height:48px;animation:pulseGlow 1.5s ease-in-out infinite">✨ 点击开箱</button>` : `<div style="margin-top:28px;color:${def.color};font-size:13px;letter-spacing:2px;animation:pulseGlow 0.6s ease-in-out infinite">开箱中...</div>`}
      <button class="sec-btn" id="chestSkipBtn" style="margin-top:14px;font-size:12px;padding:8px 18px;min-height:36px">稍后再开</button>
    `;
    if(st.phase==='idle'){
      const openBtn = document.getElementById('chestOpenBtn');
      if(openBtn) _bindTap(openBtn, _triggerChestOpen);
    }
    const skipBtn = document.getElementById('chestSkipBtn');
    if(skipBtn) _bindTap(skipBtn, _closeChestOverlay);
  } else if(st.phase === 'opening'){
    // 开箱爆裂动画
    ov.innerHTML = `
      <div style="color:#ffd700;font-size:13px;letter-spacing:2px;margin-bottom:14px">📦 开箱中...</div>
      <div class="chest-container chest-burst" id="chestBox">
        <div class="chest-burst-flash" style="background:radial-gradient(circle, #fff 0%, ${def.glow} 30%, transparent 70%)"></div>
        <div class="chest-body chest-burst-body" style="border-color:${def.color}">
          <div class="chest-lid chest-lid-fly" style="background:linear-gradient(180deg, ${def.color}, ${def.glow})"></div>
          <div class="chest-base" style="background:linear-gradient(180deg, ${def.glow}, ${def.color});opacity:0.5"></div>
          <div class="chest-lock chest-lock-fly">${def.icon}</div>
        </div>
        <div class="chest-rays" style="background:conic-gradient(from 0deg, transparent, ${def.glow}aa, transparent, ${def.color}aa, transparent, ${def.glow}aa, transparent, ${def.color}aa, transparent)"></div>
      </div>
    `;
  } else if(st.phase === 'reward'){
    // 显示奖励
    const r = st.result;
    let gearHtml = '';
    if(r.gear){
      const gr = GEAR_RARITIES[r.gear.rarity];
      gearHtml = `<div style="background:rgba(22,27,34,0.9);border:2px solid ${gr.color};border-radius:10px;padding:12px 16px;margin:10px 0;box-shadow:0 0 20px ${gr.color}66;animation:cardEnter 0.6s">
        <div style="color:${gr.color};font-size:12px;font-weight:bold;letter-spacing:1px;margin-bottom:4px">${GEAR_SLOT_ICONS[r.gear.slot]} ${gr.name}装备</div>
        <div style="color:#e0d8c8;font-size:13px;font-weight:bold;margin-bottom:4px">${r.gear.name}</div>
        <div style="font-size:11px;color:#c9d1d9">${r.gear.stats.map(s=>`<div>${s.icon} ${s.name} +${s.value}</div>`).join('')}</div>
        ${r.gear.specialAffix?`<div style="color:${gr.color};font-size:11px;margin-top:6px">✦ ${r.gear.specialAffix.name}：${r.gear.specialAffix.desc}</div>`:''}
      </div>`;
    }
    let talentHtml = r.talent > 0 ? `<div style="color:#ffd700;font-size:18px;font-weight:bold;margin:6px 0;text-shadow:0 0 10px rgba(255,215,0,0.6)">⭐ +${r.talent} 天赋点</div>` : '';

    ov.innerHTML = `
      <div style="color:${def.color};font-size:14px;letter-spacing:2px;margin-bottom:8px;text-shadow:0 0 8px ${def.glow}">${def.icon} ${def.name} 已开启</div>
      <div style="background:rgba(22,27,34,0.85);border:1px solid ${def.color}66;border-radius:14px;padding:20px 24px;max-width:360px;width:100%;text-align:center;box-shadow:0 0 30px ${def.glow}66">
        <div style="color:#ffd700;font-size:36px;font-weight:bold;margin:6px 0;text-shadow:0 0 15px rgba(255,215,0,0.7);animation:titleFloat 2s ease-in-out infinite">+${r.score}</div>
        <div style="color:#8b949e;font-size:12px;margin-bottom:8px">🪙 积分</div>
        ${talentHtml}
        ${gearHtml}
      </div>
      <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;justify-content:center">
        ${remaining > 1 ? `<button class="action-btn" id="chestNextBtn" style="background:linear-gradient(135deg,${def.color},${def.glow});font-size:15px;padding:12px 28px;min-height:44px">📦 继续开箱 (${remaining-1})</button>` : ''}
        <button class="sec-btn" id="chestDoneBtn" style="font-size:14px;padding:12px 24px;min-height:44px">完成</button>
      </div>
    `;
    const nextBtn = document.getElementById('chestNextBtn');
    if(nextBtn) _bindTap(nextBtn, _openNextChest);
    const doneBtn = document.getElementById('chestDoneBtn');
    if(doneBtn) _bindTap(doneBtn, _closeChestOverlay);
  }
}

function _triggerChestOpen(){
  if(!_chestOpenState || _chestOpenState.phase !== 'idle') return;
  _chestOpenState.phase = 'shaking';
  _renderChestOverlay();
  // 抖动0.8秒后进入爆裂
  setTimeout(()=>{
    if(!_chestOpenState || _chestOpenState.phase !== 'shaking') return;
    _chestOpenState.phase = 'opening';
    _renderChestOverlay();
    // 爆裂0.6秒后显示奖励
    setTimeout(()=>{
      if(!_chestOpenState || _chestOpenState.phase !== 'opening') return;
      const chest = _chestOpenState.chest;
      const result = _openChestRoll(chest);
      _chestOpenState.result = result;
      _chestOpenState.phase = 'reward';
      // 从 pendingChests 中移除已开的宝箱
      if(saveData.pendingChests && saveData.pendingChests.length > 0){
        saveData.pendingChests.shift();
        saveSave();
      }
      _renderChestOverlay();
      // 开箱音效（复用 bossHit 增强反馈）
      if(typeof playSound === 'function') playSound('bossHit');
    }, 600);
  }, 800);
}

function _openNextChest(){
  _chestOpenState = null;
  if(!saveData.pendingChests || saveData.pendingChests.length === 0){
    _closeChestOverlay();
    _showSaveToast('所有宝箱已开完');
    return;
  }
  openChestOverlay();
}

function _closeChestOverlay(){
  _chestOpenState = null;
  const ov = document.getElementById('chestOverlay');
  if(ov){
    ov.style.display = 'none';
    ov.innerHTML = '';
  }
  // 刷新主菜单（如果在主菜单状态）
  if(gameState === 'menu' && typeof showMainMenu === 'function'){
    showMainMenu();
  }
}

// ==================== 每日目标系统 ====================
// 每天3个目标，跨天重置；完成单个得积分，全部完成额外奖励
const DAILY_GOAL_POOL = [
  { id:'kill_enemies_30', type:'kill_enemies', target:30, name:'击杀 30 只小怪', reward:{score:100} },
  { id:'kill_enemies_50', type:'kill_enemies', target:50, name:'击杀 50 只小怪', reward:{score:150} },
  { id:'kill_enemies_80', type:'kill_enemies', target:80, name:'击杀 80 只小怪', reward:{score:200} },
  { id:'kill_boss_1',  type:'kill_bosses', target:1, name:'击败 1 个 Boss', reward:{score:150} },
  { id:'kill_boss_2',  type:'kill_bosses', target:2, name:'击败 2 个 Boss', reward:{score:250} },
  { id:'kill_boss_3',  type:'kill_bosses', target:3, name:'击败 3 个 Boss', reward:{score:400} },
  { id:'score_500',   type:'score_once', target:500, name:'单局得到 500 分', reward:{score:100} },
  { id:'score_1500',  type:'score_once', target:1500, name:'单局得到 1500 分', reward:{score:200} },
  { id:'score_3000',  type:'score_once', target:3000, name:'单局得到 3000 分', reward:{score:300} },
  { id:'combo_10', type:'combo_once', target:10, name:'单局 10 连击', reward:{score:100} },
  { id:'combo_20', type:'combo_once', target:20, name:'单局 20 连击', reward:{score:200} },
  { id:'reach_lv3', type:'reach_level', target:3, name:'到达第 3 关', reward:{score:150} },
  { id:'reach_lv5', type:'reach_level', target:5, name:'到达第 5 关', reward:{score:300} },
  { id:'open_chest_1', type:'open_chests', target:1, name:'开 1 个宝箱', reward:{score:50} },
  { id:'open_chest_3', type:'open_chests', target:3, name:'开 3 个宝箱', reward:{score:150} },
  { id:'trial_1', type:'trial_count', target:1, name:'完成 1 次试炼', reward:{score:200} },
  { id:'endless_3', type:'endless_wave', target:3, name:'无尽达到 3 波', reward:{score:200} },
  { id:'endless_5', type:'endless_wave', target:5, name:'无尽达到 5 波', reward:{score:300} },
];
const DAILY_ALL_COMPLETE_BONUS = { score:500, chest:'gold' };

// _getTodayStr() 复用签到系统中已有的实现（下方定义）
// 刷新每日目标：跨天时重新生成3个目标
function _refreshDailyGoals(){
  const today = _getTodayStr();
  if(!saveData.dailyGoals || saveData.dailyGoals.date !== today){
    // 从目标池中随机选3个（不同type避免重复）
    const byType = {};
    for(const g of DAILY_GOAL_POOL){
      if(!byType[g.type]) byType[g.type] = [];
      byType[g.type].push(g);
    }
    const types = Object.keys(byType);
    // 简单洗牌
    for(let i=types.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [types[i],types[j]]=[types[j],types[i]];
    }
    const selected = [];
    for(const t of types){
      if(selected.length>=3) break;
      const arr = byType[t];
      const pick = arr[Math.floor(Math.random()*arr.length)];
      selected.push({ id:pick.id, type:pick.type, target:pick.target, name:pick.name, reward:pick.reward, progress:0, claimed:false });
    }
    saveData.dailyGoals = { date: today, goals: selected, allClaimed: false };
    saveSave();
  }
}

// 更新每日目标进度（在局末 gameOver 中批量更新）
function _updateDailyGoalsOnRunEnd(rs, wasTrial, endlessWave, currentLevel){
  if(!saveData.dailyGoals || !saveData.dailyGoals.goals) return;
  let changed = false;
  for(const g of saveData.dailyGoals.goals){
    if(g.claimed) continue;
    const oldP = g.progress;
    switch(g.type){
      case 'kill_enemies':
        g.progress = Math.min(g.target, g.progress + (rs.kills||0));
        break;
      case 'kill_bosses':
        g.progress = Math.min(g.target, g.progress + (rs.bossKills||0));
        break;
      case 'score_once':
        g.progress = Math.min(g.target, Math.max(g.progress, rs.goldEarned||0));
        break;
      case 'combo_once':
        g.progress = Math.min(g.target, Math.max(g.progress, rs.maxCombo||0));
        break;
      case 'reach_level':
        g.progress = Math.min(g.target, Math.max(g.progress, currentLevel||0));
        break;
      case 'trial_count':
        if(wasTrial) g.progress = Math.min(g.target, g.progress + 1);
        break;
      case 'endless_wave':
        g.progress = Math.min(g.target, Math.max(g.progress, endlessWave||0));
        break;
    }
    if(g.progress !== oldP) changed = true;
  }
  if(changed) saveSave();
}

// 开箱时更新开箱进度
function _updateDailyGoalsOnChestOpen(){
  if(!saveData.dailyGoals || !saveData.dailyGoals.goals) return;
  let changed = false;
  for(const g of saveData.dailyGoals.goals){
    if(g.claimed) continue;
    if(g.type === 'open_chests'){
      g.progress = Math.min(g.target, g.progress + 1);
      changed = true;
    }
  }
  if(changed) saveSave();
}

// 领取单个目标奖励
function claimDailyGoal(idx){
  if(!saveData.dailyGoals || !saveData.dailyGoals.goals) return;
  const g = saveData.dailyGoals.goals[idx];
  if(!g || g.claimed) return;
  if(g.progress < g.target){
    _showSaveToast('目标未完成');
    return;
  }
  g.claimed = true;
  const r = g.reward || {};
  if(r.score){
    saveData.totalScore = (saveData.totalScore||0) + r.score;
  }
  if(r.chest){
    if(!saveData.pendingChests) saveData.pendingChests = [];
    saveData.pendingChests.push({ quality:r.chest, source:'daily', ts:Date.now(), runScore:0, runBossKills:0 });
  }
  if(r.talent){
    saveData.talentPoints = (saveData.talentPoints||0) + r.talent;
  }
  saveSave();
  _showSaveToast(`✦ 领取 ${r.score||0} 积分${r.chest?` + ${CHEST_TYPES[r.chest].name}`:''}${r.talent?` + ${r.talent}天赋点`:''}`);
  // 检查是否全部领取
  _checkDailyAllClaimed();
  // 刷新主菜单
  if(gameState === 'menu' && typeof showMainMenu === 'function'){
    showMainMenu();
  }
}

// 领取全部完成额外奖励
function claimDailyAllBonus(){
  if(!saveData.dailyGoals || saveData.dailyGoals.allClaimed) return;
  // 检查是否所有目标都已领取
  const allClaimed = saveData.dailyGoals.goals.every(g => g.claimed);
  if(!allClaimed){
    _showSaveToast('请先领取所有目标奖励');
    return;
  }
  saveData.dailyGoals.allClaimed = true;
  const b = DAILY_ALL_COMPLETE_BONUS;
  saveData.totalScore = (saveData.totalScore||0) + b.score;
  if(b.chest){
    if(!saveData.pendingChests) saveData.pendingChests = [];
    saveData.pendingChests.push({ quality:b.chest, source:'daily_all', ts:Date.now(), runScore:0, runBossKills:0 });
  }
  saveSave();
  _showSaveToast(`🎉 全部完成！+${b.score} 积分 + ${CHEST_TYPES[b.chest].name}`);
  if(gameState === 'menu' && typeof showMainMenu === 'function'){
    showMainMenu();
  }
}

function _checkDailyAllClaimed(){
  if(!saveData.dailyGoals) return;
  // allClaimed 标记仅在领取额外奖励后设为 true，这里只检查是否可领取
  // 实际"是否可领额外奖励"通过 goals.every(g=>g.claimed) 判断
}

// 渲染主菜单中的每日目标卡片
function _renderDailyGoals(){
  _refreshDailyGoals();
  if(!saveData.dailyGoals || !saveData.dailyGoals.goals) return '';
  const dg = saveData.dailyGoals;
  const allDone = dg.goals.every(g => g.progress >= g.target);
  const allClaimed = dg.goals.every(g => g.claimed);
  const goalsHtml = dg.goals.map((g, i) => {
    const pct = Math.min(100, (g.progress / g.target) * 100);
    const done = g.progress >= g.target;
    const claimed = g.claimed;
    const rewardStr = `${g.reward.score?`🪙${g.reward.score}`:''}${g.reward.chest?` +${CHEST_TYPES[g.reward.chest].icon}`:''}${g.reward.talent?` ⭐${g.reward.talent}`:''}`;
    let btnHtml = '';
    if(claimed){
      btnHtml = `<span style="color:#3fb950;font-size:11px;font-weight:bold">✓ 已领取</span>`;
    } else if(done){
      btnHtml = `<button class="sec-btn" id="dailyGoalClaimBtn_${i}" style="font-size:11px;padding:4px 12px;min-height:28px;border-color:#ffd700;color:#ffd700;background:rgba(255,215,0,0.1)">领取 ${rewardStr}</button>`;
    } else {
      btnHtml = `<span style="color:#8b949e;font-size:11px">${rewardStr}</span>`;
    }
    const barColor = done ? '#3fb950' : '#ffd700';
    return `<div style="background:rgba(22,27,34,0.7);border:1px solid ${done?'rgba(63,185,80,0.4)':'rgba(255,215,0,0.2)'};border-radius:6px;padding:6px 10px;margin:4px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="color:${done?'#3fb950':'#e0d8c8'};font-size:11px">${done?'✓ ':''}${g.name}</span>
        ${btnHtml}
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1;height:6px;background:#1a1f2e;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${barColor},${barColor}cc);border-radius:3px;transition:width 0.4s;box-shadow:0 0 4px ${barColor}88"></div>
        </div>
        <span style="color:${done?'#3fb950':'#8b949e'};font-size:10px;min-width:48px;text-align:right">${g.progress}/${g.target}</span>
      </div>
    </div>`;
  }).join('');
  let bonusHtml = '';
  if(allDone && !allClaimed){
    bonusHtml = `<button class="action-btn" id="dailyAllBonusBtn" style="margin-top:6px;background:linear-gradient(135deg,#ffd700,#ff8c42);font-size:12px;padding:8px 16px;min-height:36px;animation:pulseGlow 1.5s ease-in-out infinite">🎉 领取全部完成奖励 +${DAILY_ALL_COMPLETE_BONUS.score}积分 +${CHEST_TYPES[DAILY_ALL_COMPLETE_BONUS.chest].icon}${CHEST_TYPES[DAILY_ALL_COMPLETE_BONUS.chest].name}</button>`;
  } else if(allClaimed){
    bonusHtml = `<div style="text-align:center;color:#3fb950;font-size:11px;margin-top:6px">✓ 今日全部完成，明日刷新</div>`;
  }
  return `<details style="margin:4px 0;padding:6px 10px;background:rgba(22,27,34,0.6);border:1px solid rgba(255,215,0,0.25);border-radius:8px" ${allDone&&!allClaimed?'open':''}>
    <summary style="cursor:pointer;color:#ffd700;font-size:12px;letter-spacing:1px">🎯 每日目标 ${allClaimed?'✓':`(${dg.goals.filter(g=>g.claimed).length}/${dg.goals.length})`}</summary>
    <div style="margin-top:6px">${goalsHtml}${bonusHtml}</div>
  </details>`;
}

// 绑定每日目标按钮事件（在 showMainMenu 末尾调用）
function _bindDailyGoalButtons(){
  if(!saveData.dailyGoals || !saveData.dailyGoals.goals) return;
  for(let i=0;i<saveData.dailyGoals.goals.length;i++){
    const g = saveData.dailyGoals.goals[i];
    if(!g.claimed && g.progress >= g.target){
      const btn = document.getElementById(`dailyGoalClaimBtn_${i}`);
      if(btn) _bindTap(btn, ()=>claimDailyGoal(i));
    }
  }
  // 全部完成奖励按钮：只要按钮存在就绑定（claimDailyAllBonus 内部会校验领取条件）
  const allBtn = document.getElementById('dailyAllBonusBtn');
  if(allBtn) _bindTap(allBtn, claimDailyAllBonus);
}
function gameOver(){
  // 防重入：Boss 死亡触发的 onBossDefeated 与玩家死亡的 deathTimeout 可能同时调用 gameOver
  if(gameState==='gameover')return;
  document.body.classList.remove('boss-active'); // 恢复中间 panel（Boss 战时被精简）
  // 清理 #trialProgress：updateUI 在 player=null 时会提前return，需在此显式隐藏，避免残留在死亡界面
  const _tp=document.getElementById('trialProgress');
  if(_tp){_tp.style.display='none';_tp.textContent='';}
  if(_ui && _ui._lastProgress!==undefined)_ui._lastProgress='';
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
  pendingSuperRevenge=false; // 第五轮新增：避免跨局泄漏污染下一只Boss
  if(typeof _level5FinalBossDone!=='undefined')_level5FinalBossDone=false; // 重置5关强制刑天标记
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
  // 首局保底奖励：第1局死亡/通关后额外送5天赋点+1件史诗装备
  // 解决新手第1局必死且只拿几十积分、缺乏"再来一局"动力的问题
  let firstRunBonus=null;
  if(af.totalRuns===1 && !af.firstRunBonusClaimed){
    af.firstRunBonusClaimed=true;
    saveData.talentPoints=(saveData.talentPoints||0)+5;
    // 生成1件史诗装备放进背包
    let bonusGear=null;
    try{
      if(typeof generateRandomGear==='function'){
        bonusGear=generateRandomGear('epic');
      }else if(typeof generateGear==='function'){
        bonusGear=generateGear({rarity:'epic'});
      }
    }catch(e){ bonusGear=null; }
    if(bonusGear){
      saveData.gearBag.push(bonusGear);
      firstRunBonus={talents:5, gear:bonusGear};
    }else{
      // 装备生成失败兜底：多送5天赋点
      saveData.talentPoints=(saveData.talentPoints||0)+5;
      firstRunBonus={talents:10, gear:null};
    }
    saveSave();
  }
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
    if(!saveData.difficultyCleared)saveData.difficultyCleared={normal:false,hard:false,hell:false,nightmare:false,godslayer:false};
    if(saveData.difficultyCleared.nightmare===undefined)saveData.difficultyCleared.nightmare=false;
    saveData.difficultyCleared[diff]=true;
    // 同步到成就标志
    if(diff==='normal')af.trialNormalCleared=true;
    else if(diff==='hard')af.trialHardCleared=true;
    else if(diff==='hell')af.trialHellCleared=true;
    else if(diff==='nightmare')af.trialNightmareCleared=true;
    else if(diff==='godslayer'){
      af.trialGodslayerCleared=true;
      // 弑神难度试炼通关：解锁特殊称号（首次解锁）
      if(!saveData.titleGodslayer){
        saveData.titleGodslayer=true;
        _showTitleReveal=true; // 标记，稍后在结算界面显示
      }
    }
  }
  // 检查成就解锁
  const newlyUnlocked=checkAchievements();
  // 宝箱系统：根据本局表现发放宝箱（在成就检查后，确保 difficultyCleared 已设置）
  const _grantedChest = grantRunChest();
  // 每日目标系统：更新本局相关进度
  _updateDailyGoalsOnRunEnd(runStats, wasTrial, endlessWave, currentLevel);
  // 牧场生蛋
  const newEggs=ranchLayEggs();
  // 成就解锁会修改saveData.totalScore（奖励积分），需补一次saveSave避免玩家关闭浏览器丢失
  if(newlyUnlocked.length>0 && !newEggs) saveSave();
  bossTrialMode=false;
  const ov=document.getElementById('overlay');
  ov.classList.remove('hidden');
  let achHtml='';
  if(newlyUnlocked.length>0){
    achHtml=`<div style="background:rgba(255,215,0,0.1);border:1px solid #ffd700;border-radius:4px;padding:4px 8px;margin:3px auto;max-width:520px;font-size:10px;color:#ffd700">🏆 成就解锁 ${newlyUnlocked.length} 个: ${newlyUnlocked.map(a=>`${a.icon}${a.name}+${a.reward}分`).join(' · ')}</div>`;
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
      <div style="max-width:520px;margin:4px auto;padding:5px 8px;background:rgba(22,27,34,0.7);border:1px solid rgba(136,144,150,0.3);border-radius:6px;width:100%;box-sizing:border-box">
        <div style="color:#f85149;font-size:11px;font-weight:bold;margin-bottom:4px;word-break:break-word">💀 死因：${rs.deathCause}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;font-size:10px;margin-bottom:3px">
          <div style="background:rgba(13,17,23,0.7);padding:3px 5px;border-radius:3px"><span style="color:#8b949e">⏱</span> <b style="color:#c9d1d9">${_fmtTime(rs.duration)}</b></div>
          <div style="background:rgba(13,17,23,0.7);padding:3px 5px;border-radius:3px"><span style="color:#8b949e">⚔</span> <b style="color:#3fb950">${rs.kills}</b><span style="color:#8b949e;font-size:9px">(${rs.bossKills}Boss)</span></div>
          <div style="background:rgba(13,17,23,0.7);padding:3px 5px;border-radius:3px"><span style="color:#8b949e">🔥</span> <b style="color:#ffd700">${rs.maxCombo}</b></div>
          <div style="background:rgba(13,17,23,0.7);padding:3px 5px;border-radius:3px"><span style="color:#8b949e">💥</span> <b style="color:#ff6b6b">${Math.round(rs.damageDealt)}</b></div>
          <div style="background:rgba(13,17,23,0.7);padding:3px 5px;border-radius:3px"><span style="color:#8b949e">🩸</span> <b style="color:#f85149">${Math.round(rs.damageTaken)}</b></div>
          <div style="background:rgba(13,17,23,0.7);padding:3px 5px;border-radius:3px"><span style="color:#8b949e">⭐</span> <b style="color:#bc8cff">${rs.xpEarned}</b></div>
        </div>
        <div style="font-size:10px;color:#8b949e;line-height:1.4;word-break:break-word">
          <span style="color:#ffd700">🎒</span> ${_equipBuild} · <span style="color:#58a6ff">⚡${rs.upgradesTaken.length}强化</span>
        </div>
      </div>`;
  }
  // 根据本局类型决定"再打一次"按钮的行为：试炼→再打一次试炼，无尽→再战无尽，冒险→再来一局冒险
  const wasEndless = !wasTrial && endlessMode; // gameOver 不重置 endlessMode，可据此判断
  const replayBtnId = wasTrial ? 'replayTrialBtn' : (wasEndless ? 'replayEndlessBtn' : 'startBtn');
  const replayBtnText = wasTrial ? '🐉 再打一次试炼' : (wasEndless ? '♾️ 再战无尽' : '⚔️ 再来一局');
  const replayBtnHandler = wasTrial ? 'startBossTrial' : (wasEndless ? 'startEndlessMode' : 'startGame');
  const replayBtnStyle = wasTrial ? 'background:linear-gradient(135deg,#bc8cff,#8b5cf6);font-size:16px;padding:14px 28px;min-height:48px' : (wasEndless ? 'background:linear-gradient(135deg,#3fb950,#2a9d8f);font-size:16px;padding:14px 28px;min-height:48px' : 'font-size:16px;padding:14px 28px;min-height:48px');
  const tipHtml=generateDeathTip();
  // 首局保底奖励提示（紧凑单行）
  const firstBonusHtml = firstRunBonus ? `
    <div style="background:linear-gradient(135deg,rgba(212,160,23,0.2),rgba(165,40,56,0.15));border:1px solid #ffd700;border-radius:4px;padding:4px 8px;margin:3px auto;max-width:520px;font-size:10px;color:#ffd700;animation:cardEnter 0.5s">
      🎁 新手礼包: +${firstRunBonus.talents}天赋${firstRunBonus.gear?` · +1史诗装备(${firstRunBonus.gear.name||''})`:''}
    </div>` : '';
  // 宝箱获得提示（紧凑单行）
  let chestNoticeHtml = '';
  if(_grantedChest){
    const _cd = CHEST_TYPES[_grantedChest.quality];
    const _totalPending = (saveData.pendingChests||[]).length;
    chestNoticeHtml = `
      <div style="background:linear-gradient(135deg,${_cd.color}22,${_cd.glow}11);border:1px solid ${_cd.color};border-radius:4px;padding:4px 8px;margin:3px auto;max-width:520px;font-size:10px;color:${_cd.color};animation:cardEnter 0.6s">
        📦 ${_cd.icon}${_cd.name}${_totalPending>1?` (共${_totalPending}个待开)`:''} · 主菜单开箱
      </div>`;
  }
  ov.innerHTML=`<div class="bg-runes"><span class="bg-rune">💀</span><span class="bg-rune">⚔</span><span class="bg-rune">🔥</span><span class="bg-rune">☠</span><span class="bg-rune">🌑</span><span class="bg-rune">💫</span></div><div style="position:relative;z-index:1;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;padding:6px;padding-top:6px;padding-bottom:calc(6px + env(safe-area-inset-bottom, 0px));min-height:100%;box-sizing:border-box;gap:2px">
  <h1 style="color:#f85149;animation:titleFloat 3s ease-in-out infinite;font-size:20px;margin:0">游戏结束 · ${wasTrial?'试炼终结':endlessMode?'无尽止步':'冒险落幕'}</h1>
  <div id="finalScore" class="card-enter" style="font-size:32px;line-height:1.05;margin:1px 0">${score}<span style="font-size:11px;color:#8b949e;margin-left:6px">${wasTrial?'试炼':endlessMode?`无尽${endlessWave}波${endlessWave>0&&endlessWave>=(saveData.bestEndlessWave||0)?'🏆':''}`:`${currentLevel}关${currentWave}波`}</span></div>
  <div style="display:flex;gap:4px;justify-content:center;margin:2px 0;flex-wrap:wrap;font-size:11px">
    <span style="color:#ffd970">🪙+${score}</span>
    <span style="color:#bc8cff">⭐${saveData.talentPoints||0}天赋</span>
    ${newEggs>0?`<span style="color:#3fb950">🥚x${newEggs}</span>`:''}
    <span style="color:#8b949e">🎖️Lv.${(saveData.totalXp||0)?Math.floor((saveData.totalXp||0)/500)+1:1}</span>
  </div>
  <div style="background:rgba(22,27,34,0.85);border:1px solid rgba(255,215,0,0.4);border-radius:6px;padding:5px 8px;margin:3px auto;max-width:380px;display:flex;flex-direction:column;gap:4px;width:100%;box-sizing:border-box">
    <button class="action-btn" id="${replayBtnId}" style="${replayBtnStyle};width:100%;max-width:380px;font-size:14px;padding:10px 20px;min-height:42px">${replayBtnText}</button>
    <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;width:100%">
      <button class="sec-btn" id="backToMenuBtn" style="font-size:12px;padding:8px 12px;min-height:40px;flex:1;min-width:100px">🏠 返回主菜单</button>
      <button class="sec-btn" id="shareScoreBtn" style="font-size:12px;padding:8px 12px;min-height:40px;border-color:#bc8cff;color:#bc8cff;flex:1;min-width:100px">📤 分享</button>
    </div>
  </div>
  ${tipHtml}
  ${achHtml}${firstBonusHtml}${chestNoticeHtml}
</div>`;
  saveSave();
  // 死亡界面按钮统一用 _bindTap（带 _isSynthesizedClick 守卫，防止触屏笔记本双触发）
  const startBtnEl=document.getElementById(replayBtnId);
  const backToMenuBtnEl=document.getElementById('backToMenuBtn');
  const replayHandler=wasTrial?startBossTrial:(wasEndless?startEndlessMode:startGame);
  _bindTap(startBtnEl, replayHandler);
  _bindTap(backToMenuBtnEl, showMainMenu);
  const shareBtnEl=document.getElementById('shareScoreBtn');
  if(shareBtnEl)_bindTap(shareBtnEl, ()=>shareRunResult(score, wasTrial, recapHtml));
  // 弑神难度试炼首次通关：解锁特殊称号
  if(typeof _showTitleReveal!=='undefined' && _showTitleReveal){
    _showTitleReveal=false;
    setTimeout(()=>showTitleRevealModal(), 600);
  }
}

// 战绩分享卡片：生成图片可保存到相册或分享
function shareRunResult(finalScore, wasTrial, recapHtml){
  // 提取关键数据
  const mode = wasTrial ? 'Boss试炼' : (endlessMode ? `无尽·${endlessWave}波` : `冒险·第${currentLevel}关`);
  const kills = (typeof runStats!=='undefined' && runStats) ? (runStats.kills||0) : 0;
  const maxCombo = (typeof runStats!=='undefined' && runStats) ? (runStats.maxCombo||0) : 0;
  const xpEarned = (typeof runStats!=='undefined' && runStats) ? (runStats.xpEarned||0) : 0;
  // 生成分享卡片
  const canvas=document.createElement('canvas');
  canvas.width=720; canvas.height=1280;
  const ctx=canvas.getContext('2d');
  // 背景：深色渐变
  const grad=ctx.createLinearGradient(0,0,0,1280);
  grad.addColorStop(0,'#1a0a05'); grad.addColorStop(0.5,'#0d0a08'); grad.addColorStop(1,'#000');
  ctx.fillStyle=grad; ctx.fillRect(0,0,720,1280);
  // 顶部金色装饰条
  ctx.fillStyle='#d4a017'; ctx.fillRect(0,0,720,4);
  // 标题
  ctx.textAlign='center';
  ctx.fillStyle='#f85149';
  ctx.font='bold 60px STKaiti,KaiTi,serif';
  ctx.shadowColor='rgba(248,81,73,0.6)'; ctx.shadowBlur=20;
  ctx.fillText('游戏结束',360,140);
  ctx.shadowBlur=0;
  // 副标题
  ctx.fillStyle='#8b949e';
  ctx.font='28px STKaiti,KaiTi,serif';
  ctx.fillText(mode,360,200);
  // 分数
  ctx.fillStyle='#ffd970';
  ctx.font='bold 160px STKaiti,KaiTi,serif';
  ctx.shadowColor='rgba(255,217,112,0.5)'; ctx.shadowBlur=30;
  ctx.fillText(finalScore,360,400);
  ctx.shadowBlur=0;
  ctx.fillStyle='#8b949e';
  ctx.font='24px STKaiti,KaiTi,serif';
  ctx.fillText('本局得分',360,450);
  // 分隔线
  ctx.strokeStyle='rgba(212,160,23,0.4)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(80,500); ctx.lineTo(640,500); ctx.stroke();
  // 数据网格
  ctx.font='22px STKaiti,KaiTi,serif';
  const stats=[
    {label:'⚔️ 击杀数', value: kills, color:'#3fb950'},
    {label:'🔥 最高连击', value: maxCombo, color:'#ffd970'},
    {label:'⭐ 经验获得', value: xpEarned+' XP', color:'#bc8cff'},
    {label:'🎖️ 训练等级', value: 'Lv.'+(((saveData.totalXp||0)?Math.floor((saveData.totalXp||0)/500)+1:1)), color:'#ffd700'}
  ];
  stats.forEach((s,i)=>{
    const y=560+i*80;
    ctx.fillStyle='#8b949e'; ctx.textAlign='left';
    ctx.fillText(s.label,120,y);
    ctx.fillStyle=s.color; ctx.textAlign='right'; ctx.font='bold 28px STKaiti,KaiTi,serif';
    ctx.fillText(s.value,600,y);
    ctx.font='22px STKaiti,KaiTi,serif';
  });
  // 底部品牌
  ctx.textAlign='center';
  ctx.fillStyle='#d4a017'; ctx.font='28px STKaiti,KaiTi,serif';
  ctx.fillText('山海经·揍异兽',360,1080);
  ctx.fillStyle='#8b949e'; ctx.font='18px STKaiti,KaiTi,serif';
  ctx.fillText('九大异兽·刑天战神·肉鸽冒险',360,1115);
  // 底部装饰
  ctx.fillStyle='#d4a017'; ctx.fillRect(0,1276,720,4);
  // 转为图片
  try{
    const dataUrl=canvas.toDataURL('image/png');
    // 优先使用 Web Share API（手机端原生分享）
    if(navigator.share || navigator.canShare){
      canvas.toBlob(async (blob)=>{
        try{
          const file=new File([blob],'战绩.png',{type:'image/png'});
          if(navigator.canShare && navigator.canShare({files:[file]})){
            await navigator.share({files:[file], title:'我在山海经揍异兽', text:`${mode} 得分 ${finalScore}!`});
          }else{
            await navigator.share({title:'我在山海经揍异兽', text:`${mode} 得分 ${finalScore}! 击杀${kills} 最高连击${maxCombo}`});
          }
        }catch(err){
          // 用户取消分享，不报错
          if(err.name!=='AbortError') showToast('已生成战绩图','📄',2000);
        }
      },'image/png');
    }else{
      // 桌面端：在新标签页打开图片，让用户右键保存
      const win=window.open();
      if(win){
        win.document.write(`<title>战绩分享</title><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${dataUrl}" style="max-width:100%;max-height:100vh"></body>`);
      }else{
        // 弹窗被拦截，下载图片
        const a=document.createElement('a');
        a.href=dataUrl; a.download=`战绩_${finalScore}分.png`; a.click();
      }
      showToast('战绩图已生成','📄',2000);
    }
  }catch(err){
    showToast('生成失败：'+err.message,'⚠️',2000);
  }
}
// 弑神称号解锁弹窗（仅在弑神难度试炼首次通关后显示）
function showTitleRevealModal(){
  const html=`<div id="titleRevealOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:16px;backdrop-filter:blur(8px);overflow-y:auto;-webkit-overflow-scrolling:touch">
    <div style="background:linear-gradient(180deg,#1a0a2a,#2a1040);border:2px solid #ffd970;border-radius:14px;max-width:480px;width:100%;padding:24px 22px;box-shadow:0 0 50px rgba(255,217,112,0.5);font-family:STKaiti,KaiTi,serif;text-align:center">
      <div style="font-size:48px;margin-bottom:8px">⚔️✨</div>
      <h2 style="color:#ffd970;letter-spacing:4px;margin:0 0 8px;font-size:22px">弑神封印·称号解锁</h2>
      <div style="color:#bc8cff;font-size:13px;margin-bottom:16px;letter-spacing:1px">恭喜你通过弑神难度Boss试炼！</div>
      <div style="background:rgba(22,27,34,0.7);border:1px solid rgba(255,217,112,0.4);border-radius:10px;padding:14px;margin:10px 0;text-align:center">
        <div style="color:#ffd970;font-size:13px;margin-bottom:10px">✦ 你获得了特殊称号 ✦</div>
        <div style="color:#ffd970;font-size:24px;font-weight:bold;letter-spacing:6px;text-shadow:0 0 12px rgba(255,217,112,0.7);margin:8px 0">弑神者</div>
        <div style="color:#c9d1d9;font-size:12px;line-height:1.8;margin-top:8px">
          以凡躯斩神魂，以勇毅破神威<br>
          此后你的名字将永远铭刻于主菜单
        </div>
      </div>
      <div style="color:#daa520;font-size:12px;margin:10px 0;letter-spacing:1px">这是属于通关勇者的荣耀印记<br>难度选择界面将显示称号徽章</div>
      <button id="titleRevealCloseBtn" style="margin-top:14px;width:100%;padding:12px;background:linear-gradient(180deg,#ffd970,#d4a017);color:#1a0a2a;border:none;border-radius:8px;font-size:15px;font-weight:bold;letter-spacing:3px;cursor:pointer;font-family:STKaiti,KaiTi,serif">✦ 收下这份荣耀 ✦</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const closeBtn=document.getElementById('titleRevealCloseBtn');
  const closeFn=(e)=>{
    if(e&&e.preventDefault)e.preventDefault();
    const el=document.getElementById('titleRevealOverlay');
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
// （已移除图鉴作弊点击计数器）

// 每日签到系统
function _getTodayStr(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function _getYesterdayStr(){
  const d=new Date(); d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function _isCheckInAvailable(){
  return saveData.lastCheckInDate !== _getTodayStr();
}
function _renderDailyCheckIn(){
  const today=_getTodayStr();
  const available = saveData.lastCheckInDate !== today;
  const streak = saveData.checkInStreak || 0;
  if(available){
    // 今日可签到
    const yesterday = _getYesterdayStr();
    const willContinue = saveData.lastCheckInDate === yesterday;
    const newStreak = willContinue ? streak+1 : 1;
    // 奖励预览：基础200分+连续签到加成
    const scoreReward = 200 + Math.min(newStreak-1, 7) * 50; // 第1天200，每连续+50，最多第8天550
    return `<button id="dailyCheckInBtn" style="display:block;width:100%;max-width:460px;margin:0 auto 8px;padding:8px 14px;background:linear-gradient(135deg,#3a2a1a,#5a3a1a);border:2px solid #ffd700;border-radius:10px;color:#ffd970;font-size:13px;font-weight:bold;cursor:pointer;box-shadow:0 0 16px rgba(255,215,0,0.3);animation:pulse 2s infinite">
      🎁 每日签到 (第${newStreak}天) · 领取 ${scoreReward} 积分 + 随机装备
    </button>`;
  }else{
    // 今日已签到
    return `<div style="text-align:center;font-size:11px;color:#8b949e;margin:0 auto 6px;padding:4px 10px;background:rgba(22,27,34,0.6);border:1px solid #30363d;border-radius:6px;max-width:460px">
      ✓ 今日已签到 · 连续 ${streak} 天 · 明日再来
    </div>`;
  }
}
function claimDailyCheckIn(){
  if(!_isCheckInAvailable())return;
  const today=_getTodayStr();
  const yesterday=_getYesterdayStr();
  const willContinue = saveData.lastCheckInDate === yesterday;
  saveData.checkInStreak = willContinue ? (saveData.checkInStreak||0)+1 : 1;
  saveData.lastCheckInDate = today;
  const streak = saveData.checkInStreak;
  const scoreReward = 200 + Math.min(streak-1, 7) * 50;
  saveData.totalScore = (saveData.totalScore||0) + scoreReward;
  // 随机装备奖励（稀有度随连续天数递增）
  let rarity = 'common';
  if(streak>=7) rarity='epic';
  else if(streak>=4) rarity='rare';
  else if(streak>=2) rarity='rare';
  let bonusGear = null;
  try{
    if(typeof generateGear==='function'){
      const slot = (typeof GEAR_SLOTS!=='undefined') ? GEAR_SLOTS[Math.floor(Math.random()*GEAR_SLOTS.length)] : 'ring';
      bonusGear = generateGear(slot, rarity);
    }
  }catch(e){ bonusGear=null; }
  if(bonusGear){
    saveData.gearBag.push(bonusGear);
  }
  saveSave();
  // 弹窗提示
  const ov=document.getElementById('overlay');
  const wasHidden = ov.classList.contains('hidden');
  ov.classList.remove('hidden');
  const rarName = (typeof GEAR_RARITIES!=='undefined'&&GEAR_RARITIES[rarity]) ? GEAR_RARITIES[rarity].name : rarity;
  const rarColor = (typeof GEAR_RARITIES!=='undefined'&&GEAR_RARITIES[rarity]) ? GEAR_RARITIES[rarity].color : '#f0883e';
  ov.innerHTML=`
    <div style="text-align:center;max-width:480px;margin:auto">
      <h2 style="color:#ffd700;font-size:26px;text-shadow:0 0 18px rgba(255,215,0,0.6);margin-bottom:8px">🎁 每日签到</h2>
      <p style="color:#ffd970;font-size:15px;margin:6px 0">连续签到 第 ${streak} 天</p>
      <div style="background:rgba(13,10,5,0.85);border:1px solid rgba(255,215,0,0.3);border-radius:12px;padding:18px;margin:14px 0;line-height:1.9">
        <div style="color:#ffd970">✦ +${scoreReward} 积分</div>
        ${bonusGear?`<div style="color:${rarColor};margin-top:6px">✦ +1件 ${rarName}装备：${bonusGear.name||'神秘装备'}</div>`:''}
      </div>
      <p style="color:#8b949e;font-size:11px;margin:8px 0">连续签到7天可得史诗装备</p>
      <button class="main-btn" id="closeCheckInBtn" style="background:linear-gradient(135deg,#daa520,#ff8c00);font-size:14px;padding:8px 28px;margin-top:6px">✓ 收下</button>
    </div>
  `;
  _bindTap(document.getElementById('closeCheckInBtn'),()=>{
    ov.classList.add('hidden');
    showMainMenu();
  });
}
// ==================== 新手引导 ====================
// 首次进入游戏后展示4步基础引导：操作 / 5关制 / 装备天赋入口 / 每日签到
// 完成后设置 saveData.tutorialShown=true，不再弹窗
function showTutorial(force){
  if(!force && saveData.tutorialShown) return;
  // 等待其他欢迎覆盖层（开场故事/更新公告）关闭后再弹出，避免同时出现
  if(document.getElementById('storyOverlay') || document.getElementById('noticeOverlay')){
    setTimeout(()=>showTutorial(force), 300);
    return;
  }
  // 已存在引导覆盖层时不重复创建
  if(document.getElementById('tutorialOverlay')) return;
  const steps = [
    {
      icon: '🎮',
      title: '第一步 · 基础操作',
      bg: 'linear-gradient(180deg,#0a1a2a,#1a3a5a)',
      content: `
        <div style="color:#e0d8c8;font-size:13px;line-height:2;text-align:left;font-family:'STKaiti',KaiTi,serif">
          <div style="color:#79c0ff;font-size:14px;font-weight:bold;margin-bottom:8px">📱 手机端</div>
          <div>左半屏按下：<span style="color:#ffd970">移动</span></div>
          <div>右半屏按下：<span style="color:#ffd970">射击方向</span>（自动开火）</div>
          <div style="color:#58a6ff;font-size:11px;margin-top:2px">✨ 浮动摇杆：手指戳哪摇杆出现在哪，松手消失</div>
          <div>双手可同时操控，互不干扰</div>
          <div style="margin-top:10px;padding:8px 10px;background:rgba(255,215,0,0.1);border-left:3px solid #ffd970;border-radius:4px">
            <div style="color:#ffd970;font-weight:bold">🎯 右半屏按下不动 = 自动锁定最近敌人</div>
            <div style="color:#b0a090;font-size:11px;margin-top:2px">滑动手指 = 手动瞄准射击</div>
          </div>
          <div style="color:#79c0ff;font-size:14px;font-weight:bold;margin:14px 0 8px">💻 电脑端</div>
          <div>WASD / 方向键：移动</div>
          <div>鼠标移动：瞄准 · 自动开火</div>
          <div>ESC：暂停</div>
          <div style="color:#8b949e;font-size:11px;margin-top:10px">建议横屏游玩，体验更佳</div>
        </div>
      `
    },
    {
      icon: '🗺️',
      title: '第二步 · 关卡流程',
      bg: 'linear-gradient(180deg,#1a3a5a,#2a4a3a)',
      content: `
        <div style="color:#e0d8c8;font-size:13px;line-height:2;text-align:left;font-family:'STKaiti',KaiTi,serif">
          <div>每一关有 <span style="color:#ffd970">3 波小怪 + 1 个 Boss</span></div>
          <div>冒险模式共 <span style="color:#ffd970">5 关</span>，难度递增</div>
          <div>击败小怪掉落 <span style="color:#bc8cff">紫色经验球</span>，靠近自动拾取</div>
          <div>升级后获得 <span style="color:#ffd970">天赋点</span>，可在3选1强化中选技能</div>
          <div style="margin-top:10px;color:#ff6347;font-weight:bold">⚔️ 第5关后：最终Boss 刑天</div>
          <div style="color:#8b949e;font-size:11px">击败刑天后可进入 ♾️ 无尽模式</div>
          <div style="color:#8b949e;font-size:11px">也可跳过刑天直接挑战无尽</div>
        </div>
      `
    },
    {
      icon: '🎽',
      title: '第三步 · 装备与天赋',
      bg: 'linear-gradient(180deg,#2a4a3a,#3a2a4a)',
      content: `
        <div style="color:#e0d8c8;font-size:13px;line-height:2;text-align:left;font-family:'STKaiti',KaiTi,serif">
          <div style="color:#ffd970;font-weight:bold;margin-bottom:6px">🎒 背包</div>
          <div>查看/装备/合成装备</div>
          <div>3件同品质 → <span style="color:#58a6ff">50%</span> 合成更高一阶</div>
          <div style="color:#ffd970;font-weight:bold;margin:10px 0 6px">🧬 天赋</div>
          <div>消耗天赋点升级被动属性</div>
          <div>每升一级获得 <span style="color:#ffd970">2 天赋点</span></div>
          <div style="color:#ffd970;font-weight:bold;margin:10px 0 6px">🔮 魂器</div>
          <div>击败超级Boss掉落，局外装备</div>
          <div style="color:#8b949e;font-size:11px;margin-top:8px">5次未掉魂器后第6次必掉</div>
        </div>
      `
    },
    {
      icon: '🎁',
      title: '第四步 · 日常福利',
      bg: 'linear-gradient(180deg,#3a2a4a,#2a1a3a)',
      content: `
        <div style="color:#e0d8c8;font-size:13px;line-height:2;text-align:left;font-family:'STKaiti',KaiTi,serif">
          <div style="color:#ffd970;font-weight:bold;margin-bottom:6px">📅 每日签到</div>
          <div>每天可签到1次，连续签到奖励递增</div>
          <div>第7天起掉落 <span style="color:#bc8cff">史诗装备</span></div>
          <div style="color:#ffd970;font-weight:bold;margin:10px 0 6px">⭐ 训练等级</div>
          <div>累积经验升级局外等级</div>
          <div>每 <span style="color:#ffd970">1000 XP</span> 额外奖励 1 天赋点</div>
          <div style="color:#ffd970;font-weight:bold;margin:10px 0 6px">🏆 难度解锁</div>
          <div>通关当前难度试炼 → 解锁下一难度</div>
          <div style="color:#8b949e;font-size:11px;margin-top:10px">普通 → 困难 → 地狱 → 弑神</div>
        </div>
      `
    }
  ];
  let currentPage = 0;
  const totalPages = steps.length;
  const renderPage = () => {
    const s = steps[currentPage];
    const el = document.getElementById('tutorialOverlay');
    if(!el) return;
    el.style.background = s.bg;
    const contentEl = document.getElementById('tutorialContent');
    if(contentEl){
      contentEl.innerHTML = `
        <div style="font-size:48px;margin-bottom:12px;text-shadow:0 0 20px rgba(255,215,0,0.5)">${s.icon}</div>
        <h2 style="color:#ffd700;letter-spacing:3px;margin:0 0 18px;font-size:18px;font-family:'STKaiti',KaiTi,serif;text-shadow:0 0 10px rgba(255,215,0,0.4)">${s.title}</h2>
        <div style="background:rgba(0,0,0,0.4);border:1px solid rgba(212,160,23,0.3);border-radius:10px;padding:18px 20px">${s.content}</div>
      `;
    }
    const infoEl = document.getElementById('tutorialPageInfo');
    if(infoEl) infoEl.textContent = `${currentPage+1} / ${totalPages}`;
    const prevBtn = document.getElementById('tutorialPrevBtn');
    const nextBtn = document.getElementById('tutorialNextBtn');
    const doneBtn = document.getElementById('tutorialDoneBtn');
    if(prevBtn) prevBtn.style.display = (currentPage > 0) ? 'inline-block' : 'none';
    if(nextBtn) nextBtn.style.display = (currentPage < totalPages - 1) ? 'inline-block' : 'none';
    if(doneBtn) doneBtn.style.display = (currentPage === totalPages - 1) ? 'block' : 'none';
  };
  let html = `<div id="tutorialOverlay" style="position:fixed;inset:0;z-index:99997;display:flex;align-items:flex-start;justify-content:center;padding:16px;transition:background 0.6s;overflow-y:auto;-webkit-overflow-scrolling:touch">`;
  html += `<div style="max-width:480px;width:100%;text-align:center;padding:16px 12px 24px">`;
  html += `<div style="color:#ffd700;font-size:13px;letter-spacing:4px;margin-bottom:12px;font-family:'STKaiti',KaiTi,serif;text-shadow:0 0 8px rgba(255,215,0,0.4)">✦ 新手引导 ✦</div>`;
  html += `<div id="tutorialContent" style="min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start"></div>`;
  html += `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:12px">`;
  html += `<button id="tutorialPrevBtn" style="padding:8px 14px;background:rgba(22,27,34,0.7);color:#ffd970;border:1px solid rgba(212,160,23,0.5);border-radius:8px;cursor:pointer;font-size:12px;font-family:'STKaiti',KaiTi,serif">◀ 上一步</button>`;
  html += `<span id="tutorialPageInfo" style="color:#ffd970;font-size:11px;min-width:40px"></span>`;
  html += `<button id="tutorialNextBtn" style="padding:8px 14px;background:rgba(22,27,34,0.7);color:#ffd970;border:1px solid rgba(212,160,23,0.5);border-radius:8px;cursor:pointer;font-size:12px;font-family:'STKaiti',KaiTi,serif">下一步 ▶</button>`;
  html += `</div>`;
  html += `<button id="tutorialDoneBtn" style="display:none;margin-top:12px;width:100%;padding:12px;background:linear-gradient(135deg,#ffd970,#d4a020);color:#1a1f2e;border:none;border-radius:10px;font-size:15px;font-weight:bold;letter-spacing:2px;cursor:pointer;font-family:'STKaiti',KaiTi,serif;box-shadow:0 0 20px rgba(255,215,0,0.5)">⚔️ 开始游戏</button>`;
  html += `<button id="tutorialSkipBtn" style="margin-top:8px;padding:6px 16px;background:transparent;color:#8b949e;border:none;font-size:11px;cursor:pointer;font-family:'STKaiti',KaiTi,serif">跳过 ⏭</button>`;
  html += `</div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  renderPage();
  _bindTap(document.getElementById('tutorialPrevBtn'), () => { if(currentPage > 0){ currentPage--; renderPage(); } });
  _bindTap(document.getElementById('tutorialNextBtn'), () => { if(currentPage < totalPages - 1){ currentPage++; renderPage(); } });
  const closeFn = () => {
    const el = document.getElementById('tutorialOverlay');
    if(el) el.remove();
    saveData.tutorialShown = true;
    saveSave();
  };
  _bindTap(document.getElementById('tutorialDoneBtn'), closeFn);
  _bindTap(document.getElementById('tutorialSkipBtn'), closeFn);
}
function showMainMenu(){
  if(typeof _clearGameState==='function')_clearGameState(); // 清理 Android 后退键历史记录
  _runToken++; // 丢弃本局残留的 gameTimeout 回调，防止覆盖主菜单
  // 清理死亡动画定时器（兜底：showMainMenu 可被多路径调用）
  if(typeof deathTimeout!=='undefined' && deathTimeout){clearTimeout(deathTimeout); deathTimeout=null;}
  if(typeof deathAnimation!=='undefined')deathAnimation=null;
  // 清空摇杆/触摸状态（防御性：showMainMenu 可从多路径调用，确保不留残留）
  if(typeof resetTouchState==='function')resetTouchState();
  // 清理 #trialProgress（防止从 Boss 战暂停→返回主菜单时残留）
  const _tp=document.getElementById('trialProgress');
  if(_tp){_tp.style.display='none';_tp.textContent='';}
  if(_ui && _ui._lastProgress!==undefined)_ui._lastProgress='';
  gameState='menu';
  stopBGM(); // 返回主菜单时停止背景音乐
  // 计算各模块进度（用于功能按钮上的X/Y徽章）
  const _prog = _getModuleProgress();
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
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
            <span style="color:#ffd700;font-weight:bold;text-shadow:0 0 4px rgba(255,215,0,0.6)">🎖️ 训练等级 Lv.${playerLvl.level}</span>
            <span style="color:#8b949e">${playerLvl.inLevel}/${playerLvl.needed} XP</span>
          </div>
          <div style="height:7px;background:#1a1f2e;border-radius:4px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.6);position:relative">
            <div style="height:100%;width:${playerLvl.inLevel/playerLvl.needed*100}%;background:linear-gradient(90deg,#ffd700,#ff8c42);transition:width 0.5s;border-radius:4px;box-shadow:0 0 8px rgba(255,215,0,0.6)"></div>
          </div>
          <div style="text-align:center;font-size:10px;color:#8b949e;margin-top:2px">距下个天赋点：还差 ${1000-(saveData.totalXp%1000)} XP</div>
        </div>
      </div>
     </div>

     <div class="sj-col-right">
      <div class="menu-section">
        ${_renderDailyCheckIn()}
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
          <button class="action-btn" id="startBtn">⚔️ 开始冒险</button>
          <button class="action-btn trial" id="trialBtn">🐉 Boss试炼</button>
          <button class="action-btn endless" id="endlessBtn">♾️ 无尽模式 ${saveData.bestEndlessWave>0?`<span style="font-size:12px;opacity:0.9">最佳${saveData.bestEndlessWave}波</span>`:''}</button>
        </div>
        ${(saveData.pendingChests&&saveData.pendingChests.length>0)?`
        <div style="margin-top:8px;display:flex;justify-content:center">
          <button class="action-btn" id="chestBtn" style="background:linear-gradient(135deg,#cd7f32,#ffd700);font-size:15px;padding:12px 28px;min-height:44px;border:2px solid #ffd700;box-shadow:0 0 16px rgba(255,215,0,0.5);animation:pulseGlow 1.5s ease-in-out infinite">
            📦 开箱领奖 <span style="display:inline-block;background:#ff4444;color:#fff;border-radius:10px;padding:1px 8px;font-size:12px;margin-left:6px;box-shadow:0 0 6px rgba(255,68,68,0.8)">${saveData.pendingChests.length}</span>
          </button>
        </div>`:''}
        ${_renderDailyGoals()}
      </div>

      <div class="menu-section" style="margin-top:4px">
        <div class="btn-grid">
          <button class="feature-btn fb-gold ${_prog.talent.cur>=_prog.talent.total?'fb-complete':''}" id="talentBtn"><div class="fb-icon">🌟</div><div class="fb-name">天赋</div><div class="fb-tag">${_progressTag(_prog.talent.cur, _prog.talent.total, '强化属性')}</div></button>
          <button class="feature-btn fb-gold ${_prog.bag.cur>=_prog.bag.total?'fb-complete':''}" id="bagBtn" title="${_prog.bag.subs.map(s=>`${s.name}:${s.cur}/${s.total}`).join(' · ')}"><div class="fb-icon">🎒</div><div class="fb-name">背包</div><div class="fb-tag">${_progressTag(_prog.bag.cur, _prog.bag.total, '装备/武器/宠物')}</div></button>
          <button class="feature-btn fb-green ${_prog.ranch.cur>=_prog.ranch.total?'fb-complete':''}" id="ranchBtn"><div class="fb-icon">🐔</div><div class="fb-name">牧场</div><div class="fb-tag">${_progressTag(_prog.ranch.cur, _prog.ranch.total, '放养·产蛋')}</div></button>
          <button class="feature-btn fb-purple ${_prog.bond.cur>=_prog.bond.total?'fb-complete':''}" id="bondBtn"><div class="fb-icon">🔗</div><div class="fb-name">羁绊</div><div class="fb-tag">${_progressTag(_prog.bond.cur, _prog.bond.total, '被动加成')}</div></button>
          <button class="feature-btn fb-blue ${_prog.pedia.cur>=_prog.pedia.total?'fb-complete':''}" id="pediaBtn" title="${_prog.pedia.subs.map(s=>`${s.name}:${s.cur}/${s.total}`).join(' · ')}"><div class="fb-icon">📖</div><div class="fb-name">图鉴</div><div class="fb-tag">${_progressTag(_prog.pedia.cur, _prog.pedia.total, '成就记录')}</div></button>
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
        ${(!saveData.difficultyCleared||!saveData.difficultyCleared.godslayer)?`<div style="text-align:center;font-size:10px;color:#bc8cff;margin-top:4px;letter-spacing:1px">⚔️ 通关弑神难度Boss试炼解锁特殊称号！</div>`:''}
        ${saveData.titleGodslayer?`<div style="text-align:center;font-size:11px;color:#ffd970;margin-top:4px;letter-spacing:2px;text-shadow:0 0 6px rgba(255,217,112,0.5);font-weight:bold">⚔️ 弑神者 ⚔️</div>`:''}
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
      <div class="home-diff-row" style="display:flex;align-items:center;justify-content:center;gap:10px;margin:4px 0;flex-wrap:wrap">
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
  const _chestBtnEl=document.getElementById('chestBtn');
  if(_chestBtnEl)_bindTap(_chestBtnEl,openChestOverlay);
  _bindDailyGoalButtons();
  const _ciBtn=document.getElementById('dailyCheckInBtn');
  if(_ciBtn)_bindTap(_ciBtn,claimDailyCheckIn);
  _bindTap(document.getElementById('talentBtn'),showTalentMenu);
  _bindTap(document.getElementById('bagBtn'),showBagMenu);
  _bindTap(document.getElementById('ranchBtn'),showRanchMenu);
  _bindTap(document.getElementById('bondBtn'),showBondMenu);
  // 手机端新手指南按钮：跳转到图鉴的新手指南tab
  const _guideMobileBtn = document.getElementById('homeGuideMobileBtn');
  if(_guideMobileBtn){
    _bindTap(_guideMobileBtn, (e)=>{ if(e&&e.stopPropagation)e.stopPropagation(); showPediaMenu('guide'); });
  }
  // 图鉴按钮：直接打开图鉴
  const _pediaBtnEl=document.getElementById('pediaBtn');
  _bindTap(_pediaBtnEl,()=>{
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
  // 顶部固定栏：标题 + 积分 + 返回按钮（始终可见，无需滑动）
  let html=`<div style="position:sticky;top:0;z-index:10;background:linear-gradient(180deg,#0d1117 0%,#0d1117 90%,rgba(13,17,23,0) 100%);padding:8px 0 10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:10px">
    <div style="text-align:left;flex:1;min-width:0">
      <h2 style="margin:0;font-size:18px">🌟 天赋系统</h2>
      <p style="margin:2px 0 0;font-size:11px;color:#f0883e">天赋点: <b style="font-size:14px">${saveData.talentPoints}</b> · 已达成 ${xpMilestones} 里程碑</p>
    </div>
    <button class="sec-btn" id="backFromTalent" style="flex-shrink:0;font-size:14px;padding:8px 16px;min-height:44px">← 返回</button>
  </div>`;
  // 局外经验进度条（紧凑）
  html+=`<div style="max-width:600px;margin:0 auto 8px;padding:6px 10px;border:1px solid rgba(188,140,255,0.3);border-radius:6px;background:rgba(22,27,34,0.7)">
    <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px"><span style="color:#bc8cff">🏆 局外经验</span><span style="color:#8b949e">+${xpMilestones} 天赋点</span></div>
    <div style="height:6px;background:#1a1f2e;border-radius:3px;overflow:hidden"><div style="height:100%;width:${xpProgress/10}%;background:linear-gradient(90deg,#bc8cff,#ffd970);border-radius:3px"></div></div>
    <div style="text-align:center;font-size:10px;color:#8b949e;margin-top:2px">${xpProgress}/1000</div>
  </div>`;
  // 天赋分类：基础/辅助/高级（默认只展开基础，避免一屏塞不下）
  const groups = [
    { id:'basic', name:'⚔️ 基础天赋', talents: TALENTS.filter(t=>!t.branch) },
    { id:'support', name:'🔄 辅助天赋（二选一）', talents: TALENTS.filter(t=>t.branch==='辅助') },
    { id:'advanced', name:'💢 高级天赋（二选一）', talents: TALENTS.filter(t=>t.branch==='高级') },
  ];
  html+=`<div class="talent-grid" style="margin-bottom:6px">`;
  for(const t of groups[0].talents){
    const lv=getTalentLevel(t.id); const maxed=lv>=t.maxLevel; const afford=saveData.talentPoints>=t.costPerLevel;
    const stateClass=maxed?'maxed':(!afford?'unaffordable':'');
    const lockDisplay=maxed?'已满级':(t.costPerLevel+'点');
    html+=`<div class="talent-node ${stateClass}" data-talent="${t.id}" style="position:relative;padding:8px 6px;min-height:auto"><div class="talent-icon" style="font-size:22px;margin-bottom:2px">${t.icon}</div><div class="talent-name" style="font-size:11px;margin-bottom:2px">${t.name}</div><div class="talent-desc" style="font-size:9px;margin-bottom:3px;line-height:1.2">${t.desc}</div><div class="talent-level" style="font-size:10px">Lv.${lv}/${t.maxLevel}</div><div class="talent-cost" style="font-size:10px">${lockDisplay}</div></div>`;
  }
  html+=`</div>`;
  // 辅助/高级天赋：折叠（默认收起，玩家点击展开）
  for(let gi=1; gi<groups.length; gi++){
    const g = groups[gi];
    if(g.talents.length===0) continue;
    html+=`<details style="max-width:600px;margin:4px auto;padding:4px 10px;background:rgba(22,27,34,0.6);border:1px solid rgba(188,140,255,0.25);border-radius:6px">
      <summary style="cursor:pointer;color:#bc8cff;font-size:12px;letter-spacing:1px;padding:4px 0">${g.name}（点击展开）</summary>
      <div class="talent-grid" style="margin:6px 0">`;
    for(const t of g.talents){
      const lv=getTalentLevel(t.id); const maxed=lv>=t.maxLevel; const afford=saveData.talentPoints>=t.costPerLevel;
      let lockedByMutual=false; let lockHint='';
      if(t.exclusiveWith && getTalentLevel(t.exclusiveWith)>0){
        lockedByMutual=true;
        const other=TALENTS.find(x=>x.id===t.exclusiveWith);
        lockHint=`已选${other?other.name:t.exclusiveWith}`;
      }
      const advTag=t.advanced?'<span style="position:absolute;top:2px;right:4px;font-size:8px;color:#ff4444;background:rgba(255,68,68,0.15);padding:1px 3px;border-radius:2px">高级</span>':'';
      const stateClass=maxed?'maxed':(!afford||lockedByMutual?'unaffordable':'');
      const lockDisplay=maxed?'已满级':(lockedByMutual?lockHint:(t.costPerLevel+'点'));
      html+=`<div class="talent-node ${stateClass}" data-talent="${t.id}" style="position:relative;padding:8px 6px;min-height:auto;${lockedByMutual?'opacity:0.45;cursor:not-allowed':''}">${advTag}<div class="talent-icon" style="font-size:22px;margin-bottom:2px">${t.icon}</div><div class="talent-name" style="font-size:11px;margin-bottom:2px">${t.name}</div><div class="talent-desc" style="font-size:9px;margin-bottom:3px;line-height:1.2">${t.desc}</div><div class="talent-level" style="font-size:10px">Lv.${lv}/${t.maxLevel}</div><div class="talent-cost" style="font-size:10px">${lockDisplay}</div></div>`;
    }
    html+=`</div></details>`;
  }
  // 底部 sticky：重置 + 返回（始终可见）
  html+=`<div class="panel-actions" style="position:sticky;bottom:0;background:linear-gradient(180deg,rgba(13,10,8,0) 0%,rgba(13,10,8,0.92) 30%,rgba(13,10,8,0.98) 100%);padding:8px 0 6px;z-index:5;display:flex;gap:8px;justify-content:center;margin-top:6px">
    <button class="sec-btn" id="resetTalentsBtn" style="font-size:13px;padding:10px 16px;min-height:44px;border-color:#f0883e;color:#f0883e">🔄 重置天赋</button>
    <button class="sec-btn" id="backFromTalent2" style="font-size:13px;padding:10px 16px;min-height:44px">← 返回</button>
  </div>`;
  ov.innerHTML=html;
  // 恢复上次点击位置：避免玩家点完天赋后视图跳回顶部找不到原节点
  if(_talentMenuScrollTop)ov.scrollTop=_talentMenuScrollTop;
  // 高亮闪烁上次点击的节点：让玩家立即看到刚点过的位置
  if(_talentMenuLastId){
    const node=ov.querySelector(`.talent-node[data-talent="${_talentMenuLastId}"]`);
    if(node){
      // 如果节点在折叠的 <details> 内，自动展开（重渲染后 details 默认折叠）
      const parentDetails=node.closest('details');
      if(parentDetails && !parentDetails.open) parentDetails.open=true;
      // 等浏览器渲染展开后再滚动，否则 scrollIntoView 会按折叠状态算位置
      requestAnimationFrame(()=>{
        node.scrollIntoView({block:'center', behavior:'instant'});
        node.classList.add('talent-flash');
        setTimeout(()=>node.classList.remove('talent-flash'), 1500);
      });
    }
    _talentMenuLastId=null;
  }
  ov.querySelectorAll('.talent-node').forEach(el=>{
    _bindTap(el,()=>{
      const id=el.dataset.talent;
      // 记录点击的节点 id 和当前滚动位置，重渲染后恢复
      _talentMenuLastId=id;
      _talentMenuScrollTop=ov.scrollTop;
      if(upgradeTalent(id))showTalentMenu();
      else{
        _talentMenuLastId=null; // 升级失败不恢复高亮
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
    // 自定义确认弹窗（不用浏览器原生 confirm，避免破坏全屏）
    _confirmDialog('确定要重置所有天赋吗？将全额返还已消耗的天赋点。',
      ()=>{
        resetTalents();
        // 重置后清空位置记忆：避免重渲染后视图跳到错误位置
        _talentMenuLastId=null;
        _talentMenuScrollTop=0;
        showTalentMenu();
      },
      null,
      { title:'重置天赋', yesText:'确认重置', yesColor:'#f0883e' }
    );
  });
  _bindTap(document.getElementById('backFromTalent'),()=>{ov.classList.add('hidden');showMainMenu();});
  _bindTap(document.getElementById('backFromTalent2'),()=>{ov.classList.add('hidden');showMainMenu();});
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
  // 按 tier 升序展示（price=0且未拥有的武器为专属武器，不显示在商店中）
  const sorted=Object.entries(WEAPONS).sort((a,b)=>(a[1].tier||1)-(b[1].tier||1));
  const visibleList=sorted.filter(([id,w])=>{
    const owned=saveData.ownedWeapons[id]||0;
    return !(owned===0&&(w.price||0)===0&&id!=='pistol');
  });
  // 翻页：每页3把武器，横排显示（手机端友好，一行可见，无需滑动）
  const PAGE_SIZE=3;
  const pst=getPagedState('weapon',{page:1,pageSize:PAGE_SIZE});
  pst.pageSize=PAGE_SIZE; // 同步 pageSize（防止旧存档残留的 pageSize=4 导致翻页计算错误）
  pagedSetTotal('weapon', visibleList.length);
  if(pst.page>Math.max(1,Math.ceil(visibleList.length/PAGE_SIZE)))pst.page=1;
  const start=(pst.page-1)*PAGE_SIZE;
  const end=Math.min(start+PAGE_SIZE, visibleList.length);
  const pageItems=visibleList.slice(start,end);

  // 顶部固定栏：标题 + 积分 + 返回按钮（始终可见，无需滑动）
  let html=`<div style="position:sticky;top:0;z-index:10;background:linear-gradient(180deg,#0d1117 0%,#0d1117 90%,rgba(13,17,23,0) 100%);padding:8px 0 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:12px">
    <div style="text-align:left;flex:1;min-width:0">
      <h2 style="margin:0;font-size:18px">🔫 武器商店</h2>
      <p style="margin:2px 0 0;font-size:11px;color:#f0883e">积分: ${saveData.totalScore}</p>
    </div>
    <button class="sec-btn" id="backFromWeapon" style="flex-shrink:0;font-size:14px;padding:8px 16px;min-height:44px">← 返回</button>
  </div>`;

  // 当前页武器卡片：横排 flex 布局，每页3把，手机窄屏自动换行成2排
  html+='<div style="display:flex;flex-wrap:wrap;justify-content:center;align-items:stretch;gap:8px;margin-top:4px">';
  for(const[id,w]of pageItems){
    const owned=saveData.ownedWeapons[id]||0;
    const sel=saveData.currentWeapon===id;
    const stage=owned>0?getWeaponStage(id):0;
    const maxStage=WEAPON_STAGE_MULTI.length-1; // 2 -> 3阶段(0/1/2)
    const isMax=stage>=maxStage;
    const stats=`伤${w.bulletDamage} 速${(1/w.fireCooldown).toFixed(1)} 弹${w.bulletCount||1} 穿${w.pierce||0}`;
    const tierColor=['#8b949e','#3fb950','#58a6ff','#bc8cff','#ffd700'][Math.min(4,(w.tier||1)-1)];
    let actionHtml='';
    if(owned>0){
      if(isMax){
        actionHtml=`<p style="color:#ffd700;font-weight:bold;font-size:10px;margin:2px 0">满阶 ${'★'.repeat(stage+1)}</p>`;
      }else{
        const upPrice=w.upgradePrice*(stage+1);
        actionHtml=`<p style="color:#ffd700;font-size:10px;margin:2px 0">${stage+1}★</p><button class="sec-btn" data-buy-upgrade="${id}" style="margin-top:3px;font-size:10px;padding:3px 6px;min-height:30px">进阶 ${upPrice}分</button>`;
      }
    }else{
      actionHtml=`<p style="color:#8b949e;font-size:10px;margin:2px 0">未拥有</p><button class="main-btn" data-buy-weapon="${id}" style="margin-top:3px;font-size:10px;padding:3px 6px;min-height:30px;${saveData.totalScore>=(w.price||0)?'':'opacity:0.5'}">购买 ${w.price||0}分</button>`;
    }
    html+=`<div class="weapon-card ${sel?'selected':''} ${!owned?'locked':''}" data-weapon="${id}" style="position:relative;padding:8px 10px;margin:0;min-height:auto;flex:1 1 130px;max-width:180px;min-width:120px;box-sizing:border-box">
      <div style="position:absolute;top:3px;right:5px;font-size:9px;color:${tierColor};font-weight:bold">T${w.tier||1}</div>
      <div style="font-size:26px;line-height:1">${w.icon}</div>
      <h3 style="font-size:13px;margin:2px 0">${w.name}</h3>
      <p style="font-size:9px;color:#8b949e;margin:1px 0">${stats}</p>
      <p style="font-size:9px;color:#6e7681;margin:1px 0;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${w.desc||''}</p>
      ${actionHtml}
      <div style="font-size:8px;color:#8b949e;margin-top:1px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">${getCraftSummary(id)}</div>
      ${owned>0?'<p style="font-size:8px;color:#4a9b8e;margin-top:1px">点击装备</p>':''}
    </div>`;
  }
  html+='</div>';

  // 底部分页导航 + 返回键（sticky 固定，玩家无需滑动即可看到）
  html+=`<div class="panel-actions" style="position:sticky;bottom:0;background:linear-gradient(180deg,rgba(13,10,8,0) 0%,rgba(13,10,8,0.92) 30%,rgba(13,10,8,0.98) 100%);padding:10px 0 6px;z-index:5;display:flex;flex-direction:column;align-items:center;gap:6px">
    ${pagedNavHTML('weapon', visibleList.length, PAGE_SIZE, pst.page)}
  </div>`;

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
  // 翻页按钮绑定
  bindPagedNav(ov, ()=>showWeaponMenu());
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
      const reward=500+p.stage*250; // 高阶宠物回收给更多
      _confirmDialog(`确定回收 ${def.name} ★${p.stage+1}？获得 ${reward} 积分`,
        ()=>{
          saveData.totalScore+=reward;
          saveData.ownedPets.splice(idx,1);
          if(saveData.selectedPet===idx)saveData.selectedPet=null;
          else if(saveData.selectedPet!==null&&idx<saveData.selectedPet)saveData.selectedPet--;
          saveSave(); showPetMenu();
        },
        null,
        { title:'回收宠物', yesText:'确认回收', yesColor:'#f0883e' }
      );
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
      _confirmDialog(`确定回收 ${toRecycle.length} 只 ${def.name}（保留最高阶）？获得 ${reward} 积分`,
        ()=>{
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
        },
        null,
        { title:'批量回收', yesText:'确认回收', yesColor:'#f0883e' }
      );
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
// 装备分解回报：按稀有度给积分（定义在 save.js，这里仅注释说明）
// const GEAR_DECOMPOSE_REWARDS 已在 save.js 中定义
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
  let html=`<h2>🎽 装备背包</h2>`;
  // 积分数量显示（简化后只显示积分，原精魄已合并）
  html+=`<div style="text-align:center;margin:0 auto 8px;max-width:680px;padding:5px 10px;background:linear-gradient(90deg,rgba(212,160,23,0.1),rgba(255,217,112,0.1),rgba(212,160,23,0.1));border:1px solid #ffd970;border-radius:6px">
    <span style="color:#ffd970;font-size:13px;font-weight:bold;letter-spacing:1px">🪙 当前积分：${saveData.totalScore||0}</span>
    <span style="color:#8b949e;font-size:10px;margin-left:8px">分解装备获得 · 用于升阶/重铸</span>
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
    const _emptyMsg = saveData.gearBag.length===0 ? '背包空空如也，击败Boss获取装备！'
      : (gearFilterSlot ? `该部位暂无更多装备，<button class="sec-btn" data-filter-slot="" style="font-size:10px;padding:1px 6px;margin-left:4px">查看全部</button>` : '无符合条件的装备');
    html+=`<div style="grid-column:1/-1;color:#8b949e;text-align:center;padding:20px">${_emptyMsg}</div>`;
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
      html+=`<div style="background:#161b22;border:1px solid ${selected?'#ffd970':rc};border-left:3px solid ${rc};border-radius:5px;padding:6px;cursor:default;position:relative" data-equip="${g.uid}">
        ${_bossIcon?`<div style="position:absolute;top:2px;right:4px;font-size:14px;${_isBossMythic?'filter:drop-shadow(0 0 3px #ffd700)':''}" title="${_bossName}装备">${_bossIcon}</div>`:''}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:${rc};font-weight:bold;font-size:11px">${GEAR_SLOT_ICONS[g.slot]} ${g.name}${selected?' <span style="color:#ffd970">✓</span>':''}</span>
          <span style="color:#8b949e;font-size:9px">${GEAR_RARITIES[g.rarity].name}</span>
        </div>
        <div style="margin-top:3px">${(g.stats||[]).map(s=>_renderStatBar(s)).join('')}</div>
        ${g.specialAffix?`<div style="font-size:9px;color:${g.rarity==='mythic'?'#ff4444':'#ffd700'};margin-top:3px;padding:2px 4px;background:${g.rarity==='mythic'?'rgba(255,68,68,0.1)':'rgba(255,215,0,0.1)'};border-radius:3px;${_isBossMythic?'border:1px solid #ffd700;':''}">${g.specialAffix.icon} ${g.specialAffix.name}${_isBossMythic?' 👑':''}</div>`:''}
        ${_renderGearCompare(g)}
        <div style="display:flex;gap:2px;margin-top:3px;flex-wrap:wrap">
          <button data-equip-btn="${g.uid}" class="sec-btn" style="font-size:9px;padding:2px 8px;color:#58a6ff;border-color:#58a6ff;flex:1;min-height:28px">✓ 装备</button>
          ${canSynth?`<button data-synth-btn="1" data-rar="${g.rarity}" class="sec-btn" style="font-size:9px;padding:2px 6px;min-height:28px">${selected?'取消':'合成'}</button>`:''}
          ${g.rarity!=='mythic'?`<button data-ascend="${g.uid}" class="sec-btn" style="font-size:8px;padding:1px 4px;color:#bc8cff;border-color:#bc8cff;min-height:28px" title="消耗${GEAR_ASCEND_COST[g.rarity]}积分升阶">⬆${GEAR_ASCEND_COST[g.rarity]}分</button>`:''}
          <button data-decompose="${g.uid}" class="sec-btn" style="font-size:8px;padding:1px 4px;color:#f85149;border-color:#f85149;min-height:28px" title="分解获得${GEAR_DECOMPOSE_REWARDS[g.rarity]}积分">分+${GEAR_DECOMPOSE_REWARDS[g.rarity]}🪙</button>
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
    html+=`<button class="sec-btn" id="oneClickDecompose" style="font-size:9px;padding:1px 5px;color:#f85149;border-color:#f85149">🔥分解${decomposable.length}件+${totalReward}🪙</button>`;
  }
  html+=`</div>`;
  // ===== 词条重铸（紧凑横排，可折叠） =====
  const rerollable=saveData.gearBag.filter(g=>g.specialAffix && !g.specialAffix.bossAffix);
  if(rerollable.length>0){
    html+=`<details style="max-width:680px;margin:4px auto 0"><summary style="color:#bc8cff;font-size:11px;cursor:pointer">🔮 词条重铸 · ${rerollable.length}件可重铸（随机${GEAR_REFORGE_COST.random}分 / 定向${GEAR_REFORGE_COST.direct_legendary}分传说 / ${GEAR_REFORGE_COST.direct_mythic}分神话）</summary>`;
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
      if(saveData.equippedGear[slot]){
        saveData.gearBag.push(saveData.equippedGear[slot]);
        saveData.equippedGear[slot]=null;
        saveSave();
        // 卸下后自动按该部位筛选：玩家卸下头部后看到的全是头部装备，方便挑选替换
        gearFilterSlot=slot;
        // 清空合成/品质筛选，避免多重筛选导致看不到装备
        synthFilterRarity=null;
        selectedSynthUids=[];
        gearFilterRarity=null;
        // 重置页码：筛选变化时 getPagedState 内部会自动重置
        const _gst=getPagedState('gear');
        _gst.page=1;
        _gst._lastFilter=null; // 强制触发筛选变化重置
        showGearMenu();
      }
    });
  });
  // 装备按钮：独立的"装备"操作，不再和"加入合成"共用卡片点击
  // 修复 bug：之前点卡片既可能"装备"也可能"取消合成"，玩家以为装备失败
  ov.querySelectorAll('[data-equip-btn]').forEach(btn=>{
    _bindTap(btn,e=>{
      e.stopPropagation();
      const uid=btn.dataset.equipBtn;
      const idx=saveData.gearBag.findIndex(g=>String(g.uid)===String(uid));
      if(idx>=0){
        const g=saveData.gearBag.splice(idx,1)[0];
        // 该部位已有装备时，原装备自动回背包
        if(saveData.equippedGear[g.slot])saveData.gearBag.push(saveData.equippedGear[g.slot]);
        saveData.equippedGear[g.slot]=g; saveSave();
        // 装备后保持该部位筛选，方便继续看同部位装备
        gearFilterSlot=g.slot;
        const _gst=getPagedState('gear');
        _gst.page=1; _gst._lastFilter=null;
        // 装备成功提示
        flashMsg(`✓ 已装备 ${g.name}`);
      }
      showGearMenu();
    });
  });
  // 合成按钮：独立的"加入/取消合成组"操作
  ov.querySelectorAll('[data-synth-btn]').forEach(btn=>{
    _bindTap(btn,e=>{
      e.stopPropagation();
      const card=btn.closest('[data-equip]');
      const uid=card?card.dataset.equip:null;
      if(!uid)return;
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
  // 词条重铸：随机（只用积分支付）
  ov.querySelectorAll('[data-reroll]').forEach(btn=>{
    _bindTap(btn,()=>{
      const uid=btn.dataset.reroll; // 字符串比较，避免浮点数精度问题
      const g=saveData.gearBag.find(x=>String(x.uid)===String(uid));
      if(!g||!g.specialAffix)return;
      // 只用积分
      const cost=GEAR_REFORGE_COST.random;
      if((saveData.totalScore||0)<cost){
        showSynthResult({success:false,msg:`积分不足，需要${cost}积分`});
        return;
      }
      saveData.totalScore-=cost;
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
      rh+=`<div style="color:#8b949e;font-size:11px;margin-bottom:8px">当前：${g.specialAffix.icon} ${g.specialAffix.name}<br>消耗：${cost}积分</div>`;
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
        <div style="color:#ffd700;font-size:12px;margin-bottom:10px">消耗：${cost}积分</div>
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
      const uids=new Set(decomposable.map(g=>g.uid));
      saveData.gearBag=saveData.gearBag.filter(g=>!uids.has(g.uid));
      saveData.totalScore+=totalReward;
      saveSave();
      flashMsg(`🔥 已分解 ${decomposable.length}件装备，+${totalReward}积分`);
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
      saveData.gearBag.splice(idx,1);
      saveData.totalScore+=reward;
      // 同步清除合成选中
      const sidx=selectedSynthUids.findIndex(u=>String(u)===String(uid));
      if(sidx>=0)selectedSynthUids.splice(sidx,1);
      if(selectedSynthUids.length===0)synthFilterRarity=null;
      saveSave();
      flashMsg(`分解 ${g.name} +${reward}积分`);
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

