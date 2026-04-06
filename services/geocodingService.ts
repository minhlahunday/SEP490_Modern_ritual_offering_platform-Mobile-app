// Geocoding Service using OpenStreetMap Nominatim (FREE) + Google Maps fallback
// 
// PRIMARY: OpenStreetMap Nominatim - HOÀN TOÀN MIỄN PHÍ
// - Endpoint: https://nominatim.openstreetmap.org/search
// - Không cần API key
// - Unlimited requests (với rate limiting hợp lý)
// - Độ chính xác cao cho Việt Nam
//
// FALLBACK: Google Maps (nếu có API key)
// - Chỉ dùng khi Nominatim không tìm được kết quả
//
export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  provider: 'nominatim' | 'google' | 'approximate';
}

export interface ReverseGeocodingAddress {
  formattedAddress: string;
  provinceName?: string;
  districtName?: string;
  wardName?: string;
  detailedAddress?: string;
}

export interface AddressSuggestion {
  displayName: string;
  latitude: number;
  longitude: number;
}

// Nominatim (OpenStreetMap) Response
export interface NominatimResponse {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
}

// Google Maps Response (fallback)
export interface GoogleMapsResponse {
  results: {
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }[];
  status: string;
}

class GeocodingService {
  private googleApiKey: string;
  private nominatimCooldownUntil = 0;
  private suggestionCache = new Map<string, { expiresAt: number; items: AddressSuggestion[] }>();

  constructor() {
    this.googleApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    console.log('🗺️  Geocoding Service initialized');
    console.log('📍 Primary: OpenStreetMap Nominatim (FREE)');
    console.log('🔑 Fallback: Google Maps', this.googleApiKey ? '(Configured)' : '(Not configured)');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchNominatimJson<T>(url: string): Promise<T | null> {
    const now = Date.now();
    if (now < this.nominatimCooldownUntil) {
      return null;
    }

    let attempt = 0;
    let waitMs = 0;

    while (attempt < 3) {
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Modern-Ritual-Offering-Platform/1.0' }
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 429) {
        const retryAfterRaw = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterRaw ? Number(retryAfterRaw) : NaN;
        const backoff = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : Math.min(4000, 700 * Math.pow(2, attempt));

        this.nominatimCooldownUntil = Date.now() + backoff;
        waitMs = backoff;
        attempt += 1;
        continue;
      }

      return null;
    }

    return null;
  }

  /**
   * Kiểm tra xem Google API key có được cấu hình không (for fallback)
   */
  private isGoogleApiKeyConfigured(): boolean {
    return !!this.googleApiKey && this.googleApiKey.trim() !== '';
  }

