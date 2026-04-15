import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, TextInput, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { ChevronDown, Search, X } from 'lucide-react-native';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectModalProps {
  label: string;
  placeholder?: string;
  value: string | number | null;
  options: SelectOption[];
  onSelect: (value: string | number) => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function SelectModal({ label, placeholder = 'Chọn...', value, options, onSelect, disabled = false, loading = false }: SelectModalProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLabel = options.find((opt) => opt.value === value)?.label;

  const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      
      <TouchableOpacity 
        style={[styles.selector, disabled && styles.disabled]} 
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#c2410c" />
        ) : (
          <Text style={[styles.selectedText, !selectedLabel && styles.placeholder]}>
            {selectedLabel || placeholder}
          </Text>
        )}
        <ChevronDown color="#9ca3af" size={20} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Chọn mục'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X color="#374151" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Search color="#9ca3af" size={20} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm..."
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.optionItem, value === item.value && styles.selectedOption]}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                    setSearch('');
                  }}
                >
                  <Text style={[styles.optionText, value === item.value && styles.selectedOptionText]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Không tìm thấy kết quả</Text>
              }
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  selectedText: {
    fontSize: 16,
    color: '#111827',
  },
  placeholder: {
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  optionItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedOption: {
    backgroundColor: '#f8fafc',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
  },
  selectedOptionText: {
    color: '#000',
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#6b7280',
    fontStyle: 'italic',
  }
});
