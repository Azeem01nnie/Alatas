import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Shared credentials live in <repo>/env/.env; must load before modules that read process.env.
const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(here, '../../env/.env'), quiet: true })