  /**
   * Chuẩn hóa chuỗi: bỏ dấu, chữ thường, loại prefix hành chính
   */
  private normalizeVi(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(quan|huyen|tinh|thanh pho|phuong|xa|thi tran|thi xa)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * PRIMARY: Geocoding sử dụng OpenStreetMap Nominatim (MIỄN PHÍ)
   * @param address - Địa chỉ đầy đủ
   * @param mustContain - Nếu có, kết quả phải chứa district VÀ province
   * @returns Tọa độ từ Nominatim
   */
  private async geocodeWithNominatim(
    address: string,
    mustContain?: { district?: string; province?: string }
  ): Promise<GeocodingResult | null> {
    try {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=10&countrycodes=vn&addressdetails=1`;

      console.log('🗺️  Calling Nominatim:', address);

      const data = await this.fetchNominatimJson<NominatimResponse[]>(url);
      if (!Array.isArray(data) || data.length === 0) return null;
      console.log('📍 Nominatim raw results:', data.map(r => r.display_name));

      // --- Bước 1: lọc theo quận/tỉnh bắt buộc ---
      let candidates = data;
      if (mustContain?.district || mustContain?.province) {
        const normDistrict = mustContain.district ? this.normalizeVi(mustContain.district) : null;
        const normProvince = mustContain.province ? this.normalizeVi(mustContain.province) : null;

        const filtered = data.filter(r => {
          const normDisplay = this.normalizeVi(r.display_name);
          const districtOk = !normDistrict || normDisplay.includes(normDistrict);
          const provinceOk = !normProvince || normDisplay.includes(normProvince);
          return districtOk && provinceOk;
        });

        console.log(`🔎 After district/province filter: ${filtered.length}/${data.length} results pass`);

        if (filtered.length === 0) {
          // Không có kết quả nào đúng quận/tỉnh → trả null để thử query tiếp theo
          console.warn('⚠️ No results match required district/province, skipping this query');
          return null;
        }
        candidates = filtered;
      }

      // --- Bước 2: chọn kết quả khớp nhiều từ khóa nhất ---
      const originalQuery = decodeURIComponent(address.toLowerCase())
        .replace(/,?\s*vietnam\s*$/i, '')
        .replace(/[,()/]/g, ' ');

      const queryKeywords = this.normalizeVi(originalQuery)
        .split(/\s+/)
        .filter(w => w.length > 2);

      let bestResult = candidates[0];
      let bestScore = -1;

      for (const result of candidates) {
        const normDisplay = this.normalizeVi(result.display_name);
        const matchCount = queryKeywords.filter(kw => normDisplay.includes(kw)).length;
        const score = matchCount + result.importance * 0.05;
        if (score > bestScore) {
          bestScore = score;
          bestResult = result;
        }
      }

      console.log('🎯 Selected result:', bestResult.display_name);

      return {
        latitude: parseFloat(bestResult.lat),
        longitude: parseFloat(bestResult.lon),
        formattedAddress: bestResult.display_name,
        provider: 'nominatim'
      };
    } catch (error) {
      console.error('❌ Nominatim error:', error);
      return null;
    }
  }

  /**
   * FALLBACK: Geocoding sử dụng Google Maps (nếu có API key)
   * @param address - Địa chỉ đầy đủ
   * @returns Tọa độ từ Google Maps
   */
  private async geocodeWithGoogle(address: string): Promise<GeocodingResult | null> {
    if (!this.isGoogleApiKeyConfigured()) {
      return null;
    }

    try {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${this.googleApiKey}&region=VN&language=vi`;
      
      console.log('🗺️  Calling Google Maps API as fallback:', address);
      
      const response = await fetch(url);
      const data: GoogleMapsResponse = await response.json();

      console.log('📍 Google Maps response:', data);

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          formattedAddress: result.formatted_address,
          provider: 'google'
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Google Maps error:', error);
      return null;
    }
  }

  /**
   * MAIN: Geocoding với nhiều provider (Nominatim -> Google -> Approximate)
   * @param address - Địa chỉ đầy đủ
   * @returns Tọa độ latitude và longitude
   */
  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    if (!address || address.trim() === '') {
      throw new Error('Địa chỉ không được để trống');
    }

    try {
      // TRY 1: OpenStreetMap Nominatim (FREE)
      console.log('🚀 Trying Nominatim (OpenStreetMap) first...');
      const nominatimResult = await this.geocodeWithNominatim(address);
      if (nominatimResult) {
        console.log('✅ Success with Nominatim!');
        return nominatimResult;
      }
      
      // TRY 2: Google Maps (fallback if configured)
      if (this.isGoogleApiKeyConfigured()) {
        console.log('⏭️  Nominatim failed, trying Google Maps fallback...');
        const googleResult = await this.geocodeWithGoogle(address);
        if (googleResult) {
          console.log('✅ Success with Google Maps fallback!');
          return googleResult;
        }
      }
      
      // TRY 3: Approximate coordinates từ tên tỉnh
      console.log('⏭️  Both services failed, trying approximate coordinates...');
      const addressParts = address.split(',');
      for (const part of addressParts.reverse()) {
        const trimmedPart = part.trim();
        const approximateResult = this.getApproximateCoordinates(trimmedPart);
        if (approximateResult) {
          console.log('✅ Success with approximate coordinates!');
          return approximateResult;
        }
      }
      
      throw new Error('Không tìm được tọa độ cho địa chỉ này');
    } catch (error) {
      console.error('❌ All geocoding methods failed:', error);
      throw error;
    }
  }

