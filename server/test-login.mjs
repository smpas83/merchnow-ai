import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'merchnow.db');
const client = createClient({ url: `file:${dbPath}` });

// Simulate what auth.ts does
const email = 'customer@demo.com';
const result = await client.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
const user = result.rows?.[0];
console.log('User found:', !!user);
if (user) {
  console.log('User id:', user.id);
  console.log('User email:', user.email);
  console.log('User role:', user.role);
  console.log('Password hash:', user.password_hash);
  const valid = bcrypt.compareSync('orgpass', user.password_hash);
  console.log('Password valid:', valid);
}
