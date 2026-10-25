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
});
