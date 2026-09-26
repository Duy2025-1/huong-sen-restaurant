import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🌱 Khởi tạo dữ liệu Nhà Hàng Hương Sen (15 Danh mục, 118 Món Việt thuần túy)...');
  execSync('npx tsx "' + path.join(__dirname, 'seed_base.ts') + '"', { stdio: 'inherit', shell: 'cmd.exe' });
  execSync('npx tsx "' + path.join(__dirname, 'seed_dishes.ts') + '"', { stdio: 'inherit', shell: 'cmd.exe' });
  console.log('✨ Hoàn tất: 1 Chi nhánh Hương Sen, 5 Vai trò, 10 Bàn ăn, 15 Danh mục & 118 Món Việt!');
}

main().catch((err) => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
