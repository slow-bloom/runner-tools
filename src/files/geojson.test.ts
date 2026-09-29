import { describe, it, expect } from 'vitest';
import { toGeoJSON, serializeToGeoJSON } from './geojson.js';
import type { Trackpoint } from './types.js';

describe('GeoJSON Serializer', () => {
  const points: Trackpoint[] = [
    {
      lat: 40.7128,
      lon: -74.006,
      ele: 15.0,
      time: new Date('2026-03-01T12:00:00Z'),
      hr: 155,
      cad: 180,
      distance: 0,
    },
    {
      lat: 40.7138,
      lon: -74.005,
      ele: 16.0,
      time: new Date('2026-03-01T12:01:00Z'),
      hr: 160,
      cad: 182,
      distance: 120,
    },
  ];

  it('converts trackpoints into a valid GeoJSON FeatureCollection', () => {
    const geojson = toGeoJSON(points, { name: 'NYC Run' });
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(1);

    const feature = geojson.features[0];
    expect(feature.geometry.type).toBe('LineString');
    expect(feature.geometry.coordinates).toHaveLength(2);
    // [lon, lat, ele]
    expect(feature.geometry.coordinates[0]).toEqual([-74.006, 40.7128, 15.0]);
    expect(feature.properties.name).toBe('NYC Run');
    expect(feature.properties.heartrates).toEqual([155, 160]);
    expect(feature.properties.cadences).toEqual([180, 182]);
  });

  it('serializes to JSON string', () => {
    const str = serializeToGeoJSON(points);
    const parsed = JSON.parse(str);
    expect(parsed.type).toBe('FeatureCollection');
  });
});
