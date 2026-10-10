# 美术资产授权

本目录下的像素美术资产来自 **0x72 DungeonTileset II v1.7**。

- 来源：https://0x72.itch.io/dungeontileset-ii
- 作者：0x72
- 资产授权：**Creative Commons Zero v1.0 Universal (CC0)** —— 公共领域，可自由用于商业项目，无需署名
- 代码授权：MIT
- 作者声明：未使用生成式 AI

`tile_list_v1.7.txt` 为官方帧映射表，格式为每行 `名称 x y 宽 高`，对应主图集
`0x72_DungeonTilesetII_v1.7.png`（512×512）。

三张 autotile 图集（floor / walls_low / walls_high）按 Godot 3x3 minimal 规范设计，
其中 walls_high 为 16×32，绘制时需要 Y 偏移（详见 README-0x72.txt）。
