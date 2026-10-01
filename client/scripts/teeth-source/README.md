# Pinagmulan ng 3D na ngipin (`src/assets/models/teeth.glb`)

- **`generate_teeth.py`**: procedural generator (signed distance field + marching cubes) na gumagawa ng
  16 na crown: `tooth1..8.glb` = upper (central incisor → 3rd molar), `tooth9..16.glb` = lower.
  Sariling gawa ng team, kaya walang third-party license na kailangang banggitin (hindi tulad ng dating
  "Teeth by Poly by Google", CC-BY).
- Axes ng output: +Y = kagat (occlusal/incisal), +Z = facial (labial/buccal), +X = mesial; 1 unit = 1 cm.
  Totoong sukat (hal. upper central incisor 8.5 × 10.5 mm, lower 1st molar 11.2 × 9.7 mm).

## Paano i-regenerate

```bash
# 1. Gumawa ng 16 GLB (kailangan: numpy, scikit-image, fast-simplification, trimesh)
python generate_teeth.py            # gumagawa ng tooth1..tooth16.glb

# 2. I-convert para sa app (UV atlas bawat surface, compression, sukat)
node scripts/prep-procedural-teeth.cjs <folder ng tooth1..16.glb>
#    → src/assets/models/teeth.glb at src/assets/models/teethExtents.json
```

Huwag i-edit nang mano-mano ang `teethExtents.json`: binabasa ito ng `Tooth3D.jsx` (surface
classification) at `Odontogram3D.jsx` (pagitan ng mga ngipin sa arch).
