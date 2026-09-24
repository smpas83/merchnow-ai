import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'merchnow.db');
const client = createClient({ url: `file:${dbPath}` });

async function main() {
  try {
    const r = await client.execute({ sql: 'SELECT 1 as test' });
    console.log('No-param OK:', JSON.stringify(r.rows));
  } catch(e) { console.log('No-param FAIL:', e.message); }

  try {
    const r = await client.execute({ sql: 'SELECT 1 as test', args: [] });
    console.log('Empty-args OK:', JSON.stringify(r.rows));
  } catch(e) { console.log('Empty-args FAIL:', e.message); }

  try {
    const r = await client.execute({ sql: 'SELECT ? as test', args: [42] });
    console.log('With-args OK:', JSON.stringify(r.rows));
  } catch(e) { console.log('With-args FAIL:', e.message); }
}

main();
