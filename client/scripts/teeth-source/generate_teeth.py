"""
DentaVault – procedural maxillary tooth crowns (tooth1..tooth8.glb)
Units: millimetres in the field, exported as 1 unit = 1 cm (see SCALE).
Axes (glTF): +Y = occlusal/incisal (up), +Z = buccal/labial (front), +X = mesial.
"""
import numpy as np, json, struct, sys
from skimage.measure import marching_cubes
import fast_simplification
import trimesh

SCALE = 0.1          # mm -> cm units in the GLB
TARGET_TRIS = 5500

# ---------------- helpers ----------------
def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

def smax(a, b, k):
    h = np.clip(0.5 - 0.5 * (b - a) / k, 0, 1)
    return a * h + b * (1 - h) + k * h * (1 - h)

def gauss(x, z, cx, cz, sx, sz):
    return np.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2))

def seg_dist(x, z, p, q):
    p = np.asarray(p, float); q = np.asarray(q, float)
    d = q - p
    t = np.clip(((x - p[0]) * d[0] + (z - p[1]) * d[1]) / (d @ d), 0, 1)
    return np.hypot(x - (p[0] + t * d[0]), z - (p[1] + t * d[1]))

def groove(x, z, pts, depth, width):
    """Fissure along a polyline: returns depth profile (>=0)."""
    d = np.full_like(x, 1e9)
    for p, q in zip(pts[:-1], pts[1:]):
        d = np.minimum(d, seg_dist(x, z, p, q))
    return depth * np.exp(-(d / width) ** 2)

def ridge(x, z, p, q, amp, width):
    return amp * np.exp(-(seg_dist(x, z, p, q) / width) ** 2)

def side_field(x, z, a, bb, bl, n):
    """Asymmetric superellipse cross-section (bb labial/buccal, bl lingual)."""
    bz = np.where(z >= 0, bb, bl)
    u = (np.abs(x / a) ** n + np.abs(z / bz) ** n) ** (1.0 / n)
    return (u - 1.0) * np.minimum(a, bz)

# ---------------- tooth definitions ----------------
def anterior(P):
    """Incisors and canine."""
    H = P['H']
    def F(x, y, z):
        t = np.clip(y / H, 0, 1.2)
        a = P['a_c'] + (P['a_m'] - P['a_c']) * smoothstep(0, 0.7, t)
        # labial: convex, thins toward edge
        bb = P['bb0'] * (1 - 0.82 * t ** 2.2) + 0.25 * np.sin(np.pi * np.clip(t, 0, 1)) * P.get('bb_bulge', 1)
        # lingual: cingulum near base, fossa, thin edge
        # smooth taper from cingulum to edge, gentle cingulum bulge, SHALLOW central fossa
        bl = 0.5 + P['cing'] * (1 - np.minimum(t, 1)) ** P.get('lp', 1.5) \
             + P.get('cing_b', 0.3) * np.exp(-((t - 0.18) / 0.14) ** 2) * np.exp(-(x / (0.7 * a)) ** 2) \
             - P.get('fossa_d', 0.3) * np.exp(-((t - 0.55) / 0.2) ** 2) * np.exp(-(x / (0.5 * a)) ** 2)
        # marginal ridges on the lingual side
        edge = np.clip(np.abs(x) / a, 0, 1.2)
        bl = bl + 0.5 * P['mr'] * np.exp(-((edge - 0.82) / 0.13) ** 2) * smoothstep(0.1, 0.35, t) * (1 - smoothstep(0.85, 1.0, t))
        if P.get('canine'):
            ridge_w = np.exp(-((x - P['tip_x']) / 1.3) ** 2)
            bb = bb + P.get('lab_r', 0.55) * ridge_w * smoothstep(0.15, 0.6, t) * (1 - smoothstep(0.9, 1.0, t))
            bl = bl + P.get('lin_r', 0.7) * ridge_w * smoothstep(0.2, 0.5, t) * (1 - smoothstep(0.88, 1.0, t))
        # labial developmental depressions (two faint vertical lines)
        bb = bb - 0.06 * (np.exp(-((x - a * 0.33) / 0.5) ** 2) + np.exp(-((x + a * 0.33) / 0.5) ** 2)) * smoothstep(0.3, 0.9, t)
        s = side_field(x, z, a, np.maximum(bb, 0.35), np.maximum(bl, 0.35), P['n'])
        # incisal outline
        if P.get('canine'):
            dx = x - P['tip_x']
            slope = np.where(dx > 0, P['slope_m'], P['slope_d'])
            top = H - slope * np.sqrt(dx ** 2 + 0.15)
        else:
            # mamelon-free adult edge, very slightly curved
            top = H - 0.08 * (x / P['a_m']) ** 2 - P.get('dround', 0.6) * smoothstep(0.35, 1.0, -x / P['a_m']) ** 2
        k = P['k_dis'] + (P['k_mes'] - P['k_dis']) * smoothstep(-P['a_m'], P['a_m'], x)
        f = smax(s, y - top, k)
        return np.maximum(f, -y)
    return F

