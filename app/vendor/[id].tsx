import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, MapPin, Star } from 'lucide-react-native';

import { Product } from '../../types';
import { bannerService, BannerResponse } from '../../services/bannerService';
import { packageService } from '../../services/packageService';
import { reviewService, Review } from '../../services/reviewService';
import { vendorService, VendorProfile } from '../../services/vendorService';
import toast from '../../services/toast';

const { width } = Dimensions.get('window');

const BUSINESS_TYPE_MAP: Record<string, string> = {
  Individual: 'Ca nhan',
  HouseholdBusiness: 'Ho gia dinh kinh doanh',
  HouseholdBussiness: 'Ho gia dinh kinh doanh',
  Enterprise: 'Doanh nghiep',
};

type VendorTab = 'home' | 'products' | 'about';

const ProductTile: React.FC<{ product: Product; onPress: () => void }> = ({ product, onPress }) => {
  return (
    <TouchableOpacity style={styles.tileCard} activeOpacity={0.9} onPress={onPress}>
      <Image source={{ uri: product.image }} style={styles.tileImage} resizeMode="cover" />
      <View style={styles.tileBody}>
        <Text style={styles.tileName} numberOfLines={2}>{product.name}</Text>
        <View style={styles.tileMetaRow}>
          <View style={styles.tileRatingWrap}>
            <Star size={12} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.tileRatingText}>{Number(product.rating || 0).toFixed(1)}</Text>
          </View>
          {!!product.totalSold && <Text style={styles.tileSold}>Da ban {product.totalSold}</Text>}
        </View>
        <Text style={styles.tilePrice}>{Number(product.price || 0).toLocaleString('vi-VN')}d</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function VendorProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<VendorTab>('home');
  const [categories, setCategories] = useState<{ categoryId: number; name: string }[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [banners, setBanners] = useState<BannerResponse[]>([]);

  useEffect(() => {
    let mounted = true;
    const vendorId = String(id || '').trim();
    if (!vendorId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        const [profile, pkgs, vendorReviews, cats, bannerResponse] = await Promise.all([
          vendorService.getVendorCached(vendorId),
          packageService.getPackagesByVendor(vendorId),
          reviewService.getReviewsByVendorId(vendorId).catch(() => [] as Review[]),
          packageService.getCeremonyCategories().catch(() => [] as any[]),
          bannerService.getActiveBanners(vendorId).catch(() => ({ isSuccess: false, result: [] as BannerResponse[] } as any)),
        ]);

        if (!mounted) return;

        if (!profile) {
          setVendor(null);
          return;
        }

        setVendor(profile);
        setReviews(Array.isArray(vendorReviews) ? vendorReviews : []);

        const activeCats = (Array.isArray(cats) ? cats : []).filter((c: any) => c?.isActive);
        setCategories(activeCats);

        const mapped = await packageService.mapToProductsWithVendors(pkgs);
        if (!mounted) return;

        const catMap = new Map<number, string>();
        activeCats.forEach((c: any) => catMap.set(Number(c.categoryId), String(c.name || '')));

        const normalized = mapped.map((p, idx) => {
          const catName = catMap.get(Number((pkgs[idx] as any)?.categoryId || 0));
          return catName ? { ...p, category: catName } : p;
        });

        setProducts(normalized);

        if (bannerResponse?.isSuccess && Array.isArray(bannerResponse.result)) {
          setBanners(bannerResponse.result);
        } else {
          setBanners([]);
        }
      } catch (error) {
        toast.error('Khong the tai trang cua hang');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchData();
    return () => {
      mounted = false;
    };
  }, [id]);

  const vendorRatingCount = reviews.length;
  const vendorAvgRating = vendorRatingCount > 0
    ? (reviews.reduce((acc, item) => acc + Number(item.rating || 0), 0) / vendorRatingCount).toFixed(1)
    : Number(vendor?.ratingAvg || 0).toFixed(1);

  const joinTimeMonths = vendor?.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(vendor.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 0;

  const shownProducts = useMemo(() => {
    if (activeFilter === 'All') return products;
    return products.filter((p) => p.category === activeFilter);
  }, [activeFilter, products]);

  const handleBannerPress = (banner: BannerResponse) => {
    if (banner.linkType === 'Package' && banner.linkTargetId) {
      router.push(`/product/${banner.linkTargetId}` as any);
      return;
    }

    if (banner.linkType === 'Vendor' && banner.linkTargetId) {
      router.push(`/vendor/${banner.linkTargetId}` as any);
      return;
    }

    if (banner.linkUrl?.startsWith('http')) {
      toast.info('Banner dan den lien ket ngoai ung dung');
      return;
    }

    router.push('/(tabs)/explore');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerWrap}>
        <ActivityIndicator size="large" color="#0f172a" />
      </SafeAreaView>
    );
  }

  if (!vendor) {
    return (
      <SafeAreaView style={styles.centerWrap}>
        <Text style={styles.emptyTitle}>Cua hang khong ton tai</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.back()}>
          <Text style={styles.backHomeBtnText}>Quay lai</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{vendor.shopName}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={styles.heroIdentity}>
            <View style={styles.heroAvatarWrap}>
              {(vendor.shopAvatarUrl || vendor.avatarUrl) ? (
                <Image source={{ uri: String(vendor.shopAvatarUrl || vendor.avatarUrl) }} style={styles.heroAvatar} />
              ) : (
                <Text style={styles.heroAvatarText}>{vendor.shopName.charAt(0).toUpperCase()}</Text>
              )}
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName} numberOfLines={2}>{vendor.shopName}</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Cua hang dang truc tuyen</Text>
              </View>
              <View style={styles.heroActions}>
                <TouchableOpacity style={styles.followBtn} onPress={() => toast.info('Tinh nang theo doi se co som')}>
                  <Text style={styles.followBtnText}>Theo doi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={() => toast.info('Tinh nang lien he se co som')}>
                  <Text style={styles.contactBtnText}>Lien he</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>San pham</Text>
              <Text style={styles.statValue}>{products.length}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Danh gia</Text>
              <Text style={styles.statValue}>{vendorAvgRating} <Text style={styles.statSub}>({vendorRatingCount})</Text></Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Tham gia</Text>
              <Text style={styles.statValue}>{joinTimeMonths} <Text style={styles.statSub}>thang</Text></Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Hang shop</Text>
              <Text style={styles.statValue}>{String(vendor.tierName || 'Bac').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsWrap}>
          {([
            { key: 'home', label: 'Trang chu' },
            { key: 'products', label: 'San pham' },
            { key: 'about', label: 'Thong tin' },
          ] as Array<{ key: VendorTab; label: string }>).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'home' && (
          <View style={styles.block}>
            {banners.length > 0 ? (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                {banners.map((banner) => (
                  <TouchableOpacity
                    key={banner.bannerId}
                    activeOpacity={0.9}
                    style={styles.bannerCard}
                    onPress={() => handleBannerPress(banner)}
                  >
                    <Image source={{ uri: banner.imageUrl }} style={styles.bannerImage} resizeMode="cover" />
                    <View style={styles.bannerOverlay}>
                      <Text style={styles.bannerTitle} numberOfLines={2}>{banner.title}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.bannerCard, styles.bannerFallback]}>
                <Text style={styles.bannerFallbackText}>{vendor.shopName}</Text>
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>De xuat</Text>
            </View>

            <View style={styles.tilesGrid}>
              {products.slice(0, 8).map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  onPress={() => router.push(`/product/${product.id}` as any)}
                />
              ))}
            </View>
          </View>
        )}

        {activeTab === 'products' && (
          <View style={styles.block}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, activeFilter === 'All' && styles.filterChipActive]}
                onPress={() => setActiveFilter('All')}
              >
                <Text style={[styles.filterText, activeFilter === 'All' && styles.filterTextActive]}>Tat ca</Text>
              </TouchableOpacity>

              {categories
                .filter((cat) => products.some((p) => p.category === cat.name))
                .map((cat) => (
                  <TouchableOpacity
                    key={cat.categoryId}
                    style={[styles.filterChip, activeFilter === cat.name && styles.filterChipActive]}
                    onPress={() => setActiveFilter(cat.name)}
                  >
                    <Text style={[styles.filterText, activeFilter === cat.name && styles.filterTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.tilesGrid}>
              {shownProducts.map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  onPress={() => router.push(`/product/${product.id}` as any)}
                />
              ))}
            </View>

            {shownProducts.length === 0 && (
              <Text style={styles.emptyHint}>Khong tim thay san pham phu hop</Text>
            )}
          </View>
        )}

        {activeTab === 'about' && (
          <View style={styles.block}>
            <View style={styles.aboutCard}>
              <Text style={styles.aboutTitle}>Gioi thieu</Text>
              <Text style={styles.aboutText}>{vendor.shopDescription || 'Cua hang chuyen cung cap cac dich vu tam linh truyen thong.'}</Text>
            </View>

            <View style={styles.aboutCard}>
              <Text style={styles.aboutTitle}>Vi tri</Text>
              <View style={styles.locationRow}>
                <MapPin size={16} color="#334155" />
                <Text style={styles.aboutText}>{vendor.shopAddressText || 'Viet Nam'}</Text>
              </View>
            </View>

            <View style={styles.aboutCard}>
              <Text style={styles.aboutTitle}>Chi tiet</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loai hinh</Text>
                <Text style={styles.detailValue}>{BUSINESS_TYPE_MAP[String(vendor.businessType || 'Individual')] || String(vendor.businessType || 'Ca nhan')}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hang</Text>
                <Text style={styles.detailValue}>{String(vendor.tierName || 'Bac').toUpperCase()}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 14 },
  backHomeBtn: { backgroundColor: '#0f172a', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  backHomeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#0f172a' },

  scrollContent: { paddingBottom: 24 },

  hero: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#0b1530',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#020617',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  heroIdentity: { flexDirection: 'row', alignItems: 'center' },
  heroAvatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroAvatar: { width: '100%', height: '100%' },
  heroAvatarText: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
  heroInfo: { flex: 1, marginLeft: 12 },
  heroName: { color: '#fff', fontWeight: '900', fontSize: 24, lineHeight: 28 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e', marginRight: 6 },
  onlineText: { color: '#93c5fd', fontSize: 10, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8 },
  heroActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  followBtn: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  followBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
  contactBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  contactBtnText: { color: '#fff', fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },

  statsRow: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: { width: '24%' },
  statLabel: { color: '#93a3c5', fontSize: 10, textTransform: 'uppercase', fontWeight: '700' },
  statValue: { color: '#fff', marginTop: 4, fontSize: 18, fontWeight: '900' },
  statSub: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },

  tabsWrap: {
    marginTop: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#0f172a' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  tabTextActive: { color: '#0f172a' },

  block: { paddingHorizontal: 12, paddingTop: 14 },
  bannerCard: {
    width: width - 24,
    height: Math.round((width - 24) * 0.45),
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: '#e2e8f0',
  },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.35)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  bannerTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  bannerFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#dbeafe' },
  bannerFallbackText: { color: '#1e3a8a', fontSize: 20, fontWeight: '900', textAlign: 'center', paddingHorizontal: 16 },

  sectionHeaderRow: { marginTop: 20, marginBottom: 10 },
  sectionHeader: { color: '#0f172a', fontSize: 18, fontWeight: '900' },

  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tileCard: {
    width: (width - 36) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tileImage: { width: '100%', height: (width - 36) / 2 },
  tileBody: { padding: 10 },
  tileName: { fontSize: 13, color: '#1e293b', fontWeight: '700', minHeight: 36 },
  tileMetaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileRatingWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileRatingText: { fontSize: 12, color: '#334155', fontWeight: '700' },
  tileSold: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  tilePrice: { marginTop: 8, fontSize: 14, fontWeight: '900', color: '#0f172a' },

  filterRow: { gap: 8, paddingBottom: 10 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  filterText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  filterTextActive: { color: '#fff' },
  emptyHint: { textAlign: 'center', color: '#64748b', marginTop: 24, fontWeight: '600' },

  aboutCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  aboutTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', marginBottom: 8 },
  aboutText: { fontSize: 14, color: '#334155', lineHeight: 20, fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  detailLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  detailValue: { fontSize: 13, color: '#0f172a', fontWeight: '700' },
});
