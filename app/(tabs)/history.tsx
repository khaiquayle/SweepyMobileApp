import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

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
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    padding: 24,
    paddingTop: 80,
  },
  header: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 32,
    color: '#1D1D1F',
    letterSpacing: -0.5,
  },
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