def posterior(P):
    H = P['H']
    sh = P.get('shear', 0.0)
    def F(x, y, z):
        z = z + P.get('lean', 0.0) * np.clip(y, 0, None)   # mandibular lingual crown tilt
        xs = x - sh * z                       # rhomboid shear
        t = y / H
        hc = P['contour']                     # height of contour (fraction)
        bulge = np.exp(-((t - hc) / 0.38) ** 2)
        bulge_b = np.exp(-((t - P.get('contour_b', hc)) / 0.38) ** 2)
        bulge_l = np.exp(-((t - P.get('contour_l', hc)) / 0.38) ** 2)
        a = P['a_c'] + (P['a_m'] - P['a_c']) * smoothstep(0, hc, t) - 0.35 * smoothstep(hc, 1.0, t)
        bb = P['bb_c'] + (P['bb_m'] - P['bb_c']) * bulge_b
        bl = P['bl_c'] + (P['bl_m'] - P['bl_c']) * bulge_l
        # side features (vertical grooves, Carabelli)
        for g in P.get('side_grooves', []):
            gx, side, depth = g
            w = np.exp(-((xs - gx) / 0.55) ** 2) * smoothstep(0.45, 0.95, t)
            if side > 0: bb = bb - depth * w
            else:        bl = bl - depth * w
        if 'carabelli' in P:
            cx, cy, amp = P['carabelli']
            bl = bl + amp * np.exp(-(((xs - cx) / 1.1) ** 2 + ((y - cy) / 1.1) ** 2))
        # lobe bulges on the buccal/lingual faces
        for (cx, cz, h, sx, sz) in P['cusps']:
            lobe = 0.18 * np.exp(-((xs - cx) / (sx * 0.9)) ** 2) * smoothstep(0.3, 0.8, t)
            if cz > 0: bb = bb + lobe
            else:      bl = bl + lobe
        a = a * (1 - P.get('ling_taper', 0.0) * smoothstep(0, 1, -z / bl))
        s = side_field(xs, z, a, bb, bl, P['n'])
        # ---- occlusal table ----
        rng = np.random.default_rng(P.get('seed', 1))
        cusp_terms = []
        for (cx, cz, h, sx, sz) in P['cusps']:
            ph = rng.uniform(0, 6.28, 4)
            # small low-frequency wobble so the creases between cusps curve naturally
            wob = 0.18 * np.sin(1.3 * xs + ph[0]) * np.sin(1.1 * z + ph[1]) + 0.1 * np.sin(2.3 * xs + 1.7 * z + ph[2])
            r = np.sqrt(((xs - cx) / sx) ** 2 + ((z - cz) / sz) ** 2)
            cusp_terms.append(h * np.exp(-r ** 1.35) + wob * np.exp(-r ** 2))
        # mesial / distal marginal ridges (separate terms -> triangular fossae at the corners)
        zfade = np.exp(-((z - P.get('mr_zc', 0.0)) / (P['bb_m'] * P.get('mr_w', 0.72))) ** 4)
        for sgn in (1, -1):
            cusp_terms.append(P['mr'] * np.exp(-((xs - sgn * P['a_m'] * 0.78) / 0.6) ** 2) * zfade)
        T = np.stack(cusp_terms)
        beta = 7.0
        mx = T.max(0)
        occ_c = mx + np.log(np.exp(beta * (T - mx)).sum(0)) / beta * 0.35
        # fissures: where the two highest slopes meet (narrow V that follows the cusp boundaries)
        Ts = np.sort(T, axis=0)
        gap = Ts[-1] - Ts[-2]
        both = smoothstep(0.15, 0.7, Ts[-2])
        fiss = P.get('fiss', 0.55) * np.exp(-(gap / 0.16) ** 2) * both * smoothstep(0.35, 1.3, -s)  # fade out before the outline
        occ = P['fossa'] - 0.6 + occ_c - fiss
        # ridges that cross the grooves (e.g. oblique ridge, transverse ridge), tapered end to end
        for rd in P.get('ridges', []):
            p, q = np.asarray(rd[0], float), np.asarray(rd[1], float)
            a0, a1, w = (rd[2], rd[2], rd[3]) if len(rd) == 4 else (rd[2], rd[3], rd[4])
            dv = q - p
            tt = np.clip(((xs - p[0]) * dv[0] + (z - p[1]) * dv[1]) / (dv @ dv), 0, 1)
            amp = a0 + (a1 - a0) * tt
            rr = P['fossa'] - 0.6 + amp * np.exp(-(seg_dist(xs, z, p, q) / w) ** 2)
            occ = smax(occ, rr, 0.35)
        # optional short supplemental grooves / pits
        for (pts, depth, width) in P.get('grooves', []):
            occ = occ - groove(xs, z, pts, depth * 0.25, width * 0.5)
        for (px, pz) in P.get('pits', []):
            occ = occ - 0.22 * gauss(xs, z, px, pz, 0.25, 0.25)
        f = smax(s, y - occ, P['k'])
        return np.maximum(f, -y)
    return F

