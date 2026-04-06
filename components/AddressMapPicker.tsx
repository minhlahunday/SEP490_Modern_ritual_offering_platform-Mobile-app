import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

interface AddressMapPickerProps {
  position: { latitude: number; longitude: number };
  onPositionChange: (position: { latitude: number; longitude: number }) => void;
  height?: number;
}

const DEFAULT_HEIGHT = 260;

export default function AddressMapPicker({
  position,
  onPositionChange,
  height = DEFAULT_HEIGHT,
}: AddressMapPickerProps) {
  const html = useMemo(() => {
    const safeLat = Number.isFinite(position.latitude) ? position.latitude : 10.8231;
    const safeLng = Number.isFinite(position.longitude) ? position.longitude : 106.6297;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossorigin=""
  />
  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #f3f4f6;
    }
    .leaflet-control-attribution {
      font-size: 10px !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
    crossorigin=""
  ></script>
  <script>
    (function () {
      const initial = { lat: ${safeLat}, lng: ${safeLng} };
      const map = L.map('map', { zoomControl: true }).setView([initial.lat, initial.lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const marker = L.marker([initial.lat, initial.lng], { draggable: true }).addTo(map);

      function emitPosition(lat, lng) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'position',
            latitude: lat,
            longitude: lng
          }));
        }
      }

      map.on('click', function (e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        marker.setLatLng([lat, lng]);
        emitPosition(lat, lng);
      });

      marker.on('dragend', function () {
        const next = marker.getLatLng();
        emitPosition(next.lat, next.lng);
      });

      emitPosition(initial.lat, initial.lng);
    })();
  </script>
</body>
</html>`;
  }, [position.latitude, position.longitude]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (
        payload?.type === 'position' &&
        typeof payload.latitude === 'number' &&
        typeof payload.longitude === 'number'
      ) {
        onPositionChange({ latitude: payload.latitude, longitude: payload.longitude });
      }
    } catch {
      // Ignore malformed WebView messages.
    }
  };

  return (
    <View style={[styles.container, { height }]}> 
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
