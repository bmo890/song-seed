const { withAndroidManifest, withAppBuildGradle } = require("@expo/config-plugins");

const DEVELOPMENT_ID = "com.bmostudio.songnook.dev";
const PRODUCTION_ID = "com.bmostudio.songnook";

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
            manifestPlaceholders = [songNookScheme: 'songnook']
        }
    }
`;
    next = next.replace(/\n    signingConfigs \{/, `${flavors}\n    signingConfigs {`);
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
    next = next.replace(
      /\n    \}\n    buildTypes \{/,
      `${releaseSigning}\n    }\n    buildTypes {`
    );
  }

  next = next.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    "$1signingConfig signingConfigs.release"
  );

  if (!next.includes("manifestPlaceholders = [songNookScheme: 'songnook-dev']")) {
    next = next.replace(
      /(applicationId ['"]com\.bmostudio\.songnook\.dev['"])/,
      "$1\n        manifestPlaceholders = [songNookScheme: 'songnook-dev']"
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
