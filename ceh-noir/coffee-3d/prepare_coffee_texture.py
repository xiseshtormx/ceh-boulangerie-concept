"""Deproject the supplied coffee reference into albedo, crema and micro-normal maps.
No generated photograph: the source is references/full.png supplied by the user.
"""
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
OUT = HERE/'models'
OUT.mkdir(parents=True, exist_ok=True)
N = 2048
source_path = HERE/'references'/'full.png'
source = np.asarray(Image.open(source_path).convert('RGB'), dtype=np.float32)/255
y, x = np.mgrid[0:N, 0:N].astype(np.float32)/(N-1)
dx, dy = x*2-1, y*2-1
rho = np.hypot(dx, dy)
# The photographed liquid occupies this ellipse, safely inside the porcelain rim.
sx, sy = 550+350*dx, 552+75*dy
ix, iy = sx.astype(int), sy.astype(int)
fx, fy = sx-ix, sy-iy
photo = ((source[iy, ix]*(1-fx[..., None])+source[iy, ix+1]*fx[..., None])*(1-fy[..., None])+
         (source[iy+1, ix]*(1-fx[..., None])+source[iy+1, ix+1]*fx[..., None])*fy[..., None])
luma = photo[..., 0]*.24+photo[..., 1]*.62+photo[..., 2]*.14
chroma = np.max(photo, axis=-1)-np.min(photo, axis=-1)
# Remove achromatic baked specular light: reflections come from the 3D studio.
specular = np.clip((luma-.40)*4, 0, 1)*np.clip((.30-chroma)*5, 0, 1)
rng = np.random.default_rng(319)
def blur(values, radius):
    image = Image.fromarray(np.uint8(np.clip(values, 0, 1)*255))
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)/255

# Preserve the photographic pores and irregular islands; add relief rather than
# smoothing the picture into a uniform foam sheet.
body = np.clip((luma-.13)/.35, 0, 1)*(1-specular*.55)
tone = blur(body, 8)
edge = np.clip((rho-.72)/.25, 0, 1)
foam = np.clip(body+.08*edge*tone, 0, .98)
gold = np.stack([.63+.25*luma, .31+.28*luma, .10+.16*luma], axis=-1)
albedo = photo*(1-specular[..., None]*.90)+gold*specular[..., None]*.90
roughness = .25+.19*foam
relief = (body-blur(body, 3))*.000014

# A seeded distribution of real-scale pores: numerous microscopic cells, fewer
# small bubbles, and only occasional larger cells, preferentially at the wall.
# These contain no painted white highlights: the PBR normal supplies those.
for count, low, high, edge_bias in [(14000, .65, 2.0, False), (2400, 2.0, 4.8, False), (140, 4.8, 11.5, True)]:
    for _ in range(count):
        a = rng.uniform(0, np.pi*2)
        r = rng.uniform(.79, .975) if edge_bias else np.sqrt(rng.uniform(0, .98**2))
        px, py = (1+r*np.cos(a))*.5*(N-1), (1+r*np.sin(a))*.5*(N-1)
        radius = np.exp(rng.uniform(np.log(low), np.log(high)))
        x0, x1 = max(0, int(px-radius-2)), min(N, int(px+radius+3))
        y0, y1 = max(0, int(py-radius-2)), min(N, int(py+radius+3))
        yy, xx = np.mgrid[y0:y1, x0:x1]
        q = np.hypot((xx-px)/radius, (yy-py)/radius)
        inside = np.clip((1-q)*3.5, 0, 1)
        rim = np.exp(-((q-.86)/.14)**2)
        patch = np.s_[y0:y1, x0:x1]
        popped = radius > 4 and rng.random() < .34
        foam[patch] *= 1-inside*(.68 if popped else .12)
        albedo[patch] *= (1-.20*inside+.12*rim)[..., None]
        relief[patch] += np.sqrt(np.maximum(0, 1-q*q))*min(.000070, radius*.000009)
        roughness[patch] -= inside*.15
fine = rng.random((N, N), dtype=np.float32)
albedo *= (.985+.03*fine)[..., None]
foam *= np.clip((1.002-rho)*90, 0, 1)
# Extend texture beyond the visible disk with warm liquid, avoiding white rim pixels.
outside = rho > .998
albedo[outside] = (.37, .17, .045)
rgba = np.dstack([np.clip(albedo, 0, 1), foam*.96])
Image.fromarray(np.uint8(rgba*255)).save(OUT/'espresso-crema.png', optimize=True)
coffee = np.empty_like(albedo)
coffee[..., 0] = .070+.030*luma
coffee[..., 1] = .026+.016*luma
coffee[..., 2] = .010+.008*luma
Image.fromarray(np.uint8(coffee*255)).save(OUT/'espresso-surface.png', optimize=True)
# Microcell domes give coherent normals and roughness at the same locations.
gy, gx = np.gradient(relief, .088/N)
normal = np.stack([-gx, gy, np.ones_like(gx)], axis=-1)
normal /= np.maximum(.00001, np.linalg.norm(normal, axis=-1))[..., None]
Image.fromarray(np.uint8((normal*.5+.5)*255)).save(OUT/'espresso-micro-normal.png', optimize=True)
Image.fromarray(np.uint8(np.clip(roughness, .12, .6)*255)).save(OUT/'espresso-crema-roughness.png', optimize=True)

# Seamless, restrained optical detail for a liquid jet. No spiral stripes or
# baked specular streaks; geometry and studio reflections carry the motion.
sv, su = np.mgrid[0:1024, 0:256].astype(np.float32)
su, sv = su/256, sv/1024
streaks = .55*np.sin(2*np.pi*(su*3+.19*np.sin(sv*2*np.pi)))
streaks += .25*np.sin(2*np.pi*(su*7-sv*3))+.20*np.sin(2*np.pi*(su*11+sv*5))
jet_color = np.stack([.48+.002*streaks, .28+.001*streaks, .105+.0008*streaks], axis=-1)*1.05
Image.fromarray(np.uint8(np.clip(jet_color, 0, 1)*255)).save(OUT/'espresso-stream.png', optimize=True)
Image.fromarray(np.uint8((.060+.012*streaks)*255)).save(OUT/'espresso-stream-roughness.png', optimize=True)
gy, gx = np.gradient(streaks*.0000015, .02/1024, .016/256)
normal = np.stack([-gx, gy, np.ones_like(gx)], axis=-1)
normal /= np.linalg.norm(normal, axis=-1)[..., None]
Image.fromarray(np.uint8((normal*.5+.5)*255)).save(OUT/'espresso-stream-normal.png', optimize=True)
report = dict(revision=4, source='coffee-3d/references/full.png',
              sha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),
              method='Photographic crema islands and colour with specular suppression; seeded real-scale cellular pores, correlated dome normals and roughness; seamless jet optical maps',
              albedoSize=N, normalSize=N, microcells=16540, streamMapSize=[256, 1024], generatedPhoto=False)
(OUT/'coffee-texture-source.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('COFFEE_TEXTURES_READY', json.dumps(report))
