# Self-hosted fonts

These are **subsetted variable** woff2 files, self-hosted so the core UI and primary
Chinese text render **offline** and without a Google Fonts round-trip (faster first paint).
`@font-face` declarations live in `src/styles/_variables.scss`.

| File | Family | Axes | Subset | Size |
|---|---|---|---|---|
| `Manrope-variable.woff2` | Manrope | wght | Latin + punctuation | ~90 KB |
| `InstrumentSerif-regular.woff2` | Instrument Serif | — (400 upright) | Latin + punctuation | ~61 KB |
| `SourceSerif4-variable.woff2` | Source Serif 4 | opsz, wght | Latin + punctuation, core features only | ~370 KB |
| `NotoSerifSC-variable.woff2` | Noto Serif SC | wght | GB2312 hanzi + CJK punctuation + ASCII | ~5.6 MB |

Decorative/display fonts (Ma Shan Zheng, ZCOOL, Lora, Playfair Display, …) are **not**
bundled — they still load from Google at runtime with a system-font fallback offline.

## License
All four are **SIL Open Font License 1.1** — see `OFL-Manrope.txt`, `OFL-InstrumentSerif.txt`,
`OFL-SourceSerif4.txt`, `OFL-NotoSerifSC.txt` (bundled and shipped with the app).

## Regenerating
Sources are the variable TTFs from the `google/fonts` repo. To rebuild:

```bash
python3 -m venv /tmp/fgfonts-venv
/tmp/fgfonts-venv/bin/pip install fonttools brotli
# download variable TTFs (curl handles redirects/large files reliably):
curl -sL -A "Mozilla/5.0" -o /tmp/Manrope.ttf     "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf"
curl -sL -A "Mozilla/5.0" -o /tmp/InstrumentSerif.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/InstrumentSerif-Regular.ttf"
curl -sL -A "Mozilla/5.0" -o /tmp/SourceSerif4.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf"
curl -sL -A "Mozilla/5.0" -o /tmp/NotoSerifSC.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
/tmp/fgfonts-venv/bin/python scripts/subset-fonts.py   # FONT_SRC=<dir> to read TTFs elsewhere
# faces whose TTF is missing are skipped, so one face can be rebuilt alone
```

To widen the Chinese coverage, edit `cjk_set()` in `scripts/subset-fonts.py` (e.g. add
more CJK blocks) and re-run — trading file size for glyph coverage.
