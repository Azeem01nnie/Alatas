export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiUrl: process.env.EXPO_PUBLIC_USE_CLOUD === 'true'
      ? (process.env.EXPO_PUBLIC_API_URL || 'https://alatas.onrender.com')
      : process.env.EXPO_PUBLIC_DEV_API_URL ||
        process.env.EXPO_PUBLIC_API_URL ||
        'https://alatas.onrender.com',
  },
});
