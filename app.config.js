const baseConfig = require('./app.json').expo;

const isProduction = process.env.APP_VARIANT === 'production';

module.exports = {
  ...baseConfig,
  name: isProduction ? 'SongNook' : 'SongNook Dev',
  scheme: isProduction ? 'songnook' : 'songnook-dev',
  ios: {
    ...baseConfig.ios,
    bundleIdentifier: isProduction
      ? 'com.bmostudio.songnook'
      : 'com.bmostudio.songnook.dev',
  },
  android: {
    ...baseConfig.android,
    // Native generation always uses the stable Java namespace. The Android
    // variants plugin assigns distinct development and production app IDs.
    package: 'com.bmostudio.songnook',
  },
};
