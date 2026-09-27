# 第二版章节封面生成记录

本轮使用内置 `image_gen.imagegen` 工具，各封面单独生成。2026-09-27。采用清晰彩色历史叙事漫画：写实人物比例、自然动作与表情、细线、水彩质感，以及海蓝、陶土红、苔绿与赭色石材。四图均为 1672 × 941 像素宽幅图，约 16:9。

参考查看了项目现有的 `reader-public/illustrations/city.webp` 和《苏格拉底之问》本地发布版的 `comic-art/gpt-tsunami-05-6ace4f4a2410.webp`，用于画风和叙事清晰度判断；未将其作为编辑目标。本轮新图是独立编辑配图，不能作为原典事件、原典人物外貌或题目答案的证据。

原 PNG 均保留于 `.local/art-originals/v2/`（不公开）；公共 WebP 仅作格式转换，RGB、quality 90、method 6，不裁剪、不改画面。

## 1. 太阳与可见世界：good-v2

- 公共文件：`reader-public/illustrations/chapter-covers/good-v2.webp`
- 原 PNG 副本：`.local/art-originals/v2/good-v2.png`
- 内置工具原输出文件名：`exec-a83998b2-753f-4200-9afc-fe0fba19d008.png`
- 文件大小：455782字节。
- SHA-256：`654afdebf807103d0abb1bf6ca036293cd3de097b2cff2601ed64d5435b9256d`
- 目视检查：年长谈话者向青年自然地展开手势，阳光照亮陶器、树叶和海面；无文字或超自然光线。作为第十二章封面和首页插画；场景为编辑想象，不表示原典聚谈实际转场。

最终提示词：

```text
Use case: illustration-story. Asset type: 16:9 landscape chapter cover for a Chinese interactive reading of Plato's Republic, chapter on the sun and the Good. Create one lively yet restrained full-color historical comic illustration: a sunlit ancient Greek coastal courtyard, warm limestone paving and low columns, blue sea beyond, terracotta vessels and olive leaves visibly illuminated by afternoon light. In the foreground an older bald, bearded Greek thinker in a simple earth-colored himation speaks warmly with a young man in a muted blue himation, using a natural open-hand gesture toward the visible objects while the young man attentively looks at them. Hand-drawn fine ink contours, soft rich watercolor, realistic human proportions, expressive faces and natural body language; warm ochre, terracotta, sea blue and olive green; not sepia monochrome. A clear readable medium-wide composition, no speech balloons, absolutely no text or inscriptions, no lettering, no chart, no diagram, no answer hints, no fantasy rays or supernatural objects. This is an editorial imagined scene representing a discussion, not a claim that the dialogue literally moved to this location. Avoid kitschy philosophy symbols, chibi figures, exaggerated comedy, modern props, photorealistic collage. High-quality polished narrative comic painting, edge-to-edge landscape artwork.
```

## 2. 政制与人生：regimes-v2

- 公共文件：`reader-public/illustrations/chapter-covers/regimes-v2.webp`
- 原 PNG 副本：`.local/art-originals/v2/regimes-v2.png`
- 内置工具原输出文件名：`exec-f41b5db8-d751-4e38-bc86-4df0049778aa.png`
- 文件大小：448376 字节。
- SHA-256：`ca48fcc3b2118580ddf652023cce50950ac66f0df427cc8c18496387e98b598d`
- 目视检查：青年和年长公民相向交谈，表情及手势可辨；旁听者形成层次；没有苏格拉底登台、政制次序图、暴君伤害、文字或选项答案。广场是主题性编辑画面，不表示原典聚会实际转移到广场。

最终提示词：

