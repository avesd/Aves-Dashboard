# Avesd Bird Mark

The bird mark has separate artwork for three detail levels. Each level has an
outline and a solid version with the same outer contour.

| Level | Outline | Solid | Reference preview size |
| --- | --- | --- | --- |
| Full | `bird-full-outline.svg` | `bird-full-solid.svg` | 96 px |
| Regular | `bird-regular-outline.svg` | `bird-regular-solid.svg` | 48 px |
| Compact | `bird-compact-outline.svg` | `bird-compact-solid.svg` | 24 px |

Full retains the original thin contour and eye. Regular adjusts the shape,
thickens the contour, and enlarges the eye. Compact simplifies the shape,
strengthens the beak and tail, and omits the eye. Use the artwork for the
appropriate detail level rather than scaling one version across all sizes.

All six files use a 192 × 192 view box and `currentColor`. The eyes in the solid
versions are transparent cutouts, so the mark works on different backgrounds.
