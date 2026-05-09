# 3D-модели кейсов — assets/models/

Папка для твоих **собственных** GLB-моделей, которые показываются во вкладке **3D** в case-view.

**v0.11.2:** в папке уже лежат **15 Draco-compressed GLB-демок** (по одной на каждый кейс) — каждая < 5 КБ, общий объём < 50 КБ. Это лёгкие procedural-моделящки (orbit, lattice, skeleton, bloom, prism, facet, grid, wave и т.д.), чтобы вкладка «3D» работала из коробки с локальными ассетами, без CDN. Ниже — как заменить их на свои.

---

## 1. Куда класть файлы

Клади `.glb` (glTF Binary, один файл с геометрией + текстурами внутри) прямо сюда:

```
assets/models/
├── orbital-mk-ii.glb
├── vega-shell.glb
├── nightshard.glb
├── recon-drone.glb
├── apex-frame.glb
└── README.md   ← этот файл
```

Имя файла = `id` кейса из `CARDS_DATA`. Это просто рекомендация — код читает именно то, что прописано в `modelSrc`.

---

## 2. Как подключить в CARDS_DATA

Открой `js/main.js`, найди нужный кейс (по id) и замени значение `modelSrc` с CDN-ссылки на локальный путь:

```js
'orbital-mk-ii': {
  role: 'Личный',
  tools: ['Blender', 'Substance Painter', 'Marmoset'],
  modelSrc: './assets/models/orbital-mk-ii.glb',   // ← сюда свой файл
  modelStats: {
    triangles: '18,432',
    vertices:  '9,521',
    materials: 3,
    textures:  '4 × 4 K',
    software:  'Blender'
  },
  items: makeItems({ … })
}
```

Пути относительные — от корня `codex-studio/`. Сервер `python3 -m http.server` отдаёт их как статику.

---

## 3. Как заполнить `modelStats`

Это то, что показывается в панели **INFO** (toggle в углу 3D-вьюера). Цифры бери из Blender:

| Поле        | Где смотреть в Blender                                   |
| ----------- | -------------------------------------------------------- |
| `triangles` | Statistics → Tris (N-panel → View → Statistics)          |
| `vertices`  | Statistics → Verts                                       |
| `materials` | Outliner → Material slots у главного меша (число штук)   |
| `textures`  | Формат: `кол-во × разрешение` — пример: `4 × 4 K`        |
| `software`  | Через `+`: `Blender`, `Blender + Substance`, `ZBrush + Blender` и т.д. |

Все значения — **строки** (для единиц). `materials` можно числом, всё равно приводится к строке при рендере.

Если какого-то поля нет — просто не указывай ключ, в UI подставится `—`.

---

## 4. Рекомендации для GLB

- **Размер файла:** ≤ 5 МБ (идеально 1–3 МБ). Больше — будет долго грузиться на мобилке.
- **Триcs:** 15 000–30 000 для hero-кейсов, меньше — для дронов/пропсов.
- **Текстуры:** WebP или JPEG-baseColor, 2K (2048²) по умолчанию, 4K только для hero. Запекай roughness + metallic в один RGB-atlas.
- **Нормализуй transform:** Apply All Transforms перед экспортом, иначе model-viewer центрирует неправильно.
- **Draco compression** — да, сильно уменьшает размер геометрии (в 5–10 раз). Все демки в этой папке сжаты `gltf-transform draco` — model-viewer 4.0 распаковывает Draco автоматически (встроенный DRACOLoader).

---

## 5. Настройки экспорта в Blender

`File → Export → glTF 2.0 (.glb/.gltf)`:

- **Format:** `glTF Binary (.glb)` — один файл, всё внутри.
- **Include:** `Selected Objects` (если экспортируешь только выбранное) или `Visible Objects`.
- **Transform:** `+Y Up` (дефолт для glTF).
- **Geometry:**
  - ✅ `Apply Modifiers`
  - ✅ `UVs`
  - ✅ `Normals`
  - ✅ `Tangents` (для нормал-мапов)
  - ✅ `Vertex Colors` (если используются)
  - ✅ `Materials`: `Export` (не `Placeholder`)
  - ✅ `Images`: `Automatic` (или `JPEG` для сжатия)
- **Compression:** включи `Draco mesh compression` → уровень 6.
- **Animation:** отключи, если статик-моделька.

---

## 6. Что происходит если файла нет

- `modelSrc` не задан → во вкладке 3D показывается fallback **«MODEL SOON»**.
- `modelSrc` задан, но 404 / ошибка загрузки → fallback **«MODEL UNAVAILABLE»** с подсказкой.
- Во время загрузки → **«LOADING 3D»**.

Всё это уже обрабатывается в `build3D()` — ничего докручивать не надо.

---

## 7. Проверка на локалке

```bash
cd codex-studio
python3 -m http.server 5555
# → http://localhost:5555
```

Открой любой кейс → таб **3D** → крути (drag / scroll / double-click). Если модель видна и `INFO` показывает твои цифры — всё ок.
