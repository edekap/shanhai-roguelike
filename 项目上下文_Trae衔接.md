# 山海经肉鸽 - 项目上下文文档（Trae 无缝衔接用）

> 本文档包含完整的项目背景、技术架构、历次改动、用户偏好和当前状态。
> 把整份文档喂给 Trae 即可无缝继续之前的对话。

---

## 一、项目概览

### 基本信息
- **项目名称**：山海经肉鸽（Pixel Shooter Roguelike）
- **类型**：HTML5 Canvas 单文件肉鸽射击游戏
- **主题**：山海经神兽题材，9 大 Boss + 刑天干戚隐藏武器
- **主文件**：`e:\gameidea-roug\index.html`（约 470KB，单文件包含全部逻辑）
- **工作目录**：`e:\gameidea-roug\`
- **作者署名**：✦ Edeka 制作 ✦（首页金色楷体显示）
- **存档键名**：`localStorage['pixelShooterSave_v2']`（每设备独立，不串档）

### 三种分发方式
| 方式 | 位置 | 适用 |
|------|------|------|
| **APK 安装版** | `e:\gameidea-roug\山海经肉鸽.apk` (39.32 MB) | 安卓原生全屏横屏 |
| **网页版** | https://edekap.github.io/shanhai-roguelike/ | 安卓+苹果+电脑通用 |
| **电脑本地版** | 双击 `index.html` | 电脑离线玩 |

### 仓库
- **GitHub**：https://github.com/edekap/shanhai-roguelike
- **分支**：main
- **GitHub Pages**：已开启，从 main 分支根目录部署
- **Gitee 备用**：用户邮箱是 `edeka@user.noreply.gitee.com`（曾用过 Gitee）

---

## 二、技术架构

### 技术栈
- **前端**：纯 HTML5 Canvas + JavaScript（无框架）
- **打包**：Capacitor 6.2.1（支持 JDK 17，不要用 7/8 版本因为硬编码要求 JDK 21）
- **构建**：Gradle（腾讯云镜像 + 阿里云 Maven 镜像，国内加速）
- **JDK**：`C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot`
- **Android SDK**：`E:\gameidea-roug\sdk\`
- **Node.js**：v24.14.1
- **图像处理**：Python PIL（Pillow）用于生成 Boss 动画帧
- **包名**：`com.shanhai.roguelike`
- **应用名**：山海经肉鸽

### Canvas 设置
- 固定尺寸：1600x1000
- CSS 自适应缩放
- 横屏游戏（手机端竖屏时显示旋转提示遮罩）

### 目录结构
```
e:\gameidea-roug\
├── index.html                      # 主游戏文件（单文件，~470KB）
├── 安装教程.txt                    # APK 安装说明（安卓+iOS）
├── gen_boss_anim.py                # Boss 动画帧生成器（特效层叠加方案）
├── gen_boss_frames.py              # Boss 基础帧生成器
├── 山海经肉鸽.apk                  # 最终打包的 APK（39.32 MB）
├── .gitignore                      # 忽略 apk/、sdk/、gradle-home/ 等
├── assets/
│   └── bosses/
│       ├── boss_0.png ~ boss_9.png       # 9 个 Boss idle 帧 + 刑天
│       ├── boss_0_a.png ~ boss_9_a.png   # 主攻击帧（特效层叠加）
│       ├── boss_0_a2.png ~ boss_9_a2.png # 副攻击帧
│       ├── boss_0_m.png ~ boss_9_m.png   # 移动帧
│       ├── actions/                      # 早期生成的 jpg 版本（未使用）
│       └── backup_png_v1/                # Boss 原图备份
├── apk/                            # Capacitor 项目目录（gitignore）
│   ├── www/                        # web 资源（index.html + assets/）
│   ├── android/                    # Android 原生工程
│   └── capacitor.config.json
├── sdk/                            # Android SDK（gitignore）
└── gradle-home/                    # Gradle 缓存（gitignore，已设用户环境变量）
```

---

## 三、游戏核心系统

### Boss 系统（9 大 Boss + 刑天）
| 编号 | Boss 名 | 图片编号 | 特殊机制 |
|------|---------|---------|---------|
| 0 | 九尾狐 | boss_0 | 魅惑光环 |
| 1 | 毕方 | boss_1 | 火焰流 |
| 2 | 相柳 | boss_2 | 毒液 |
| 3 | 朱厌 | boss_3 | 武器弧线 |
| 4 | 烛龙 | boss_4 | 锯齿裂缝 |
| 5 | 饕餮 | boss_5 | 撕咬红光 |
| 6 | 英招 | boss_6 | 冲击波 |
| 7 | 记梦 | boss_7 | 引力环 |
| 8 | 穷奇 | boss_8 | 混沌 |
| 9 | 刑天 | boss_9 | 程序化绘制（干戚武器） |

### Boss 动画帧系统
- **4 帧切换**：idle / attack / attack2 / move
- **ATTACK_FRAME_MAP**：攻击类型 → 对应动画帧映射
- **图片版本号**：`?v=8`（cache-busting，改图后需递增）
- **关键教训**：不要做切片变形（`upper_half_transform`/`lower_half_transform`），会导致接缝凹陷和 alpha 通道丢失。正确做法是**原图保持原样，只叠加动作特效层**

### 特效类型（gen_boss_anim.py）
- bite（撕咬红光+牙齿）
- fire（火焰流）
- water（水柱）
- poison（毒液）
- weapon（武器弧线）
- slam（冲击波+运动线）
- void（锯齿裂缝）
- gravity（引力环）
- charm（光环）
- move（运动线）

### 武器系统
| 武器 | 价格 | 升级价 |
|------|------|--------|
| pistol（手枪） | 初始 | 400 |
| bow（弓） | 1200 | 700 |
| shotgun（霰弹） | 1800 | 900 |
| sniper（狙击） | 3500 | 1800 |
| hammer（锤） | 5000 | 2500 |
| crossbow（弩） | 7000 | 3500 |
| thunder（雷霆） | 10000 | 5000 |
| voidbow（虚空弓） | 15000 | 7500 |
| xingtiangeqi（刑天干戚） | 特殊 | 12000 |

### 刑天干戚（隐藏武器）平衡参数
- bulletDamage: 12
- fireCooldown: 0.46
- critBonus: 0.45
- 战意：每层 +5% 伤害（最多 3 层 = +15%）
- 血怒：血量越低伤害越高（最高 +50%，残血 1.5x）
- 战魂护盾：每命中 3 次获得 1 点护盾（不超过 maxShield）
- 击杀回血：2 点
- **教训**：贴脸 Boss 时容易无敌，需要控制护盾生成速率

### 怪物积分（最终平衡值）
| 怪物 | 血量 | 积分 |
|------|------|------|
| grunt | 2 | 6 |
| runner | 2 | 9 |
| tank | 6 | 18 |
| giant | 12 | 38 |
| splitter | 30 | 60 |
| splitterSmall | - | 18 |
| 金币掉落 | - | 18 |

### 装备/打造系统
- **打造价格**：300 积分/次
- **重铸价格**：300 积分/次（排除当前词条后随机）
- **打造上限**：5 个词条，满后可选替换或舍弃
- **词条递减机制**：同 id 词条叠加采用递减——第1个100%、第2个50%、第3个33%、第4个25%、第5个20%
- **装备合成**：3 件同品质 50% 概率合成更高一阶，神话(红)不可合成
- **4 件神话套装效果**：伤害x2、移速x1.5、生命x1.5、暴击+30%、暴击伤害+100%、穿透+3、吸血+15%
- **合成选择栏**：仅显示与选中装备同阶级的装备
- **唯一升级特性**（狂暴、疾跑、双发）不可重复获取

### 难度系统
- 4 大难度（含弑神难度，需要实际挑战性）
- 时间挑战：30 秒内击杀 Boss +500 分，50 秒内 +200 分，HUD 显示倒计时
- Boss 变异系统：触发概率 10%，变异后血量+50%、攻速+30%、技能混搭、紫色光晕、掉落提升一阶
- 无尽模式：通关 8 关后进入，怪物每波 HP+15%/速度+2%，每 5 波强化 Boss，每 3 波提供遗物选择
- 从无尽模式进入 Boss 试炼需重置 5 个状态，防止遗物效果泄露
- 无尽 Boss 击败后用 `pendingEndlessNext` 标记直接进入下一波
- `gameOver` 时必须重置 `bossTimeChallenge.active` 状态
- `startEndlessBoss` 时必须显式重置 `bossVariant` 状态

### 刑天追踪球机制
- 有 30 HP，可被玩家摧毁
- 显示血条和命中反馈
- 3 个环绕球：椭圆运动，每 0.5 秒造成 6 点伤害

---

## 四、手机端控制系统

### 双摇杆（已修复互相抢的 bug）
- **左摇杆**：移动（左下角）
- **右摇杆**：射击方向 + 自动瞄准（右下角）
- **关键修复**：用 `touch.identifier` 跟踪每根手指，左右摇杆互不干扰（之前用 `e.touches[0]` 会导致两根手指串台）
- **死区**：TOUCH_DEADZONE = 0.15

### 其他手机端功能
- **暂停按钮**：左上角圆形按钮，⏸/▶ 切换，弹出面板有「继续游戏」和「返回主菜单」
- **振动反馈**：`navigator.vibrate(30)`，200ms 冷却
- **Boss 方向指示器**：距离 >250 时显示红色箭头（避免手指遮挡看不见 Boss）
- **页面可见性自动暂停**：`visibilitychange` + `window.blur/focus`，切后台自动暂停
- **资源加载进度**：40 张 Boss 图片加载百分比显示
- **竖屏旋转提示遮罩**：手机竖屏时显示「请旋转设备」+ 动画 + 三步指引
- **死亡界面手机端适配**：内容垂直居中，不用下滑也能看到「返回主菜单」按钮

### 手机端浏览器适配（网页版专属）
- **微信内打开**：显示「点右上角 ··· → 在浏览器/Safari 打开」三步指引
- **iOS Safari**：提示「分享 ↗ → 添加到主屏幕」
- **Android 浏览器**：提示「菜单 ⋮ → 添加到主屏幕」+ 「⛶ 全屏播放」按钮
- **全屏 API**：`requestFullscreen` / `webkitRequestFullscreen`
- **standalone 模式**：`window.navigator.standalone` 或 `display-mode: standalone` 检测

### APK 原生配置
- **横屏强制**：`sensorLandscape`（传感器横屏，可左右翻转）
- **沉浸式全屏**：无状态栏、无导航栏
- **权限**：INTERNET、VIBRATE

### 顶部 HUD（已优化）
- **时间/波次面板**：完全去掉背景框，只保留文字（带黑色描边阴影），不遮挡看怪
- **左右血量/积分面板**：保持不变

---

## 五、用户偏好和硬性约束（重要！）

### 用户偏好
- **沟通语言**：中文
- **UI/UX**：
  - 重视视觉清晰度和独特性（如玩家和敌人子弹颜色区分）
  - 横向分页装备布局（不要垂直滚动）
  - Boss 图片要完整显示（不要只露个头）
  - 不喜欢边缘羽化/过渡效果
  - 不喜欢透明 Boss 图片
  - 不喜欢攻击动画脸部凹陷
  - Boss 动作图片改动要最小化（只做小幅姿态调整，如微张嘴、亮眼）
  - Boss 特殊攻击要有动态动画（撕咬、抬手、拍下等）
- **游戏难度**：
  - 喜欢有挑战性的玩法（弑神难度要有实际挑战）
  - Boss 攻击安全区时机要合适
  - 敌方弹幕要可躲避、有反制手段（如刑天追踪球可摧毁）
  - 平衡不要太肝
- **游戏功能**：
  - 装备掉落要多样化
  - 魂器（特殊能力）要功能独特
  - 反馈系统要清晰（如孵化提示）
  - Boss 机制要多样化，不要只会弹幕轰炸

### 硬性约束（不可违反）
1. Boss 宝宝升阶必须消耗 1 只同类 Boss 宝宝，而非积分
2. 装备合成规则：3 件同品质 50% 概率合成更高一阶，神话不可合成
3. 4 件神话装备触发特殊套装效果
4. 唯一升级特性不可重复获取
5. 武器打造上限 5 个词条，满后可选替换或舍弃
6. 装备合成选择栏仅显示同阶级装备
7. 装备词条重铸消耗 300 积分/次
8. 无尽模式通关 8 关后进入
9. 时间挑战 30s/+500 分，50s/+200 分
10. Boss 变异概率 10%
11. 从无尽模式进 Boss 试炼需重置 5 个状态
12. 无尽 Boss 击败后用 `pendingEndlessNext` 直接进下一波
13. `gameOver` 时必须重置 `bossTimeChallenge.active`
14. `startEndlessBoss` 时必须显式重置 `bossVariant`
15. 武器升级用积分购买，T1-T5 定价（0→15000 分），进阶消耗 `upgradePrice × (当前阶段+1)`

### 工程约定
- 同 id 词条叠加采用递减机制：1/N 效果递减

### 存储约束
- 所有需要安装的东西装到 E 盘，不要装 C 盘
- Android SDK 在 `E:\gameidea-roug\sdk\`
- Gradle 缓存在 `E:\gameidea-roug\gradle-home\`（已设用户环境变量 `GRADLE_USER_HOME`）
- Capacitor 项目在 `E:\gameidea-roug\apk\`

---

## 六、历次对话改动汇总（按时间顺序）

### 第一轮：Boss 真实动作动画
**用户反馈**："不是你这 boss 扭动两下就叫动画了吗，没有啥撕咬抬手拍下啥的吗"
- 为 9 个 Boss 生成 attack/attack2/move 三套动作帧
- 文件：`boss_0_a.png` ~ `boss_8_m.png`

### 第二轮：修复动画帧透明/凹陷
**用户反馈**："穷奇都透明了。所有的 boss 的攻击动画也太诡异了，脸凹下去一块"
- **根因**：`upper_half_transform`/`lower_half_transform` 切片变形导致接缝凹陷和 alpha 丢失
- **修复**：完全不做切片变形，原图保持原样，只叠加动作特效层
- JS 端缓存版本号升到 `?v=8`

### 第三轮：游戏平衡调整
**用户反馈**："武器装备和积分不太平衡，我打两把就直接能买最贵的武器了都，然后干戚那个加盾有点太超标了"
- 怪物积分降 50%
- 武器价格涨 2-3 倍
- 刑天干戚削弱（伤害、射速、暴击、护盾、回血）
- 打造词条递减机制
- 打造/重铸价格提升

### 第四轮：平衡回调
**用户反馈**："有点肝了确实"
- 怪物积分回调到原版 75%
- 武器价格回调到约 1.5 倍
- 重铸价格 500→300
- 刑天干戚小幅加强（保留关键削弱）

### 第五轮：手机端兼容
**用户反馈**："你有做手机端的兼容和考虑手机玩家的措施吗，我是要发给别人玩的"
- 页面可见性自动暂停
- 资源加载进度显示
- 暂停按钮（手机/PC 通用）
- 振动反馈（30ms，200ms 冷却）
- Boss 方向指示器（距离 >250 时显示红色箭头）

### 第六轮：APK 打包
**用户反馈**："我想弄成 apk 那样，就是别人可以下载来玩"
- 用户选择：Capacitor 本地打包
- 用户环境：Node.js + JDK 17
- 安装 Android SDK 到 E 盘（清华镜像 404，改用 Google 官方源）
- 用 Capacitor 6.2.1（7/8 版本要求 JDK 21，不兼容）
- Gradle 走腾讯云 + 阿里云镜像
- 最终 APK：`山海经肉鸽.apk`（39.32 MB）

### 第七轮：首页署名
**用户反馈**："你在首页加个，edeka制作"
- 首页底部加「✦ Edeka 制作 ✦」金色楷体署名

### 第八轮：摇杆 bug 修复 + 顶部面板优化
**用户反馈**："操控的时候左边的移动摇杆和右边的攻击摇杆会抢" + "战斗时正上方那个显示时间和波次的选项卡弄小一点，弄成透明的"
- 用 `touch.identifier` 跟踪每根手指，修复摇杆串台
- 顶部时间/波次面板：完全去掉背景框，只保留文字（带黑色描边）

### 第九轮：暂停返回主菜单 + 死亡界面手机适配
**用户反馈**："暂停加个回到首页的选项呗" + "人物死后弹的再来一次下面那个返回首页，手机端不往下滑都看不到"
- 暂停面板加「🏠 返回主菜单」按钮
- 死亡界面垂直居中，间距压缩

### 第十轮：安装教程
**用户反馈**："给个安装教程，苹果和安卓的"
- 生成 `安装教程.txt`，包含安卓 3 步安装 + iOS 备选方案

### 第十一轮：GitHub Pages 网页版部署
**用户反馈**："行"（同意部署网页版）
- 用户有 GitHub 账号，仓库地址：`https://github.com/edekap/shanhai-roguelike.git`
- 用户名：edekap
- 安装 GitHub CLI 到 `E:\gh-cli\`（最终没用上，改用 git 直接推送）
- 第一次推送失败（直连 GitHub 超时），用户切到国际漫游热点后成功
- 推送成功，GitHub Pages 已开启
- 网页版地址：https://edekap.github.io/shanhai-roguelike/

### 第十二轮：网页版竖屏问题
**用户反馈**："手机端打开怎么是竖屏啊"
- 加竖屏旋转提示遮罩（仅手机端竖屏时显示）
- 旋转动画 + 「请旋转设备」金色文字

### 第十三轮：微信竖屏 + 浏览器遮挡
**用户反馈**："微信打开网页手机甩不了横屏啊，浏览器打开他那些搜索框又很挡游戏"
- 遮罩加三步指引（微信用户、浏览器用户、最佳体验）
- 加「⛶ 全屏播放」按钮
- 首页加全屏提示和「添加到主屏幕」指引

### 第十四轮：iOS 提示缺失修复
**用户反馈**："没有ios的提示啊怎么"
- **根因**：微信内检测时直接 return，导致 iOS 提示不显示
- **修复**：微信内也显示完整三步提示（微信 → Safari/浏览器 → 添加到主屏幕）
- 区分 iOS 和 Android 显示不同步骤文案

---

## 七、APK 打包流程（重要！下次打包用）

### 环境变量
```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot'
$env:ANDROID_HOME='E:\gameidea-roug\sdk'
```

### 重新打包 APK（改了代码后）
```powershell
# 1. 同步 index.html 到 Capacitor 项目
Copy-Item 'e:\gameidea-roug\index.html' 'e:\gameidea-roug\apk\www\index.html' -Force

