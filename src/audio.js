// ==================== 游戏状态 ====================
// 性能优化：触摸设备检测（必须在 ctx 之前定义，用于 shadow 劫持）
const IS_TOUCH_DEVICE = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
const SHADOW_ENABLED = !IS_TOUCH_DEVICE;
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
const bossHealthBar=document.getElementById('bossHealthBar');
const bossName=document.getElementById('bossName');
// 移动端 shadow 劫持：通过 setter 拦截强制置0，零侵入解决全部93处 shadow 赋值（最大发热源）
(function _initShadowOverride(){
  if(IS_TOUCH_DEVICE){
    try{
      let _val = 0;
      Object.defineProperty(ctx, 'shadowBlur', {
        get: ()=>_val,
        set: v=>{ _val = 0; },
        configurable: true
      });
    }catch(e){}
  }
})();

// ==================== 音效系统 (Web Audio API 程序化生成) ====================
let audioCtx=null;
let soundEnabled=true;
function initAudio(){
  if(audioCtx){
    // 已创建但可能被浏览器暂停(移动端自动播放策略),尝试恢复
    if(audioCtx.state==='suspended'){ audioCtx.resume().catch(()=>{}); }
    return;
  }
  try{
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    // 移动端浏览器需要用户交互后才能播放,首次创建时通常为suspended状态
    if(audioCtx.state==='suspended'){ audioCtx.resume().catch(()=>{}); }
  }catch(e){soundEnabled=false;}
}
// 全局监听首次用户交互,确保AudioContext被resume(解决移动端听不到声音问题)
let _audioResumeBound=false;
function _bindAudioResume(){
  if(_audioResumeBound)return;
  _audioResumeBound=true;
  const _resume=()=>{
    if(audioCtx && audioCtx.state==='suspended'){
      audioCtx.resume().catch(()=>{});
    }
  };
  // 各种交互事件都尝试resume
  ['touchstart','touchend','click','keydown','mousedown'].forEach(ev=>{
    document.addEventListener(ev, _resume, {passive:true, once:false});
  });
}
_bindAudioResume();
function playSound(type){
  if(!soundEnabled||!audioCtx)return;
  // 保险:如果audioCtx被暂停(移动端自动播放策略),尝试恢复
  if(audioCtx.state==='suspended'){ audioCtx.resume().catch(()=>{}); }
  const t=audioCtx.currentTime;
  const master=audioCtx.createGain();
  master.connect(audioCtx.destination);
  master.gain.value=0.9; // 主音量(再次提升,确保移动端能清楚听到)
  switch(type){
    case 'dragonRoar': { // 烛龙龙吼：低频咆哮+谐波
      const o1=audioCtx.createOscillator(),o2=audioCtx.createOscillator();
      const g=audioCtx.createGain();
      o1.type='sawtooth'; o2.type='square';
      o1.frequency.setValueAtTime(80,t); o1.frequency.exponentialRampToValueAtTime(40,t+0.8);
      o2.frequency.setValueAtTime(120,t); o2.frequency.exponentialRampToValueAtTime(60,t+0.8);
      g.gain.setValueAtTime(0.8,t); g.gain.exponentialRampToValueAtTime(0.01,t+1.2);
      o1.connect(g); o2.connect(g); g.connect(master);
      o1.start(t); o2.start(t); o1.stop(t+1.2); o2.stop(t+1.2);
      // 噪声层
      const noise=audioCtx.createBufferSource();
      const buf=audioCtx.createBuffer(1,4410,44100);
      const data=buf.getChannelData(0); for(let i=0;i<4410;i++)data[i]=(Math.random()*2-1)*0.5;
      noise.buffer=buf; const ng=audioCtx.createGain(); const filter=audioCtx.createBiquadFilter();
      filter.type='lowpass'; filter.frequency.value=200;
      ng.gain.setValueAtTime(0.45,t); ng.gain.exponentialRampToValueAtTime(0.01,t+1);
      noise.connect(filter); filter.connect(ng); ng.connect(master); noise.start(t);
      break;
    }
    case 'tigerRoar': { // 穷奇虎啸：中频吼叫
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sawtooth'; o.frequency.setValueAtTime(200,t); o.frequency.exponentialRampToValueAtTime(100,t+0.6);
      g.gain.setValueAtTime(0.65,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.8);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.8);
      break;
    }
    case 'devour': { // 饕餮吞噬：低频漩涡
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); const lfo=audioCtx.createOscillator(); const lfoG=audioCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(60,t); o.frequency.linearRampToValueAtTime(120,t+1);
      lfo.frequency.value=8; lfoG.gain.value=20; lfo.connect(lfoG); lfoG.connect(o.frequency);
      g.gain.setValueAtTime(0.55,t); g.gain.exponentialRampToValueAtTime(0.01,t+1.5);
      o.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t+1.5); lfo.stop(t+1.5);
      break;
    }
    case 'foxHowl': { // 九尾狐啸叫：高频
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(800,t); o.frequency.exponentialRampToValueAtTime(400,t+0.4);
      g.gain.setValueAtTime(0.42,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.6);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.6);
      break;
    }
    case 'birdScreech': { // 毕方鸟鸣
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='square'; o.frequency.setValueAtTime(1200,t); o.frequency.linearRampToValueAtTime(600,t+0.2); o.frequency.linearRampToValueAtTime(1000,t+0.4);
      g.gain.setValueAtTime(0.32,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.5);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.5);
      break;
    }
    case 'snakeHiss': { // 相柳蛇嘶
      const noise=audioCtx.createBufferSource();
      const buf=audioCtx.createBuffer(1,8820,44100);
      const data=buf.getChannelData(0); for(let i=0;i<8820;i++)data[i]=(Math.random()*2-1);
      noise.buffer=buf; const g=audioCtx.createGain(); const filter=audioCtx.createBiquadFilter();
      filter.type='highpass'; filter.frequency.value=3000;
      g.gain.setValueAtTime(0.42,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.8);
      noise.connect(filter); filter.connect(g); g.connect(master); noise.start(t);
      break;
    }
    case 'apeGrowl': { // 朱厌猿吼
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sawtooth'; o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(300,t+0.3); o.frequency.exponentialRampToValueAtTime(80,t+0.7);
      g.gain.setValueAtTime(0.55,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.8);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.8);
      break;
    }
    case 'windHowl': { // 英招风啸
      const noise=audioCtx.createBufferSource();
      const buf=audioCtx.createBuffer(1,22050,44100);
      const data=buf.getChannelData(0); for(let i=0;i<22050;i++)data[i]=(Math.random()*2-1)*0.5;
      noise.buffer=buf; const g=audioCtx.createGain(); const filter=audioCtx.createBiquadFilter();
      filter.type='bandpass'; filter.frequency.setValueAtTime(800,t); filter.frequency.linearRampToValueAtTime(400,t+1.5); filter.Q.value=5;
      g.gain.setValueAtTime(0.42,t); g.gain.linearRampToValueAtTime(0.55,t+0.5); g.gain.exponentialRampToValueAtTime(0.01,t+1.5);
      noise.connect(filter); filter.connect(g); g.connect(master); noise.start(t);
      break;
    }
    case 'waterSplash': { // 计蒙水柱
      const noise=audioCtx.createBufferSource();
      const buf=audioCtx.createBuffer(1,8820,44100);
      const data=buf.getChannelData(0); for(let i=0;i<8820;i++)data[i]=(Math.random()*2-1)*0.6;
      noise.buffer=buf; const g=audioCtx.createGain(); const filter=audioCtx.createBiquadFilter();
      filter.type='lowpass'; filter.frequency.setValueAtTime(2000,t); filter.frequency.exponentialRampToValueAtTime(500,t+0.5);
      g.gain.setValueAtTime(0.55,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.6);
      noise.connect(filter); filter.connect(g); g.connect(master); noise.start(t);
      break;
    }
    case 'bossSkill': { // Boss通用大招
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sawtooth'; o.frequency.setValueAtTime(100,t); o.frequency.exponentialRampToValueAtTime(300,t+0.3); o.frequency.exponentialRampToValueAtTime(50,t+0.8);
      g.gain.setValueAtTime(0.55,t); g.gain.exponentialRampToValueAtTime(0.01,t+1);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+1);
      break;
    }
    case 'hurt': { // 玩家受伤
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='square'; o.frequency.setValueAtTime(400,t); o.frequency.exponentialRampToValueAtTime(100,t+0.15);
      g.gain.setValueAtTime(0.55,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.2);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.2);
      break;
    }
    case 'heartbeat': { // 低血量心跳：双拍（咚-咚）
      const o1=audioCtx.createOscillator(),o2=audioCtx.createOscillator();
      const g1=audioCtx.createGain(),g2=audioCtx.createGain();
      o1.type='sine'; o1.frequency.setValueAtTime(60,t);
      g1.gain.setValueAtTime(0.45,t); g1.gain.exponentialRampToValueAtTime(0.01,t+0.15);
      o1.connect(g1); g1.connect(master); o1.start(t); o1.stop(t+0.15);
      o2.type='sine'; o2.frequency.setValueAtTime(55,t+0.18);
      g2.gain.setValueAtTime(0.38,t+0.18); g2.gain.exponentialRampToValueAtTime(0.01,t+0.33);
      o2.connect(g2); g2.connect(master); o2.start(t+0.18); o2.stop(t+0.33);
      break;
    }
    case 'death': { // 玩家死亡：爆炸
      const noise=audioCtx.createBufferSource();
      const buf=audioCtx.createBuffer(1,13230,44100);
      const data=buf.getChannelData(0); for(let i=0;i<13230;i++)data[i]=(Math.random()*2-1)*(1-i/13230);
      noise.buffer=buf; const g=audioCtx.createGain(); const filter=audioCtx.createBiquadFilter();
      filter.type='lowpass'; filter.frequency.setValueAtTime(3000,t); filter.frequency.exponentialRampToValueAtTime(100,t+0.5);
      g.gain.setValueAtTime(0.8,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.5);
      noise.connect(filter); filter.connect(g); g.connect(master); noise.start(t);
      const o=audioCtx.createOscillator(); const og=audioCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(200,t); o.frequency.exponentialRampToValueAtTime(30,t+0.5);
      og.gain.setValueAtTime(0.65,t); og.gain.exponentialRampToValueAtTime(0.01,t+0.5);
      o.connect(og); og.connect(master); o.start(t); o.stop(t+0.5);
      break;
    }
    case 'shoot': { // 射击
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='square'; o.frequency.setValueAtTime(800,t); o.frequency.exponentialRampToValueAtTime(200,t+0.05);
      g.gain.setValueAtTime(0.22,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.06);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.06);
      break;
    }
    case 'pickup': { // 拾取
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(600,t); o.frequency.exponentialRampToValueAtTime(1200,t+0.1);
      g.gain.setValueAtTime(0.22,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.15);
      break;
    }
    case 'levelUp': { // 升级/通关
      [523,659,784,1047].forEach((f,i)=>{
        const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
        o.type='sine'; o.frequency.value=f;
        g.gain.setValueAtTime(0,t+i*0.1); g.gain.linearRampToValueAtTime(0.3,t+i*0.1+0.02); g.gain.exponentialRampToValueAtTime(0.001,t+i*0.1+0.3);
        o.connect(g); g.connect(master); o.start(t+i*0.1); o.stop(t+i*0.1+0.3);
      });
      break;
    }
    case 'warning': { // Boss范围预警
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sine'; o.frequency.value=440;
      g.gain.setValueAtTime(0.3,t); g.gain.linearRampToValueAtTime(0.01,t+0.5);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.5);
      break;
    }
    case 'hit': { // 击中敌人：短促柔和的"啪"声
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(80,t+0.08);
      g.gain.setValueAtTime(0.28,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.08);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.08);
      // 加一点低通噪声增加质感
      const noise=audioCtx.createBufferSource();
      const buf=audioCtx.createBuffer(1,882,44100);
      const data=buf.getChannelData(0); for(let i=0;i<882;i++)data[i]=(Math.random()*2-1)*0.3;
      noise.buffer=buf; const ng=audioCtx.createGain(); const filter=audioCtx.createBiquadFilter();
      filter.type='lowpass'; filter.frequency.value=400;
      ng.gain.setValueAtTime(0.12,t); ng.gain.exponentialRampToValueAtTime(0.001,t+0.06);
      noise.connect(filter); filter.connect(ng); ng.connect(master); noise.start(t);
      break;
    }
    case 'kill': { // 击杀敌人：清脆"啵"声
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(440,t); o.frequency.exponentialRampToValueAtTime(220,t+0.12);
      g.gain.setValueAtTime(0.32,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.15);
      break;
    }
    case 'bossSpawn': { // Boss出场：低沉庄严的号角声
      const o1=audioCtx.createOscillator(),o2=audioCtx.createOscillator();
      const g=audioCtx.createGain();
      o1.type='sawtooth'; o2.type='triangle';
      o1.frequency.setValueAtTime(110,t); o1.frequency.linearRampToValueAtTime(55,t+1.5);
      o2.frequency.setValueAtTime(165,t); o2.frequency.linearRampToValueAtTime(82,t+1.5);
      g.gain.setValueAtTime(0.001,t); g.gain.linearRampToValueAtTime(0.5,t+0.1); g.gain.setValueAtTime(0.5,t+1.0); g.gain.exponentialRampToValueAtTime(0.001,t+1.8);
      o1.connect(g); o2.connect(g); g.connect(master);
      o1.start(t); o2.start(t); o1.stop(t+1.8); o2.stop(t+1.8);
      // 低频鼓点（200ms后播放）：存储 timer ID，stopBGM 时清理，避免死亡界面漏出鼓点
      if(_bossSpawnDrumTimer){clearTimeout(_bossSpawnDrumTimer); _bossSpawnDrumTimer=null;}
      _bossSpawnDrumTimer=setTimeout(()=>{
        _bossSpawnDrumTimer=null;
        if(!audioCtx||!bgmPlaying)return; // BGM已停止（玩家死亡/退出）则不播放鼓点
        const t2=audioCtx.currentTime;
        const o=audioCtx.createOscillator(); const og=audioCtx.createGain();
        o.type='sine'; o.frequency.setValueAtTime(60,t2); o.frequency.exponentialRampToValueAtTime(30,t2+0.3);
        og.gain.setValueAtTime(0.7,t2); og.gain.exponentialRampToValueAtTime(0.001,t2+0.4);
        o.connect(og); og.connect(master); o.start(t2); o.stop(t2+0.4);
      },200);
      break;
    }
    case 'bossHit': { // 击中Boss：低沉有力的"咚"声（比击中怪更厚实）
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(70,t+0.12);
      g.gain.setValueAtTime(0.55,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.12);
      // 加中频增加打击感
      const o2=audioCtx.createOscillator(); const g2=audioCtx.createGain();
      o2.type='triangle'; o2.frequency.setValueAtTime(420,t); o2.frequency.exponentialRampToValueAtTime(180,t+0.08);
      g2.gain.setValueAtTime(0.3,t); g2.gain.exponentialRampToValueAtTime(0.001,t+0.08);
      o2.connect(g2); g2.connect(master); o2.start(t); o2.stop(t+0.08);
      // 高频"啪"增加锐度
      const o3=audioCtx.createOscillator(); const g3=audioCtx.createGain();
      o3.type='square'; o3.frequency.setValueAtTime(880,t);
      g3.gain.setValueAtTime(0.15,t); g3.gain.exponentialRampToValueAtTime(0.001,t+0.04);
      o3.connect(g3); g3.connect(master); o3.start(t); o3.stop(t+0.04);
      break;
    }
    case 'explode': { // 爆炸：低频"轰"+ 高频"嘶"
      // 低频轰鸣
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(80,t); o.frequency.exponentialRampToValueAtTime(30,t+0.2);
      g.gain.setValueAtTime(0.35,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.2);
      // 高频嘶嘶（噪音模拟）
      const o2=audioCtx.createOscillator(); const g2=audioCtx.createGain();
      o2.type='sawtooth'; o2.frequency.setValueAtTime(1200,t); o2.frequency.exponentialRampToValueAtTime(200,t+0.12);
      g2.gain.setValueAtTime(0.15,t); g2.gain.exponentialRampToValueAtTime(0.001,t+0.12);
      o2.connect(g2); g2.connect(master); o2.start(t); o2.stop(t+0.12);
      break;
    }
  }
}

