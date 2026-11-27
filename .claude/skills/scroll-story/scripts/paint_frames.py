# Turn rendered frames into Van Gogh-style painted frames: glow around lights, then layered brush strokes.
import cv2, numpy as np, sys, os, glob
from concurrent.futures import ProcessPoolExecutor
SRC, DST = sys.argv[1], sys.argv[2]
os.makedirs(DST, exist_ok=True)
def paint(args):
    i, src = args
    im = cv2.imread(src).astype(np.float32)
    # halos around lamps, windows and stars
    bright = np.clip(im - 170, 0, 255)
    im = np.clip(im + cv2.GaussianBlur(bright, (0, 0), 9) * .8 + cv2.GaussianBlur(bright, (0, 0), 28) * .6, 0, 255)
    h, w = im.shape[:2]; rng = np.random.default_rng(7)   # same seed every frame: strokes don't flicker
    g = cv2.GaussianBlur(cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 3)
    gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=5), cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=5)
    jxx, jyy, jxy = [cv2.GaussianBlur(a, (0, 0), 7) for a in (gx * gx, gy * gy, gx * gy)]
    ang = 0.5 * np.arctan2(2 * jxy, jxx - jyy) + np.pi / 2
    canvas = im.copy()
    for li, r in enumerate((6, 3)):
        ref = cv2.GaussianBlur(im, (0, 0), r * .6)
        err = np.abs(canvas - ref).sum(2)
        ys, xs = np.mgrid[0:h:r, 0:w:r]
        pts = np.stack([ys.ravel(), xs.ravel()], 1); rng.shuffle(pts)
        jit = rng.integers(0, r, size=(len(pts), 2)); an = rng.normal(0, .12, len(pts)); ln = rng.uniform(2.2, 3.8, len(pts)); br = rng.uniform(.93, 1.07, len(pts))
        for (y, x), (jy, jx), a0, l0, b0 in zip(pts, jit, an, ln, br):
            y = min(h - 1, y + jy); x = min(w - 1, x + jx)
            if err[y, x] < 18: continue
            a = ang[y, x] + a0; L = r * l0; c = (ref[y, x] * b0).tolist()
            dx, dy = np.cos(a) * L / 2, np.sin(a) * L / 2
            cv2.line(canvas, (int(x - dx), int(y - dy)), (int(x + dx), int(y + dy)), c, max(1, int(r * .6)), cv2.LINE_AA)
    canvas = canvas*.45 + im*.55
    canvas = cv2.addWeighted(canvas, 1.35, cv2.GaussianBlur(canvas,(0,0),1.5), -.35, 0)
    hsv = cv2.cvtColor(np.clip(canvas, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.12, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    cv2.imwrite(f'{DST}/f{i + 1:04d}.webp', out, [cv2.IMWRITE_WEBP_QUALITY, 90])
    return i
files = sorted(glob.glob(SRC + '/*.png'))
with ProcessPoolExecutor(4) as ex:
    for i in ex.map(paint, list(enumerate(files))): pass
print('painted', len(files))
