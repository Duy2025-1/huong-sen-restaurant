/**
 * Lớp tri thức (Knowledge Base) chính thức của Nhà Hàng Ẩm Thực Hương Sen
 * Dữ liệu được xác thực với quy trình vận hành thực tế.
 */

export interface RestaurantKnowledge {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  openingHours: string;
  lastOrderTime: string;
  parking: string;
  spaces: string[];
  paymentMethods: string[];
  reservationPolicy: string;
  allergyNotice: string;
}

export class RestaurantKnowledgeBase {
  static getKnowledge(): RestaurantKnowledge {
    return {
      name: 'Nhà Hàng Ẩm Thực Hương Sen',
      tagline: 'Món ngon từ căn bếp, vị quen từ quê nhà.',
      address: 'Số 18 Đường Hoa Sen, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      phone: '0901.234.567',
      email: 'lienhe@huongsen.vn',
      openingHours: '10:00 - 22:30 tất cả các ngày trong tuần (Thứ Hai - Chủ Nhật)',
      lastOrderTime: '21:45 mỗi ngày',
      parking: 'Có bãi đỗ ô tô và xe máy rộng rãi ngay trước khuôn viên nhà hàng, có nhân viên bảo vệ trông giữ an ninh.',
      spaces: ['Sảnh Mộc (tầng 1 - ấm cúng)', 'Hiên Sen (thoáng đãng ngoài trời)', 'Phòng VIP Hoàng Sen (dành cho tiệc gia đình, tiếp khách)'],
      paymentMethods: [
        'Tiền mặt tại bàn hoặc quầy thu ngân',
        'Quẹt thẻ ngân hàng POS (Visa, MasterCard, JCB, Napas)',
        'Chuyển khoản nhanh VietQR tự động',
        'Ví điện tử MoMo',
      ],
      reservationPolicy:
        'Nhà hàng nhận đặt bàn trước tối thiểu 1 tiếng. Bàn được giữ tối đa 15 phút so với giờ hẹn. Với đoàn từ 10 khách trở lên, quý khách được ưu tiên bố trí phòng tiệc VIP riêng và thực đơn set menu ưu đãi.',
      allergyNotice:
        'Hương Sen cam kết nguyên liệu tươi sạch, chế biến chuẩn quy chuẩn ATTP. Tuy nhiên với các khách hàng có tiền sử dị ứng nghiêm trọng (đậu phộng, hải sản vỏ cứng...), nhân viên luôn khuyến nghị báo trước cho phục vụ để bếp dùng bộ dụng cụ riêng biệt nhằm loại trừ nguy cơ nhiễm chéo.',
    };
  }

  /**
   * Lời khuyên món ăn theo thời tiết hoặc hoàn cảnh
   */
  static getContextualAdvice(contextKeyword: string): { title: string; advice: string; categorySlugs: string[] } | null {
    const k = contextKeyword.toLowerCase();

    if (k.includes('mua') || k.includes('lanh') || k.includes('se lanh')) {
      return {
        title: 'Món ngon ngày mưa se lạnh',
        advice: 'Những ngày trời mưa lành lạnh, một nồi lẩu bốc khói nghi ngút hoặc niêu cá kho tộ đậm vị ăn cùng cơm cháy nóng hổi là lựa chọn trọn vẹn nhất.',
        categorySlugs: ['canh-lau', 'com-nieu', 'mon-ca'],
      };
    }

    if (k.includes('nang') || k.includes('nong') || k.includes('oi buc')) {
      return {
        title: 'Món thanh mát ngày nắng nóng',
        advice: 'Ngày nắng oi ả, các món gỏi thanh mát chua ngọt, canh cua đồng mồng tơi cùng ly trà sen Tây Hồ ướp lạnh sẽ giúp thanh nhiệt tuyệt vời.',
        categorySlugs: ['salad-goi', 'do-uong', 'canh-lau'],
      };
    }

    if (k.includes('gia dinh') || k.includes('sum hop') || k.includes('ong ba')) {
      return {
        title: 'Mâm cơm gia đình ấm cúng',
        advice: 'Bữa cơm gia đình chuẩn vị quê nhà gồm một niêu cá kho tộ, đĩa rau luộc kho quẹt, bát canh chua thanh mát và niêu cơm trắng dẻo thơm gạo ST25.',
        categorySlugs: ['com-nieu', 'mon-ca', 'canh-lau', 'khai-vi'],
      };
    }

    if (k.includes('hen ho') || k.includes('cap doi') || k.includes('2 nguoi')) {
      return {
        title: 'Bữa ăn đôi ấm cúng',
        advice: 'Không gian ấm cúng với đĩa gỏi khai vị nhẹ nhàng, một món nướng thơm lừng và tráng miệng chè hạt sen long nhãn ngọt ngào.',
        categorySlugs: ['salad-goi', 'mon-ga', 'trang-mieng', 'do-uong'],
      };
    }

    return null;
  }
}
