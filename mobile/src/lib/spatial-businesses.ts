import { supabase } from '@/src/lib/supabase'
import { isValidCoords } from '@/src/lib/geo'

export type MapBounds = {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export type TrackedBusiness = {
  profile_id: string
  role: string
  display_name: string
  vendor_specialties: string[]
  farmer_specialties: string[]
  shopper_zip_code: string | null
  latitude: number
  longitude: number
  business_row_id: string
  entity_kind: 'vendor' | 'farmer' | string
  sell_city: string | null
  sell_state: string | null
}

export type BusinessCluster = {
  id: string
  latitude: number
  longitude: number
  count: number
  businesses: TrackedBusiness[]
}

function cellSizeForZoom(zoomApprox: number): number {
  if (zoomApprox >= 15) return 0.00015
  if (zoomApprox >= 13) return 0.0006
  if (zoomApprox >= 11) return 0.0025
  if (zoomApprox >= 9) return 0.01
  if (zoomApprox >= 7) return 0.04
  return 0.12
}

/** Rough zoom from latitudeDelta (RN maps). */
export function zoomFromLatitudeDelta(latitudeDelta: number): number {
  const delta = Math.max(Math.abs(latitudeDelta), 0.0001)
  return Math.round(Math.log2(360 / delta))
}

export function clusterTrackedBusinesses(
  businesses: TrackedBusiness[],
  zoom: number,
): BusinessCluster[] {
  if (businesses.length === 0) return []

  const cell = cellSizeForZoom(zoom)
  const buckets = new Map<string, TrackedBusiness[]>()

  for (const biz of businesses) {
    const coords = { latitude: biz.latitude, longitude: biz.longitude }
    if (!isValidCoords(coords)) continue
    const lat = coords.latitude
    const lng = coords.longitude
    const key = `${Math.round(lat / cell)}:${Math.round(lng / cell)}`
    const list = buckets.get(key)
    if (list) list.push(biz)
    else buckets.set(key, [biz])
  }

  const clusters: BusinessCluster[] = []
  for (const [key, items] of buckets) {
    const lat =
      items.reduce((sum, b) => sum + Number(b.latitude), 0) / items.length
    const lng =
      items.reduce((sum, b) => sum + Number(b.longitude), 0) / items.length
    if (!isValidCoords({ latitude: lat, longitude: lng })) continue
    clusters.push({
      id: `cluster-${key}`,
      latitude: lat,
      longitude: lng,
      count: items.length,
      businesses: items,
    })
  }
  return clusters
}

export function isValidMapBounds(bounds: MapBounds | null | undefined): bounds is MapBounds {
  if (!bounds) return false
  const { minLat, maxLat, minLng, maxLng } = bounds
  return (
    Number.isFinite(minLat) &&
    Number.isFinite(maxLat) &&
    Number.isFinite(minLng) &&
    Number.isFinite(maxLng) &&
    minLat <= maxLat &&
    minLng <= maxLng &&
    minLat >= -90 &&
    maxLat <= 90 &&
    minLng >= -180 &&
    maxLng <= 180
  )
}

export async function fetchTrackedBusinessesInBounds(
  bounds: MapBounds,
  specialtyFilter?: string[] | null,
): Promise<TrackedBusiness[]> {
  if (!isValidMapBounds(bounds)) return []

  const { data, error } = await supabase.rpc('get_tracked_businesses_in_bounds', {
    min_lat: bounds.minLat,
    max_lat: bounds.maxLat,
    min_lng: bounds.minLng,
    max_lng: bounds.maxLng,
    specialty_filter:
      specialtyFilter && specialtyFilter.length > 0 ? specialtyFilter : null,
  })

  if (error) throw new Error(error.message)

  return ((data ?? []) as TrackedBusiness[])
    .map((row) => ({
      ...row,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      vendor_specialties: row.vendor_specialties ?? [],
      farmer_specialties: row.farmer_specialties ?? [],
    }))
    .filter((row) => isValidCoords(row))
}

export function boundsFromRegion(region: {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}): MapBounds {
  const halfLat = Math.abs(region.latitudeDelta) / 2
  const halfLng = Math.abs(region.longitudeDelta) / 2
  return {
    minLat: region.latitude - halfLat,
    maxLat: region.latitude + halfLat,
    minLng: region.longitude - halfLng,
    maxLng: region.longitude + halfLng,
  }
}
