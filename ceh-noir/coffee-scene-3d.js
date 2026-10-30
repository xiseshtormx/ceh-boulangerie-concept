import * as T from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/loaders/GLTFLoader.js';
import { CUP_PIVOT, STREAM_RINGS, STREAM_SIDES, fluidState, crossSection, surfaceData, streamData, bubbleState, tailDropState, splashState, smooth } from './coffee-fluid.js';
import { installCremaGrowth } from './coffee-crema.js';

const defaultBase = new URL('./assets/coffee/3d/', import.meta.url);
function find(root, name) {
  let match;
  root.traverse(object => { if (object.name === name || object.userData.source_name === name) match = object; });
  if (!match) throw new Error(`Missing GLB object: ${name}`);
  return match;
}
function geometry(data) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(data.positions, 3).setUsage(T.DynamicDrawUsage));
  if (data.uvs) g.setAttribute('uv', new T.BufferAttribute(data.uvs, 2));
  if (data.colors) g.setAttribute('color', new T.BufferAttribute(data.colors, 4).setUsage(T.DynamicDrawUsage));
  g.setIndex(data.indices); g.computeVertexNormals();
  g.boundingSphere = new T.Sphere(new T.Vector3(0, .07, 0), .2);
  return g;
}
function updateGeometry(mesh, data) {
  mesh.geometry.attributes.position.array.set(data.positions);
  mesh.geometry.attributes.position.needsUpdate = true;
  for (const [name, values] of [['uv', data.uvs], ['color', data.colors]]) if (values && mesh.geometry.attributes[name]) {
    mesh.geometry.attributes[name].array.set(values); mesh.geometry.attributes[name].needsUpdate = true;
  }
  mesh.geometry.computeVertexNormals();
  if (mesh.userData.joinStreamSeam) joinStreamSeam(mesh.geometry);
}
function joinStreamSeam(g) {
  const normals = g.attributes.normal, stride = STREAM_SIDES + 1;
  for (let i = 0; i <= STREAM_RINGS; i++) {
    const a = i * stride, b = a + STREAM_SIDES;
    let x = normals.getX(a) + normals.getX(b), y = normals.getY(a) + normals.getY(b), z = normals.getZ(a) + normals.getZ(b);
    const length = Math.hypot(x, y, z) || 1; x /= length; y /= length; z /= length;
    normals.setXYZ(a, x, y, z); normals.setXYZ(b, x, y, z);
  }
  normals.needsUpdate = true;
}
function studioEnvironment(renderer) {
  const room = new T.Scene();
  room.background = new T.Color(.035, .035, .040);
  for (const [position, size, color] of [
    [[-3, -.8, 3], [.85, 5.8], [18, 17.8, 17]],
    [[-1.8, -.5, 3.6], [.20, 4.0], [10, 10, 10.2]],
    [[3, -.7, 1], [.6, 4.7], [9, 9.3, 9.8]],
    [[2.6, .2, 3.8], [.35, 2.4], [5.2, 5.4, 6]],
    [[-1, -4, 1.8], [.55, 3.0], [5, 5, 5.3]],
    [[0, 4, -1], [2.3, 1.2], [2.8, 2.45, 1.9]],
    [[-1.3, 1.6, -3.6], [.5, .8], [1.2, .9, .5]],
    [[1.25, 1.9, -3.6], [1.0, .65], [4.5, 3.6, 2.2]],
    [[-3, 0, -2], [.8, 3.2], [.65, .85, 1.6]],
  ]) {
    const plane = new T.Mesh(new T.PlaneGeometry(...size), new T.MeshBasicMaterial({ color: new T.Color(...color), side: T.DoubleSide }));
    plane.position.set(...position); plane.lookAt(0, 0, 0); room.add(plane);
  }
  const pmrem = new T.PMREMGenerator(renderer), target = pmrem.fromScene(room, .012);
  room.traverse(ob => { ob.geometry?.dispose(); ob.material?.dispose(); }); pmrem.dispose();
  return target;
}

/** Load a self-contained GLB. Drive render({progress: 0..1}) from any scroll tool.
 * modelUrl can be /models/coffee/ceh-coffee.glb; streamUrl is a separate asset.
 * Lighting belongs to this renderer, not to the static GLB.
 */
