# Assets Brief — Codex Studio
> Правила работы с изображениями, видео, иконками и медиа-контентом

---

## 🖼 Форматы изображений

| Тип | Формат | Почему |
|---|---|---|
| Фотографии, рендеры | **WebP** (основной) + JPEG (fallback) | Лучшее сжатие при высоком качестве |
| Прозрачные PNG | **WebP** с прозрачностью | Заменяет PNG почти всегда |
| Иконки UI | **SVG** inline | Масштабируется без потерь, анимируется |
| Логотип | **SVG** | Чёткость на любых экранах |
| OG-image | **JPEG** | Лучшая поддержка в соцсетях |

**Никаких GIF** — использовать MP4/WebM для анимированного контента.

---

## 📏 Размеры изображений

| Зона сайта | Размер (px) | Соотношение | Имя файла |
|---|---|---|---|
| Hero (фон/визуал) | 1920 × 1080 | 16:9 | `hero-bg.webp` |
| Hero (мобайл) | 768 × 900 | 5:6 | `hero-bg-mobile.webp` |
| Карточка проекта (Work) | 800 × 600 | 4:3 | `work-[slug].webp` |
| Карточка large (first) | 1200 × 700 | ~16:9 | `work-[slug]-large.webp` |
| About-секция | 960 × 720 | 4:3 | `about-visual.webp` |
| OG image (соцсети) | 1200 × 630 | ~1.9:1 | `og-image.jpg` |
| Favicon | 32×32, 16×16, 180×180 | 1:1 | см. `structure.md` |

---

## 🎬 Видео (турнтейблы / showreel)

**Форматы:** MP4 (H.264) как основной + WebM (VP9) как fallback.

```html
<!-- Правильное подключение видео -->
<video
  autoplay
  muted
  loop
  playsinline
  preload="metadata"
  width="1920"
  height="1080"
  aria-label="3D turntable of Orbital Mk.II prop">
  <source src="./assets/img/work/turntable-orbital.webm" type="video/webm">
  <source src="./assets/img/work/turntable-orbital.mp4"  type="video/mp4">
</video>
```

**Параметры видео:**
- Максимальный размер файла: **8 MB** на видео (для web)
- Длина турнтейбла: 4–8 секунд зацикленного видео
- Разрешение: 1280×720 (достаточно для превью)
- `preload="metadata"` — загружаем только метаданные изначально
- `playsinline` — обязательно для iOS Safari

---

## 🗜 Сжатие и оптимизация

**Инструменты для подготовки ассетов:**
- [Squoosh](https://squoosh.app) — сжатие в WebP онлайн
- [HandBrake](https://handbrake.fr) — сжатие MP4
- [SVGO](https://jakearchibald.github.io/svgomg/) — оптимизация SVG

**Цели по размеру:**
| Ресурс | Максимум |
|---|---|
| Hero image | 300 KB |
| Work card image | 120 KB |
| About image | 180 KB |
| Turntable video | 8 MB |
| OG image | 200 KB |

---

## 📂 Именование файлов

**Правила:**
- Только строчные буквы
- Слова разделяются дефисом `-`
- Никаких пробелов, спецсимволов, кириллицы
- Имя описывает содержимое

```
✅ work-orbital-mk2.webp
✅ hero-bg-dark.webp
✅ work-corten-series.mp4
✅ about-studio-visual.webp

❌ Work Image 1.jpg
❌ рендер_проекта.png
❌ IMG_20240315.jpeg
❌ final_final_v2.webp
```

---

## 🏷 HTML-атрибуты изображений

**Обязательно для каждого `<img>`:**

```html
<!-- Стандартное изображение (не hero) -->
<img
  src="./assets/img/work/work-orbital-mk2.webp"
  alt="Orbital Mk.II — sci-fi hard surface prop, game pipeline"
  width="800"
  height="600"
  loading="lazy"
  decoding="async">

<!-- Hero-изображение (НЕ lazy) -->
<img
  src="./assets/img/hero/hero-bg.webp"
  alt="Hard surface 3D model — detailed mechanical assembly"
  width="1920"
  height="1080"
  loading="eager"
  fetchpriority="high"
  decoding="async">
```

**Правила alt-текста:**
- Описывает что изображено, не «картинка» или «изображение»
- Декоративные изображения: `alt=""`
- Логотип: `alt="Codex Studio"`

---

## 🎨 SVG-иконки

Для иконок UI (стрелки, социальные сети, меню) использовать **inline SVG** — не иконочные шрифты, не PNG.

```html
<!-- Пример: стрелка-CTA -->
<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
  <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

- `aria-hidden="true"` — если иконка декоративная (текст рядом есть)
- `aria-label="..."` + `role="img"` — если иконка смысловая (без текста)
- `fill="none" stroke="currentColor"` — цвет наследуется из CSS

---

## 📸 Стратегия для карточек проекта

Каждый проект в Work-секции требует:

```
assets/img/work/
├── work-[slug].webp          ← превью карточки (800×600)
├── work-[slug]-large.webp    ← для первой (large) карточки (1200×700)
└── work-[slug]-turntable.mp4 ← (опционально) hover-видео
```

**Hover-видео на карточке** (опционально):
```html
<!-- Видео появляется при hover, стоп при mouse leave -->
<video
  class="card-video"
  muted
  loop
  playsinline
  preload="none"
  aria-hidden="true">
  <source src="./assets/img/work/work-orbital-turntable.mp4" type="video/mp4">
</video>
```
```javascript
card.addEventListener('mouseenter', () => video.play())
card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0 })
```

---

## ⚡ Preload для критических ресурсов

```html
<!-- В <head>: preload hero-изображения для быстрого LCP -->
<link rel="preload" as="image" href="./assets/img/hero/hero-bg.webp" fetchpriority="high">

<!-- Preconnect для Fontshare (уже в structure.md) -->
<link rel="preconnect" href="https://api.fontshare.com">
```

---

## 🖼 Правило для отсутствующих изображений

Если файл изображения ещё не существует — не скрывать блок и не удалять разметку.
Использовать путь-заглушку и класс `.img-placeholder`:

```html
<img
  src="./assets/img/placeholder.webp"
  class="img-placeholder"
  alt="[описание того что здесь будет]"
  width="800"
  height="600"
  loading="lazy"
  decoding="async">
```

```css
.img-placeholder {
  background: var(--color-surface-2);
  object-fit: cover;
}
```

---

## 🚫 Запреты

- ❌ Стоковые фото людей (Unsplash-портреты) — только собственные рендеры
- ❌ GIF-анимации — только MP4/WebM
- ❌ PNG вместо WebP (кроме favicon)
- ❌ Изображения без `width` и `height` атрибутов — вызывают CLS
- ❌ `loading="lazy"` на hero-изображениях — замедляет LCP
- ❌ Файлы с именами на кириллице или с пробелами

---

*Версия: 1.0 | Апрель 2026 | Codex Studio*