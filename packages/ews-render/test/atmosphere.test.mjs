import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scatterSky, fogWallForbidden, rayleighPhase, miePhase } from '../src/scene/atmosphere.js';

test('scattering never produces a fog wall (transmittance stays up)', () => {
  const zenith = scatterSky([0, 1, 0], [0.2, 0.8, 0.3], 2);
  const horizon = scatterSky([1, 0, 0], [0.2, 0.8, 0.3], 2);
  assert.ok(zenith.transmittance >= 0.35);
  assert.ok(horizon.transmittance >= 0.35);
  assert.ok(zenith.rgb.every(c => c >= 0));
  assert.ok(fogWallForbidden(null));
  assert.equal(fogWallForbidden({ near: 10, far: 80 }), false);
});

test('phase functions are finite and positive on [-1,1]', () => {
  for (const mu of [-1, -0.3, 0, 0.5, 1]) {
    assert.ok(rayleighPhase(mu) > 0 && Number.isFinite(rayleighPhase(mu)));
    assert.ok(miePhase(mu) > 0 && Number.isFinite(miePhase(mu)));
  }
});
