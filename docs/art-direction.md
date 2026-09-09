# 阅读场景插图

## 设计与来源

使用内置 image_gen 工具生成 9 幅原创彩色漫画场景：8 幅对应游戏的 8 个讨论主题，另有 1 幅开篇港口会面。首图确立人物和画风，后续工具调用只把已有图作为人物与风格参考，逐幅生成新的场景构图。未使用 CLI、外部图片服务或现成漫画。

画面采用清晰墨线、克制的赭色与陶土色、少量灰蓝阴影和纸张质感。苏格拉底以秃顶、短灰胡须、宽鼻和朴素赭色衣袍保持辨识度；格劳孔穿灰蓝衣袍，阿得曼托斯穿浅石色衣袍，色拉叙马霍斯穿砖红衣袍。面容、光照与陈设属于视觉设计，并非原书的考古或肖像断言。原书已叙述的港口会面、家中椅坐聚谈是场景依据。

插图只描绘聚谈者与所在环境。文字、台词、问法、哲学解释不烧录进图片；不把城邦、技艺、灵魂划分或寓言画成答案提示。讨论题目变化不代表人物真的移居另一个地点；后七章仍呈现同一聚谈环境的不同镜头。

## 资产与接入

正式页面只引用 `reader-public/illustrations/*.webp`。所有最终文件均为 1672 × 941 像素，九幅合计 2,198,028 字节（约 2.10 MiB）。原始 PNG 保存在项目本地 `.local/art-originals/`，不进入静态站点。PNG 经过 Node sharp 的 WebP 格式编码（quality 83，effort 6），不裁剪、不重绘、不改动图中内容；页面裁切由 CSS object-fit 完成。

`ComicScene({ chapterId, sceneId?, speaker?, compact? })` 按 chapterId 选本章场景，可用 sceneId 覆盖。开篇尚在港口的页面使用 sceneId="arrival"，进入玻勒马霍斯家中后使用 obligations。普通阅读页同章复用场景，speaker 只略调裁切焦点；不会因玩家选项改变图片。普通图框桌面高 240px、手机高 160px，固定占位避免加载跳动；点击可查看完整大图，Esc 或关闭按钮返回阅读，焦点归还原按钮。加载失败时保留固定高度的简短描述。

| 文件名 | 场景用途 | 人物/风格参考 | 画面内容 |
| --- | --- | --- | --- |
| arrival.webp | 港口会面（开篇路上） | worth | 比雷埃夫斯港旁；苏格拉底、格劳孔与前来挽留的友人站着交谈 |
| obligations.webp | 正义与日常义务 | 无参考图 | 苏格拉底与戴花冠的克法洛斯在家中围坐，年轻人旁听 |
| rule.webp | 正义与统治 | obligations | 苏格拉底与色拉叙马霍斯相对而坐 |
| life.webp | 正义与生活的好坏 | rule | 同一场讨论的侧面近景 |
| worth.webp | 正义本身的价值 | obligations | 格劳孔发言，阿得曼托斯在旁 |
| city.webp | 共同生活的起点 | worth | 庭院边三人围坐的较远镜头 |
| education.webp | 教育与性格 | worth | 从格劳孔肩后望向苏格拉底和阿得曼托斯 |
| guardians.webp | 卫士与全城 | worth | 阿得曼托斯左、苏格拉底右的反向镜头 |
| soul.webp | 城邦与人的正义 | worth | 柱廊框景中的苏格拉底、格劳孔与阿得曼托斯 |

## 逐幅完整提示词

以下为内置工具实际调用的提示词。除第一幅外，参考图片均为表中指定的已有生成资产；参考用于角色与风格延续，不用于引用译本内容。

### arrival — 港口会面（开篇路上）

```text
Use case: illustration-story. Create a NEW opening scene for the same Plato Republic reading game, using the attached image ONLY as character and mature color-graphic-novel art style reference. Keep Socrates recognizably balding, broad nose, short grey beard, plain ochre himation, and young clean-shaven curly dark-haired Glaucon in muted teal. Scene is outdoors on a stone lane beside Piraeus harbor in fifth-century BCE Greece, after a public festival. Socrates and Glaucon at left have paused in their walk; Polemarchus, a friendly young adult man with dark wavy hair and a modest short beard wearing a rust-colored robe, has approached at right accompanied by Adeimantus, short dark hair and slight beard wearing pale stone robe. The four men are standing and conversing naturally, mild welcoming expressions, simple gestures, no conflict. Sea and a few ancient wooden sailboats in the background, distant simple plaster houses and olive shade, warm daylight. Distinct outdoor establishing scene, single wide 16:9 panel, medium-wide grouping, faces and torsos in center horizontal band for a game banner. Precise expressive ink lines, restrained ochre/terracotta/teal color, light paper texture, elegant natural anatomy. No furniture or seated indoor scenes; no temple ceremony, weapons, horse race, crowd spectacle, modern ships, flags, signs, text, speech bubbles, labels, watermarks, fantasy or answer clues. This illustrates only the already-described meeting, no philosophical symbols.
```

