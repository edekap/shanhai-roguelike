"""
Boss动作图：原图保持不变 + 程序化叠加动作特效层（避免切片变形导致的凹陷和透明）
- _a.png：主攻击动作 = 原图 + 攻击特效层（撕咬光晕/火焰/爪影/冲击波等）
- _a2.png：副攻击动作 = 原图 + 特殊技能特效层（光晕/裂缝/引力环等）
- _m.png：移动动作 = 原图 + 整体位移倾斜 + 运动线条
"""
from PIL import Image, ImageDraw, ImageFilter
import os, math, random

random.seed(42)
BOSS_DIR = 'assets/bosses'
SIZE = 1024

BOSS_ACTIONS = {
    0: {'name':'九尾狐', 'a':'claw_swipe',  'a2':'charm_aura',  'm':'pounce'},
    1: {'name':'毕方',   'a':'dive_bomb',   'a2':'fire_breath', 'm':'soar'},
    2: {'name':'相柳',   'a':'multi_bite',  'a2':'poison_spray','m':'slither'},
    3: {'name':'朱厌',   'a':'smash_down',  'a2':'rock_raise',  'm':'leap'},
    4: {'name':'烛龙',   'a':'breath_fire', 'a2':'claw_extend', 'm':'flight'},
    5: {'name':'饕餮',   'a':'devour_bite', 'a2':'gravity_pull','m':'lunge'},
    6: {'name':'英招',   'a':'wing_strike', 'a2':'wind_blade',  'm':'glide'},
    7: {'name':'计蒙',   'a':'water_spray', 'a2':'claw_extend', 'm':'flight'},
    8: {'name':'穷奇',   'a':'pounce_bite', 'a2':'void_tear',   'm':'dash'},
    9: {'name':'刑天',   'a':'axe_smash',   'a2':'halberd_swing','m':'charge'},
}

# ===== 通用工具 =====

def get_bbox(img):
    return img.split()[3].getbbox()

def add_glow(img, cx, cy, radius, color, intensity=0.7):
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    for r in range(int(radius), 0, -3):
        alpha = int(255 * intensity * (1 - r/radius)**2 * 0.15)
        if alpha < 1: continue
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=color+(alpha,))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=8))
    return Image.alpha_composite(img, glow)

def add_claw_arc(img, cx, cy, radius, angle_start, angle_end, color, width=15):
    arc = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(arc)
    bbox = [cx-radius, cy-radius, cx+radius, cy+radius]
    draw.arc(bbox, angle_start, angle_end, fill=color+(200,), width=width)
    arc = arc.filter(ImageFilter.GaussianBlur(radius=3))
    return Image.alpha_composite(img, arc)

def add_fire_breath(img, cx, cy, length=400, angle=0, color=(255, 100, 30)):
    flame = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(flame)
    for i in range(length):
        t = i / length
        r = int(15 + 30 * math.sin(t * math.pi) + 20 * random.random())
        x = cx + int(i * math.cos(angle))
        y = cy + int(i * math.sin(angle))
        alpha = int(220 * (1 - t)**1.5)
        c = (
            min(255, color[0] + int(30 * random.random())),
            min(255, color[1] + int(20 * random.random())),
            color[2], alpha
        )
        draw.ellipse([x-r, y-r, x+r, y+r], fill=c)
    flame = flame.filter(ImageFilter.GaussianBlur(radius=4))
    return Image.alpha_composite(img, flame)

def add_poison_spray(img, cx, cy, color=(100, 200, 50)):
    spray = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(spray)
    for _ in range(80):
        angle = random.uniform(-math.pi/3, math.pi/3) - math.pi/2
        dist = random.randint(50, 380)
        x = cx + int(dist * math.cos(angle))
        y = cy + int(dist * math.sin(angle))
        r = random.randint(8, 28)
        alpha = random.randint(120, 220)
        draw.ellipse([x-r, y-r, x+r, y+r], fill=color+(alpha,))
    spray = spray.filter(ImageFilter.GaussianBlur(radius=3))
    return Image.alpha_composite(img, spray)

def add_shockwave(img, cx, cy, radius, color=(255, 230, 100)):
    wave = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(wave)
    for i in range(6):
        r = radius + i * 18
        alpha = max(0, 220 - i * 35)
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=color+(alpha,), width=10)
    wave = wave.filter(ImageFilter.GaussianBlur(radius=3))
    return Image.alpha_composite(img, wave)

