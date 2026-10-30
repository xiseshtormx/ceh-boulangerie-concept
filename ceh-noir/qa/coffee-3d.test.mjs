import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CUP_PIVOT, STREAM_RINGS, STREAM_SIDES, fluidState, innerRadius, surfaceData, surfaceHeight, streamData, crossSection, liquidVolume, tailDropState } from '../coffee-fluid.js';

test('the coffee remains in the cup cavity under gravity throughout pouring', () => {
  for (let i = 266; i <= 1000; i += 3) {
    const st = fluidState(i / 1000), data = surfaceData(st, 64, 12);
    const c = Math.cos(st.tilt), s = Math.sin(st.tilt);
    for (let j = 0; j < data.positions.length; j += 3) {
      // Independent inverse rigid transform from world Y-up to the tilted cup.
      const x = data.positions[j], worldY = data.positions[j + 1] - CUP_PIVOT, worldZ = data.positions[j + 2];
      const localY = worldY * c + worldZ * s + CUP_PIVOT, localZ = -worldY * s + worldZ * c;
      assert.ok(Math.hypot(x, localZ) <= innerRadius(localY) + .00015, `Coffee outside cavity at ${st.p}`);
      assert.ok(Math.abs(data.positions[j + 1] - st.level) < .0025, 'Surface deviates too far from gravity plane');
    }
    const rim = Array.from({ length: 64 }, (_, j) => data.positions[(data.positions.length / 3 - 64 + j) * 3 + 1]);
    assert.ok(Math.max(...rim) - Math.min(...rim) < .00008, 'Waterline tilts with the cup');
  }
});

test('inflow controls conserved volume and the jet terminates inside its own impact crater', () => {
  let last = 0;
  for (let i = 290; i <= 1000; i += 2) {
    const st = fluidState(i / 1000);
    assert.ok(st.volume >= last, 'Filled volume went backwards'); last = st.volume;
    assert.ok(Math.abs(liquidVolume(st.level, st.tilt) - st.volume) < 1e-9, 'Fill does not match delivered volume');
    if (st.impact > .8) {
      const stream = streamData(st).positions;
      const y = Array.from({ length: 20 }, (_, j) => stream[j * 3 + 1]).reduce((a, b) => a + b) / 20;
      const impactHeight = surfaceHeight(st, st.ix, st.iz);
      assert.ok(y < impactHeight && y > impactHeight - .001, 'Jet floats above the surface or tunnels too deeply');
      assert.ok(impactHeight < st.level - .0005, 'Missing impact depression');
    }
  }
  const final = fluidState(1), data = surfaceData(final, 64, 20);
  const interior = Array.from({ length: 64 * 10 }, (_, i) => data.positions[(i + 1) * 3 + 1]);
  assert.ok(Math.max(...interior) - Math.min(...interior) < .00002, 'Final waves did not settle');
});

test('cross-sections remain closed, nonzero and safe below the lowest rim during tilt', () => {
  for (let i = 265; i <= 1000; i++) {
    const st = fluidState(i / 1000), section = crossSection(st.level, st.tilt, 32);
    const lowestRim = CUP_PIVOT + (.066 - CUP_PIVOT) * Math.cos(st.tilt) - .0443 * Math.sin(st.tilt);
    assert.ok(st.level + .001 < lowestRim);
    assert.ok(section.radii.every(r => r > 0 && r < .045));
  }
});

