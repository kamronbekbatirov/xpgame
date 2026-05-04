import pool from './database.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file>');
  process.exit(1);
}

const sql = fs.readFileSync(join(__dirname, 'migrations', migrationFile), 'utf8');

pool.query(sql)
  .then(() => {
    console.log('✓ Migration applied successfully');
    pool.end();
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    pool.end();
    process.exit(1);
  });


