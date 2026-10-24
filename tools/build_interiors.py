#!/usr/bin/env python3
"""离线拼贴微积分修炼馆室内图（Anokolisa 像素包）。

输出：
  frontend/public/assets/world2d/pixel/rooms/limit.png       极限酒馆
  frontend/public/assets/world2d/pixel/rooms/derivative.png  导数讲堂
  frontend/public/assets/world2d/pixel/rooms/integral.png    积分圣所
  frontend/public/assets/world2d/pixel/npc/{host,scholar,sage}-idle.png  导师换色

房间 256×176（16×11 瓦片，瓦片 16px）：上半为后墙，下半为地板，家具贴墙摆放。
运行：.venv/bin/python tools/build_interiors.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PIX = ROOT / 'Pixel'
OUT = ROOT / 'frontend/public/assets/world2d/pixel'

WALLS = Image.open(PIX / 'Environment/Structures/Buildings/Interior/Interior_Walls_01.png').convert('RGBA')
PROPS = Image.open(PIX / 'Environment/Structures/Buildings/Interior/Interior_Props_01.png').convert('RGBA')
ESO = Image.open(PIX / 'Environment/Props/Static/Esoteric.png').convert('RGBA')
ROCKS = Image.open(PIX / 'Environment/Props/Static/Rocks.png').convert('RGBA')

ROOM_W, ROOM_H = 256, 176  # 16×11 瓦片

# ---------------------------------------------------------------- 工具


def S(img, x, y, w, h):
    """从图集裁一块"""
    return img.crop((x, y, x + w, y + h))


def tile_h(strip, dst, y, x0=0, x1=ROOM_W):
    """水平平铺一条素材"""
    w = strip.width
    x = x0
    while x < x1:
        dst.alpha_composite(strip, (x, y))
        x += w


def tile_fill(tile, dst, x0, y0, x1, y1):
    """用 16px 小瓦片填满区域"""
    for y in range(y0, y1, tile.height):
        for x in range(x0, x1, tile.width):
            dst.alpha_composite(tile, (x, y))


def put(dst, img, bx, by):
    """底部中心锚点摆放（与游戏内 WorldObject 一致）"""
    dst.alpha_composite(img, (round(bx - img.width / 2), round(by - img.height)))


# ---------------------------------------------------------------- 墙体与地板

# 墙条分段（实测：y72-80 的顶梁带黑洞，改用 y88 亮梁 + 实心墙面段）
WALL_PARTS = {
    'darkwood': [(200, 88, 80, 7), (200, 96, 80, 44)],             # 深木护板（极限酒馆）
    'stone': [(104, 88, 80, 7), (104, 96, 80, 44)],                 # 石墙（积分圣所）
    'cream': [(296, 88, 80, 7), (296, 96, 80, 26), (296, 126, 80, 16)],  # 灰泥墙+护墙板（导数讲堂）
}
# 地板填充瓦片：地板补丁（y=320 一排 80×80 cross）中心 16×16
FLOOR_TILE = {
    'plank': (32, 352),      # 木板（酒馆）
    'stone': (112, 352),     # 石砖（圣所）
    'herring': (192, 352),   # 人字拼（讲堂）
}


def make_room(wall: str, floor: str) -> Image.Image:
    room = Image.new('RGBA', (ROOM_W, ROOM_H), (6, 5, 12, 255))
    strip = Image.new('RGBA', (80, 0), (0, 0, 0, 0))
    for x, y, w, h in WALL_PARTS[wall]:
        part = S(WALLS, x, y, w, h)
        taller = Image.new('RGBA', (80, strip.height + h), (0, 0, 0, 0))
        taller.alpha_composite(strip, (0, 0))
        taller.alpha_composite(part, (0, strip.height))
        strip = taller
    fx, fy = FLOOR_TILE[floor]
    ftile = S(WALLS, fx, fy, 16, 16)
    tile_fill(ftile, room, 0, strip.height - 6, ROOM_W, ROOM_H)  # 地板稍微塞进墙底
    tile_h(strip, room, 0)  # 后墙压地板顶边
    return room


# ---------------------------------------------------------------- 家具速查（CC 索引坐标）

P = {  # Interior_Props_01
    'bench_long': (0, 0, 64, 26),
    'barrel_sm1': (66, 3, 12, 24),
    'barrel_sm2': (67, 34, 11, 24),
    'round_table': (80, 7, 32, 35),
    'stove': (231, 33, 39, 62),
    'crate': (147, 76, 26, 20),
    'chandelier': (242, 106, 28, 53),
    'counter_bar': (112, 230, 109, 26),  # 吧台台面+柜体（不含上方门板）
    'bench': (0, 204, 48, 20),
    'table_long': (48, 151, 64, 20),
    'window4': (64, 176, 28, 48),
    'window_arch': (98, 176, 28, 32),
    'table_cloth': (65, 227, 45, 28),
    'blackboard': (194, 260, 28, 23),
    'blackboard_chalk': (226, 260, 28, 23),
    'plant1': (17, 352, 14, 32),
    'plant2': (48, 354, 32, 30),
    'plant3': (32, 360, 15, 24),
    'rug_big': (336, 304, 176, 80),  # 含绿方块，实际取 rug_cross()
    'rug_green': (337, 341, 44, 38),
    'candlestick': (467, 224, 9, 32),
    'shelf_plates': (432, 225, 32, 14),
    'shelf_board': (131, 262, 26, 10),
    'open_book_p': (434, 241, 28, 14),
    'books_stack': (480, 257, 22, 14),
    'mug1': (533, 225, 10, 11),
    'mug2': (545, 225, 10, 11),
    'goblet': (498, 238, 11, 18),
    'bottle_tall': (514, 234, 13, 22),
    'lantern': (514, 272, 12, 16),
    'broom': (592, 336, 16, 30),
    'bread': (402, 230, 28, 20),
    'vial_r1': (550, 291, 5, 10),
    'vial_r2': (565, 291, 7, 10),
    'vial_g1': (534, 307, 5, 10),
    'vial_g2': (565, 307, 7, 10),
    'vial_p1': (550, 323, 5, 10),
    'vial_p2': (581, 323, 7, 10),
}
E = {  # Esoteric
    'flask_w': (3, 17, 11, 15),
    'flask_g': (3, 33, 11, 15),
    'flask_w2': (3, 50, 11, 14),
    'flask_g2': (3, 66, 11, 14),
    'shelf_books1': (88, 19, 17, 13),
    'shelf_books2': (88, 35, 17, 13),
    'shelf_sm1': (82, 52, 13, 12),
    'shelf_sm2': (98, 52, 13, 12),
    'bottle_tall_w': (2, 91, 11, 21),
    'bottle_tall_g': (35, 91, 11, 21),
    'hourglass1': (19, 96, 9, 16),
    'hourglass2': (52, 96, 9, 16),
    'book_blue': (50, 113, 12, 14),
    'quill': (19, 114, 9, 11),
    'frame_blue': (48, 128, 16, 16),
    'books_pile': (2, 129, 13, 14),
    'paper1': (19, 130, 9, 11),
    'paper2': (35, 130, 9, 11),
    'book_marked': (21, 145, 9, 14),
    'open_book': (0, 162, 15, 12),
    'picture': (17, 169, 14, 18),
    'book_green': (4, 178, 9, 11),
}


def prop(name):
    return S(PROPS, *P[name])


def rug_cross() -> Image.Image:
    """tan 十字地毯：在 (428,290)-(516,384) 内自动求 alpha 包围盒"""
    region = PROPS.crop((428, 290, 516, 384))
    a = np.array(region)[..., 3] > 8
    ys, xs = np.where(a)
    return region.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def eso(name):
    return S(ESO, *E[name])


# ---------------------------------------------------------------- 三个馆


def build_limit() -> Image.Image:
    """极限酒馆：深木护板墙 + 木地板，吧台 + 酒桌"""
    r = make_room('darkwood', 'plank')
    # 中央地毯（融入木地板的十字毯）
    put(r, rug_cross(), 176, 172)
    # 吊灯（挂在墙前）
    put(r, prop('chandelier'), 128, 62)
    # 吧台（左侧，贴墙）
    put(r, prop('counter_bar'), 70, 106)
    # 吧台后墙：四层小酒架 + 酒瓶
    for i, s in enumerate(['shelf_books1', 'shelf_books2', 'shelf_sm1', 'shelf_sm2']):
        put(r, eso(s), 30 + i * 20, 56)
    put(r, prop('bottle_tall'), 140, 58)
    put(r, prop('shelf_plates'), 172, 56)
    # 吧台上的吃喝（台面 y≈88）
    put(r, prop('mug2'), 44, 88)
    put(r, prop('goblet'), 76, 88)
    put(r, prop('bread'), 104, 88)
    # 右侧酒桌区：圆桌 + 长凳 + 酒桶
    put(r, prop('round_table'), 198, 150)
    put(r, prop('bench'), 198, 168)
    put(r, prop('barrel_sm1'), 238, 72)
    put(r, prop('barrel_sm2'), 248, 84)
    put(r, prop('crate'), 18, 168)
    put(r, prop('lantern'), 240, 124)
    return r


def build_derivative() -> Image.Image:
    """导数讲堂：灰泥墙 + 人字拼，黑板 + 课桌"""
    r = make_room('cream', 'herring')
    # 墙上：黑板两块 + 窗户 + 书架
    put(r, prop('blackboard'), 106, 58)
    put(r, prop('blackboard_chalk'), 146, 58)
    put(r, prop('window4'), 40, 64)
    put(r, prop('window_arch'), 214, 60)
    put(r, eso('shelf_books1'), 244, 58)
    put(r, eso('shelf_books2'), 244, 72)
    # 讲台（导师讲桌 + 摊开的书 + 沙漏）
    put(r, prop('table_cloth'), 128, 92)
    put(r, eso('open_book'), 120, 84)
    put(r, eso('hourglass1'), 138, 84)
    # 课桌两排 + 长凳，桌上有书
    put(r, prop('table_long'), 66, 116)
    put(r, prop('table_long'), 190, 116)
    put(r, eso('book_blue'), 52, 106)
    put(r, eso('books_pile'), 84, 108)
    put(r, eso('paper1'), 178, 108)
    put(r, eso('book_marked'), 204, 106)
    put(r, prop('bench'), 66, 134)
    put(r, prop('bench'), 190, 134)
    # 绿植与画框
    put(r, prop('plant1'), 248, 150)
    put(r, prop('plant3'), 12, 150)
    return r


def build_integral() -> Image.Image:
    """积分圣所：石墙 + 石砖地，炼金长台 + 水晶"""
    r = make_room('stone', 'stone')
    # 炼金长台（中央偏后）+ 烧瓶试剂
    put(r, prop('table_long'), 128, 100)
    put(r, eso('flask_g'), 106, 90)
    put(r, eso('flask_w'), 122, 90)
    put(r, eso('bottle_tall_g'), 140, 90)
    put(r, eso('book_blue'), 158, 92)
    put(r, prop('candlestick'), 90, 90)
    # 左侧熔炉 + 书架
    put(r, prop('stove'), 32, 128)
    put(r, eso('shelf_books1'), 66, 60)
    put(r, eso('shelf_sm1'), 84, 62)
    put(r, eso('picture'), 128, 58)
    # 右侧水晶簇 + 试剂架
    put(r, S(ROCKS, 144, 277, 16, 27), 214, 110)
    put(r, S(ROCKS, 162, 287, 12, 17), 226, 114)
    put(r, S(ROCKS, 177, 287, 14, 17), 238, 112)
    put(r, prop('shelf_board'), 214, 70)
    put(r, prop('vial_r1'), 208, 62)
    put(r, prop('vial_g2'), 216, 62)
    put(r, prop('vial_p2'), 224, 62)
    put(r, prop('broom'), 248, 128)
    put(r, prop('lantern'), 60, 92)
    return r


# ---------------------------------------------------------------- NPC 换色


def top_colors(img, n=10):
    a = np.array(img).reshape(-1, 4)
    a = a[a[:, 3] > 200][:, :3]
    colors, counts = np.unique(a, axis=0, return_counts=True)
    order = np.argsort(-counts)[:n]
    return [(tuple(colors[i]), int(counts[i])) for i in order]


def recolor(src, mapping, dst):
    """精确调色板替换（肤色安全）"""
    img = Image.open(src).convert('RGBA')
    a = np.array(img)
    for old, new in mapping.items():
        mask = (a[..., :3] == old).all(axis=-1)
        a[mask, :3] = new
    Image.fromarray(a).save(dst)


def build_npcs():
    npc_dir = OUT / 'npc'
    jobs = {
        # 洛必达：橄榄围裙 → 绯红
        'host': (npc_dir / 'keeper-idle.png', {
            (126, 120, 64): (158, 58, 62),
            (89, 87, 41): (112, 40, 44),
        }),
        # 牛顿：青绿布衣 → 藏青学者
        'scholar': (npc_dir / 'peasant-idle.png', {
            (57, 86, 75): (52, 68, 118),
            (51, 68, 62): (38, 50, 90),
            (20, 31, 27): (16, 22, 42),
        }),
        # 莱布尼茨：紫袍 → 金琥珀
        'sage': (npc_dir / 'wizard-idle.png', {
            (147, 45, 139): (204, 138, 36),
            (95, 46, 92): (146, 92, 22),
            (38, 26, 38): (72, 48, 14),
        }),
    }
    for name, (src, mapping) in jobs.items():
        dst = npc_dir / f'{name}-idle.png'
        recolor(src, mapping, dst)
        print('recolored', dst.name)


# ----------------------------------------------------------------

if __name__ == '__main__':
    import sys

    if '--npcs' in sys.argv:
        build_npcs()
        sys.exit(0)

    rooms = {'limit': build_limit, 'derivative': build_derivative, 'integral': build_integral}
    out_dir = OUT / 'rooms'
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, fn in rooms.items():
        img = fn()
        img.save(out_dir / f'{name}.png')
        # 预览（×3 放大）
        img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(f'/tmp/room-{name}.png')
        print('built', name)
    build_npcs()
