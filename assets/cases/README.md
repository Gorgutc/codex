# Case illustrations — /assets/cases/<case-id>/

Файлы блоков иллюстраций внутри конкретного кейса (вертикальный скролл).

## Структура

```
assets/cases/
  orbital-mk-ii/
    01.svg   # wide 1600 × 900 — hero
    02.svg   # tall 900 × 1200
    03.svg   # wide 1600 × 900
    04.svg   # tall 900 × 1200
  vega-shell/
    01.svg
    ...
```

## Как работает маппинг в коде

В `js/main.js` каждый проект описан блоком `items: []`. Каждый item имеет поле `src`, который указывает на файл в этой папке:

```js
'orbital-mk-ii': { items: [
  { type: 'image', format: 'wide', src: './assets/cases/orbital-mk-ii/01.svg', label: 'Hero render', desc: '...' },
  { type: 'image', format: 'tall', src: './assets/cases/orbital-mk-ii/02.svg', label: '...',         desc: '...' },
  ...
]}
```

## Замена

1. Положить новый файл с тем же именем (`01.svg` → `01.jpg`) — путь `src` можно не трогать, если расширение тоже `.svg`.
2. Если меняется формат — отредактировать `src` в `CARDS_DATA[id].items[i]`.
3. Если файла нет — на item останется градиент + лейбл-плейсхолдер (onerror убирает `<img>`).

## Рекомендации

- **Wide** (горизонтальные): 1600 × 900, 16:9
- **Tall** (вертикальные): 900 × 1200, 3:4
- Формат: `.webp` (лучшее сжатие) / `.svg` (векторные) / `.jpg` / `.mp4` для видео
- Имена кейсов совпадают с `data-id` карточки (kebab-case)
