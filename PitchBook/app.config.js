const app = require('./app.json');

module.exports = () => {
  const config = app.expo;
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  return {
    ...config,
    android: {
      ...config.android,
      config: googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : config.android.config,
    },
    ios: {
      ...config.ios,
      config: googleMapsApiKey ? { googleMapsApiKey } : config.ios.config,
    },
  };
};
