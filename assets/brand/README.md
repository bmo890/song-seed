# SongNook mark

`songnook-mark.svg` is the master artwork for the logo: two leaves over a stem
and stand, a lamp on a desk. It was redrawn as a clean vector on 2026-10-25.
Every raster is rendered from it. Don't edit the PNGs by hand.

```
npm run brand:render
```

The script (`scripts/brand/render-brand.mjs`, uses headless Chrome) writes:

| File | Use | Shipped by |
|---|---|---|
| `assets/icon.png` | App icon (iOS, stores). Paper ground, no alpha | Store build |
| `assets/adaptive-icon.png` | Android adaptive foreground, inside the safe circle | Store build |
| `assets/splash-icon.png` | Launch splash on paper | Store build |
| `assets/brand-mark.png` | In-app mark (About, welcome tour) | OTA |
| `assets/lock-screen-artwork.png` | Lock-screen / media-notification artwork | OTA |
| `assets/favicon.png` | Web favicon | Web |
| `docs/store-assets/play/icon-512.png`, `feature-graphic-1024x500.png` | Play listing | Uploaded by hand |

Colours: light leaf `#C9978A`, terracotta `#B87D6B` (`colors.primary`), on paper
`#FDFBF7` (`colors.page`). On terracotta, the mark is a single paper colour.
