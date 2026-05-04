import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    // Read schema file
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    
    // Execute schema
    await pool.query(schema);
    
    console.log('✓ Database initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();

