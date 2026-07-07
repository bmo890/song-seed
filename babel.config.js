module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    env: {
      // Release builds drop console.log/debug noise (the app logs heavily for on-device
      // timing diagnostics); errors and warnings stay.
      production: {
        plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]],
      },
    },
    plugins: ["react-native-reanimated/plugin"],
  };
};
