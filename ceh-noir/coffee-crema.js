import { clamp } from './coffee-fluid.js';

// The supplied colour, pore normals and roughness remain the final material.
// Only its local formation changes: no full-disc opacity fade or wall clock.
const formationShader = /* glsl */`
uniform float uCremaGrowth;
uniform float uCremaPhase;
float cremaHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float cremaNoise(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cremaHash(cell), cremaHash(cell + vec2(1.0, 0.0)), f.x),
             mix(cremaHash(cell + vec2(0.0, 1.0)), cremaHash(cell + 1.0), f.x), f.y);
}
float cremaFormation(vec2 uv) {
  vec2 q = (uv - 0.5) * 2.0;
  float radius = clamp(length(q), 0.0, 1.0);
  // UVs already follow the liquid vortex. A small domain warp breaks up the
  // outward front without moving the texture independently of the coffee.
  vec2 flow = q + 0.055 * vec2(sin(q.y * 8.0 + uCremaPhase * 1.8),
                              cos(q.x * 7.0 - uCremaPhase * 1.5));
  float islands = cremaNoise(flow * 5.5 + vec2(3.7, 9.2));
  float pores = cremaNoise(flow * 38.0 + vec2(17.3, 4.1));
  float rim = smoothstep(0.69, 0.98, radius);
  // Local aeration starts around the jet, spreads into islands and collects
  // against the ceramic. The existing vertex mask keeps the impact hole clear.
  float birth = 0.10 + 0.34 * radius + 0.34 * islands + 0.10 * pores - 0.30 * rim;
  float width = 0.075 + 0.045 * pores;
  return smoothstep(birth, birth + width, uCremaGrowth);
}
`;

export function installCremaGrowth(material) {
  const uniforms = { uCremaGrowth: { value: 0 }, uCremaPhase: { value: 0 } };
  const beforeCompile = material.onBeforeCompile;
  material.opacity = 1;
  material.depthWrite = false;
  material.transparent = true;
  material.onBeforeCompile = function (shader, renderer) {
    beforeCompile?.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = formationShader + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      #ifdef USE_MAP
        diffuseColor.a *= cremaFormation(vMapUv);
      #endif
    `);
  };
  material.customProgramCacheKey = () => 'espresso-local-crema-formation-v1';
  material.needsUpdate = true;
  return {
    update({ foam, phase }) {
      uniforms.uCremaGrowth.value = clamp(foam);
      uniforms.uCremaPhase.value = clamp(phase);
    },
  };
}