  /**
   * ENHANCED: Geocoding với multi-query strategy (thử nhiều cách tìm kiếm)
   * @param components - Các thành phần địa chỉ riêng biệt 
   * @returns Tọa độ với độ chính xác cao nhất có thể
   */
  async geocodeAddressComponents(components: {
    detailedAddress?: string;
    wardName?: string;
    districtName?: string;
    provinceName?: string;
  }): Promise<GeocodingResult | null> {
    const { detailedAddress, wardName, districtName, provinceName } = components;
    const hasDetailedInput = !!detailedAddress?.trim();

    const combinedAddress = [detailedAddress, wardName, districtName, provinceName]
      .filter(Boolean)
      .join(', ')
      .toLowerCase();

    // Practical fallback for highly common landmarks that users often input like shopping apps.
    if (combinedAddress.includes('vinhomes grand park')) {
      return {
        latitude: 10.8429,
        longitude: 106.8325,
        formattedAddress: 'Vinhomes Grand Park, Long Bình, Thủ Đức, TP. Hồ Chí Minh',
        provider: 'approximate'
      };
    }

    // Prioritize house/building tokens (contains digits) to avoid wrong nearby points.
    const strictKeywords = hasDetailedInput
      ? this.extractKeywords(detailedAddress!)
          .filter((word) => /\d/.test(word) || word.length >= 4)
          .slice(0, 6)
      : [];

    const canonicalize = (value: string): string =>
      this.normalizeVi(value).replace(/[^a-z0-9]/g, '');

    const isStrictMatch = (formattedAddress: string): boolean => {
      if (strictKeywords.length === 0) return true;
      const normalizedDisplay = this.normalizeVi(formattedAddress);
      const canonicalDisplay = canonicalize(formattedAddress);

      const matchedKeywords = strictKeywords.filter((keyword) => {
        const normalizedKeyword = this.normalizeVi(keyword);
        const canonicalKeyword = canonicalize(keyword);
        return (
          normalizedDisplay.includes(normalizedKeyword) ||
          (canonicalKeyword.length > 0 && canonicalDisplay.includes(canonicalKeyword))
        );
      });

      const numericKeywords = strictKeywords.filter((keyword) => /\d/.test(keyword));
      const numericMatched = matchedKeywords.filter((keyword) => /\d/.test(keyword));
      const textKeywords = strictKeywords.filter((keyword) => !/\d/.test(keyword));
      const textMatched = matchedKeywords.filter((keyword) => !/\d/.test(keyword));

      const numericPass = numericKeywords.length === 0 || numericMatched.length >= 1;
      const textPass =
        textKeywords.length === 0 ||
        textMatched.length / textKeywords.length >= 0.6;

      const missingKeywords = strictKeywords.filter((keyword) => !matchedKeywords.includes(keyword));

      if (!numericPass || !textPass) {
        console.warn('⚠️ Reject geocoding result due to missing strict keywords:', {
          formattedAddress,
          strictKeywords,
          matchedKeywords,
          missingKeywords,
        });
        return false;
      }

      return true;
    };

    // Phát hiện địa chỉ chi tiết có tên đường thực sự hay chỉ là số nhà đơn lẻ
    const hasRealStreet = detailedAddress
      ? /[a-zA-ZÀ-ỹ]{3,}/.test(detailedAddress) // có ít nhất 1 từ chữ ~3 ký tự
      : false;

    // --- Ưu tiên Google Maps nếu có API key ---
    if (this.isGoogleApiKeyConfigured()) {
      const fullAddr = [detailedAddress, wardName, districtName, provinceName]
        .filter(Boolean).join(', ') + ', Vietnam';
      const googleResult = await this.geocodeWithGoogle(fullAddr);
      if (googleResult) {
        console.log('✅ Google Maps success!');
        return googleResult;
      }
    }

    // --- Nominatim: thử structured search trước ---
    // 1. Nominatim structured query (chính xác nhất)
    const structuredResult = await this.nominatimStructured({
      street: hasRealStreet ? detailedAddress : undefined,
      suburb: wardName,
      city: districtName,
      state: provinceName,
    });
    if (structuredResult && isStrictMatch(structuredResult.formattedAddress)) {
      console.log('✅ Nominatim structured success!');
      return structuredResult;
    }

    await new Promise(r => setTimeout(r, 400));

    // 2. Free-text: phường + quận + tỉnh (bỏ số nhà nếu không có tên đường)
    const queries: Array<{ q: string; district?: string; province?: string }> = [];

    if (hasRealStreet && wardName && districtName && provinceName) {
      queries.push({ q: `${detailedAddress}, ${wardName}, ${districtName}, ${provinceName}, Vietnam`, district: districtName, province: provinceName });
    }
    if (wardName && districtName && provinceName) {
      queries.push({ q: `${wardName}, ${districtName}, ${provinceName}, Vietnam`, district: districtName, province: provinceName });
    }
    if (hasRealStreet && districtName && provinceName) {
      queries.push({ q: `${detailedAddress}, ${districtName}, ${provinceName}, Vietnam`, district: districtName, province: provinceName });
    }
    if (districtName && provinceName) {
      queries.push({ q: `${districtName}, ${provinceName}, Vietnam`, province: provinceName });
    }
    if (provinceName) {
      queries.push({ q: `${provinceName}, Vietnam` });
    }

    let bestLooseCandidate: GeocodingResult | null = null;

    for (const { q, district, province } of queries) {
      try {
        console.log('🔍 Trying Nominatim free-text:', q);
        const constrainedResult = await this.geocodeWithNominatim(
          q,
          district || province
            ? { district, province }
            : undefined
        );
        if (constrainedResult) {
          if (isStrictMatch(constrainedResult.formattedAddress)) {
            return constrainedResult;
          }

          // Keep first nearby result as a fallback (better than no position).
          if (!bestLooseCandidate) {
            bestLooseCandidate = constrainedResult;
          }
        }

        // Retry without district/province hard filter to avoid false negatives on OSM naming variants.
        if (!constrainedResult && (district || province)) {
          const relaxedResult = await this.geocodeWithNominatim(q);
          if (relaxedResult) {
            const relaxedDisplay = this.normalizeVi(relaxedResult.formattedAddress);
            const provinceOk = !province || relaxedDisplay.includes(this.normalizeVi(province));

            if (provinceOk && isStrictMatch(relaxedResult.formattedAddress)) {
              return relaxedResult;
            }

            if (provinceOk && !bestLooseCandidate) {
              bestLooseCandidate = relaxedResult;
            }
          }
        }
        await new Promise(r => setTimeout(r, 350));
      } catch { /* continue */ }
    }

    if (bestLooseCandidate) {
      console.warn('⚠️ Using nearby fallback geocoding result:', bestLooseCandidate.formattedAddress);
      return bestLooseCandidate;
    }

    // 3. Approximate cuối cùng (only when user did not provide detailed address)
    if (provinceName && !hasDetailedInput) {
      const approx = this.getApproximateCoordinates(provinceName, districtName);
      if (approx) return approx;
    }

    throw new Error('Không tìm thấy tọa độ chính xác cho địa chỉ này. Vui lòng nhập rõ số nhà, đường, phường/xã.');
  }

