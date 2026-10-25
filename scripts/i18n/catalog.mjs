// Shared helpers for the translation pipeline (docs/i18n/README.md).
// Catalogs are plain object literals in src/i18n/locales/<code>.ts, so they are
// read by evaluating the literal, never by importing TypeScript.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
export const LOCALES = path.join(ROOT, "src/i18n/locales");

export function catalogPath(code) {
  return path.join(LOCALES, `${code}.ts`);
}

/** The catalog object of a language, or null when it has no file yet. */
export function readCatalog(code) {
  const file = catalogPath(code);
  if (!fs.existsSync(file)) return null;
  const source = fs.readFileSync(file, "utf8");
  const start = source.indexOf("{", source.indexOf(`export const ${code} =`));
  const end = source.lastIndexOf("}");
  return vm.runInNewContext(`(${source.slice(start, end + 1)})`);
}

/** The doc comment at the top of a catalog file, kept across rewrites. */
export function readHeader(code) {
  const file = catalogPath(code);
  if (!fs.existsSync(file)) return null;
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(/^\/\*\*[\s\S]*?\*\/\n/);
  return match ? match[0] : null;
}

/** [dotted key path, value] for every string in a catalog. */
export function leaves(node, prefix = "") {
  if (typeof node === "string") return [[prefix, node]];
  return Object.entries(node).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
}

export function countWords(node) {
  return leaves(node).reduce((sum, [, value]) => sum + value.split(/\s+/).length, 0);
}

export const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Keys whose translation may use a different token the code also passes:
 *  the singular archive toast reads {{actionOne}} so its verb agrees. */
export const TOKEN_SWAPS = {
  "workspaceArchive.actionSuccess_one": ["{{actionOne}}"],
};

/** The plural categories a language uses that English doesn't (Spanish and
 *  Portuguese "many", Hebrew "two"): the merge copies `_other` into them. */
export function extraPluralCategories(code) {
  const english = new Set(new Intl.PluralRules("en").resolvedOptions().pluralCategories);
  return new Intl.PluralRules(code).resolvedOptions().pluralCategories.filter((category) => !english.has(category));
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A catalog as TypeScript source in the house style (unquoted keys, trailing
 *  commas, two-space indent). */
export function serialize(node, depth = 0) {
  const pad = "  ".repeat(depth);
  const lines = Object.entries(node).map(([key, value]) => {
    const name = IDENTIFIER.test(key) ? key : JSON.stringify(key);
    return `${pad}  ${name}: ${typeof value === "string" ? JSON.stringify(value) : serialize(value, depth + 1)},`;
  });
  return `{\n${lines.join("\n")}\n${pad}}`;
}

export function writeCatalog(code, catalog, header) {
  const body = `export const ${code} = ${serialize(catalog)} as const;\n`;
  fs.writeFileSync(catalogPath(code), `${header ?? ""}${body}`);
}