export async function createCoffeeScene(canvas, {
  lowPower = false, modelUrl = new URL('ceh-coffee.glb', defaultBase).href,
  streamUrl = new URL('coffee-stream.glb', defaultBase).href,
} = {}) {
  modelUrl = new URL(modelUrl, document.baseURI).href;
  streamUrl = new URL(streamUrl, document.baseURI).href;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: lowPower ? 'low-power' : 'high-performance' });
  const onContextLost = event => { event.preventDefault(); canvas.dispatchEvent(new Event('contextlost')); };
  canvas.addEventListener('webglcontextlost', onContextLost);
  let env, asset, streamAsset, disposed = false;
  function disposeRoot(root) {
    root?.traverse(ob => {
      ob.geometry?.dispose();
      const materials = Array.isArray(ob.material) ? ob.material : [ob.material];
      for (const m of materials) if (m) {
        for (const v of Object.values(m)) if (v?.isTexture) { v.source?.data?.close?.(); v.dispose(); }
        m.dispose();
      }
    });
  }
  try {
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.AgXToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new T.Scene();
    scene.background = new T.Color(0);
    env = studioEnvironment(renderer); scene.environment = env.texture; scene.environmentIntensity = 1.15;
    const camera = new T.PerspectiveCamera(31, 1, .005, 2);
    camera.position.set(.012, .167, .247); camera.lookAt(.012, .043, 0);
    const key = new T.DirectionalLight(0xfff6ed, .9); key.position.set(-.10, .18, .14); scene.add(key);
    const fill = new T.DirectionalLight(0xe0e8ff, .25); fill.position.set(.15, .09, .12); scene.add(fill);
    const blue = new T.DirectionalLight(0x8aa9ff, .35); blue.position.set(-.13, .04, -.05); scene.add(blue);
    scene.add(new T.AmbientLight(0xffffff, .12));
    const loader = new GLTFLoader();
    // allSettled lets us release a successful first model if its sibling fails.
    const loaded = await Promise.allSettled([loader.loadAsync(modelUrl), loader.loadAsync(streamUrl)]);
    asset = loaded[0].status === 'fulfilled' ? loaded[0].value.scene : null;
    streamAsset = loaded[1].status === 'fulfilled' ? loaded[1].value.scene : null;
    const failure = loaded.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    scene.add(asset, streamAsset);
    const cup = find(asset, 'CoffeeCup_Ceramic');
    const rig = new T.Group(); rig.name = 'CoffeeCup_Runtime_Rig'; rig.position.y = CUP_PIVOT; scene.add(rig);
    rig.attach(cup);
    const volume = find(asset, 'Coffee_Liquid'), surface = find(asset, 'Coffee_Surface'), crema = find(asset, 'Coffee_Crema');
    const stream = find(streamAsset, 'Coffee_Stream');
    const segments = lowPower ? 96 : 128, rings = lowPower ? 24 : 40;
    const initial = fluidState(1);
    for (const { mesh, data } of [{ mesh: surface, data: surfaceData(initial, segments, rings) }, { mesh: crema, data: surfaceData(initial, segments, rings, true) }, { mesh: stream, data: streamData(initial) }]) {
      mesh.geometry.dispose(); mesh.geometry = geometry(data); mesh.frustumCulled = false;
      mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
    }
    crema.material.vertexColors = true; crema.material.needsUpdate = true;
    crema.material.ior = 1.335; crema.material.clearcoat = .025;
    const cremaGrowth = installCremaGrowth(crema.material);
    surface.material.ior = 1.335; surface.material.clearcoat = 0; surface.material.roughness = .12;
    surface.material.specularIntensity = .65;
    surface.material.envMapIntensity = 1.20;
    stream.userData.joinStreamSeam = true; joinStreamSeam(stream.geometry);
    stream.material.vertexColors = true; stream.material.needsUpdate = true;
    stream.material.ior = 1.335; stream.material.clearcoat = 0;
    stream.material.transmission = .96; stream.material.thickness = .0026;
    stream.material.attenuationColor = new T.Color(0x451d08); stream.material.attenuationDistance = .0016 / .95;
    stream.material.side = T.FrontSide; stream.material.needsUpdate = true;
    stream.material.specularIntensity = .70; stream.material.envMapIntensity = .60;
    stream.material.normalScale.setScalar(.05);
    // Approximate the actual cylindrical ray chord: the centre absorbs strongly
    // while thin edges transmit amber light. A uniform slab looks like paint.
    stream.material.onBeforeCompile = shader => {
      const chunk = T.ShaderChunk.transmission_fragment.replace('vec4 transmitted = getIBLVolumeRefraction(', `
        float jetAxialView = dot(v, vec3(0.0, 1.0, 0.0));
        material.thickness *= clamp(abs(dot(n, v)) / max(0.20, 1.0 - jetAxialView * jetAxialView), 0.025, 1.35);
        vec4 transmitted = getIBLVolumeRefraction(`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', chunk);
    };
    stream.material.customProgramCacheKey = () => 'espresso-jet-cylindrical-absorption-v1';
    for (const value of Object.values(stream.material)) if (value?.isTexture) {
      value.offset.set(0, 0); value.repeat.set(1, 1); value.rotation = 0;
      value.wrapS = value.wrapT = T.RepeatWrapping; value.updateMatrix();
    }
    for (const mesh of [surface, crema]) for (const value of Object.values(mesh.material)) if (value?.isTexture) {
      // The native snapshot may carry a baked Mapping-node transform. Browser
      // advection owns the UVs, so it must not apply that transform a second time.
      value.offset.set(0, 0); value.repeat.set(1, 1); value.center.set(0, 0); value.rotation = 0;
      value.matrixAutoUpdate = true; value.wrapS = value.wrapT = T.ClampToEdgeWrapping; value.updateMatrix();
      value.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    // Body volume is a real mesh from the GLB. Its top remains underneath the
    // separately driven world-horizontal surface; opaque ceramic occludes the sides.
    const volumeBase = volume.geometry.attributes.position.array.slice();
    const fullHeight = .059 - .0112;
    const bubbleMaterial = new T.MeshPhysicalMaterial({ color: 0x6b3511, roughness: .13, clearcoat: .06, ior: 1.335 });
    asset.traverse(ob => { if (/^Coffee_(Bubble|SplashDrop|TailDrop)_/.test(ob.userData.source_name || ob.name)) ob.visible = false; });
    const bubbleGeometry = new T.SphereGeometry(1, lowPower ? 8 : 12, 6);
    const bubbles = new T.InstancedMesh(bubbleGeometry, bubbleMaterial, lowPower ? 80 : 144);
    bubbles.frustumCulled = false; scene.add(bubbles);
    const dummy = new T.Object3D();
    const steamTexture = await new T.TextureLoader().loadAsync(new URL('steam-wisp.png', new URL('.', modelUrl)).href);
    const steamMaterial = new T.SpriteMaterial({ map: steamTexture, transparent: true, depthWrite: false, opacity: .10 });
    const wisps = [];
    for (let i = 0; i < 3; i++) {
      const sprite = new T.Sprite(steamMaterial.clone()); sprite.scale.set(.026, .066, 1); scene.add(sprite); wisps.push(sprite);
    }
    const dropletMaterial = new T.MeshPhysicalMaterial({ color: 0x341606, roughness: .12, clearcoat: .03, ior: 1.335, transmission: .10, thickness: .0006, attenuationColor: 0x8a3b0e, attenuationDistance: .006 });
    const drops = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), dropletMaterial, 5); drops.frustumCulled = false; scene.add(drops);
    const splashes = new T.InstancedMesh(new T.SphereGeometry(1, 10, 6), dropletMaterial, lowPower ? 8 : 12); splashes.frustumCulled = false; scene.add(splashes);
    let width = 1, height = 1, lastProgress = -1;
    function resize({ width: w, height: h, dpr = 1 } = {}) {
      if (disposed) return;
      width = Math.max(1, w || canvas.clientWidth); height = Math.max(1, h || canvas.clientHeight);
      renderer.setPixelRatio(Math.min(dpr, lowPower ? 1.35 : 1.75)); renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Preserve the complete handle on narrow screens; no CSS distortion.
      const verticalFov = 2 * Math.atan(Math.tan(31 * Math.PI / 360) / Math.min(1, camera.aspect * 1.08));
      camera.fov = verticalFov * 180 / Math.PI; camera.updateProjectionMatrix(); lastProgress = -1;
    }
    function render(input = {}) {
      if (disposed) return;
      const st = fluidState(input.progress ?? 0), p = st.p;
      // No autonomous liquid clock. Pausing / reverse scrolling reproduces a pose.
      if (p !== lastProgress) {
        rig.rotation.x = st.tilt;
        scene.environmentIntensity = 1.15 * st.reveal;
        key.intensity = .9 * st.reveal; fill.intensity = .25 * st.reveal;
        blue.intensity = .35 * st.reveal;
        const visible = p >= .29;
        surface.visible = crema.visible = volume.visible = visible;
        if (visible) {
          const data = surfaceData(st, segments, rings);
          updateGeometry(surface, data); updateGeometry(crema, surfaceData(st, segments, rings, true, data));
          cremaGrowth.update(st);
          const pos = volume.geometry.attributes.position;
          // Cross-sections conform to the cavity for every height under gravity.
          // The GLB supplies its closed topology; cache the eleven radial sections.
          const sections = Array.from({ length: 11 }, (_, i) => crossSection(.0112 + (st.level - .0112) * i / 10, st.tilt, 128));
          for (let i = 0; i < pos.count; i++) {
            const t = Math.max(0, Math.min(10, Math.round((volumeBase[i * 3 + 1] - .0112) / fullHeight * 10)));
            const a = Math.atan2(-volumeBase[i * 3 + 2], volumeBase[i * 3]);
            const j = (Math.round((a < 0 ? a + Math.PI * 2 : a) / (Math.PI * 2) * 128)) % 128;
            const section = sections[t], radius = section.radii[j];
            pos.setXYZ(i, radius * Math.cos(a), .0112 + (st.level - .0112) * t / 10 + (t === 10 ? .00017 : 0), -section.cy - radius * Math.sin(a));
          }
          pos.needsUpdate = true; volume.geometry.computeVertexNormals();
          for (let i = 0; i < bubbles.count; i++) {
            const bubble = bubbleState(st, lowPower && i >= 40 ? i + 32 : i, data);
            dummy.position.set(...bubble.position);
            dummy.scale.set(bubble.radius, bubble.radius * bubble.flatten, bubble.radius); dummy.updateMatrix(); bubbles.setMatrixAt(i, dummy.matrix);
          }
          bubbles.instanceMatrix.needsUpdate = true;
        }
        bubbles.visible = st.foam > .01;
        splashes.visible = st.impact > .05;
        for (let i = 0; i < splashes.count; i++) {
          const drop = splashState(st, i);
          dummy.position.set(...drop.position); dummy.scale.set(drop.radius, drop.radius * 1.35, drop.radius); dummy.updateMatrix(); splashes.setMatrixAt(i, dummy.matrix);
        }
        splashes.instanceMatrix.needsUpdate = true;
        stream.visible = p > .235 && p < .765;
        if (stream.visible) updateGeometry(stream, streamData(st));
        drops.visible = p > .72 && p < .82;
        for (let i = 0; i < drops.count; i++) {
          const drop = tailDropState(st, i);
          dummy.position.set(...drop.position);
          dummy.scale.set(drop.radius, drop.radius * drop.stretch, drop.radius); dummy.updateMatrix(); drops.setMatrixAt(i, dummy.matrix);
        }
        drops.instanceMatrix.needsUpdate = true;
        lastProgress = p;
      }
      for (let i = 0; i < wisps.length; i++) {
        wisps[i].position.set((i - 1) * .013 + .002 * Math.sin(p * 18 + i), .091, -.002);
        wisps[i].material.opacity = .10 * st.steam;
      }
      renderer.render(scene, camera);
      canvas.dataset.progress = p.toFixed(4); canvas.dataset.renderer = 'webgl';
      canvas.dataset.coffeeRevision = '5'; canvas.dataset.coffeeFill = st.fill.toFixed(4); canvas.dataset.coffeeImpact = st.impact.toFixed(4); canvas.dataset.coffeeFoam = st.foam.toFixed(4);
      canvas.dataset.coffeeStreamTransmission = stream.material.transmission.toFixed(2);
    }
    function dispose() {
      if (disposed) return; disposed = true;
      canvas.removeEventListener('webglcontextlost', onContextLost);
      disposeRoot(scene); steamMaterial.dispose(); bubbleGeometry.dispose(); env.dispose(); renderer.dispose();
    }
    resize({ width: canvas.clientWidth || 1280, height: canvas.clientHeight || 900, dpr: window.devicePixelRatio || 1 }); render({ progress: 0 });
    return { resize, render, dispose, inspect: () => ({ progress: lastProgress, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, webgl: true }) };
  } catch (error) {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    disposeRoot(asset); disposeRoot(streamAsset); env?.dispose(); renderer.dispose(); throw error;
  }
}
