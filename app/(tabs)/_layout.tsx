import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Hop as Home, Compass, User, Bell, ShoppingCart } from 'lucide-react-native';

function HeaderRight() {
  return (
    <View style={styles.headerRightContainer}>
      <TouchableOpacity style={styles.iconButton}>
        <Bell size={22} color="#1f2937" />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>3</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconButton}>
        <ShoppingCart size={22} color="#1f2937" />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>1</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function HeaderLeft() {
  return (
    <View style={styles.headerLeftContainer}>
      <Text style={styles.brandTitle}>VIET RITUAL</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerLeft: () => <HeaderLeft />,
        headerRight: () => <HeaderRight />,
        headerTitle: '',
        tabBarActiveTintColor: '#000', // black
        tabBarInactiveTintColor: '#94a3b8', // slate-400
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9', // slate-100
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Khám phá',
          tabBarIcon: ({ color, size }) => (
            <Compass color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    gap: 16,
  },
  headerLeftContainer: {
    paddingLeft: 20,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#b45309', // amber-700
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  iconButton: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#ef4444', // red-500
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