TEETH = {
 1: ('maxillary central incisor', anterior(dict(H=10.5, a_c=3.3, a_m=4.25, bb0=3.4, cing=2.9, cing_w=0.33,
                                               mr=0.55, n=2.3, k_mes=0.25, k_dis=1.3, dround=1.0))),
 2: ('maxillary lateral incisor', anterior(dict(H=9.0, a_c=2.6, a_m=3.25, bb0=3.1, cing=2.7, cing_w=0.30,
                                               mr=0.65, n=2.3, k_mes=0.5, k_dis=1.8, dround=1.4))),
 3: ('maxillary canine', anterior(dict(H=10.0, a_c=2.8, a_m=3.75, bb0=4.0, cing=3.4, cing_w=0.36, mr=0.6,
                                      n=2.2, k_mes=0.6, k_dis=0.9, canine=True, tip_x=0.35,
                                      slope_m=0.62, slope_d=0.75, dround=0.0, bb_bulge=1.3))),
 4: ('maxillary first premolar', posterior(dict(H=8.5, a_c=2.5, a_m=3.5, bb_c=3.6, bb_m=4.6, bl_c=3.2, bl_m=4.2,
        contour=0.45, n=2.4, fossa=6.2, mr=1.0, k=0.6,
        cusps=[(0.15, 2.1, 2.6, 3.0, 1.8), (0.35, -2.3, 2.0, 2.0, 1.5)],
        old_grooves=[([(-2.6, 0.3), (-1.2, 0.05), (1.2, 0.05), (2.6, 0.3)], 1.0, 0.28),
                 ([(2.4, 0.2), (3.3, 0.6)], 0.5, 0.2)],
        pits=[(2.3, 0.15), (-2.3, 0.15)],
        side_grooves=[(2.1, 1, 0.12), (-2.1, 1, 0.12)]))),
 5: ('maxillary second premolar', posterior(dict(H=8.0, a_c=2.4, a_m=3.25, bb_c=3.5, bb_m=4.5, bl_c=3.3, bl_m=4.4,
        contour=0.45, n=2.3, fossa=6.1, mr=1.0, k=0.7,
        cusps=[(0.0, 2.0, 2.3, 2.6, 1.8), (0.0, -2.1, 2.1, 2.5, 1.8)],
        old_grooves=[([(-1.3, 0.0), (1.3, 0.0)], 0.85, 0.26),
                 ([(1.3, 0.0), (2.0, 0.6)], 0.4, 0.2), ([(1.3, 0.0), (2.0, -0.6)], 0.4, 0.2),
                 ([(-1.3, 0.0), (-2.0, 0.6)], 0.4, 0.2), ([(-1.3, 0.0), (-2.0, -0.6)], 0.4, 0.2),
                 ([(0.4, 0.0), (0.6, 1.6)], 0.25, 0.15), ([(-0.5, 0.0), (-0.4, -1.5)], 0.25, 0.15)],
        pits=[(1.5, 0.0), (-1.5, 0.0)]))),
 6: ('maxillary first molar', posterior(dict(H=7.5, a_c=3.8, a_m=4.75, bb_c=4.6, bb_m=5.5, bl_c=4.6, bl_m=5.6,
        contour=0.4, n=2.6, fossa=5.3, mr=0.8, k=0.6, shear=0.22,
        cusps=[(2.3, 2.9, 2.5, 1.9, 1.9), (-2.3, 2.9, 2.3, 1.8, 1.8),
               (1.9, -2.6, 2.8, 2.3, 2.2), (-2.9, -2.7, 1.8, 1.5, 1.6)],
        ridges=[((1.9, -2.6), (-2.3, 2.9), 1.55, 0.75)],
        old_grooves=[([(3.6, 0.3), (2.0, 0.4), (0.5, 0.5)], 0.95, 0.27),     # central groove (mesial part)
                 ([(0.5, 0.5), (0.2, 2.2), (0.0, 4.8)], 0.9, 0.25),      # buccal groove
                 ([(-1.7, 0.6), (-3.5, 0.4)], 0.8, 0.25),               # distal part of central groove
                 ([(-1.7, 0.6), (-1.0, -1.4), (-0.6, -3.6), (-0.4, -5.2)], 0.9, 0.26),  # distolingual groove
                 ([(0.5, 0.5), (-0.3, 0.6), (-1.7, 0.6)], 0.4, 0.18),   # transverse groove of oblique ridge
                 ([(2.0, 0.4), (2.6, 1.6)], 0.35, 0.16), ([(2.0, 0.4), (2.8, -0.9)], 0.35, 0.16),
                 ([(-2.8, 0.5), (-3.2, 1.6)], 0.3, 0.15)],
        pits=[(0.45, 0.5), (-1.7, 0.6), (3.4, 0.3)],
        side_grooves=[(0.0, 1, 0.28), (-0.5, -1, 0.25)],
        carabelli=(2.0, 3.6, 0.55)))),
 7: ('maxillary second molar', posterior(dict(H=7.0, a_c=3.2, a_m=4.1, bb_c=4.5, bb_m=5.4, bl_c=4.2, bl_m=5.0,
        contour=0.4, n=2.4, fossa=5.1, mr=0.75, k=0.65, shear=0.33,
        cusps=[(2.1, 2.8, 2.4, 1.8, 1.9), (-2.0, 2.9, 2.0, 1.6, 1.7),
               (1.4, -2.3, 2.6, 2.4, 2.2), (-2.6, -2.2, 0.9, 1.1, 1.2)],
        ridges=[((1.4, -2.3), (-2.0, 2.9), 1.3, 0.7)],
        old_grooves=[([(3.3, 0.3), (1.8, 0.4), (0.4, 0.5)], 0.9, 0.26),
                 ([(0.4, 0.5), (0.1, 2.4), (0.0, 4.8)], 0.85, 0.24),
                 ([(-1.6, 0.4), (-3.2, 0.3)], 0.7, 0.24),
                 ([(-1.6, 0.4), (-1.2, -1.5), (-1.0, -4.6)], 0.8, 0.25),
                 ([(0.4, 0.5), (-1.6, 0.4)], 0.35, 0.17),
                 ([(1.8, 0.4), (2.5, 1.5)], 0.3, 0.15)],
        pits=[(0.4, 0.5), (-1.6, 0.4)],
        side_grooves=[(0.0, 1, 0.25)]))),
 8: ('maxillary third molar', posterior(dict(H=6.5, a_c=3.2, a_m=4.25, bb_c=4.2, bb_m=5.0, bl_c=3.6, bl_m=4.4,
        contour=0.42, n=2.1, fossa=4.9, mr=0.7, k=0.75, shear=0.25,
        cusps=[(1.8, 2.5, 2.1, 1.8, 1.8), (-1.6, 2.6, 1.7, 1.6, 1.6),
               (0.6, -2.0, 2.2, 2.3, 2.0), (-2.4, -1.6, 0.8, 1.0, 1.0)],
        old_grooves=[([(2.9, 0.2), (1.2, 0.3), (-0.4, 0.2), (-2.7, 0.3)], 0.85, 0.25),
                 ([(0.2, 0.3), (0.0, 2.3), (0.1, 4.3)], 0.7, 0.22),
                 ([(-1.1, 0.2), (-1.0, -1.6), (-1.3, -3.8)], 0.6, 0.22),
                 ([(1.2, 0.3), (2.2, 1.4)], 0.3, 0.14), ([(1.2, 0.3), (1.9, -1.0)], 0.3, 0.14),
                 ([(-0.4, 0.2), (-1.4, 1.5)], 0.3, 0.14), ([(0.6, -0.6), (1.6, -2.5)], 0.25, 0.13),
                 ([(-2.0, 0.3), (-2.6, -0.8)], 0.25, 0.13), ([(0.0, 1.2), (1.1, 2.0)], 0.2, 0.12),
                 ([(-0.5, -1.0), (0.3, -2.3)], 0.22, 0.12)],
        pits=[(0.2, 0.3), (-1.1, 0.2), (1.2, 0.3)],
        side_grooves=[(0.1, 1, 0.18)]))),

 # ---------------- MANDIBULAR (lower) ----------------
 9: ('mandibular central incisor', anterior(dict(H=9.0, a_c=1.75, a_m=2.5, bb0=2.9, cing=2.4, cing_w=0.30,
                                               mr=0.25, n=2.4, k_mes=0.22, k_dis=0.22, dround=0.0))),
 10: ('mandibular lateral incisor', anterior(dict(H=9.5, a_c=1.95, a_m=2.75, bb0=3.1, cing=2.6, cing_w=0.30,
                                               mr=0.3, n=2.4, k_mes=0.25, k_dis=0.55, dround=0.35))),
 11: ('mandibular canine', anterior(dict(H=11.0, a_c=2.7, a_m=3.5, bb0=3.6, cing=2.9, cing_w=0.36, mr=0.35,
                                      n=2.2, k_mes=0.5, k_dis=0.8, canine=True, tip_x=0.7,
                                      slope_m=0.55, slope_d=0.45, dround=0.0, lab_r=0.35, lin_r=0.35))),
 12: ('mandibular first premolar', posterior(dict(H=8.5, a_c=2.5, a_m=3.5, bb_c=3.3, bb_m=3.9, bl_c=2.8, bl_m=3.4,
        contour=0.45, contour_b=0.28, contour_l=0.55, lean=0.2, n=2.3, fossa=5.0, mr=0.75, mr_zc=0.5, mr_w=0.55, k=0.95, fiss=0.35,
        cusps=[(0.1, 1.2, 3.1, 2.6, 2.0), (0.3, -1.6, 1.25, 1.7, 1.5)],
        ridges=[((0.1, 1.0), (0.3, -1.5), 2.5, 1.1, 0.9)],
        old_grooves=[([(1.4, -0.4), (1.9, -1.4), (2.1, -3.6)], 0.8, 0.22)],
        pits=[(1.5, -0.3), (-1.5, -0.3)]))),
 13: ('mandibular second premolar', posterior(dict(H=8.0, a_c=2.5, a_m=3.5, bb_c=3.5, bb_m=4.1, bl_c=3.4, bl_m=4.0,
        contour=0.45, contour_b=0.3, contour_l=0.55, lean=0.18, n=2.2, fossa=5.6, mr=0.9, k=0.65,
        cusps=[(0.0, 1.8, 2.6, 2.7, 1.8), (1.4, -2.1, 2.1, 1.3, 1.3), (-1.5, -2.2, 1.7, 1.1, 1.1)],
        old_grooves=[([(0.0, -0.3), (2.4, 0.1)], 0.85, 0.25), ([(0.0, -0.3), (-2.4, 0.1)], 0.85, 0.25),
                 ([(0.0, -0.3), (0.1, -4.2)], 0.8, 0.24)],
        pits=[(0.0, -0.3)],
        side_grooves=[(0.1, -1, 0.15)]))),
 14: ('mandibular first molar', posterior(dict(H=7.5, a_c=4.6, a_m=5.6, bb_c=4.1, bb_m=4.8, bl_c=3.9, bl_m=4.5,
        contour=0.45, contour_b=0.28, contour_l=0.55, lean=0.12, n=3.4, ling_taper=0.1, fossa=5.2, mr=0.8, k=0.5,
        cusps=[(3.2, 2.3, 2.1, 1.9, 1.8), (-0.3, 2.6, 1.9, 1.7, 1.7), (-3.5, 1.6, 1.4, 1.3, 1.4),
               (2.6, -2.2, 2.6, 2.1, 1.8), (-2.0, -2.2, 2.4, 2.1, 1.8)],
        old_grooves=[([(4.3, 0.1), (1.5, 0.2), (-0.6, 0.1), (-2.6, -0.3), (-4.3, -0.2)], 0.9, 0.26),
                 ([(1.4, 0.2), (1.3, 4.9)], 0.85, 0.24),            # mesiobuccal groove
                 ([(-2.3, -0.2), (-2.4, 4.4)], 0.75, 0.22),         # distobuccal groove
                 ([(0.6, 0.1), (0.6, -4.8)], 0.85, 0.24),           # lingual groove
                 ([(3.0, 0.1), (3.6, 1.2)], 0.3, 0.14), ([(-0.6, 0.1), (-1.2, -1.3)], 0.3, 0.14)],
        pits=[(0.6, 0.15), (3.8, 0.1), (-3.6, -0.25)],
        side_grooves=[(1.3, 1, 0.22), (-2.3, 1, 0.18), (0.6, -1, 0.18)]))),
 15: ('mandibular second molar', posterior(dict(H=7.0, a_c=4.0, a_m=5.25, bb_c=4.2, bb_m=4.9, bl_c=4.0, bl_m=4.7,
        contour=0.45, contour_b=0.28, contour_l=0.55, lean=0.12, n=3.0, ling_taper=0.05, fossa=5.0, mr=0.8, k=0.55,
        cusps=[(2.4, 2.4, 2.0, 1.8, 1.8), (-2.4, 2.4, 1.9, 1.8, 1.8),
               (2.4, -2.4, 2.4, 1.8, 1.8), (-2.4, -2.4, 2.3, 1.8, 1.8)],
        old_grooves=[([(-4.2, 0.0), (4.2, 0.0)], 0.9, 0.26), ([(0.0, 0.0), (0.0, 4.8)], 0.85, 0.24),
                 ([(0.0, 0.0), (0.0, -4.8)], 0.85, 0.24),
                 ([(2.4, 0.0), (3.0, 1.0)], 0.25, 0.13), ([(-2.4, 0.0), (-3.0, -1.0)], 0.25, 0.13)],
        pits=[(0.0, 0.0), (3.7, 0.0), (-3.7, 0.0)],
        side_grooves=[(0.0, 1, 0.22), (0.0, -1, 0.15)]))),
 16: ('mandibular third molar', posterior(dict(H=7.0, a_c=3.75, a_m=5.0, bb_c=4.0, bb_m=4.75, bl_c=3.8, bl_m=4.5,
        contour=0.45, contour_b=0.3, contour_l=0.55, lean=0.12, n=2.0, fossa=4.9, mr=0.7, k=0.7,
        cusps=[(2.3, 2.2, 1.8, 1.7, 1.7), (-1.0, 2.5, 1.6, 1.5, 1.5), (-3.2, 1.2, 1.0, 1.1, 1.1),
               (2.0, -2.2, 2.1, 1.8, 1.7), (-1.8, -2.0, 1.8, 1.6, 1.6)],
        old_grooves=[([(3.8, 0.1), (1.6, 0.3), (-0.3, -0.1), (-2.4, 0.1), (-3.8, 0.0)], 0.85, 0.25),
                 ([(0.6, 0.2), (0.5, 4.3)], 0.7, 0.22), ([(-2.2, 0.1), (-2.3, 3.8)], 0.5, 0.18),
                 ([(0.2, 0.0), (0.4, -4.3)], 0.7, 0.22),
                 ([(1.6, 0.3), (2.6, 1.3)], 0.28, 0.13), ([(1.6, 0.3), (2.4, -1.0)], 0.28, 0.13),
                 ([(-0.3, -0.1), (-1.3, 1.4)], 0.25, 0.12), ([(-1.0, -0.6), (-0.4, -2.2)], 0.22, 0.12),
                 ([(-2.4, 0.1), (-3.0, -1.2)], 0.22, 0.12), ([(1.0, 1.0), (1.9, 2.2)], 0.2, 0.11)],
        pits=[(0.4, 0.1), (-2.3, 0.1), (3.2, 0.1)],
        side_grooves=[(0.6, 1, 0.15)]))),
}

