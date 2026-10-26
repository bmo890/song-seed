import { useEffect, useState } from "react";
import { Image } from "react-native";
import { Skia, type SkTypeface, type SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { describeError, persistLog } from "../../services/persistLog";

/**
 * The reel's label faces (section names, pin badges, bar numbers), loaded once
 * for the whole app and shared by every reel.
 *
 * Skia's own `useFonts` waits on all faces together: one face that fails to load
 * on a phone leaves every label on every reel blank, silently (founder's Android
 * phone, 2026-10-26). Here each face loads on its own and a failure only drops
 * that face: the paragraph engine falls back to the system font, so the words
 * still draw. A failure is written to the diagnostic log with its asset URI.
 */
const FACES = [
  {
    family: "Plus Jakarta Sans",
    name: "PlusJakartaSans_600SemiBold",
    source: require("@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf"),
  },
  {
    family: "Plus Jakarta Sans",
    name: "PlusJakartaSans_500Medium",
    source: require("@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf"),
  },
  // Heebo is the Hebrew fallback, mirroring the app-level RTL font remap.
  { family: "Heebo", name: "Heebo_600SemiBold", source: require("@expo-google-fonts/heebo/600SemiBold/Heebo_600SemiBold.ttf") },
  { family: "Heebo", name: "Heebo_500Medium", source: require("@expo-google-fonts/heebo/500Medium/Heebo_500Medium.ttf") },
] as const;

/** A face that never answers stops holding the labels back after this long. */
const FACE_LOAD_TIMEOUT_MS = 4000;

export type ReelFonts = {
  /** Paragraph faces for section names and pin labels. */
  provider: SkTypefaceFontProvider;
  /** The bar-number face (Jakarta SemiBold); null draws in the default face. */
  gridTypeface: SkTypeface | null;
};

let loaded: ReelFonts | null = null;
let pending: Promise<ReelFonts> | null = null;
/** False while a face is missing: one more load follows (a slow cold start can
 *  time out), up to MAX_ATTEMPTS loads per app run; the labels draw meanwhile. */
let complete = false;
let attempts = 0;
const MAX_ATTEMPTS = 2;

function loadFace(face: (typeof FACES)[number]): Promise<SkTypeface | null> {
  const uri = Image.resolveAssetSource(face.source)?.uri ?? "";
  const fail = (why: string) => {
    persistLog("reel.fontFailed", `${face.name}: ${why} · ${uri.slice(0, 120)}`);
    return null;
  };
  if (!uri) return Promise.resolve(fail("no asset uri"));
  const load = Skia.Data.fromURI(uri).then((data) => Skia.Typeface.MakeFreeTypeFaceFromData(data));
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), FACE_LOAD_TIMEOUT_MS));
  return Promise.race([load, timeout]).then(
    (result) => {
      if (result === "timeout") return fail("timed out");
      return result ?? fail("not a typeface");
    },
    (error) => fail(describeError(error))
  );
}

function loadReelFonts(): Promise<ReelFonts> {
  if (!pending) {
    attempts += 1;
    pending = Promise.all(FACES.map(loadFace)).then((typefaces) => {
      const provider = Skia.TypefaceFontProvider.Make();
      typefaces.forEach((typeface, index) => {
        if (typeface) provider.registerFont(typeface, FACES[index].family);
      });
      loaded = { provider, gridTypeface: typefaces[0] };
      complete = typefaces.every(Boolean);
      if (!complete && attempts < MAX_ATTEMPTS) pending = null;
      return loaded;
    });
  }
  return pending;
}

/** The shared reel faces; null only until the first load settles. */
export function useReelFonts(): ReelFonts | null {
  const [fonts, setFonts] = useState<ReelFonts | null>(loaded);
  useEffect(() => {
    if (fonts && (complete || attempts >= MAX_ATTEMPTS)) return;
    let alive = true;
    void loadReelFonts().then((next) => {
      if (alive) setFonts(next);
    });
    return () => {
      alive = false;
    };
  }, [fonts]);
  return fonts;
}
