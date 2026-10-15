"""Original procedural sound sketches. No game recordings or external samples."""
from pathlib import Path
import json
import wave
import numpy as np
from wood_expression import active_rms, wood_events

ROOT = Path(__file__).resolve().parents[1]
SR = 24000
OUT = ROOT / 'apps/web/src/shared/sound/assets'
OUT.mkdir(parents=True, exist_ok=True)


def noise(n, rng, width=13):
    raw = rng.normal(0, 1, n)
    kernel = np.hanning(width)
    smooth = np.convolve(raw, kernel/kernel.sum(), mode='same')
    return smooth / max(np.std(smooth), .01)


def hit(style, pitch=1., seed=22, duration=.25):
    t = np.arange(round(SR*duration)) / SR
    rng = np.random.default_rng(seed)
    # Both start and finish at zero, avoiding discontinuities at file edges.
    rise = 1 - np.exp(-t/.0016)
    final = np.minimum(1, (duration-t)/.012).clip(0, 1)**2
    if style == 'wood':
        # A small, damped resonant object; intentionally inharmonic, not a note.
        ratios = [1, 1.73, 2.91, 4.27]
        base = 420 * pitch
        contact = .26*noise(len(t), rng, 17)*np.exp(-t/.006)*rise
        body = np.zeros_like(t)
        for ratio, amp, decay in zip(ratios, [.82,.38,.16,.045], [.029,.019,.012,.008]):
            frequency = base*ratio*(1+.055*np.exp(-t/.012))
            phase = 2*np.pi*np.cumsum(frequency)/SR
            body += amp*np.sin(phase)*np.exp(-t/decay)*rise
    elif style == 'grain':
        base = 810 * pitch
        contact = .18*noise(len(t), rng, 7)*np.exp(-t/.005)*rise
        body = np.zeros_like(t)
        for ratio, amp, decay in zip([1, 1.48, 2.37, 3.89], [.65,.31,.12,.025], [.023,.017,.011,.006]):
            body += amp*np.sin(2*np.pi*base*ratio*t)*np.exp(-t/decay)*rise
    else:
        # Brief downward pressure/release contour, deliberately no melodic sequence.
        frequency = pitch*(235+255*np.exp(-t/.016))
        phase = 2*np.pi*np.cumsum(frequency)/SR
        contact = .12*noise(len(t), rng, 21)*np.exp(-t/.007)*rise
        body = (np.sin(phase)+.22*np.sin(2.08*phase)+.06*np.sin(3.37*phase))
        body *= np.exp(-t/.031)*rise
    contact *= final
    body *= final
    return contact, body


def combine(parts):
    n = max(round(offset*SR)+len(x) for offset, x in parts)
    out = np.zeros(n)
    for offset, x in parts:
        start = round(offset*SR)
        out[start:start+len(x)] += x
    return out


def normalized(x, target=.052):
    active = x[np.abs(x) > max(np.max(np.abs(x))*.015, 1e-8)]
    rms = np.sqrt(np.mean(active**2)) if len(active) else 1
    factor = min(target/max(rms, 1e-9), .27/max(np.max(np.abs(x)),1e-9))
    return x*factor, factor


# Keep the two other materials byte-for-byte; use the approved V2 wood palette.
manifests = {}
measurements = {}
for style in ['wood', 'grain', 'soft']:
    clips = {}
    for i, pitch in enumerate([1., .985, 1.017]):
        c, b = hit(style, pitch, seed=22+i)
        clips[f'tap-{i}'], _ = normalized(c+b)
    def one(pitch, gain=1):
        c, b = hit(style, pitch, seed=29)
        return gain*(c+b)
    gestures = {
        'on': [(0, one(1.10))],
        'off': [(0, one(.86))],
        'create': [(0, one(.87,.48)),(.047,one(1.12,.80))],
        'place': [(0, one(.91)),(.036,one(.70,.15))],
        'complete': [(0,one(1.05,.64)),(.065,one(.79))],
        'undo': [(0,one(.79,.45)),(.055,one(1.04,.67))],
        'remove': [(0,one(.91,.7)),(.042,one(.64,.3))],
        'start': [(0,one(.93,.62)),(.076,one(1.13,.47))],
        'pause': [(0,one(.79,.8))],
        'resume': [(0,one(.92,.45)),(.047,one(1.09,.72))],
        'reset': [(0,one(.95,.4)),(.058,one(.72,.65))],
        'finish': [(0,one(.86,.65)),(.095,one(1.02,.40)),(.185,one(.73,.62))],
    }
    for event, parts in gestures.items():
        clips[event], _ = normalized(combine(parts), .049 if event=='finish' else .052)
    if style == 'wood':
        # Match the approved A/B exactly: its reference was the PCM16 V1 export.
        reference = {key: np.rint(clip*32767).astype('<i2').astype(float)/32767 for key, clip in clips.items()}
        clips = {}
        for event, clip in wood_events().items():
            ref_key = f'tap-{int(event[-1]) % 3}' if event.startswith('tap-') else event
            factor = min(active_rms(reference[ref_key])/active_rms(clip), .27/max(np.abs(clip)))
            clips[event] = clip*factor
    sprite = []
    manifest = {}
    cursor = 0
    measurements[style] = {}
    for event, clip in clips.items():
        pcm = np.rint(clip*32767).astype('<i2')
        assert np.isfinite(clip).all() and abs(clip).max() < .28
        assert pcm[0] == 0 and pcm[-1] == 0
        manifest[event] = {'offset': cursor/SR, 'duration': len(pcm)/SR}
        measurements[style][event] = {'peak_dbfs': round(float(20*np.log10(max(abs(clip).max(),1e-9))),2), 'duration_ms': round(len(pcm)/SR*1000)}
        gap = round((.05 if style == 'wood' else .03)*SR)
        sprite += [pcm, np.zeros(gap, dtype='<i2')]
        cursor += len(pcm)+gap
    with wave.open(str(OUT / f'{style}.wav'), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(np.concatenate(sprite).tobytes())
    manifests[style] = manifest
assert manifests['grain'] == manifests['soft']
(OUT/'sprite.json').write_text(json.dumps(manifests['grain'], indent=2)+'\n')
(OUT/'wood-sprite.json').write_text(json.dumps(manifests['wood'], indent=2)+'\n')
(OUT/'measurements.json').write_text(json.dumps(measurements, indent=2)+'\n')
print(json.dumps({'themes':3, 'gestures_per_theme':len(gestures)+1, 'clips_per_theme':{style:len(m) for style,m in manifests.items()}, 'wav_bytes':sum(p.stat().st_size for p in OUT.glob('*.wav')), 'edges_zero':True}))