def add_motion_lines(img, direction='down', count=8, color=(255, 255, 255)):
    lines = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(lines)
    w, h = img.size
    for i in range(count):
        if direction == 'down':
            x = random.randint(100, w-100)
            y1 = random.randint(0, h//3)
            y2 = y1 + random.randint(80, 180)
            draw.line([(x, y1), (x, y2)], fill=color+(100,), width=4)
        elif direction == 'up':
            x = random.randint(100, w-100)
            y2 = random.randint(h//2, h)
            y1 = y2 - random.randint(80, 180)
            draw.line([(x, y1), (x, y2)], fill=color+(100,), width=4)
        elif direction == 'right':
            y = random.randint(100, h-100)
            x1 = random.randint(0, w//3)
            x2 = x1 + random.randint(80, 180)
            draw.line([(x1, y), (x2, y)], fill=color+(100,), width=4)
        elif direction == 'forward':
            cx, cy = w//2, h//2
            angle = random.uniform(0, math.pi*2)
            r1 = random.randint(400, 500)
            r2 = random.randint(200, 300)
            x1 = cx + int(r1 * math.cos(angle))
            y1 = cy + int(r1 * math.sin(angle))
            x2 = cx + int(r2 * math.cos(angle))
            y2 = cy + int(r2 * math.sin(angle))
            draw.line([(x1, y1), (x2, y2)], fill=color+(120,), width=3)
    lines = lines.filter(ImageFilter.GaussianBlur(radius=2))
    return Image.alpha_composite(img, lines)

def add_bite_effect(img, mouth_x, mouth_y, color=(255, 50, 50), size=80):
    """张口咬合特效：红色口腔光晕 + 牙齿闪光（不破坏原图，只叠加）"""
    bite = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(bite)
    # 张口红色光晕（叠加在嘴部位置）
    for r in range(size, 0, -3):
        alpha = int(180 * (1 - r/size)**2 * 0.4)
        if alpha < 1: continue
        draw.ellipse([mouth_x-r, mouth_y-r, mouth_x+r, mouth_y+r], fill=color+(alpha,))
    # 牙齿闪光（白色小三角）
    for i in range(7):
        angle = -math.pi/2 + (i - 3) * 0.18
        tx = mouth_x + int(size * 0.45 * math.cos(angle))
        ty = mouth_y + int(size * 0.45 * math.sin(angle))
        tooth_h = int(size * 0.18)
        draw.polygon([(tx-5, ty-tooth_h), (tx+5, ty-tooth_h), (tx, ty+tooth_h//2)], fill=(255, 255, 255, 240))
    bite = bite.filter(ImageFilter.GaussianBlur(radius=2))
    return Image.alpha_composite(img, bite)

def add_weapon_trail(img, cx, cy, angle, length=350, color=(255, 200, 50)):
    trail = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(trail)
    for i in range(25):
        t = i / 25
        r = length * (1 - t * 0.3)
        a = angle + (t - 0.5) * 1.4
        x = cx + int(r * math.cos(a))
        y = cy + int(r * math.sin(a))
        rr = int(18 * (1 - t) + 5)
        alpha = int(230 * (1 - t)**1.5)
        draw.ellipse([x-rr, y-rr, x+rr, y+rr], fill=color+(alpha,))
    trail = trail.filter(ImageFilter.GaussianBlur(radius=5))
    return Image.alpha_composite(img, trail)

def add_void_rift(img, cx, cy, length=400, angle=0, color=(150, 50, 200)):
    rift = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(rift)
    points = []
    for i in range(length):
        t = i / length
        x = cx + int(i * math.cos(angle))
        y = cy + int(i * math.sin(angle)) + int(25 * math.sin(t * math.pi * 3))
        points.append((x, y))
    for i, (x, y) in enumerate(points):
        t = i / len(points)
        w = int(25 * math.sin(t * math.pi))
        if w > 0:
            draw.ellipse([x-w, y-w, x+w, y+w], fill=color+(180,))
    for i in range(0, len(points), 8):
        x, y = points[i]
        for r in range(50, 0, -4):
            alpha = int(70 * (1 - r/50)**2)
            draw.ellipse([x-r, y-r, x+r, y+r], fill=color+(alpha,))
    rift = rift.filter(ImageFilter.GaussianBlur(radius=4))
    return Image.alpha_composite(img, rift)

def add_water_jet(img, cx, cy, length=400, angle=0, color=(80, 150, 230)):
    jet = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(jet)
    for i in range(length):
        t = i / length
        r = int(10 + 28 * math.sin(t * math.pi) + 8 * math.sin(t * math.pi * 5))
        x = cx + int(i * math.cos(angle))
        y = cy + int(i * math.sin(angle))
        alpha = int(210 * (1 - t)**1.2)
        c = (
            max(0, color[0] - int(30 * t)),
            min(255, color[1] + int(20 * t)),
            min(255, color[2] + int(20 * t)), alpha
        )
        draw.ellipse([x-r, y-r, x+r, y+r], fill=c)
    jet = jet.filter(ImageFilter.GaussianBlur(radius=3))
    return Image.alpha_composite(img, jet)

def whole_transform_keep_canvas(img, dx=0, dy=0, rotate=0, scale=1.0, skew_x=0):
    """整体变换但保持1024x1024 canvas，居中"""
    w, h = img.size
    if scale != 1.0:
        new_w = max(1, int(w * scale))
        new_h = max(1, int(h * scale))
        img = img.resize((new_w, new_h), Image.BICUBIC)
        w, h = img.size
    if rotate != 0:
        img = img.rotate(rotate, expand=True, resample=Image.BICUBIC)
        w, h = img.size
    if skew_x != 0:
        matrix = (1, skew_x, 0, 0, 1, 0)
        img = img.transform((w, h), Image.AFFINE, matrix, resample=Image.BICUBIC)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    paste_x = (SIZE - w) // 2 + dx
    paste_y = (SIZE - h) // 2 + dy
    canvas.paste(img, (paste_x, paste_y), img)
    return canvas

# ===== 生成动作帧 =====

def gen_action(idx, action_type, base_img):
    info = BOSS_ACTIONS[idx]
    bbox = get_bbox(base_img)
    if not bbox: return base_img
    cx = (bbox[0] + bbox[2]) // 2
    cy = (bbox[1] + bbox[3]) // 2
    body_w = bbox[2] - bbox[0]
    body_h = bbox[3] - bbox[1]
    mouth_x = cx
    mouth_y = bbox[1] + int(body_h * 0.25)
    img = base_img.copy()

    # ===== 主攻击 a =====
    if action_type == 'claw_swipe':
        img = add_claw_arc(img, cx, cy+50, body_w//2 + 80, 200, 340, (255, 200, 220), width=22)
        img = add_claw_arc(img, cx, cy+50, body_w//2 + 50, 220, 320, (255, 240, 250), width=12)
        img = add_glow(img, cx, cy+50, body_w//2, (255, 150, 200), 0.6)
        img = add_motion_lines(img, 'forward', 8, (255, 180, 220))
    elif action_type == 'dive_bomb':
        img = add_motion_lines(img, 'down', 14, (255, 150, 50))
        img = add_glow(img, cx, cy+body_h//4, body_w//2 + 30, (255, 100, 30), 0.8)
        img = add_fire_breath(img, cx, cy+50, length=250, angle=math.pi/2, color=(255, 120, 30))
    elif action_type == 'multi_bite':
        # 九个张口光晕（横向排开）
        for i in range(9):
            ox = cx + (i - 4) * 60
            oy = bbox[1] + int(body_h * 0.15) + (i % 2) * 30
            img = add_bite_effect(img, ox, oy, (150, 220, 50), size=50)
        img = add_motion_lines(img, 'down', 8, (150, 220, 50))
        img = add_glow(img, cx, cy, body_w//2, (100, 200, 50), 0.4)
    elif action_type == 'smash_down':
        img = add_shockwave(img, cx, bbox[3]+30, body_w//2 + 40, (255, 200, 80))
        img = add_shockwave(img, cx, bbox[3]+30, body_w//2 + 80, (255, 150, 50))
        img = add_motion_lines(img, 'down', 16, (255, 200, 100))
        img = add_glow(img, cx, bbox[3], body_w//2, (255, 180, 50), 0.7)
    elif action_type == 'breath_fire':
        img = add_bite_effect(img, mouth_x, mouth_y, (255, 80, 30), size=90)
        img = add_fire_breath(img, mouth_x, mouth_y, length=450, angle=math.pi/2, color=(255, 100, 30))
        img = add_glow(img, mouth_x, mouth_y, 140, (255, 150, 50), 0.9)
    elif action_type == 'devour_bite':
        img = add_bite_effect(img, mouth_x, mouth_y, (180, 50, 200), size=140)
        img = add_glow(img, mouth_x, mouth_y, 200, (130, 30, 180), 1.0)
        img = add_motion_lines(img, 'forward', 12, (200, 100, 220))
    elif action_type == 'wing_strike':
        img = add_claw_arc(img, cx, cy, body_w//2 + 80, 180, 360, (150, 230, 220), width=20)
        img = add_claw_arc(img, cx, cy, body_w//2 + 120, 200, 340, (200, 250, 240), width=10)
        img = add_glow(img, cx, cy, body_w//2 + 30, (100, 200, 220), 0.6)
        img = add_motion_lines(img, 'forward', 10, (180, 230, 220))
    elif action_type == 'water_spray':
        img = add_bite_effect(img, mouth_x, mouth_y, (80, 150, 230), size=90)
        img = add_water_jet(img, mouth_x, mouth_y, length=450, angle=math.pi/2, color=(80, 150, 230))
        img = add_glow(img, mouth_x, mouth_y, 140, (100, 180, 240), 0.8)
    elif action_type == 'pounce_bite':
        img = add_bite_effect(img, mouth_x, mouth_y, (180, 80, 220), size=110)
        img = add_motion_lines(img, 'forward', 14, (200, 100, 230))
        img = add_glow(img, cx, cy, body_w//2 + 30, (150, 50, 200), 0.6)
        img = add_claw_arc(img, cx, cy+30, body_w//2 + 40, 250, 290, (220, 120, 240), width=14)
    elif action_type == 'axe_smash':
        img = add_weapon_trail(img, cx, cy, angle=math.pi/2, length=450, color=(255, 180, 50))
        img = add_weapon_trail(img, cx, cy, angle=math.pi/2 + 0.2, length=380, color=(255, 220, 100))
        img = add_shockwave(img, cx, bbox[3]+30, body_w//2 + 40, (255, 150, 50))
        img = add_shockwave(img, cx, bbox[3]+30, body_w//2 + 80, (255, 100, 30))
        img = add_motion_lines(img, 'down', 16, (255, 150, 50))

    # ===== 副攻击 a2 =====
    elif action_type == 'charm_aura':
        for i in range(8):
            angle = i * math.pi / 4
            ox = cx + int(140 * math.cos(angle))
            oy = cy + int(140 * math.sin(angle))
            img = add_glow(img, ox, oy, 70, (255, 100, 200), 0.7)
        img = add_glow(img, cx, cy, body_w//2 + 60, (255, 150, 220), 0.6)
        img = add_glow(img, cx, cy, body_w//2 + 100, (255, 200, 240), 0.4)
    elif action_type == 'fire_breath':
        img = add_bite_effect(img, mouth_x, mouth_y, (255, 100, 30), size=90)
        img = add_fire_breath(img, mouth_x, mouth_y, length=400, angle=math.pi/2, color=(255, 80, 20))
        img = add_glow(img, mouth_x, mouth_y, 130, (255, 130, 40), 0.8)
    elif action_type == 'poison_spray':
        img = add_poison_spray(img, mouth_x, mouth_y, (100, 220, 50))
        img = add_glow(img, mouth_x, mouth_y, 120, (100, 200, 50), 0.7)
    elif action_type == 'rock_raise':
        # 上方凝聚岩石光晕
        img = add_glow(img, cx, bbox[1]-60, 110, (220, 160, 80), 0.9)
        img = add_glow(img, cx, bbox[1]-60, 70, (255, 200, 100), 1.0)
        img = add_motion_lines(img, 'up', 12, (220, 180, 100))
    elif action_type == 'claw_extend':
        img = add_claw_arc(img, cx, cy+80, body_w//2 + 120, 250, 290, (255, 200, 100), width=16)
        img = add_claw_arc(img, cx, cy+80, body_w//2 + 80, 260, 280, (255, 240, 180), width=8)
        img = add_glow(img, cx, cy+80, 100, (255, 200, 100), 0.6)
    elif action_type == 'gravity_pull':
        # 多层旋转引力环
        for i in range(8):
            angle = i * math.pi / 4
            ox = cx + int(170 * math.cos(angle))
            oy = cy + int(170 * math.sin(angle))
            img = add_glow(img, ox, oy, 70, (130, 50, 180), 0.7)
        img = add_glow(img, cx, cy, body_w//2 + 80, (100, 30, 150), 0.8)
        img = add_glow(img, cx, cy, body_w//2 + 40, (160, 80, 200), 0.6)
    elif action_type == 'wind_blade':
        for i in range(5):
            angle = -math.pi/2 + (i - 2) * 0.35
            ox = cx + int(220 * math.cos(angle))
            oy = cy + int(220 * math.sin(angle))
            img = add_claw_arc(img, ox, oy, 80, 0, 360, (180, 230, 220), width=12)
        img = add_motion_lines(img, 'forward', 10, (180, 230, 220))
    elif action_type == 'void_tear':
        # 3条交错的虚空裂缝
        img = add_void_rift(img, cx-50, cy, length=400, angle=math.pi/2 + 0.2, color=(150, 50, 200))
        img = add_void_rift(img, cx+50, cy, length=400, angle=math.pi/2 - 0.2, color=(180, 80, 220))
        img = add_void_rift(img, cx, cy, length=450, angle=math.pi/2, color=(120, 30, 180))
        img = add_glow(img, cx, cy, body_w//2 + 40, (130, 30, 180), 0.7)
    elif action_type == 'halberd_swing':
        # 左右双向武器轨迹
        img = add_weapon_trail(img, cx, cy, angle=0, length=450, color=(255, 100, 50))
        img = add_weapon_trail(img, cx, cy, angle=math.pi, length=450, color=(255, 100, 50))
        img = add_weapon_trail(img, cx, cy, angle=0.3, length=380, color=(255, 200, 100))
        img = add_weapon_trail(img, cx, cy, angle=math.pi-0.3, length=380, color=(255, 200, 100))
        img = add_motion_lines(img, 'right', 12, (255, 150, 80))

    # ===== 移动 m =====
    elif action_type == 'pounce':
        img = whole_transform_keep_canvas(img, dx=0, dy=-30, rotate=-5, scale=1.03)
        img = add_motion_lines(img, 'forward', 8, (255, 200, 220))
    elif action_type == 'soar':
        img = whole_transform_keep_canvas(img, dx=0, dy=-25, scale=1.05)
        img = add_motion_lines(img, 'forward', 6, (255, 200, 100))
    elif action_type == 'slither':
        img = whole_transform_keep_canvas(img, dx=15, dy=0, rotate=3, skew_x=0.04)
        img = add_motion_lines(img, 'right', 8, (180, 230, 100))
    elif action_type == 'leap':
        img = whole_transform_keep_canvas(img, dx=0, dy=-40, rotate=-6, scale=1.03)
        img = add_motion_lines(img, 'down', 6, (255, 200, 100))
    elif action_type == 'flight':
        img = whole_transform_keep_canvas(img, dx=0, dy=-25, rotate=-3, scale=1.04)
        img = add_motion_lines(img, 'forward', 8, (255, 200, 100))
    elif action_type == 'lunge':
        img = whole_transform_keep_canvas(img, dx=0, dy=-15, rotate=-4, scale=1.05)
        img = add_motion_lines(img, 'forward', 8, (200, 100, 220))
    elif action_type == 'glide':
        img = whole_transform_keep_canvas(img, dx=0, dy=-20, scale=1.06)
        img = add_motion_lines(img, 'forward', 7, (180, 230, 220))
    elif action_type == 'dash':
        img = whole_transform_keep_canvas(img, dx=20, dy=-15, rotate=-4, scale=1.03)
        img = add_motion_lines(img, 'right', 10, (200, 100, 230))
    elif action_type == 'charge':
        img = whole_transform_keep_canvas(img, dx=15, dy=-10, rotate=-2, scale=1.03)
        img = add_motion_lines(img, 'right', 12, (255, 150, 80))

    return img

def main():
    print('=== 重新生成Boss动作图（不破坏原图，仅叠加特效）===')
    for idx in range(10):
        info = BOSS_ACTIONS[idx]
        base_path = os.path.join(BOSS_DIR, f'boss_{idx}.png')
        base = Image.open(base_path).convert('RGBA')
        print(f'[{idx}] {info["name"]}: {info["a"]} / {info["a2"]} / {info["m"]}')
        # 主攻击
        img_a = gen_action(idx, info['a'], base)
        img_a.save(os.path.join(BOSS_DIR, f'boss_{idx}_a.png'))
        # 副攻击
        img_a2 = gen_action(idx, info['a2'], base)
        img_a2.save(os.path.join(BOSS_DIR, f'boss_{idx}_a2.png'))
        # 移动
        img_m = gen_action(idx, info['m'], base)
        img_m.save(os.path.join(BOSS_DIR, f'boss_{idx}_m.png'))
    print('=== 完成 ===')

if __name__ == '__main__':
    main()
