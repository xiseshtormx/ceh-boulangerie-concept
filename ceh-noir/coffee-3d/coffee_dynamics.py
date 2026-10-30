"""Deterministic, volume-driven espresso. Coordinates are Blender Z-up metres."""
import math
from functools import lru_cache

TAU = math.tau
PIVOT = .01
STREAM_RINGS, STREAM_SIDES = 112, 24
INNER = [(.011, 0), (.0113, .012), (.0125, .021), (.015, .028), (.022, .034), (.032, .039), (.046, .0422), (.061, .0437), (.066, .0443)]


def smooth(a, b, p):
    t = max(0., min(1., (p-a)/(b-a)))
    return t*t*(3-2*t)


def radius_at(z):
    for (a, ra), (b, rb) in zip(INNER, INNER[1:]):
        if z <= b:
            return max(.000001, ra+(rb-ra)*max(0, z-a)/(b-a))
    return INNER[-1][1]


def floor_at(r):
    for (a, ra), (b, rb) in zip(INNER, INNER[1:]):
        if r <= rb:
            return a+(b-a)*max(0, r-ra)/(rb-ra)
    return INNER[-1][0]


def upright_volume(h):
    v = 0.
    for (a, ra), (b, rb) in zip(INNER, INNER[1:]):
        d = max(0., min(h, b)-a)
        slope = (rb-ra)/(b-a)
        v += math.pi*(ra*ra*d+ra*slope*d*d+slope*slope*d*d*d/3)
    return v


SLICES = [( .011+(i+.5)*(.055/256), radius_at(.011+(i+.5)*(.055/256))) for i in range(256)]


def liquid_volume(h, tilt):
    if tilt < .01:
        return upright_volume(h)
    c, s = math.cos(tilt), math.sin(tilt)
    total = 0.
    for z, r in SLICES:
        k = (h-PIVOT-(z-PIVOT)*c)/s
        if k >= r:
            total += math.pi*r*r
        elif k > -r:
            total += r*r*(math.asin(k/r)+math.pi/2)+k*math.sqrt(max(0., r*r-k*k))
    numerical = total*.055/256
    blend = smooth(.01, .04, tilt)
    return upright_volume(h)*(1-blend)+numerical*blend


def integral_smooth(a, b, p):
    x = max(0., min(1., (p-a)/(b-a)))
    return (b-a)*(x*x*x-.5*x*x*x*x)+max(0., p-b)


# A shallow initial puddle keeps the radial surface centred inside the tilted
# cavity. Subsequent filling conserves this seed plus the integrated inflow.
SEED_VOLUME = liquid_volume(.0115, math.radians(16))


@lru_cache(maxsize=512)
def state(p):
    p = max(0., min(1., p))
    tilt = math.radians(16)*smooth(.05, .22, p)*(1-smooth(.30, .80, p))
    fill = max(0., min(1., (integral_smooth(.29, .325, p)-integral_smooth(.69, .765, p))/.420))
    target = SEED_VOLUME+(upright_volume(.059)-SEED_VOLUME)*fill
    lo, hi = .011, .060
    for _ in range(20):
        m = (lo+hi)/2
        if liquid_volume(m, tilt) < target:
            lo = m
        else:
            hi = m
    level = (lo+hi)/2
    pour = smooth(.235, .29, p)*(1-smooth(.69, .765, p))
    impact = pour*smooth(.29, .325, p)
    agitation = smooth(.29, .34, p)*(1-smooth(.765, .97, p))
    cy = -(level-PIVOT)*math.tan(tilt)
    return dict(p=p, tilt=tilt, fill=fill, pour=pour, level=level, impact=impact, foam=smooth(.56, .98, fill), agitation=agitation,
                phase=max(0., min(1., (p-.29)/.475)), ix=.00065*math.sin(p*23)*impact,
                iy=cy+.00055*math.sin(p*17+.8)*impact, volume=target,
                reveal=.28+.72*smooth(0, .13, p), steam=smooth(.81, .98, p))


@lru_cache(maxsize=4096)
def boundary(h, tilt, segments=128):
    c, s = math.cos(tilt), math.sin(tilt)
    cy, zc = -(h-PIVOT)*math.tan(tilt), PIVOT+(h-PIVOT)/c
    radii = []
    for j in range(segments):
        a = TAU*j/segments
        ca, sa = math.cos(a), math.sin(a)
        local_angle = math.atan2(sa*c, ca)
        joint_scale = .00060*math.exp(-(local_angle/.12)**2)
        lo, hi = 0., .049
        for _ in range(22):
            r = (lo+hi)/2
            z = zc-r*sa*s
            # The fused upper handle root thickens the actual inner wall locally.
            joint = joint_scale*smooth(.054, .0555, z)*(1-smooth(.0577, .0588, z))
            if r*math.hypot(ca, sa*c) < radius_at(z)-.00048-joint:
                lo = r
            else:
                hi = r
        radii.append(lo)
    return cy, radii


def height_at(st, x, y, t=0):
    dx, dy = x-st['ix'], y-st['iy']
    d, a = math.hypot(dx, dy), math.atan2(dy, dx)
    fade = max(0., 1-t**8)
    wave = .00048*math.sin(d*760-st['p']*94+.35*math.sin(a*3))*math.exp(-d*48)
    wave += .00015*math.sin(d*420-st['p']*58+a*.7)+.00009*math.sin(dx*500+dy*900-st['p']*112)*math.exp(-d*40)
    wave *= st['agitation']*fade
    crater = -.00125*math.exp(-(d/.0019)**2)*st['impact']
    crown_radius = .0029+.00045*math.sin(a*3-st['p']*37)+.00023*math.sin(a*7+st['p']*71)
    tongues = .00055*max(0, math.sin(a*3-st['p']*41))**12
    crown = math.exp(-((d-crown_radius)/.0011)**2)*(.00135*(.85+.30*math.sin(a*5-st['p']*49))+tongues)*st['impact']
    value = st['level']+wave+(crater+crown)*fade+.00017*t**24
    c, s = math.cos(st['tilt']), math.sin(st['tilt'])
    local_y = y*c+(st['level']-PIVOT)*s
    local_r = math.hypot(x, local_y)
    floor_world = PIVOT+(floor_at(local_r)-PIVOT+y*s)/c
    return max(value, floor_world+.00012)


