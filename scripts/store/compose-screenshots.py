"""Store screenshots: a caption on paper above a real screen that bleeds off the bottom.

Raw captures come from the iPhone 17 Pro Max simulator (1320x2868) with the demo
library staged by the dev-only "Store library (dev)" collection menu row
(src/dev/storeLibrary.ts). Needs Pillow:

  python3 scripts/store/compose-screenshots.py apple docs/store-assets/raw docs/store-assets/apple/screenshots
  python3 scripts/store/compose-screenshots.py play  docs/store-assets/raw docs/store-assets/play/screenshots

Apple: 1320x2868 (6.9"). Play: 1080x2160 (Play allows at most 2:1).
Captions approved by the founder 2026-11-09 (store-truth.md section 6).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "../../node_modules/@expo-google-fonts")
LORA = f"{ROOT}/lora/500Medium/Lora_500Medium.ttf"
JAKARTA = f"{ROOT}/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf"
TARGET = sys.argv[1]
RAW = sys.argv[2]
OUT = sys.argv[3]

# tokens.ts
GROUND = (0xF4, 0xF1, 0xED)  # surfaceContainer
INK = (0x1B, 0x1C, 0x1A)  # textPrimary
SECONDARY = (0x84, 0x73, 0x6F)  # textSecondary

# Play's frame is drawn at Apple's width, then scaled to 1080x2160.
W, H = (1320, 2640) if TARGET == "play" else (1320, 2868)
SCREEN_W, SCREEN_TOP = (980, 650) if TARGET == "play" else (1080, 690)
FRAMES = [
    ("01-capture", "recorder", "Catch it before it's gone", "Tap once and you're recording."),
    ("02-sketch", "sketch-b", "Every idea grows into a song", "Takes, versions and side ideas in one sketch."),
    ("03-write", "lyrics-b", "Lyrics and chords, every draft kept", "Write, chart and transpose in one place."),
    ("04-practice", "practice-sound", "Learn it, then layer it", "Loop the hard part, slow it down, add a harmony."),
    ("05-words", "words-a", "Stuck on a line?", "Lyric Spark: word games to get past writer's block."),
    ("06-organize", "collection", "Get organized", "Workspaces and collections for every project."),
    ("07-revisit", "revisit-b", "Never lose a gem", "Revisit brings back the ones you forgot."),
    ("08-send", "received-player", "Send the song, not just the audio", "Lyrics, chords, notes and marks go with it."),
]


def wrap(draw, text, font, width):
    """Greedy wrap, then rebalance a two-line wrap so neither line is a widow."""
    lines = greedy(draw, text, font, width)
    if len(lines) != 2:
        return lines
    words = text.split()
    best = min(
        (max(draw.textlength(" ".join(words[:i]), font=font), draw.textlength(" ".join(words[i:]), font=font)), i)
        for i in range(1, len(words))
    )
    return [" ".join(words[: best[1]]), " ".join(words[best[1] :])]


def greedy(draw, text, font, width):
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    lines.append(cur)
    return lines


def frame(name, raw, title, sub):
    title, sub = title.replace("'", "’"), sub.replace("'", "’")
    canvas = Image.new("RGB", (W, H), GROUND)
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(LORA, 104)
    sub_font = ImageFont.truetype(JAKARTA, 46)

    title_lines = wrap(draw, title, title_font, W - 200)
    sub_lines = wrap(draw, sub, sub_font, W - 240)
    block = len(title_lines) * 128 + 22 + len(sub_lines) * 64
    top = SCREEN_TOP
    y = 120 + (top - 120 - block) // 2
    for line in title_lines:
        draw.text((W / 2, y), line, font=title_font, fill=INK, anchor="mt")
        y += 128
    y += 22
    for line in sub_lines:
        draw.text((W / 2, y), line, font=sub_font, fill=SECONDARY, anchor="mt")
        y += 64

    screen = Image.open(f"{RAW}/{raw}.png").convert("RGB")
    sw = SCREEN_W
    sh = round(screen.height * sw / screen.width)
    screen = screen.resize((sw, sh), Image.LANCZOS)
    left = (W - sw) // 2
    radius = 72

    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh + radius), radius=radius, fill=255)

    # Whisper shadow (≤ 0.08) so the paper screen lifts off the paper ground.
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((left, top + 18, left + sw, top + sh + 200), radius=radius, fill=int(255 * 0.08))
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    canvas = Image.composite(Image.new("RGB", (W, H), (60, 40, 30)), canvas, shadow)

    canvas.paste(screen, (left, top), mask)
    # Hairline edge, so the screen's own paper doesn't melt into the ground.
    ImageDraw.Draw(canvas).rounded_rectangle(
        (left, top, left + sw - 1, top + sh + radius), radius=radius, outline=(0xE4, 0xDF, 0xD8), width=2
    )
    if TARGET == "play":
        canvas.resize((1080, 2160), Image.LANCZOS).save(f"{OUT}/{name}.png")
    else:
        canvas.save(f"{OUT}/{name}.jpg", quality=92)


for f in FRAMES:
    if len(sys.argv) > 4 and f[0] not in sys.argv[4:]:
        continue
    frame(*f)
    print(f[0])
