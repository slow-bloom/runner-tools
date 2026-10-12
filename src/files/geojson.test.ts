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

  it('outputs MultiLineString for multi-segment tracks by default and LineString when connectSegments is true', () => {
    const multiSegPoints: Trackpoint[] = [
      { lat: 40.71, lon: -74.00, ele: 10, time: null, hr: null, cad: null, distance: 0, segmentIndex: 0 },
      { lat: 40.72, lon: -74.01, ele: 10, time: null, hr: null, cad: null, distance: 100, segmentIndex: 0 },
      { lat: 40.80, lon: -74.10, ele: 20, time: null, hr: null, cad: null, distance: 100, segmentIndex: 1 },
      { lat: 40.81, lon: -74.11, ele: 20, time: null, hr: null, cad: null, distance: 200, segmentIndex: 1 },
    ];

    const disjoint = toGeoJSON(multiSegPoints);
    expect(disjoint.features[0].geometry.type).toBe('MultiLineString');
    expect(disjoint.features[0].geometry.coordinates).toHaveLength(2);

    const connected = toGeoJSON(multiSegPoints, { connectSegments: true });
    expect(connected.features[0].geometry.type).toBe('LineString');
    expect(connected.features[0].geometry.coordinates).toHaveLength(4);
  });
});
