"use client";

import { formatDateTimeVN } from "@/lib/date";
// This component is loaded ONLY client-side (ssr: false in SfaClient.tsx)
// Leaflet requires window/document, so never import directly in SSR context.

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { CustomerPin } from "./SfaClient";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icon paths broken by webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const visitIcon = new L.Icon({
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize:    [20, 32],
  iconAnchor:  [10, 32],
  popupAnchor: [1, -28],
  className:   "hue-rotate-[120deg]", // green tint for visit markers
});

export interface MapVisit {
  id: string;
  customer_id: string | null;
  customer_name: string;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkin_at: string;
  note: string | null;
}

export default function SfaMap({ customers, visits }: { customers: CustomerPin[]; visits: MapVisit[] }) {
  // Default center: Ho Chi Minh City
  const center: [number, number] = customers.length > 0 && customers[0].latitude
    ? [customers[0].latitude, customers[0].longitude!]
    : [10.7769, 106.7009];

  // Build a set of customers that have recent visits (last 7 days)
  const recentVisitCustomerIds = new Set(
    visits
      .filter(v => v.checkin_lat != null && new Date(v.checkin_at).getTime() > Date.now() - 7 * 86400_000)
      .map(v => v.customer_id)
  );

  return (
    <MapContainer
      center={center}
      zoom={customers.length > 0 ? 12 : 11}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Customer pins */}
      {customers.map(c => (
        c.latitude != null && c.longitude != null ? (
          <Marker key={c.id} position={[c.latitude, c.longitude]}>
            <Popup>
              <strong>{c.name}</strong><br />
              {c.phone ?? ""}<br />
              {recentVisitCustomerIds.has(c.id)
                ? <span style={{ color: "green", fontSize: 11 }}>✓ Đã thăm gần đây</span>
                : <span style={{ color: "#aaa", fontSize: 11 }}>Chưa thăm gần đây</span>}
            </Popup>
          </Marker>
        ) : null
      ))}

      {/* Visit check-in pins */}
      {visits
        .filter(v => v.checkin_lat != null && v.checkin_lng != null)
        .map(v => (
          <Marker key={`visit-${v.id}`} position={[v.checkin_lat!, v.checkin_lng!]} icon={visitIcon}>
            <Popup>
              📍 <strong>Check-in: {v.customer_name}</strong><br />
              {formatDateTimeVN(v.checkin_at)}<br />
              {v.note ? <em>{v.note}</em> : ""}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