  /** Nominatim structured search — chính xác hơn free-text */
  private async nominatimStructured(params: {
    street?: string;
    suburb?: string;  // ward
    city?: string;    // district
    state?: string;   // province
  }): Promise<GeocodingResult | null> {
    if (!params.city && !params.state) return null;
    const qs = new URLSearchParams({ format: 'json', limit: '5', countrycodes: 'vn', addressdetails: '1' });
    if (params.street) qs.set('street', params.street);
    if (params.suburb)  qs.set('suburb', params.suburb);
    if (params.city)    qs.set('city', params.city);
    if (params.state)   qs.set('state', params.state);
    qs.set('country', 'Vietnam');

    const url = `https://nominatim.openstreetmap.org/search?${qs.toString()}`;
    console.log('🗺️ Nominatim structured:', url);

    try {
      const data = await this.fetchNominatimJson<NominatimResponse[]>(url);
      if (!Array.isArray(data) || !data.length) return null;
      console.log('📍 Structured results:', data.map(r => r.display_name));

      // Validate phải đúng quận + tỉnh
      const normCity  = params.city  ? this.normalizeVi(params.city)  : null;
      const normState = params.state ? this.normalizeVi(params.state) : null;
      const valid = data.filter(r => {
        const n = this.normalizeVi(r.display_name);
        return (!normCity || n.includes(normCity)) && (!normState || n.includes(normState));
      });

      const best = valid.length ? valid[0] : (normState ? data.find(r => this.normalizeVi(r.display_name).includes(normState!)) : null);
      if (!best) return null;

      return { latitude: parseFloat(best.lat), longitude: parseFloat(best.lon), formattedAddress: best.display_name, provider: 'nominatim' };
    } catch {
      return null;
    }
  }

