import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import { schema } from './schema'
import User from './User'

// First, create the adapter to the underlying database:
const adapter = new SQLiteAdapter({
  schema,
  // (You might want to configure migrations here later)
  // migrations,
  // (optional database name or file system path)
  dbName: 'alatasdb',
  // (recommended option, should work flawlessly out of the box on iOS. On Android,
  // additional installation steps have to be taken - disable if you run into issues...)
  jsi: false, /* Set to false since Expo managed workflow without custom dev client doesn't support Watermelon JSI fully without extra setup */
  // (optional, but you should implement this method)
  onSetUpError: error => {
    // Database failed to load -- offer the user to reload the app or log out
  }
})

// Then, make a Watermelon database from it!
export const database = new Database({
  adapter,
  modelClasses: [
    User,
  ],
})
