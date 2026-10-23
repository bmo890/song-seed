const { withAndroidManifest, withAppBuildGradle } = require("@expo/config-plugins");

const DEVELOPMENT_ID = "com.bmostudio.songnook.dev";
const PRODUCTION_ID = "com.bmostudio.songnook";

/** Every injection below anchors on the SDK template's exact whitespace. A miss
 *  must throw, not no-op: a silent miss after an Expo bump would prebuild a
 *  release that is debug-signed or missing the production flavor. */
function replaceAnchored(contents, pattern, replacement, what) {
  if (!pattern.test(contents)) {
    throw new Error(
      `SongNook Android variants: could not find ${what} in app/build.gradle. ` +
        "The Expo template changed; update plugins/withSongNookAndroidVariants.js."
    );
  }
  return contents.replace(pattern, replacement);
}

function configureBuildGradle(contents) {
  // Expo CLI also uses the first literal applicationId when launching Android.
  let next = replaceAnchored(
    contents,
    /applicationId ['"][^'"]+['"]/,
    `applicationId '${DEVELOPMENT_ID}'`,
    "the applicationId line"
  );

  if (!next.includes('debuggableVariants = ["developmentDebug"]')) {
    next = replaceAnchored(
      next,
      /\s*\/\/ debuggableVariants = \[[^\n]+\]/,
      '\n    debuggableVariants = ["developmentDebug"]',
      "the commented debuggableVariants line"
    );
  }

  if (!next.includes("flavorDimensions 'environment'")) {
    const flavors = `
    flavorDimensions 'environment'
    productFlavors {
        development {
            dimension 'environment'
            versionNameSuffix '-dev'
        }
        production {
            dimension 'environment'
            applicationId '${PRODUCTION_ID}'
            manifestPlaceholders = [songNookScheme: 'songnook']
        }
    }
`;
    next = replaceAnchored(
      next,
      /\n    signingConfigs \{/,
      `${flavors}\n    signingConfigs {`,
      "the signingConfigs block"
    );
  }

  if (!next.includes("SONGNOOK_UPLOAD_STORE_FILE")) {
    const releaseSigning = `
        release {
            if (findProperty('SONGNOOK_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('SONGNOOK_UPLOAD_STORE_FILE'))
                storePassword findProperty('SONGNOOK_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('SONGNOOK_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('SONGNOOK_UPLOAD_KEY_PASSWORD')
            }
        }
`;
    next = replaceAnchored(
      next,
      /\n    \}\n    buildTypes \{/,
      `${releaseSigning}\n    }\n    buildTypes {`,
      "the end of signingConfigs before buildTypes"
    );
  }

  // Idempotent: a second pass finds the release block already on the release
  // signing config and leaves it; anything else is drift.
  const releaseSignedWithDebug =
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  const releaseSignedWithRelease =
    /buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/;
  if (releaseSignedWithDebug.test(next)) {
    next = next.replace(releaseSignedWithDebug, "$1signingConfig signingConfigs.release");
  } else if (!releaseSignedWithRelease.test(next)) {
    throw new Error(
      "SongNook Android variants: could not find the release buildType's signingConfig " +
        "in app/build.gradle. The Expo template changed; update plugins/withSongNookAndroidVariants.js."
    );
  }

  if (!next.includes("manifestPlaceholders = [songNookScheme: 'songnook-dev']")) {
    next = replaceAnchored(
      next,
      /(applicationId ['"]com\.bmostudio\.songnook\.dev['"])/,
      "$1\n        manifestPlaceholders = [songNookScheme: 'songnook-dev']",
      "the development applicationId line"
    );
  }

  return next;
}

function configureManifest(manifest) {
  const application = manifest.manifest.application?.[0];
  const mainActivity = application?.activity?.find(
    (activity) => activity.$?.["android:name"] === ".MainActivity"
  );
  if (!mainActivity) return manifest;

  const filters = mainActivity["intent-filter"] ?? [];
  let schemeConfigured = false;
  for (const filter of filters) {
    for (const data of filter.data ?? []) {
      const scheme = data.$?.["android:scheme"];
      if (
        scheme === "songnook" ||
        scheme === "songnook-dev" ||
        scheme === "${songNookScheme}"
      ) {
        data.$["android:scheme"] = "${songNookScheme}";
        schemeConfigured = true;
      }
    }
  }

  if (!schemeConfigured) {
    filters.push({
      action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
      category: [
        { $: { "android:name": "android.intent.category.DEFAULT" } },
        { $: { "android:name": "android.intent.category.BROWSABLE" } },
      ],
      data: [{ $: { "android:scheme": "${songNookScheme}" } }],
    });
    mainActivity["intent-filter"] = filters;
  }

  return manifest;
}

module.exports = function withSongNookAndroidVariants(config) {
  config = withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("SongNook Android variants require a Groovy app/build.gradle file.");
    }
    gradleConfig.modResults.contents = configureBuildGradle(
      gradleConfig.modResults.contents
    );
    return gradleConfig;
  });

  return withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = configureManifest(manifestConfig.modResults);
    return manifestConfig;
  });
};

module.exports.configureBuildGradle = configureBuildGradle;
module.exports.configureManifest = configureManifest;
