import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ScanResult = {
  id: string;
  material: string;
  timestamp: string;
};

export default function HistoryScreen() {
  const [scans] = useState<ScanResult[]>([
    { id: '1', material: 'Plastic', timestamp: '2024-01-15 14:30' },
    { id: '2', material: 'Glass', timestamp: '2024-01-15 14:25' },
    { id: '3', material: 'Metal', timestamp: '2024-01-15 14:20' },
  ]);

  const renderItem = ({ item }: { item: ScanResult }) => (
    <View style={styles.card}>
      <Text style={styles.material}>{item.material}</Text>
      <Text style={styles.timestamp}>{item.timestamp}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.brandHeader}>
        <View style={styles.brandIcon}><Ionicons name="leaf" size={18} color="#16a34a" /></View>
        <Text style={styles.brandTitle}>Sweepy</Text>
      </View>
      <Text style={styles.subheader}>Smart Recycling Classification</Text>
      <Text style={styles.header}>Scan History</Text>
      <FlatList
        data={scans}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No scans yet. Start scanning to see your history!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 24, paddingTop: 64 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  brandIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EAF8EE', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  brandTitle: { fontSize: 22, fontWeight: '700', color: '#10b981' },
  subheader: { fontSize: 16, fontWeight: '500', color: '#6b7280', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 20, color: '#111827' },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  material: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 14,
    color: '#86868B',
  },
  empty: {
    fontSize: 16,
    color: '#86868B',
    textAlign: 'center',
    marginTop: 48,
  },
});

