// ==================== 工具函数 ====================
// Fisher-Yates 洗牌算法，保证均匀随机分布
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

// 局外玩家等级（基于累积经验 totalXp，每 500 XP 升 1 级）
// 用于首页长期进度展示，与局内 xpLevel 不同
function getPlayerLevelInfo(){
  const xp=(saveData&&saveData.totalXp)||0;
  const needed=500;
  const level=Math.floor(xp/needed)+1;
  const inLevel=xp%needed;
  return {level,xp,inLevel,needed};
}

// ==================== 存档系统 ====================
let saveData = {
  version: 9,              // 存档版本号（用于增量迁移，须与 CURRENT_SAVE_VERSION 保持一致）
  totalScore: 0, talentPoints: 0, talents: {},
  // 局外经验系统：累积获得的总经验，每1000经验奖励1天赋点
  totalXp: 0, totalXpClaimed: 0, // totalXp: 累积经验；totalXpClaimed: 已兑换天赋点的经验量
  currentCharacter: 'default', unlockedCharacters: ['default'],
  ownedWeapons: { pistol: 1 }, currentWeapon: 'pistol',
  weaponCrafts: {},
  ownedPets: [], selectedPet: null,
  bonusClicks: 3,        // +300分按钮剩余次数（降低避免开局即可买顶级装备）
  difficulty: 'normal',  // normal/hard/hell/nightmare/godslayer
  difficultyCleared: { normal:false, hard:false, hell:false, nightmare:false, godslayer:false }, // 各难度Boss试炼通关标记（用于解锁后续难度）
  titleGodslayer: false, // 弑神难度试炼通关后解锁「弑神者」特殊称号
  ranchPets: [],         // 牧场中的宠物索引列表
  eggs: [],              // 蛋列表 {type:'normal'|'epic', def:bossIdx}
  // 装备系统
  equippedGear: { helmet:null, armor:null, boots:null, ring:null }, // 装备的装备槽
  gearBag: [],           // 装备背包（未装备的装备）
  // Boss图鉴与成就
  bossPedia: {},         // {bossIdx: {killed:true, killCount:n}}
  achievements: {},      // {achId: {unlocked:true, progress:n}}
  achievementFlags: { totalKills:0, totalBossKills:0, totalRuns:0, totalScore:0 }, // 成就追踪标志
  // 新系统
  bestEndlessWave: 0,    // 无尽模式最佳波次
  // 角色皮肤系统
  ownedSkins: [],        // 已拥有的皮肤ID列表
  equippedSkins: {},     // {characterId: skinId} 每个角色佩戴的皮肤
  // 魂器系统
  ownedArtifacts: [],    // 已获得的魂器bossIdx列表
  equippedArtifact: null, // 当前装备的魂器bossIdx
  artifactPityCounter: 0, // 魂器保底计数（5次未掉第6次必掉）
  // 每日签到系统
  lastCheckInDate: '',   // 上次签到日期 YYYY-MM-DD
  checkInStreak: 0,      // 连续签到天数
  tutorialShown: false,  // 是否已展示过新手教程
  aimTipShown: false,    // 是否已展示过自瞄提示（首次玩家专属）
  hasShanHaiBook: false, // 是否拥有山海故事书
  storyViewed: false,    // 是否已看过开场故事
  shanhaiPages: [],      // 已收集的山海残页（bossIdx列表，0-9）
  shanhaiPagesRewardClaimed: false, // 山海图卷奖励是否已发放
  gearEssence: 0,        // [已废弃] 装备精魄已合并到积分，保留字段为0兼容旧代码
  // 宝箱系统：局末按表现发放，主菜单开箱
  pendingChests: [],      // 待开宝箱列表 {quality, source, ts, runScore, runBossKills}
  chestHistory: {bronze:0, silver:0, gold:0, purple:0, orange:0}, // 历史开箱统计
  // 每日目标系统：每天3个目标，跨天重置
  dailyGoals: null,       // {date:'YYYY-MM-DD', goals:[{id,type,target,progress,claimed}], allClaimed:bool}
};

// ==================== 存档迁移函数表 ====================
// 每个版本对应一个迁移函数，从旧版本逐步升级到最新版本
const SAVE_MIGRATIONS = {
  // v0->v1: 旧存档没有 version 字段
  0: (d) => {
    // 迁移：删除已废弃的喷火枪，补偿等价积分
    if(d.ownedWeapons && d.ownedWeapons.flamethrower){
      const stage = d.ownedWeapons.flamethrower;
      delete d.ownedWeapons.flamethrower;
      if(d.weaponCrafts) delete d.weaponCrafts.flamethrower;
      if(d.currentWeapon === 'flamethrower') d.currentWeapon = 'pistol';
      d.totalScore = (d.totalScore || 0) + stage * 300;
    }
  },
  // v1->v2: 确保新字段存在
  1: (d) => {
    if(!d.ownedSkins) d.ownedSkins = [];
    if(!d.equippedSkins) d.equippedSkins = {};
    if(!d.ownedArtifacts) d.ownedArtifacts = [];
    if(d.equippedArtifact === undefined) d.equippedArtifact = null;
    if(!d.difficultyCleared) d.difficultyCleared = {normal:false, hard:false, hell:false, nightmare:false, godslayer:false};
    // 兼容旧存档：补 nightmare 字段
    if(d.difficultyCleared && d.difficultyCleared.nightmare===undefined) d.difficultyCleared.nightmare=false;
      if(d.titleGodslayer === undefined){
      // 兼容旧存档：曾通关弑神难度的玩家自动解锁称号
      d.titleGodslayer = !!(d.difficultyCleared && d.difficultyCleared.godslayer);
    }
    // 兼容旧存档：清理已废弃的 cheatRevealed 字段
    if('cheatRevealed' in d) delete d.cheatRevealed;
    if(d.storyViewed === undefined) d.storyViewed = false;
  },
  // v2->v3: 确保装备系统字段存在
  2: (d) => {
    if(!d.equippedGear) d.equippedGear = {helmet:null, armor:null, boots:null, ring:null};
    if(!d.gearBag) d.gearBag = [];
    if(!d.achievementFlags) d.achievementFlags = {totalKills:0, totalBossKills:0, totalRuns:0, totalScore:0};
    if(d.bestEndlessWave === undefined) d.bestEndlessWave = 0;
    if(!d.eggs) d.eggs = [];
    if(!d.ranchPets) d.ranchPets = [];
  },
  // v3->v4: 山海残页系统字段
  3: (d) => {
    if(!d.shanhaiPages) d.shanhaiPages = [];
  },
  // v4->v5: 山海图卷奖励标记 + 装备精魄
  4: (d) => {
    if(d.shanhaiPagesRewardClaimed === undefined) d.shanhaiPagesRewardClaimed = false;
    if(d.gearEssence === undefined) d.gearEssence = 0;
  },
  // v5->v6: 魂器保底计数器 + 每日签到 + 新手教程
  5: (d) => {
    if(d.artifactPityCounter === undefined) d.artifactPityCounter = 0;
    if(d.lastCheckInDate === undefined) d.lastCheckInDate = '';
    if(d.checkInStreak === undefined) d.checkInStreak = 0;
    if(d.tutorialShown === undefined) d.tutorialShown = false;
    if(d.aimTipShown === undefined) d.aimTipShown = false;
  },
  // v6->v7: 简化装备系统 — 把装备精魄按 1精魄=20分 折算合并到积分
  6: (d) => {
    const essence = d.gearEssence || 0;
    if(essence > 0){
      d.totalScore = (d.totalScore || 0) + essence * 20;
      console.log(`[存档] 装备精魄简化：${essence} 精魄 → ${essence * 20} 积分`);
    }
    d.gearEssence = 0; // 字段保留为0兼容，但不再使用
  },
  // v7->v8: 宝箱系统 + 每日目标字段
  7: (d) => {
    if(!d.pendingChests) d.pendingChests = [];
    if(!d.chestHistory) d.chestHistory = {bronze:0, silver:0, gold:0, purple:0, orange:0};
    if(d.dailyGoals === undefined) d.dailyGoals = null;
  },
  // v8->v9: 清档 — 重置所有进度数据，让玩家从干净状态开始测试
  // 保留：难度解锁（difficultyCleared）、称号（titleGodslayer）、山海残页（shanhaiPages）、剧情状态
  8: (d) => {
    console.log('[存档] v8->v9 清档：重置所有进度数据（保留难度解锁/称号/剧情收集）');
    d.totalScore = 0;
    d.talentPoints = 0;
    d.talents = {};
    d.totalXp = 0;
    d.totalXpClaimed = 0;
    d.ownedWeapons = { pistol: 1 };
    d.currentWeapon = 'pistol';
    d.weaponCrafts = {};
    d.ownedPets = [];
    d.selectedPet = null;
    d.bonusClicks = 3;
    d.ranchPets = [];
    d.eggs = [];
    d.equippedGear = { helmet:null, armor:null, boots:null, ring:null };
    d.gearBag = [];
    d.bossPedia = {};
    d.achievements = {};
    d.achievementFlags = { totalKills:0, totalBossKills:0, totalRuns:0, totalScore:0 };
    d.bestEndlessWave = 0;
    d.ownedSkins = [];
    d.equippedSkins = {};
    d.ownedArtifacts = [];
    d.equippedArtifact = null;
    d.artifactPityCounter = 0;
    d.pendingChests = [];
    d.chestHistory = { bronze:0, silver:0, gold:0, purple:0, orange:0 };
    d.dailyGoals = null;
    // 保留：difficultyCleared、titleGodslayer、shanhaiPages、shanhaiPagesRewardClaimed、
    //       hasShanHaiBook、storyViewed、lastCheckInDate、checkInStreak、tutorialShown
  },
  // 未来新增迁移在这里追加：
  // 9: (d) => { ... }
};
const CURRENT_SAVE_VERSION = 9;

// ==================== 本局统计（死亡复盘用） ====================
// 不存档，每次开始游戏时重置
let runStats = {
  kills: 0,            // 本局击杀数
  bossKills: 0,        // Boss击杀数
  damageDealt: 0,      // 总伤害输出
  damageTaken: 0,      // 总受伤量
  maxCombo: 0,         // 最高连击
  goldEarned: 0,       // 本局获得积分
  xpEarned: 0,         // 本局获得经验
  upgradesTaken: [],   // 选过的强化列表
  gearsDropped: 0,     // 掉落装备数
  deathCause: '未知',  // 死因：如"被九尾狐击杀"
  deathBy: null,       // 凶手：bossIdx 或 enemy type
  startTime: 0,        // 开始时间
  duration: 0,         // 局时长（秒）
  weaponUsed: 'pistol',// 使用武器
  characterUsed: 'default', // 使用角色
};
function resetRunStats(){
  runStats = {
    kills:0, bossKills:0, damageDealt:0, damageTaken:0,
    maxCombo:0, goldEarned:0, xpEarned:0,
    upgradesTaken:[], gearsDropped:0,
    deathCause:'未知', deathBy:null,
    startTime: Date.now(), duration:0,
    weaponUsed: saveData.currentWeapon || 'pistol',
    characterUsed: saveData.currentCharacter || 'default',
  };
}

// ==================== 山海残页系统（碎片化叙事） ====================
// 每个Boss掉落自己对应的残页，收集齐10页解锁山海图卷
const SHANHAI_PAGES = {
  0: { // 九尾狐
    title:'青丘之卷·九尾狐',
    original:'青丘之山，有兽焉，其状如狐而九尾，其音如婴儿，能食人；食者不蛊。',
    interpretation:'相传九尾狐生于青丘，叫声似婴啼，能魅惑人心。古人以为食其肉可避邪魅，殊不知魅惑之源正是它的本体。今人将其化为狐火幻影，便是制其本源之术。'
  },
  1: { // 毕方
    title:'章莪之卷·毕方',
    original:'章莪之山，有鸟焉，其状如鹤，一足，赤文青身而白喙，名曰毕方，见则其邑有讹火。',
    interpretation:'毕方一足而立，赤纹青身，出现之处必有火灾。世人皆惧其引火，却不知它本是火中精灵，以烈焰为食。若能御其火，便能燎原万里。'
  },
  2: { // 相柳
    title:'昆仑之卷·相柳',
    original:'共工之臣曰相柳氏，九首，以食于九山。相柳之所抵，厥为泽溪。禹杀相柳，其血腥，不可以树五谷种。',
    interpretation:'相柳九首，所到之处化为毒沼。大禹治水时斩之，其血腥臭，浸染之地寸草不生。它的剧毒至今仍留存于九蛇毒行靴中，可以毒攻毒。'
  },
  3: { // 朱厌
    title:'小次之卷·朱厌',
    original:'小次之山，有兽焉，其状如猿，而白首赤足，名曰朱厌，见则大兵。',
    interpretation:'朱厌白首赤足，形如巨猿，出现则天下大乱。它一怒可碎山裂石，古人视为战乱之兆。其金甲护体，正是为战而生之物。'
  },
  4: { // 烛龙
    title:'钟山之卷·烛龙',
    original:'钟山之神，名曰烛阴，视为昼，瞑为夜，吹为冬，呼为夏，不饮，不食，不息。其为物，人面，蛇身，赤色。',
    interpretation:'烛龙居钟山之下，睁眼为昼，闭眼为夜。它不饮不食不息，主宰光暗交替。其首盔之中封印着一缕烛龙之息，可于刹那间照亮幽冥。'
  },
  5: { // 饕餮
    title:'钩吾之卷·饕餮',
    original:'钩吾之山，有兽焉，其状如羊身人面，其目在腋下，虎齿人爪，其音如婴儿，名曰狍鸮，是食人。',
    interpretation:'饕餮羊身人面，目在腋下，虎齿人爪，贪食无厌。古青铜器常铸其形于鼎彝之上，以戒贪欲。然其吞噬之力若能御之，便化为吞噬之戒，万物皆可入口。'
  },
  6: { // 英招
    title:'槐江山·英招',
    original:'槐江之山，实惟帝之平圃，神英招司之，其状马身而人面，虎文而鸟翼，徇于四海，其音如榴。',
    interpretation:'英招马身人面，虎纹鸟翼，巡视四海。它速度无双，行如疾风，连飞鸟也追之不及。其疾行靴中封印着英招之风，穿之者步履轻盈如踏云端。'
  },
  7: { // 计蒙
    title:'光山之卷·计蒙',
    original:'光山，神计蒙处之，其状人身而龙首，恒游于漳渊，出入必有飘风暴雨。',
    interpretation:'计蒙人身龙首，居光山之中，出入必伴狂风暴雨。它能呼风唤雨，行云布霖。其玄袍之中蕴含雨帘之力，水汽护体，刀枪难入。'
  },
  8: { // 穷奇
    title:'邽山之卷·穷奇',
    original:'邽山，其上有兽焉，其状如牛，猬毛，名曰穷奇，音如獆狗，是食人。',
    interpretation:'穷奇状如牛而身披猬毛，声如獆狗，食人。它能撕裂维度制造混沌，世人闻之色变。其混沌虎冠能令子弹分裂，正是借用它撕裂维度的本源之力。'
  },
  9: { // 刑天
    title:'常羊之卷·刑天',
    original:'刑天与帝至此争神，帝断其首，葬之于常羊之山，乃以乳为目，以脐为口，操干戚以舞。',
    interpretation:'刑天与天帝争神，被斩首后葬于常羊山。它不甘失败，以乳为目，以脐为口，手持干戚继续战斗。陶渊明赞曰「刑天舞干戚，猛志固常在」。其战意不灭，化为干戚战甲，HP越低战意越炽。'
  }
};