  /**
   * Shortcut method — only Nominatim
   */
  async geocodeWithNominatimOnly(address: string): Promise<GeocodingResult | null> {
    if (!address || address.trim() === '') throw new Error('Địa chỉ không được để trống');
    return await this.geocodeWithNominatim(address);
  }

  /**
   * Tạo nhiều query variations (kept for geocodeAddress compat)
   */
  private generateSearchQueries(components: {
    detailedAddress?: string;
    wardName?: string;
    districtName?: string;
    provinceName?: string;
  }): string[] {
    const queries: string[] = [];
    
    // Query 1: Địa chỉ đầy đủ (ưu tiên cao nhất - giữ nguyên từ khóa)
    const fullAddress = this.buildFullAddress(components);
    queries.push(fullAddress);
    
    // Query 2: Địa chỉ chi tiết + huyện + tỉnh (bỏ xã để tránh confuse)
    if (components.detailedAddress && components.districtName && components.provinceName) {
      queries.push(`${components.detailedAddress}, ${components.districtName}, ${components.provinceName}, Vietnam`);
    }
    
    // Query 3: Chỉ địa chỉ chi tiết + tỉnh (cho trường hợp địa chỉ nổi tiếng)
    if (components.detailedAddress && components.provinceName) {
      queries.push(`${components.detailedAddress}, ${components.provinceName}, Vietnam`);
    }
    
    // Query 4: Phường/xã + huyện + tỉnh (fallback khi địa chỉ chi tiết không có)
    if (components.wardName && components.districtName && components.provinceName) {
      queries.push(`${components.wardName}, ${components.districtName}, ${components.provinceName}, Vietnam`);
    }
    
    // Query 5: Chỉ huyện + tỉnh  
    if (components.districtName && components.provinceName) {
      queries.push(`${components.districtName}, ${components.provinceName}, Vietnam`);
    }
    
    // Query 6: Chỉ tỉnh (fallback cuối cùng)
    if (components.provinceName) {
      queries.push(`${components.provinceName}, Vietnam`);
    }
    
    console.log('🔍 Generated search queries (priority order):', queries);
    return queries;
  }
  buildFullAddress(components: {
    detailedAddress?: string;
    wardName?: string;
    districtName?: string;
    provinceName?: string;
  }): string {
    const parts: string[] = [];
    
    if (components.detailedAddress) {
      parts.push(components.detailedAddress);
    }
    if (components.wardName) {
      parts.push(components.wardName);
    }
    if (components.districtName) {
      parts.push(components.districtName);
    }
    if (components.provinceName) {
      parts.push(components.provinceName);
    }
    
    // Thêm "Vietnam" để tăng độ chính xác
    parts.push('Vietnam');
    
    return parts.join(', ');
  }

