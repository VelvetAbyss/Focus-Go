# Empty-state illustrations

Interim art for empty states (DESIGN.md › Components › Empty states), until a
commissioned set of single-line desk objects replaces it.

| Files | Source |
|---|---|
| `coffee-*`, `reading-side-*`, `sitting-reading-*`, `laying-*`, `chilling-*`, `meditating-*` | [Open Doodles](https://www.opendoodles.com/) by Pablo Stanley, downloaded 2026-09-28 from `https://opendoodles.s3-us-west-1.amazonaws.com/<name>.svg` |
| `levitate-*`, `roller-skating-*`, `plant-*`, `strolling-*`, `unboxing-*`, `clumsy-*`, `sitting-*`, `swinging-*`, `ice-cream-*` | Same source and licence, downloaded 2026-09-28 |

**License:** CC0 1.0 (public domain dedication). No attribution is required;
it is kept here as a courtesy.

**Modifications:** each drawing is split into two single-colour mask layers,
`<name>-lines.svg` (the ink strokes) and `<name>-wash.svg` (the accent fill),
with coordinates rounded to one decimal and the viewBox cropped to the ink
(plus a 12-unit margin), so every drawing sits flush left at a shared height. `shared/ui/Doodle.tsx` paints the lines
in `--pencil` and the wash in a faint pencil tint, so the art follows the theme.
