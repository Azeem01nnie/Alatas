export default ({ config }) => {
  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const useSupabase = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true'

  return {
    ...config,
    name: config.name || 'Alatas',
    slug: config.slug || 'alatas',
    extra: {
      ...(config.extra || {}),
      useSupabase,
      supabaseUrl,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    },
  }
}