  /**
   * Ước lượng tọa độ dựa trên tên tỉnh/thành (fallback khi không có Google Maps API)
   * Chỉ là ước lượng gần đúng, không chính xác như Google Maps
   */
  getApproximateCoordinates(provinceName: string, districtName?: string): GeocodingResult | null {
    const provinceCoords: { [key: string]: { lat: number, lng: number } } = {
      'Hồ Chí Minh': { lat: 10.8231, lng: 106.6297 },
      'Hà Nội': { lat: 21.0285, lng: 105.8542 },
      'Đà Nẵng': { lat: 16.0544, lng: 108.2022 },
      'Hải Phòng': { lat: 20.8449, lng: 106.6881 },
      'Cần Thơ': { lat: 10.0452, lng: 105.7469 },
      'Lâm Đồng': { lat: 11.5753, lng: 108.1429 },
      'An Giang': { lat: 10.5215, lng: 105.1258 },
      'Bà Rịa - Vũng Tàu': { lat: 10.5417, lng: 107.2429 },
      'Bạc Liêu': { lat: 9.2948, lng: 105.7278 },
      'Bắc Giang': { lat: 21.2731, lng: 106.1946 },
      'Bắc Kạn': { lat: 22.1471, lng: 105.8348 },
      'Bắc Ninh': { lat: 21.1861, lng: 106.0763 },
      'Bến Tre': { lat: 10.2434, lng: 106.3757 },
      'Bình Định': { lat: 13.7765, lng: 109.2216 },
      'Bình Dương': { lat: 11.3254, lng: 106.4772 },
      'Bình Phước': { lat: 11.7511, lng: 106.7234 },
      'Bình Thuận': { lat: 11.0904, lng: 108.0721 },
      'Cà Mau': { lat: 9.1768, lng: 105.1524 },
      'Cao Bằng': { lat: 22.6663, lng: 106.2525 },
      'Đắk Lắk': { lat: 12.7100, lng: 108.2378 },
      'Đắk Nông': { lat: 12.2646, lng: 107.6098 },
      'Điện Biên': { lat: 21.8042, lng: 103.2287 },
      'Đồng Nai': { lat: 11.0686, lng: 107.1676 },
      'Đồng Tháp': { lat: 10.4938, lng: 105.6881 },
      'Gia Lai': { lat: 13.8078, lng: 108.1099 },
      'Hà Giang': { lat: 22.8025, lng: 104.9784 },
      'Hà Nam': { lat: 20.5835, lng: 105.9230 },
      'Hà Tĩnh': { lat: 18.2943, lng: 105.8752 },
      'Hải Dương': { lat: 20.9339, lng: 106.3147 },
      'Hậu Giang': { lat: 9.7571, lng: 105.6412 },
      'Hòa Bình': { lat: 20.6861, lng: 105.3389 },
      'Hưng Yên': { lat: 20.6464, lng: 106.0169 },
      'Khánh Hòa': { lat: 12.2585, lng: 109.0526 },
      'Kiên Giang': { lat: 10.0125, lng: 105.0439 },
      'Kon Tum': { lat: 14.3497, lng: 107.9651 },
      'Lai Châu': { lat: 22.3686, lng: 103.4570 },
      'Long An': { lat: 10.6956, lng: 106.2431 },
      'Nam Định': { lat: 20.4388, lng: 106.1621 },
      'Nghệ An': { lat: 19.2342, lng: 104.9200 },
      'Ninh Bình': { lat: 20.2506, lng: 105.9745 },
      'Ninh Thuận': { lat: 11.6738, lng: 108.8629 },
      'Phú Thọ': { lat: 21.2680, lng: 105.2045 },
      'Phú Yên': { lat: 13.0881, lng: 109.0928 },
      'Quảng Bình': { lat: 17.4648, lng: 106.3921 },
      'Quảng Nam': { lat: 15.5394, lng: 108.0191 },
      'Quảng Ngãi': { lat: 15.1214, lng: 108.8050 },
      'Quảng Ninh': { lat: 21.0064, lng: 107.2925 },
      'Quảng Trị': { lat: 16.7403, lng: 107.1851 },
      'Sóc Trăng': { lat: 9.6003, lng: 105.9739 },
      'Sơn La': { lat: 21.3273, lng: 103.9188 },
      'Tây Ninh': { lat: 11.3100, lng: 106.0950 },
      'Thái Bình': { lat: 20.4463, lng: 106.3365 },
      'Thái Nguyên': { lat: 21.5944, lng: 105.8480 },
      'Thanh Hóa': { lat: 19.8006, lng: 105.7851 },
      'Thừa Thiên Huế': { lat: 16.4637, lng: 107.5909 },
      'Tiền Giang': { lat: 10.4493, lng: 106.3420 },
      'Trà Vinh': { lat: 9.9477, lng: 106.3472 },
      'Tuyên Quang': { lat: 21.7767, lng: 105.2280 },
      'Vĩnh Long': { lat: 10.2397, lng: 105.9571 },
      'Vĩnh Phúc': { lat: 21.3608, lng: 105.6049 },
      'Yên Bái': { lat: 21.7168, lng: 104.8986 }
    };

    // Tìm theo tên chính xác trước
    const exactMatch = provinceCoords[provinceName];
    if (exactMatch) {
      return {
        latitude: exactMatch.lat,
        longitude: exactMatch.lng,
        formattedAddress: `${provinceName}, Vietnam (ước lượng)`,
        provider: 'approximate'
      };
    }

    // Tìm theo tên gần đúng
    const fuzzyMatch = Object.keys(provinceCoords).find(key => 
      key.toLowerCase().includes(provinceName.toLowerCase()) || 
      provinceName.toLowerCase().includes(key.toLowerCase())
    );

    if (fuzzyMatch) {
      const coords = provinceCoords[fuzzyMatch];
      return {
        latitude: coords.lat,
        longitude: coords.lng,
        formattedAddress: `${fuzzyMatch}, Vietnam (ước lượng)`,
        provider: 'approximate'
      };
    }

    return null;
  }

