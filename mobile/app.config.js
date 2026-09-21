export default ({ config }) => {
  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const useSupabase = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true'

  const cloudUrl = (
    process.env.EXPO_PUBLIC_API_URL || 'https://alatas-q5ks.onrender.com'
  ).replace(/\/$/, '')

  const apiUrl = useSupabase
    ? supabaseUrl || 'supabase'
    : process.env.EXPO_PUBLIC_USE_CLOUD === 'true'
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
      useSupabase,
      supabaseUrl,
      eas: {
        ...(config.extra?.eas || {}),
        projectId: config.extra?.eas?.projectId || process.env.EAS_PROJECT_ID || '',
      },
    },
  }
}
