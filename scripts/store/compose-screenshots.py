"""Store screenshots: a caption on paper above a real screen.

Both stores show the whole screen, with all four corners. A screen that bled off the
bottom edge cut the main controls in half (the recorder's Pause, the record button): Play
first, then Apple (founder, 2026-11-14, both times).

Raw captures come from the iPhone 17 Pro Max simulator (1320x2868) with the demo
library staged by the dev-only "Store library (dev)" collection menu row
(src/dev/storeLibrary.ts). Needs Pillow:

  python3 scripts/store/compose-screenshots.py apple docs/store-assets/raw docs/store-assets/apple/screenshots
  python3 scripts/store/compose-screenshots.py play  docs/store-assets/raw docs/store-assets/play/screenshots

Localized sets (2026-11-16): STORE_LANG=es|de|pt|he, raw captures in raw/<lang>/ (the app's
own interface in that language; the demo library's song content stays as staged), out to
<store>/screenshots/<lang>/. Hebrew draws in Frank Ruhl Libre / Heebo, reordered for
right-to-left with python-bidi (Pillow here has no raqm).

Apple: 1320x2868 (6.9"). Play: 1080x2160 (Play allows at most 2:1).
Captions approved by the founder 2026-11-09 (store-truth.md section 6).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "../../node_modules/@expo-google-fonts")
LORA = f"{ROOT}/lora/500Medium/Lora_500Medium.ttf"
JAKARTA = f"{ROOT}/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf"
LANG = os.environ.get("STORE_LANG", "en")
HEBREW = LANG == "he"
if HEBREW:
    from bidi import get_display
    LORA = f"{ROOT}/frank-ruhl-libre/500Medium/FrankRuhlLibre_500Medium.ttf"
    JAKARTA = f"{ROOT}/heebo/500Medium/Heebo_500Medium.ttf"
TARGET = sys.argv[1]
RAW = sys.argv[2]
OUT = sys.argv[3]

# tokens.ts
GROUND = (0xF4, 0xF1, 0xED)  # surfaceContainer
INK = (0x1B, 0x1C, 0x1A)  # textPrimary
SECONDARY = (0x84, 0x73, 0x6F)  # textSecondary

# Play's frame is drawn at Apple's width, then scaled to 1080x2160.
W, H = (1320, 2640) if TARGET == "play" else (1320, 2868)
SCREEN_W, SCREEN_TOP = (900, 600) if TARGET == "play" else (1000, 600)
# Neither store bleeds: the whole screen shows (BLEED kept for a future frame that wants it).
BLEED = False
# Captions per language: the same eight beats, the app's own words for its features.
CAPTIONS = {
    "es": [
        ("Atrápala antes de que se escape", "Un toque y ya estás grabando."),
        ("Cada idea se vuelve canción", "Tomas, versiones e ideas sueltas en un boceto."),
        ("Letra y acordes, cada borrador guardado", "Escribe, cifra y transporta en un solo lugar."),
        ("Apréndela y súmale partes", "Repite lo difícil, bájale la velocidad, suma otra parte."),
        ("¿Atascado en un verso?", "Chispa de letras: ejercicios de escritura para salir del bloqueo."),
        ("Todo en orden", "Espacios de trabajo y colecciones para cada proyecto."),
        ("Viejas ideas, nueva vida", "Revisitar te devuelve las que olvidaste."),
        ("Envía la canción, no solo el audio", "Letra, acordes, notas y marcas van con ella."),
    ],
    "de": [
        ("Halt sie fest, bevor sie weg ist", "Einmal tippen, und du nimmst auf."),
        ("Aus jeder Idee wird ein Song", "Takes, Versionen und Nebenideen in einer Skizze."),
        ("Text und Akkorde, jeder Entwurf bleibt", "Schreiben, Akkorde setzen und transponieren an einem Ort."),
        ("Erst lernen, dann Spuren drauf", "Die schwere Stelle loopen, langsamer machen, eine Stimme dazu."),
        ("Hängst du an einer Zeile?", "Textfunke: Schreibübungen gegen die Blockade."),
        ("Alles in Ordnung", "Arbeitsbereiche und Sammlungen für jedes Projekt."),
        ("Alte Ideen, neues Leben", "Wiederentdecken bringt die vergessenen zurück."),
        ("Schick den Song, nicht nur das Audio", "Text, Akkorde, Notizen und Markierungen kommen mit."),
    ],
    "pt": [
        ("Capture antes que escape", "Um toque e você já está gravando."),
        ("Toda ideia vira música", "Takes, versões e ideias soltas em um esboço."),
        ("Letra e acordes, cada rascunho guardado", "Escreva, cifre e transponha em um só lugar."),
        ("Aprenda e acrescente camadas", "Repita o trecho difícil, desacelere, grave outra parte."),
        ("Travou num verso?", "Faísca de letras: exercícios de escrita para destravar."),
        ("Tudo organizado", "Espaços de trabalho e coleções para cada projeto."),
        ("Ideias antigas, vida nova", "Revisitar traz de volta as que você esqueceu."),
        ("Envie a música, não só o áudio", "Letra, acordes, notas e marcações vão junto."),
    ],
    "he": [
        ("לתפוס לפני שזה בורח", "נגיעה אחת ואתם מקליטים."),
        ("כל רעיון גדל לשיר", "טייקים, גרסאות ורעיונות צדדיים בסקיצה אחת."),
        ("מילים ואקורדים, כל טיוטה נשמרת", "לכתוב, להוסיף אקורדים ולעשות טרנספוזיציה במקום אחד."),
        ("ללמוד, ואז להוסיף שכבות", "לחזור על הקטע הקשה, להאט, להוסיף עוד תפקיד."),
        ("נתקעתם בשורה?", "ניצוץ למילים: תרגילי כתיבה שעוזרים לצאת מהמחסום."),
        ("הכול מסודר", "מרחבי עבודה ואוספים לכל פרויקט."),
        ("רעיונות ישנים, חיים חדשים", "רעיונות ששכחתם חוזרים אליכם."),
        ("לשלוח את השיר, לא רק את האודיו", "מילים, אקורדים, הערות וסימונים נשלחים איתו."),
    ],
}

FRAMES = [
    ("01-capture", "recorder", "Catch it before it's gone", "Tap once and you're recording."),
    ("02-sketch", "sketch-b", "Every idea grows into a song", "Takes, versions and side ideas in one sketch."),
    ("03-write", "lyrics-b", "Lyrics and chords, every draft kept", "Write, chart and transpose in one place."),
    ("04-practice", "practice-sound", "Learn it, then layer it", "Loop the hard part, slow it down, add another part."),
    ("05-words", "words-a", "Stuck on a line?", "Lyric Spark: writing exercises to get past the block."),
    ("06-organize", "collection", "Get organized", "Workspaces and collections for every project."),
    ("07-revisit", "revisit-b", "Old ideas, new life", "Revisit brings back the ones you forgot."),
    ("08-send", "received-player", "Send the song, not just the audio", "Lyrics, chords, notes and marks go with it."),
]


def shown(text):
    """The line as drawn: Hebrew reordered for a left-to-right renderer."""
    return get_display(text) if HEBREW else text


def wrap(draw, text, font, width):
    """Greedy wrap, then rebalance a two-line wrap so neither line is a widow."""
    lines = greedy(draw, text, font, width)
    if len(lines) != 2:
        return lines
    words = text.split()
    best = min(
        (max(draw.textlength(shown(" ".join(words[:i])), font=font), draw.textlength(shown(" ".join(words[i:])), font=font)), i)
        for i in range(1, len(words))
    )
    return [" ".join(words[: best[1]]), " ".join(words[best[1] :])]


def greedy(draw, text, font, width):
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(shown(trial), font=font) <= width or not cur:
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
        draw.text((W / 2, y), shown(line), font=title_font, fill=INK, anchor="mt")
        y += 128
    y += 22
    for line in sub_lines:
        draw.text((W / 2, y), shown(line), font=sub_font, fill=SECONDARY, anchor="mt")
        y += 64

    screen = Image.open(f"{RAW}/{raw}.png").convert("RGB")
    sw = SCREEN_W
    sh = round(screen.height * sw / screen.width)
    screen = screen.resize((sw, sh), Image.LANCZOS)
    left = (W - sw) // 2
    radius = 72

    # A bleeding screen rounds only its top corners (the bottom is off the canvas).
    bottom = sh + radius if BLEED else sh - 1
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, bottom), radius=radius, fill=255)

    # Whisper shadow (≤ 0.08) so the paper screen lifts off the paper ground.
    shadow = Image.new("L", (W, H), 0)
    shadow_bottom = top + sh + 200 if BLEED else top + sh + 18
    ImageDraw.Draw(shadow).rounded_rectangle((left, top + 18, left + sw, shadow_bottom), radius=radius, fill=int(255 * 0.08))
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    canvas = Image.composite(Image.new("RGB", (W, H), (60, 40, 30)), canvas, shadow)

    canvas.paste(screen, (left, top), mask)
    # Hairline edge, so the screen's own paper doesn't melt into the ground.
    ImageDraw.Draw(canvas).rounded_rectangle(
        (left, top, left + sw - 1, top + bottom), radius=radius, outline=(0xE4, 0xDF, 0xD8), width=2
    )
    if TARGET == "play":
        canvas.resize((1080, 2160), Image.LANCZOS).save(f"{OUT}/{name}.png")
    else:
        canvas.save(f"{OUT}/{name}.jpg", quality=92)


os.makedirs(OUT, exist_ok=True)
for index, f in enumerate(FRAMES):
    if len(sys.argv) > 4 and f[0] not in sys.argv[4:]:
        continue
    name, raw, title, sub = f
    if LANG != "en":
        title, sub = CAPTIONS[LANG][index]
    frame(name, raw, title, sub)
    print(name)