  /**
   * Trích xuất từ khóa quan trọng từ query, loại bỏ stop words
   * Ưu tiên giữ lại số nhà, tên tòa, tên đường cụ thể
   * @param query - Câu query để trích xuất keyword
   * @returns Array các từ khóa đã được filter
   */
  private extractKeywords(query: string): string[] {
    // Danh sách stop words tiếng Việt thường gặp trong địa chỉ
    const stopWords = new Set([
      'phường', 'ward', 'quận', 'district', 'huyện', 'tỉnh', 'province',
      'thành', 'phố', 'city', 'việt', 'nam', 'vietnam', 'xã', 'commune',
      'thị', 'trấn', 'town', 'đường', 'street', 'số', 'number',
      'của', 'và', 'tại', 'ở', 'trong', 'ngoài', 'trên', 'dưới',
      'the', 'and', 'of', 'in', 'at', 'on', 'for', 'to', 'with'
    ]);
    
    // Tách từ bằng dấu cách, phẩy, và các ký tự đặc biệt
    const words = query.toLowerCase()
      .split(/[,\s\-_\.\/\\]+/)
      .map(word => word.trim())
      .filter(word => {
        return word.length > 0 && 
               !stopWords.has(word) &&
               word !== ''; // Loại bỏ chuỗi rỗng
      });
    
    // Ưu tiên giữ lại các từ khóa có chứa số (như S202, Tòa B1, số 123)
    const priorityKeywords = words.filter(word => /\d/.test(word));
    const otherKeywords = words.filter(word => !/\d/.test(word));
    
    // Combine với priority keywords đầu tiên
    const keywords = [...priorityKeywords, ...otherKeywords];
    
    console.log(`🔤 Keywords extracted from "${query}":`, {
      original: words,
      priority: priorityKeywords,
      other: otherKeywords,
      final: keywords
    });
    
    return keywords;
  }

