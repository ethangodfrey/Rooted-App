export interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Split a state bbox into a grid of smaller boxes (faster Overpass queries). */
export function tileBbox(bbox: Bbox, cols: number, rows: number): Bbox[] {
  const latStep = (bbox.north - bbox.south) / rows;
  const lonStep = (bbox.east - bbox.west) / cols;
  const tiles: Bbox[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tiles.push({
        south: bbox.south + row * latStep,
        west: bbox.west + col * lonStep,
        north: bbox.south + (row + 1) * latStep,
        east: bbox.west + (col + 1) * lonStep,
      });
    }
  }

  return tiles;
}

export function cityViewbox(lat: number, lon: number, delta = 0.35): string {
  const west = lon - delta;
  const east = lon + delta;
  const north = lat + delta;
  const south = lat - delta;
  return `${west},${north},${east},${south}`;
}
