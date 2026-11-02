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

it("points the manifest at both rule files and keeps device transfer allowed", () => {
    const manifest = plugin.applyBackupAttributes({
        manifest: { application: [{ $: { "android:name": ".MainApplication", "android:allowBackup": "true" } }] },
    });
    expect(manifest.manifest.application[0].$).toMatchObject({
        "android:name": ".MainApplication",
        "android:allowBackup": "true",
        "android:fullBackupContent": "@xml/songnook_backup_rules",
        "android:dataExtractionRules": "@xml/songnook_data_extraction_rules",
    });
});

it("sends nothing to the cloud and everything but temp files on a device transfer", () => {
    const rules: string = plugin.dataExtractionRulesXml();
    const cloud = rules.slice(rules.indexOf("<cloud-backup>"), rules.indexOf("</cloud-backup>"));
    const transfer = rules.slice(rules.indexOf("<device-transfer>"), rules.indexOf("</device-transfer>"));
    for (const domain of ["root", "file", "database", "sharedpref", "external"]) {
        expect(cloud).toContain(`<exclude domain="${domain}" path="." />`);
    }
    expect(cloud).not.toContain("<include");
    expect(transfer).toContain('path="songnook/backup-tmp/"');
    expect(transfer).toContain('path="songnook/trash/"');
    expect(transfer).not.toContain('path="songnook/audio');
    expect(plugin.fullBackupContentXml()).toContain('<exclude domain="file" path="." />');
});