test('static GLBs contain real geometry and self-contained PBR materials', async () => {
  const base = new URL('../assets/coffee/3d/', import.meta.url);
  for (const name of ['cup.glb', 'coffee-liquid.glb', 'coffee-stream.glb', 'ceh-coffee.glb', 'ceh-coffee-pouring.glb']) {
    const buffer = await readFile(new URL(name, base));
    assert.equal(buffer.readUInt32LE(0), 0x46546c67); assert.equal(buffer.readUInt32LE(4), 2);
    assert.equal(buffer.readUInt32LE(8), buffer.length);
    const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
    assert.ok(gltf.meshes.length && gltf.accessors.length); assert.ok(!gltf.animations);
    assert.ok(gltf.buffers.every(b => !b.uri)); assert.ok((gltf.images || []).every(image => image.bufferView !== undefined));
    assert.ok(gltf.materials.every(m => m.pbrMetallicRoughness?.metallicFactor === 0));
    const foam = gltf.materials.find(m => m.name.startsWith('Espresso_Crema_'));
    if (foam) {
      assert.equal(foam.alphaMode, 'BLEND', 'Foam lost its transparent gaps during export');
      const primitive = gltf.meshes.find(m => m.name.startsWith('Coffee_Crema')).primitives[0];
      assert.ok(primitive.attributes.COLOR_0 !== undefined, 'Foam lost the local impact mask');
    }
    if (name === 'coffee-stream.glb') {
      const primitive = gltf.meshes[0].primitives[0];
      assert.ok(primitive.attributes.TANGENT !== undefined, 'Jet normal map has no portable tangent basis');
      assert.ok(primitive.attributes.COLOR_0 !== undefined, 'Jet lost its absorption transition into the pool');
      const extensions = gltf.materials[primitive.material].extensions;
      assert.ok(extensions.KHR_materials_transmission.transmissionFactor > .9 && extensions.KHR_materials_transmission.transmissionFactor <= 1, 'Jet lost the transmitting liquid interface');
      assert.ok(extensions.KHR_materials_volume.thicknessFactor > 0, 'Dark liquid has no absorption thickness');
      assert.ok(extensions.KHR_materials_volume.attenuationDistance < .002, 'Coffee became clear colourless glass');
      assert.ok(extensions.KHR_materials_ior.ior > 1.3 && extensions.KHR_materials_ior.ior < 1.4);
    }
    if (name === 'cup.glb') {
      assert.ok(buffer.length < 1_500_000, 'Cup exceeds the mobile asset budget');
      const material = gltf.materials[0]; assert.ok(material.pbrMetallicRoughness.roughnessFactor < .2);
      assert.ok(material.extensions.KHR_materials_clearcoat.clearcoatFactor > 0);
    }
  }
});

function jetRing(data, i) {
  const stride = STREAM_SIDES + 1, points = Array.from({ length: STREAM_SIDES }, (_, j) => Array.from(data.positions.slice((i * stride + j) * 3, (i * stride + j) * 3 + 3)));
  const center = [0, 1, 2].map(k => points.reduce((sum, p) => sum + p[k], 0) / points.length);
  const radius = points.reduce((sum, p) => sum + Math.hypot(p[0] - center[0], p[2] - center[2]), 0) / points.length;
  return { center, radius };
}

test('the gravity jet tapers, has a seamless texture, and remains attached to the moving impact', () => {
  for (const progress of [.34, .42, .54, .65]) {
    const st = fluidState(progress), data = streamData(st), bottom = jetRing(data, 0), top = jetRing(data, STREAM_RINGS);
    const throat = jetRing(data, Math.round(STREAM_RINGS * .07));
    assert.ok(throat.radius / top.radius > .3 && throat.radius / top.radius < .92, 'Jet does not narrow under acceleration');
    assert.ok(Math.hypot(bottom.center[0] - st.ix, bottom.center[2] - st.iz) < 1e-8, 'Jet misses its impact point');
    for (let i = 0; i <= STREAM_RINGS; i++) {
      const a = i * (STREAM_SIDES + 1), b = a + STREAM_SIDES;
      assert.ok(Math.hypot(...[0, 1, 2].map(k => data.positions[a * 3 + k] - data.positions[b * 3 + k])) < 1e-8);
      assert.ok(Math.abs(data.uvs[b * 2] - data.uvs[a * 2] - 1) < 1e-6, 'UV seam stretches the circumference');
    }
  }
});

test('foam builds late, after the initially dark coffee, and settles deterministically', () => {
  for (const progress of [.29, .35, .45, .54]) assert.equal(fluidState(progress).foam, 0);
  assert.ok(fluidState(.66).foam > .4);
  assert.equal(fluidState(.8).foam, 1);
  assert.deepEqual(surfaceData(fluidState(.67), 32, 16, true), surfaceData(fluidState(.67), 32, 16, true));
});

test('the shutting jet drains from the nozzle downward and final drops land before disappearing', () => {
  const closing = streamData(fluidState(.75));
  assert.equal(jetRing(closing, STREAM_RINGS).radius, 0);
  assert.ok(jetRing(closing, 0).radius > .0002, 'Whole stream vanished before its tail arrived');
  for (let i = 0; i < 5; i++) {
    let previousY = Infinity, seen = false;
    for (let p = .73; p < .82; p += .0005) {
      const st = fluidState(p), drop = tailDropState(st, i);
      if (!drop.radius) continue;
      assert.ok(drop.position[1] < previousY, 'Drop moved upward'); previousY = drop.position[1]; seen = true;
      assert.ok(drop.position[1] > st.level, 'Trailing drop is still visible underwater');
    }
    assert.ok(seen, 'No trailing drop appeared');
  }
});