# ---------------- meshing ----------------
def build(F, res=0.07):
    lim = 7.0
    xs = np.arange(-lim, lim, res); ys = np.arange(-0.5, 12.5, res); zs = np.arange(-lim, lim, res)
    V = np.empty((len(xs), len(ys), len(zs)), np.float32)
    for i0 in range(0, len(xs), 16):           # evaluate in slabs to keep memory low
        X, Y, Z = np.meshgrid(xs[i0:i0 + 16], ys, zs, indexing='ij')
        V[i0:i0 + 16] = F(X, Y, Z)
    verts, faces, _, _ = marching_cubes(V, 0.0, spacing=(res, res, res))
    verts += np.array([xs[0], ys[0], zs[0]])
    m = trimesh.Trimesh(verts, faces, process=True)
    # keep largest component only
    comps = m.split(only_watertight=False)
    m = max(comps, key=lambda c: len(c.faces))
    trimesh.smoothing.filter_taubin(m, lamb=0.5, nu=-0.53, iterations=6)
    red = 1 - TARGET_TRIS / len(m.faces)
    v, f = fast_simplification.simplify(m.vertices.astype(np.float32), m.faces.astype(np.int64), target_reduction=red)
    m = trimesh.Trimesh(v, f, process=True)
    m.merge_vertices(); m.remove_unreferenced_vertices()
    if not m.is_watertight:
        trimesh.repair.fill_holes(m)
    if not m.is_watertight:   # retry decimation at a slightly different target
        return build(F, res * 0.97)
    trimesh.repair.fix_normals(m)
    return m

