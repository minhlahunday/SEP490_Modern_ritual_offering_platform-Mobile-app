import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Image, ActivityIndicator, Dimensions, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search, Filter, Star, X, MapPin, Store, ChevronRight, ChevronLeft, SendToBack } from 'lucide-react-native';
import { packageService } from '../../services/packageService';
import { vendorService } from '../../services/vendorService';
import { addressService } from '../../services/addressService';
import { cartService } from '../../services/cartService';
import { getCurrentUser } from '../../services/auth';
import toast from '../../services/toast';
import { Product, CeremonyCategory, Occasion } from '../../types';

const { width } = Dimensions.get('window');
const SLIDER_WIDTH = width;
const ITEM_WIDTH = Math.round(SLIDER_WIDTH / 2) - 24; // 2 columns

export default function ExploreTab() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [activeFilter, setActiveFilter] = useState<Occasion | 'All'>('All');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CeremonyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Nút phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Trạng thái Modal & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('popular');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [priceRanges, setPriceRanges] = useState({
    p1: false, // Dưới 1 triệu
    p2: false, // 1-3 triệu
    p3: false, // 3-5 triệu
    p4: false, // Trên 5 triệu
  });
  const [ratingFilters, setRatingFilters] = useState({
    r5: false,
    r4: false,
    r3: false,
  });

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const apiCategories = await packageService.getCeremonyCategories();
        setCategories(apiCategories);

        let userLat: number | null = null;
        let userLng: number | null = null;
        if (getCurrentUser()) {
          try {
            const addresses = await addressService.getAddresses();
            const defaultAddr = addresses.find(a => a.isDefault);
            if (defaultAddr && defaultAddr.latitude && defaultAddr.longitude) {
              userLat = defaultAddr.latitude;
              userLng = defaultAddr.longitude;
            }
          } catch (e) {
            console.warn('Could not fetch user address', e);
          }
        }

        const apiPackages = await packageService.getAllPublicPackages(50);
        if (apiPackages.length > 0) {
          const mappedProducts = await packageService.mapToProductsWithVendors(apiPackages);

          const enhancedProducts = await Promise.all(mappedProducts.map(async p => {
            let distanceKm: number | undefined = undefined;
            if (userLat !== null && userLng !== null && p.vendorId) {
              try {
                const vendor = await vendorService.getVendorCached(p.vendorId);
                if (vendor && vendor.shopLatitude && vendor.shopLongitude) {
                  const R = 6371; 
                  const dLat = (vendor.shopLatitude - userLat) * (Math.PI / 180);
                  const dLon = (vendor.shopLongitude - userLng) * (Math.PI / 180);
                  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(userLat * (Math.PI / 180)) * Math.cos(vendor.shopLatitude * (Math.PI / 180)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                  distanceKm = Math.round(R * c * 10) / 10;
                }
              } catch (e) {}
            }

            let categoryName = p.category as string;
            const apiPkg = apiPackages.find(pkg => String(pkg.packageId) === String(p.id));
            if (apiPkg && apiPkg.categoryId) {
              const categoryObj = apiCategories.find(c => c.categoryId === apiPkg.categoryId);
              if (categoryObj) categoryName = categoryObj.name;
            }
            return { ...p, category: categoryName as Occasion, distanceKm };
          }));

          setProducts(enhancedProducts);
        } else {
          setProducts([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update effect từ router params
  useEffect(() => {
    const rawCategory = String(params.category || '').trim();
    const rawKeyword = String(params.keyword || '').trim();

    if (!rawCategory && !rawKeyword) return;

    const matchedCategory = categories
      .filter((c) => c.isActive)
      .find((c) => c.name.toLowerCase() === rawCategory.toLowerCase());

    if (matchedCategory) {
      setActiveFilter(matchedCategory.name as Occasion);
      setSearchQuery('');
      return;
    }

    setActiveFilter('All');
    if (rawKeyword) {
      setSearchQuery(rawKeyword);
    } else if (rawCategory) {
      setSearchQuery(rawCategory);
    }
  }, [params.category, params.keyword, categories]);

  // Handle Pagination reset
  useEffect(() => {
    setCurrentPage(1);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [activeFilter, searchQuery, priceRanges, ratingFilters, sortBy]);

  // Bộ lọc tay
  const filterByPrice = (price: number) => {
    if (!Object.values(priceRanges).some(v => v)) return true;
    if (priceRanges.p1 && price < 1000000) return true;
    if (priceRanges.p2 && price >= 1000000 && price < 3000000) return true;
    if (priceRanges.p3 && price >= 3000000 && price < 5000000) return true;
    if (priceRanges.p4 && price >= 5000000) return true;
    return false;
  };

  const filterByRating = (rating: number) => {
    if (!Object.values(ratingFilters).some(v => v)) return true;
    if (ratingFilters.r5 && rating >= 5) return true;
    if (ratingFilters.r4 && rating >= 4 && rating < 5) return true;
    if (ratingFilters.r3 && rating >= 3 && rating < 4) return true;
    return false;
  };

  const filterBySearch = (product: Product) => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return true;
    const searchable = [product.name, product.description, product.vendorName, product.category, product.tag]
      .filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(keyword);
  };

  const filteredProducts = products.filter(p => {
    const categoryMatch = activeFilter === 'All' || p.category === activeFilter;
    return categoryMatch && filterByPrice(p.price) && filterByRating(p.rating) && filterBySearch(p);
  }).sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;

    const distA = a.distanceKm ?? Infinity;
    const distB = b.distanceKm ?? Infinity;

    if (sortBy === 'popular') {
      if (distA !== Infinity || distB !== Infinity) {
        if (distA !== distB) return distA - distB;
      }
      if ((b.totalSold || 0) !== (a.totalSold || 0)) return (b.totalSold || 0) - (a.totalSold || 0);
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviews - a.reviews;
    }
    return 0;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const handleQuickAddToCart = async (product: Product) => {
    const user = getCurrentUser();
    if (!user) {
      toast.error('Vui lòng đăng nhập để mâm cúng');
      router.push('/login');
      return;
    }
    if (!product.variants || product.variants.length === 0) {
      toast.warning('Sản phẩm không có biến thể!');
      return;
    }
    try {
      const success = await cartService.addToCart({
        variantId: product.variants[0].variantId,
        quantity: 1
      });
      if (success) toast.success('Đã thêm vào giỏ hàng!');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi thêm giỏ hàng');
    }
  };

  const handleResetFilters = () => {
    setActiveFilter('All');
    setPriceRanges({ p1: false, p2: false, p3: false, p4: false });
    setRatingFilters({ r5: false, r4: false, r3: false });
    setSearchQuery('');
    setSortBy('popular');
    setIsFilterOpen(false);
  };

  /**
   * Component Product Card
   */
  const ProductCard = ({ p }: { p: Product }) => (
    <TouchableOpacity style={styles.productCard} onPress={() => router.push(`/product/${p.id}`)}>
      {p.distanceKm !== undefined && p.distanceKm <= 60 && (
        <View style={styles.badgeNear}>
          <Text style={styles.badgeNearText}>Gần bạn</Text>
        </View>
      )}
      <Image source={{ uri: p.image }} style={styles.productImage} />
      
      <View style={styles.productInfo}>
        <View style={styles.ratingRow}>
          <View style={styles.stars}>
            <Star color="#F59E0B" fill="#F59E0B" size={12} />
            <Text style={styles.ratingText}>{p.rating > 0 ? p.rating.toFixed(1) : '5.0'}</Text>
          </View>
          {p.totalSold !== undefined && p.totalSold > 0 && (
            <Text style={styles.soldText}>Đã bán {p.totalSold}</Text>
          )}
        </View>
        
        <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
        
        <View style={styles.vendorRow}>
          <Store color="#666" size={14} />
          <Text style={styles.vendorText} numberOfLines={1}>{p.vendorName}</Text>
          {p.distanceKm !== undefined && (
            <View style={styles.distanceBadge}>
              <MapPin size={10} color="#888" />
              <Text style={styles.distanceText}>{p.distanceKm}km</Text>
            </View>
          )}
        </View>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Giá từ</Text>
            <Text style={styles.priceValue}>{formatPrice(p.price)}</Text>
          </View>
          <TouchableOpacity style={styles.addToCartBtn} onPress={() => handleQuickAddToCart(p)}>
            <Text style={styles.addToCartPlus}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search color="#8E8E93" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm mâm cúng, sự kiện..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8E8E93"
          />
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={() => setIsFilterOpen(true)}>
          <Filter color="#FFF" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.categoriesWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
          <TouchableOpacity 
            style={[styles.categoryChip, activeFilter === 'All' && styles.categoryChipActive]}
            onPress={() => setActiveFilter('All')}
          >
            <Text style={[styles.categoryText, activeFilter === 'All' && styles.categoryTextActive]}>Tất cả</Text>
          </TouchableOpacity>
          {categories.filter(c => c.isActive).map(cat => (
            <TouchableOpacity 
              key={cat.categoryId} 
              style={[styles.categoryChip, activeFilter === cat.name && styles.categoryChipActive]}
              onPress={() => setActiveFilter(cat.name as Occasion)}
            >
              <Text style={[styles.categoryText, activeFilter === cat.name && styles.categoryTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            <Text style={{ fontStyle: 'italic', fontWeight: '900', color: '#000' }}>{filteredProducts.length}</Text> Sản phẩm
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>😞</Text>
            <Text style={styles.emptyTitle}>Không tìm thấy mâm cúng</Text>
            <Text style={styles.emptyDesc}>Hãy thử đổi bộ lọc khác nhé.</Text>
          </View>
        ) : (
          <>
            <View style={styles.productGrid}>
              {paginatedProducts.map(p => <ProductCard p={p} key={p.id} />)}
            </View>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity 
                  style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]} 
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  <ChevronLeft color="#000" size={20} />
                </TouchableOpacity>
                <Text style={styles.pageText}>{currentPage} / {totalPages}</Text>
                <TouchableOpacity 
                  style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]} 
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  <ChevronRight color="#000" size={20} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* FILTER MODAL */}
      <Modal visible={isFilterOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bộ lọc & Sắp xếp</Text>
              <TouchableOpacity onPress={() => setIsFilterOpen(false)} style={styles.closeBtn}>
                <X color="#333" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.filterSectionTitle}>Sắp xếp theo</Text>
              <View style={styles.filterOptionsGrid}>
                <TouchableOpacity style={[styles.filterOptBtn, sortBy === 'popular' && styles.filterOptBtnActive]} onPress={() => setSortBy('popular')}>
                  <Text style={[styles.filterOptText, sortBy === 'popular' && styles.filterOptTextActive]}>Mặc định (Gợi ý)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterOptBtn, sortBy === 'price-asc' && styles.filterOptBtnActive]} onPress={() => setSortBy('price-asc')}>
                  <Text style={[styles.filterOptText, sortBy === 'price-asc' && styles.filterOptTextActive]}>Giá: Thấp → Cao</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterOptBtn, sortBy === 'price-desc' && styles.filterOptBtnActive]} onPress={() => setSortBy('price-desc')}>
                  <Text style={[styles.filterOptText, sortBy === 'price-desc' && styles.filterOptTextActive]}>Giá: Cao → Thấp</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>Khoảng chí phí</Text>
              <View style={styles.filterOptionsGrid}>
                {[
                  { id: 'p1', label: 'Dưới 1 triệu', checked: priceRanges.p1 },
                  { id: 'p2', label: '1tr - 3 triệu', checked: priceRanges.p2 },
                  { id: 'p3', label: '3tr - 5 triệu', checked: priceRanges.p3 },
                  { id: 'p4', label: 'Trên 5 triệu', checked: priceRanges.p4 }
                ].map(opt => (
                  <TouchableOpacity 
                    key={opt.id}
                    style={[styles.filterOptBtn, opt.checked && styles.filterOptBtnActive]} 
                    onPress={() => setPriceRanges(prev => ({ ...prev, [opt.id]: !opt.checked }))}
                  >
                    <Text style={[styles.filterOptText, opt.checked && styles.filterOptTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>Đánh giá chuyên gia</Text>
              <View style={styles.filterOptionsGrid}>
                {[
                  { id: 'r5', label: '5 Sao (Tuyệt hảo)', checked: ratingFilters.r5 },
                  { id: 'r4', label: 'Từ 4 Sao', checked: ratingFilters.r4 },
                  { id: 'r3', label: 'Từ 3 Sao', checked: ratingFilters.r3 }
                ].map(opt => (
                  <TouchableOpacity 
                    key={opt.id}
                    style={[styles.filterOptBtn, opt.checked && styles.filterOptBtnActive]} 
                    onPress={() => setRatingFilters(prev => ({ ...prev, [opt.id]: !opt.checked }))}
                  >
                    <Text style={[styles.filterOptText, opt.checked && styles.filterOptTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ height: 60 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.resetBtn} onPress={handleResetFilters}>
                <Text style={styles.resetBtnText}>Mặc định</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => setIsFilterOpen(false)}>
                <Text style={styles.applyBtnText}>Áp dụng ({filteredProducts.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 12,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  categoryChipActive: {
    backgroundColor: '#000',
    borderColor: '#000'
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryTextActive: {
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  listHeader: {
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600'
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: ITEM_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  badgeNear: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeNearText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  productImage: {
    width: '100%',
    height: ITEM_WIDTH,
    backgroundColor: '#F0F0F0',
  },
  productInfo: {
    padding: 12,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  soldText: {
    fontSize: 10,
    color: '#888',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4
  },
  productName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    lineHeight: 20,
    height: 40,
    marginBottom: 8,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  vendorText: {
    flex: 1,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2
  },
  distanceText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666'
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 8
  },
  priceLabel: {
    fontSize: 9,
    color: '#888',
    textTransform: 'uppercase',
    fontWeight: 'bold'
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -0.5,
  },
  addToCartBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartPlus: {
    color: '#FFF',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '300'
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
  },
  pageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.5
  },
  pageText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 50,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#888',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  closeBtn: {
    padding: 4,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  filterOptBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFF',
  },
  filterOptBtnActive: {
    borderColor: '#000',
    backgroundColor: '#000',
  },
  filterOptText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterOptTextActive: {
    color: '#FFF',
    fontWeight: '900'
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFF',
    gap: 12,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  }
});
