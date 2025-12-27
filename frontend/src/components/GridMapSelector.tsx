/// <reference types="@types/google.maps" />
import { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, type MapMouseEvent } from '@vis.gl/react-google-maps';
import { domToJpeg } from 'modern-screenshot';
import { uploadApi } from '@/api/upload';
import { Download } from 'lucide-react';

interface GridMapSelectorProps {
  centerLat: number | null;
  centerLon: number | null;
  onLocationSelect: (lat: number, lon: number) => void;
  cols: number | null;
  rows: number | null;
  cellSize: number | null;
  onMapImageUpload?: (imageUrl: string) => void;
}

// Use a placeholder API key for development
// In production, this should come from environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY';

// Helper function to convert column index to letter label (0->A, 1->B, ..., 25->Z, 26->AA, etc.)
function columnLabel(index: number): string {
  let label = "";
  let i = index + 1; // Make it 1-based for calculation
  while (i > 0) {
    i -= 1;
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26);
  }
  return label;
}

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
    const labels: google.maps.Marker[] = [];

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

        // Calculate cell center
        const centerCellLat = (north + south) / 2;
        const centerCellLon = (west + east) / 2;

        // Create cell label (e.g., A1, B2, C3)
        const colLabel = columnLabel(col);
        const rowLabel = String(row + 1);
        const cellName = `${colLabel}${rowLabel}`;

        // Draw polygon
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
          fillOpacity: 0,
          map: map,
        });

        polygons.push(polygon);

        // Add label at cell center
        const label = new google.maps.Marker({
          position: { lat: centerCellLat, lng: centerCellLon },
          map: map,
          label: {
            text: cellName,
            color: '#000000',
            fontSize: '14px',
            fontWeight: 'bold',
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0, // Invisible icon, only label visible
          },
        });

        labels.push(label);
      }
    }

    // Cleanup function to remove polygons and labels when component unmounts or dependencies change
    return () => {
      polygons.forEach(polygon => polygon.setMap(null));
      labels.forEach(label => label.setMap(null));
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
  onMapImageUpload,
}: GridMapSelectorProps) {
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLon, setManualLon] = useState<string>('');
  const [mapError, setMapError] = useState<string>('');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [isExporting, setIsExporting] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

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

  const handleExportMap = async () => {
    if (!mapContainerRef.current) return;

    setIsExporting(true);
    try {
      // Wait for map to fully render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get current dimensions
      const rect = mapContainerRef.current.getBoundingClientRect();
      const originalWidth = rect.width;
      const originalHeight = rect.height;
      const maxDimension = 2000;

      // Calculate scale to achieve 2000px on longest side
      let scale;
      if (originalWidth > originalHeight) {
        scale = maxDimension / originalWidth;
      } else {
        scale = maxDimension / originalHeight;
      }

      // Capture as JPEG with calculated scale
      const dataUrl = await domToJpeg(mapContainerRef.current, {
        quality: 0.95,
        scale: scale,
        backgroundColor: '#ffffff',
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Create file from blob
      const file = new File([blob], `map-export-${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Download locally
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Upload to server
      const uploadedUrls = await uploadApi.uploadImages([file]);
      if (uploadedUrls.length > 0 && onMapImageUpload) {
        onMapImageUpload(uploadedUrls[0]);
      }
    } catch (error) {
      console.error('Error exporting map:', error);
      setMapError('Помилка експорту карти');
    } finally {
      setIsExporting(false);
    }
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
        {/* Map controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Тип карти:</span>
            <div className="flex gap-1 border border-gray-300 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setMapType('roadmap')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  mapType === 'roadmap'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Карта
              </button>
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  mapType === 'satellite'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Супутник
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportMap}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Експорт...' : 'Експорт JPEG'}
          </button>
        </div>

        {/* Map */}
        <div ref={mapContainerRef} className="h-96 w-full rounded-lg overflow-hidden border border-gray-300">
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
            mapTypeId={mapType}
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
