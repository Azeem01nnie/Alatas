/**
 * Packaged Electron no longer bundles Express/SQLite.
 * UI loads from frontend-dist and talks to Supabase directly.
 */
exports.default = async function afterPack() {
  console.log('[afterPack] Supabase mode — skipped backend node_modules copy')
}
