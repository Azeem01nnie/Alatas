import Database from 'better-sqlite3'

const db = new Database(':memory:')
db.exec('SELECT 1')
db.close()
console.log('[verify] better-sqlite3 OK')