def srgb2lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def colors(m):
    y = m.vertices[:, 1]
    t = (y - y.min()) / (y.max() - y.min())
    ivory = np.array([0.93, 0.88, 0.78]); white = np.array([0.965, 0.955, 0.93]); blue = np.array([0.86, 0.90, 0.95])
    c = ivory[None] * (1 - smoothstep(0.0, 0.55, t))[:, None] + white[None] * smoothstep(0.0, 0.55, t)[:, None]
    c = c * (1 - smoothstep(0.82, 1.0, t))[:, None] + blue[None] * smoothstep(0.82, 1.0, t)[:, None]
    lin = srgb2lin(c)
    return np.hstack([lin, np.ones((len(lin), 1))]).astype(np.float32)

def write_glb(path, m, name):
    v = m.vertices.astype(np.float32)
    n = m.vertex_normals.astype(np.float32)
    c = colors(m)
    idx = m.faces.astype(np.uint32).ravel()
    blobs = [v.tobytes(), n.tobytes(), c.tobytes(), idx.tobytes()]
    offs, buf = [], b''
    for b in blobs:
        offs.append(len(buf)); buf += b
        buf += b'\x00' * ((4 - len(buf) % 4) % 4)
    gl = {
      "asset": {"version": "2.0", "generator": "DentaVault procedural tooth generator"},
      "scene": 0, "scenes": [{"nodes": [0]}],
      "nodes": [{"mesh": 0, "name": name}],
      "meshes": [{"name": name, "primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
                                                "indices": 3, "material": 0}]}],
      "materials": [{"name": "enamel", "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1],
                     "metallicFactor": 0.0, "roughnessFactor": 0.35}}],
      "buffers": [{"byteLength": len(buf)}],
      "bufferViews": [
        {"buffer": 0, "byteOffset": offs[0], "byteLength": len(blobs[0]), "target": 34962},
        {"buffer": 0, "byteOffset": offs[1], "byteLength": len(blobs[1]), "target": 34962},
        {"buffer": 0, "byteOffset": offs[2], "byteLength": len(blobs[2]), "target": 34962},
        {"buffer": 0, "byteOffset": offs[3], "byteLength": len(blobs[3]), "target": 34963}],
      "accessors": [
        {"bufferView": 0, "componentType": 5126, "count": len(v), "type": "VEC3",
         "min": v.min(0).tolist(), "max": v.max(0).tolist()},
        {"bufferView": 1, "componentType": 5126, "count": len(n), "type": "VEC3"},
        {"bufferView": 2, "componentType": 5126, "count": len(c), "type": "VEC4"},
        {"bufferView": 3, "componentType": 5125, "count": len(idx), "type": "SCALAR"}]
    }
    js = json.dumps(gl, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(buf)
    with open(path, 'wb') as fh:
        fh.write(struct.pack('<III', 0x46546C67, 2, total))
        fh.write(struct.pack('<II', len(js), 0x4E4F534A)); fh.write(js)
        fh.write(struct.pack('<II', len(buf), 0x004E4942)); fh.write(buf)

if __name__ == '__main__':
    ids = [int(a) for a in sys.argv[1:]] or list(TEETH)
    for i in ids:
        name, F = TEETH[i]
        m = build(F)
        # center bbox at origin, convert to output units
        m.apply_translation(-m.bounds.mean(0))
        m.apply_scale(SCALE)
        np.save(f'out/tooth{i}_v.npy', m.vertices); np.save(f'out/tooth{i}_f.npy', m.faces)
        write_glb(f'out/tooth{i}.glb', m, name)
        ext = (m.bounds[1] - m.bounds[0]) / SCALE
        print(f'tooth{i}: {name:28s} tris={len(m.faces):5d} watertight={m.is_watertight} '
              f'winding={m.is_winding_consistent} size(mm) W={ext[0]:.1f} H={ext[1]:.1f} D={ext[2]:.1f}')
