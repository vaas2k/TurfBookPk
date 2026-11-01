const app = require('./app.json');

module.exports = ({ config }) => {
  const base = { ...config, ...app.expo };
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const plugins = [...(base.plugins ?? [])];
  const windowsCmakePlugin = './scripts/with-windows-android-cmake-paths';

  if (!plugins.includes(windowsCmakePlugin)) {
    plugins.push(windowsCmakePlugin);
  }

  return {
    ...base,
    plugins,
    android: {
      ...base.android,
      config: googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : base.android.config,
    },
    ios: {
      ...base.ios,
      config: googleMapsApiKey ? { googleMapsApiKey } : base.ios.config,
    },
  };
};
