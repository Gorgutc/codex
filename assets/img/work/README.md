# Work previews — как заменить плейсхолдеры

Эта папка хранит превью-изображения карточек портфолио.

## TL;DR

Положи сюда JPG/WEBP с именем как в колонке **File name** ниже.
Файл существует → показывается реальное превью.
Файла нет → карточка автоматически откатывается на градиент + лейбл (fallback).

## Имена файлов

| №  | Карточка          | Категория     | File name                |
|----|-------------------|---------------|--------------------------|
| 1  | Orbital Mk.II     | Hard Surface  | `orbital-mk-ii.jpg`      |
| 2  | Vega Shell        | Hard Surface  | `vega-shell.jpg`         |
| 3  | Ironclad Frame    | Hard Surface  | `ironclad-frame.jpg`     |
| 4  | Corten Series     | Product       | `corten-series.jpg`      |
| 5  | Lumen One         | Product       | `lumen-one.jpg`          |
| 6  | Flux Capsule      | Product       | `flux-capsule.jpg`       |
| 7  | Nightshard        | Game Assets   | `nightshard.jpg`         |
| 8  | Recon Drone       | Game Assets   | `recon-drone.jpg`        |
| 9  | Apex Frame        | Prototyping   | `apex-frame.jpg`         |
| 10 | Core Rig          | Prototyping   | `core-rig.jpg`           |
| 11 | Helix Reveal      | Animations    | `helix-reveal.jpg`       |
| 12 | Arc Motion        | Animations    | `arc-motion.jpg`         |

## Требования к файлам

| Параметр       | Значение                                               |
|----------------|--------------------------------------------------------|
| Формат         | JPG (fallback) или WEBP (лучше сжатие, Safari 14+)     |
| Разрешение     | **800 × 600 px** (aspect-ratio 4:3)                    |
| Вес            | ≤ 200 KB на картинку                                   |
| Цветовой режим | sRGB                                                   |
| Crop           | центрированный, запас по краям (object-fit: cover)     |

## Как добавить новую карточку

1. В `index.html` скопируй любой `<article class="work-card">` блок.
2. Поменяй:
   - `data-category="..."` — одна из: `hard-surface`, `product`, `game-assets`, `prototyping`, `animations`
   - `data-label="..."` — название для плейсхолдера
   - `src="./assets/img/work/my-new-project.jpg"` — путь к твоему файлу
   - `alt="..."` — описание для скринридера
   - Текст `<h2>`, `<p>`, `<span class="work-card__cat">`, год
3. Положи изображение в эту папку.

## Использование WEBP вместо JPG

В `index.html` замени `<img src="…jpg">` на `<picture>`:

```html
<picture>
  <source srcset="./assets/img/work/orbital-mk-ii.webp" type="image/webp">
  <img src="./assets/img/work/orbital-mk-ii.jpg"
       alt="Orbital Mk.II — sci-fi hard surface prop"
       loading="lazy" width="800" height="600"
       onerror="this.remove();">
</picture>
```

Браузер сам выберет формат. Fallback на JPG работает везде.

## Как работает fallback

Атрибут `onerror="this.remove();"` на `<img>` удаляет тег, если файл
не найден (404). Под `<img>` лежит градиент + лейбл из `data-label` —
они становятся видимыми автоматически. Это значит: **ты можешь заливать
картинки по одной, остальные останутся плейсхолдерами, ничего не сломается.**

## Проверка после замены

1. `python3 -m http.server 5555` в корне проекта
2. Открой DevTools → Network → Img, убедись что файлы грузятся без 404
3. Lighthouse → Performance ≥ 90 (картинки ≤ 200KB не уронят скор)