  /**
   * Reverse Geocoding - Chuyển tọa độ thành địa chỉ (optional)
   * @param latitude - Vĩ độ
   * @param longitude - Kinh độ
   * @returns Địa chỉ
   */
  async reverseGeocodeDetails(latitude: number, longitude: number): Promise<ReverseGeocodingAddress | null> {
    try {
      // Try Nominatim first (FREE)
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;

      const data = await this.fetchNominatimJson<any>(nominatimUrl);
      if (data) {
        if (data && data.display_name) {
          const address = (data.address || {}) as Record<string, string | undefined>;

          const provinceName =
            address.state ||
            address.province ||
            address.region ||
            address.city;

          const districtName =
            address.city_district ||
            address.county ||
            address.state_district ||
            address.city ||
            address.town ||
            address.municipality;

          const wardName =
            address.suburb ||
            address.quarter ||
            address.neighbourhood ||
            address.city_block ||
            address.village;

          const detailedParts = [address.house_number, address.road, address.hamlet]
            .filter(Boolean)
            .map((part) => String(part));

          const firstDisplaySegment = String(data.display_name)
            .split(',')
            .map((segment: string) => segment.trim())
            .find((segment: string) => segment.length > 0);

          return {
            formattedAddress: data.display_name,
            provinceName,
            districtName,
            wardName,
            detailedAddress: detailedParts.join(', ') || firstDisplaySegment,
          };
        }
      }

      // Fallback provider with liberal CORS policy.
      const bigDataUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`;
      const bigDataResponse = await fetch(bigDataUrl);
      if (bigDataResponse.ok) {
        const bigData = await bigDataResponse.json();
        const localityParts = [
          bigData.locality,
          bigData.city || bigData.principalSubdivision,
          bigData.principalSubdivision,
          bigData.countryName,
        ].filter(Boolean);

        if (localityParts.length > 0) {
          return {
            formattedAddress: localityParts.join(', '),
            provinceName: bigData.principalSubdivision,
            districtName: bigData.city || bigData.locality,
            wardName: bigData.locality,
            detailedAddress: bigData.locality,
          };
        }
      }
      
      // Fallback to Google Maps if configured
      if (this.isGoogleApiKeyConfigured()) {
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.googleApiKey}&region=VN&language=vi`;
        
        const googleResponse = await fetch(googleUrl);
        const googleData: GoogleMapsResponse = await googleResponse.json();

        if (googleData.status === 'OK' && googleData.results.length > 0) {
          return {
            formattedAddress: googleData.results[0].formatted_address,
            detailedAddress: googleData.results[0].formatted_address.split(',')[0]?.trim(),
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error in reverseGeocodeDetails:', error);
      return null;
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    const details = await this.reverseGeocodeDetails(latitude, longitude);
    return details?.formattedAddress || null;
  }

  async suggestAddresses(query: string, districtName?: string, provinceName?: string): Promise<AddressSuggestion[]> {
    const keyword = query.trim();
    if (!keyword || keyword.length < 3) return [];

    try {
      const cacheKey = `${keyword.toLowerCase()}|${(districtName || '').toLowerCase()}|${(provinceName || '').toLowerCase()}`;
      const cached = this.suggestionCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.items;
      }

      const composedQuery = [keyword, districtName, provinceName, 'Vietnam']
        .filter(Boolean)
        .join(', ');

      const encodedAddress = encodeURIComponent(composedQuery);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=6&countrycodes=vn&addressdetails=1`;

      const data = await this.fetchNominatimJson<NominatimResponse[]>(url);
      if (!Array.isArray(data)) {
        return [];
      }

      const items = data.map((item) => ({
        displayName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));

      this.suggestionCache.set(cacheKey, {
        expiresAt: Date.now() + 30 * 1000,
        items,
      });

      return items;
    } catch (error) {
      console.error('❌ Error in suggestAddresses:', error);
      return [];
    }
  }
}

// Export singleton instance
export const geocodingService = new GeocodingService();

// Backward compatibility
export const googleMapsService = geocodingService;

// Export class for testing
export { GeocodingService, GeocodingService as GoogleMapsService };