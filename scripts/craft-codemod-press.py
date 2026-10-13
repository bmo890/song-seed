#!/usr/bin/env python3
"""Move the mechanical cases of <Pressable> onto the kit's <Press>.

docs/product-plan/craft-control-kit.md, move 2. This is the SAFE lane only.
A file is converted when EVERY <Pressable> in it:
  - carries the shared press style, `pressed ? styles.pressDown : null`
    (or appStyles.pressDown), as the last entry of a style function, and
  - has no `disabled` attribute (Press dims a disabled control itself; a call
    site that also dims would double up, so those go to the hand pass).
Anything else leaves the whole file untouched, so tags can never mismatch.

Behaviour is preserved: where onPress opens with `haptic.tap();` that line is
dropped and Press's own tap stands in; otherwise the tag gets haptic="none"
and whatever the handler did before, it still does. `haptic="none"` is then a
grep-able list of presses still owed a decision (craft-lint counts it).

  python3 scripts/craft-codemod-press.py            dry run, prints the plan
  python3 scripts/craft-codemod-press.py --write    apply
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src")
PRESS = os.path.join(ROOT, "components", "common", "Press")
SKIP = ("__tests__", os.sep + "dev" + os.sep)
HOSTS = {"Press.tsx", "IconButton.tsx", "AudioReel.tsx", "TimeRangeSelector.tsx",
         "ListScrubber.tsx", "WaveformStrip.tsx", "ScrubBar.tsx"}

STYLE_LIST = re.compile(
    r"style=\{\(\{ pressed \}\) => \[(?P<items>.*?),\s*pressed \? (?:styles|appStyles)\.pressDown : null,?\s*\]\}",
    re.S,
)
STYLE_ONLY = re.compile(
    r"\s*style=\{\(\{ pressed \}\) => \(?pressed \? (?:styles|appStyles)\.pressDown : null\)?\}"
)
LEADING_TAP = re.compile(r"(onPress=\{\(\) => \{)\s*(?://[^\n]*\n\s*)*haptic\.tap\(\);")


def tag_end(src, start):
    """Index just past the `>` closing the opening tag that begins at start."""
    depth, quote, i = 0, None, start
    while i < len(src):
        c = src[i]
        if quote:
            if c == quote:
                quote = None
        elif depth == 0 and c in "\"'":
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c == ">" and depth == 0:
            return i + 1
        i += 1
    return -1


def top_level_commas(expr):
    depth = 0
    for c in expr:
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == "," and depth == 0:
            return True
    return False


def convert_tag(tag):
    """Return the converted opening tag, or None if it is not the safe shape."""
    if re.search(r"\bdisabled\b", tag):
        return None
    m = STYLE_LIST.search(tag)
    if m:
        items = m.group("items").strip()
        style = "style={[%s]}" % items if top_level_commas(items) else "style={%s}" % items
        tag = tag[: m.start()] + style + tag[m.end():]
    elif STYLE_ONLY.search(tag):
        tag = STYLE_ONLY.sub("", tag, count=1)
    else:
        return None
    if "pressed" in tag:
        return None
    tag = "<Press" + tag[len("<Pressable"):]
    if LEADING_TAP.search(tag):
        tag = LEADING_TAP.sub(r"\1", tag, count=1)
    else:
        m = re.match(r"<Press\n(\s+)", tag)
        if m:
            tag = "<Press\n%shaptic=\"none\"\n%s" % (m.group(1), m.group(1)) + tag[m.end():]
        else:
            tag = tag.replace("<Press", '<Press haptic="none"', 1)
    return tag


def convert_file(path):
    src = open(path, encoding="utf-8").read()
    if "<Pressable" not in src:
        return None
    out, i, n = [], 0, 0
    while True:
        j = src.find("<Pressable", i)
        if j < 0:
            out.append(src[i:])
            break
        end = tag_end(src, j)
        if end < 0:
            return None
        new = convert_tag(src[j:end])
        if new is None:
            return None
        out.append(src[i:j])
        out.append(new)
        i, n = end, n + 1
    res = "".join(out).replace("</Pressable>", "</Press>")
    # imports
    rn = re.search(r"import \{([^}]*)\} from \"react-native\";", res)
    if not rn:
        return None
    names = [x.strip() for x in rn.group(1).split(",") if x.strip()]
    names = [x for x in names if x != "Pressable"]
    rel = os.path.relpath(PRESS, os.path.dirname(path)).replace(os.sep, "/")
    if not rel.startswith("."):
        rel = "./" + rel
    press_import = 'import { Press } from "%s";' % rel
    rn_line = 'import { %s } from "react-native";' % ", ".join(names) if names else ""
    res = res[: rn.start()] + (rn_line + "\n" if rn_line else "") + press_import + res[rn.end():]
    if re.search(r"\bPressable\b", res):
        return None
    return res, n


def main():
    write = "--write" in sys.argv
    files = tags = 0
    for d, _, names in os.walk(ROOT):
        for name in names:
            path = os.path.join(d, name)
            if not name.endswith(".tsx") or name in HOSTS or any(s in path for s in SKIP):
                continue
            got = convert_file(path)
            if not got:
                continue
            res, n = got
            files, tags = files + 1, tags + n
            print("%3d  %s" % (n, os.path.relpath(path, ROOT)))
            if write:
                open(path, "w", encoding="utf-8").write(res)
    print("%s %d presses in %d files" % ("converted" if write else "would convert", tags, files))


if __name__ == "__main__":
    main()
