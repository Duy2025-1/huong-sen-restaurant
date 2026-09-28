import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('================================================================');
  console.log('🌱 KHỞI TẠO TOÀN DIỆN HỆ THỐNG QUẢN LÝ NHÀ HÀNG HƯƠNG SEN');
  console.log('   - 100% Số liệu tính toán trực tiếp từ Database thật');
  console.log('   - Không hardcode, không sinh số liệu demo tùy tiện');
  console.log('================================================================\n');

  console.log('▶ BƯỚC 1: Khởi tạo hạ tầng, Chi nhánh, Nhân sự, Bàn ăn, Danh mục & Khuyến mãi...');
  execSync('npx tsx "' + path.join(__dirname, 'seed_base.ts') + '"', { stdio: 'inherit', shell: 'cmd.exe' });

  console.log('\n▶ BƯỚC 2: Khởi tạo 15 Danh mục & 118 Món ăn thuần Việt Hương Sen...');
  execSync('npx tsx "' + path.join(__dirname, 'seed_dishes.ts') + '"', { stdio: 'inherit', shell: 'cmd.exe' });

  console.log('\n▶ BƯỚC 3: Khởi tạo Kho 24 nguyên liệu, Nhập kho & Định lượng công thức món...');
  execSync('npx tsx "' + path.join(__dirname, 'seed_inventory.ts') + '"', { stdio: 'inherit', shell: 'cmd.exe' });

  console.log('\n▶ BƯỚC 4: Khởi tạo Lịch sử đơn hàng, Đơn hôm nay theo giờ thực, Phiên bàn, Đặt bàn...');
  execSync('npx tsx "' + path.join(__dirname, 'seed_orders.ts') + '"', { stdio: 'inherit', shell: 'cmd.exe' });

  console.log('\n✨✨✨ HOÀN TẤT KHỞI TẠO TOÀN BỘ CƠ SỞ DỮ LIỆU NHÀ HÀNG HƯƠNG SEN! ✨✨✨');
}

main().catch((err) => {
  console.error('❌ Lỗi khi khởi tạo database:', err);
  process.exit(1);
});
