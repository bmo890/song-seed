const baseConfig = require('./app.json').expo;

const isProduction = process.env.APP_VARIANT === 'production';

module.exports = {
  ...baseConfig,
  name: isProduction ? 'Song Seed' : 'Song Seed Dev',
  scheme: isProduction ? 'songseed' : 'songseed-dev',
  ios: {
    ...baseConfig.ios,
    bundleIdentifier: isProduction
      ? 'com.bmostudio.songseed'
      : 'com.bmostudio.songseed.dev',
  },
  android: {
    ...baseConfig.android,
    // Native generation always uses the stable Java namespace. The Android
    // variants plugin assigns distinct development and production app IDs.
    package: 'com.bmostudio.songseed',
  },
};
