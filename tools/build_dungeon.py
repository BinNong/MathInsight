#!/usr/bin/env python3
"""离线拼贴「微积分秘境」地牢场景与室外石门（Anokolisa 像素包 Dungeon_Tiles/Props）。

输出：
  frontend/public/assets/world2d/pixel/rooms/dungeon.png        秘境试炼场（320×208，20×13 瓦片）
  frontend/public/assets/world2d/pixel/buildings/dungeon-gate.png  室外秘境石门（112×96）

运行：.venv/bin/python tools/build_dungeon.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PIX = ROOT / 'Pixel'
OUT = ROOT / 'frontend/public/assets/world2d/pixel'

DT = Image.open(PIX / 'Environment/Tilesets/Dungeon_Tiles.png').convert('RGBA')
DP = Image.open(PIX / 'Environment/Props/Static/Dungeon_Props.png').convert('RGBA')
ROCKS = Image.open(PIX / 'Environment/Props/Static/Rocks.png').convert('RGBA')

ROOM_W, ROOM_H = 320, 208  # 20×13 瓦片


def S(img, x, y, w, h):
    return img.crop((x, y, x + w, y + h))


def put(dst, img, bx, by):
    """底部中心锚点摆放"""
    dst.alpha_composite(img, (round(bx - img.width / 2), round(by - img.height)))


# ---------------------------------------------------------------- 素材矩形
# 墙体：顶部亮边 + 深色砖 fill
WALL_TOP = (16, 0, 16, 16)
WALL_FILL = [(16, 16, 16, 16), (32, 16, 16, 16), (16, 32, 16, 16), (32, 32, 16, 16)]
# 地板：青黑石砖
FLOOR = [(80, 16, 16, 16), (96, 16, 16, 16), (80, 32, 16, 16), (96, 32, 16, 16)]
# 装饰
ARCH_DOOR = (0, 110, 40, 52)      # 拱形木门
PORTCULLIS = (41, 112, 33, 50)    # 铁闸门（裁掉右侧尖刺条）
BANNER = (96, 168, 15, 56)        # 橙色长幡
FENCE_RED = (0, 232, 48, 48)      # 红符文栅栏
FENCE_BLUE = (48, 232, 48, 48)    # 蓝符文栅栏
PAD_ORANGE = (0, 288, 48, 52)     # 橙符文法阵
PAD_BLUE = (48, 288, 48, 52)      # 蓝符文法阵
PAD_GREEN = (96, 288, 48, 52)     # 绿符文法阵
# Dungeon_Props：壁灯 / 彩旗 / 拱窗
SCONCE_A = (0, 32, 16, 32)
SCONCE_B = (48, 32, 16, 32)
FLAG_R = (72, 72, 16, 24)
FLAG_B = (88, 72, 16, 24)
FLAG_G = (104, 72, 16, 24)
ARCH_WINDOW = (96, 0, 24, 28)

import random
rng = random.Random(20260722)


def build_room() -> Image.Image:
    r = Image.new('RGBA', (ROOM_W, ROOM_H), (5, 6, 10, 255))
    # 地板（先铺，墙压顶边）
    for y in range(40, ROOM_H, 16):
        for x in range(0, ROOM_W, 16):
            r.alpha_composite(S(DT, *FLOOR[rng.randrange(len(FLOOR))]), (x, y))
    # 后墙三行：顶行亮边 + 两行砖
    for x in range(0, ROOM_W, 16):
        r.alpha_composite(S(DT, *WALL_TOP), (x, 0))
    for y in (16, 32):
        for x in range(0, ROOM_W, 16):
            r.alpha_composite(S(DT, *WALL_FILL[rng.randrange(len(WALL_FILL))]), (x, y))
    # 墙上装饰：拱门(左) + 铁闸门(右) + 长幡 + 壁灯
    put(r, S(DT, *ARCH_DOOR), 56, 46)
    put(r, S(DT, *PORTCULLIS), 264, 46)
    put(r, S(DT, *BANNER), 160, 60)
    put(r, S(DT, *BANNER), 104, 58)
    put(r, S(DT, *BANNER), 216, 58)
    for x in (24, 128, 192, 296):
        put(r, S(DP, *SCONCE_A if x % 64 else SCONCE_B), x, 40)
    # 三色小彩旗（挂在墙裙）
    put(r, S(DP, *FLAG_R), 76, 52)
    put(r, S(DP, *FLAG_B), 160, 52)
    put(r, S(DP, *FLAG_G), 244, 52)
    # 符文栅栏：左右两侧场地边界（红左蓝右）
    put(r, S(DT, *FENCE_RED), 36, 130)
    put(r, S(DT, *FENCE_BLUE), 284, 130)
    # 符文法阵：蓝阵中央（试炼触发）、橙阵出口门垫、绿阵守关人角落
    put(r, S(DT, *PAD_BLUE), 160, 140)
    put(r, S(DT, *PAD_ORANGE), 160, 202)
    put(r, S(DT, *PAD_GREEN), 44, 190)
    return r


def build_gate() -> Image.Image:
    """室外石门：砖墙拱卫 + 铁闸门 + 壁灯 + 巨石，底部中心在 (56,96)"""
    g = Image.new('RGBA', (112, 96), (0, 0, 0, 0))
    # 墙体 7 列 × 4 行（中央留门洞 2 列）
    for y in range(16, 80, 16):
        for x in range(8, 104, 16):
            if 40 <= x < 72 and y >= 32:
                continue  # 门洞
            r = WALL_FILL[rng.randrange(len(WALL_FILL))]
            g.alpha_composite(S(DT, *r), (x, y))
    for x in range(8, 104, 16):
        g.alpha_composite(S(DT, *WALL_TOP), (x, 0 if x in (8, 88) else 0))
    # 拱形木门（落于门洞）
    put(g, S(DT, 2, 112, 36, 50), 56, 82)
    # 门两侧壁灯
    put(g, S(DP, *SCONCE_A), 34, 54)
    put(g, S(DP, *SCONCE_B), 78, 54)
    # 顶端长幡
    put(g, S(DT, *BANNER), 56, 30)
    # 底部两侧巨石
    put(g, S(ROCKS, 96, 17, 32, 47), 18, 96)
    put(g, S(ROCKS, 0, 17, 32, 47), 94, 96)
    return g


if __name__ == '__main__':
    (OUT / 'rooms').mkdir(parents=True, exist_ok=True)
    room = build_room()
    room.save(OUT / 'rooms/dungeon.png')
    room.resize((ROOM_W * 3, ROOM_H * 3), Image.NEAREST).save('/tmp/dungeon-room.png')
    print('built rooms/dungeon.png')
    gate = build_gate()
    gate.save(OUT / 'buildings/dungeon-gate.png')
    gate.resize((112 * 4, 96 * 4), Image.NEAREST).save('/tmp/dungeon-gate.png')
    print('built buildings/dungeon-gate.png')
