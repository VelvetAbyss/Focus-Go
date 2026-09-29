import os
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "fonts")
os.makedirs(OUT, exist_ok=True)
# Source TTFs are looked up here; jobs whose source is missing are skipped, so
# one face can be rebuilt without downloading the others.
SRC = os.environ.get("FONT_SRC", "/tmp")

JOBS = {
    "Manrope-variable.woff2": "Manrope.ttf",
    "InstrumentSerif-regular.woff2": "InstrumentSerif.ttf",
    "SourceSerif4-variable.woff2": "SourceSerif4.ttf",
    "NotoSerifSC-variable.woff2": "NotoSerifSC.ttf",
}

def latin_set():
    s = set(range(0x00, 0x250))
    s |= set(range(0x2000, 0x2070))
    s |= set(range(0x20A0, 0x20C0))
    s |= {0x2122, 0x2191, 0x2193, 0x2212, 0x2026, 0xFEFF, 0xFFFD}
    return s

def gb2312_hanzi():
    s = set()
    for hi in range(0xA1, 0xF8):
        for lo in range(0xA1, 0xFF):
            try:
                s.add(ord(bytes([hi, lo]).decode("gb2312")))
            except UnicodeDecodeError:
                pass
    return s

def cjk_set():
    s = gb2312_hanzi()
    s |= set(range(0x00, 0x100))
    s |= set(range(0x2000, 0x2070))
    s |= set(range(0x3000, 0x3040))
    s |= set(range(0xFF00, 0xFFF0))
    s |= set(range(0xFE10, 0xFE20))
    return s

CHARSETS = {
    "Manrope-variable.woff2": latin_set(),
    "InstrumentSerif-regular.woff2": latin_set(),
    "SourceSerif4-variable.woff2": latin_set(),
    "NotoSerifSC-variable.woff2": cjk_set(),
}

# Source Serif 4 ships small caps, fractions, superiors and stylistic sets that
# the app never uses; dropping them takes the woff2 from ~555 KB to ~370 KB.
# tnum/lnum stay: the focus timer and stats depend on them.
CORE_FEATURES = ["kern", "liga", "lnum", "tnum", "pnum", "onum", "case", "ccmp", "locl", "mark", "mkmk"]
FEATURES = {
    "SourceSerif4-variable.woff2": CORE_FEATURES,
}

def subset(src, out, unicodes, features):
    opts = Options()
    opts.flavor = "woff2"
    opts.desubroutinize = False
    opts.name_IDs = ["*"]
    opts.recalc_timestamp = False
    opts.layout_features = features
    font = TTFont(src)
    ss = Subsetter(options=opts)
    ss.populate(unicodes=sorted(unicodes))
    ss.subset(font)
    font.save(out)

for name, file in JOBS.items():
    src = os.path.join(SRC, file)
    if not os.path.exists(src):
        print(f"skip {name}: {src} not found", flush=True)
        continue
    out = os.path.join(OUT, name)
    print(f"subsetting {name} ({len(CHARSETS[name])} codepoints) ...", flush=True)
    subset(src, out, CHARSETS[name], FEATURES.get(name, ["*"]))
    print(f"  {name}: {os.path.getsize(out)/1024:.0f} KB", flush=True)
print("DONE", flush=True)
