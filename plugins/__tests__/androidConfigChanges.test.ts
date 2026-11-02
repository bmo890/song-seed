/**
 * Audit 2026-11-02, 10-H1: MainActivity handled only the Expo template's config changes,
 * so a fold, a font or display size change, or a language change rebuilt the activity
 * and remounted the app inside a live take. The plugin must add the rest on every
 * prebuild (EAS regenerates the manifest).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { configureManifest } = require("../withSongNookAndroidVariants");

function templateManifest() {
  return {
    manifest: {
      application: [
        {
          activity: [
            {
              $: {
                "android:name": ".MainActivity",
                "android:configChanges": "keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode",
              },
              "intent-filter": [],
            },
          ],
        },
      ],
    },
  };
}

function configChanges(manifest: ReturnType<typeof templateManifest>): string[] {
  return manifest.manifest.application[0].activity[0].$["android:configChanges"].split("|");
}

describe("MainActivity config changes", () => {
  it("handles the changes that used to rebuild the activity mid-take", () => {
    const changes = configChanges(configureManifest(templateManifest()));
    for (const change of ["smallestScreenSize", "density", "fontScale", "locale", "layoutDirection"]) {
      expect(changes).toContain(change);
    }
    // The template's own entries stay.
    for (const change of ["keyboard", "keyboardHidden", "orientation", "screenSize", "screenLayout", "uiMode"]) {
      expect(changes).toContain(change);
    }
  });

  it("is idempotent across prebuilds", () => {
    const once = configureManifest(templateManifest());
    const twice = configureManifest(once);
    const changes = configChanges(twice);
    expect(new Set(changes).size).toBe(changes.length);
  });
});
