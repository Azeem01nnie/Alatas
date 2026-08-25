/**
 * Cloud connection defaults for Alatas Option C.
 * Desktop uses VITE_* vars; mobile talks directly to Render.
 */
export const CLOUD_CONNECTION = {
  /** Set after Render deploy, e.g. https://alatas-api.onrender.com */
  renderApiUrl: import.meta.env.VITE_RENDER_API_URL || '',
  /** Must be explicitly true to call Render from the UI */
  syncEnabled: import.meta.env.VITE_CLOUD_SYNC_ENABLED === 'true',
  /** Phone connects directly to Render API */
  mobileConnected: true,
}

export function describeCloudConnection() {
  if (!CLOUD_CONNECTION.renderApiUrl) {
    return 'Cloud URL not configured — local desk works offline.'
  }
  if (!CLOUD_CONNECTION.syncEnabled) {
    return 'Cloud URL set but sync disabled — enable VITE_CLOUD_SYNC_ENABLED after deploy verification.'
  }
  return 'Cloud sync enabled — desktop will push/pull when online.'
}