function loadSave() {
  try {
    const s = localStorage.getItem('pixelShooterSave_v2');
    if (s) {
      let d;
      try {
        d = JSON.parse(s);
      } catch(parseErr) {
        // 存档JSON解析失败，尝试加载备份
        console.error('[存档] JSON解析失败，尝试备份:', parseErr);
        const backup = localStorage.getItem('pixelShooterSave_v2_backup');
        if(backup) {
          try {
            d = JSON.parse(backup);
            console.log('[存档] 已从备份恢复');
            _showSaveToast('存档损坏，已从备份恢复');
          } catch(backupErr) {
            console.error('[存档] 备份也解析失败，使用默认存档');
            _showSaveToast('存档损坏，已重置为新游戏');
            return; // 使用默认 saveData
          }
        } else {
          console.error('[存档] 无备份，使用默认存档');
          _showSaveToast('存档损坏，已重置为新游戏');
          return;
        }
      }
      // 先提取原始 version（在合并默认值之前），避免默认 version 覆盖旧存档的 version 字段
      // 旧存档（v0）没有 version 字段，若用默认值 5 覆盖会跳过所有迁移
      const originalVer = (d && typeof d.version === 'number') ? d.version : 0;
      // 合并默认值（确保新字段存在）
      d = { ...saveData, ...d };
      // 版本迁移：用原始 version 判断，而非合并后的（合并后总是默认值 5）
      let fromVer = originalVer;
      if(fromVer < CURRENT_SAVE_VERSION) {
        console.log(`[存档] 从版本 ${fromVer} 迁移到 ${CURRENT_SAVE_VERSION}`);
        // 迁移失败时记录已成功的最高版本号，下次启动可从该版本重试
        // 避免单步迁移失败导致版本号被强行提升、字段永久缺失
        let migratedTo = fromVer;
        for(let v = fromVer; v < CURRENT_SAVE_VERSION; v++) {
          if(SAVE_MIGRATIONS[v]) {
            try {
              SAVE_MIGRATIONS[v](d);
              console.log(`[存档] 迁移 v${v}->v${v+1} 完成`);
              migratedTo = v + 1;
            } catch(migErr) {
              console.error(`[存档] 迁移 v${v}->v${v+1} 失败，已保留版本号 v${migratedTo} 供下次重试:`, migErr);
              break;
            }
          } else {
            migratedTo = v + 1;
          }
        }
        d.version = migratedTo;
      }
      saveData = d;
    }
  } catch(e) {
    console.error('[存档] 加载失败:', e);
  }
}

// 存档保存：写入前先备份旧存档，失败时提示玩家
function saveSave() {
  try {
    // 先备份当前存档（如果存在）
    const old = localStorage.getItem('pixelShooterSave_v2');
    if(old) {
      try { localStorage.setItem('pixelShooterSave_v2_backup', old); } catch(e) {}
    }
    saveData.version = CURRENT_SAVE_VERSION;
    localStorage.setItem('pixelShooterSave_v2', JSON.stringify(saveData));
  } catch(e) {
    console.error('[存档] 保存失败:', e);
    if(e && e.name === 'QuotaExceededError') {
      _showSaveToast('存储空间已满，存档未保存！请清理浏览器数据');
    } else {
      _showSaveToast('存档保存失败，请截图联系开发者');
    }
  }
}

