import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'merchnow.db');
const client = createClient({ url: `file:${dbPath}` });

// Test 1: execute with variadic single param (what auth.ts does)
const r1 = await client.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: ['customer@demo.com'] });
console.log('Test 1 (array arg):', r1.rows?.length, 'rows');

// Test 2: execute without args (what happens if params is undefined)
try {
  const r2 = await client.execute({ sql: 'SELECT * FROM users WHERE email = ?' });
  console.log('Test 2 (no args):', r2.rows?.length, 'rows');
} catch(e) {
  console.log('Test 2 error:', e.message);
}

// Test 3: execute with empty args
const r3 = await client.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [] });
console.log('Test 3 (empty args):', r3.rows?.length, 'rows');
