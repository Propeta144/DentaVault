// Kapareho ng UV atlas ng procedural tooth model.
export const UV_CELLS = {
  occlusal: [0, 2 / 3, 1, 1],
  facial: [0, 1 / 3, 0.5, 2 / 3],
  lingual: [0.5, 1 / 3, 1, 2 / 3],
  mesial: [0, 0, 0.5, 1 / 3],
  distal: [0.5, 0, 1, 1 / 3],
}

export function surfaceForUV([u, v]) {
  for (const [surface, [u0, v0, u1, v1]] of Object.entries(UV_CELLS)) {
    if (u >= u0 && u <= u1 && v >= v0 && v <= v1) return surface
  }
  return 'occlusal'
}
