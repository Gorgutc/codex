# HDR Environment Maps — v0.7.0

Эта папка содержит HDR environment maps для 3D-вьювера (model-viewer IBL).

## Требуемые файлы

| Имя файла | Источник | Лицензия | Размер 1k |
|---|---|---|---|
| `studio.hdr` | https://polyhaven.com/a/studio_small_08 | CC0 | ~1.0 MB |
| `outdoor.hdr` | https://polyhaven.com/a/kloppenheim_06 | CC0 | ~1.5 MB |
| `dark.hdr` | https://polyhaven.com/a/studio_small_03 | CC0 | ~1.5 MB |

## Как скачать

1. Открыть страницу с polyhaven.com (см. таблицу выше)
2. В правой панели выбрать:
   - **Resolution:** `1K`
   - **Format:** `HDR`
3. Нажать `Download`
4. Переименовать в `studio.hdr` / `outdoor.hdr` / `dark.hdr`
5. Положить в эту папку (`./assets/hdr/`)

## Почему 1k

google/model-viewer внутри clamp'ит environment-image до 1024×512. Грузить 4k/8k —
выкинутый трафик. Все три файла суммарно ~4 MB → грузятся lazy при первом клике
на 3D-вкладку, не блокируют LCP.

## Почему именно эти три

- **studio_small_08** — soft, low-contrast, even lighting. Идеально для PBR
  product viz (atlab.io feel). Default-пресет.
- **kloppenheim_06** — открытое поле с ясным небом. Металл с него выглядит
  дорого, чёткие highlights без жёсткого солнца.
- **studio_small_03** — high-contrast с одной лампой, deep blacks. Для
  cinematic dark mood (lusion.co feel).

## Лицензия

Все файлы Poly Haven распространяются под **CC0** (public domain). Можно
использовать в коммерческих проектах без атрибуции. Поддержать авторов:
https://polyhaven.com/support