# 2. 同步资源到 Android
Set-Location 'e:\gameidea-roug\apk'
npx cap sync android

# 3. 构建 APK
Set-Location 'e:\gameidea-roug\apk\android'
.\gradlew.bat assembleDebug

# 4. 复制到根目录
Copy-Item 'app\build\outputs\apk\debug\app-debug.apk' 'e:\gameidea-roug\山海经肉鸽.apk' -Force
```

### 网页版更新流程
```powershell
Set-Location 'e:\gameidea-roug'
git add index.html
git commit -m '描述改动'
git push origin main
# 等 1-2 分钟 GitHub Pages 自动构建
```

---

## 八、踩坑记录（避免重复）

### 1. Capacitor 版本选择
- Capacitor 7/8 硬编码 `JavaVersion.VERSION_21`，需要 JDK 21
- 用户电脑是 JDK 17，必须用 **Capacitor 6.2.1**

### 2. 国内 GitHub 访问
- 直连 github.com 经常超时（443 端口被中断）
- 解决方案：用户切到国际漫游热点，或配代理 `git config --global http.proxy http://127.0.0.1:7890`

### 3. Android SDK 镜像
- 清华镜像 `mirrors.tuna.tsinghua.edu.cn` 返回 404
- 改用 Google 官方源 `dl.google.com/android/repository/`