// ==================== 背景音乐系统 ====================

// 程序化生成的循环BGM：使用简单的五声音阶旋律 + 低音线，营造山海经古风氛围
let bgmGain=null, bgmNodes=[], bgmPlaying=false, bgmTimer=null, bgmMode='normal';
// bossSpawn 鼓点 setTimeout ID：stopBGM 时清理，避免死亡界面漏出鼓点
let _bossSpawnDrumTimer=null;
const BGM_SCALE=[261.63,293.66,329.63,392.00,440.00]; // C D E G A (中国五声音阶宫调)
const BGM_BASS=[130.81,146.83,164.81,196.00,220.00]; // 低音线
// 试炼激昂BGM：小调色彩 + 更快节奏 + 鼓点，营造紧张战斗氛围
const BGM_TRIAL_SCALE=[220.00,261.63,293.66,329.63,392.00]; // A C D E G (小调色彩)
const BGM_TRIAL_BASS=[110.00,130.81,146.83,164.81,196.00]; // 更低沉的低音

function startBGM(mode){
  if(!audioCtx)return;
  // 如果已在播放同模式BGM，不重启
  if(bgmPlaying&&bgmMode===mode)return;
  // 切换模式：先停旧BGM再启新BGM
  if(bgmPlaying){ stopBGMInternal(); }
  bgmPlaying=true;
  bgmMode=mode||'normal';
  bgmGain=audioCtx.createGain();
  bgmGain.gain.value=bgmMode==='trial'?0.22:0.20; // BGM音量(从0.14/0.12再次提升,确保移动端能听到)
  bgmGain.connect(audioCtx.destination);
  scheduleBGM();
}

