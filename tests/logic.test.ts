import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CITIES, nearestCity } from '../src/constants/cities';
import { rankOf } from '../src/features/challenges/ranks';
import { COUNTRY_POINTS, WORLD_H, WORLD_W } from '../src/constants/worldMap';

test('nearestCity picks the closest bundled city', () => {
  assert.equal(nearestCity(33.6, -7.6).name, 'Casablanca');
  assert.equal(nearestCity(48.85, 2.35).name, 'Paris');
  assert.equal(nearestCity(35.7, 139.7).name, 'Tokyo');
});

test('every manual city has a valid position', () => {
  for (const c of CITIES) {
    assert.ok(Math.abs(c.lat) <= 85 && Math.abs(c.lng) <= 180, c.name);
    assert.match(c.country, /^[A-Z]{2}$/);
  }
});

test('rankOf maps levels to ranks and never goes out of bounds', () => {
  assert.equal(rankOf(1), 'Newcomer');
  assert.equal(rankOf(2), 'Newcomer');
  assert.equal(rankOf(3), 'Wanderer');
  assert.equal(rankOf(999), 'Legend');
  assert.equal(rankOf(0), 'Newcomer');
});

test('world map has country points inside the map for discovery pins', () => {
  for (const code of ['MA', 'FR', 'US', 'JP', 'BR', 'EG']) {
    const p = COUNTRY_POINTS[code];
    assert.ok(p, code);
    assert.ok(p[0] > 0 && p[0] < WORLD_W && p[1] > 0 && p[1] < WORLD_H, code);
  }
});
