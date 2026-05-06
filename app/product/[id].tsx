import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Image, ActivityIndicator, Dimensions,
  TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, useRouter, useLocalSearchParams as useExpoParams } from 'expo-router';
import { Star, ChevronLeft, Minus, Plus, ShoppingCart, Store, CheckCircle, MessageSquare, ShieldCheck, User } from 'lucide-react-native';

import { Product } from '../../types';
import { packageService } from '../../services/packageService';
import { VendorProfile, vendorService } from '../../services/vendorService';
import { getCurrentUser, getProfile } from '../../services/auth';
import { reviewService, Review } from '../../services/reviewService';
import { cartService } from '../../services/cartService';
import toast from '../../services/toast';

const { width } = Dimensions.get('window');
const isNarrowScreen = width < 360;

export default function ProductDetailPage() {
  const { id } = useExpoParams<{ id: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [product, setProduct] = useState<Product | null>(null);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);
  const [vendorOverallReviews, setVendorOverallReviews] = useState<Review[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  const [hoveredVariantIndex, setHoveredVariantIndex] = useState<number | null>(null);
  const [currentMainImage, setCurrentMainImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [packageMeta, setPackageMeta] = useState<any | null>(null);
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  
  const [vendorReplyingTo, setVendorReplyingTo] = useState<string | null>(null);
  const [vendorReplyText, setVendorReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [selectedSwaps, setSelectedSwaps] = useState<Record<number, boolean>>({});
  const [selectedAddOns, setSelectedAddOns] = useState<Record<number, number>>({});

  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [id]);

  useEffect(() => {
    const checkVendorStatus = async () => {
      const user = getCurrentUser();
      if (!user) return;

      if (user.role?.toLowerCase() === 'vendor' || user.roles?.some(r => r.toLowerCase() === 'vendor')) {
        setIsVendor(true);
        return;
      }
      try {
        const profile = await getProfile();
        if (profile.isVendor) {
          setIsVendor(true);
        }
      } catch (e) {}
    };
    checkVendorStatus();
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      const numericId = Number(String(id).trim());
      if (!Number.isInteger(numericId) || numericId <= 0) {
        setProduct(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const apiPackage = await packageService.getPackageById(numericId);
        if (apiPackage) {
          setPackageMeta(apiPackage as any);
          const vendorId = apiPackage.vendorProfileId || (apiPackage as any).vendorId;
          let vendorMap = new Map();

          if (vendorId) {
            try {
              const vendorData = await vendorService.getVendorCached(vendorId);
              if (vendorData) {
                vendorMap = new Map([[vendorId, vendorData]]);
                setVendor(vendorData);
                
                Promise.all([
                  packageService.getPackagesByVendor(vendorId),
                  reviewService.getReviewsByVendorId(vendorId)
                ]).then(([pkgs, revs]) => {
                  packageService.mapToProductsWithVendors(pkgs).then(setVendorProducts);
                  setVendorOverallReviews(revs);
                }).catch(() => {});
              }
            } catch (vError) {}
          }

          const mappedProduct = packageService.mapToProduct(apiPackage, vendorMap);
          setProduct(mappedProduct);
        } else {
          setPackageMeta(null);
          setProduct(null);
        }
      } catch (error) {
        setPackageMeta(null);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const currentUser = getCurrentUser();
  const role = currentUser?.role?.toLowerCase() || '';
  const isModerator = ['admin', 'staff', 'vendor'].includes(role);
  const isOwnerVendor = isVendor || isModerator;

  const fetchReviews = useCallback(async () => {
    const rawId = id ?? product?.id;
    const packageId = Number(String(rawId ?? '').trim());
    if (!Number.isInteger(packageId) || packageId <= 0) {
      setReviews([]);
      return;
    }
    setLoadingReviews(true);
    try {
      const data = await reviewService.getReviewsByPackageId(packageId);
      setReviews(data);
    } catch (error) {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, [id, product?.id]);

  useEffect(() => {
    if (product) {
      fetchReviews();
    }
  }, [product, fetchReviews]);

  const handleVendorReply = async (reviewId: string) => {
    if (!vendorReplyText.trim()) {
      toast.error('Vui lòng nhập nội dung phản hồi.');
      return;
    }
    setIsSubmittingReply(true);
    try {
      const success = await reviewService.updateVendorReply(reviewId, vendorReplyText);
      if (success) {
        toast.success('Phản hồi thành công!');
        setVendorReplyingTo(null);
        setVendorReplyText('');
        fetchReviews();
      }
    } catch (error: any) {
      toast.error(error.message || 'Phản hồi thất bại.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleToggleVisibility = async (reviewId: string, currentVisibility: boolean) => {
    try {
      const success = await reviewService.updateReviewVisibility(reviewId, !currentVisibility);
      if (success) {
        toast.success(`Đã ${!currentVisibility ? 'hiện' : 'ẩn'} đánh giá!`);
        fetchReviews();
      }
    } catch (error: any) {
      toast.error(error.message || 'Thao tác thất bại.');
    }
  };

  const reviewsToDisplay = reviews.filter(r => (r.isVisible !== false) || isOwnerVendor);
  const averageRating = reviewsToDisplay.length > 0
    ? (reviewsToDisplay.reduce((acc, r) => acc + r.rating, 0) / reviewsToDisplay.length).toFixed(1)
    : (product?.rating?.toFixed(1) || '0.0');

  const ratingDistribution = [5, 4, 3, 2, 1].map(stars => {
    const count = reviewsToDisplay.filter(r => Math.round(r.rating) === stars).length;
    const percentage = reviewsToDisplay.length > 0 ? (count / reviewsToDisplay.length) * 100 : 0;
    return { stars, count, percentage };
  });

  const thumbnailImages = product?.gallery && product.gallery.length > 0
    ? product.gallery
    : [];

  const productImages = Array.from(new Set([
    product?.image || '',
    ...thumbnailImages
  ])).filter(img => img);

  const selectedVariantMeta = Array.isArray(packageMeta?.packageVariants)
    ? (selectedVariantIndex !== null ? packageMeta.packageVariants[selectedVariantIndex] : null)
    : null;
  const variantImages = Array.from(new Set([
    String(selectedVariantMeta?.imageUrl || '').trim(),
    ...(Array.isArray(selectedVariantMeta?.variantImages) ? selectedVariantMeta.variantImages : []),
    ...(Array.isArray(selectedVariantMeta?.imageUrls) ? selectedVariantMeta.imageUrls : []),
  ]))
    .map((url) => String(url || '').trim())
    .filter(Boolean);

  const displayImages = variantImages.length > 0 ? variantImages : productImages;

  const activeVariantIndex = hoveredVariantIndex !== null ? hoveredVariantIndex : selectedVariantIndex;

  const getVariantMainImageIndex = (variantIndex: number | null, images: string[], hasVariantSpecificImages: boolean) => {
    if (images.length === 0 || variantIndex === null) return 0;
    if (hasVariantSpecificImages) return 0;
    return Math.min(Math.max(variantIndex, 0), images.length - 1);
  };

  const getSelectedVariantImageIndex = (variantIndex: number | null) => {
    if (variantIndex === null) return 0;

    const selectedVariant = Array.isArray(packageMeta?.packageVariants)
      ? packageMeta.packageVariants[variantIndex]
      : null;

    const selectedImages = selectedVariant
      ? Array.from(new Set([
        String(selectedVariant?.imageUrl || '').trim(),
        ...(Array.isArray(selectedVariant?.variantImages) ? selectedVariant.variantImages : []),
        ...(Array.isArray(selectedVariant?.imageUrls) ? selectedVariant.imageUrls : []),
      ])).filter(Boolean)
      : [];

    return getVariantMainImageIndex(
      variantIndex,
      selectedImages.length > 0 ? selectedImages : productImages,
      selectedImages.length > 0,
    );
  };

  const selectedVariantDescription =
    selectedVariantMeta?.description ||
    (selectedVariantIndex !== null ? product?.variants?.[selectedVariantIndex]?.description : '') ||
    '';

  const selectedVariant = selectedVariantIndex !== null ? product?.variants?.[selectedVariantIndex] : null;
  const variantBasePrice = selectedVariant?.price ?? product?.price ?? 0;
  const selectedSwapDetails = selectedVariant?.availableSwaps?.filter((swap) => selectedSwaps[swap.swapId]) || [];
  const selectedAddOnDetails = (product?.availableAddOns || []).filter((addOn) => (selectedAddOns[addOn.addOnId] || 0) > 0);
  const baseTotal = variantBasePrice * quantity;
  const swapSurchargeTotal = selectedSwapDetails.reduce((sum, swap) => sum + Math.max(0, swap.surcharge || 0), 0) * quantity;
  const addOnTotal = selectedAddOnDetails.reduce((sum, addOn) => sum + (addOn.retailPrice * (selectedAddOns[addOn.addOnId] || 0)), 0);
  const grandTotal = baseTotal + swapSurchargeTotal + addOnTotal;

  useEffect(() => {
    setCurrentMainImage(getSelectedVariantImageIndex(activeVariantIndex));
  }, [activeVariantIndex, productImages.length, packageMeta?.packageVariants?.length]);

  useEffect(() => {
    if (currentMainImage > displayImages.length - 1) {
      setCurrentMainImage(0);
    }
  }, [displayImages.length, currentMainImage]);

  const handleAddToCart = async () => {
    const user = getCurrentUser();
    if (!user) {
      toast.warning('Vui lòng đăng nhập để thêm vào giỏ hàng');
      router.push('/login');
      return;
    }

    if (selectedVariantIndex === null) {
      toast.error('Vui lòng chọn gói lễ vật trước');
      return;
    }

    const selectedVariant = product?.variants?.[selectedVariantIndex];
    if (!selectedVariant || !selectedVariant.variantId) {
      toast.error('Vui lòng chọn gói lễ');
      return;
    }

    setAddingToCart(true);
    try {
      const success = await cartService.addToCart({
        variantId: selectedVariant.variantId,
        quantity,
        swaps: Object.entries(selectedSwaps)
          .filter(([_, selected]) => selected)
          .map(([swapId]) => ({ swapId: Number(swapId) })),
        addOns: Object.entries(selectedAddOns)
          .filter(([_, qty]) => qty > 0)
          .map(([addOnId, qty]) => ({ addOnId: Number(addOnId), quantity: qty })),
      });
      if (success) {
        toast.success('Đã thêm vào giỏ hàng!');
      } else {
        toast.error('Không thể thêm vào giỏ hàng. Vui lòng thử lại.');
      }
    } catch (error) {
      toast.error('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    const user = getCurrentUser();
    if (!user) {
      toast.warning('Vui lòng đăng nhập để mua hàng');
      router.push('/login');
      return;
    }

    if (selectedVariantIndex === null) {
      toast.error('Vui lòng chọn gói lễ vật trước');
      return;
    }

    const selectedVariant = product?.variants?.[selectedVariantIndex];
    if (!selectedVariant || !selectedVariant.variantId) {
      toast.error('Vui lòng chọn gói lễ');
      return;
    }

    setBuyingNow(true);
    try {
      const cartItemId = await cartService.addToCartAndResolveItemId({
        variantId: selectedVariant.variantId,
        quantity,
        swaps: Object.entries(selectedSwaps)
          .filter(([_, selected]) => selected)
          .map(([swapId]) => ({ swapId: Number(swapId) })),
        addOns: Object.entries(selectedAddOns)
          .filter(([_, qty]) => qty > 0)
          .map(([addOnId, qty]) => ({ addOnId: Number(addOnId), quantity: qty })),
      });

      if (cartItemId && cartItemId > 0) {
        router.push(`/checkout?cartItemId=${cartItemId}` as any);
        toast.success('Đang chuyển đến thanh toán');
      } else {
        // Fallback to cart if backend did not return/resolve cart item id
        router.push('/(tabs)/cart' as any);
        toast.info('Đã thêm vào giỏ hàng. Vui lòng tiếp tục thanh toán.');
      }
    } catch (error) {
      toast.error('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setBuyingNow(false);
    }
  };

  const handleViewShop = () => {
    const vendorId = vendor?.profileId || vendor?.vendorProfileId;
    if (!vendorId) {
      toast.error('Khong tim thay thong tin cua hang');
      return;
    }
    router.push(`/vendor/${vendorId}` as any);
  };

  const handleStartChat = () => {
    const user = getCurrentUser();
    if (!user) {
      toast.warning('Vui long dang nhap de nhan tin voi cua hang');
      router.push('/login');
      return;
    }

    const vendorId = String(vendor?.profileId || vendor?.vendorProfileId || '').trim();
    if (!vendorId) {
      toast.error('Khong tim thay thong tin cua hang');
      return;
    }

    router.push({
      pathname: '/messages',
      params: {
        vendorId,
        packageId: String(id || ''),
      },
    } as any);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Đang tải sản phẩm...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Sản phẩm không tìm thấy</Text>
        <Text style={styles.errorDesc}>Sản phẩm bạn tìm kiếm không tồn tại hoặc đã bị xóa</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const vendorRatingCount = vendorOverallReviews.length;
  const vendorAvgRating = vendorRatingCount > 0
    ? (vendorOverallReviews.reduce((acc, r) => acc + r.rating, 0) / vendorRatingCount).toFixed(1)
    : (vendor?.ratingAvg || '0.0');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <ChevronLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView ref={scrollViewRef} style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Image Gallery */}
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: displayImages[currentMainImage] || 'https://via.placeholder.com/400' }} 
              style={styles.mainImage} 
              resizeMode="cover"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailsContainer}>
            {displayImages.map((imgUrl, i) => (
              <TouchableOpacity key={i} onPress={() => setCurrentMainImage(i)} style={[styles.thumbnailWrapper, currentMainImage === i && styles.thumbnailActive]}>
                <Image source={{ uri: imgUrl }} style={styles.thumbnail} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Product Info */}
          <View style={styles.infoSection}>
            <View style={styles.tagWrapper}>
              <Text style={styles.tagText}>Truyền thống</Text>
            </View>
            <Text style={styles.productName}>{product.name}</Text>
            
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>
                {(
                  selectedVariantIndex !== null && product.variants && product.variants[selectedVariantIndex]
                    ? product.variants[selectedVariantIndex].price
                    : product.price
                ).toLocaleString('vi-VN')} <Text style={{ textDecorationLine: 'underline' }}>đ</Text>
              </Text>
              {product.originalPrice && (
                <Text style={styles.originalPriceText}>{product.originalPrice.toLocaleString('vi-VN')} <Text style={{ textDecorationLine: 'underline' }}>đ</Text></Text>
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Star size={16} color="#fbbf24" fill="#fbbf24" />
                <Text style={styles.statTextBold}>{product.rating}</Text>
                <Text style={styles.statText}>({reviewsToDisplay.length} đánh giá)</Text>
              </View>
              {product.totalSold !== undefined && product.totalSold > 0 && (
                <View style={styles.statItem}>
                  <Text style={styles.statTextItalic}>Đã bán {product.totalSold}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Variants Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GÓI LỄ VẬT</Text>
            <View style={styles.variantsGrid}>
              {product.variants?.map((variant, index) => (
                <TouchableOpacity 
                  key={variant.variantId} 
                  onPress={() => {
                    if (selectedVariantIndex === index) {
                      setSelectedVariantIndex(null);
                    } else {
                      setSelectedVariantIndex(index);
                    }
                    setSelectedSwaps({});
                    setSelectedAddOns({});

                    const nextImages = Array.from(new Set([
                      String((variant as any)?.imageUrl || '').trim(),
                      ...(Array.isArray((variant as any)?.variantImages) ? (variant as any).variantImages : []),
                      ...(Array.isArray((variant as any)?.imageUrls) ? (variant as any).imageUrls : []),
                    ])).filter(Boolean);

                    setCurrentMainImage(
                      getVariantMainImageIndex(index, nextImages.length > 0 ? nextImages : productImages, nextImages.length > 0),
                    );
                  }}
                  onPressIn={() => {
                    const nextImages = Array.from(new Set([
                      String((variant as any)?.imageUrl || '').trim(),
                      ...(Array.isArray((variant as any)?.variantImages) ? (variant as any).variantImages : []),
                      ...(Array.isArray((variant as any)?.imageUrls) ? (variant as any).imageUrls : []),
                    ])).filter(Boolean);

                    setHoveredVariantIndex(index);
                    setCurrentMainImage(
                      getVariantMainImageIndex(index, nextImages.length > 0 ? nextImages : productImages, nextImages.length > 0),
                    );
                  }}
                  onPressOut={() => {
                    setHoveredVariantIndex(null);
                    setCurrentMainImage(getSelectedVariantImageIndex(selectedVariantIndex));
                  }}
                  onMouseEnter={() => {
                    setHoveredVariantIndex(index);

                    const nextImages = Array.from(new Set([
                      String((variant as any)?.imageUrl || '').trim(),
                      ...(Array.isArray((variant as any)?.variantImages) ? (variant as any).variantImages : []),
                      ...(Array.isArray((variant as any)?.imageUrls) ? (variant as any).imageUrls : []),
                    ])).filter(Boolean);

                    setCurrentMainImage(
                      getVariantMainImageIndex(index, nextImages.length > 0 ? nextImages : productImages, nextImages.length > 0),
                    );
                  }}
                  onMouseLeave={() => {
                    setHoveredVariantIndex(null);
                    setCurrentMainImage(getSelectedVariantImageIndex(selectedVariantIndex));
                  }}
                  style={[styles.variantCard, selectedVariantIndex === index && styles.variantCardActive]}
                >
                  <Text style={[styles.variantTier, selectedVariantIndex === index && styles.variantTierActive]}>{variant.tier}</Text>
                  <Text style={styles.variantPrice}>{formatPrice(variant.price)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedVariant && (
              <View style={styles.variantMetaRow}>
                <View style={styles.variantMetaItem}>
                  <Text style={styles.variantMetaLabel}>TỐI THIỂU</Text>
                  <Text style={styles.variantMetaValue}>{selectedVariant.minOrderQuantity ?? 1}</Text>
                </View>
                <View style={styles.variantMetaDivider} />
                <View style={styles.variantMetaItem}>
                  <Text style={styles.variantMetaLabel}>TỐI ĐA</Text>
                  <Text style={styles.variantMetaValue}>{selectedVariant.maxOrderQuantity ?? 99}</Text>
                </View>
                {selectedVariant.productionWeight !== undefined && (
                  <>
                    <View style={styles.variantMetaDivider} />
                    <View style={styles.variantMetaItem}>
                      <Text style={styles.variantMetaLabel}>ĐIỂM NĂNG LỰC</Text>
                      <Text style={styles.variantMetaValue}>{selectedVariant.productionWeight}</Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Available Swaps Section */}
          {selectedVariantIndex !== null && selectedVariant?.availableSwaps && selectedVariant.availableSwaps.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TÙY CHỌN THAY ĐỔI (SWAPS)</Text>
              <View style={styles.optionList}>
                {selectedVariant.availableSwaps.map((swap) => (
                  <TouchableOpacity
                    key={swap.swapId}
                    style={[styles.optionCard, selectedSwaps[swap.swapId] && styles.optionCardActive]}
                    onPress={() => setSelectedSwaps((prev) => ({ ...prev, [swap.swapId]: !prev[swap.swapId] }))}
                    activeOpacity={0.9}
                  >
                    <View style={styles.optionCardContent}>
                      <View style={styles.optionTextWrap}>
                        <Text style={styles.swapOriginalText}>Thay {swap.originalItemName}</Text>
                        <Text style={styles.swapReplacementText}>Bằng {swap.replacementItemName}</Text>
                      </View>
                      <View style={styles.optionRightWrap}>
                        <Text style={[styles.swapPriceText, swap.surcharge > 0 ? styles.priceAccent : styles.priceFree]}>
                          {swap.surcharge > 0 ? `+${swap.surcharge.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                        </Text>
                        <View style={[styles.checkCircle, selectedSwaps[swap.swapId] && styles.checkCircleActive]}>
                          {selectedSwaps[swap.swapId] && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Available Add-ons Section */}
          {product.availableAddOns && product.availableAddOns.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MUA THÊM LỄ VẬT</Text>
              <View style={styles.optionList}>
                {product.availableAddOns.map((addOn) => {
                  const currentQty = selectedAddOns[addOn.addOnId] || 0;
                  return (
                    <View key={addOn.addOnId} style={[styles.optionCard, currentQty > 0 && styles.optionCardActive]}>
                      <View style={styles.optionCardContent}>
                        <View style={styles.optionTextWrap}>
                          <Text style={styles.addOnNameText}>{addOn.itemName}</Text>
                          <Text style={styles.addOnPriceText}>{addOn.retailPrice.toLocaleString('vi-VN')}đ</Text>
                        </View>

                        <View style={styles.addOnQtyControl}>
                          <TouchableOpacity
                            onPress={() => setSelectedAddOns((prev) => ({ ...prev, [addOn.addOnId]: Math.max(0, currentQty - 1) }))}
                            style={[styles.addOnQtyBtn, currentQty <= 0 && styles.addOnQtyBtnDisabled]}
                            disabled={currentQty <= 0}
                          >
                            <Text style={[styles.addOnQtyBtnText, currentQty <= 0 && styles.addOnQtyBtnTextDisabled]}>-</Text>
                          </TouchableOpacity>

                          <Text style={styles.addOnQtyText}>{currentQty}</Text>

                          <TouchableOpacity
                            onPress={() => setSelectedAddOns((prev) => ({
                              ...prev,
                              [addOn.addOnId]: Math.min(addOn.maxQuantity, currentQty + 1),
                            }))}
                            style={[styles.addOnQtyBtn, currentQty >= addOn.maxQuantity && styles.addOnQtyBtnDisabled]}
                            disabled={currentQty >= addOn.maxQuantity}
                          >
                            <Text style={[styles.addOnQtyBtnText, currentQty >= addOn.maxQuantity && styles.addOnQtyBtnTextDisabled]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Price Breakdown Section */}
          <View style={styles.section}>
            <View style={styles.priceRowBreakdown}>
              <Text style={styles.breakdownLabel}>Giá gói:</Text>
              <Text style={styles.breakdownValue}>{baseTotal.toLocaleString('vi-VN')}đ</Text>
            </View>

            {selectedSwapDetails
              .filter((swap) => swap.surcharge > 0)
              .map((swap) => (
                <View key={swap.swapId} style={styles.priceRowMinor}>
                  <Text style={styles.breakdownMinorLabel}>Phụ phí đổi món ({swap.replacementItemName}):</Text>
                  <Text style={styles.breakdownMinorValue}>+{(swap.surcharge * quantity).toLocaleString('vi-VN')}đ</Text>
                </View>
              ))}

            {selectedAddOnDetails.map((addOn) => {
              const qty = selectedAddOns[addOn.addOnId] || 0;
              return (
                <View key={addOn.addOnId} style={styles.priceRowMinor}>
                  <Text style={styles.breakdownMinorLabelPrimary}>Thêm ({addOn.itemName} x{qty}):</Text>
                  <Text style={styles.breakdownMinorValuePrimary}>+{(addOn.retailPrice * qty).toLocaleString('vi-VN')}đ</Text>
                </View>
              );
            })}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TỔNG CỘNG:</Text>
              <Text style={styles.totalValue}>{grandTotal.toLocaleString('vi-VN')}đ</Text>
            </View>
          </View>

          {/* Description / Included Items */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.includeSectionTitle]}>LỄ VẬT BAO GỒM</Text>
            {selectedVariantDescription ? (
              <View style={styles.descBox}>
                <Text style={styles.descText}>{selectedVariantDescription}</Text>
              </View>
            ) : null}
            <View style={styles.itemsList}>
              {selectedVariantIndex === null ? (
                <Text style={styles.variantHintText}>Vui lòng chọn gói lễ vật để xem vật phẩm bao gồm.</Text>
              ) : (
                product.variants?.[selectedVariantIndex]?.items?.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <CheckCircle size={14} color="#000" />
                    <Text style={styles.listItemText}>{item}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Vendor Profile */}
          {vendor && (
              <View style={styles.vendorContainer}>
                <View style={[styles.vendorHeader, isNarrowScreen && styles.vendorHeaderNarrow]}>
                <View style={styles.vendorAvatarWrapper}>
                  {vendor.shopAvatarUrl ? (
                    <Image source={{ uri: vendor.shopAvatarUrl }} style={styles.vendorAvatar} />
                  ) : (
                    <Text style={styles.vendorAvatarText}>{vendor.shopName.charAt(0)}</Text>
                  )}
                </View>
                <View style={styles.vendorInfo}>
                  <Text style={styles.vendorName} numberOfLines={1}>{vendor.shopName}</Text>
                  <View style={styles.vendorStatus}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText} numberOfLines={1}>Cửa hàng đối tác</Text>
                  </View>
                </View>
                <View style={styles.vendorActions}>
                  <TouchableOpacity
                    style={styles.vendorViewBtn}
                    onPress={handleViewShop}
                  >
                    <Text style={styles.vendorViewBtnText}>Xem Shop</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.vendorChatBtn}
                    onPress={handleStartChat}
                  >
                    <MessageSquare size={13} color="#fff" />
                    <Text style={styles.vendorChatBtnText}>Nhắn tin</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.vendorStats}>
                <View style={[styles.vendorStatItem, isNarrowScreen && styles.vendorStatItemNarrow]}>
                  <Text style={styles.vStatLabel}>Đánh giá</Text>
                  <Text style={styles.vStatValue}>{vendorAvgRating} <Text style={{fontSize:10, color:'#b45309'}}>/5</Text></Text>
                </View>
                <View style={[styles.vendorStatItem, isNarrowScreen && styles.vendorStatItemNarrow]}>
                  <Text style={styles.vStatLabel}>Sản phẩm</Text>
                  <Text style={styles.vStatValue}>{vendorProducts.length || '24'}</Text>
                </View>
                <View style={[styles.vendorStatItem, isNarrowScreen && styles.vendorStatItemNarrow]}>
                  <Text style={styles.vStatLabel}>Hạng</Text>
                  <Text style={[styles.vStatValue, {color: '#d97706'}]}>{vendor.tierName || 'Vàng'}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Reviews Section */}
          <View style={styles.reviewsSection}>
            <Text style={styles.reviewsHeader}>ĐÁNH GIÁ SẢN PHẨM</Text>
            
            <View style={styles.ratingSummaryBox}>
              <Text style={styles.bigRating}>{averageRating}</Text>
              <View style={styles.starsRow}>
                 {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} size={20} color={star <= Math.round(Number(averageRating)) ? '#fbbf24' : '#e2e8f0'} fill={star <= Math.round(Number(averageRating)) ? '#fbbf24' : '#e2e8f0'} />
                 ))}
              </View>
              <Text style={styles.ratingCountText}>{reviewsToDisplay.length} đánh giá cho gói này</Text>
              
              <View style={styles.distributionBox}>
                {ratingDistribution.map((item) => (
                  <View key={item.stars} style={styles.distRow}>
                    <Text style={styles.distStars}>{item.stars}★</Text>
                    <View style={styles.distBarBg}>
                      <View style={[styles.distBarFill, { width: `${item.percentage}%` }]} />
                    </View>
                    <Text style={styles.distCount}>{item.count}</Text>
                  </View>
                ))}
              </View>
            </View>

            {loadingReviews ? (
              <ActivityIndicator size="small" color="#b45309" style={{ marginVertical: 20 }} />
            ) : reviewsToDisplay.length === 0 ? (
              <Text style={styles.noReviewsText}>Chưa có đánh giá nào cho gói lễ này.</Text>
            ) : (
              <View style={styles.reviewsList}>
                {reviewsToDisplay.map((review) => (
                  <View key={review.reviewId} style={[styles.reviewItem, !review.isVisible && { opacity: 0.6 }]}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewAvatar}>
                        {review.customerAvatar ? (
                           <Image source={{ uri: review.customerAvatar }} style={styles.reviewAvatarImg} />
                        ) : (
                          <Text style={styles.reviewAvatarTxt}>{review.customerName?.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <View style={styles.reviewMeta}>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                          <Text style={styles.reviewAuthor}>{review.customerName}</Text>
                          {!review.isVisible && (
                            <View style={styles.hiddenBadge}><Text style={styles.hiddenBadgeTxt}>Đã ẩn</Text></View>
                          )}
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4}}>
                           <View style={styles.starsRowSmall}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <Star key={star} size={10} color={star <= review.rating ? '#fbbf24' : '#e2e8f0'} fill={star <= review.rating ? '#fbbf24' : '#e2e8f0'} />
                            ))}
                           </View>
                           <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</Text>
                        </View>
                        {review.variantName && <Text style={styles.reviewVariant}>({review.variantName})</Text>}
                      </View>

                      {isOwnerVendor && (
                        <TouchableOpacity style={styles.reviewToggleBtn} onPress={() => handleToggleVisibility(String(review.reviewId), !!review.isVisible)}>
                          <Text style={[styles.reviewToggleTxt, !review.isVisible && {color: '#10b981'}]}>
                            {review.isVisible ? 'Ẩn' : 'Hiện'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={styles.reviewComment}>{review.comment}</Text>

                    {review.reviewImageUrls?.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewImagesScroll}>
                        {review.reviewImageUrls.map((url, idx) => (
                          <Image key={idx} source={{ uri: url }} style={styles.reviewImg} />
                        ))}
                      </ScrollView>
                    )}

                    {review.vendorReply ? (
                      <View style={styles.vendorReplyBox}>
                        <Text style={styles.vendorReplyTitle}>Phản hồi từ Shop</Text>
                        <Text style={styles.vendorReplyText}>"{review.vendorReply}"</Text>
                      </View>
                    ) : isOwnerVendor && vendorReplyingTo !== review.reviewId ? (
                      <TouchableOpacity style={styles.replyBtn} onPress={() => setVendorReplyingTo(String(review.reviewId))}>
                        <MessageSquare size={12} color="#b45309" />
                        <Text style={styles.replyBtnTxt}>Phản hồi ngay</Text>
                      </TouchableOpacity>
                    ) : null}

                    {isOwnerVendor && vendorReplyingTo === review.reviewId && (
                      <View style={styles.replyForm}>
                        <TextInput 
                          style={styles.replyInput} 
                          placeholder="Nhập nội dung phản hồi..."
                          value={vendorReplyText}
                          onChangeText={setVendorReplyText}
                          multiline
                        />
                        <View style={styles.replyActions}>
                          <TouchableOpacity style={styles.replyCancelBtn} onPress={() => { setVendorReplyingTo(null); setVendorReplyText(''); }}>
                            <Text style={styles.replyCancelTxt}>Hủy</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.replySubmitBtn} onPress={() => handleVendorReply(String(review.reviewId))} disabled={isSubmittingReply}>
                            <Text style={styles.replySubmitTxt}>Gửi</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
          
          <View style={{ height: isNarrowScreen ? 124 : 110 }} /> 
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, isNarrowScreen && styles.bottomBarNarrow]}>
        <View style={[styles.quantityControl, isNarrowScreen && styles.quantityControlNarrow]}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
            <Minus size={16} color="#333" />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{quantity}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(quantity + 1)}>
            <Plus size={16} color="#333" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.addToCartBtnBottom, isNarrowScreen && styles.addToCartBtnBottomNarrow, selectedVariantIndex === null && styles.bottomActionDisabled]} 
          onPress={handleAddToCart}
          disabled={addingToCart || selectedVariantIndex === null}
        >
          <ShoppingCart size={20} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.buyNowBtn, isNarrowScreen && styles.buyNowBtnNarrow, selectedVariantIndex === null && styles.bottomActionDisabled]} 
          onPress={handleBuyNow}
          disabled={buyingNow || selectedVariantIndex === null}
        >
          <Text style={styles.buyNowTxt}>Mua Ngay</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666', fontWeight: '500' },
  errorTitle: { fontSize: 24, fontWeight: '900', color: '#000', marginBottom: 10 },
  errorDesc: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  backButton: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backButtonText: { color: '#000', fontWeight: 'bold' },
  
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0'
  },
  headerBtn: { padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  headerSpacer: { width: 32 },

  scrollView: { flex: 1 },
  imageContainer: { width: width, height: width * 0.86, backgroundColor: '#F5F5F5' },
  mainImage: { width: '100%', height: '100%' },
  thumbnailsContainer: { padding: 16, gap: 12 },
  thumbnailWrapper: {
    width: 64, height: 64, borderRadius: 12, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
  },
  thumbnailActive: { borderColor: '#b45309' },
  thumbnail: { width: '100%', height: '100%' },

  infoSection: { padding: 16, backgroundColor: '#FFF', marginBottom: 12 },
  tagWrapper: { 
    alignSelf: 'flex-start', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, 
    borderRadius: 6, marginBottom: 12 
  },
  tagText: { fontSize: 10, fontWeight: '900', color: '#d97706', textTransform: 'uppercase' },
  productName: { fontSize: 21, fontWeight: '900', color: '#1A1A1A', lineHeight: 29, marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  priceText: { fontSize: 26, fontWeight: '900', color: '#000' },
  originalPriceText: { fontSize: 16, color: '#94a3b8', textDecorationLine: 'line-through' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statTextBold: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  statText: { fontSize: 14, color: '#64748b' },
  statTextItalic: { fontSize: 13, color: '#334155', fontStyle: 'italic', fontWeight: '600' },

  section: { padding: 16, backgroundColor: '#FFF', marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 16 },
  includeSectionTitle: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  variantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  variantCard: { 
    padding: 12, borderRadius: 16, borderWidth: 2, borderColor: '#f1f5f9',
    width: (width - 56) / 2, alignItems: 'center', backgroundColor: '#FFF'
  },
  variantCardActive: { borderColor: '#000', backgroundColor: '#f8fafc' },
  variantTier: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 4 },
  variantTierActive: { color: '#000' },
  variantPrice: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  variantMetaRow: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  variantMetaItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantMetaLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 2,
  },
  variantMetaValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  variantMetaDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#e2e8f0',
  },

  optionList: { gap: 10 },
  optionCard: {
    borderWidth: 2,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    backgroundColor: '#FFF',
    padding: 14,
  },
  optionCardActive: {
    borderColor: '#000',
    backgroundColor: '#f8fafc',
  },
  optionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  optionRightWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 84,
    gap: 6,
  },
  swapOriginalText: {
    fontSize: 13,
    color: '#64748b',
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  swapReplacementText: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '800',
    lineHeight: 21,
  },
  swapPriceText: {
    fontSize: 13,
    fontWeight: '900',
  },
  priceAccent: {
    color: '#d97706',
  },
  priceFree: {
    color: '#059669',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkCircleActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  checkMark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  addOnNameText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 21,
  },
  addOnPriceText: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
    marginTop: 2,
  },
  addOnQtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  addOnQtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOnQtyBtnDisabled: {
    backgroundColor: '#f8fafc',
  },
  addOnQtyBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 20,
  },
  addOnQtyBtnTextDisabled: {
    color: '#cbd5e1',
  },
  addOnQtyText: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },

  priceRowBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceRowMinor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '800',
  },
  breakdownMinorLabel: {
    flex: 1,
    fontSize: 11,
    color: '#d97706',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  breakdownMinorValue: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '800',
  },
  breakdownMinorLabelPrimary: {
    flex: 1,
    fontSize: 11,
    color: '#b45309',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  breakdownMinorValuePrimary: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '800',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
    lineHeight: 24,
  },

  descBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  descText: { fontSize: 16, color: '#0f172a', fontWeight: '700', lineHeight: 24 },
  itemsList: { gap: 10 },
  variantHintText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  listItemText: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1, lineHeight: 23 },

  vendorContainer: { backgroundColor: '#1e293b', margin: 16, borderRadius: 24, padding: 20 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  vendorHeaderNarrow: { alignItems: 'flex-start' },
  vendorAvatarWrapper: { 
    width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFF', 
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
  },
  vendorAvatar: { width: '100%', height: '100%' },
  vendorAvatarText: { fontSize: 28, fontWeight: '900', color: '#1e293b' },
  vendorInfo: { flex: 1, minWidth: 0, paddingRight: 4 },
  vendorName: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  vendorStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', flexShrink: 1 },
  vendorActions: { width: 108, gap: 8 },
  vendorViewBtn: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, alignItems: 'center' },
  vendorViewBtnText: { color: '#FFF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  vendorChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderRadius: 10,
  },
  vendorChatBtnText: { color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },

  vendorStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16, rowGap: 12 },
  vendorStatItem: { alignItems: 'center', width: '24%' },
  vendorStatItemNarrow: { width: '48%', alignItems: 'flex-start' },
  vStatLabel: { fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
  vStatValue: { fontSize: 18, fontWeight: '900', color: '#FFF' },

  reviewsSection: { padding: 16, backgroundColor: '#FFF' },
  reviewsHeader: { fontSize: 16, fontWeight: '900', color: '#000', marginBottom: 20, textTransform: 'uppercase' },
  ratingSummaryBox: { backgroundColor: '#f8fafc', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24 },
  bigRating: { fontSize: 48, fontWeight: '900', color: '#000', marginBottom: 4 },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  ratingCountText: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  distributionBox: { width: '100%', gap: 8 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  distStars: { width: 24, fontSize: 12, fontWeight: '700', color: '#475569' },
  distBarBg: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  distBarFill: { height: '100%', backgroundColor: '#fbbf24' },
  distCount: { width: 20, fontSize: 12, color: '#64748b', textAlign: 'right' },

  noReviewsText: { textAlign: 'center', color: '#64748b', paddingVertical: 32 },
  reviewsList: { gap: 20 },
  reviewItem: { borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 20, padding: 16 },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  reviewAvatarImg: { width: '100%', height: '100%' },
  reviewAvatarTxt: { fontSize: 18, fontWeight: '900', color: '#000' },
  reviewMeta: { flex: 1, minWidth: 0 },
  reviewAuthor: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  hiddenBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  hiddenBadgeTxt: { fontSize: 9, color: '#ef4444', fontWeight: '900', textTransform: 'uppercase' },
  starsRowSmall: { flexDirection: 'row', gap: 2 },
  reviewDate: { fontSize: 11, color: '#94a3b8' },
  reviewVariant: { fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 4 },
  
  reviewToggleBtn: { alignSelf: 'flex-start', marginLeft: 8 },
  reviewToggleTxt: { fontSize: 11, fontWeight: '900', color: '#ef4444', textTransform: 'uppercase' },

  reviewComment: { fontSize: 14, color: '#334155', lineHeight: 22, marginBottom: 12 },
  reviewImagesScroll: { marginBottom: 12 },
  reviewImg: { width: 80, height: 80, borderRadius: 12, marginRight: 10 },

  vendorReplyBox: { backgroundColor: '#fdf4ff', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#d946ef' },
  vendorReplyTitle: { fontSize: 11, fontWeight: '900', color: '#d946ef', textTransform: 'uppercase', marginBottom: 4 },
  vendorReplyText: { fontSize: 13, color: '#4a044e', fontStyle: 'italic' },

  replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  replyBtnTxt: { fontSize: 11, fontWeight: '900', color: '#000', textTransform: 'uppercase' },

  replyForm: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, marginTop: 12 },
  replyInput: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, fontSize: 13, height: 80, textAlignVertical: 'top', marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  replyActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  replyCancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  replyCancelTxt: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  replySubmitBtn: { backgroundColor: '#000', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  replySubmitTxt: { fontSize: 12, fontWeight: '900', color: '#FFF' },

  bottomBar: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    flexDirection: 'row', alignItems: 'center', gap: 12, 
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10
  },
  bottomBarNarrow: { gap: 8, paddingHorizontal: 12 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 16, padding: 4 },
  quantityControlNarrow: { padding: 3, borderRadius: 14 },
  qtyBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  qtyText: { fontSize: 16, fontWeight: '900', color: '#1e293b', width: 32, textAlign: 'center' },
  
  addToCartBtnBottom: { width: 48, height: 48, borderRadius: 16, borderWidth: 2, borderColor: '#000', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  bottomActionDisabled: { opacity: 0.45 },
  addToCartBtnBottomNarrow: { width: 44, height: 44, borderRadius: 14 },
  buyNowBtn: { flex: 1, height: 48, borderRadius: 16, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  buyNowBtnNarrow: { height: 44, borderRadius: 14 },
  buyNowTxt: { color: '#FFF', fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }
});
