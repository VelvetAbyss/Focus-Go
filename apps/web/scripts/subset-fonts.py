import os
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

OUT = "/Users/apple/Projects/Focus&go/apps/web/public/fonts"
os.makedirs(OUT, exist_ok=True)

JOBS = {
    "Manrope[wght].woff2": "/tmp/Manrope.ttf",
    "Fraunces[opsz,wght].woff2": "/tmp/Fraunces.ttf",
    "NotoSerifSC[wght].woff2": "/tmp/NotoSerifSC.ttf",
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
    "Manrope[wght].woff2": latin_set(),
    "Fraunces[opsz,wght].woff2": latin_set(),
    "NotoSerifSC[wght].woff2": cjk_set(),
}

def subset(src, out, unicodes):
    opts = Options()
    opts.flavor = "woff2"
    opts.desubroutinize = False
    opts.name_IDs = ["*"]
    opts.recalc_timestamp = False
    opts.layout_features = ["*"]
    font = TTFont(src)
    ss = Subsetter(options=opts)
    ss.populate(unicodes=sorted(unicodes))
    ss.subset(font)
    font.save(out)

for name, src in JOBS.items():
    out = os.path.join(OUT, name)
    print(f"subsetting {name} ({len(CHARSETS[name])} codepoints) ...", flush=True)
    subset(src, out, CHARSETS[name])
    print(f"  {name}: {os.path.getsize(out)/1024:.0f} KB", flush=True)
print("DONE", flush=True)
