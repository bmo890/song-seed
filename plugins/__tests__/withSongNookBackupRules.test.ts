/**
 * Audit 2026-11-02 G5: Android Auto Backup was on with no rules, so Google's cloud copy
 * silently stopped past 25 MB and kept a tiny stale library. The rules must be in the
 * Expo config (a prebuild regenerates android/) and keep audio out of the cloud.
 */
const appJson = require("../../app.json");
const plugin = require("../withSongNookBackupRules");

it("is registered in the Expo config so every prebuild applies it", () => {
    expect(appJson.expo.plugins).toContain("./plugins/withSongNookBackupRules");
});

it("points the manifest at both rule files, keeps device transfer, and offers to keep data on uninstall", () => {
    const manifest = plugin.applyBackupAttributes({
        manifest: { application: [{ $: { "android:name": ".MainApplication", "android:allowBackup": "true" } }] },
    });
    expect(manifest.manifest.application[0].$).toMatchObject({
        "android:name": ".MainApplication",
        "android:allowBackup": "true",
        "android:hasFragileUserData": "true",
        "android:fullBackupContent": "@xml/songnook_backup_rules",
        "android:dataExtractionRules": "@xml/songnook_data_extraction_rules",
    });
});

it("sends only the return note to the cloud and everything but temp files on a device transfer", () => {
    const rules: string = plugin.dataExtractionRulesXml();
    const cloud = rules.slice(rules.indexOf("<cloud-backup>"), rules.indexOf("</cloud-backup>"));
    const transfer = rules.slice(rules.indexOf("<device-transfer>"), rules.indexOf("</device-transfer>"));
    // An <include> list backs up nothing else: no database, no audio, no settings.
    expect(cloud.match(/<include /g)).toHaveLength(1);
    expect(cloud).toContain('<include domain="file" path="songnook-return.json" />');
    expect(transfer).toContain('path="songnook/backup-tmp/"');
    expect(transfer).toContain('path="songnook/trash/"');
    expect(transfer).not.toContain('path="songnook/audio');
    const legacy: string = plugin.fullBackupContentXml();
    expect(legacy.match(/<include /g)).toHaveLength(1);
    expect(legacy).toContain('<include domain="file" path="songnook-return.json" />');
});

it("names the same file the app writes", () => {
    const { RETURN_NOTE_FILE } = require("../../src/services/returnNote");
    expect(plugin.RETURN_NOTE_FILE).toBe(RETURN_NOTE_FILE);
});