### obligations — 正义与日常义务

```text
Use case: illustration-story. Asset type: landscape color-comic scene for a serious Chinese reading game based on Plato's Republic, Book I, neutral establishing illustration. Generate exactly one wide 16:9 image, no collage, no text. Scene: In late fifth-century BCE Piraeus, an intimate domestic Greek courtyard room with plaster walls, plain wooden chairs and muted terracotta paving. Socrates sits left in three-quarter view: balding head, short grey beard, broad nose, plain ochre himation. Opposite him the elderly Cephalus has white hair, a modest leafy wreath, light cream robe, seated on a cushioned chair. Two younger men quietly listen in the background. Calm attentive faces, conversational hands at rest. Mature hand-drawn graphic novel, precise expressive ink outlines, flat muted warm ochre and terracotta colors with restrained teal shadows, slight paper texture, elegant coherent anatomy, no comedy. Cinematic medium-wide composition, eye-level, faces and upper bodies readable within central horizontal strip; room edges support cropping. Soft afternoon light. Strictly no captions, lettering, speech bubbles, logos, watermarks, modern objects, philosophical symbols, weapons, invented actions or obvious correct-answer visual clues.
```

### rule — 正义与统治

```text
Use case: illustration-story. Create a NEW chapter illustration using the supplied image ONLY as character and art-style reference. Preserve Socrates' identity, ochre robe, precise expressive ink lines, muted terracotta/ochre/teal colors, paper texture, mature color graphic-novel treatment, same fifth-century BCE domestic Piraeus courtyard interior. Change the scene to a medium-wide confrontation in conversation: Socrates seated left, calm and attentive; Thrasymachus seated right, strong middle-aged man with dark curly hair, thick short beard, rust-red himation, leaning forward with one open conversational hand, serious animated face but not threatening. Two other young male listeners quietly behind. Cephalus is absent. Wide 16:9 cinematic frame, faces at middle height visible in a shallow horizontal game banner, warm side light and teal shaded walls, natural anatomy. Exactly one image, no collage, no text, speech balloons, symbols, weapons, allegories, logos, modern objects, answer clues or comedic exaggeration. The illustration is atmosphere only; it should not express which philosophical position is right.
```

### life — 正义与生活的好坏

```text
Create a NEW illustration for the next chapter, using the attached image ONLY for consistent characters and art style. Change the camera angle substantially to an intimate side view across the seated conversation. Socrates is in the left foreground in profile, balding, short grey beard, ochre robe, asking calmly with a gently open hand. Thrasymachus (same strong dark curly-haired bearded middle-aged man in rust-red robe) sits at center-right, thoughtful and composed, not humiliated or triumphant. A young listener in muted teal listens at the far side; plain chairs, plaster courtyard wall and leafy shade. Quiet pause within the same indoor gathering in fifth-century BCE Piraeus. Mature precise ink-lined color graphic novel, muted terracotta/ochre/teal palette and paper texture, coherent anatomy. Medium two-shot, wide 16:9 composition, heads and hands composed in the central strip for banner cropping. No captions, lettering, speech balloons, emblems, weapons, fantasy, philosophical diagrams or anything illustrating a correct answer. One image only.
```

### worth — 正义本身的价值

```text
Create a NEW illustration using the attached first image ONLY as visual character and art-style reference. Socrates retains exactly the recognizable balding head, short grey beard, broad nose, ochre robe. Scene: The same modest domestic courtyard room in fifth-century BCE Piraeus, a new camera composition: Socrates seated at the far left facing two young adult brothers in the right half, Glaucon with curly dark hair, clean-shaven, muted teal robe; Adeimantus with short dark wavy hair, slight beard, pale stone-colored robe. The brothers sit attentively in plain chairs, Glaucon in the foreground speaking with an open hand, Adeimantus listening beside him. This is a serious but warm conversation, no gestures of winning or rightness. Their expressions lively and natural. Subtle late afternoon side lighting, window and olive branches in the background. Mature color graphic novel with precise ink line, warm restrained ochre and terracotta, teal shadows, paper texture. Wide 16:9, conversational faces mid-height, balanced medium-wide composition. No text, speech bubbles, modern items, allegorical scenes, rings, city plans, diagrams, logos, weapons, or clues to any philosophical answer. Single panel image.
```

### city — 共同生活的起点

