#!/usr/bin/env python3
"""
为每个Boss生成动作动画帧
- boss_X.png : idle（原样）
- boss_X_a.png : attack（放大+倾斜，模拟攻击前冲）
- boss_X_m.png : move（位移+轻微旋转，模拟移动）
"""
import os
import numpy as np
from PIL import Image

boss_dir = r"e:\gameidea-roug\assets\bosses"

def transform_to_attack(img):
    """攻击帧：放大8%+轻微倾斜"""
    w, h = img.size
    # 放大8%
    new_w, new_h = int(w * 1.08), int(h * 1.08)
    scaled = img.resize((new_w, new_h), Image.LANCZOS)
    # 轻微旋转2度（模拟攻击前冲倾斜）
    rotated = scaled.rotate(-2, expand=False, resample=Image.BICUBIC, center=(new_w//2, new_h//2))
    # 裁剪回原尺寸（居中）
    left = (new_w - w) // 2
    top = (new_h - h) // 2
    return rotated.crop((left, top, left + w, top + h))


def transform_to_move(img):
    """移动帧：向上位移+轻微旋转，模拟移动中的摆动"""
    w, h = img.size
    # 创建新画布，向上位移10px
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    # 轻微旋转1.5度
    rotated = img.rotate(1.5, expand=False, resample=Image.BICUBIC, center=(w//2, h//2))
    # 向上位移
    canvas.paste(rotated, (0, -10), rotated)
    return canvas


for i in range(9):  # boss_0 ~ boss_8
    src = os.path.join(boss_dir, f"boss_{i}.png")
    if not os.path.exists(src):
        print(f"[SKIP] boss_{i}.png 不存在")
        continue

    img = Image.open(src)
    print(f"处理 boss_{i}.png ({img.size})")

    # 生成攻击帧
    attack = transform_to_attack(img)
    attack_path = os.path.join(boss_dir, f"boss_{i}_a.png")
    attack.save(attack_path, "PNG")

    # 生成移动帧
    move = transform_to_move(img)
    move_path = os.path.join(boss_dir, f"boss_{i}_m.png")
    move.save(move_path, "PNG")

    print(f"  生成: boss_{i}_a.png, boss_{i}_m.png")

print("\n✅ 所有Boss动作帧生成完成！")
