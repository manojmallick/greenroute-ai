import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon paths with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const VEHICLE_ICONS = {
  diesel_van: '🚐', petrol_van: '🚙', electric_van: '⚡',
  cargo_bike: '🚲', hybrid_van: '🌿', diesel_truck: '🚛',
};

const ROUTE_COLORS = [
  '#10b981', '#60a5fa', '#f59e0b', '#a78bfa',
  '#34d399', '#f87171', '#38bdf8', '#fbbf24',
];

const CITY_BOUNDS = {
  ams: { north: 52.4262, south: 52.2645, east: 5.0913, west: 4.7319 },
  ber: { north: 52.6755, south: 52.3384, east: 13.7661, west: 13.0885 },
  lon: { north: 51.7321, south: 51.2671, east: 0.3524, west: -0.4897 },
};

export default function LiveMap({ vehicles, routes, selectedVehicleId, selectedCity, onVehicleClick, onSegmentClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const featureGroupsRef = useRef({}); // vehicleId -> L.FeatureGroup (segments)
  
  // Initialise map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [52.3731, 4.9003],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Pan/zoom map when city changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCity || !CITY_BOUNDS[selectedCity]) return;

    const bounds = CITY_BOUNDS[selectedCity];
    const leafletBounds = L.latLngBounds(
      [bounds.south, bounds.west],
      [bounds.north, bounds.east]
    );
    map.fitBounds(leafletBounds, { padding: [50, 50] });
  }, [selectedCity]);

  // Sync vehicle markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ids = new Set(vehicles.map((v) => v.id));

    // Remove stale markers
    for (const id of Object.keys(markersRef.current)) {
      if (!ids.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    }

    vehicles.forEach((vehicle, i) => {
      const isSelected = vehicle.id === selectedVehicleId;
      const icon = VEHICLE_ICONS[vehicle.type] ?? '🚐';
      const borderColor = isSelected ? '#34d399' : ROUTE_COLORS[i % ROUTE_COLORS.length];
      const shadow = isSelected
        ? 'box-shadow:0 0 0 2px #34d399,0 0 16px rgba(52,211,153,0.6);'
        : '';

      const divIcon = L.divIcon({
        className: '',
        html: `<div class="vehicle-marker-icon" style="border-color:${borderColor};${shadow}">${icon}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      if (markersRef.current[vehicle.id]) {
        markersRef.current[vehicle.id]
          .setLatLng([vehicle.lat, vehicle.lon])
          .setIcon(divIcon);
      } else {
        const marker = L.marker([vehicle.lat, vehicle.lon], { icon: divIcon })
          .addTo(map)
          .bindTooltip(
            `<strong>${vehicle.id}</strong><br>${vehicle.type.replace('_', ' ')}`,
            { direction: 'top', offset: [0, -10] }
          );
        marker.on('click', () => onVehicleClick?.(vehicle.id));
        markersRef.current[vehicle.id] = marker;
      }
    });
  }, [vehicles, selectedVehicleId, onVehicleClick]);

  // Sync route segments
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const routeIds = new Set(Object.keys(routes));

    // Remove stale feature groups
    for (const id of Object.keys(featureGroupsRef.current)) {
      if (!routeIds.has(id)) {
        featureGroupsRef.current[id].remove();
        delete featureGroupsRef.current[id];
      }
    }

    Object.entries(routes).forEach(([vehicleId, route], i) => {
      if (!route.stops || route.stops.length < 2) return;
      
      const isSelected = vehicleId === selectedVehicleId;
      const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
      
      // Clear existing group or create new one
      if (featureGroupsRef.current[vehicleId]) {
        featureGroupsRef.current[vehicleId].clearLayers();
      } else {
        featureGroupsRef.current[vehicleId] = L.featureGroup().addTo(map);
      }
      
      const group = featureGroupsRef.current[vehicleId];

      // Create interactive segments
      for (let j = 0; j < route.stops.length - 1; j++) {
        const start = route.stops[j];
        const end = route.stops[j+1];
        const segmentKey = `${start.id}→${end.id}`;

        const segment = L.polyline([[start.lat, start.lon], [end.lat, end.lon]], {
          color,
          weight: isSelected ? 4 : 2.5,
          opacity: isSelected ? 0.95 : 0.4,
          dashArray: isSelected ? '' : '6 4',
          interactive: true,
          cursor: 'pointer',
        }).addTo(group);

        segment.on('mouseover', (e) => {
          if (!isSelected) e.target.setStyle({ weight: 5, opacity: 0.8 });
        });
        segment.on('mouseout', (e) => {
          if (!isSelected) e.target.setStyle({ weight: 2.5, opacity: 0.4 });
        });

        segment.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSegmentClick?.(segmentKey);
          
          // Visual feedback for "breaking" the segment
          segment.setStyle({ color: '#ef4444', weight: 8, dashArray: '' });
          setTimeout(() => {
            if (featureGroupsRef.current[vehicleId]) {
              segment.setStyle({ color, weight: isSelected ? 4 : 2.5 });
            }
          }, 2000);
        });

        segment.bindTooltip(`Segment: ${segmentKey}<br/>Click to simulate traffic spike`, { sticky: true });
      }
    });
  }, [routes, selectedVehicleId, onSegmentClick]);

  // Fly to selected vehicle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVehicleId) return;
    const v = vehicles.find((x) => x.id === selectedVehicleId);
    if (v) map.flyTo([v.lat, v.lon], 15, { duration: 1.2 });
  }, [selectedVehicleId]); // eslint-disable-line

  const routedCount = Object.keys(routes).length;

  return (
    <div className="map-area">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <div className="map-overlay-tl">
        <div className="map-badge">📍 Amsterdam, NL</div>
        <div className="map-badge">{vehicles.length} vehicles active</div>
        {routedCount > 0 && (
          <div className="map-badge" style={{ color: 'var(--color-green-400)' }}>
            ✓ {routedCount} routes optimized
          </div>
        )}
      </div>
    </div>
  );
}
