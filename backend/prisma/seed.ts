import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🌱 Starting comprehensive database seeding (15 Categories, 158 Dishes)...');
  execSync('npx tsx ' + path.join(__dirname, 'seed_base.ts'), { stdio: 'inherit' });
  execSync('npx tsx ' + path.join(__dirname, 'seed_dishes.ts'), { stdio: 'inherit' });
  console.log('✨ Seeding complete: 1 Branch, 5 Roles, Staff accounts, 10 Tables, 15 Categories & 158 Dishes!');
}

main().catch((err) => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