function stopBGM(){
  bgmPlaying=false;
  if(bgmTimer){clearTimeout(bgmTimer); bgmTimer=null;}
  // 清理 bossSpawn 鼓点残留定时器，避免死亡界面/主菜单漏出鼓点
  if(_bossSpawnDrumTimer){clearTimeout(_bossSpawnDrumTimer); _bossSpawnDrumTimer=null;}
  for(const n of bgmNodes){try{n.stop();}catch(e){}}
  bgmNodes=[];
  if(bgmGain){try{bgmGain.disconnect();}catch(e){} bgmGain=null;}
}

// 内部停止（不重置bgmPlaying状态，用于模式切换）
function stopBGMInternal(){
  if(bgmTimer){clearTimeout(bgmTimer); bgmTimer=null;}
  for(const n of bgmNodes){try{n.stop();}catch(e){}}
  bgmNodes=[];
  if(bgmGain){try{bgmGain.disconnect();}catch(e){} bgmGain=null;}
}

function scheduleBGM(){
  if(!bgmPlaying||!audioCtx)return;
  // 切后台/标签页隐藏时 audioCtx 会被浏览器自动 suspend
  // 此时不应继续创建 oscillator 节点（否则 bgmNodes 数组持续累积导致内存泄漏，
  // 且 resume 后多个 setTimeout 回调堆积触发会让 BGM 重叠）
  if(audioCtx.state==='suspended'){
    bgmTimer=setTimeout(scheduleBGM, 500); // 慢轮询等待 resume
    return;
  }
  const t=audioCtx.currentTime;
  const isTrial=bgmMode==='trial';
  const beatLen=isTrial?0.35:0.5; // 试炼BPM更快（~170BPM vs 120BPM）
  const scale=isTrial?BGM_TRIAL_SCALE:BGM_SCALE;
  const bass=isTrial?BGM_TRIAL_BASS:BGM_BASS;
  // 主旋律：每拍一个音
  for(let i=0;i<4;i++){
    const noteFreq=scale[Math.floor(Math.random()*scale.length)];
    const noteStart=t+i*beatLen;
    const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
    o.type=isTrial?'square':'triangle'; // 试炼用方波更激烈
    o.frequency.value=noteFreq;
    g.gain.setValueAtTime(0,noteStart);
    g.gain.linearRampToValueAtTime(0.4,noteStart+0.05);
    g.gain.exponentialRampToValueAtTime(0.001,noteStart+beatLen*0.9);
    o.connect(g); g.connect(bgmGain);
    o.start(noteStart); o.stop(noteStart+beatLen);
    bgmNodes.push(o);
  }
  // 低音线：每2拍一个低音
  for(let i=0;i<2;i++){
    const noteFreq=bass[Math.floor(Math.random()*bass.length)];
    const noteStart=t+i*beatLen*2;
    const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
    o.type='sine'; o.frequency.value=noteFreq;
    g.gain.setValueAtTime(0,noteStart);
    g.gain.linearRampToValueAtTime(0.5,noteStart+0.1);
    g.gain.exponentialRampToValueAtTime(0.001,noteStart+beatLen*1.8);
    o.connect(g); g.connect(bgmGain);
    o.start(noteStart); o.stop(noteStart+beatLen*2);
    bgmNodes.push(o);
  }
  // 试炼模式：加鼓点（每拍一个低频鼓）
  if(isTrial){
    for(let i=0;i<4;i++){
      const noteStart=t+i*beatLen;
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(80,noteStart); o.frequency.exponentialRampToValueAtTime(40,noteStart+0.1);
      g.gain.setValueAtTime(0.3,noteStart); g.gain.exponentialRampToValueAtTime(0.001,noteStart+0.12);
      o.connect(g); g.connect(bgmGain);
      o.start(noteStart); o.stop(noteStart+0.12);
      bgmNodes.push(o);
    }
  }
  // 调度下一段
  bgmTimer=setTimeout(scheduleBGM,isTrial?1400:2000);
}
// Boss音效映射
function playBossSound(bossIdx){
  const sounds={0:'foxHowl',1:'birdScreech',2:'snakeHiss',3:'apeGrowl',4:'dragonRoar',5:'devour',6:'windHowl',7:'waterSplash',8:'tigerRoar',9:'bossSkill'};
  playSound(sounds[bossIdx]||'bossSkill');
}