// 存档提示 Toast（轻量级，不依赖游戏UI状态）
let _saveToastTimer = null;
function _showSaveToast(msg) {
  let toast = document.getElementById('saveToast');
  if(!toast) {
    toast = document.createElement('div');
    toast.id = 'saveToast';
    toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(180,40,40,0.95);color:#fff;padding:16px 28px;border-radius:12px;font-size:15px;font-weight:bold;z-index:999999;text-align:center;max-width:80vw;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.display = 'block';
  if(_saveToastTimer) clearTimeout(_saveToastTimer);
  _saveToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

// ==================== 开场故事 ====================
function showOpeningStory(){
  // 首次进入游戏时弹出的主角背景故事
  const chapters = [
    {
      bg: 'linear-gradient(180deg,#0a0e1a,#1a2a3a)',
      icon: '🟢',
      title: '第一章 · 史莱姆的日常',
      text: '在山海世界的边缘，有一片宁静的幽谷。<br>谷中住着一只普通的史莱姆，<br>它没有名字，没有思想，<br>每天只是在林间缓缓蠕动，<br>啜饮晨露，吞食落叶。<br><br><span style="color:#8b949e;font-size:12px">——它不知道，命运即将改变。</span>'
    },
    {
      bg: 'linear-gradient(180deg,#1a2a3a,#3a2a1a)',
      icon: '✨',
      title: '第二章 · 金光降世',
      text: '某日黄昏，天穹忽然裂开一道金缝。<br>一道璀璨的金光自九天而降，<br>正落在史莱姆身上。<br><br>剧痛、灼热、然后是——<br><span style="color:#ffd700"><b>灵智初开</b></span>。<br><br>它第一次有了"我"的概念，<br>第一次看见了这个世界。'
    },
    {
      bg: 'linear-gradient(180deg,#3a2a1a,#2a1a0a)',
      icon: '📜',
      title: '第三章 · 神谕降临',
      text: '金光中传来一个庄严的声音：<br><br><span style="color:#ffd970;font-size:14px">"小生灵，你已得灵智。</span><br><span style="color:#ffd970;font-size:14px">山海九大异兽为祸苍生，</span><br><span style="color:#ffd970;font-size:14px">最终之敌·刑天更欲颠覆天道。</span><br><span style="color:#ffd970;font-size:14px">汝当踏上征途，将其一一斩之，</span><br><span style="color:#ffd970;font-size:14px">还山海以安宁。"</span><br><br>史莱姆望着自己透明的身躯，<br>它知道自己弱小，<br>但它点了点头。'
    },
    {
      bg: 'linear-gradient(180deg,#2a1a0a,#1a0a0a)',
      icon: '⚔️',
      title: '第四章 · 启程',
      text: '于是，一只小小的史莱姆，<br>踏上了斩杀山海经Boss的征途。<br><br>前方等待着它的，是——<br><span style="color:#bc8cff">九尾狐 · 毕方 · 相柳 · 朱厌</span><br><span style="color:#bc8cff">烛龙 · 饕餮 · 英招 · 计蒙 · 穷奇</span><br><br>以及最终的宿敌——<br><span style="color:#8b0000;font-size:16px"><b>刑天</b></span><br><br><span style="color:#ffd700">冒险，开始了。</span>'
    }
  ];
  let currentPage = 0;
  const totalPages = chapters.length;
  const renderPage = () => {
    const ch = chapters[currentPage];
    const el = document.getElementById('storyOverlay');
    if(!el)return;
    el.style.background = ch.bg;
    const contentEl = document.getElementById('storyContent');
    if(contentEl){
      contentEl.innerHTML = `
        <div style="font-size:min(8vw,36px);margin-bottom:4px;text-shadow:0 0 20px rgba(255,215,0,0.5)">${ch.icon}</div>
        <h2 style="color:#ffd700;letter-spacing:2px;margin:0 0 6px;font-size:min(4vw,16px);font-family:'STKaiti',KaiTi,serif;text-shadow:0 0 10px rgba(255,215,0,0.4)">${ch.title}</h2>
        <div style="color:#e0d8c8;font-size:min(3.2vw,13px);line-height:1.6;text-align:center;font-family:'STKaiti',KaiTi,serif;letter-spacing:0.5px">${ch.text}</div>
      `;
    }
    const infoEl = document.getElementById('storyPageInfo');
    if(infoEl) infoEl.textContent = `${currentPage+1} / ${totalPages}`;
    const prevBtn = document.getElementById('storyPrevBtn');
    const nextBtn = document.getElementById('storyNextBtn');
    const startBtn = document.getElementById('storyStartBtn');
    if(prevBtn) prevBtn.style.display = (currentPage > 0) ? 'inline-block' : 'none';
    if(nextBtn) nextBtn.style.display = (currentPage < totalPages - 1) ? 'inline-block' : 'none';
    if(startBtn) startBtn.style.display = (currentPage === totalPages - 1) ? 'block' : 'none';
  };
  let html = `<div id="storyOverlay" style="position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px;transition:background 0.6s">`;
  html += `<div style="max-width:480px;width:100%;height:100%;max-height:100vh;display:flex;flex-direction:column;text-align:center;padding:8px 10px;box-sizing:border-box">`;
  html += `<div id="storyContent" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow-y:auto;-webkit-overflow-scrolling:touch"></div>`;
  // 翻页按钮
  html += `<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 0;flex-shrink:0">`;
  html += `<button id="storyPrevBtn" style="padding:6px 12px;background:rgba(22,27,34,0.7);color:#ffd970;border:1px solid rgba(212,160,23,0.5);border-radius:6px;cursor:pointer;font-size:11px;font-family:'STKaiti',KaiTi,serif">◀ 上一页</button>`;
  html += `<span id="storyPageInfo" style="color:#ffd970;font-size:10px;min-width:35px"></span>`;
  html += `<button id="storyNextBtn" style="padding:6px 12px;background:rgba(22,27,34,0.7);color:#ffd970;border:1px solid rgba(212,160,23,0.5);border-radius:6px;cursor:pointer;font-size:11px;font-family:'STKaiti',KaiTi,serif">下一页 ▶</button>`;
  html += `</div>`;
  // 开始冒险按钮（最后一页）
  html += `<button id="storyStartBtn" style="display:none;margin-top:4px;width:100%;padding:10px;background:linear-gradient(135deg,#ffd970,#d4a020);color:#1a1f2e;border:none;border-radius:8px;font-size:min(3.5vw,15px);font-weight:bold;letter-spacing:1px;cursor:pointer;font-family:'STKaiti',KaiTi,serif;flex-shrink:0;box-shadow:0 0 20px rgba(255,215,0,0.5)">⚔️ 开始冒险</button>`;
  html += `<button id="storySkipBtn" style="margin-top:2px;padding:4px 12px;background:transparent;color:#8b949e;border:none;font-size:10px;cursor:pointer;font-family:'STKaiti',KaiTi,serif;flex-shrink:0">跳过 ⏭</button>`;
  html += `</div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  renderPage();
  _bindTap(document.getElementById('storyPrevBtn'), () => { if(currentPage > 0){ currentPage--; renderPage(); } });
  _bindTap(document.getElementById('storyNextBtn'), () => { if(currentPage < totalPages - 1){ currentPage++; renderPage(); } });
  const closeFn = () => {
    const el = document.getElementById('storyOverlay');
    if(el) el.remove();
    saveData.storyViewed = true;
    saveSave();
    // 故事关闭后显示更新公告(如果有)
    // 但首次玩家（tutorialShown=false）跳过公告，直接看新手教程，避免三连弹窗劝退
    if(saveData.tutorialShown){
      showUpdateNotice();
    }
  };
  _bindTap(document.getElementById('storyStartBtn'), closeFn);
  _bindTap(document.getElementById('storySkipBtn'), closeFn);
}

// ==================== 更新公告 ====================
const LATEST_NOTICE_VERSION = '2026-07-18-v3';
const NOTICE_CONTENT = [
  { icon: '🌟', title: '天赋系统扩展', desc: '新增「子弹反弹/子弹追踪」分支天赋和「战斗狂/愤怒」高级天赋，支持重置天赋返还点数。' },
  { icon: '📜', title: '装备词条说明', desc: '装备菜单新增专属词条功效总览，传说/神话词条效果一目了然。' },
  { icon: '🎁', title: '新手礼包升级', desc: '新手礼包内容加码，前期更快上手。' },
  { icon: '⚖️', title: '武器平衡调整', desc: '对所有武器进行了平衡性调整，让各梯度武器强度更合理。' },
  { icon: '🩸', title: '生存能力平衡', desc: '调整了吸血和护盾相关机制，让战斗更有节奏感。' },
  { icon: '🐉', title: 'Boss挑战调整', desc: 'Boss相关能力进行了平衡性调整，挑战体验更有层次。' },
  { icon: '🏠', title: '首页重新排版', desc: '首页布局优化，操作指南改为横向排列，视觉更清爽。' },
  { icon: '📖', title: '菜单翻页优化', desc: '图鉴/装备/宠物菜单改为翻页式，手机端切换更便捷。' },
  { icon: '📱', title: '手机端提示', desc: '黑屏旋转遮罩中新增iOS/安卓最佳使用方式说明。' },
  { icon: '🐛', title: 'Bug修复', desc: '修复了试炼跳关、复活失效、横扫范围异常等多个问题。' }
];
function showUpdateNotice() {
  try {
    const lastNotice = localStorage.getItem('pixelShooterNoticeVer') || '';
    if (lastNotice === LATEST_NOTICE_VERSION) return; // 已读最新公告
  } catch(e) { return; }
  // 翻页式公告（手机端友好，无需长拖）
  const PAGE_SIZE = 3; // 每页3条
  const totalPages = Math.max(1, Math.ceil(NOTICE_CONTENT.length / PAGE_SIZE));
  let currentPage = 1;
  const renderPage = () => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, NOTICE_CONTENT.length);
    let list = '';
    for (let i = start; i < end; i++) {
      const item = NOTICE_CONTENT[i];
      list += `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:rgba(22,27,34,0.7);border:1px solid rgba(212,160,23,0.3);border-radius:8px">`;
      list += `<div style="font-size:22px;flex-shrink:0">${item.icon}</div>`;
      list += `<div style="flex:1"><div style="color:#ffd970;font-size:14px;font-weight:bold;margin-bottom:4px">${item.title}</div><div style="color:#b0a090;font-size:12px;line-height:1.6">${item.desc}</div></div>`;
      list += `</div>`;
    }
    const contentEl = document.getElementById('noticeContent');
    if (contentEl) contentEl.innerHTML = list;
    const infoEl = document.getElementById('noticePageInfo');
    if (infoEl) infoEl.textContent = `第 ${currentPage}/${totalPages} 页`;
    const prevBtn = document.getElementById('noticePrevBtn');
    const nextBtn = document.getElementById('noticeNextBtn');
    if (prevBtn) prevBtn.disabled = (currentPage <= 1);
    if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);
    // 最后一页显示"进入游戏"按钮，其他页显示"下一页"
    const closeBtn = document.getElementById('noticeCloseBtn');
    if (closeBtn) closeBtn.style.display = (currentPage >= totalPages) ? 'block' : 'none';
    if (nextBtn) nextBtn.style.display = (currentPage < totalPages) ? 'block' : 'none';
  };
  let html = `<div id="noticeOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99998;display:flex;align-items:flex-start;justify-content:center;padding:16px;backdrop-filter:blur(6px);overflow-y:auto;-webkit-overflow-scrolling:touch">`;
  html += `<div style="background:linear-gradient(180deg,#1a1408,#2a1f10);border:2px solid #ffd700;border-radius:14px;max-width:520px;width:100%;max-height:90vh;padding:18px 20px;box-shadow:0 0 40px rgba(255,215,0,0.3);font-family:STKaiti,KaiTi,serif;display:flex;flex-direction:column">`;
  html += `<h2 style="color:#ffd700;text-align:center;letter-spacing:3px;margin:0 0 4px">📜 更新公告</h2>`;
  html += `<div style="text-align:center;color:#bc8cff;font-size:12px;margin-bottom:12px">版本 ${LATEST_NOTICE_VERSION} · 山海经·roug</div>`;
  html += `<div id="noticeContent" style="display:flex;flex-direction:column;gap:8px;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch"></div>`;
  // 翻页导航
  html += `<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px">`;
  html += `<button id="noticePrevBtn" class="pg-btn" style="min-width:80px;padding:8px 14px;font-size:13px;border-radius:8px;background:linear-gradient(180deg,#2a3142,#1a1f2e);border:1px solid rgba(212,160,23,0.5);color:#ffd970;cursor:pointer">◀ 上一页</button>`;
  html += `<span id="noticePageInfo" style="font-size:12px;color:#ffd970;padding:4px 10px;background:rgba(22,27,34,0.7);border:1px solid rgba(212,160,23,0.3);border-radius:6px;min-width:80px;text-align:center"></span>`;
  html += `<button id="noticeNextBtn" class="pg-btn" style="min-width:80px;padding:8px 14px;font-size:13px;border-radius:8px;background:linear-gradient(180deg,#2a3142,#1a1f2e);border:1px solid rgba(212,160,23,0.5);color:#ffd970;cursor:pointer">下一页 ▶</button>`;
  html += `</div>`;
  html += `<button id="noticeCloseBtn" style="margin-top:10px;width:100%;padding:10px;background:linear-gradient(180deg,#ffd970,#d4a020);color:#1a1f2e;border:none;border-radius:8px;font-size:15px;font-weight:bold;letter-spacing:2px;cursor:pointer;font-family:STKaiti,KaiTi,serif;display:none">✦ 已阅读，进入游戏 ✦</button>`;
  html += `</div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  renderPage();
  _bindTap(document.getElementById('noticePrevBtn'), () => { if (currentPage > 1) { currentPage--; renderPage(); } });
  _bindTap(document.getElementById('noticeNextBtn'), () => { if (currentPage < totalPages) { currentPage++; renderPage(); } });
  const closeFn = (e) => {
    if (e) e.preventDefault();
    const el = document.getElementById('noticeOverlay');
    if (el) el.remove();
    try { localStorage.setItem('pixelShooterNoticeVer', LATEST_NOTICE_VERSION); } catch(e) {}
  };
  const closeBtn = document.getElementById('noticeCloseBtn');
  closeBtn.addEventListener('click', closeFn);
  closeBtn.addEventListener('touchstart', closeFn, { passive: false });
}

// ==================== 配置 ====================
const CONFIG = {
  WIDTH: 1600, HEIGHT: 1000,
  PLAYER: { SIZE: 20, SPEED: 240, MAX_HEALTH: 8, MAX_SHIELD: 8, FIRE_COOLDOWN: 0.22, INVINCIBLE_TIME: 1.2, BULLET_SPEED: 520, BULLET_DAMAGE: 1, BULLET_SIZE: 5 },
  WAVES_PER_LEVEL: 5,
  LEVEL_TIME: 30, BOSS_TIME: 50,
  ENEMY_TYPES: {
    grunt:     { size: 16, speed: 140, health: 2, score: 6,  xp: 2, color: '#7fb069', shape: 'blob',     tier: 1 },  // 小妖：绿色史莱姆
    runner:    { size: 13, speed: 260, health: 2, score: 9,  xp: 2, color: '#8b5cf6', shape: 'imp',      tier: 1 },  // 魍魉：紫色小鬼
    tank:      { size: 24, speed: 90,  health: 6, score: 18, xp: 4, color: '#5c5c5c', shape: 'golem',    tier: 2 },  // 石灵：深灰石头人
    shooter:   { size: 18, speed: 105, health: 3, score: 15, xp: 3, color: '#7b3ff2', shape: 'shaman',   tier: 2, shoots: true, shootCooldown: 2.2 }, // 巫祝
    giant:     { size: 32, speed: 70,  health: 12,score: 38, xp: 8, color: '#a52838', shape: 'oni',      tier: 3 },  // 巨灵：红色鬼
    spiky:     { size: 20, speed: 190, health: 3, score: 14, xp: 3, color: '#ff6b9d', shape: 'spider',   tier: 2 },  // 蝎精
    invincible:{ size: 19, speed: 125, health: 5, score: 18, xp: 3, color: '#4fc3f7', shape: 'turtle',   tier: 2, invincibleTime: 3 }, // 玄龟
    taunt:     { size: 28, speed: 65,  health: 16,score: 34, xp: 8, color: '#8a7560', shape: 'troll',    tier: 3, taunt: true },  // 山魈
    bomber:    { size: 17, speed: 310, health: 2, score: 14, xp: 3, color: '#ff9248', shape: 'firechild',tier: 2, suicidal: true },  // 烈火童
    splitter:  { size: 38, speed: 60,  health: 30,score: 60, xp: 12,color: '#1a8a5c', shape: 'slime',    tier: 3, splits: 2, splitInto: 'splitterSmall' }, // 裂变巨怪
    splitterSmall: { size: 22, speed: 115, health: 8, score: 18, xp: 3, color: '#3cb371', shape: 'slime', tier: 2, splits: 2, splitInto: 'grunt' } // 分裂小怪
  }
};

// ==================== 难度系统 ====================
const DIFFICULTIES = {
  // waveHpGrow: 线性成长系数；waveHpGrow2: 平方项系数（后期加速）
  // HP公式：base × (1 + waveBonus×grow + waveBonus²×grow2) × enemyHpMul
  // 普通模式第8关第5波(waveBonus=39): 1+3.9+6.08=10.98倍血量（原仅2.95倍）
  normal:    { name:'普通', icon:'🌱', enemyHpMul:1.6, enemyDmgMul:1, enemyCountMul:1.5, enemySpdMul:1, bossHpMul:3.5, bossCount:1, bossAtkMul:1, bossTrialHpMul:2.5, color:'#3fb950', spawnIntervalMul:0.8, enemyArmor:0, waveHpGrow:0.12, waveHpGrow2:0.005, bossDmgCap:0 },
  hard:      { name:'困难', icon:'🔥', enemyHpMul:3, enemyDmgMul:1.8, enemyCountMul:1.6, enemySpdMul:1.3, bossHpMul:7, bossCount:1, bossAtkMul:1.4, bossTrialHpMul:3.5, color:'#f0883e', spawnIntervalMul:0.85, enemyArmor:0.1, waveHpGrow:0.13, waveHpGrow2:0.006, bossDmgCap:0.04 },
  hell:      { name:'地狱', icon:'💀', enemyHpMul:5.5, enemyDmgMul:2.8, enemyCountMul:2.2, enemySpdMul:1.6, bossHpMul:16, bossCount:1, bossAtkMul:1.8, bossTrialHpMul:5, color:'#f85149', spawnIntervalMul:0.7, enemyArmor:0.2, waveHpGrow:0.16, waveHpGrow2:0.008, bossDmgCap:0.03 },
  // 梦魇难度（地狱之上、弑神之下）：平滑过渡，避免地狱→弑神跨度太大劝退玩家
  nightmare: { name:'梦魇', icon:'👹', enemyHpMul:9, enemyDmgMul:4, enemyCountMul:3.5, enemySpdMul:2, bossHpMul:24, bossCount:1, bossAtkMul:2.2, bossTrialHpMul:5.5, color:'#a855f7', spawnIntervalMul:0.55, enemyArmor:0.28, waveHpGrow:0.18, waveHpGrow2:0.010, bossDmgCap:0.025 },
  godslayer: { name:'弑神', icon:'⚔️', enemyHpMul:18, enemyDmgMul:6, enemyCountMul:7, enemySpdMul:2.5, bossHpMul:40, bossCount:2, bossAtkMul:2.8, bossTrialHpMul:7, color:'#bc8cff', spawnIntervalMul:0.35, enemyArmor:0.35, waveHpGrow:0.22, waveHpGrow2:0.012, bossDmgCap:0.022 }
};
function getDifficulty(){ return DIFFICULTIES[saveData.difficulty]||DIFFICULTIES.normal; }
// ==================== 难度解锁系统 ====================
// 难度解锁顺序：normal → hard → hell → nightmare → godslayer
// 梦魇夹在地狱和弑神之间，提供平滑过渡
const DIFFICULTY_ORDER = ['normal','hard','hell','nightmare','godslayer'];
// 检查某难度是否已解锁（normal永远解锁，其他需通关前一难度的Boss试炼）
function isDifficultyUnlocked(key){
  if(key==='normal')return true;
  const idx=DIFFICULTY_ORDER.indexOf(key);
  if(idx<0)return false; // 未知 key 拒绝（避免 indexOf 返回 -1 时误判为已解锁）
  if(idx===0)return true;
  const prevKey=DIFFICULTY_ORDER[idx-1];
  return !!(saveData.difficultyCleared && saveData.difficultyCleared[prevKey]);
}
// 获取解锁某难度所需的提示文字
function getDifficultyUnlockHint(key){
  if(key==='normal')return '';
  const idx=DIFFICULTY_ORDER.indexOf(key);
  const prevKey=DIFFICULTY_ORDER[idx-1];
  const prevName=DIFFICULTIES[prevKey].name;
  return `需先通过${prevName}难度Boss试炼解锁`;
}

// ==================== 天赋 ====================
const TALENTS = [
  { id:'damage',name:'伤害强化',icon:'⚔️',desc:'子弹伤害+1',maxLevel:5,costPerLevel:1 },
  { id:'firerate',name:'射速强化',icon:'⚡',desc:'射击冷却-10%',maxLevel:5,costPerLevel:1 },
  { id:'health',name:'生命强化',icon:'❤️',desc:'最大生命+1',maxLevel:5,costPerLevel:1 },
  { id:'speed',name:'移速强化',icon:'👟',desc:'移动速度+8%',maxLevel:3,costPerLevel:1 },
  { id:'multishot',name:'多重射击',icon:'🎯',desc:'额外+1发子弹',maxLevel:2,costPerLevel:2 },
  { id:'pierce',name:'穿透强化',icon:'🏹',desc:'穿透+1敌人',maxLevel:3,costPerLevel:2 },
  { id:'crit',name:'暴击几率',icon:'💥',desc:'暴击率+10%',maxLevel:5,costPerLevel:1 },
  { id:'critdmg',name:'暴击伤害',icon:'🔥',desc:'暴击伤害+20%',maxLevel:3,costPerLevel:2 },
  { id:'regen',name:'生命回复',icon:'💚',desc:'每关开始回复+1',maxLevel:3,costPerLevel:2 },
  // 分支天赋（二选一）- 解决后期子弹分散打不到Boss的问题
  { id:'ricochet',name:'子弹反弹',icon:'🔄',desc:'子弹撞墙后反弹(每级+1次反弹)',maxLevel:2,costPerLevel:1,exclusiveWith:'homing',branch:'辅助' },
  { id:'homing',name:'子弹追踪',icon:'🧲',desc:'子弹追踪最近敌人(每级+1.5追踪强度)',maxLevel:2,costPerLevel:1,exclusiveWith:'ricochet',branch:'辅助' },
  // 高级天赋（二选一,2点）- 击中叠加层数,有上限,衰减
  { id:'frenzy',name:'战斗狂',icon:'💢',desc:'击中敌人叠加攻速(每层-3%,上限15%,1.5秒未击中衰减)',maxLevel:1,costPerLevel:2,exclusiveWith:'rage',branch:'高级',advanced:true },
  { id:'rage',name:'愤怒',icon:'😡',desc:'击中敌人叠加伤害(每层+3%,上限15%,1.5秒未击中衰减)',maxLevel:1,costPerLevel:2,exclusiveWith:'frenzy',branch:'高级',advanced:true }
];
function getTalentLevel(id){ return saveData.talents[id]||0; }
function getTalentBonus(id){ return getTalentLevel(id); }
function upgradeTalent(id){
  const t=TALENTS.find(t=>t.id===id); if(!t)return false;
  const lv=getTalentLevel(id); if(lv>=t.maxLevel)return false;
  if(saveData.talentPoints<t.costPerLevel)return false;
  // 互斥检查：如果已升级了对方天赋,则不允许升级
  if(t.exclusiveWith && getTalentLevel(t.exclusiveWith)>0)return false;
  saveData.talentPoints-=t.costPerLevel; saveData.talents[id]=lv+1; saveSave(); return true;
}
function resetTalents(){
  let c=0; for(const t of TALENTS){ c+=getTalentLevel(t.id)*t.costPerLevel; }
  saveData.talents={}; saveData.talentPoints+=c; saveSave();
}
function scoreToTalentPoints(s){ return Math.floor(s/400); }

// ==================== 角色 ====================
// 重排：T1神射手(免费)→T2忍者(800)→T3道士(1800)→T4武僧(3500)→T5巫祝(6000)→T6机关师(9000)
// 技能全面加强：CD缩短、效果增强、被动数值提升
const CHARACTERS = {
  default: { id:'default',name:'神射手',icon:'🎯',color:'#58a6ff',price:0,passive:'射速+30% 暴击+10%',skillName:'弹幕风暴',skillDesc:'发射一圈子弹(32发)+2秒攻速翻倍',skillCooldown:8,applyPassive:p=>{p.baseFireCooldown*=0.70;p.baseCritChance=(p.baseCritChance||0)+0.10;} },
  ninja:   { id:'ninja',name:'忍者',icon:'🥷',color:'#bc8cff',price:800,passive:'暴击率40% 暴伤+30%',skillName:'影分身',skillDesc:'召唤3个跟班攻击8秒',skillCooldown:12,applyPassive:p=>{p.baseCritChance=0.40;p.critDamage=(p.critDamage||2)+0.3;} },
  taoist:  { id:'taoist',name:'道士',icon:'☯',color:'#3fb950',price:1800,passive:'射程+40% 子弹+1穿透',skillName:'符箓阵',skillDesc:'召唤5张符箓环绕+穿透攻击',skillCooldown:10,applyPassive:p=>{p.bulletSpeed*=1.40;p.bulletPierce=(p.bulletPierce||0)+1;} },
  monk:    { id:'monk',name:'武僧',icon:'👊',color:'#f0883e',price:3500,passive:'生命+5 移速+20% 反伤3',skillName:'金刚护体',skillDesc:'6秒无敌+霸体+回满血',skillCooldown:14,applyPassive:p=>{p.maxHealth+=5;p.health+=5;p.speed*=1.20;p.thornsDmg=(p.thornsDmg||0)+3;} },
  shaman:  { id:'shaman',name:'巫祝',icon:'🔮',color:'#daa520',price:6000,passive:'普攻带冰冻+闪电链+灼烧',skillName:'元素乱舞',skillDesc:'释放元素风暴(冰冻+闪电链+火焰燃烧)·24发',skillCooldown:15,applyPassive:p=>{p.elementTiers=p.elementTiers||{};p.elementTiers.ice=Math.max(1,p.elementTiers.ice||0);p.elementTiers.lightning=Math.max(1,p.elementTiers.lightning||0);if(!p.elementEffects)p.elementEffects={};if(!p.elementEffects.ice)p.elementEffects.ice={slow:0.5,slowDur:2};if(!p.elementEffects.lightning)p.elementEffects.lightning={chain:1,chainRange:150,chainDmg:0.5};} },
  engineer:{ id:'engineer',name:'机关师',icon:'⚙️',color:'#8b949e',price:9000,passive:'子弹+1穿透 射速+15%',skillName:'机关炮台',skillDesc:'放置2座自动炮台12秒',skillCooldown:12,applyPassive:p=>{p.bulletPierce+=1;p.baseFireCooldown*=0.85;} }
};
// ==================== 角色皮肤系统 ====================
// 皮肤仅改变外观（颜色/光环），不影响属性
const SKINS = {
  // 神射手皮肤
  default_gold:    { id:'default_gold',    charId:'default', name:'金辉神射', icon:'✨', color:'#ffd700', rarity:'rare',      desc:'金色光环加身' },
  default_phantom: { id:'default_phantom', charId:'default', name:'幻影神射', icon:'👻', color:'#9d7aff', rarity:'epic',      desc:'紫色幻影特效' },
  default_inferno: { id:'default_inferno', charId:'default', name:'烈焰神射', icon:'🔥', color:'#ff6b35', rarity:'legendary', desc:'烈焰环绕' },
  // 忍者皮肤
  ninja_shadow:    { id:'ninja_shadow',    charId:'ninja',   name:'暗影忍者', icon:'🌑', color:'#2a2a3a', rarity:'rare',      desc:'潜行于暗影' },
  ninja_crimson:   { id:'ninja_crimson',   charId:'ninja',   name:'血樱忍者', icon:'🌸', color:'#ff4d6d', rarity:'epic',      desc:'血色樱花飘散' },
  ninja_celestial: { id:'ninja_celestial', charId:'ninja',   name:'天人忍者', icon:'🌟', color:'#fffacd', rarity:'legendary', desc:'天人合一' },
  // 道士皮肤
  taoist_jade:     { id:'taoist_jade',     charId:'taoist',  name:'青玉道士', icon:'💚', color:'#7fdfa1', rarity:'rare',      desc:'青玉符光' },
  taoist_spirit:   { id:'taoist_spirit',   charId:'taoist',  name:'通灵道士', icon:'🌀', color:'#8affd5', rarity:'epic',      desc:'通幽彻灵' },
  taoist_heaven:   { id:'taoist_heaven',   charId:'taoist',  name:'天师道尊', icon:'⛩️', color:'#ffd970', rarity:'legendary', desc:'代天行道' },
  // 武僧皮肤
  monk_iron:       { id:'monk_iron',       charId:'monk',    name:'铁衣武僧', icon:'🛡️', color:'#a8a8a8', rarity:'rare',      desc:'铁衣护身' },
  monk_drunk:      { id:'monk_drunk',      charId:'monk',    name:'醉拳武僧', icon:'🍷', color:'#daa520', rarity:'epic',      desc:'醉态飘逸' },
  monk_arhat:      { id:'monk_arhat',      charId:'monk',    name:'金刚罗汉', icon:'🙏', color:'#ffd700', rarity:'legendary', desc:'罗汉金身' },
  // 巫祝皮肤
  shaman_tribal:   { id:'shaman_tribal',   charId:'shaman',  name:'部族巫祝', icon:'🗿', color:'#cd853f', rarity:'rare',      desc:'部族传承' },
  shaman_storm:    { id:'shaman_storm',    charId:'shaman',  name:'风暴巫祝', icon:'🌪️', color:'#4a9b8e', rarity:'epic',      desc:'驾驭风暴' },
  shaman_god:      { id:'shaman_god',      charId:'shaman',  name:'神巫降临', icon:'👁️', color:'#fffacd', rarity:'legendary', desc:'神巫之眼' },
  // 机关师皮肤
  engineer_bronze: { id:'engineer_bronze', charId:'engineer',name:'青铜机关师', icon:'🔩', color:'#cd7f32', rarity:'rare',      desc:'青铜机巧' },
  engineer_steam:  { id:'engineer_steam',  charId:'engineer',name:'蒸汽机关师', icon:'💨', color:'#a8a8a8', rarity:'epic',      desc:'蒸汽动力' },
  engineer_master: { id:'engineer_master', charId:'engineer',name:'天工大师', icon:'🏆', color:'#ffd700', rarity:'legendary', desc:'天工开物' }
};
function getSkinsForChar(charId){ return Object.values(SKINS).filter(s=>s.charId===charId); }
function getEquippedSkin(){ const id=saveData.equippedSkins?.[saveData.currentCharacter]; return id?SKINS[id]:null; }
function getCurrentColor(){ const skin=getEquippedSkin(); return skin?skin.color:getCurrentCharacter().color; }
function getCurrentSkinIcon(){ const skin=getEquippedSkin(); return skin?skin.icon:getCurrentCharacter().icon; }
function getCurrentCharacter(){ return CHARACTERS[saveData.currentCharacter]||CHARACTERS.default; }
function unlockCharacter(id){
  const c=CHARACTERS[id]; if(!c||saveData.unlockedCharacters.includes(id))return false;
  if(saveData.totalScore<c.price)return false;
  saveData.totalScore-=c.price; saveData.unlockedCharacters.push(id); saveSave(); return true;
}
function selectCharacter(id){ if(!saveData.unlockedCharacters.includes(id))return false; saveData.currentCharacter=id; saveSave(); return true; }

// ==================== 武器系统 ====================
const WEAPONS = {
  pistol: { name:'手枪',icon:'🔫',bulletCount:1,bulletSize:4,bulletDamage:1.2,fireCooldown:0.22,bulletSpeed:520,pierce:0,spread:0,critBonus:0,price:0,upgradePrice:400,tier:1,desc:'均衡入门武器·单发直射' },
  bow: { name:'神臂弓',icon:'🏹',bulletCount:1,bulletSize:5,bulletDamage:1.5,fireCooldown:0.20,bulletSpeed:680,pierce:1,spread:0,critBonus:0.20,price:1200,upgradePrice:700,tier:2,desc:'快速高暴击穿透·箭矢形' },
  shotgun: { name:'散弹枪',icon:'💥',bulletCount:5,bulletSize:3,bulletDamage:1.4,fireCooldown:0.45,bulletSpeed:440,pierce:0,spread:0.35,critBonus:0.15,price:1800,upgradePrice:900,tier:2,desc:'近战散射5发·扇形喷射(贴脸爆发)' },
  hammer:{ name:'震天锤',icon:'🔨',bulletCount:3,bulletSize:11,bulletDamage:2.5,fireCooldown:0.75,bulletSpeed:300,pierce:2,spread:0.55,critBonus:0.05,price:3500,upgradePrice:1800,tier:3,desc:'慢速重击·命中范围爆炸(AOE)' },
  sniper: { name:'狙击枪',icon:'🎯',bulletCount:1,bulletSize:8,bulletDamage:5,fireCooldown:0.5,bulletSpeed:750,pierce:2,spread:0,critBonus:0.15,price:5000,upgradePrice:2500,tier:3,desc:'高伤远程穿透·细长光束' },
  voidbow:{ name:'虚空之弓',icon:'🌌',bulletCount:1,bulletSize:6,bulletDamage:2.8,fireCooldown:0.22,bulletSpeed:650,pierce:2,spread:0.08,critBonus:0.20,price:7000,upgradePrice:3500,tier:4,desc:'穿透+虚空裂缝持续伤害·终极武器' },
  crossbow:{ name:'诸葛连弩',icon:'🏹',bulletCount:3,bulletSize:4,bulletDamage:0.9,fireCooldown:0.19,bulletSpeed:600,pierce:1,spread:0.15,critBonus:0.10,price:9000,upgradePrice:4500,tier:4,desc:'三连发快速穿透·箭矢连射' },
  thunder:{ name:'雷神炮',icon:'⚡',bulletCount:1,bulletSize:7,bulletDamage:6.1,fireCooldown:0.35,bulletSpeed:700,pierce:3,spread:0,critBonus:0.25,price:14000,upgradePrice:7000,tier:5,desc:'闪电链攻击·命中后跳跃2个敌人·当前最强武器' },
  xingtiangeqi:{ name:'刑天干戚',icon:'⚔️',bulletCount:3,bulletSize:10,bulletDamage:9,fireCooldown:0.5,bulletSpeed:520,pierce:8,spread:0.28,critBonus:0.35,price:0,upgradePrice:12000,tier:7,desc:'最终Boss刑天专属·回旋干戚(飞出后折返)+击杀回血+战意增伤+血怒(残血伤害翻倍)+战魂护盾(命中叠加护盾)' }
};
const WEAPON_STAGE_MULTI = [
  { dmgMul:1.0, cdMul:1.0, extraPierce:0, extraBullet:0, sizeMul:1.0 },
  { dmgMul:1.15, cdMul:0.92, extraPierce:1, extraBullet:0, sizeMul:1.08 },
  { dmgMul:1.35, cdMul:0.85, extraPierce:1, extraBullet:0, sizeMul:1.15 }
];
function getWeaponStage(weaponId){ return Math.max(0,(saveData.ownedWeapons[weaponId]||0)-1); }
function getWeaponStats(weaponId){
  const w=WEAPONS[weaponId]; if(!w)return WEAPONS.pistol;
  const stage=getWeaponStage(weaponId); const m=WEAPON_STAGE_MULTI[stage];
  return {
    ...w,
    bulletDamage:w.bulletDamage?w.bulletDamage*m.dmgMul:0,
    fireCooldown:w.fireCooldown*m.cdMul,
    pierce:(w.pierce||0)+m.extraPierce,
    bulletCount:(w.bulletCount||1)+m.extraBullet,
    bulletSize:w.bulletSize?w.bulletSize*m.sizeMul:5,
    stage:stage
  };
}

// ==================== 特殊子弹技能（独立系统） ====================
const SPECIAL_ABILITIES = {
  fireball: { id:'fireball',name:'火球术',icon:'🔥',color:'#ff6b35',tiers:[
    {desc:'子弹命中后产生小范围爆炸，持续灼烧2秒',effect:{radius:50,burnDur:2,burnDmg:0.3}},
    {desc:'爆炸范围增大，灼烧3秒伤害提升',effect:{radius:75,burnDur:3,burnDmg:0.5}},
    {desc:'大范围爆炸，灼烧4秒，爆炸可连锁',effect:{radius:100,burnDur:4,burnDmg:0.8,chain:1}}
  ],finalUpgrade:{name:'地狱火',desc:'所有子弹附带火焰，命中产生大爆炸+持续灼烧+连锁'}},
  lightning: { id:'lightning',name:'雷击',icon:'⚡',color:'#ffd700',tiers:[
    {desc:'每3秒自动追踪最近敌人进行雷击(3伤害)',effect:{interval:3,damage:3,range:400}},
    {desc:'每2秒雷击，伤害5，可连锁1个',effect:{interval:2,damage:5,range:450,chain:1}},
    {desc:'每1.5秒雷击，伤害8，连锁2个',effect:{interval:1.5,damage:8,range:500,chain:2}}
  ],finalUpgrade:{name:'雷神降临',desc:'雷击范围全域，伤害翻倍，连锁4个'}},
  tornado: { id:'tornado',name:'龙卷风',icon:'🌪️',color:'#79c0ff',tiers:[
    {desc:'每5秒在玩家前方释放龙卷风，吸引并伤害敌人',effect:{interval:5,radius:70,damage:1,dur:3}},
    {desc:'龙卷风更大，伤害更高，持续4秒',effect:{interval:4,radius:100,damage:2,dur:4}},
    {desc:'龙卷风极大，伤害高，持续5秒',effect:{interval:3,radius:130,damage:3,dur:5}}
  ],finalUpgrade:{name:'风暴之眼',desc:'龙卷风持续全程，范围翻倍，伤害翻倍'}}
};

// ==================== 元素子弹（附加效果） ====================
const ELEMENT_UPGRADES = {
  ice: { id:'ice',name:'寒冰子弹',icon:'❄️',color:'#79c0ff',tiers:[
    {desc:'子弹减速20%持续1秒',effect:{slow:0.2,slowDur:1}},
    {desc:'减速40%持续1.5秒',effect:{slow:0.4,slowDur:1.5}},
    {desc:'减速60%持续2秒，15%冻结',effect:{slow:0.6,slowDur:2,freezeChance:0.15}}
  ],finalUpgrade:{name:'绝对零度',desc:'击杀被减速敌人时爆炸造成范围伤害'}},
  lightning: { id:'lightning',name:'闪电子弹',icon:'⚡',color:'#ffd700',tiers:[
    {desc:'命中连锁1个敌人(50%伤害)',effect:{chain:1,chainDmg:0.5,chainRange:120}},
    {desc:'连锁2个敌人(60%伤害)',effect:{chain:2,chainDmg:0.6,chainRange:140}},
    {desc:'连锁3个敌人(70%伤害)',effect:{chain:3,chainDmg:0.7,chainRange:160}}
  ],finalUpgrade:{name:'雷神之怒',desc:'连锁时触发雷暴范围伤害'}}
};

// ==================== 基础升级 ====================
// 全面优化：重命名更有特色，新增策略性选项，删除平淡无用的
// 移除护盾/回血类（玩家反馈太闷），改为攻击/机制类强化
const BASE_UPGRADES = [
  // === 普通（基础数值）===
  {id:'damage',name:'利刃',icon:'⚔️',desc:'子弹伤害+1',rarity:'common',apply:p=>p.bulletDamage+=1},
  {id:'firerate',name:'疾射',icon:'⚡',desc:'射击冷却-12%(递减)',rarity:'common',apply:p=>{
    // 射速叠加递减：第1次-12%，第2次-10%，第3次-8%，第4次-6%，第5次-4%
    // 防止后期无限叠加后射速过快导致手感无变化
    const cnt=(p._firerateCount||0);
    const reduction=0.12-cnt*0.02;
    if(reduction>=0.04){
      p.fireCooldown*=(1-reduction);
      p._firerateCount=cnt+1;
    }
  }},
  {id:'speed',name:'轻灵',icon:'👟',desc:'移动速度+12%(上限3次)',rarity:'common',apply:p=>{
    // 移速上限3次：避免玩家堆移速后完全无解风筝怪
    const cnt=(p._speedCount||0);
    if(cnt<3){
      p.speed*=1.12;
      p._speedCount=cnt+1;
    }
  }},
  {id:'health',name:'强韧',icon:'❤️',desc:'最大生命+2并回满',rarity:'common',apply:p=>{p.maxHealth+=2;p.health=p.maxHealth;}},
  {id:'bulletspeed',name:'风之祝福',icon:'💨',desc:'子弹速度+30%',rarity:'common',apply:p=>p.bulletSpeed*=1.30},
  {id:'magnet',name:'聚灵',icon:'🌀',desc:'拾取范围+100',rarity:'common',apply:p=>p.magnetRange=(p.magnetRange||120)+100},

  // === 稀有（机制增强）===
  {id:'multishot',name:'多重射击',icon:'🎯',desc:'额外+1发子弹(上限3次)',rarity:'rare',apply:p=>{
    // 多重射击上限3次：第4次开始无效果，避免子弹数超标
    const cnt=(p._multishotCount||0);
    if(cnt<3){
      p.bulletCount+=1;
      p.bulletSpread+=0.12;
      p._multishotCount=cnt+1;
    }
  }},
  {id:'pierce',name:'穿透',icon:'🏹',desc:'穿透+1敌人(上限3次)',rarity:'rare',apply:p=>{
    // 穿透上限3次：防止玩家堆穿透后所有怪一枪穿死
    const cnt=(p._pierceCount||0);
    if(cnt<3){
      p.bulletPierce+=1;
      p._pierceCount=cnt+1;
    }
  }},
  {id:'homing',name:'追踪',icon:'🧲',desc:'子弹轻微追踪',rarity:'rare',apply:p=>p.bulletHoming+=0.8},
  {id:'bigbullet',name:'巨型子弹',icon:'🔵',desc:'子弹更大+伤害1',rarity:'rare',apply:p=>{p.bulletSize+=4;p.bulletDamage+=1;}},
  {id:'crit',name:'暴击专精',icon:'💥',desc:'暴击率+12%(上限4次)',rarity:'rare',apply:p=>{
    // 暴击上限4次：防止玩家堆到100%暴击无脑红字
    const cnt=(p._critCount||0);
    if(cnt<4){
      p.critChance=(p.critChance||0)+0.12;
      p._critCount=cnt+1;
    }
  }},
  {id:'thorns',name:'反伤护甲',icon:'🌵',desc:'被撞反弹2伤害',rarity:'rare',apply:p=>p.thorns=(p.thorns||0)+2},
  {id:'explode',name:'爆破子弹',icon:'💢',desc:'子弹命中爆炸(范围伤害)',rarity:'rare',apply:p=>p.bulletExplode=(p.bulletExplode||0)+1},

  // === 史诗（强力机制）===
  {id:'bounce',name:'弹射',icon:'🔄',desc:'弹射+1次',rarity:'epic',apply:p=>p.bounce+=1},
  {id:'critdmg',name:'致命一击',icon:'🔥',desc:'暴击伤害+40%',rarity:'epic',apply:p=>p.critDamage=(p.critDamage||2)+0.4},
  {id:'minion',name:'召唤灵仆',icon:'👻',desc:'召唤一只永久灵仆助战(最多3只)',rarity:'epic',apply:p=>{
    const permanentCount=minions.filter(m=>m.permanent&&m.alive).length;
    if(permanentCount>=3){ // 达到上限：替换最老的永久灵仆
      const oldest=minions.find(m=>m.permanent&&m.alive);
      if(oldest){oldest.alive=false; spawnParticles(oldest.x,oldest.y,'#bc8cff',10);}
    }
    minions.push(new Minion(p.x,p.y,true));
  }},
  {id:'revive',name:'不死之身',icon:'💀',desc:'复活次数+1(半血复活，整局限2次)',rarity:'epic',apply:p=>{p.revives=(p.revives||0)+1; p._reviveUpgradesTaken=(p._reviveUpgradesTaken||0)+1;}}
];

function getAvailableUpgrades(){
  if(!player)return BASE_UPGRADES;
  const ups=BASE_UPGRADES.filter(u=>{
    // 不死之身：整局最多出现2次（避免无限复活堆叠超模）
    if(u.id==='revive'){
      const revivesOwned=player._reviveUpgradesTaken||0;
      if(revivesOwned>=2)return false;
    }
    // 多重射击：上限3次，达上限后不再出现
    if(u.id==='multishot'){
      const ms=(player._multishotCount||0);
      if(ms>=3)return false;
    }
    // 疾射：射速递减到4%以下后不再出现（已叠加5次）
    if(u.id==='firerate'){
      const fr=(player._firerateCount||0);
      if(fr>=5)return false;
    }
    // 移速：上限3次，达上限后不再出现
    if(u.id==='speed'){
      const sp=(player._speedCount||0);
      if(sp>=3)return false;
    }
    // 穿透：上限3次，达上限后不再出现
    if(u.id==='pierce'){
      const pc=(player._pierceCount||0);
      if(pc>=3)return false;
    }
    // 暴击：上限4次，达上限后不再出现
    if(u.id==='crit'){
      const cc=(player._critCount||0);
      if(cc>=4)return false;
    }
    return true;
  });
  // 元素子弹
  for(const[eid,el]of Object.entries(ELEMENT_UPGRADES)){
    const ct=player.elementTiers?.[eid]||0;
    if(ct<el.tiers.length){
      const tier=el.tiers[ct];
      ups.push({id:`${eid}_t${ct+1}`,name:`${el.name} Lv.${ct+1}`,icon:el.icon,desc:tier.desc,rarity:ct===2?'epic':'rare',element:eid,tier:ct+1,apply:p=>{if(!p.elementTiers)p.elementTiers={};p.elementTiers[eid]=ct+1;if(!p.elementEffects)p.elementEffects={};p.elementEffects[eid]=tier.effect;}});
    }else if(!player.finalUpgrades?.includes(eid)){
      ups.push({id:`${eid}_final`,name:el.finalUpgrade.name,icon:el.icon,desc:el.finalUpgrade.desc,rarity:'legendary',isFinal:true,element:eid,apply:p=>{if(!p.finalUpgrades)p.finalUpgrades=[];p.finalUpgrades.push(eid);}});
    }
  }
  // 特殊技能
  for(const[aid,ab]of Object.entries(SPECIAL_ABILITIES)){
    const ct=player.specialTiers?.[aid]||0;
    if(ct<ab.tiers.length){
      const tier=ab.tiers[ct];
      ups.push({id:`${aid}_t${ct+1}`,name:`${ab.name} Lv.${ct+1}`,icon:ab.icon,desc:tier.desc,rarity:ct===2?'epic':'rare',special:aid,tier:ct+1,apply:p=>{if(!p.specialTiers)p.specialTiers={};p.specialTiers[aid]=ct+1;if(!p.specialEffects)p.specialEffects={};p.specialEffects[aid]=tier.effect;}});
    }else if(!player.finalSpecials?.includes(aid)){
      ups.push({id:`${aid}_final`,name:ab.finalUpgrade.name,icon:ab.icon,desc:ab.finalUpgrade.desc,rarity:'legendary',isFinalSpecial:true,special:aid,apply:p=>{if(!p.finalSpecials)p.finalSpecials=[];p.finalSpecials.push(aid);}});
    }
  }
  return ups;
}

// ==================== 宠物系统 ====================
const BOSS_PET_DEFS = [
  // 普通Boss宝宝
  { bossIdx:0, name:'九尾狐崽', icon:'🦊', attack:'charm', isSuper:false, desc:'魅惑减速周围敌人', evoStats:[{dmgMul:1,rangeMul:1},{dmgMul:1.5,rangeMul:1.3},{dmgMul:2,rangeMul:1.6}] },
  { bossIdx:1, name:'毕方雏', icon:'🐦', attack:'fireRain', isSuper:false, desc:'天降火雨灼烧敌人', evoStats:[{dmgMul:1,count:3},{dmgMul:1.5,count:5},{dmgMul:2,count:8}] },
  { bossIdx:2, name:'相柳子', icon:'🐍', attack:'poison', isSuper:false, desc:'九头毒液范围攻击', evoStats:[{dmgMul:1,rangeMul:1},{dmgMul:1.5,rangeMul:1.3},{dmgMul:2,rangeMul:1.6}] },
  { bossIdx:3, name:'朱厌婴', icon:'🦍', attack:'rockThrow', isSuper:false, desc:'投掷巨石分裂攻击', evoStats:[{dmgMul:1,count:1},{dmgMul:1.5,count:2},{dmgMul:2,count:3}] },
  // 超级Boss宝宝
  { bossIdx:4, name:'烛龙幼', icon:'🐉', attack:'lava', isSuper:true, desc:'熔岩池持续范围伤害', evoStats:[{dmgMul:2,count:3},{dmgMul:3,count:5},{dmgMul:4,count:8}] },
  { bossIdx:5, name:'饕餮仔', icon:'👹', attack:'devour', isSuper:true, desc:'吞噬吸引并伤害敌人', evoStats:[{dmgMul:2,rangeMul:1},{dmgMul:3,rangeMul:1.5},{dmgMul:4,rangeMul:2}] },
  // 新增Boss宝宝
  { bossIdx:6, name:'英招雏', icon:'🦅', attack:'wind', isSuper:false, desc:'风刃切割多个敌人', evoStats:[{dmgMul:1,count:2},{dmgMul:1.5,count:3},{dmgMul:2,count:5}] },
  { bossIdx:7, name:'计蒙子', icon:'🐲', attack:'water', isSuper:false, desc:'水柱范围溅射攻击', evoStats:[{dmgMul:1,rangeMul:1},{dmgMul:1.5,rangeMul:1.3},{dmgMul:2,rangeMul:1.6}] },
  { bossIdx:8, name:'穷奇崽', icon:'🐅', attack:'chaos', isSuper:true, desc:'混沌弹幕追踪敌人', evoStats:[{dmgMul:2,count:3},{dmgMul:3,count:5},{dmgMul:4,count:8}] }
];
function getPetDef(bossIdx){ return BOSS_PET_DEFS.find(p=>p.bossIdx===bossIdx); }

// ==================== 魂器系统 ====================
const SOUL_ARTIFACTS = [
  { bossIdx:4, id:'zhulong', name:'烛龙魂器', icon:'🔥', color:'#ff6347', desc:'释放技能时召唤火焰风暴，在周围制造6个熔岩区域持续灼烧敌人', skillName:'焚天烈焰' },
  { bossIdx:5, id:'taotie', name:'饕餮魂器', icon:'🌀', color:'#9370db', desc:'释放技能时张开吞噬巨口，强拉拽周围敌人至中心，中心区域直接吞噬秒杀', skillName:'万象吞噬' },
  { bossIdx:8, id:'qiongqi', name:'穷奇魂器', icon:'🌌', color:'#a855f7', desc:'释放技能时撕开6道长条形维度裂缝，持续4秒造成范围伤害并喷出追踪维度弹', skillName:'维度裂隙' },
];
function getArtifactDef(bossIdx){ return SOUL_ARTIFACTS.find(a=>a.bossIdx===bossIdx); }
function getEquippedArtifact(){ return saveData.equippedArtifact!==null?getArtifactDef(saveData.equippedArtifact):null; }
// 魂器技能释放：在角色技能释放后调用
function triggerArtifactSkill(px,py){
  const art=getEquippedArtifact(); if(!art)return;
  if(art.bossIdx===4){
    // 烛龙魂器：焚天烈焰 — 向最近敌人发射8发追踪熔岩弹+落地熔岩池
    playSound('dragonRoar');
    pushFloatingText(px,py-50,'🔥 焚天烈焰!','#ff6347',1.5);
    spawnParticles(px,py,'#ff6347',30);
    // 找最近的敌人作为目标
    let targetX=px, targetY=py-200;
    let nearestD=1e9;
    for(const e of enemies){if(!e.alive)continue;const d=dist(px,py,e.x,e.y);if(d<nearestD){nearestD=d;targetX=e.x;targetY=e.y;}}
    if(boss&&boss.alive){const d=dist(px,py,boss.x,boss.y);if(d<nearestD){targetX=boss.x;targetY=boss.y;}}
    // 8发追踪熔岩弹向目标扇形发射
    const baseAngle=Math.atan2(targetY-py,targetX-px);
    for(let i=0;i<8;i++){
      const a=baseAngle+(i-3.5)*0.15;
      const b=new Bullet(px,py,a,{speed:420,damage:5,homing:2.5,size:6});
      b.life=2.5; b.isFire=true; b.color='#ff6347'; b.glowColor='#ffaa00';
      bullets.push(b);
    }
    // 在目标位置生成3个熔岩池
    for(let i=0;i<3;i++){
      const fx=targetX+rand(-60,60), fy=targetY+rand(-60,60);
      fireEffects.push({x:fx,y:fy,radius:65,damage:0.5,life:3,maxLife:3,burnDmg:1.0,tick:0,chain:0,lavaPool:true});
      for(const e of enemies){if(!e.alive)continue;if(dist(fx,fy,e.x,e.y)<65)e.takeDamage(4);}
      if(boss&&boss.alive&&dist(fx,fy,boss.x,boss.y)<65)boss.takeDamage(4);
    }
  }else if(art.bossIdx===5){
    // 饕餮魂器：万象吞噬 — 张合的吞噬巨口+持续强拉拽+中心吞噬秒杀
    // 主题差异化：饕餮=吞噬(单点圆心+巨口张合动画+强拉拽+中心秒杀)，区别于穷奇的维度裂隙(多道长条裂缝)
    playSound('devour');
    const cx=px,cy=py,r=260;
    pushFloatingText(cx,cy-50,'🌀 万象吞噬!','#9370db',2);
    spawnParticles(cx,cy,'#9370db',60);
    // 紫色漩涡(中等范围，强拉拽)
    fireEffects.push({x:cx,y:cy,radius:r,damage:1.5,life:5,maxLife:5,burnDmg:0,tick:0,chain:0,blackhole:true,devourMaw:true});
    // 5波拉拽+伤害(每0.5秒一次)，拉拽强度递增
    // 使用 gameTimeout 获得 _runToken 跨局竞态防护：玩家死亡/返回主菜单后旧回调被静默丢弃
    for(let wave=0;wave<5;wave++){
      gameTimeout(()=>{
        if(!player||!player.alive)return; // 玩家死亡后停止魂器脉冲，避免污染死亡画面/统计
        for(const e of enemies){
          if(!e.alive)continue;
          const d=dist(cx,cy,e.x,e.y);
          if(d<r){
            const a=Math.atan2(cy-e.y,cx-e.x);
            // 强拉拽：距离越近拉得越猛
            const pull=Math.min(160,(r-d)*0.75);
            e.x+=Math.cos(a)*pull; e.y+=Math.sin(a)*pull;
            // 中心40半径内直接吞噬(秒杀小怪)
            if(d<45){
              e.health=0; e.die(null);
              spawnParticles(e.x,e.y,'#9370db',20);
              pushFloatingText(e.x,e.y-15,'吞噬!','#9370db',0.8);
            }else{
              e.takeDamage(4+wave);
              spawnParticles(e.x,e.y,'#9370db',3);
            }
          }
        }
        if(boss&&boss.alive){
          const d=dist(cx,cy,boss.x,boss.y);
          if(d<r){
            const a=Math.atan2(cy-boss.y,cx-boss.x);
            // Boss不被拉拽太远(避免破坏战斗)，但仍受到伤害
            boss.x+=Math.cos(a)*30; boss.y+=Math.sin(a)*30;
            // 中心区域：Boss受到额外伤害
            if(d<60){
              boss.takeDamage(25);
              spawnParticles(boss.x,boss.y,'#9370db',18);
              pushFloatingText(boss.x,boss.y-30,'吞噬重伤!','#9370db',1);
            }else{
              boss.takeDamage(8);
            }
          }
        }
      },wave*500);
    }
  }else if(art.bossIdx===8){
    // 穷奇魂器：维度裂隙 — 在战场上撕开6道长条形空间裂缝，持续4秒
    // 主题差异化：穷奇=维度撕裂(多道长条裂缝+从裂缝中喷出追踪弹+击退)，区别于饕餮的圆形吞噬巨口
    playSound('tigerRoar');
    pushFloatingText(px,py-60,'🌌 维度裂隙!','#a855f7',3);
    spawnParticles(px,py,'#a855f7',60);
    screenShake=0.5;
    // 生成6道长条形维度裂缝(随机位置/角度)
    const rifts=[];
    for(let i=0;i<6;i++){
      const ang=Math.random()*Math.PI*2;
      // 裂缝中心点：环绕玩家120-280半径
      const cd=120+Math.random()*160;
      const cx=px+Math.cos(ang)*cd;
      const cy=py+Math.sin(ang)*cd;
      // 裂缝方向：垂直于到玩家的方向(让玩家不易完全躲避)
      const riftAng=ang+Math.PI/2+(Math.random()-0.5)*0.6;
      const riftLen=180+Math.random()*80; // 180-260长度
      const rift={x:cx,y:cy,angle:riftAng,length:riftLen,width:22,life:4,maxLife:4};
      rifts.push(rift);
      // 创建长条形fireEffect(用voidRift渲染但加入维度裂隙专属标记)
      fireEffects.push({
        x:cx,y:cy,radius:riftLen/2,damage:0,life:4,maxLife:4,burnDmg:0,tick:0,chain:0,
        voidRift:true,dimensionRift:true,riftAngle:riftAng,riftLength:riftLen,riftWidth:rift.width
      });
    }
    // 4波维度脉冲：每0.8秒对所有裂缝上的敌人造成伤害+从裂缝喷出追踪弹
    // 使用 gameTimeout 获得 _runToken 跨局竞态防护
    for(let wave=0;wave<4;wave++){
      gameTimeout(()=>{
        if(!player||!player.alive)return; // 玩家死亡后停止魂器脉冲，避免污染死亡画面/统计
        screenShake=0.3;
        for(const r of rifts){
          spawnParticles(r.x,r.y,'#a855f7',15);
          // 计算裂缝端点
          const dx=Math.cos(r.angle), dy=Math.sin(r.angle);
          const halfLen=r.length/2;
          // 对裂缝上所有敌人造成伤害
          for(const e of enemies){
            if(!e.alive)continue;
            // 点到线段距离
            const ex=e.x-r.x, ey=e.y-r.y;
            const proj=ex*dx+ey*dy; // 投影长度
            const clamped=Math.max(-halfLen,Math.min(halfLen,proj));
            const px2=r.x+dx*clamped, py2=r.y+dy*clamped;
            const d=dist(e.x,e.y,px2,py2);
            if(d<r.width+e.size){
              e.takeDamage(6+wave*2);
              spawnParticles(e.x,e.y,'#a855f7',6);
              // 维度击退(沿裂缝法线方向)
              const nx=-dy, ny=dx;
              const sign=Math.sign(ex*nx+ey*ny)||1;
              e.x+=nx*sign*40; e.y+=ny*sign*40;
            }
          }
          if(boss&&boss.alive){
            const ex=boss.x-r.x, ey=boss.y-r.y;
            const proj=ex*dx+ey*dy;
            const clamped=Math.max(-halfLen,Math.min(halfLen,proj));
            const px2=r.x+dx*clamped, py2=r.y+dy*clamped;
            const d=dist(boss.x,boss.y,px2,py2);
            if(d<r.width+boss.size){
              boss.takeDamage(12);
              spawnParticles(boss.x,boss.y,'#a855f7',10);
            }
          }
          // 从裂缝端点喷出2发追踪维度弹
          for(let s=-1;s<=1;s+=2){
            const sx=r.x+dx*halfLen*s, sy=r.y+dy*halfLen*s;
            // 找最近敌人
            let nearest=null,nd=400;
            for(const e of enemies){if(!e.alive)continue;const d=dist(sx,sy,e.x,e.y);if(d<nd){nd=d;nearest=e;}}
            if(boss&&boss.alive){const d=dist(sx,sy,boss.x,boss.y);if(d<nd*1.5)nearest=boss;}
            if(nearest){
              const ba=Math.atan2(nearest.y-sy,nearest.x-sx);
              const b=new Bullet(sx,sy,ba,{speed:380,damage:7,homing:3.5,size:8});
              b.life=4; b.isVoid=true; b.color='#a855f7'; b.glowColor='#da77f2';
              bullets.push(b);
            }else{
              // 无目标时沿裂缝法线发射
              const fa=r.angle+Math.PI/2;
              const b=new Bullet(sx,sy,fa,{speed:380,damage:7,size:8});
              b.life=3; b.isVoid=true; b.color='#a855f7'; b.glowColor='#da77f2';
              bullets.push(b);
            }
          }
        }
        pushFloatingText(px,py-30,`维度脉冲${wave+1}!`,'#a855f7',1);
      },wave*800);
    }
    // 额外：初始释放8发维度弹扇形(给玩家即时反馈)
    const initAng=Math.atan2(py,px);
    for(let i=0;i<8;i++){
      const a=initAng+(i-3.5)*0.18;
      const b=new Bullet(px,py,a,{speed:360,damage:6,homing:2.5,size:7});
      b.life=3; b.isVoid=true; b.color='#a855f7'; b.glowColor='#da77f2';
      bullets.push(b);
    }
  }
}

// ==================== 装备系统 ====================
const GEAR_SLOTS = ['helmet','armor','boots','ring'];
const GEAR_SLOT_NAMES = { helmet:'头盔', armor:'护甲', boots:'靴子', ring:'戒指' };
const GEAR_SLOT_ICONS = { helmet:'⛑️', armor:'🛡️', boots:'👢', ring:'💍' };
const GEAR_RARITIES = {
  common:    { name:'普通', color:'#8b949e', statCount:1, mul:1.0,  dropWeight:50 },
  rare:      { name:'稀有', color:'#58a6ff', statCount:2, mul:1.3,  dropWeight:30 },
  epic:      { name:'史诗', color:'#bc8cff', statCount:3, mul:1.6,  dropWeight:15 },
  legendary: { name:'传说', color:'#ffd700', statCount:4, mul:2.0,  dropWeight:5  },
  mythic:    { name:'神话', color:'#ff4444', statCount:5, mul:3.0,  dropWeight:0  }
};
const GEAR_RARITY_ORDER = ['common','rare','epic','legendary','mythic'];
// ==================== 装备精魄系统 ====================
// 分解装备按稀有度获得积分（已合并精魄到积分，1精魄≈20分折算）
const GEAR_DECOMPOSE_REWARDS = { common:50, rare:140, epic:340, legendary:800, mythic:2000 };
// 兼容旧代码：保留 GEAR_ESSENCE_REWARDS 为空对象，避免引用错误
const GEAR_ESSENCE_REWARDS = { common:0, rare:0, epic:0, legendary:0, mythic:0 };
// 定向重铸：选择指定词条替换（消耗积分）
// 随机重铸：300积分/次
const GEAR_REFORGE_COST = {
  random: 300,                // 随机重铸：300积分
  direct_legendary: 800,      // 定向传说词条：800积分
  direct_mythic:    2100,     // 定向神话词条：2100积分
};
// 装备升阶：消耗积分提升稀有度（神话不可升阶，Boss专属装备不可升阶）
const GEAR_ASCEND_COST = {
  common:    600,   // →rare
  rare:      1500,  // →epic
  epic:      3000,  // →legendary
  legendary: 6000,  // →mythic（普通神话，非Boss专属）
};
const GEAR_NAMES = {
  helmet: ['玄铁盔','鹿角冠','凤羽帽','龙鳞兜','星辰冠','盘古盔'],
  armor:  ['兽皮甲','锁子甲','灵丝袍','龙鳞铠','天蚕宝衣','混沌战甲'],
  boots:  ['草鞋','风行靴','灵鹿足','龙翼靴','缩地靴','踏碎虚空'],
  ring:   ['木戒','灵玉戒','九尾环','龙纹戒','乾坤戒','创世之戒']
};
// 装备属性池
const GEAR_STAT_POOL = [
  { id:'damage',   name:'伤害',   icon:'⚔️', min:1, max:2, apply:(p,v)=>p.bulletDamage+=v },
  { id:'maxhp',    name:'生命',   icon:'❤️', min:1, max:2, apply:(p,v)=>{p.maxHealth+=v;p.health+=v;} },
  { id:'speed',    name:'移速',   icon:'👟', min:3, max:10, apply:(p,v)=>p.speed+=v },
  { id:'firerate', name:'射速',   icon:'⚡', min:0.03, max:0.08, apply:(p,v)=>p.baseFireCooldown*=(1-v) },
  { id:'crit',     name:'暴击率', icon:'💥', min:0.03, max:0.10, apply:(p,v)=>p.critChance+=v },
  { id:'critdmg',  name:'暴击伤害',icon:'🔥', min:0.2, max:0.5, apply:(p,v)=>p.critDamage+=v },
  { id:'pierce',   name:'穿透',   icon:'🏹', min:1, max:1, apply:(p,v)=>p.bulletPierce+=v },
  { id:'shield',   name:'护盾',   icon:'🛡️', min:1, max:2, apply:(p,v)=>{p.shield+=v;p.maxShield+=v;} },
  { id:'regen',    name:'回血/关',icon:'💚', min:1, max:2, apply:(p,v)=>p.regenPerLevel=(p.regenPerLevel||0)+v }
  // 吸血已从装备词条中移除，仅神话套装(4件红装)给一点点
];
// 传说(金)专属词条池 - 新颖机制而非纯数值
const GEAR_LEGENDARY_AFFIXES = [
  { id:'burn',   name:'灼烧附魔', icon:'🔥', desc:'子弹附带灼烧伤害', apply:(p)=>{if(!p.specialEffects)p.specialEffects={};if(!p.specialEffects.fireball)p.specialEffects.fireball={radius:40,burnDmg:0.5,burnDur:2,chain:0};else p.specialEffects.fireball.burnDmg+=0.3;} },
  { id:'thorns', name:'荆棘反伤', icon:'🌵', desc:'受击反弹伤害', apply:(p)=>p.thornsDmg=(p.thornsDmg||0)+1 },
  { id:'shieldregen', name:'护盾再生', icon:'🔄', desc:'每关恢复护盾', apply:(p)=>p.shieldRegen=(p.shieldRegen||0)+1 },
  { id:'pierce_all', name:'穿透强化', icon:'🏹', desc:'子弹额外穿透', apply:(p)=>p.bulletPierce+=2 },
  { id:'magnet', name:'磁力范围', icon:'🧲', desc:'拾取范围大幅增加', apply:(p)=>p.magnetRange=(p.magnetRange||120)+120 },
  { id:'dodge',  name:'闪避', icon:'💨', desc:'15%几率闪避伤害', apply:(p)=>p.dodgeChance=(p.dodgeChance||0)+0.15 }
];
// 神话(红)专属词条池 - 更强大的独特效果
const GEAR_MYTHIC_AFFIXES = [
  { id:'lightning', name:'闪电链', icon:'⚡', desc:'子弹触发闪电链', apply:(p)=>{if(!p.elementEffects)p.elementEffects={};if(!p.elementEffects.lightning)p.elementEffects.lightning={chain:2,damage:3};else p.elementEffects.lightning.chain+=1;} },
  { id:'shieldmax', name:'永恒护盾', icon:'🛡️', desc:'获得永久护盾+护盾免疫一次伤害', apply:(p)=>{p.shield+=3;p.maxShield+=3;p.shieldImmune=(p.shieldImmune||0)+1;} },
  { id:'multishot', name:'双发', icon:'🎯', desc:'每次射击额外发射子弹', apply:(p)=>p.multishot=(p.multishot||0)+1 },
  { id:'execute', name:'处决', icon:'💀', desc:'对30%血以下敌人秒杀', apply:(p)=>p.executeThreshold=(p.executeThreshold||0)+0.3 },
  { id:'rampage', name:'狂暴', icon:'⚔️', desc:'击杀后2秒攻速翻倍', apply:(p)=>p.rampageOnKill=true },
  // 删除phoenix复活词条（玩家反馈复活太强），替换为子弹快点：射速+25%
  { id:'rapidfire', name:'疾速', icon:'⚡', desc:'射击冷却-25%(射速大幅提升)', apply:(p)=>{p.fireCooldown*=0.75;p.baseFireCooldown*=0.75;} }
];

// ==================== Boss专属装备系统 ====================
// 每个Boss掉落固定部位的装备，神话品质时获得Boss专属词条+专属装备名
// bossIdx -> { slot, mythicName, mythicAffix }
const BOSS_GEAR_TABLE = {
  0: { // 九尾狐 -> ring
    slot:'ring', mythicName:'魅狐九尾环',
    affix:{ id:'charm_bullet', name:'魅惑子弹', icon:'💖', desc:'子弹20%概率让敌人混乱互殴2秒',
      apply:(p)=>{p.charmBullet=(p.charmBullet||0)+0.20;} }
  },
  1: { // 毕方 -> helmet
    slot:'helmet', mythicName:'凤羽炎冠',
    affix:{ id:'phoenix_fire', name:'凤凰之火', icon:'🔥', desc:'子弹附带灼烧伤害(2秒DOT)',
      apply:(p)=>{if(!p.specialEffects)p.specialEffects={};if(!p.specialEffects.fireball)p.specialEffects.fireball={radius:40,burnDmg:0.6,burnDur:2,chain:0};else p.specialEffects.fireball.burnDmg+=0.4;} }
  },
  2: { // 相柳 -> boots
    slot:'boots', mythicName:'九蛇毒行靴',
    affix:{ id:'poison_walk', name:'剧毒之足', icon:'☠️', desc:'移动时留下毒沼(伤害敌人,不伤自己)',
      apply:(p)=>{p.poisonWalk=true; p.poisonWalkTimer=0;} }
  },
  3: { // 朱厌 -> armor
    slot:'armor', mythicName:'巨猿金甲',
    affix:{ id:'ape_roar', name:'猿王震吼', icon:'🦍', desc:'受击时震退周围敌人+小范围伤害',
      apply:(p)=>{p.apeRoar=true; p.apeRoarDmg=8;} }
  },
  4: { // 烛龙 -> helmet
    slot:'helmet', mythicName:'烛龙首盔',
    affix:{ id:'light_cycle', name:'光暗交替', icon:'🌟', desc:'每5秒获得1秒无敌',
      apply:(p)=>{p.lightCycle=true; p.lightCycleTimer=5;} }
  },
  5: { // 饕餮 -> ring
    slot:'ring', mythicName:'吞噬之戒',
    affix:{ id:'devour_kill', name:'吞噬之力', icon:'🕳️', desc:'击杀敌人恢复3%血量',
      apply:(p)=>{p.devourOnKill=(p.devourOnKill||0)+0.03;} }
  },
  6: { // 英招 -> boots
    slot:'boots', mythicName:'风神疾行靴',
    affix:{ id:'wind_dodge', name:'风之疾步', icon:'💨', desc:'闪避+20%',
      apply:(p)=>{p.dodgeChance=(p.dodgeChance||0)+0.20;} }
  },
  7: { // 计蒙 -> armor
    slot:'armor', mythicName:'雨师玄袍',
    affix:{ id:'rain_ward', name:'雨帘护体', icon:'🌧️', desc:'受到伤害-15%',
      apply:(p)=>{p.dmgReduction=(p.dmgReduction||0)+0.15;} }
  },
  8: { // 穷奇 -> helmet
    slot:'helmet', mythicName:'混沌虎冠',
    affix:{ id:'chaos_split', name:'混沌分裂', icon:'🌀', desc:'子弹分裂+1(与分裂强化叠加)',
      apply:(p)=>{p.bulletSplit=(p.bulletSplit||0)+1;} }
  },
  9: { // 刑天 -> armor
    slot:'armor', mythicName:'干戚战甲',
    affix:{ id:'war_will', name:'战意不灭', icon:'⚔️', desc:'HP低于30%时伤害×1.5',
      apply:(p)=>{p.warWill=true;} }
  }
};
// 判定玩家是否装备4件不同Boss的神话装备（激活圆弧护盾）
// 必须检查 bossAffix===true，避免升阶后的普通神话（保留 bossIdx 但 bossAffix 不为 true）误激活
function hasFourBossMythics(){
  const bossSet=new Set();
  for(const slot of GEAR_SLOTS){
    const g=saveData.equippedGear[slot];
    if(g && g.rarity==='mythic' && g.specialAffix && g.specialAffix.bossAffix===true){
      bossSet.add(g.bossIdx);
    }
  }
  return bossSet.size>=4;
}
// 统计已收集的Boss神话装备种类（用于图鉴）
// 必须检查 bossAffix===true，避免升阶后的普通神话被误计入Boss神话收集
function countBossMythicsCollected(){
  const set=new Set();
  for(const slot of GEAR_SLOTS){
    const g=saveData.equippedGear[slot];
    if(g && g.rarity==='mythic' && g.specialAffix && g.specialAffix.bossAffix===true)set.add(g.bossIdx);
  }
  for(const g of saveData.gearBag){
    if(g && g.rarity==='mythic' && g.specialAffix && g.specialAffix.bossAffix===true)set.add(g.bossIdx);
  }
  return set.size;
}
// 生成随机装备
function generateGear(slot,rarity){
  const r=GEAR_RARITIES[rarity];
  const stats=[];
  const pool=[...GEAR_STAT_POOL];
  for(let i=0;i<r.statCount&&pool.length>0;i++){
    const idx=randInt(0,pool.length-1);
    const s=pool.splice(idx,1)[0];
    const val=s.min+Math.random()*(s.max-s.min);
    stats.push({ id:s.id, name:s.name, icon:s.icon, value:Math.round(val*100)/100 });
  }
  // 传说/神话装备额外获得专属词条
  let specialAffix=null;
  if(rarity==='legendary'){
    const aff=GEAR_LEGENDARY_AFFIXES[randInt(0,GEAR_LEGENDARY_AFFIXES.length-1)];
    specialAffix={id:aff.id,name:aff.name,icon:aff.icon,desc:aff.desc,special:true};
  }else if(rarity==='mythic'){
    const aff=GEAR_MYTHIC_AFFIXES[randInt(0,GEAR_MYTHIC_AFFIXES.length-1)];
    specialAffix={id:aff.id,name:aff.name,icon:aff.icon,desc:aff.desc,special:true};
  }
  const nameList=GEAR_NAMES[slot];
  const rarityIdx=GEAR_RARITY_ORDER.indexOf(rarity);
  const nameIdx=Math.min(rarityIdx, nameList.length-1);
  return {
    uid:Date.now()+Math.random(),
    slot, rarity,
    name:nameList[nameIdx],
    stats,
    specialAffix
  };
}
// 根据Boss掉落装备
// 每个Boss只掉自己专属部位的装备；神话品质获得Boss专属词条+专属装备名
// bossIdx: 0-9，决定部位和神话词条；isSuper: 是否超级Boss（影响品质概率）
function dropGear(bossIdx,isSuper){
  // 超级Boss掉落更高稀有度（含神话概率）
  let rarity;
  const r=Math.random();
  if(isSuper){
    if(r<0.25)rarity='mythic';       // 25% 神话（仅超级Boss掉落神话装备，提高到25%便于凑齐4件套）
    else if(r<0.55)rarity='legendary';
    else if(r<0.80)rarity='epic';
    else rarity='rare';
  }else{
    if(r<0.15)rarity='mythic';       // 15% 神话（普通Boss也有概率，提高到15%便于凑齐10种Boss神话装备）
    else if(r<0.30)rarity='legendary';
    else if(r<0.55)rarity='epic';
    else if(r<0.80)rarity='rare';
    else rarity='common';
  }
  // 去重：若玩家已拥有此Boss的神话装备，神话降级为传说（鼓励凑齐不同Boss的神话装备）
  if(rarity==='mythic' && !shouldDropBossGear(bossIdx)){
    rarity='legendary';
  }
  // 部位由Boss决定（每个Boss专属一个部位）
  const bossDef=BOSS_GEAR_TABLE[bossIdx];
  const slot=bossDef?bossDef.slot:GEAR_SLOTS[randInt(0,GEAR_SLOTS.length-1)];
  const gear=generateGear(slot,rarity);
  // 记录来源Boss
  gear.bossIdx=bossIdx;
  // 神话品质：替换为Boss专属装备名+专属词条
  if(rarity==='mythic' && bossDef){
    gear.name=bossDef.mythicName;
    gear.specialAffix={
      id:bossDef.affix.id, name:bossDef.affix.name, icon:bossDef.affix.icon,
      desc:bossDef.affix.desc, special:true, bossAffix:true, bossIdx:bossIdx
    };
  }
  return gear;
}
// 刑天击败掉落：优先掉落一件未拥有的Boss神话装备
// 如果所有10种Boss神话都已拥有，则掉落一件随机Boss神话装备
function dropMissingBossMythic(){
  const owned=getOwnedBossMythics();
  const missing=[];
  for(let i=0;i<10;i++){
    if(!owned.has(i))missing.push(i);
  }
  let bossIdx;
  if(missing.length>0){
    bossIdx=missing[Math.floor(Math.random()*missing.length)];
  }else{
    bossIdx=Math.floor(Math.random()*10);
  }
  const bossDef=BOSS_GEAR_TABLE[bossIdx];
  const slot=bossDef?bossDef.slot:GEAR_SLOTS[randInt(0,GEAR_SLOTS.length-1)];
  const gear=generateGear(slot,'mythic');
  gear.bossIdx=bossIdx;
  if(bossDef){
    gear.name=bossDef.mythicName;
    gear.specialAffix={
      id:bossDef.affix.id, name:bossDef.affix.name, icon:bossDef.affix.icon,
      desc:bossDef.affix.desc, special:true, bossAffix:true, bossIdx:bossIdx
    };
  }
  return gear;
}
// Boss掉落去重：优先掉落未拥有过的Boss神话装备
// 返回 true 表示应触发掉落，false 表示跳过本次掉落（让玩家优先凑齐4件不同Boss）
function shouldDropBossGear(bossIdx){
  // 检查是否已拥有此Boss的"专属"神话装备（bossAffix===true 才算专属）
  // 升阶产生的普通神话虽保留 bossIdx 但 bossAffix 非 true，不算专属，不会阻止 Boss 专属神话掉落
  const hasMythic=(g)=>g && g.rarity==='mythic' && g.bossIdx===bossIdx && g.specialAffix && g.specialAffix.bossAffix===true;
  const hasInEquipped=Object.values(saveData.equippedGear).some(hasMythic);
  const hasInBag=saveData.gearBag.some(hasMythic);
  return !(hasInEquipped || hasInBag);
}
// 获取已拥有的Boss神话装备bossIdx集合（用于图鉴展示，仅统计专属神话）
function getOwnedBossMythics(){
  const set=new Set();
  for(const slot of GEAR_SLOTS){
    const g=saveData.equippedGear[slot];
    if(g && g.rarity==='mythic' && g.specialAffix && g.specialAffix.bossAffix===true && g.bossIdx!==undefined && g.bossIdx!==null)set.add(g.bossIdx);
  }
  for(const g of saveData.gearBag){
    if(g && g.rarity==='mythic' && g.specialAffix && g.specialAffix.bossAffix===true && g.bossIdx!==undefined && g.bossIdx!==null)set.add(g.bossIdx);
  }
  return set;
}
// 应用装备属性
function applyGearStats(p){
  let mythicCount=0, legendaryCount=0;
  for(const slot of GEAR_SLOTS){
    const g=saveData.equippedGear[slot];
    if(!g)continue;
    if(g.rarity==='mythic')mythicCount++;
    if(g.rarity==='legendary')legendaryCount++;
    for(const s of (g.stats||[])){
      const def=GEAR_STAT_POOL.find(x=>x.id===s.id);
      if(def)def.apply(p,s.value);
    }
    // 应用专属词条
    if(g.specialAffix){
      // Boss专属词条：从BOSS_GEAR_TABLE查找
      if(g.specialAffix.bossAffix && g.bossIdx!==undefined && g.bossIdx!==null){
        const bossDef=BOSS_GEAR_TABLE[g.bossIdx];
        if(bossDef && bossDef.affix.id===g.specialAffix.id){
          bossDef.affix.apply(p);
        }
      }else{
        // 普通神话/传说词条
        const affixPool=g.rarity==='mythic'?GEAR_MYTHIC_AFFIXES:GEAR_LEGENDARY_AFFIXES;
        const aff=affixPool.find(x=>x.id===g.specialAffix.id);
        if(aff)aff.apply(p);
      }
    }
  }
  // 2件金装套装：+20%伤害
  if(legendaryCount>=2){p.bulletDamage*=1.2;}
  // 3件金装套装：+30%射速 +10%暴击
  if(legendaryCount>=3){p.baseFireCooldown*=0.7; p.critChance+=0.1;}
  // 4件金装套装：每关开始恢复 3 点生命（regenPerLevel在proceedToNextLevel中应用）
  // 注意：goldHalo标记当前未在渲染层使用，仅作为内部状态标记保留
  if(legendaryCount>=4){p.goldHalo=true; p.regenPerLevel=(p.regenPerLevel||0)+3;}
  // 4件红装（神话）套装特效：全属性大幅提升（吸血大幅削弱：0.08→0.03，且为唯一吸血来源）
  if(mythicCount>=4){
    p.bulletDamage*=1.6; p.speed*=1.3; p.maxHealth=Math.ceil(p.maxHealth*1.3); p.health=p.maxHealth;
    p.critChance=(p.critChance||0)+0.2; p.critDamage=(p.critDamage||2)+0.5;
    p.bulletPierce+=2; p.lifesteal=(p.lifesteal||0)+0.03;
  }
}
// 装备合成：3件同品质→50%几率升一阶
function synthesizeGears(uids){
  if(uids.length!==3)return{success:false,msg:'需要3件装备'};
  const gears=uids.map(uid=>saveData.gearBag.find(g=>String(g.uid)===String(uid))).filter(g=>g);
  if(gears.length!==3)return{success:false,msg:'找不到装备'};
  const rarity=gears[0].rarity;
  if(!gears.every(g=>g.rarity===rarity))return{success:false,msg:'需要相同品质'};
  if(rarity==='mythic')return{success:false,msg:'神话装备已是最高品质'};
  // 注意：神话品质已在上方拦截，传说品质的Boss专属装备（带 bossIdx）可参与合成，
  // 合成产物通过 generateGear 重新生成，不带 bossIdx/bossAffix（变为普通神话），这是预期行为
  const curIdx=GEAR_RARITY_ORDER.indexOf(rarity);
  if(curIdx<0||curIdx>=GEAR_RARITY_ORDER.length-1)return{success:false,msg:'无法合成'};
  const newRarity=GEAR_RARITY_ORDER[curIdx+1];
  // 从背包移除3件
  for(const g of gears){
    const idx=saveData.gearBag.indexOf(g);
    if(idx>=0)saveData.gearBag.splice(idx,1);
  }
  // 50%成功率
  if(Math.random()<0.5){
    // 合成结果部位：30%概率从3件中选，70%概率完全随机（确保所有部位都可获得）
    let slot;
    if(Math.random()<0.3){
      slot=gears[randInt(0,2)].slot;
    }else{
      slot=GEAR_SLOTS[randInt(0,GEAR_SLOTS.length-1)];
    }
    const newGear=generateGear(slot,newRarity);
    saveData.gearBag.push(newGear);
    saveSave();
    return{success:true,msg:`合成成功！获得${GEAR_RARITIES[newRarity].name}品质的${newGear.name}！`,gear:newGear};
  }else{
    saveSave();
    return{success:false,msg:'合成失败！装备已消耗'};
  }
}
// 装备升阶：消耗积分提升一件装备的稀有度（神话不可升阶，Boss专属神话只能掉落）
// Boss传说装备升阶为神话后变成普通神话（不带Boss标记和Boss词条）
function ascendGear(uid){
  const idx=saveData.gearBag.findIndex(g=>String(g.uid)===String(uid));
  if(idx<0)return{success:false,msg:'装备不在背包中'};
  const g=saveData.gearBag[idx];
  if(g.rarity==='mythic')return{success:false,msg:'神话装备已是最高品质'};
  const cost=GEAR_ASCEND_COST[g.rarity];
  if(!cost)return{success:false,msg:'该装备不可升阶'};
  if((saveData.totalScore||0)<cost)return{success:false,msg:`积分不足，需要${cost}积分`};
  // 扣除消耗
  saveData.totalScore-=cost;
  // 升阶
  const curIdx=GEAR_RARITY_ORDER.indexOf(g.rarity);
  const newRarity=GEAR_RARITY_ORDER[curIdx+1];
  const r=GEAR_RARITIES[newRarity];
  // 重新生成stats：保留原词条数值，额外补足新稀有度应有的词条数
  const pool=[...GEAR_STAT_POOL].filter(s=>!(g.stats||[]).some(st=>st.id===s.id));
  const stats=[...(g.stats||[])];
  while(stats.length<r.statCount && pool.length>0){
    const i=randInt(0,pool.length-1);
    const s=pool.splice(i,1)[0];
    const val=s.min+Math.random()*(s.max-s.min);
    stats.push({id:s.id,name:s.name,icon:s.icon,value:Math.round(val*100)/100});
  }
  // 数值整体按新稀有度倍率提升（让升阶有成长感）
  const oldMul=GEAR_RARITIES[g.rarity].mul;
  const newMul=r.mul;
  const mulRatio=newMul/oldMul;
  for(const s of stats){
    s.value=Math.round(s.value*mulRatio*100)/100;
  }
  // 升阶词条：传说/神话给专属词条
  let specialAffix=g.specialAffix;
  if(newRarity==='legendary' && !specialAffix){
    const aff=GEAR_LEGENDARY_AFFIXES[randInt(0,GEAR_LEGENDARY_AFFIXES.length-1)];
    specialAffix={id:aff.id,name:aff.name,icon:aff.icon,desc:aff.desc,special:true};
  }else if(newRarity==='mythic'){
    // 升到神话：使用随机神话词条（非Boss专属）
    // 注意：保留 g.bossIdx 不清除，避免 shouldDropBossGear 误判玩家未拥有该Boss神话导致重复掉落
    const aff=GEAR_MYTHIC_AFFIXES[randInt(0,GEAR_MYTHIC_AFFIXES.length-1)];
    specialAffix={id:aff.id,name:aff.name,icon:aff.icon,desc:aff.desc,special:true};
    // 升阶后的神话虽保留 bossIdx 标记，但 specialAffix.bossAffix 不为 true，表示非Boss专属神话
    // shouldDropBossGear 只检查 rarity==='mythic' && bossAffix===true，所以不会误判
  }
  // 更新名字为新阶级对应名字
  const nameIdx=Math.min(GEAR_RARITY_ORDER.indexOf(newRarity), GEAR_NAMES[g.slot].length-1);
  g.name=GEAR_NAMES[g.slot][nameIdx];
  g.rarity=newRarity;
  g.stats=stats;
  g.specialAffix=specialAffix;
  saveSave();
  return{success:true,msg:`升阶成功！获得${r.name}品质的${g.name}`,gear:g};
}
// 定向重铸：消耗精魄+积分，将装备的specialAffix替换为指定词条
function directReforge(uid, targetAffixId){
  const idx=saveData.gearBag.findIndex(g=>String(g.uid)===String(uid));
  if(idx<0)return{success:false,msg:'装备不在背包中'};
  const g=saveData.gearBag[idx];
  if(!g.specialAffix)return{success:false,msg:'该装备无可重铸的专属词条'};
  // 神话装备只能定向神话词条，传说只能定向传说词条
  const isMythic=g.rarity==='mythic';
  // Boss专属神话装备不可重铸（词条绑定Boss）
  if(g.specialAffix.bossAffix)return{success:false,msg:'Boss专属神话词条不可重铸'};
  const cost=isMythic?GEAR_REFORGE_COST.direct_mythic:GEAR_REFORGE_COST.direct_legendary;
  if((saveData.totalScore||0)<cost)return{success:false,msg:`积分不足，需要${cost}积分`};
  const pool=isMythic?GEAR_MYTHIC_AFFIXES:GEAR_LEGENDARY_AFFIXES;
  const target=pool.find(a=>a.id===targetAffixId);
  if(!target)return{success:false,msg:'未找到目标词条'};
  if(target.id===g.specialAffix.id)return{success:false,msg:'目标词条与当前相同'};
  // 扣除消耗
  saveData.totalScore-=cost;
  const oldName=g.specialAffix.name;
  g.specialAffix={id:target.id,name:target.name,icon:target.icon,desc:target.desc,special:true};
  saveSave();
  return{success:true,msg:`定向重铸成功！${oldName} → ${target.icon} ${target.name}`};
}

// ==================== 装备Build联动系统 ====================
// 同时拥有特定词条/属性时触发额外效果，鼓励玩家构建Build而非堆数值
// 检测时机：applyGearStats之后调用applyGearSynergies
// 返回激活的联动列表（用于UI展示）
let activeGearSynergies = []; // 当前激活的联动（每次应用前清空）
function _hasAffix(p, affixIds){
  // 检查玩家装备中是否有指定id的specialAffix（含Boss专属）。支持传入数组多id匹配
  const ids = Array.isArray(affixIds) ? affixIds : [affixIds];
  for(const slot of GEAR_SLOTS){
    const g=saveData.equippedGear[slot];
    if(g && g.specialAffix && ids.includes(g.specialAffix.id)) return true;
  }
  return false;
}
const GEAR_SYNERGIES = [
  {
    id:'burning_poison', name:'蚀骨烈焰', icon:'🔥',
    desc:'同时拥有灼烧+毒沼：灼烧/毒沼伤害+50%',
    // burn = 传说灼烧附魔, phoenix_fire = 毕方Boss神话
    // poison_walk = 相柳Boss神话
    check:(p)=>_hasAffix(p,['burn','phoenix_fire']) && _hasAffix(p,'poison_walk'),
    apply:(p)=>{ p.burnBonusMul=(p.burnBonusMul||1)*1.5; p.poisonBonusMul=(p.poisonBonusMul||1)*1.5; }
  },
  {
    id:'storm_rain', name:'疾风暴雨', icon:'🌧️',
    desc:'暴击率≥30%且射速加成≥25%：暴击伤害+30%',
    check:(p)=>p.critChance>=0.3 && (p.baseFireCooldown||1)<=0.75,
    apply:(p)=>{ p.critDamage+=0.3; }
  },
  {
    id:'pierce_split', name:'贯穿裂变', icon:'🏹',
    desc:'穿透≥2且拥有子弹分裂：分裂子弹伤害+20%',
    check:(p)=>(p.bulletPierce||0)>=2 && (p.bulletSplit||0)>0,
    apply:(p)=>{ p.splitDmgMul=(p.splitDmgMul||0.5)*1.2; }
  },
  {
    id:'undying', name:'不灭之躯', icon:'🛡️',
    desc:'护盾≥3且最大生命≥15：每5秒恢复1护盾',
    check:(p)=>(p.maxShield||0)>=3 && (p.maxHealth||0)>=15,
    apply:(p)=>{ p.shieldRegenPer5=(p.shieldRegenPer5||0)+1; }
  },
  {
    id:'reaper', name:'死神降临', icon:'💀',
    desc:'拥有处决且暴击伤害≥2.5：处决阈值+10%（30%→40%）',
    check:(p)=>(p.executeThreshold||0)>0 && (p.critDamage||0)>=2.5,
    apply:(p)=>{ p.executeThreshold+=0.1; }
  },
  {
    id:'thunder_storm', name:'雷霆万钧', icon:'⚡',
    desc:'拥有闪电链+双发：闪电链跳跃+1、伤害+2',
    check:(p)=>{
      if(!_hasAffix(p,'lightning'))return false;
      return (p.multishot||0)>0;
    },
    apply:(p)=>{
      if(!p.elementEffects)p.elementEffects={};
      if(!p.elementEffects.lightning)p.elementEffects.lightning={chain:2,damage:3};
      p.elementEffects.lightning.chain+=1;
      p.elementEffects.lightning.damage+=2;
    }
  },
  {
    id:'rampage_rapid', name:'狂飙突进', icon:'💨',
    desc:'拥有狂暴+疾速：击杀后攻速翻倍时长+1秒',
    check:(p)=>p.rampageOnKill===true && _hasAffix(p,'rapidfire'),
    apply:(p)=>{ p.rampageBonusDur=(p.rampageBonusDur||0)+1; }
  },
  {
    id:'magnet_dodge', name:'灵动如风', icon:'🍃',
    desc:'拥有磁力范围+闪避：闪避率额外+5%',
    check:(p)=>_hasAffix(p,'magnet') && _hasAffix(p,'dodge'),
    apply:(p)=>{ p.dodgeChance=(p.dodgeChance||0)+0.05; }
  },
];
function applyGearSynergies(p){
  // 幂等实现：用_appliedSynergies Set记录已应用的联动id，避免重复apply导致叠加膨胀
  // Player构造时_appliedSynergies为空，所有联动都会apply一次
  // 局内升级后再次调用时，已应用的跳过，新激活的才apply
  if(!p._appliedSynergies)p._appliedSynergies=new Set();
  activeGearSynergies=[]; // 清空UI显示列表（不影响已应用标记）
  for(const syn of GEAR_SYNERGIES){
    try{
      const active=syn.check(p);
      const applied=p._appliedSynergies.has(syn.id);
      if(active){
        if(!applied){
          // 新激活：应用效果并标记
          syn.apply(p);
          p._appliedSynergies.add(syn.id);
        }
        // 无论是否刚应用，都加入UI显示列表
        activeGearSynergies.push(syn);
      }else if(!active && applied){
        // 不再激活：从标记中移除（不撤销已应用的效果，下次Player构造时自然重置）
        p._appliedSynergies.delete(syn.id);
      }
    }catch(e){ console.warn('Build联动检查失败:',syn.id,e); }
  }
}

// ==================== 羁绊/套装系统 ====================
const BONDS = [
  { id:'beastPair', name:'妖兽双子', icon:'🐺', desc:'拥有2个普通Boss宝宝', check:()=>saveData.ownedPets.filter(p=>{const d=getPetDef(p.def);return d&&!d.isSuper;}).length>=2, effect:{ name:'伤害+15%', apply:p=>p.bulletDamage*=1.15 } },
  { id:'superDuo', name:'超级双煞', icon:'🐉', desc:'拥有2个超级Boss宝宝', check:()=>saveData.ownedPets.filter(p=>{const d=getPetDef(p.def);return d&&d.isSuper;}).length>=2, effect:{ name:'伤害+30%+暴击+10%', apply:p=>{p.bulletDamage*=1.3;p.critChance+=0.1;} } },
  { id:'collector', name:'万物收集', icon:'📚', desc:'拥有4种以上不同Boss宝宝', check:()=>new Set(saveData.ownedPets.map(p=>p.def)).size>=4, effect:{ name:'移速+20%+射速+10%', apply:p=>{p.speed*=1.2;p.baseFireCooldown*=0.9;} } },
  { id:'allNormal', name:'六灵齐聚', icon:'🌀', desc:'拥有6个普通Boss宝宝(全部)', check:()=>{const s=new Set(saveData.ownedPets.filter(p=>{const d=getPetDef(p.def);return d&&!d.isSuper;}).map(p=>p.def));return s.size>=6;}, effect:{ name:'全属性+20%', apply:p=>{p.bulletDamage*=1.2;p.speed*=1.2;p.maxHealth=Math.ceil(p.maxHealth*1.2);p.health=p.maxHealth;} } },
  { id:'allSuper', name:'三圣降临', icon:'⚡', desc:'拥有3个超级Boss宝宝(全部)', check:()=>{const s=new Set(saveData.ownedPets.filter(p=>{const d=getPetDef(p.def);return d&&d.isSuper;}).map(p=>p.def));return s.size>=3;}, effect:{ name:'伤害翻倍+暴击+20%', apply:p=>{p.bulletDamage*=2;p.critChance+=0.2;} } },
  { id:'evolved', name:'进化大师', icon:'⭐', desc:'拥有3只进化到3阶段的宠物', check:()=>saveData.ownedPets.filter(p=>p.stage>=2).length>=3, effect:{ name:'射速+30%+穿透+2', apply:p=>{p.baseFireCooldown*=0.7;p.bulletPierce+=2;} } }
];
function getActiveBonds(){ return BONDS.filter(b=>b.check()); }
function applyBondEffects(p){
  for(const b of getActiveBonds()){
    b.effect.apply(p);
  }
}

// ==================== 成就系统 ====================
const ACHIEVEMENTS = [
  // 击杀类
  { id:'firstKill', name:'初次降妖', icon:'🗡️', desc:'击败第一个Boss', check:f=>f.totalBossKills>=1, reward:100 },
  { id:'bossKills5', name:'妖兽猎人', icon:'⚔️', desc:'累计击败5个Boss', check:f=>f.totalBossKills>=5, reward:200 },
  { id:'bossKills20', name:'降妖大师', icon:'🏆', desc:'累计击败20个Boss', check:f=>f.totalBossKills>=20, reward:500 },
  { id:'bossKills50', name:'山海经主', icon:'👑', desc:'累计击败50个Boss', check:f=>f.totalBossKills>=50, reward:1000 },
  // 分数类
  { id:'score1k', name:'小有成就', icon:'💰', desc:'单局得分1000', check:f=>f.bestScore>=1000, reward:100 },
  { id:'score5k', name:'富甲一方', icon:'💎', desc:'单局得分5000', check:f=>f.bestScore>=5000, reward:300 },
  { id:'score10k', name:'富可敌国', icon:'🏦', desc:'单局得分10000', check:f=>f.bestScore>=10000, reward:800 },
  // 收集类
  { id:'firstPet', name:'初得灵兽', icon:'🐾', desc:'获得第一个Boss宝宝', check:f=>f.petCount>=1, reward:100 },
  { id:'pet3', name:'灵兽成群', icon:'🐉', desc:'拥有3只Boss宝宝', check:f=>f.petCount>=3, reward:300 },
  { id:'pet6', name:'灵兽满堂', icon:'🏰', desc:'拥有全部6种Boss宝宝', check:f=>f.uniquePetTypes>=6, reward:800 },
  // 难度类
  { id:'hardWin', name:'勇者', icon:'🔥', desc:'在困难难度击败Boss', check:f=>f.hardCleared, reward:200 },
  { id:'hellWin', name:'地狱行者', icon:'💀', desc:'在地狱难度击败Boss', check:f=>f.hellCleared, reward:500 },
  { id:'godslayer', name:'弑神', icon:'⚡', desc:'在弑神难度击败Boss', check:f=>f.godCleared, reward:1500 },
  // Boss试炼难度通关类
  { id:'trialNormal', name:'试炼初成', icon:'🌱', desc:'通过普通难度Boss试炼', check:f=>f.trialNormalCleared, reward:500 },
  { id:'trialHard', name:'试炼精进', icon:'🔥', desc:'通过困难难度Boss试炼', check:f=>f.trialHardCleared, reward:1000 },
  { id:'trialHell', name:'试炼苦行', icon:'💀', desc:'通过地狱难度Boss试炼', check:f=>f.trialHellCleared, reward:2000 },
  { id:'trialNightmare', name:'试炼梦魇', icon:'👹', desc:'通过梦魇难度Boss试炼', check:f=>f.trialNightmareCleared, reward:3000 },
  { id:'trialGodslayer', name:'试炼封神', icon:'⚔️', desc:'通过弑神难度Boss试炼', check:f=>f.trialGodslayerCleared, reward:5000 },
  // 挑战类
  { id:'trialClear', name:'试炼通关', icon:'🎯', desc:'完成一次Boss试炼', check:f=>f.trialCleared, reward:400 },
  { id:'superBoss', name:'弑圣', icon:'🌟', desc:'击败超级Boss', check:f=>f.superKills>=1, reward:600 },
  { id:'allBosses', name:'图鉴全开', icon:'📖', desc:'击败所有6种Boss', check:f=>f.bossTypesKilled>=6, reward:1000 },
  // 装备类
  { id:'firstGear', name:'初得装备', icon:'🎽', desc:'获得第一件装备', check:f=>f.gearCount>=1, reward:100 },
  { id:'legendary', name:'传说之器', icon:'✨', desc:'获得传说装备', check:f=>f.legendaryCount>=1, reward:300 },
  { id:'fullGear', name:'全副武装', icon:'🛡️', desc:'4个装备槽都装满', check:f=>f.fullGear, reward:500 }
];
function checkAchievements(){
  let unlocked=[];
  const f=saveData.achievementFlags;
  // 同步数据
  f.petCount=saveData.ownedPets.length;
  f.uniquePetTypes=new Set(saveData.ownedPets.map(p=>p.def)).size;
  f.gearCount=saveData.gearBag.length+Object.values(saveData.equippedGear).filter(g=>g).length;
  f.legendaryCount=saveData.gearBag.filter(g=>g.rarity==='legendary').length+Object.values(saveData.equippedGear).filter(g=>g&&g.rarity==='legendary').length;
  f.fullGear=Object.values(saveData.equippedGear).every(g=>g);
  f.bossTypesKilled=Object.keys(saveData.bossPedia).length;
  for(const a of ACHIEVEMENTS){
    if(!saveData.achievements[a.id]){
      if(a.check(f)){
        saveData.achievements[a.id]={unlocked:true};
        saveData.totalScore+=a.reward;
        unlocked.push({...a,reward:a.reward});
      }
    }
  }
  return unlocked;
}
// 显示成就解锁通知
function showAchievementNotifications(achievements){
  for(const a of achievements){
    pushFloatingText(CONFIG.WIDTH/2,CONFIG.HEIGHT/2-50,`🏆 成就解锁: ${a.name}! +${a.reward}积分`,'#ffd700',3);
    spawnParticles(CONFIG.WIDTH/2,CONFIG.HEIGHT/2,'#ffd700',30);
  }
}

// ==================== 奇遇事件 ====================
// 全面重做：去掉护盾/回血类（玩家反馈太闷），换成更有趣的策略性事件
// 保留"10秒无敌"已删除，所有事件都是策略性选择
const ADVENTURE_EVENTS = [
  { desc:'怪物移速减慢30%', icon:'🐌', apply:()=>{ globalSlow=0.7; globalSlowTimer=15; } },
  // 删除复活次数+1事件（玩家反馈复活太强，整局限2次足够）
  { desc:'子弹伤害+2', icon:'⚔️', apply:()=>{ if(player)player.bulletDamage+=2; } },
  { desc:'射速+30%', icon:'⚡', apply:()=>{ if(player)player.fireCooldown*=0.7; } },
  { desc:'后续Boss血量x2(风险)', icon:'👹', apply:()=>{ bossHpMul*=2; } },
  { desc:'移速+25%', icon:'👟', apply:()=>{ if(player)player.speed*=1.25; } },
  { desc:'暴击率+20%', icon:'💥', apply:()=>{ if(player)player.critChance+=0.2; } },
  // === 新增策略性事件 ===
  { desc:'获得1.5倍伤害(持续15秒)', icon:'🔥', apply:()=>{ if(player){player._adventureDmgBoost=1.5; player._adventureDmgBoostTime=15; pushFloatingText(player.x,player.y-40,'1.5x伤害!','#ff6347',2);} } },
  { desc:'子弹分裂(命中分裂2发)', icon:'🔀', apply:()=>{ if(player)player.bulletSplit=(player.bulletSplit||0)+1; } },
  { desc:'连击重置延长(连击+5秒)', icon:'🎯', apply:()=>{ if(comboTimer>0)comboTimer+=5; } },
  { desc:'攻击范围扩大(穿透+1)', icon:'🏹', apply:()=>{ if(player)player.bulletPierce=(player.bulletPierce||0)+1; } }
];

// ==================== 武器打造词条 ====================
const CRAFT_MODIFIERS = [
  { id:'dmg',  name:'伤害', icon:'⚔️', rarities:[{r:'common',v:1},{r:'rare',v:2},{r:'epic',v:3}] },
  { id:'cd',   name:'射速', icon:'⚡', rarities:[{r:'common',v:0.04},{r:'rare',v:0.08},{r:'epic',v:0.12}] },
  { id:'size', name:'子弹大小', icon:'🔵', rarities:[{r:'common',v:1.5},{r:'rare',v:3},{r:'epic',v:5}] },
  { id:'crit', name:'暴击率', icon:'💥', rarities:[{r:'common',v:0.04},{r:'rare',v:0.08},{r:'epic',v:0.12}] },
  { id:'pierce',name:'穿透', icon:'🏹', rarities:[{r:'rare',v:1},{r:'epic',v:1}] },
  { id:'count',name:'子弹数', icon:'🎯', rarities:[{r:'epic',v:1}] }
];
function rollCraft(){
  const mod=CRAFT_MODIFIERS[randInt(0,CRAFT_MODIFIERS.length-1)];
  const rIdx=Math.random()<0.5?0:(Math.random()<0.7?1:2);
  const r=mod.rarities[Math.min(rIdx,mod.rarities.length-1)];
  return { ...mod, rarity:r.r, value:r.v };
}

