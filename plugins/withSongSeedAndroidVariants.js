const { withAndroidManifest, withAppBuildGradle } = require("@expo/config-plugins");

const DEVELOPMENT_ID = "com.bmostudio.songseed.dev";
const PRODUCTION_ID = "com.bmostudio.songseed";

function configureBuildGradle(contents) {
  // Expo CLI also uses the first literal applicationId when launching Android.
  let next = contents.replace(
    /applicationId ['"][^'"]+['"]/,
    `applicationId '${DEVELOPMENT_ID}'`
  );

  if (!next.includes('debuggableVariants = ["developmentDebug"]')) {
    next = next.replace(
      /\s*\/\/ debuggableVariants = \[[^\n]+\]/,
      '\n    debuggableVariants = ["developmentDebug"]'
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
            manifestPlaceholders = [songSeedScheme: 'songstead']
        }
    }
`;
    next = next.replace(/\n    signingConfigs \{/, `${flavors}\n    signingConfigs {`);
  }

  if (!next.includes("SONGSEED_UPLOAD_STORE_FILE")) {
    const releaseSigning = `
        release {
            if (findProperty('SONGSEED_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('SONGSEED_UPLOAD_STORE_FILE'))
                storePassword findProperty('SONGSEED_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('SONGSEED_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('SONGSEED_UPLOAD_KEY_PASSWORD')
            }
        }
`;
    next = next.replace(
      /\n    \}\n    buildTypes \{/,
      `${releaseSigning}\n    }\n    buildTypes {`
    );
  }

  next = next.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    "$1signingConfig signingConfigs.release"
  );

  if (!next.includes("manifestPlaceholders = [songSeedScheme: 'songstead-dev']")) {
    next = next.replace(
      /(applicationId ['"]com\.bmostudio\.songseed\.dev['"])/,
      "$1\n        manifestPlaceholders = [songSeedScheme: 'songstead-dev']"
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
        scheme === "songstead" ||
        scheme === "songstead-dev" ||
        scheme === "songseed" ||
        scheme === "songseed-dev" ||
        scheme === "${songSeedScheme}"
      ) {
        data.$["android:scheme"] = "${songSeedScheme}";
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
      data: [{ $: { "android:scheme": "${songSeedScheme}" } }],
    });
    mainActivity["intent-filter"] = filters;
  }

  return manifest;
}

module.exports = function withSongSeedAndroidVariants(config) {
  config = withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("Song Seed Android variants require a Groovy app/build.gradle file.");
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