### 4. SDK 解压目录嵌套
- 解压后出现 `latest\cmdline-tools\` 嵌套
- 用 `Move-Item` 逐个移动到 `latest` 目录

### 5. TRAE 沙箱白名单
- `E:\android-sdk\` 不在白名单
- 解决方案：SDK 改装到 `E:\gameidea-roug\sdk\`（在白名单内）

### 6. PowerShell heredoc 不支持
- `git commit -m "$(cat <<'EOF'..."` 在 PowerShell 里报错
- 解决方案：用简单字符串 `git commit -m '简单描述'`

### 7. Boss 动画切片变形
- `upper_half_transform`/`lower_half_transform` 切片变形导致接缝凹陷和 alpha 丢失
- 解决方案：完全不切片，原图保持原样，只叠加特效层

### 8. 摇杆互相抢
- `e.touches[0]` 在多指触摸时会取到对方手指
- 解决方案：用 `touch.identifier` 给每根手指打标签

### 9. 微信内 iOS 提示不显示
- 微信检测后直接 return，导致后续 iOS 提示不执行
- 解决方案：微信内也显示完整三步提示，不要提前 return

---

## 九、当前未完成事项 / 待办

暂无明确待办。游戏功能完整，三种分发方式（APK/网页/电脑）都可用。

可能的后续改进方向：
- [ ] 上架应用商店（需要软件著作权 + 审核）
- [ ] 部署 Gitee Pages 作为国内备用镜像（需要实名认证）
- [ ] 生成 release 版 APK（自签名，用于上架）
- [ ] 添加更多 Boss 机制（用户要求"不要只会弹幕轰炸"）
- [ ] 持续平衡性调整

---

## 十、关键文件位置速查

| 文件 | 路径 |
|------|------|
| 主游戏 | `e:\gameidea-roug\index.html` |
| APK | `e:\gameidea-roug\山海经肉鸽.apk` |
| 安装教程 | `e:\gameidea-roug\安装教程.txt` |
| Boss 动画生成器 | `e:\gameidea-roug\gen_boss_anim.py` |
| Boss 基础帧生成器 | `e:\gameidea-roug\gen_boss_frames.py` |
| Boss 图片资源 | `e:\gameidea-roug\assets\bosses\` |
| Capacitor 项目 | `e:\gameidea-roug\apk\` |
| Android SDK | `e:\gameidea-roug\sdk\` |
| Gradle 缓存 | `e:\gameidea-roug\gradle-home\` |
| GitHub CLI | `E:\gh-cli\` |
| 项目上下文文档 | `e:\gameidea-roug\项目上下文_Trae衔接.md`（本文件） |

---

## 十一、给 Trae 的衔接说明

如果你是 Trae，收到这份文档后：

1. **用户偏好**：用中文沟通，重视视觉清晰度，游戏要有挑战性但不肝，所有安装装 E 盘
2. **代码风格**：单文件 HTML5 Canvas 游戏，无框架，直接编辑 `index.html`
3. **改图后**：递增 `?v=` 版本号（当前 v=8）
4. **打包 APK**：按第七节流程，用 Capacitor 6.2.1 + JDK 17
5. **更新网页版**：`git push origin main`，等 Pages 自动构建
6. **不要做的事**：
   - 不要切片变形 Boss 图片
   - 不要用 `e.touches[0]` 取触摸点（用 `touch.identifier`）
   - 不要用 Capacitor 7/8（需要 JDK 21）
   - 不要装东西到 C 盘
   - 不要在微信检测里提前 return（会漏掉 iOS 提示）
7. **硬性约束**：见第五节，不可违反

---

**文档生成时间**：2026-07-17
**最后更新**：第 14 轮对话后（iOS 提示修复）
**当前 APK 大小**：39.32 MB
**当前 git commit**：952233e