```text
Create a NEW chapter illustration using the attached image ONLY as art style and three-character identity reference; substantially change the composition. Scene remains an intimate real domestic courtyard conversation in fifth-century BCE Piraeus, NOT an imagined city. Camera farther back and slightly diagonal, a wide establishing view of the room: three men sit in a loose triangle beneath the courtyard colonnade, Socrates in ochre to the left, clean-shaven curly-haired Glaucon in muted teal to the right, short-bearded dark-haired Adeimantus in pale stone robe farther back. Socrates speaking quietly, the brothers listening naturally. A small plain table and pottery, plaster walls and olive shade. Do not depict a city model, workers, professions, an army, a philosopher's diagram, a ring, or any philosophical illustration. Only neutral human discussion and architecture. Mature hand-drawn color graphic novel, consistent precise ink lines, restrained ochre/terracotta/teal, light paper texture, soft daylight. Cinematic wide 16:9 SINGLE panel, preserve recognizable faces, natural hands; faces across central horizontal band, enough room around subjects for cropping. No text, symbols, logos, speech balloons, modern things, fantasy or cartoon comedy.
```

### education — 教育与性格

```text
Create a NEW chapter illustration using the attached image ONLY as reference for character identities and mature hand-drawn color graphic-novel style. Keep the recognizable balding Socrates with short grey beard and ochre robe, curly-haired clean-shaven Glaucon in teal, short-bearded dark-haired Adeimantus in pale stone robe. Change the shot to a quiet over-the-shoulder view from behind Glaucon at far right foreground; Socrates in clear three-quarter view center-left, Adeimantus seated and listening at center-right. Their heads and conversational hands visible in the central strip, natural subtle expressions, a pause in a long friendly discussion. Setting the same modest ancient Greek domestic courtyard room, fifth-century BCE Piraeus, plaster wall, wood chairs, olive branches casting gentle patterned shade. Wider landscape 16:9. Precise expressive ink outlines, muted warm ochre and terracotta colors with restrained teal shadows and slight paper texture. Do not illustrate the content of their speech: no musical instruments, books, gods, soldiers, sports, schoolroom, symbols, diagrams, dream scenes or answer clues. No text, speech bubbles, logos, watermarks, modern objects, exaggerated gestures. Exactly one cinematic panel.
```

### guardians — 卫士与全城

```text
Create a NEW color graphic-novel chapter illustration, using the attached image ONLY for consistent art style and character identities; choose a distinctly new composition. The same fifth-century BCE Piraeus domestic courtyard conversation. Reverse two-shot: Adeimantus on the LEFT, young adult man with short dark wavy hair and slight dark beard in pale stone-colored robe, speaking earnestly with a relaxed open hand; Socrates on the RIGHT in ochre robe, balding with short grey beard and broad nose, listening calmly. Glaucon in muted teal is seated farther behind near center, only a secondary listener. Eye-level medium shot, modest wooden chairs, pale plaster wall with soft olive leaf shadows and a teal door. Warm slanting light. Mature precise expressive ink outlines, restrained ochre/terracotta/teal flat colors, slight paper grain, natural anatomy, wide 16:9 single panel, faces and hands located across central horizontal band for game-banner crops. Do NOT visualize imagined guardians, armies, government, metals, property, maps, diagrams, gods, mythical beings or philosophical conclusions. This is neutral human conversation. No text, speech bubbles, labels, logos, watermarks, modern objects or comedy.
```

### soul — 城邦与人的正义

```text
Create a NEW concluding chapter illustration using the attached image ONLY to preserve mature graphic-novel style and character identities. Different camera framing: medium-wide, framed through a softly shaded domestic colonnade. Socrates on the LEFT, bald crown, short grey beard, broad nose, ochre robe, quietly speaking; Glaucon on the RIGHT, curly dark-haired clean-shaven young man in muted teal, listening with an open attentive expression. Adeimantus in pale stone robe, short dark beard, is a modest background listener between them. Same fifth-century BCE Piraeus domestic courtyard room, quiet warm afternoon atmosphere, wood chairs, plaster walls, olive leaves. No movement to another actual location, no triumphant ending pose. Precise expressive hand-drawn ink lines, restrained warm ochre and terracotta with teal shadows, slight paper texture. Elegant natural faces and hands, wide 16:9 cinematic single panel, heads in central horizontal strip, room framing safe for crops. Do not visualize a soul, tripartite symbols, scales, chariots, animals, city plans, diagrams or any philosophical teaching or correct answer. No text, speech balloons, labels, symbols, logos, watermarks, modern objects, fantasy, or comedic exaggeration.
```

## 视觉检查

逐幅检查已生成图：九幅均为单幅横向画面，无文字或气泡，无现代器物；主角外观及服色延续，各章具有不同机位或人物布局。比雷埃夫斯开篇使用户外场景；进入家中后使用室内/庭院边聚谈图。缩略图裁切以面容为中心，并提供完整大图以保留原构图。

