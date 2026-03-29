import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Bell, Search, TrendingUp } from 'lucide-react-native';

export default function HomeTab() {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Xin chào!</Text>
            <Text style={styles.subtitle}>Chào mừng bạn trở lại</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Search color="#333" size={24} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Bell color="#333" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <TrendingUp color="#007AFF" size={32} />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Hoạt động</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp color="#34C759" size={32} />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Đã hoàn thành</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nội dung nổi bật</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chào mừng đến với ứng dụng</Text>
            <Text style={styles.cardDescription}>
              Đây là khung ứng dụng mobile của bạn. Bạn có thể tùy chỉnh và
              thêm các tính năng theo ý muốn.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bắt đầu phát triển</Text>
            <Text style={styles.cardDescription}>
              Sử dụng các tab bên dưới để điều hướng giữa các màn hình khác
              nhau trong ứng dụng.
            </Text>
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginTop: 12,
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 22,
  },
});
