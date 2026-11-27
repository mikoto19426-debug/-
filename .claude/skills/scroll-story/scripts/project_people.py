# Project each person's head into every frame's camera (same camera path as cafe_scene.py) -> people.json
import bpy, math, json, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
N = 240; R90 = math.pi / 2
PATH = [(0.00, 0.0, 0.0, 1.6, 0, 0), (.09, 0.2, 2.6, 1.6, -4, 14), (.18, .5, 4.4, 1.6, 52, 3), (.31, .25, 9.0, 1.6, 30, -2),
        (.40, .35, 11.6, 1.6, -6, -1), (.49, .35, 12.6, 1.6, -10, -1), (.59, .3, 12.9, 1.6, 52, -6), (.76, -.75, 13.65, 1.45, 50, -4),
        (.90, -.82, 13.8, 1.4, 48, -2), (1.0, -.84, 13.82, 1.4, 48, -2)]
def ease(t): return 4 * t * t * t if t < .5 else 1 - (-2 * t + 2) ** 3 / 2
def path(t):
    for a, b in zip(PATH, PATH[1:]):
        if t <= b[0]:
            k = ease((t - a[0]) / (b[0] - a[0])); return [a[i] + (b[i] - a[i]) * k for i in range(1, 6)]
    return list(PATH[-1][1:])
sc = bpy.context.scene; sc.render.resolution_x, sc.render.resolution_y = 1280, 720
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam)
cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(62); cam.rotation_mode = 'XYZ'
VG = Vector((-1.45, 14.25, 1.32))
people = [('vincent', VG), ('g0', Vector((-2.15, 6.5, 1.25))), ('g1', Vector((-1.05, 6.7, 1.2))), ('g2', Vector((-2.05, 9.3, 1.2))),
          ('g3', Vector((.25, 10.5, 1.25))), ('g4', Vector((-.95, 16.3, 1.2))), ('g5', Vector((-2.05, 16.1, 1.25))),
          ('waiter', Vector((-.95, 11.4, 1.62)))]
WALK = [('w0', 1.0, 1.0, 26, 22), ('w1', 2.0, 1.7, 30, 24), ('w2', 2.5, 2.3, 30.6, 24)]
out = {}
for f in range(N):
    t = f / (N - 1); x, y, z, yaw, pitch = path(t); yw, pt = math.radians(yaw), math.radians(pitch)
    if t > .66:
        d = VG - Vector((x, y, z)); wv = min(1, (t - .66) / .12); wv = wv * wv * (3 - 2 * wv)
        yw += (math.atan2(-d.x, d.y) - yw) * wv; pt += (math.atan2(d.z, Vector((d.x, d.y)).length) - pt) * wv
    cam.location = (x, y, z); cam.rotation_euler = (R90 + pt, 0, yw); bpy.context.view_layer.update()
    pts = list(people)
    k = min(1, max(0, (t - .28) / .3)); k = k * k * (3 - 2 * k)
    for n, x0, x1, ys, dist in WALK: pts.append((n, Vector((x0 + (x1 - x0) * min(1, k * 2), ys - dist * k, 1.62))))
    row = []
    for n, p in pts:
        v = world_to_camera_view(sc, cam, p); dist = (p - cam.location).length
        if v.z > .3 and -.05 < v.x < 1.05 and .0 < v.y < 1.1 and dist < 14:
            row.append([n, round(v.x, 3), round(1 - v.y, 3), round(dist, 1)])
    out[f] = row
json.dump(out, open(sys.argv[-1], 'w'), separators=(',', ':'))
print('ok', sum(len(r) for r in out.values()))
