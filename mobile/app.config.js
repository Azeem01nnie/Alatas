export default ({ config }) => {
  const cloudUrl = (
    process.env.EXPO_PUBLIC_API_URL || 'https://alatas-q5ks.onrender.com'
  ).replace(/\/$/, '')

  const apiUrl =
    process.env.EXPO_PUBLIC_USE_CLOUD === 'true'
      ? cloudUrl
      : (
          process.env.EXPO_PUBLIC_DEV_API_URL ||
          process.env.EXPO_PUBLIC_API_URL ||
          cloudUrl
        ).replace(/\/$/, '')

  return {
    ...config,
    name: config.name || 'Alatas',
    slug: config.slug || 'alatas',
    extra: {
      ...config.extra,
      apiUrl,
      eas: {
        ...(config.extra?.eas || {}),
        // Filled by `eas init` / `eas build` when linked to an Expo project
        projectId: config.extra?.eas?.projectId || process.env.EAS_PROJECT_ID || '',
      },
    },
  }
}
