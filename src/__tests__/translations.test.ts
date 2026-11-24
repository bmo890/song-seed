import fs from "fs";
import path from "path";
import { resources } from "../i18n/translations";
import { APP_LANGUAGE_CODES } from "../i18n/languages";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

const normalizePluralKeys = (keys: string[]) => [
  ...new Set(keys.map((key) => key.replace(/_(zero|one|two|few|many|other)$/, ""))),
].sort();

describe("translation catalogs", () => {
  it.each(APP_LANGUAGE_CODES.filter((code) => code !== "en"))("%s has every English key, and no others", (code) => {
    expect(normalizePluralKeys(leafKeys(resources[code].translation))).toEqual(
      normalizePluralKeys(leafKeys(resources.en.translation))
    );
  });

  it("has a catalog for every language the pickers offer", () => {
    expect(Object.keys(resources).sort()).toEqual([...APP_LANGUAGE_CODES].sort());
  });

  // A key filed one level too deep shows its own name on screen ("chordChart.sectionNumbered",
  // found 2026-11-24): every key the code asks for by name must be in the catalog.
  it("has every key the code asks for by name", () => {
    const known = new Set(normalizePluralKeys(leafKeys(resources.en.translation)));
    const root = path.join(__dirname, "..");
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__" && entry.name !== "locales") walk(full);
        } else if (/\.tsx?$/.test(entry.name)) sources.push(full);
      }
    };
    walk(root);
    const missing: string[] = [];
    for (const file of sources) {
      // helpContent.ts reads through its own t() that adds the "helpContent." prefix.
      const prefix = file.endsWith(path.join("common", "helpContent.ts")) ? "helpContent." : "";
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/\b(?:i18n\.t|t)\(\s*["'`]([a-zA-Z]\w*(?:\.\w+)+)["'`]/g)) {
        if (!known.has(prefix + m[1])) missing.push(`${path.relative(root, file)}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