```text
Use case: illustration-story.
Asset type: a single 16:9 landscape chapter-cover illustration for a Chinese educational game reading Plato's Republic, ancient Greek setting, no UI.
Primary request: An animated but thoughtful conversation about civic life in a sunlit ancient Greek agora. A young dark-haired man in a terracotta red himation leans forward while explaining something with an open palm; an older grey-bearded citizen in a sea-blue himation answers with a measured hand gesture, both looking at each other. Two nearby citizens listen with visibly different attentive expressions. Their interaction, faces, and hands are the focal point, rather than a famous philosopher lecturing from a platform.
Scene/backdrop: Warm ochre stone paving and an open colonnade, small olive trees, scattered terracotta pottery, a few citizens farther in the distance. Classical 4th-century BCE Greek draped clothes and sandals, no Roman triumphal architecture. Composition/framing: Cinematic wide single scene, medium-wide eye-level viewpoint, clear distinct figures in the central two-thirds; no text area required. Keep faces and gestures readable at chapter thumbnail size. Give the crowd depth rather than a static lineup.
Style/medium: A polished full-color historical narrative comic with realistic body proportions, expressive and natural faces, crisp delicate hand-drawn ink contours, textured soft watercolor washes and refined painted shading. Lively and legible like a carefully drawn historical graphic novel; serious curiosity, not caricature, not chibi. Rich sea blue, terracotta red and moss-green accents against luminous cream and ochre stone.
Lighting/mood: Bright Mediterranean morning, soft tree shadows, warm welcoming human energy.
Constraints: The image suggests people discussing a city; it does not diagram, rank, or depict a proved sequence of political constitutions. No tyrant harming citizens. No triumphant answer pose. No speech bubbles, letters, words, diagrams, banners, labels, watermark, signature, symbols of modern parties, modern clothes, modern objects, firearms, marble-white blank costumes, or cartoon exaggeration. One continuous landscape frame, not a panel grid. Aspect ratio 16:9.
```

## 3. 摹仿：imitation-v2

- 公共文件：`reader-public/illustrations/chapter-covers/imitation-v2.webp`
- 原 PNG 副本：`.local/art-originals/v2/imitation-v2.png`
- 内置工具原输出文件名：`exec-78eb9186-2176-450f-8f36-65c15cd65a78.png`
- 文件大小：420032 字节。
- SHA-256：`06cc1819b42e12b4dfa8678947225209efaecbea150861a8663ff793682125e4`
- 目视检查：实物木床位于左侧，绘画板上的木床位于右侧；画家正在作画，年长观察者认真看画；无抽象第三张床、三界图示、文字、箭头或答案标记。只是用画室场景呈现摹仿主题。

最终提示词：

```text
Use case: illustration-story.
Asset type: a single 16:9 landscape chapter-cover illustration for a Chinese educational game reading Plato's Republic Book X, ancient Greek setting, no UI.
Primary request: A young ancient Greek painter carefully studies an actual modest wooden bed standing in his workshop and paints its likeness on a rectangular painting panel propped on a wooden easel. The real bed and the painted image must both be clearly visible and recognizable as distinct physical objects. The painter holds a fine brush close to the panel with one hand and a small wooden palette in the other. A grey-bearded older observer in a moss-green himation stands slightly behind him, leaning forward with a thoughtful, curious expression toward the work, not instructing or signalling a correct answer.
Scene/backdrop: Sunlit open ancient Greek artisan workshop with ochre plaster, an open doorway, simple ceramic pigment dishes, wooden joinery and a visible classical Greek courtyard in the background. The real bed is a simple ancient four-legged wooden couch with a light woven mattress, no modern upholstery, no ornate medieval furniture. The painting panel is a believable modest wooden board with a painted image of that same bed against a simple background; no additional painting panels.
Composition/framing: Cinematic medium-wide eye-level angle, painter and observer have clear expressive faces and active gestures in the center; real bed to one side, easel turned enough toward us to see the painted bed. All three are contained in one continuous workshop scene, not separate panels, and readable at thumbnail size. Do not make a technical diagram or label the relationships.
Style/medium: A polished full-color historical narrative comic with realistic body proportions, expressive natural faces, crisp fine hand-drawn ink contours, textured soft watercolor washes and refined painted shading. Lively, warmly human and legible like a historical graphic novel, not caricature, not chibi, not glossy 3D. Rich sea-blue cloth on the painter, moss-green cloth on the observer, terracotta red pigment pots, luminous cream and ochre stone and warm brown wood.
Lighting/mood: Mediterranean daylight with soft golden reflected light; the quiet excitement of making and observing an image.
Constraints: The subject is a workshop conversation and painted imitation. Do not add an abstract third bed, a god, a heavenly world, three levels or any philosophical answer diagram. No speech bubbles, letters, words, arrows, labels, watermark, signature, religious symbols, modern tools, stretched modern canvas, metal hospital bed, Roman armor, modern clothes. Aspect ratio 16:9, single continuous landscape frame.
```

