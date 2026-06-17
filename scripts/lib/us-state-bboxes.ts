export interface StateBbox {
  abbr: string;
  name: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Approximate bounding boxes for US states + DC (for OpenStreetMap queries). */
export const US_STATE_BBOXES: StateBbox[] = [
  { abbr: 'AL', name: 'Alabama', south: 30.14, west: -88.47, north: 35.01, east: -84.89 },
  { abbr: 'AK', name: 'Alaska', south: 51.21, west: -179.15, north: 71.35, east: -129.98 },
  { abbr: 'AZ', name: 'Arizona', south: 31.33, west: -114.82, north: 37.0, east: -109.04 },
  { abbr: 'AR', name: 'Arkansas', south: 33.0, west: -94.62, north: 36.5, east: -89.64 },
  { abbr: 'CA', name: 'California', south: 32.53, west: -124.41, north: 42.01, east: -114.13 },
  { abbr: 'CO', name: 'Colorado', south: 36.99, west: -109.06, north: 41.0, east: -102.04 },
  { abbr: 'CT', name: 'Connecticut', south: 40.98, west: -73.73, north: 42.05, east: -71.79 },
  { abbr: 'DE', name: 'Delaware', south: 38.45, west: -75.79, north: 39.84, east: -75.05 },
  { abbr: 'DC', name: 'District of Columbia', south: 38.79, west: -77.12, north: 38.99, east: -76.91 },
  { abbr: 'FL', name: 'Florida', south: 24.52, west: -87.63, north: 31.0, east: -80.03 },
  { abbr: 'GA', name: 'Georgia', south: 30.36, west: -85.61, north: 35.0, east: -80.84 },
  { abbr: 'HI', name: 'Hawaii', south: 18.91, west: -160.25, north: 22.24, east: -154.81 },
  { abbr: 'ID', name: 'Idaho', south: 41.99, west: -117.24, north: 49.0, east: -111.04 },
  { abbr: 'IL', name: 'Illinois', south: 36.97, west: -91.51, north: 42.51, east: -87.02 },
  { abbr: 'IN', name: 'Indiana', south: 37.77, west: -88.1, north: 41.76, east: -84.78 },
  { abbr: 'IA', name: 'Iowa', south: 40.38, west: -96.64, north: 43.5, east: -90.14 },
  { abbr: 'KS', name: 'Kansas', south: 36.99, west: -102.05, north: 40.0, east: -94.59 },
  { abbr: 'KY', name: 'Kentucky', south: 36.5, west: -89.57, north: 39.15, east: -81.96 },
  { abbr: 'LA', name: 'Louisiana', south: 28.93, west: -94.04, north: 33.02, east: -88.82 },
  { abbr: 'ME', name: 'Maine', south: 42.98, west: -71.08, north: 47.46, east: -66.95 },
  { abbr: 'MD', name: 'Maryland', south: 37.91, west: -79.49, north: 39.72, east: -75.05 },
  { abbr: 'MA', name: 'Massachusetts', south: 41.24, west: -73.51, north: 42.89, east: -69.93 },
  { abbr: 'MI', name: 'Michigan', south: 41.7, west: -90.42, north: 48.3, east: -82.41 },
  { abbr: 'MN', name: 'Minnesota', south: 43.5, west: -97.24, north: 49.38, east: -89.49 },
  { abbr: 'MS', name: 'Mississippi', south: 30.17, west: -91.66, north: 35.0, east: -88.1 },
  { abbr: 'MO', name: 'Missouri', south: 35.99, west: -95.77, north: 40.61, east: -89.1 },
  { abbr: 'MT', name: 'Montana', south: 44.36, west: -116.05, north: 49.0, east: -104.04 },
  { abbr: 'NE', name: 'Nebraska', south: 39.99, west: -104.05, north: 43.0, east: -95.31 },
  { abbr: 'NV', name: 'Nevada', south: 35.0, west: -120.01, north: 42.0, east: -114.04 },
  { abbr: 'NH', name: 'New Hampshire', south: 42.7, west: -72.56, north: 45.31, east: -70.7 },
  { abbr: 'NJ', name: 'New Jersey', south: 38.93, west: -75.56, north: 41.36, east: -73.89 },
  { abbr: 'NM', name: 'New Mexico', south: 31.33, west: -109.05, north: 37.0, east: -103.0 },
  { abbr: 'NY', name: 'New York', south: 40.5, west: -79.76, north: 45.02, east: -71.86 },
  { abbr: 'NC', name: 'North Carolina', south: 33.84, west: -84.32, north: 36.59, east: -75.46 },
  { abbr: 'ND', name: 'North Dakota', south: 45.94, west: -104.05, north: 49.0, east: -96.55 },
  { abbr: 'OH', name: 'Ohio', south: 38.4, west: -84.82, north: 42.0, east: -80.52 },
  { abbr: 'OK', name: 'Oklahoma', south: 33.62, west: -103.0, north: 37.0, east: -94.43 },
  { abbr: 'OR', name: 'Oregon', south: 41.99, west: -124.57, north: 46.29, east: -116.46 },
  { abbr: 'PA', name: 'Pennsylvania', south: 39.72, west: -80.52, north: 42.27, east: -74.69 },
  { abbr: 'RI', name: 'Rhode Island', south: 41.15, west: -71.86, north: 42.02, east: -71.12 },
  { abbr: 'SC', name: 'South Carolina', south: 32.05, west: -83.35, north: 35.22, east: -78.54 },
  { abbr: 'SD', name: 'South Dakota', south: 42.48, west: -104.06, north: 45.95, east: -96.44 },
  { abbr: 'TN', name: 'Tennessee', south: 34.98, west: -90.31, north: 36.68, east: -81.65 },
  { abbr: 'TX', name: 'Texas', south: 25.84, west: -106.65, north: 36.5, east: -93.51 },
  { abbr: 'UT', name: 'Utah', south: 36.99, west: -114.05, north: 42.0, east: -109.04 },
  { abbr: 'VT', name: 'Vermont', south: 42.73, west: -73.44, north: 45.02, east: -71.46 },
  { abbr: 'VA', name: 'Virginia', south: 36.54, west: -83.68, north: 39.47, east: -75.24 },
  { abbr: 'WA', name: 'Washington', south: 45.54, west: -124.76, north: 49.0, east: -116.92 },
  { abbr: 'WV', name: 'West Virginia', south: 37.2, west: -82.64, north: 40.64, east: -77.72 },
  { abbr: 'WI', name: 'Wisconsin', south: 42.49, west: -92.89, north: 47.08, east: -86.25 },
  { abbr: 'WY', name: 'Wyoming', south: 40.99, west: -111.06, north: 45.01, east: -104.05 },
];
