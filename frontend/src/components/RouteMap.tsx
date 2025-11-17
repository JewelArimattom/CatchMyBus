import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { BusResult } from '../types';
import { useEffect, useState } from 'react';
import { Bus as BusIcon } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Avoid mutating Leaflet's prototype (can cause runtime issues in some bundlers/runtime).
// Instead, pass `icon={DefaultIcon}` explicitly to each Marker rendered below.

interface RouteMapProps {
  from: string;
  to: string;
  results: BusResult[];
}

// Default Kerala center coordinates
const KERALA_CENTER = { lat: 10.8505, lng: 76.2711 };

// Mock geocoding - uses OpenStreetMap data for common Kerala locations
const geocodeLocation = async (location: string): Promise<{ lat: number; lng: number } | null> => {
  // Expanded coordinates for Kerala locations (from OpenStreetMap)
  const mockLocations: Record<string, { lat: number; lng: number }> = {
    // Major cities
    thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
    trivandrum: { lat: 8.5241, lng: 76.9366 },
    kochi: { lat: 9.9312, lng: 76.2673 },
    cochin: { lat: 9.9312, lng: 76.2673 },
    kozhikode: { lat: 11.2588, lng: 75.7804 },
    calicut: { lat: 11.2588, lng: 75.7804 },
    thrissur: { lat: 10.5276, lng: 76.2144 },
    kannur: { lat: 11.8745, lng: 75.3704 },
    kollam: { lat: 8.8932, lng: 76.6141 },
    palakkad: { lat: 10.7867, lng: 76.6548 },
    alappuzha: { lat: 9.4981, lng: 76.3388 },
    alleppey: { lat: 9.4981, lng: 76.3388 },
    malappuram: { lat: 11.0510, lng: 76.0711 },
    kottayam: { lat: 9.5916, lng: 76.5222 },
    
    // Central Kerala towns
    pala: { lat: 9.7074, lng: 76.6817 },
    erattupetta: { lat: 9.6878, lng: 76.7783 },
    ettumanoor: { lat: 9.6878, lng: 76.7783 },
    pravithanam: { lat: 9.6950, lng: 76.7100 },
    pramadom: { lat: 9.6950, lng: 76.7100 },
    vezhangaga: { lat: 9.6800, lng: 76.7500 },
    ponkunnam: { lat: 9.5656, lng: 76.7700 },
    changanassery: { lat: 9.4461, lng: 76.5458 },
    tiruvalla: { lat: 9.3833, lng: 76.5745 },
    
    // North Kerala
    thalassery: { lat: 11.7489, lng: 75.4899 },
    kasaragod: { lat: 12.4996, lng: 74.9869 },
    wayanad: { lat: 11.6854, lng: 76.1320 },
    sulthan: { lat: 11.6854, lng: 76.1320 },
    
    // South Kerala
    attingal: { lat: 8.6958, lng: 76.8164 },
    varkala: { lat: 8.7379, lng: 76.7163 },
    neyyattinkara: { lat: 8.4001, lng: 77.0882 },
    
    // Additional important locations
    perumbavoor: { lat: 10.1167, lng: 76.4833 },
    muvattupuzha: { lat: 9.9797, lng: 76.5772 },
    kothamangalam: { lat: 10.0572, lng: 76.6358 },
    angamaly: { lat: 10.1914, lng: 76.3878 },
    aluva: { lat: 10.1081, lng: 76.3528 },
  };

  const normalized = location.toLowerCase().trim();
  return mockLocations[normalized] || null;
};

const RouteMap = ({ from, to, results }: RouteMapProps) => {
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);

  useEffect(() => {
    const loadCoordinates = async () => {
      const fromLoc = await geocodeLocation(from);
      const toLoc = await geocodeLocation(to);
      
      setFromCoords(fromLoc || { lat: KERALA_CENTER.lat - 0.5, lng: KERALA_CENTER.lng });
      setToCoords(toLoc || { lat: KERALA_CENTER.lat + 0.5, lng: KERALA_CENTER.lng });

      // Build route points from first result if available
      if (results.length > 0 && results[0].bus.route) {
        const points: { lat: number; lng: number }[] = [];
        // Cast each stop to `any` to avoid strict typing issues when stop entries have mixed shapes
        for (const stopRaw of results[0].bus.route as any[]) {
          const stop: any = stopRaw;
          const stopName = typeof stop === 'string' ? stop : (stop?.name || stop?.stopName || stop?.stop || '');
          const coords = await geocodeLocation(stopName);
          if (coords) {
            points.push(coords);
          }
        }
        setRoutePoints(points);
      }
    };

    loadCoordinates();
  }, [from, to, results]);

  if (!fromCoords || !toCoords) {
    return (
      <div className="card p-0 overflow-hidden">
        <div className="p-4 bg-primary-600 text-white">
          <h3 className="font-semibold">Route Map</h3>
          <p className="text-sm opacity-90">{from} to {to}</p>
        </div>
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <BusIcon className="h-12 w-12 text-gray-400 mx-auto mb-2 animate-pulse" />
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  const center: [number, number] = [
    (fromCoords.lat + toCoords.lat) / 2,
    (fromCoords.lng + toCoords.lng) / 2,
  ];

  return (
    <div className="card p-0 overflow-hidden animate-slide-up">
      <div className="p-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <h3 className="font-semibold flex items-center">
          <BusIcon className="h-5 w-5 mr-2" />
          Route Map
        </h3>
        <p className="text-sm opacity-90">{from} → {to}</p>
        {results.length > 0 && (
          <p className="text-xs opacity-80 mt-1">
            Showing route for {results[0].bus.busName} ({results[0].bus.busNumber})
          </p>
        )}
      </div>
      <div style={{ height: '500px', width: '100%' }}>
        <MapContainer
          center={center}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* From Marker */}
          <Marker position={[fromCoords.lat, fromCoords.lng]} icon={DefaultIcon}>
            <Popup>
              <div className="text-center">
                <strong className="text-green-600">🚏 {from}</strong><br />
                <span className="text-sm">Starting Point</span>
              </div>
            </Popup>
          </Marker>

          {/* To Marker */}
          <Marker position={[toCoords.lat, toCoords.lng]} icon={DefaultIcon}>
            <Popup>
              <div className="text-center">
                <strong className="text-red-600">🚏 {to}</strong><br />
                <span className="text-sm">Destination</span>
              </div>
            </Popup>
          </Marker>

          {/* Route Polyline */}
          {routePoints.length > 0 ? (
            <Polyline
              positions={routePoints.map(p => [p.lat, p.lng])}
              color="#3b82f6"
              weight={4}
              opacity={0.8}
              dashArray="10, 5"
            />
          ) : (
            <Polyline
              positions={[
                [fromCoords.lat, fromCoords.lng],
                [toCoords.lat, toCoords.lng],
              ]}
              color="#3b82f6"
              weight={4}
              opacity={0.7}
            />
          )}

          {/* Intermediate stops */}
          {routePoints.map((point, idx) => (
            <Marker
              key={idx}
              position={[point.lat, point.lng]}
              icon={L.divIcon({
                className: 'custom-marker',
                html: `<div style="background: white; border: 2px solid #3b82f6; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">${idx + 1}</div>`,
                iconSize: [20, 20],
              })}
            >
              <Popup>
                <strong>Stop {idx + 1}</strong>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default RouteMap;