def surface_vertices(st, crema=False, segments=128, rings=40):
    cy, radii = boundary(st['level'], st['tilt'], segments)
    verts = []
    for i in range(rings+1):
        for j in range(1 if i == 0 else segments):
            t, a = (i/rings)**1.35, TAU*j/segments
            r = 0 if i == 0 else t*radii[j]
            x, y = r*math.cos(a), cy+r*math.sin(a)
            z = height_at(st, x, y, t)
            if crema:
                z += .000065
            verts.append((x, y, z))
    return verts


def volume_vertices(st, segments=128):
    verts = []
    for i in range(11):
        h = .0112+(st['level']-.0112)*i/10
        cy, radii = boundary(h, st['tilt'], segments)
        for j in range(segments):
            a = TAU*j/segments
            verts.append((radii[j]*math.cos(a), cy+radii[j]*math.sin(a), h+(.00017 if i == 10 else 0)))
    return verts


def stream_vertices(st):
    verts = []
    top = .183
    contact = height_at(st, st['ix'], st['iy'])-.00008
    end = top+(contact-top)*smooth(.235, .29, st['p'])
    v0 = .46
    full_travel = (math.sqrt(v0*v0+19.62*(top-contact))-v0)/9.81
    for i in range(STREAM_RINGS+1):
        t = i/STREAM_RINGS
        z = end+(top-end)*t
        velocity = math.sqrt(v0*v0+19.62*(top-z))
        travel = (velocity-v0)/9.81
        time = st['p']*5-travel
        flow = smooth(.235, .29, st['p'])*(1-smooth(.69, .765, st['p']+(full_travel-travel)/5))
        foot = 1-smooth(0, .026, t)
        radius = .0032*math.sqrt(v0/velocity)*math.sqrt(flow)*(1+.34*st['impact']*foot)
        pulse = 1+.10*math.sin(time*34)+.045*math.sin(time*73+.8)
        cx = st['ix']+t*(.00090*math.sin(time*16)+.00035*math.sin(time*37+t*3))
        cy = st['iy']+.0022*t-.00060*t*math.sin(time*21+.6)
        for j in range(STREAM_SIDES+1):
            a = TAU*j/STREAM_SIDES
            capillary = .18*math.sin((top-z)*430-st['p']*107)+.075*math.sin((top-z)*900-st['p']*173+a*2)
            r = radius*pulse*(1+capillary+.075*math.sin(time*39+a*2)+.035*math.sin(time*61-a*3+t*8))
            oval = 1+.16*math.sin((top-z)*145-st['p']*41)*(1-foot)
            verts.append((cx+r*oval*math.cos(a), cy+r/oval*math.sin(a), z))
    return verts


def flow_uv(st, t, a):
    twist = .34*st['phase']*(1-t)**2+.012*math.sin(a*3+st['phase']*8+t*10)*st['agitation']
    advected = t*(1-.18*st['phase']*(1-t))
    return (.5+.5*advected*math.cos(a+twist), .5+.5*advected*math.sin(a+twist))


def foam_coverage(st, x, y):
    d, a = math.hypot(x-st['ix'], y-st['iy']), math.atan2(st['iy']-y, x-st['ix'])
    edge = .0045*(1+.18*math.sin(a*3+st['phase']*7)+.09*math.sin(a*5-st['phase']*11))
    return 1-.97*st['impact']*(1-smooth(.0019, edge, d))


def bubble(st, i, section):
    cy, radii = section
    local, rim = i % 72, i < 72
    age = ((min(st['p'], .765)-.29)*9+local*.618034+20) % 1
    a = local*2.39996+.18*st['phase']+(0 if rim else age*.55)
    j = round(a % TAU/TAU*len(radii)) % len(radii)
    fraction = .84+.13*((local*.618034) % 1) if rim else .18+.57*age
    r = radii[j]*fraction
    x, y = r*math.cos(a), cy+r*math.sin(a)
    birth = smooth(0, .12, age)*(1-smooth(.86, 1, age))
    size = (.00013+.00055*((i*.431) % 1)**3)*(1 if rim else birth*(.4+.6*st['agitation']))*math.sqrt(st['foam'])
    return (x, y, height_at(st, x, y, fraction)-.000018), size


def tail_drop(st, i):
    age = (st['p']-(.735+i*.006))*5
    z = .173-.46*age-4.905*age*age
    radius = .00040+.00018*((i*.619) % 1) if age > 0 and z > st['level']+.0006 else 0
    return (st['ix']+.00045*math.sin(i*4.1), st['iy']+.0011, z), radius, 1.25+max(0, age)*2


def splash(st, i):
    t = ((st['p']-.29)*5*4.2+i*.173) % 1
    a, r = i*2.39996+st['p']*11, .0025+.005*t
    size = (.00028+.00014*((i*.431)%1))*st['impact']*(math.sin(math.pi*t)**.55)
    return (st['ix']+r*math.cos(a), st['iy']+r*math.sin(a), st['level']+.0003+.0042*4*t*(1-t)), size
