import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import Constants from 'expo-constants'

const Tab = createBottomTabNavigator()

const webUrl =
  (Constants.expoConfig?.extra?.webUrl as string) || 'http://localhost:5173'
const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string) || 'http://localhost:3000'

function MapTab() {
  return <WebView source={{ uri: webUrl }} startInLoadingState style={{ flex: 1 }} />
}

function TourTab() {
  const [items, setItems] = useState<{ id: string; name: string; province?: { name?: string } }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${apiUrl}/api/v1/destinations?limit=20&page=1`)
      .then((r) => r.json())
      .then((body) => setItems(body.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.sub}>{item.province?.name ?? ''}</Text>
        </View>
      )}
    />
  )
}

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <NavigationContainer>
        <Tab.Navigator>
          <Tab.Screen name="Harita" component={MapTab} />
          <Tab.Screen name="Keşfet" component={TourTab} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, gap: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  title: { fontWeight: '600', fontSize: 16 },
  sub: { color: '#64748b', marginTop: 4 },
})
