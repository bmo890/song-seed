import { resources } from "../i18n/translations";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("translation catalogs", () => {
  it("keeps English and Hebrew keys in parity", () => {
    const normalizePluralKeys = (keys: string[]) => [
      ...new Set(keys.map((key) => key.replace(/_(zero|one|two|few|many|other)$/, ""))),
    ].sort();
    expect(normalizePluralKeys(leafKeys(resources.he.translation))).toEqual(
      normalizePluralKeys(leafKeys(resources.en.translation))
    );
  });
});
