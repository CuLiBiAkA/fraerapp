"""Rebuild the two original, quiet PCM cues used by the cat story. No downloads."""
from pathlib import Path
import math
import struct
import wave


ROOT = Path(__file__).resolve().parents[2] / "frontend/assets/stories"
RATE = 22050


def write(name, duration, sample):
    with wave.open(str(ROOT / name), "wb") as out:
        out.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        frames = []
        for index in range(round(duration * RATE)):
            t = index / RATE
            fade = min(1, t / .15, (duration - t) / .3)
            value = max(-1, min(1, sample(t) * fade))
            frames.append(struct.pack("<h", round(value * 32767)))
        out.writeframes(b"".join(frames))


write("cat-open-doors-purr.wav", 4, lambda t: .075 *
      (.55 + .45 * math.sin(2 * math.pi * 23 * t)) *
      (math.sin(2 * math.pi * 110 * t) + .25 * math.sin(2 * math.pi * 220 * t)))


def chime(t):
    value = .11 * math.exp(-4 * t) * math.sin(2 * math.pi * 523.25 * t)
    if t >= .45:
        value += .1 * math.exp(-4 * (t - .45)) * math.sin(2 * math.pi * 659.25 * (t - .45))
    return value


write("cat-open-doors-chime.wav", 1.6, chime)
