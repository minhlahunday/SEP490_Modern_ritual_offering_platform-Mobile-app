// Vietnam Address API Service
// Using free API: https://provinces.open-api.vn/api/

export interface Province {
  code: number;
  name: string;
  name_en: string;
  full_name: string;
  full_name_en: string;
  code_name: string;
}

export interface District {
  code: number;
  name: string;
  name_en: string;
  full_name: string;
  full_name_en: string;
  code_name: string;
  province_code: number;
}

export interface Ward {
  code: number;
  name: string;
  name_en: string;
  full_name: string;
  full_name_en: string;
  code_name: string;
  district_code: number;
}

export interface ProvinceWithDistricts extends Province {
  districts: District[];
}

export interface DistrictWithWards extends District {
  wards: Ward[];
}

const BASE_URL = 'https://provinces.open-api.vn/api';

// Cache để lưu dữ liệu đã lấy (tránh gọi API nhiều lần)
const cache = {
  provinces: null as Province[] | null,
  districts: new Map<number, District[]>(),
  wards: new Map<number, Ward[]>(),
};

/**
 * Lấy danh sách tất cả tỉnh/thành phố
 */
export const getProvinces = async (): Promise<Province[]> => {
  if (cache.provinces) {
    return cache.provinces;
  }

  try {
    const response = await fetch(`${BASE_URL}/p/`);
    if (!response.ok) {
      throw new Error('Failed to fetch provinces');
    }
    const data = await response.json();
    cache.provinces = data;
    return data;
  } catch (error) {
    console.error('Error fetching provinces:', error);
    throw error;
  }
};

/**
 * Lấy chi tiết tỉnh/thành phố kèm danh sách quận/huyện
 */
export const getProvinceWithDistricts = async (provinceCode: number): Promise<ProvinceWithDistricts> => {
  try {
    const response = await fetch(`${BASE_URL}/p/${provinceCode}?depth=2`);
    if (!response.ok) {
      throw new Error('Failed to fetch province with districts');
    }
    const data = await response.json();
    // Cache districts
    cache.districts.set(provinceCode, data.districts);
    return data;
  } catch (error) {
    console.error('Error fetching province with districts:', error);
    throw error;
  }
};

/**
 * Lấy danh sách quận/huyện theo tỉnh/thành phố
 */
export const getDistrictsByProvince = async (provinceCode: number): Promise<District[]> => {
  // Check cache first
  if (cache.districts.has(provinceCode)) {
    return cache.districts.get(provinceCode)!;
  }

  try {
    const data = await getProvinceWithDistricts(provinceCode);
    return data.districts;
  } catch (error) {
    console.error('Error fetching districts:', error);
    throw error;
  }
};

/**
 * Lấy chi tiết quận/huyện kèm danh sách phường/xã
 */
export const getDistrictWithWards = async (districtCode: number): Promise<DistrictWithWards> => {
  try {
    const response = await fetch(`${BASE_URL}/d/${districtCode}?depth=2`);
    if (!response.ok) {
      throw new Error('Failed to fetch district with wards');
    }
    const data = await response.json();
    // Cache wards
    cache.wards.set(districtCode, data.wards);
    return data;
  } catch (error) {
    console.error('Error fetching district with wards:', error);
    throw error;
  }
};

/**
 * Lấy danh sách phường/xã theo quận/huyện
 */
export const getWardsByDistrict = async (districtCode: number): Promise<Ward[]> => {
  // Check cache first
  if (cache.wards.has(districtCode)) {
    return cache.wards.get(districtCode)!;
  }

  try {
    const data = await getDistrictWithWards(districtCode);
    return data.wards;
  } catch (error) {
    console.error('Error fetching wards:', error);
    throw error;
  }
};

/**
 * Tìm kiếm tỉnh/thành phố theo tên
 */
export const searchProvinces = async (query: string): Promise<Province[]> => {
  const provinces = await getProvinces();
  const lowerQuery = query.toLowerCase();
  return provinces.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.full_name.toLowerCase().includes(lowerQuery) ||
      p.code_name.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Tìm kiếm quận/huyện theo tên trong một tỉnh
 */
export const searchDistricts = async (provinceCode: number, query: string): Promise<District[]> => {
  const districts = await getDistrictsByProvince(provinceCode);
  const lowerQuery = query.toLowerCase();
  return districts.filter(
    (d) =>
      d.name.toLowerCase().includes(lowerQuery) ||
      d.full_name.toLowerCase().includes(lowerQuery) ||
      d.code_name.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Tìm kiếm phường/xã theo tên trong một quận/huyện
 */
export const searchWards = async (districtCode: number, query: string): Promise<Ward[]> => {
  const wards = await getWardsByDistrict(districtCode);
  const lowerQuery = query.toLowerCase();
  return wards.filter(
    (w) =>
      w.name.toLowerCase().includes(lowerQuery) ||
      w.full_name.toLowerCase().includes(lowerQuery) ||
      w.code_name.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Clear cache (dùng khi cần refresh data)
 */
export const clearCache = () => {
  cache.provinces = null;
  cache.districts.clear();
  cache.wards.clear();
};
