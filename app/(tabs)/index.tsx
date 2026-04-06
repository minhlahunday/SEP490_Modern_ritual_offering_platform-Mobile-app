import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Dimensions, 
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Star, ShieldCheck, HeartHandshake, Store, ChevronRight } from 'lucide-react-native';
import { packageService } from '../../services/packageService';
import { bannerService, BannerResponse } from '../../services/bannerService';
import { Link, useRouter } from 'expo-router';
import MOCK_DATA from '../../mockData';
import { Product } from '../../types';
import toast from '../../services/toast';

const { width } = Dimensions.get('window');

// Lấy mock data
const { services, trustStats } = MOCK_DATA;

export default function HomeTab() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<BannerResponse[]>([]);
  const [dynamicServices, setDynamicServices] = useState<{title: string, img: string}[]>([]);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingBanners, setLoadingBanners] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Mở rộng hiển thị tất cả dịch vụ
  const [showAllServices, setShowAllServices] = useState(false);

  const pickRandomProducts = <T,>(items: T[], count: number): T[] => {
    if (items.length <= count) return items;
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  const fetchData = async () => {
    // 1. Fetch Banners
    try {
      const bannerResponse = await bannerService.getActiveBanners();
      if (bannerResponse.isSuccess && bannerResponse.result?.length > 0) {
        setBanners(bannerResponse.result);
      } else {
        setBanners([
          { 
            bannerId: 1, 
            imageUrl: 'https://images.unsplash.com/photo-1528459801416-a7e992795770?auto=format&fit=crop&q=80&w=1600', 
            title: 'VietRitual',
            linkType: 'Ritual'
          } as BannerResponse
        ]);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setLoadingBanners(false);
    }

    // 2. Fetch Products
    try {
      setLoadingProducts(true);
      const apiPackages = await packageService.getAllPublicPackages(50);
      if (apiPackages && apiPackages.length > 0) {
        const mappedProducts = await packageService.mapToProductsWithVendors(apiPackages);
        setProducts(pickRandomProducts(mappedProducts, 3));
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setLoadingProducts(false);
    }

    // 3. Fetch Categories
    try {
      const categories = await packageService.getCeremonyCategories();
      const activeCategories = categories.filter(c => c.isActive);
      
      const ritualImages = [
        'https://docungcattuong.com/wp-content/uploads/2023/03/mam-cung-day-thang-be-gai-7.jpg',
        'https://docungcattuong.com/wp-content/uploads/2023/03/mam-cung-nha-moi.jpg',
        'https://docungcattuong.com/wp-content/uploads/2023/03/mam-cung-khai-truong-4-2.jpg',
        'https://store.longphuong.vn/wp-content/uploads/2023/01/mam-com-cung-gio-7.jpg',
        'https://images2.thanhnien.vn/528068263637045248/2025/1/10/42586013067177933649921942352479888060916544n-17364781178141635611315.jpg',
        'https://file.hstatic.net/200000862061/article/cungramthang7a-1358_4fd0c5cc580d490da057583a4d245db0_1024x1024.jpg',
        'https://cdn11.dienmaycholon.vn/filewebdmclnew/public/userupload/files/blog/van-hoa/cung-ruoc-ong-ba-ve-an-tet.jpg'
      ];

      const mapped = activeCategories.map((cat, idx) => {
        const match = services.find(s => 
          s.title.toLowerCase().includes(cat.name.toLowerCase()) || 
          cat.name.toLowerCase().includes(s.title.toLowerCase())
        );
        return {
          title: cat.name,
          img: match ? match.img : ritualImages[(cat.categoryId || idx) % ritualImages.length]
        };
      });
      
      setDynamicServices(mapped);
    } catch (error) {
      console.log('Error fetching categories:', error);
      setDynamicServices(services);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const displayServices = dynamicServices.length > 0 ? dynamicServices : services;

  const handlePressService = (serviceTitle: string) => {
    const normalizedTitle = String(serviceTitle || '').trim();
    router.push({
      pathname: '/explore',
      params: {
        category: normalizedTitle,
        keyword: normalizedTitle,
      },
    } as any);
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#000']} />
        }
      >
        
        {/* HERO CAROUSEL / BANNERS */}
        <View style={styles.heroSection}>
          {loadingBanners ? (
            <View style={[styles.heroImage, styles.centerChild]}>
              <ActivityIndicator size="large" color="#000" />
            </View>
          ) : (
            <ScrollView 
              horizontal 
              pagingEnabled 
              showsHorizontalScrollIndicator={false}
              style={{ width: width - 32, gap: 10 }}
            >
              {banners.map((banner, index) => (
                <View key={index} style={styles.bannerItem}>
                  <Image source={{ uri: banner.imageUrl }} style={styles.heroImage} />
                  <View style={styles.heroOverlay}>
                    <Text style={styles.heroTitle} numberOfLines={2}>
                      {banner.title || 'VietRitual\nTâm Linh Việt – Chuẩn Hiện Đại'}
                    </Text>
                    <Text style={styles.heroSubtitle}>
                      {banner.linkType === 'Ritual' ? 'Dịch vụ nổi bật' : 'Chương trình đặc biệt'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* SERVICES CATEGORIES */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dịch Vụ Cúng Lễ</Text>
          <TouchableOpacity onPress={() => setShowAllServices(!showAllServices)}>
            <Text style={styles.moreText}>{showAllServices ? 'Thu gọn' : `Xem thêm (${displayServices.length})`}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.servicesGrid}>
          {displayServices.slice(0, showAllServices ? undefined : 4).map((svc, idx) => (
            <TouchableOpacity key={idx} style={styles.serviceBox} onPress={() => handlePressService(svc.title)}>
              <Image source={{ uri: svc.img }} style={styles.serviceImage} />
              <View style={styles.serviceDimmer} />
              <Text style={styles.serviceText}>{svc.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* TRUST STATS (Banner) */}
        <View style={styles.trustBannerContainer}>
          <View style={styles.trustBannerOverlay}>
            <View style={styles.statBox}>
              <HeartHandshake color="#fff" size={28} />
              <Text style={styles.statCount}>5000+</Text>
              <Text style={styles.statLabel}>{trustStats?.[0]?.title || 'Khách Hàng'}</Text>
            </View>
            <View style={styles.statBox}>
              <Star color="#F59E0B" size={28} fill="#F59E0B" />
              <Text style={styles.statCount}>4.9/5</Text>
              <Text style={styles.statLabel}>{trustStats?.[1]?.title || 'Đánh Giá'}</Text>
            </View>
            <View style={styles.statBox}>
              <ShieldCheck color="#fff" size={28} />
              <Text style={styles.statCount}>100%</Text>
              <Text style={styles.statLabel}>{trustStats?.[2]?.title || 'An Toàn'}</Text>
            </View>
          </View>
        </View>

        {/* PREMIUM PACKAGES */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Mâm Cúng Cao Cấp</Text>
          <TouchableOpacity onPress={() => router.push('/explore')}>
            <Text style={[styles.moreText, { textTransform: 'uppercase', fontSize: 12 }]}>
              -- Tất cả --
            </Text>
          </TouchableOpacity>
        </View>

        {loadingProducts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={{ marginTop: 10, color: '#888' }}>Đang tải sản phẩm...</Text>
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {products.length > 0 ? products.map((product, idx) => (
              <TouchableOpacity key={product.id || idx} style={styles.productCard} onPress={() => router.push(`/product/${product.id}`)}>
                <Image source={{ uri: product.image }} style={styles.productImage} />
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  
                  {product.vendorName && (
                    <View style={styles.productVendorRow}>
                      <Text style={styles.productVendorName} numberOfLines={1}>bởi <Text style={{ color: '#1A1A1A', fontWeight: 'bold' }}>{product.vendorName}</Text></Text>
                    </View>
                  )}

                  <Text style={styles.productDescription} numberOfLines={2}>{product.description}</Text>

                  <View style={styles.productFooter}>
                    <View style={{flexDirection: 'column'}}>
                      <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
                      {product.totalSold !== undefined && product.totalSold > 0 && (
                        <Text style={styles.soldText}>ĐÃ BÁN {product.totalSold}</Text>
                      )}
                    </View>
                    <View style={styles.productRatingBadge}>
                      <Star size={12} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.productRatingText}>{product.rating > 0 ? product.rating.toFixed(1) : '5.0'}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyContainer}>
                <Text>Không có mâm cúng nào</Text>
              </View>
            )}
          </View>
        )}

        {/* BOTTOM SPACING */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  centerChild: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  bannerItem: {
    width: width - 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#e1e1e1',
    borderRadius: 16,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  heroSubtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    fontStyle: 'italic',
  },
  moreText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 28,
  },
  serviceBox: {
    width: (width - 32 - 16) / 2, // 2 columns
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 4,
    marginBottom: 8
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  serviceText: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center'
  },
  trustBannerContainer: {
    width: width - 32,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 28,
  },
  trustBannerOverlay: {
    backgroundColor: '#000',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  statBox: {
    alignItems: 'center',
  },
  statCount: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 8,
  },
  statLabel: {
    color: '#f8d9c2',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600'
  },
  productsGrid: {
    paddingHorizontal: 16,
    flexDirection: 'column',
    gap: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F0',
  },
  productInfo: {
    padding: 16,
  },
  productName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    lineHeight: 24,
    marginBottom: 4,
  },
  productVendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productVendorName: {
    fontSize: 12,
    color: '#666',
  },
  productDescription: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 18,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -0.5,
  },
  soldText: {
    fontSize: 10,
    color: '#A0A0A0',
    fontWeight: '700',
    marginTop: 4,
  },
  productRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  productRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    width: '100%'
  }
});