## 4. 命运故事：destiny-v2

- 公共文件：`reader-public/illustrations/chapter-covers/destiny-v2.webp`
- 原 PNG 副本：`.local/art-originals/v2/destiny-v2.png`
- 内置工具原输出文件名：`exec-b686ebcb-6861-417e-80da-29372da5a0e1.png`
- 文件大小：511826 字节。
- SHA-256：`fdd858d8edeb26b2d1ecd50666dc517d3bb95eb8224e5049eeb9bf33ec21c9f4`
- 目视检查：中心人物手持尚未展开的无字卷轴，在星空下思量；其他人物安静等待；暖灯照亮面孔和衣着。无现代宗教、神祇审判、编号抽签、选项答案、死亡场面或文字。明确作为寓言性质的编辑封面，不宣称是原典中卷轴仪式的复原。

最终提示词：

```text
Use case: illustration-story.
Asset type: a single 16:9 landscape editorial chapter-cover illustration for the final mythic story in Plato's Republic Book X, Chinese educational reading game, no UI.
Primary request: A thoughtful person in ancient Greek draped clothing quietly pauses under a luminous warm night sky, holding a closed, still-rolled blank papyrus scroll near their heart and considering it. The scroll is a modest physical roll with the ends still wrapped, not an open written sheet. Their expression is contemplative and alert, with a slight furrow of curiosity rather than sadness or horror. A few other ordinary people in ancient Greek garments wait peacefully farther along a gentle stone path. This is a symbolic, inviting mythic image of reflecting on a life still to be unfolded.
Scene/backdrop: A timeless imagined landscape with low ochre stone terraces, olive trees and distant blue hills beneath a starry sky. Gentle golden lamps glow near the path, a soft band of stars shines overhead, no cosmic machinery or celestial charts.
Composition/framing: Wide cinematic single continuous scene, medium view of the main figure slightly off center with face and closed scroll clearly readable at thumbnail size; waiting people are distinct but secondary, depth along the path into the hills. Main figure wears muted terracotta red and cream with a sea-blue sash; other figures moss green and pale blue. The image can be understood without text.
Style/medium: Polished full-color historical narrative comic, realistic human proportions, natural expressive face, crisp fine hand-drawn ink contours, soft watercolor texture and refined painted shading. Lively but dignified historical graphic novel, not caricature, not chibi, not glossy 3D. Sea blue, terracotta red and moss-green color contrasts with luminous cream and ochre stone. Keep faces and clothing bright enough to read against the blue night.
Lighting/mood: Deep blue stars with warm gold lamp light and a peaceful sense of possibility, visually vivid and humane rather than gloomy.
Constraints: An editorial allegorical cover, not a depiction of an actual historical event and not an answer to a game question. No judges, gods, angels, demons, halos, crosses, modern religion, zodiac signs, destiny wheel, spinning machinery, numbered lots, visible choices, written scroll, labels, letters, speech bubbles, diagrams, watermark or signature. No grief, dying body, chains, modern clothes or objects. The central scroll remains rolled and has no visible writing. Aspect ratio 16:9, one continuous landscape frame, no panel grid.
```
