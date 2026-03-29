// Mock Data for All Pages and Components
// This file centralizes all mock data for easier API integration later

// removed local image import

export const MOCK_DATA = {
  // // Product Data
  // products: [
  //   {
  //     id: '1',
  //     name: 'Gói Sung Túc - Cúng Đầy Tháng',
  //     category: 'Full Moon',
  //     price: 2500000,
  //     originalPrice: 2850000,
  //     image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA5pk34TFNITiBoTfzzR6j2tM4Cp8eWCMDiRH4qZuljZQIJYbiLfYZQFVoLe5hUiUvaOzM6OKfUam0dV6TZqLoJ_cCNShqoMxqWn1u3vnX3fsV9_iK1yUSDx-iHmIGcyQCJxm6i8T8dWweYKX7T1fdoMr5nn5ZQZD4AoZJXr363gXZ5rIJmm_HYeGK_pRGMq-RLSby_5xXlYxCkZZGl3f2wbZSbkq6qVJrHt140BQ3tJijWeo_NgY8Bmj3sH-anRE-toAvYScWM41CW',
  //     description: 'Bao gồm 13 bộ xôi chè, gà luộc cánh tiên, mâm quả ngũ sắc và bộ văn khấn đầy đủ.',
  //     rating: 4.9,
  //     reviews: 128,
  //     tag: 'Phổ biến',
  //     images: [
  //       // Thêm ảnh phụ tại đây (link 1)
  //       // Thêm ảnh phụ tại đây (link 2)
  //       // Thêm ảnh phụ tại đây (link 3)
  //     ]
  //   },
  //   {
  //     id: '2',
  //     name: 'Gói Đại Phát - Khai Trương',
  //     category: 'Grand Opening',
  //     price: 4950000,
  //     image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9ed9G_29HoTI9Y-GeI-hyIG5LL1M9XkEo2Xc-bPI5RRAnelI6nV1mRn4wJL0nNSuT6xfea8WWncno6jImIRDVybLBRLufAzeD0vm7ylvwopHIvoaaKjIKt9nshsIVbTKS-PT8ph2OvMm6Bf2APW0w1Gx0JCEdbokhjkewJuanhqwvPHi3Z0cEn7-cgpc9dZnmcw0eS7SjLgc8NcZmZQwIwnFOvXj-3aZl_oUKRFccMpRuHiStBSbSMsqJw6IqVB-tavHn1nhzgI__',
  //     description: 'Heo quay nguyên con, tháp bia, mâm ngũ quả lớn và bộ nhang đèn cao cấp.',
  //     rating: 5.0,
  //     reviews: 86,
  //     tag: 'VIP',
  //     images: [
  //       // Thêm ảnh phụ tại đây (link 1)
  //       // Thêm ảnh phụ tại đây (link 2)
  //       // Thêm ảnh phụ tại đây (link 3)
  //     ]
  //   },
  //   {
  //     id: '3',
  //     name: 'Gói Bình An - Tân Gia',
  //     category: 'House Warming',
  //     price: 1850000,
  //     image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSUAMlLxitdwU9p95wOsvj9lxzje0Ua1vrVIxZUY2DGYGYRJUrqBOSD8wWqMBWdr5EDilegTWoP_6KZVdqaGf53JtNzaNWnOGpdKV5EjAT73XXLPH49xUe42hswBZljYaWjjfp0h-T9ufWuFuO7o-0hAjDICimlfOkNmLO6kz9PPzAU-x69KY0gj4awRKdoYRpEqX_KcCxHtzLZhJWB05-YLN1VP0alzZ0LvP1B1CRANc7H50UIvfpUIajBygXEET0CF2DSpYKSTVz',
  //     description: 'Trầu cau têm cánh phượng, chè trôi nước màu sắc, xôi gấc in chữ Phúc Lộc Thọ.',
  //     rating: 4.8,
  //     reviews: 92,
  //     images: [
  //       // Thêm ảnh phụ tại đây (link 1)
  //       // Thêm ảnh phụ tại đây (link 2)
  //       // Thêm ảnh phụ tại đây (link 3)
  //     ]
  //   }
  // ],

  // Hero Carousel Slides
  heroSlides: [
    {
      image: 'https://images.unsplash.com/photo-1528459801416-a7e992795770?auto=format&fit=crop&q=80&w=2000',
      title: 'Đặt mâm cúng\nđúng lễ – đúng giờ\ntrọn ý nghĩa',
      subtitle: 'Tâm Linh Việt - Chuẩn Hiện Đại',
      description: 'Giải pháp mâm cúng trọn gói tiện lợi, cam kết chính xác theo nghi lễ truyền thống. Chúng tôi chuẩn bị tâm huyết để bạn dành trọn thời gian quý báu.'
    },
    {
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAixarTzodAVLGAijGEBPp1ktIFZMTvnhJxfBIVpJvv5uHqHxWq9cjxUi5KYhbrLItyAlBgXcwDpaNcJb-YnDRxqJ7H4bULWAwhk5s1ku-2aa6SoJcFKdBJtmpos6RxAGtvXsZK4-ter_VHOPPmA4Irrkzuav41rsE2RHPmCDRq9GbPWs85cx1p0oe_Am82OrBPifwM7YTU29mOBRBN2pJlM8-xic4Vx5p01qCJPTjwjcfgaJdDjQodWohHBHzTJ7IbhObduH2g-ORB',
      title: 'Mâm Cúng Đầy Tháng\ncho bé yêu',
      subtitle: 'Truyền Thống - An Toàn - Ý Nghĩa',
      description: 'Lễ thôi nôi đầy tháng là mốc quan trọng. Chúng tôi chuẩn bị tất cả mâm cúng theo đúng nghi lễ, đảm bảo an toàn cho em bé và phúc lành cho gia đình.'
    },
    {
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0tPQinM1Cu5XTwhO9KWJQF2uTv6glXWVkwBTH37XYOBS_6bfPGZGFmQnMk1FNxI2Rqqy7cj4EFRkfiZ0vEq3t9MbPKrLcokmmDqmP9IE74Th7adBm6mVoi7FK_JGF9vCbSEtDWjlzBxjJAjvRHCEXF7lO3YnjhSn98o-JGkRMPCIvc2w8RBDMmuAYY6dYrY8WRD7CvkBKzWG75f6JcohBD6ejH4ybjK9Z9Q0HOkjkyRkCKkefQRavdU8HYdjzs1Epm2mzuoLmefRP',
      title: 'Cúng Tân Gia\nNhập Trạch May Mắn',
      subtitle: 'Lễ Khai Trương - Cầu Mong - Tâm Linh',
      description: 'Nhập trạch là bước quan trọng trong dân gian Việt Nam. Hãy để chúng tôi chuẩn bị mâm cúng tâm linh, cầu mong phúc lành cho gia đình bạn.'
    },
    {
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAMQqFkX5J1O1KdZAopDApQdHo4CpGcdHE0-smAfAvMPCKotVfEr6WkKODZc-2smmeP7hbE0tb0Ma46E2aIo8UttqgNM3jta08srfgIs3HIGdEbzh9G1THuCafV3UXmZG1krFaD1wEkKnD4hsDieM4wbCKLRaNuyX8btHEv8p39f3oZLJCmA8FX04xA3FXJWDMx_WZeiwe46kg-zyxct4-8Ik_AhK8jx_86si9BaBKEJdtLgK9xdKUH4QawvQVMFB5BwWopyAhw85mi',
      title: 'Khai Trương\nTiến Đến Thành Công',
      subtitle: 'Khai Trương - May Mắn - Thịnh Vượng',
      description: 'Khai trương cơ sở kinh doanh là khởi đầu của con đường thành công. Chúng tôi chuẩn bị đầy đủ lễ nghi để cầu mong sự thịnh vượng.'
    }
  ],

  // Services Showcase
  services: [
    {
      title: 'Cúng đầy tháng / Thôi nôi',
      img: 'https://docungcattuong.com/wp-content/uploads/2023/03/mam-cung-day-thang-be-gai-7.jpg'
    },
    {
      title: 'Cúng Tân Gia',
      img: 'https://docungcattuong.com/wp-content/uploads/2023/03/mam-cung-nha-moi.jpg'
    },
    {
      title: 'Khai Trương',
      img: 'https://docungcattuong.com/wp-content/uploads/2023/03/mam-cung-khai-truong-4-2.jpg'
    },
    {
      title: 'Cúng Giỗ',
      img: 'https://store.longphuong.vn/wp-content/uploads/2023/01/mam-com-cung-gio-7.jpg'
    },
    {
      title: 'Cúng Tết',
      img: 'https://images2.thanhnien.vn/528068263637045248/2025/1/10/42586013067177933649921942352479888060916544n-17364781178141635611315.jpg'
    },
    {
      title: 'Cúng Tháng Bảy',
      img: 'https://file.hstatic.net/200000862061/article/cungramthang7a-1358_4fd0c5cc580d490da057583a4d245db0_1024x1024.jpg'
    },
    {
      title: 'Cúng Tết Nguyên Đán',
      img: 'https://cdn11.dienmaycholon.vn/filewebdmclnew/public/userupload/files/blog/van-hoa/cung-ruoc-ong-ba-ve-an-tet.jpg'
    },
    {
      title: 'Cúng Rằm Tháng Giêng',
      img: 'https://hnm.1cdn.vn/2024/02/20/image.bnews.vn-mediaupload-org-2022-02-14-_co-5-20220214102512.jpg'
    }
  ],

  // Trust/Features Stats
  trustStats: [
    {
      icon: 'shopping_cart_checkout',
      title: 'Tiện lợi',
      desc: 'Chỉ với vài thao tác, chúng tôi chuẩn bị trọn gói mọi thứ từ lễ vật đến văn khấn.'
    },
    {
      icon: 'verified_user',
      title: 'Chuẩn nghi lễ',
      desc: 'Mọi mâm cúng đều được tư vấn chuyên sâu, đảm bảo đúng phong tục Việt Nam.'
    },
    {
      icon: 'schedule',
      title: 'Giao đúng giờ',
      desc: 'Cam kết giao hàng tận nơi chính xác giờ hoàng đạo. Hỗ trợ bày biện tận tâm.'
    }
  ],

  // Vendor Shop Sample Data
  vendorShop: {
    name: 'Cúng Lễ Truyền Thống',
    owner: 'Nguyễn Thị Hoa',
    address: '123 Phố Cổ, Hà Nội, Việt Nam',
    phone: '0912 345 678',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA5pk34TFNITiBoTfzzR6j2tM4Cp8eWCMDiRH4qZuljZQIJYbiLfYZQFVoLe5hUiUvaOzM6OKfUam0dV6TZqLoJ_cCNShqoMxqWn1u3vnX3fsV9_iK1yUSDx-iHmIGcyQCJxm6i8T8dWweYKX7T1fdoMr5nn5ZQZD4AoZJXr363gXZ5rIJmm_HYeGK_pRGMq-RLSby_5xXlYxCkZZGl3f2wbZSbkq6qVJrHt140BQ3tJijWeo_NgY8Bmj3sH-anRE-toAvYScWM41CW',
    rating: 4.9,
    verified: true,
    followers: 2543
  },

  // Cart Sample Data
  cartItems: [
    {
      id: '1',
      name: 'Mâm Cúng Đầy Tháng - Gói Đặc Biệt',
      price: 2500000,
      quantity: 1,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmfCyEl04cwWpaZXOkMs7fYlLyWDwtMEnf5G_uRg4n59rYYy-eS9wUnZrHYzLXvLd-zB7Wywvxnqfs7atQBNPcPb0CX9zsIAFph9WRg5ftfGisqH7gXz-D7-nF4BPCRBH9xzV-AjamO-K9f2QSm6s-jXhCCf65fhW-ipfEanWxgipMRJdKxG-PPAOHocXYLGgXgSHkeNWg6ShHNmsrKGd0Y45BFWq9pVGAw52130misHEtU4NlZStzWGrrnAP4yAQCc31mez3LQfUs'
    },
    {
      id: '2',
      name: 'Mâm Cúng Tết Nguyên Đán',
      price: 1800000,
      quantity: 2,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmfCyEl04cwWpaZXOkMs7fYlLyWDwtMEnf5G_uRg4n59rYYy-eS9wUnZrHYzLXvLd-zB7Wywvxnqfs7atQBNPcPb0CX9zsIAFph9WRg5ftfGisqH7gXz-D7-nF4BPCRBH9xzV-AjamO-K9f2QSm6s-jXhCCf65fhW-ipfEanWxgipMRJdKxG-PPAOHocXYLGgXgSHkeNWg6ShHNmsrKGd0Y45BFWq9pVGAw52130misHEtU4NlZStzWGrrnAP4yAQCc31mez3LQfUs'
    }
  ]
};

export default MOCK_DATA;
