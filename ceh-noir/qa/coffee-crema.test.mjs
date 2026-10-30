import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshPhysicalMaterial, Texture, ShaderLib } from '../vendor/three/three.module.js';
import { installCremaGrowth } from '../coffee-crema.js';
import { fluidState } from '../coffee-fluid.js';

function fixture() {
  const maps = { map: new Texture(), normalMap: new Texture(), roughnessMap: new Texture() };
  const material = new MeshPhysicalMaterial({ ...maps, vertexColors: true, roughness: .41, ior: 1.335 });
  const shader = () => ({ uniforms: {}, vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader });
  return { material, maps, shader };
}

test('local crema growth preserves the supplied PBR channels and does not fade the whole material', () => {
  const { material, maps, shader } = fixture();
  const normalScale = material.normalScale;
  const controller = installCremaGrowth(material);
  const installedVersion = material.version;
  for (const progress of [0, .54, .66, .8, 1, .66]) {
    controller.update(fluidState(progress));
    for (const [name, texture] of Object.entries(maps)) assert.equal(material[name], texture);
    assert.equal(material.opacity, 1, 'Growth must change local coverage rather than overall opacity');
    assert.equal(material.roughness, .41);
    assert.equal(material.ior, 1.335);
    assert.equal(material.normalScale, normalScale);
    assert.equal(material.vertexColors, true, 'The supplied impact mask uses vertex alpha');
    assert.equal(material.version, installedVersion, 'Scrubbing must not trigger shader recompilation');
  }
  material.onBeforeCompile(shader(), {});
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false, 'Transparent pores must not cover the liquid depth');
});

test('reverse scrubbing and recompilation share deterministic live uniforms', () => {
  const { material, shader } = fixture();
  const controller = installCremaGrowth(material);
  // A scene can render before Three compiles its material for the first time.
  controller.update(fluidState(.66));
  const first = shader();
  material.onBeforeCompile(first, {});
  const pose = Object.fromEntries(Object.entries(first.uniforms).map(([name, uniform]) => [name, uniform.value]));
  assert.equal(pose.uCremaGrowth, fluidState(.66).foam);
  assert.equal(pose.uCremaPhase, fluidState(.66).phase);
  controller.update(fluidState(1));
  assert.equal(first.uniforms.uCremaGrowth.value, 1);
  controller.update(fluidState(.66));
  assert.deepEqual(Object.fromEntries(Object.entries(first.uniforms).map(([name, uniform]) => [name, uniform.value])), pose);
  const recompiled = shader();
  material.onBeforeCompile(recompiled, {});
  for (const name of Object.keys(pose)) {
    assert.equal(recompiled.uniforms[name], first.uniforms[name], 'A fresh program must receive the same live state');
    assert.equal(recompiled.uniforms[name].value, pose[name]);
  }
  controller.update(fluidState(.72));
  assert.equal(recompiled.uniforms.uCremaGrowth.value, fluidState(.72).foam);
});

test('invalid growth inputs cannot send nonfinite or out-of-range uniforms to WebGL', () => {
  const { material, shader } = fixture();
  const controller = installCremaGrowth(material);
  const program = shader();
  material.onBeforeCompile(program, {});
  for (const [input, expected] of [[-1, 0], [2, 1], [NaN, 0], [Infinity, 0], [-Infinity, 0], [undefined, 0]]) {
    controller.update({ foam: input, phase: input });
    assert.equal(program.uniforms.uCremaGrowth.value, expected);
    assert.equal(program.uniforms.uCremaPhase.value, expected);
  }
});

test('the material hook composes with the supplied shader and retains its impact-alpha path', () => {
  const { material, shader } = fixture();
  const renderer = {};
  let calls = 0;
  material.onBeforeCompile = function (program, actualRenderer) {
    assert.equal(this, material);
    assert.equal(actualRenderer, renderer);
    program.uniforms.suppliedUniform = { value: 7 };
    program.fragmentShader = '// supplied material hook\n' + program.fragmentShader;
    calls++;
  };
  installCremaGrowth(material);
  const program = shader();
  material.onBeforeCompile(program, renderer);
  assert.equal(calls, 1);
  assert.equal(program.uniforms.suppliedUniform.value, 7);
  assert.ok(program.fragmentShader.includes('// supplied material hook'));
  for (const chunk of ['map_fragment', 'color_fragment', 'normal_fragment_maps', 'roughnessmap_fragment']) {
    assert.ok(program.fragmentShader.includes(`#include <${chunk}>`), `Lost the supplied ${chunk} channel`);
  }
  const formation = program.fragmentShader.indexOf('diffuseColor.a *= cremaFormation(vMapUv)');
  assert.ok(formation > program.fragmentShader.indexOf('#include <map_fragment>'));
  assert.ok(formation < program.fragmentShader.indexOf('#include <color_fragment>'), 'Local coverage must still be multiplied by the moving impact mask');
  assert.equal(program.vertexShader, ShaderLib.physical.vertexShader, 'Growth must not detach foam from the shared liquid geometry');
});
