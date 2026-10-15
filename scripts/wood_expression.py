"""User-approved warm wood V2 synthesis, copied unchanged from the 2026-10-15 A/B study."""
import numpy as np

SR = 24000


def active_rms(x):
    active = x[np.abs(x) > max(np.max(np.abs(x)) * .015, 1e-8)]
    return float(np.sqrt(np.mean(active * active))) if len(active) else 0.


def hit(freq=420., decay=.055, duration=.30, contour=((0, .4), (.05, 0)), seed=40):
    """Continuous pitch curve in semitones; only the low mode gets a longer tail."""
    t = np.arange(round(SR * duration)) / SR
    semitones = np.interp(t, [p[0] for p in contour], [p[1] for p in contour])
    frequency = freq * 2 ** (semitones / 12)
    phase = 2 * np.pi * np.cumsum(frequency) / SR
    attack = 1 - np.exp(-t / .0032)
    release = np.minimum(1, (duration - t) / .025).clip(0, 1) ** 2
    # Preserve the original non-integer wood modes; soften their upper partials.
    body = .82 * np.sin(phase) * np.exp(-t / decay)
    body += .11 * np.sin(2 * phase) * np.exp(-t / .028)
    for ratio, amplitude, tau in [(1.73, .21, .020), (2.91, .065, .010), (4.27, .012, .006)]:
        body += amplitude * np.sin(ratio * phase) * np.exp(-t / tau)
    rng = np.random.default_rng(seed)
    kernel = np.hanning(19)
    texture = np.convolve(rng.normal(0, 1, len(t)), kernel / kernel.sum(), mode='same')
    texture /= max(np.std(texture), .01)
    contact = .10 * texture * np.exp(-t / .005)
    return (body + contact) * attack * release


def join(parts):
    result = np.zeros(max(round(at * SR) + len(x) for at, x in parts))
    for at, x in parts:
        begin = round(at * SR)
        result[begin:begin + len(x)] += x
    return result


def wood_events():
    flat = ((0, 0),)
    def h(f, d=.055, length=.30, curve=flat, gain=1., seed=40):
        return gain * hit(f, d, length, curve, seed)
    result = {}
    # Separate colour variants, not an ascending sequence. Player shuffles without immediate repeats.
    for i, shift in enumerate([0., -.65, .55, -.25, .85, -.9]):
        result[f'tap-{i}'] = h(420 * 2 ** (shift / 12), .039 + (i % 3) * .002,
                              .24, ((0, .65), (.042, 0)), seed=50 + i)
    result.update({
        'on': h(420, .060, .32, ((0, -1.3), (.070, 1.7))),
        'off': h(420, .052, .29, ((0, 1.2), (.065, -1.7))),
        'create': join([(0, h(365, .044, gain=.48)), (.10, h(440, .064, gain=.85))]),
        'place': join([(0, h(365, .046, .26, ((0, .8), (.05, 0)))), (.07, h(280, .026, .20, gain=.12))]),
        'complete': join([(0, h(370, .044, gain=.46)), (.09, h(470, .050, gain=.62)),
                          (.205, h(420, .080, .39, ((0, .25), (.07, 0)), gain=.90))]),
        'undo': join([(0, h(355, .037, .24, gain=.38)),
                      (.09, h(400, .059, .32, ((0, -.4), (.08, 1.4)), gain=.78))]),
        'remove': h(360, .047, .27, ((0, .8), (.075, -2.2))),
        'start': join([(0, h(374, .045, gain=.53)), (.115, h(445, .065, .34, gain=.82))]),
        'pause': h(350, .049, .28, ((0, .2), (.055, -1))),
        'resume': h(390, .065, .35, ((0, -.4), (.085, 2.1))),
        'reset': join([(0, h(420, .036, .23, gain=.40)), (.09, h(350, .050, .29, gain=.75))]),
        'finish': join([(0, h(420, .052, gain=.48)), (.13, h(499, .055, gain=.56)),
                        (.30, h(374, .087, .43, ((0, .25), (.09, 0)), gain=.85))]),
    })
    return result
