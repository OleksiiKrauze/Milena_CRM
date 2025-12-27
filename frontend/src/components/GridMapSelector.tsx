/// <reference types="@types/google.maps" />
import { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, type MapMouseEvent } from '@vis.gl/react-google-maps';

interface GridMapSelectorProps {
  centerLat: number | null;
  centerLon: number | null;
  onLocationSelect: (lat: number, lon: number) => void;
  cols: number | null;
  rows: number | null;
  cellSize: number | null;
}

// Use a placeholder API key for development
// In production, this should come from environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY';

// Component to draw grid overlay on the map
function GridOverlay({
  centerLat,
  centerLon,
  cols,
  rows,
  cellSize
}: {
  centerLat: number;
  centerLon: number;
  cols: number;
  rows: number;
  cellSize: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const polygons: google.maps.Polygon[] = [];

    // Approximate degrees per meter (at moderate latitudes)
    const metersPerDegree = 111320;
    const gridWidth = cols * cellSize;
    const gridHeight = rows * cellSize;

    // Calculate grid bounds
    // For latitude (north-south): 1 degree ≈ 111km everywhere
    // For longitude (west-east): 1 degree = 111km * cos(latitude)
    const halfHeightDeg = (gridHeight / 2) / metersPerDegree;
    const halfWidthDeg = (gridWidth / 2) / (metersPerDegree * Math.cos(centerLat * Math.PI / 180));

    const startLat = centerLat - halfHeightDeg;
    const startLon = centerLon - halfWidthDeg;

    const cellHeightDeg = cellSize / metersPerDegree;
    const cellWidthDeg = cellSize / (metersPerDegree * Math.cos(centerLat * Math.PI / 180));

    // Draw each cell
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const south = startLat + (row * cellHeightDeg);
        const north = south + cellHeightDeg;
        const west = startLon + (col * cellWidthDeg);
        const east = west + cellWidthDeg;

        const polygon = new google.maps.Polygon({
          paths: [
            { lat: north, lng: west },
            { lat: north, lng: east },
            { lat: south, lng: east },
            { lat: south, lng: west },
          ],
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#FF0000',
          fillOpacity: 0.1,
          map: map,
        });

        polygons.push(polygon);
      }
    }

    // Cleanup function to remove polygons when component unmounts or dependencies change
    return () => {
      polygons.forEach(polygon => polygon.setMap(null));
    };
  }, [map, centerLat, centerLon, cols, rows, cellSize]);

  return null;
}

export function GridMapSelector({
  centerLat,
  centerLon,
  onLocationSelect,
  cols,
  rows,
  cellSize,
}: GridMapSelectorProps) {
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLon, setManualLon] = useState<string>('');
  const [mapError, setMapError] = useState<string>('');

  // Default center (Kharkiv, Ukraine)
  const defaultCenter = { lat: 49.9935, lng: 36.2304 };
  const center = centerLat && centerLon ? { lat: centerLat, lng: centerLon } : defaultCenter;

  // Update manual input fields when center changes
  useEffect(() => {
    if (centerLat !== null && centerLon !== null) {
      setManualLat(centerLat.toFixed(6));
      setManualLon(centerLon.toFixed(6));
    }
  }, [centerLat, centerLon]);

  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail.latLng) {
      const lat = e.detail.latLng.lat;
      const lng = e.detail.latLng.lng;
      onLocationSelect(lat, lng);
    }
  };

  const handleManualUpdate = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);

    if (isNaN(lat) || isNaN(lon)) {
      setMapError('Будь ласка, введіть коректні координати');
      return;
    }

    if (lat < -90 || lat > 90) {
      setMapError('Широта повинна бути від -90 до 90');
      return;
    }

    if (lon < -180 || lon > 180) {
      setMapError('Довгота повинна бути від -180 до 180');
      return;
    }

    setMapError('');
    onLocationSelect(lat, lon);
  };

  // Calculate grid bounds for visualization
  const getGridBounds = () => {
    if (!centerLat || !centerLon || !cols || !rows || !cellSize) {
      return null;
    }

    // Approximate degrees per meter (at moderate latitudes)
    const metersPerDegree = 111320;
    const gridWidth = cols * cellSize;
    const gridHeight = rows * cellSize;

    // For latitude (north-south): 1 degree ≈ 111km everywhere
    // For longitude (west-east): 1 degree = 111km * cos(latitude)
    const halfHeightDeg = (gridHeight / 2) / metersPerDegree;
    const halfWidthDeg = (gridWidth / 2) / (metersPerDegree * Math.cos(centerLat * Math.PI / 180));

    return {
      north: centerLat + halfHeightDeg,
      south: centerLat - halfHeightDeg,
      east: centerLon + halfWidthDeg,
      west: centerLon - halfWidthDeg,
    };
  };

  const gridBounds = getGridBounds();

  // Check if API key is configured
  const hasApiKey = GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY';

  if (!hasApiKey) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Google Maps API key не налаштований. Додайте VITE_GOOGLE_MAPS_API_KEY у файл .env
          </p>
        </div>

        {/* Manual coordinate input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Координати центру сітки (ручне введення)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Широта (Latitude)</label>
              <input
                type="text"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="50.450100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Довгота (Longitude)</label>
              <input
                type="text"
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                placeholder="30.523400"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualUpdate}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Встановити координати
          </button>
          {mapError && (
            <p className="text-sm text-red-600">{mapError}</p>
          )}
        </div>

        {/* Grid info */}
        {gridBounds && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Параметри сітки:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>Колонок: {cols}</div>
              <div>Рядків: {rows}</div>
              <div>Розмір клітинки: {cellSize}м</div>
              <div>Загальна площа: {cols! * rows!} клітинок</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="space-y-4">
        {/* Map */}
        <div className="h-96 w-full rounded-lg overflow-hidden border border-gray-300">
          <Map
            key={`${centerLat}-${centerLon}`}
            defaultCenter={center}
            defaultZoom={13}
            onClick={handleMapClick}
            mapId="field-search-grid-map"
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl={true}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            clickableIcons={false}
            style={{ width: '100%', height: '100%', touchAction: 'pan-x pan-y pinch-zoom' }}
          >
            {centerLat && centerLon && (
              <AdvancedMarker position={{ lat: centerLat, lng: centerLon }} />
            )}

            {/* Grid overlay */}
            {centerLat && centerLon && cols && rows && cellSize && (
              <GridOverlay
                centerLat={centerLat}
                centerLon={centerLon}
                cols={cols}
                rows={rows}
                cellSize={cellSize}
              />
            )}
          </Map>
        </div>

        {/* Manual coordinate input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Координати центру сітки (ручне введення)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Широта (Latitude)</label>
              <input
                type="text"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="50.450100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Довгота (Longitude)</label>
              <input
                type="text"
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                placeholder="30.523400"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualUpdate}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Встановити координати
          </button>
          {mapError && (
            <p className="text-sm text-red-600">{mapError}</p>
          )}
        </div>

        {/* Grid info */}
        {gridBounds && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Параметри сітки:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>Колонок: {cols}</div>
              <div>Рядків: {rows}</div>
              <div>Розмір клітинки: {cellSize}м</div>
              <div>Загальна площа: {cols! * rows!} клітинок</div>
              <div className="col-span-2">
                Область: {gridBounds.north.toFixed(6)}, {gridBounds.west.toFixed(6)} до {gridBounds.south.toFixed(6)}, {gridBounds.east.toFixed(6)}
              </div>
            </div>
          </div>
        )}

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            Натисніть на карту, щоб вибрати центр сітки, або введіть координати вручну
          </p>
        </div>
      </div>
    </APIProvider>
  );
}
