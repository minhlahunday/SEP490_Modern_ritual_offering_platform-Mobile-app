import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Search, ListFilter as Filter, MapPin, Star } from 'lucide-react-native';

const categories = [
  { id: 1, name: 'Tất cả', icon: '🌟' },
  { id: 2, name: 'Công nghệ', icon: '💻' },
  { id: 3, name: 'Du lịch', icon: '✈️' },
  { id: 4, name: 'Ẩm thực', icon: '🍕' },
  { id: 5, name: 'Thể thao', icon: '⚽' },
];

const items = [
  {
    id: 1,
    title: 'Khám phá công nghệ mới',
    location: 'Hà Nội, Việt Nam',
    rating: 4.8,
  },
  {
    id: 2,
    title: 'Trải nghiệm ẩm thực đường phố',
    location: 'TP. Hồ Chí Minh',
    rating: 4.9,
  },
  {
    id: 3,
    title: 'Tour du lịch cuối tuần',
    location: 'Đà Nẵng',
    rating: 4.7,
  },
];

export default function ExploreTab() {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search color="#8E8E93" size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm..."
              placeholderTextColor="#8E8E93"
            />
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Filter color="#007AFF" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danh mục</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}>
            {categories.map((category) => (
              <TouchableOpacity key={category.id} style={styles.categoryChip}>
                <Text style={styles.categoryEmoji}>{category.icon}</Text>
                <Text style={styles.categoryText}>{category.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phổ biến</Text>
          {items.map((item) => (
            <TouchableOpacity key={item.id} style={styles.itemCard}>
              <View style={styles.itemImage}>
                <Text style={styles.imagePlaceholder}>📷</Text>
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <View style={styles.itemMeta}>
                  <MapPin color="#8E8E93" size={16} />
                  <Text style={styles.itemLocation}>{item.location}</Text>
                </View>
                <View style={styles.itemRating}>
                  <Star color="#FFD700" size={16} fill="#FFD700" />
                  <Text style={styles.ratingText}>{item.rating}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  scrollView: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  categoriesScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    gap: 6,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    fontSize: 32,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemLocation: {
    fontSize: 14,
    color: '#8E8E93',
  },
  itemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
});
