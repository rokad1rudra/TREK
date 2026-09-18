import { useEffect, useRef, useState, useMemo, useCallback, createElement, memo, Fragment } from 'react'
import DOM from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Circle, useMap, Tooltip } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { mapsApi } from '../../api/client'
import { getCategoryIcon, CATEGORY_ICON_MAP } from '../shared/categoryIcons'
import ReservationOverlay from './ReservationOverlay'
import { PluginMapMarkers } from './MapPluginMarkers'
import { useTransportRoutes } from '../../hooks/useTransportRoutes'
import { visibleRouteReservations } from '../../utils/reservationRoutes'
import type { Reservation } from '../../types'
import { POI_CATEGORY_BY_KEY, type Poi } from './poiCategories'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../../constants/mapDefaults'
import { computeMapViewport, TILE_SIZE_RASTER, type ViewportPadding } from '../../utils/mapViewport'

function categoryIconSvg(iconName: string | null | undefined, size: number): string {
  const IconComponent = (iconName && CATEGORY_ICON_MAP[iconName]) || CATEGORY_ICON_MAP['MapPin']
  try {
    return renderToStaticMarkup(createElement(IconComponent, { size, color: 'white', strokeWidth: 2.5 }))
  } catch { return '' }
}
import type { Place } from '../../types'

// Fix default marker icons for vite. `_getIconUrl` is a Leaflet-internal field
// not present in the public typings, so narrow to delete it.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

/**
 * Create a round photo-circle marker.
 * Shows image_url if available, otherwise category icon in colored circle.
 */
function escAttr(s) {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const iconCache = new Map<string, L.DivIcon>()

function createPlaceIcon(place, orderNumbers, isSelected) {
  const cacheKey = `${place.id}:${isSelected}:${place.image_url || ''}:${place.category_color || ''}:${place.category_icon || ''}:${orderNumbers?.join(',') || ''}`
  const cached = iconCache.get(cacheKey)
  if (cached) return cached
  const size = isSelected ? 44 : 36
  const borderColor = isSelected ? '#111827' : (place.category_color || 'white')
  const borderWidth = isSelected ? 3 : 2.5
  const shadow = isSelected
    ? '0 0 0 3px rgba(17,24,39,0.25), 0 4px 14px rgba(0,0,0,0.3)'
    : '0 2px 8px rgba(0,0,0,0.22)'
  const bgColor = place.category_color || '#6b7280'

  // Number badges (bottom-right)
  let badgeHtml = ''
  if (orderNumbers && orderNumbers.length > 0) {
    const label = orderNumbers.join(' · ')
    badgeHtml = `<span style="
      position:absolute;bottom:-4px;right:-4px;
      min-width:18px;height:${orderNumbers.length > 1 ? 16 : 18}px;border-radius:${orderNumbers.length > 1 ? 8 : 9}px;
      padding:0 ${orderNumbers.length > 1 ? 4 : 3}px;
      background:rgba(255,255,255,0.94);
      border:1.5px solid rgba(0,0,0,0.15);
      box-shadow:0 1px 4px rgba(0,0,0,0.18);
      display:flex;align-items:center;justify-content:center;
      font-size:${orderNumbers.length > 1 ? 7.5 : 9}px;font-weight:800;color:#111827;
      font-family:var(--font-system);line-height:1;
      box-sizing:border-box;white-space:nowrap;
    ">${label}</span>`
  }

  // Prefer base64 data URLs (no zoom lag); also accept same-origin proxy URLs as a fallback
  // while the thumb is still being generated in the background
  if (place.image_url && (place.image_url.startsWith('data:') || place.image_url.startsWith('/api/maps/place-photo/'))) {
    const imgIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px;height:${size}px;
        cursor:pointer;position:relative;
      ">
        <div style="
          width:${size}px;height:${size}px;border-radius:50%;
          border:${borderWidth}px solid ${borderColor};
          box-shadow:${shadow};
          overflow:hidden;background:${bgColor};
        ">
          <img src="${place.image_url}" width="${size}" height="${size}" style="display:block;border-radius:50%;object-fit:cover;" />
        </div>
        ${badgeHtml}
      </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      tooltipAnchor: [size / 2 + 6, 0],
    })
    iconCache.set(cacheKey, imgIcon)
    return imgIcon
  }

  const fallbackIcon = L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      border:${borderWidth}px solid ${borderColor};
      box-shadow:${shadow};
      background:${bgColor};
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;position:relative;
      will-change:transform;contain:layout style;
    ">
      ${categoryIconSvg(place.category_icon, isSelected ? 18 : 15)}
      ${badgeHtml}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [size / 2 + 6, 0],
  })
  iconCache.set(cacheKey, fallbackIcon)
  return fallbackIcon
}

// Small coloured pin for an OSM "explore" POI — distinct from the photo-circle
// markers of planned places; the colour matches its pill category.
const poiIconCache = new Map<string, L.DivIcon>()
function createPoiIcon(category: string) {
  const cached = poiIconCache.get(category)
  if (cached) return cached
  const cat = POI_CATEGORY_BY_KEY[category]
  const color = cat?.color || '#6b7280'
  const svg = cat ? renderToStaticMarkup(createElement(cat.Icon, { size: 13, color: 'white', strokeWidth: 2.5 })) : ''
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;">${svg}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    tooltipAnchor: [0, -14],
  })
  poiIconCache.set(category, icon)
  return icon
}

// Clears the hover tooltip the moment the camera starts moving and suppresses
// re-showing it until the move ends: after a click-recenter the marker slides
// away under a stationary cursor, so the browser never fires mouseout — and
// mouseover/mousemove during the pan animation would immediately re-set the
// tooltip we just cleared (#1404).
function CameraHoverGuard({ movingRef, onMoveStart }: { movingRef: { current: boolean }; onMoveStart: () => void }) {
  const map = useMap()
  useEffect(() => {
    const start = () => { movingRef.current = true; onMoveStart() }
    const end = () => { movingRef.current = false }
    map.on('movestart zoomstart', start)
    map.on('moveend zoomend', end)
    return () => { map.off('movestart zoomstart', start); map.off('moveend zoomend', end) }
  }, [map, movingRef, onMoveStart])
  return null
}

// Emits the current viewport bbox on pan/zoom so the POI-explore pill can fetch
// OSM places for the visible area.
function ViewportController({ onViewportChange }: { onViewportChange?: (b: { south: number; west: number; north: number; east: number }) => void }) {
  const map = useMap()
  useEffect(() => {
    if (!onViewportChange) return
    const emit = () => {
      const b = map.getBounds()
      onViewportChange({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() })
    }
    map.whenReady(emit) // ensure the first bbox is captured once the map is laid out
    map.on('moveend', emit)
    map.on('zoomend', emit)
    return () => { map.off('moveend', emit); map.off('zoomend', emit) }
  }, [map, onViewportChange])
  return null
}

interface SelectionControllerProps {
  places: Place[]
  selectedPlaceId: number | null
  dayPlaces: Place[]
  paddingOpts: L.FitBoundsOptions
}

function SelectionController({ places, selectedPlaceId, dayPlaces, paddingOpts }: SelectionControllerProps) {
  const map = useMap()
  const prev = useRef(null)

  useEffect(() => {
    if (selectedPlaceId && selectedPlaceId !== prev.current) {
      // Pan to the selected place without changing zoom. Offset the centre by the
      // side-panel + bottom-inspector padding so the pin lands in the middle of the
      // *visible* map area rather than the geometric centre (where the bottom panel
      // would cover it). Reuses the same paddingOpts the fit-bounds path uses.
      const selected = places.find(p => p.id === selectedPlaceId)
      if (selected?.lat != null && selected?.lng != null) {
        const latlng: [number, number] = [selected.lat, selected.lng]
        const tl = paddingOpts.paddingTopLeft as [number, number] | undefined
        const br = paddingOpts.paddingBottomRight as [number, number] | undefined
        if (tl && br && typeof map.project === 'function' && typeof map.unproject === 'function') {
          const point = map.project(latlng).add([(br[0] - tl[0]) / 2, (br[1] - tl[1]) / 2])
          map.panTo(map.unproject(point), { animate: true })
        } else {
          map.panTo(latlng, { animate: true })
        }
      }
    }
    prev.current = selectedPlaceId
  }, [selectedPlaceId, places, map])

  return null
}

interface MapControllerProps {
  center: [number, number]
  zoom: number
}

function MapController({ center, zoom }: MapControllerProps) {
  const map = useMap()
  const prevCenter = useRef(center)

  useEffect(() => {
    if (prevCenter.current[0] !== center[0] || prevCenter.current[1] !== center[1]) {
      map.setView(center, zoom)
      prevCenter.current = center
    }
  }, [center, zoom, map])

  return null
}

// Fit bounds when places change (fitKey triggers re-fit). On a day selection we
// fit to that day's destinations immediately, then — once the day's route has
// finished computing asynchronously — re-fit once more to include the full route
// polyline, so a route that bulges past its stops stays in view (#1128).
interface BoundsControllerProps {
  hasDayDetail?: boolean
  places: Place[]
  routeCoords: [number, number][]
  fitKey: number
  paddingOpts: L.FitBoundsOptions
  /** The map was built already framed on these places, so the opening fit has nothing to do. */
  framedOnMount?: boolean
}

function BoundsController({ places, routeCoords, fitKey, paddingOpts, hasDayDetail, framedOnMount = false }: BoundsControllerProps) {
  const map = useMap()
  const prevFitKey = useRef(-1)
  const awaitingRoute = useRef(false)
  const fitRan = useRef(false)

  const fitTo = useCallback((coords: [number, number][]) => {
    if (coords.length === 0) return
    try {
      const bounds = L.latLngBounds(coords)
      if (bounds.isValid()) {
        map.fitBounds(bounds, { ...paddingOpts, maxZoom: 16, animate: true })
        if (hasDayDetail) {
          setTimeout(() => map.panBy([0, 150], { animate: true }), 300)
        }
      }
    } catch {}
  }, [map, paddingOpts, hasDayDetail])

  // New fitKey (initial trip fit or a day selection): fit to the destinations now
  // and arm a one-shot re-fit for when the route arrives.
  useEffect(() => {
    if (fitKey === prevFitKey.current) return
    prevFitKey.current = fitKey
    awaitingRoute.current = false
    if (places.length === 0) return
    // The map opened framed on these very places — re-fitting would only re-do that, and its
    // maxZoom would overrule the gentler zoom a single place opens at. Later fits (picking a
    // day) still run.
    if (!fitRan.current && framedOnMount) {
      fitRan.current = true
      return
    }
    fitRan.current = true
    fitTo(places.map(p => [p.lat, p.lng] as [number, number]))
    awaitingRoute.current = true
  }, [fitKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Once the just-selected day's route is ready, expand the fit to include it.
  // One-shot per day-fit, so later route-profile toggles don't re-zoom the map.
  useEffect(() => {
    if (!awaitingRoute.current || routeCoords.length === 0) return
    awaitingRoute.current = false
    fitTo([...places.map(p => [p.lat, p.lng] as [number, number]), ...routeCoords])
  }, [routeCoords]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

interface MapClickHandlerProps {
  onClick: ((e: L.LeafletMouseEvent) => void) | null
}

function ZoomTracker({ onZoomStart, onZoomEnd }: { onZoomStart: () => void; onZoomEnd: () => void }) {
  const map = useMap()
  useEffect(() => {
    map.on('zoomstart', onZoomStart)
    map.on('zoomend', onZoomEnd)
    return () => { map.off('zoomstart', onZoomStart); map.off('zoomend', onZoomEnd) }
  }, [map, onZoomStart, onZoomEnd])
  return null
}

function MapClickHandler({ onClick }: MapClickHandlerProps) {
  const map = useMap()
  useEffect(() => {
    if (!onClick) return
    map.on('click', onClick)
    return () => { map.off('click', onClick) }
  }, [map, onClick])
  return null
}

function MapContextMenuHandler({ onContextMenu }: { onContextMenu: ((e: L.LeafletMouseEvent) => void) | null }) {
  const map = useMap()
  useEffect(() => {
    if (!onContextMenu) return
    map.on('contextmenu', onContextMenu)
    return () => { map.off('contextmenu', onContextMenu) }
  }, [map, onContextMenu])
  return null
}

// Travel times are shown in the day sidebar (per-segment connectors), not on the map.

// Module-level photo cache shared with PlaceAvatar
import { getCached, isLoading, fetchPhoto, onThumbReady, getAllThumbs } from '../../services/photoService'
import { useAuthStore } from '../../store/authStore'
import { useTripStore } from '../../store/tripStore'
import { useGeolocation } from '../../hooks/useGeolocation'
import LocationButton from './LocationButton'

// Live-location rendering inside the Leaflet map. Subscribes via the
// shared useGeolocation hook so the Leaflet and Mapbox variants behave
// identically. Heading is shown as a rotated conic SVG when available.
import type { GeoPosition, TrackingMode } from '../../hooks/useGeolocation'

function LeafletLocationLayer({ position, mode }: { position: GeoPosition | null; mode: TrackingMode }) {
  const map = useMap()

  // When the user is in follow mode, keep the map centred on the dot.
  // setView (no animation) is what Google Maps does during navigation —
  // it feels responsive and avoids animation jitter at walking speed.
  useEffect(() => {
    if (mode !== 'follow' || !position) return
    try { map.setView([position.lat, position.lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.35 }) } catch { /* noop */ }
  }, [position, mode, map])

  // Once, when the user first acquires a fix in "show" mode, pan to it so
  // they don't have to scroll the map. Subsequent fixes only move the dot.
  const centeredRef = useRef(false)
  useEffect(() => {
    if (mode === 'off') { centeredRef.current = false; return }
    if (!position || centeredRef.current) return
    try { map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15)) } catch { /* noop */ }
    centeredRef.current = true
  }, [position, mode, map])

  if (!position) return null

  const headingIcon = position.heading === null || Number.isNaN(position.heading) ? null : L.divIcon({
    className: '',
    iconSize: [60, 60],
    iconAnchor: [30, 30],
    html: `<div style="
      width:60px;height:60px;
      transform:rotate(${position.heading}deg);transition:transform 120ms ease-out;
      background:conic-gradient(from -30deg, rgba(59,130,246,0) 0deg, rgba(59,130,246,0.35) 15deg, rgba(59,130,246,0) 60deg, rgba(59,130,246,0) 360deg);
      border-radius:50%;
      -webkit-mask:radial-gradient(circle, transparent 12px, black 13px);
      mask:radial-gradient(circle, transparent 12px, black 13px);
      pointer-events:none;
    "></div>`,
  })

  return (
    <>
      {position.accuracy < 500 && (
        <Circle
          center={[position.lat, position.lng]}
          radius={position.accuracy}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.12, weight: 1, opacity: 0.35 }}
          interactive={false}
        />
      )}
      {headingIcon && (
        <Marker
          position={[position.lat, position.lng]}
          icon={headingIcon}
          interactive={false}
          zIndexOffset={900}
        />
      )}
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={8}
        pathOptions={{ color: 'white', fillColor: '#3b82f6', fillOpacity: 1, weight: 3 }}
        interactive={false}
      />
    </>
  )
}

interface MemoMarkerProps {
  place: any
  isSelected: boolean
  orderNumbers: number[] | null
  photoUrl: string | null
  onClickPlace: (id: number) => void
  onHover: (place: any, x: number, y: number) => void
  onHoverOut: () => void
}

const MemoMarker = memo(function MemoMarker({
  place, isSelected, orderNumbers, photoUrl, onClickPlace, onHover, onHoverOut,
}: MemoMarkerProps) {
  const icon = createPlaceIcon({ ...place, image_url: photoUrl }, orderNumbers, isSelected)
  return (
    <Marker
      position={[place.lat, place.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onClickPlace(place.id),
        mouseover: (e: any) => onHover(place, e.originalEvent.clientX, e.originalEvent.clientY),
        mousemove: (e: any) => onHover(place, e.originalEvent.clientX, e.originalEvent.clientY),
        mouseout: onHoverOut,
      }}
      zIndexOffset={isSelected ? 1000 : 0}
    />
  )
})

const startPinIcon = new L.DivIcon({
  className: 'start-map-pin',
  html: `
    <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-100%);">
      <div style="width:34px;height:34px;background:#10b981;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 14px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
        <div style="width:12px;height:12px;background:white;border-radius:50%;"></div>
      </div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
})

const destPinIcon = new L.DivIcon({
  className: 'dest-map-pin',
  html: `
    <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-100%);">
      <div style="width:34px;height:34px;background:#ef4444;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 14px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
        <div style="width:12px;height:12px;background:white;border-radius:50%;"></div>
      </div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
})

function TripRouteController({ route, hasPlaces }: { route: { origin?: { lat: number; lng: number }; destination?: { lat: number; lng: number } } | null; hasPlaces: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!route || hasPlaces) return
    const points: [number, number][] = []
    if (route.origin && Number.isFinite(route.origin.lat) && Number.isFinite(route.origin.lng)) {
      points.push([route.origin.lat, route.origin.lng])
    }
    if (route.destination && Number.isFinite(route.destination.lat) && Number.isFinite(route.destination.lng)) {
      points.push([route.destination.lat, route.destination.lng])
    }
    if (points.length === 2) {
      try {
        const bounds = L.latLngBounds(points)
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [80, 80], maxZoom: 13, animate: true })
        }
      } catch {}
    } else if (points.length === 1) {
      try {
        map.setView(points[0], 10, { animate: true })
      } catch {}
    }
  }, [route, hasPlaces, map])
  return null
}

export const MapView = memo(function MapView({
  places = [],
  dayPlaces = [],
  originLocation,
  destinationLocation,
  route = null,
  routeSegments = [],
  selectedPlaceId = null,
  hoverDisabled = false,
  onMarkerClick,
  onMapClick,
  onMapContextMenu = null,
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  fitKey = 0,
  dayOrderMap = {},
  leftWidth = 0,
  rightWidth = 0,
  hasInspector = false,
  hasDayDetail = false,
  reservations = [] as Reservation[],
  showReservationStats = false,
  visibleConnectionIds = [] as number[],
  showTransitRoutes = true,
  onReservationClick,
  pois = [] as Poi[],
  onPoiClick,
  onViewportChange,
  tripId,
}: any) {
  const currentTrip = useTripStore(s => s.trip)
  const { position: userPosition, mode: trackingMode, error: trackingError, cycleMode: cycleTrackingMode } = useGeolocation()

  type LocationPoint = { lat: number; lng: number; title: string }
  const [tripRoute, setTripRoute] = useState<{ origin?: LocationPoint; destination?: LocationPoint } | null>(null)

  const origName = originLocation || currentTrip?.origin_location
  let destName = destinationLocation || currentTrip?.destination_location
  if (!destName && currentTrip?.title) {
    const match = currentTrip.title.match(/Trip to (.+)/i)
    if (match) {
      destName = match[1].trim()
    } else {
      destName = currentTrip.title.trim()
    }
  }

  useEffect(() => {
    if (!origName && !destName && !userPosition) {
      setTripRoute(null)
      return
    }

    let isMounted = true
    const fetchRoute = async () => {
      let origPoint: LocationPoint | undefined
      let destPoint: LocationPoint | undefined

      if (origName) {
        try {
          const res = await mapsApi.search(origName, 'en')
          if (res?.places?.[0] && res.places[0].lat != null && res.places[0].lng != null) {
            const geocodedLat = Number(res.places[0].lat)
            const geocodedLng = Number(res.places[0].lng)

            let startLat = geocodedLat
            let startLng = geocodedLng

            // If user's live GPS is active and nearby (within 15 km of geocoded start location),
            // start the route directly at the user's exact live location (blue dot)
            if (userPosition && Number.isFinite(userPosition.lat) && Number.isFinite(userPosition.lng)) {
              const dLat = (userPosition.lat - geocodedLat) * 111
              const dLng = (userPosition.lng - geocodedLng) * 111 * Math.cos(geocodedLat * (Math.PI / 180))
              const distKm = Math.sqrt(dLat * dLat + dLng * dLng)
              if (distKm <= 15.0) {
                startLat = userPosition.lat
                startLng = userPosition.lng
              }
            }

            origPoint = { lat: startLat, lng: startLng, title: origName }
          }
        } catch {}
      }

      if (!origPoint && userPosition && Number.isFinite(userPosition.lat) && Number.isFinite(userPosition.lng)) {
        origPoint = { lat: userPosition.lat, lng: userPosition.lng, title: 'Current Location' }
      }

      if (!origPoint) {
        origPoint = { lat: 21.1702, lng: 72.8311, title: 'Surat' }
      }

      if (destName) {
        try {
          const res = await mapsApi.search(destName, 'en')
          if (res?.places?.[0] && res.places[0].lat != null && res.places[0].lng != null) {
            destPoint = { lat: Number(res.places[0].lat), lng: Number(res.places[0].lng), title: destName }
          }
        } catch {}
      }

      if (isMounted) {
        if (origPoint || destPoint) {
          setTripRoute({ origin: origPoint, destination: destPoint })
        } else {
          setTripRoute(null)
        }
      }
    }

    fetchRoute()

    if (!origName && !userPosition && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isMounted) {
            const lat = pos.coords.latitude
            const lng = pos.coords.longitude
            setTripRoute(prev => ({
              origin: { lat, lng, title: 'Current Location' },
              destination: prev?.destination
            }))
          }
        },
        () => {},
        { timeout: 5000 }
      )
    }

    return () => { isMounted = false }
  }, [origName, destName, userPosition?.lat, userPosition?.lng])

  interface RoadPathOption {
    id: number
    name: string
    geometry: [number, number][]
    distanceKm: number
    durationText: string
    summary?: string
  }

  const [allRoadPaths, setAllRoadPaths] = useState<RoadPathOption[]>([])
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0)
  const [osrmRoadPath, setOsrmRoadPath] = useState<RoadPathOption | null>(null)
  const [isRouteLoading, setIsRouteLoading] = useState<boolean>(false)
  const [travelMode, setTravelMode] = useState<'driving' | 'bicycling' | 'walking'>('driving')

  const handleSelectRoute = useCallback((idx: number) => {
    if (allRoadPaths[idx]) {
      setSelectedRouteIdx(idx)
      setOsrmRoadPath(allRoadPaths[idx])
    }
  }, [allRoadPaths])

  useEffect(() => {
    if (tripRoute?.origin && tripRoute?.destination) {
      let isMounted = true
      setIsRouteLoading(true)
      mapsApi.route([
        { lat: tripRoute.origin.lat, lng: tripRoute.origin.lng },
        { lat: tripRoute.destination.lat, lng: tripRoute.destination.lng },
      ], travelMode).then((res) => {
        if (isMounted) {
          setIsRouteLoading(false)
          if (res?.geometry && res.geometry.length > 0) {
            const formatDur = (sec: number) => {
              let adjustedSec = sec
              if (travelMode === 'bicycling') {
                adjustedSec = Math.max(sec, Math.round(res.distance / 5))
              } else if (travelMode === 'walking') {
                adjustedSec = Math.max(sec, Math.round(res.distance / 1.333))
              }
              const days = Math.floor(adjustedSec / 86400)
              const hrs = Math.floor((adjustedSec % 86400) / 3600)
              const mins = Math.round((adjustedSec % 3600) / 60)
              if (days >= 1) return hrs > 0 ? `${days}d ${hrs}h` : `${days} days`
              if (hrs >= 1) return `${hrs}h ${mins}m`
              return `${mins} min`
            }

            const mainPath: RoadPathOption = {
              id: 0,
              name: 'Route 1 (Main)',
              geometry: res.geometry,
              distanceKm: Math.round(res.distance / 100) / 10,
              durationText: formatDur(res.duration),
            }

            const altPaths: RoadPathOption[] = (res.alternatives || []).map((alt: any, idx: number) => ({
              id: idx + 1,
              name: `Route ${idx + 2}`,
              geometry: alt.geometry,
              distanceKm: Math.round(alt.distance / 100) / 10,
              durationText: formatDur(alt.duration),
              summary: alt.summary,
            }))

            const paths = [mainPath, ...altPaths]
            setAllRoadPaths(paths)
            setSelectedRouteIdx(0)
            setOsrmRoadPath(mainPath)
          }
        }
      }).catch(() => {
        if (isMounted) {
          setIsRouteLoading(false)
          setAllRoadPaths([])
          setOsrmRoadPath(null)
        }
      })
      return () => { isMounted = false }
    } else {
      setIsRouteLoading(false)
      setAllRoadPaths([])
      setOsrmRoadPath(null)
    }
  }, [tripRoute?.origin?.lat, tripRoute?.origin?.lng, tripRoute?.destination?.lat, tripRoute?.destination?.lng, travelMode])
  const poiMarkers = useMemo(() => (pois as Poi[]).map((poi: Poi) => (
    <Marker
      key={`poi-${poi.osm_id}`}
      position={[poi.lat, poi.lng]}
      icon={createPoiIcon(poi.category)}
      zIndexOffset={500}
      eventHandlers={{ click: () => onPoiClick?.(poi) }}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={1} className="map-tooltip">{poi.name}</Tooltip>
    </Marker>
  )), [pois, onPoiClick])
  const visibleReservations = useMemo(() => (
    visibleRouteReservations(reservations, { visibleConnectionIds, showTransitRoutes })
  ), [reservations, visibleConnectionIds, showTransitRoutes])
  // Real road geometry for car/bus/taxi/bicycle bookings (straight line until it loads/if it fails).
  const transportRoutes = useTransportRoutes(visibleReservations)
  // Dynamic padding: account for sidebars + bottom inspector + day detail panel
  // The chrome overlaying the map (side panels, day detail). Kept as a plain box so both the
  // Leaflet fit options and the opening-camera maths can read the same numbers.
  const paddingBox = useMemo((): ViewportPadding => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (isMobile) return { top: 20, right: 40, bottom: 20, left: 40 }
    return {
      top: 60,
      right: rightWidth + 40,
      bottom: hasInspector ? 320 : hasDayDetail ? 280 : 60,
      left: leftWidth + 40,
    }
  }, [leftWidth, rightWidth, hasInspector, hasDayDetail])

  const paddingOpts = useMemo((): L.FitBoundsOptions => ({
    paddingTopLeft: [paddingBox.left, paddingBox.top],
    paddingBottomRight: [paddingBox.right, paddingBox.bottom],
  }), [paddingBox])

  // Open framed on the places rather than on the caller's default, so a trip in Japan shows
  // Japan straight away instead of the world view followed by a flight across the planet.
  // The initializer runs once, at mount — exactly when this should be decided; afterwards the
  // camera belongs to the user. `framed` is false when no place has coordinates (a new trip),
  // and then the caller's center/zoom stands.
  const [initialView] = useState(() => {
    const framed = computeMapViewport(dayPlaces.length > 0 ? dayPlaces : places, {
      tileSize: TILE_SIZE_RASTER,
      padding: paddingBox,
    })
    return { center: framed?.center ?? center, zoom: framed?.zoom ?? zoom, framed: framed !== null }
  })

  // Hover state for the single tooltip overlay (replaces per-marker <Tooltip>)
  const [hoveredPlace, setHoveredPlace] = useState<any>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const mapMovingRef = useRef(false)

  const handleMarkerHover = useCallback((place: any, x: number, y: number) => {
    if (hoverDisabled || mapMovingRef.current) return
    setHoveredPlace(place)
    setTooltipPos({ x, y })
  }, [hoverDisabled])

  const handleMarkerHoverOut = useCallback(() => {
    setHoveredPlace(null)
    setTooltipPos(null)
  }, [])

  // A marker's DOM node is replaced when it becomes selected (its icon grows
  // 36→44px, and the cluster group re-adds it), so the browser never fires
  // mouseout on the old node and the fixed-position hover tooltip gets orphaned
  // — it hangs on screen and drifts with page scroll. Drop it on any selection
  // change and on any scroll so it can never get stuck.
  useEffect(() => { setHoveredPlace(null); setTooltipPos(null) }, [selectedPlaceId])
  useEffect(() => {
    if (!hoveredPlace) return
    const clear = () => { setHoveredPlace(null); setTooltipPos(null) }
    window.addEventListener('scroll', clear, true)
    return () => window.removeEventListener('scroll', clear, true)
  }, [hoveredPlace])

  const handleMarkerClick = useCallback((id: number) => {
    // Clear the hover card right away: the recenter that follows moves the
    // marker out from under the cursor, so no mouseout will ever fire (#1404).
    setHoveredPlace(null)
    setTooltipPos(null)
    onMarkerClick?.(id)
  }, [onMarkerClick])

  const clearHover = useCallback(() => {
    setHoveredPlace(null)
    setTooltipPos(null)
  }, [])

  // photoUrls: only base64 thumbs for smooth map zoom
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(getAllThumbs)
  const placesPhotosEnabled = useAuthStore(s => s.placesPhotosEnabled)
  // Batch photo state updates through a RAF so N simultaneous photo loads
  // collapse into a single re-render instead of N separate renders.
  const pendingThumbsRef = useRef<Record<string, string>>({})
  const thumbRafRef = useRef<number | null>(null)

  const placeIds = useMemo(() => places.map(p => p.id).join(','), [places])
  // Flattened [lat,lng] points of the selected day's route, so the bounds fit can
  // include the full polyline once it has been computed.
  const routeCoords = useMemo<[number, number][]>(() => (route || []).flat() as [number, number][], [route])
  useEffect(() => {
    if (!places || places.length === 0 || !placesPhotosEnabled) return
    const cleanups: (() => void)[] = []

    const setThumb = (cacheKey: string, thumb: string) => {
      pendingThumbsRef.current[cacheKey] = thumb
      if (thumbRafRef.current !== null) return
      thumbRafRef.current = requestAnimationFrame(() => {
        thumbRafRef.current = null
        const pending = pendingThumbsRef.current
        pendingThumbsRef.current = {}
        setPhotoUrls(prev => {
          const hasChange = Object.entries(pending).some(([k, v]) => prev[k] !== v)
          return hasChange ? { ...prev, ...pending } : prev
        })
      })
    }

    for (const place of places) {
      const cacheKey = place.google_place_id || place.osm_id || `${place.lat},${place.lng}`
      if (!cacheKey) continue

      const cached = getCached(cacheKey)
      if (cached?.thumbDataUrl) {
        setThumb(cacheKey, cached.thumbDataUrl)
        continue
      }

      cleanups.push(onThumbReady(cacheKey, thumb => setThumb(cacheKey, thumb)))

      if (!cached && !isLoading(cacheKey)) {
        const photoId =
          (place.image_url?.startsWith('/api/maps/place-photo/') ? place.image_url : null)
          || place.google_place_id
          || place.osm_id
          || place.image_url
        if (photoId || (place.lat && place.lng)) {
          fetchPhoto(cacheKey, photoId || `coords:${place.lat}:${place.lng}`, place.lat, place.lng, place.name)
        }
      }
    }

    return () => {
      cleanups.forEach(fn => fn())
      if (thumbRafRef.current !== null) {
        cancelAnimationFrame(thumbRafRef.current)
        thumbRafRef.current = null
      }
    }
  }, [placeIds, placesPhotosEnabled])

  const clusterIconCreateFunction = useCallback((cluster) => {
    const count = cluster.getChildCount()
    const size = count < 10 ? 36 : count < 50 ? 42 : 48
    return L.divIcon({
      html: `<div class="marker-cluster-custom" style="width:${size}px;height:${size}px;"><span>${count}</span></div>`,
      className: 'marker-cluster-wrapper',
      iconSize: L.point(size, size),
    })
  }, [])

  const isTouchDevice = typeof window !== 'undefined' && navigator.maxTouchPoints > 0

  const markers = useMemo(() => places.map((place) => {
    const isSelected = place.id === selectedPlaceId
    const pck = place.google_place_id || place.osm_id || `${place.lat},${place.lng}`
    const photoUrl = (pck && photoUrls[pck]) || place.image_url || null
    const orderNumbers = dayOrderMap[place.id] ?? null
    return (
      <MemoMarker
        key={place.id}
        place={place}
        isSelected={isSelected}
        orderNumbers={orderNumbers}
        photoUrl={photoUrl}
        onClickPlace={handleMarkerClick}
        onHover={handleMarkerHover}
        onHoverOut={handleMarkerHoverOut}
      />
    )
  }), [places, selectedPlaceId, dayOrderMap, photoUrls, handleMarkerClick, handleMarkerHover, handleMarkerHoverOut])

  const gpxPolylines = useMemo(() => places.flatMap(place => {
    if (!place.route_geometry) return []
    try {
      const coords = JSON.parse(place.route_geometry) as [number, number][]
      if (!coords || coords.length < 2) return []
      return [(
        <Polyline
          key={`gpx-${place.id}`}
          positions={coords}
          color={place.category_color || '#3b82f6'}
          weight={3.5}
          opacity={0.75}
        />
      )]
    } catch { return [] }
  }), [places])

  const TooltipOverlay = !hoverDisabled && hoveredPlace && tooltipPos && !isTouchDevice
  const CatIcon = TooltipOverlay ? getCategoryIcon(hoveredPlace.category_icon) : null

  // Desktop browsers only get IP-based geolocation (city-level accuracy),
  // so the button would be misleading. Mobile, where real GPS lives, keeps it.
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  // When the day-detail panel is open it slides up over the map (bottom: navh+20,
  // height var(--day-panel-h)) and covers the button's band, so lift the button
  // above it; otherwise keep the plain bottom-nav offset. #1348
  const locationButtonBottom = hasDayDetail
    ? 'calc(var(--bottom-nav-h, 84px) + 20px + var(--day-panel-h, 0px) + 12px)'
    : 'calc(var(--bottom-nav-h, 84px) + 12px)'

  const startPinMarkerIcon = useMemo(() => {
    const modeEmoji = travelMode === 'driving' ? '🚗' : travelMode === 'bicycling' ? '🚲' : '🚶'
    return L.divIcon({
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:linear-gradient(135deg, #10b981 0%, #059669 100%);border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 4px 14px rgba(16,185,129,0.5);font-size:20px;color:#fff;">
          <span>${modeEmoji}</span>
          <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid #059669;"></div>
        </div>
      `,
      className: 'mode-start-pin-wrapper',
      iconSize: [40, 47],
      iconAnchor: [20, 47],
    })
  }, [travelMode])

  const destPinMarkerIcon = useMemo(() => {
    return L.divIcon({
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 4px 14px rgba(239,68,68,0.5);font-size:20px;color:#fff;">
          <span>📍</span>
          <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid #dc2626;"></div>
        </div>
      `,
      className: 'mode-dest-pin-wrapper',
      iconSize: [40, 47],
      iconAnchor: [20, 47],
    })
  }, [])

  return (
    <>
    <div className="w-full h-full relative">
    <MapContainer
      id="trek-map"
      center={initialView.center}
      zoom={initialView.zoom}
      zoomControl={false}
      className="w-full h-full bg-[#e5e7eb]"
    >
      <TileLayer
        url={
          (tileUrl && !tileUrl.includes('cartocdn.com'))
            ? tileUrl
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        }
        subdomains={['a', 'b', 'c']}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
        maxNativeZoom={19}
        keepBuffer={24}
        updateWhenZooming={false}
        updateWhenIdle={false}
        updateInterval={30}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer-when-downgrade"
      />

      <TripRouteController route={tripRoute} hasPlaces={places.length > 0} />
      <BoundsController places={dayPlaces.length > 0 ? dayPlaces : places} routeCoords={dayPlaces.length > 0 ? routeCoords : []} fitKey={fitKey} paddingOpts={paddingOpts} hasDayDetail={hasDayDetail} framedOnMount={initialView.framed} />
      <SelectionController places={places} selectedPlaceId={selectedPlaceId} dayPlaces={dayPlaces} paddingOpts={paddingOpts} />
      <MapClickHandler onClick={onMapClick} />
      <MapContextMenuHandler onContextMenu={onMapContextMenu} />
      <CameraHoverGuard movingRef={mapMovingRef} onMoveStart={clearHover} />
      <ViewportController onViewportChange={onViewportChange} />
      <LeafletLocationLayer position={userPosition} mode={trackingMode} />

      {/* Start Location Pin with Selected Vehicle/Mode Icon */}
      {tripRoute?.origin && (
        <Marker
          position={[tripRoute.origin.lat, tripRoute.origin.lng]}
          icon={startPinMarkerIcon}
          zIndexOffset={3000}
        >
          <Tooltip permanent direction="top" className="map-tooltip">
            🟢 Start: {tripRoute.origin.title} ({travelMode === 'driving' ? '🚗 Drive' : travelMode === 'bicycling' ? '🚲 Bike' : '🚶 Walk'})
          </Tooltip>
        </Marker>
      )}

      {/* Destination Location Pin */}
      {tripRoute?.destination && (
        <Marker
          position={[tripRoute.destination.lat, tripRoute.destination.lng]}
          icon={destPinMarkerIcon}
          zIndexOffset={3000}
        >
          <Tooltip permanent direction="top" className="map-tooltip">
            📍 Destination: {tripRoute.destination.title}
          </Tooltip>
        </Marker>
      )}

      {/* Alternative Route Polylines (Sleek Black & White dashed candidate routes with wide hit targets) */}
      {allRoadPaths.map((path, idx) => {
        if (idx === selectedRouteIdx) return null
        return (
          <Fragment key={`alt-route-group-${idx}`}>
            {/* Wide Invisible Click Target for Mouse/Touch */}
            <Polyline
              key={`alt-hit-${idx}`}
              positions={path.geometry}
              pathOptions={{ color: 'transparent', weight: 24, opacity: 0.001, lineCap: 'round', lineJoin: 'round' }}
              eventHandlers={{
                click: () => handleSelectRoute(idx),
              }}
            >
              <Tooltip sticky direction="top" className="map-tooltip">
                Alternative {path.name}: {path.distanceKm} km • {path.durationText} (Click to select)
              </Tooltip>
            </Polyline>
            {/* Outer Dark Casing for High Contrast */}
            <Polyline
              key={`alt-casing-${idx}`}
              positions={path.geometry}
              pathOptions={{ color: '#0f172a', weight: 8, opacity: 0.9, dashArray: '10, 10', lineCap: 'round', lineJoin: 'round' }}
              eventHandlers={{
                click: () => handleSelectRoute(idx),
              }}
            />
            {/* Inner Core Line (Crisp White) */}
            <Polyline
              key={`alt-core-${idx}`}
              positions={path.geometry}
              pathOptions={{ color: '#ffffff', weight: 4, opacity: 0.95, dashArray: '10, 10', lineCap: 'round', lineJoin: 'round' }}
              eventHandlers={{
                click: () => handleSelectRoute(idx),
              }}
            />
          </Fragment>
        )
      })}

      {/* Route Path Polyline connecting Start & Destination - Real Road Path or Smooth Curved Animated Path */}
      {tripRoute?.origin && tripRoute?.destination && (
        (() => {
          const pathPoints: [number, number][] = osrmRoadPath?.geometry || (function generateCurvedPathPoints(start: { lat: number; lng: number }, end: { lat: number; lng: number }): [number, number][] {
            const points: [number, number][] = []
            const midLat = (start.lat + end.lat) / 2
            const midLng = (start.lng + end.lng) / 2
            const dLat = end.lat - start.lat
            const dLng = end.lng - start.lng
            const ctrlLat = midLat - dLng * 0.12
            const ctrlLng = midLng + dLat * 0.12

            for (let i = 0; i <= 60; i++) {
              const t = i / 60
              const lat = (1 - t) * (1 - t) * start.lat + 2 * (1 - t) * t * ctrlLat + t * t * end.lat
              const lng = (1 - t) * (1 - t) * start.lng + 2 * (1 - t) * t * ctrlLng + t * t * end.lng
              points.push([lat, lng])
            }
            return points
          })(tripRoute.origin, tripRoute.destination)

          return (
            <>
              {/* Outer Dark Navy Glow Casing */}
              <Polyline
                positions={pathPoints}
                pathOptions={{ color: '#0f172a', weight: 10, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
              />
              {/* Main Path Line (Crisp White Core) */}
              <Polyline
                positions={pathPoints}
                pathOptions={{ color: '#ffffff', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
              />
              {/* Animated Comet Head Pulse */}
              <Polyline
                positions={pathPoints}
                pathOptions={{
                  color: '#475569',
                  weight: 6,
                  opacity: 1,
                  className: 'animated-yellow-comet-flow',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </>
          )
        })()
      )}

      <MarkerClusterGroup
        chunkedLoading
        chunkInterval={30}
        chunkDelay={0}
        maxClusterRadius={30}
        disableClusteringAtZoom={11}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        zoomToBoundsOnClick
        animate={false}
        iconCreateFunction={clusterIconCreateFunction}
      >
        {markers}
      </MarkerClusterGroup>

      {/* Apple-Maps style: darker-blue casing under a bright-blue core, rounded. */}
      {route && route.length > 0 && route.flatMap((seg, i) => seg.length > 1 ? [
        <Polyline
          key={`${i}-casing`}
          positions={seg}
          pathOptions={{ color: '#0a5cc2', weight: 8, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
        />,
        <Polyline
          key={`${i}-core`}
          positions={seg}
          pathOptions={{ color: '#0a84ff', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
        />,
      ] : [])}

      {/* GPX imported route geometries */}
      {gpxPolylines}

      <ReservationOverlay
        reservations={visibleReservations}
        showConnections
        showStats={showReservationStats}
        onEndpointClick={onReservationClick}
        roadRoutes={transportRoutes}
      />

      {poiMarkers}
      <PluginMapMarkers tripId={tripId} />
    </MapContainer>
    {isMobile && <LocationButton
      mode={trackingMode}
      error={trackingError}
      onClick={cycleTrackingMode}
      bottomOffset={locationButtonBottom as unknown as number}
    />}
      {(isRouteLoading || osrmRoadPath) && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[3000] bg-slate-900/95 backdrop-blur-lg text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-2xl border border-indigo-500/30 flex items-center gap-3 animate-fade-in pointer-events-auto">
          {/* Travel Mode Dropdown Menu */}
          <div className="relative flex items-center bg-slate-800/90 rounded-xl px-2.5 py-1 border border-slate-700/80 hover:border-indigo-500/50 transition-all shadow-sm">
            <select
              value={travelMode}
              onChange={(e) => setTravelMode(e.target.value as 'driving' | 'bicycling' | 'walking')}
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-4 appearance-none py-0.5"
            >
              <option value="driving" className="bg-slate-900 text-white py-1">🚗 Drive</option>
              <option value="bicycling" className="bg-slate-900 text-white py-1">🚲 Bike</option>
              <option value="walking" className="bg-slate-900 text-white py-1">🚶 Walk</option>
            </select>
            <span className="pointer-events-none absolute right-2 text-[9px] text-slate-400">▼</span>
          </div>

          {/* Route Options Dropdown Menu */}
          {allRoadPaths.length > 1 && (
            <>
              <div className="h-4 w-px bg-slate-700/80" />
              <div className="relative flex items-center bg-slate-800/90 rounded-xl px-2.5 py-1 border border-slate-700/80 hover:border-purple-500/50 transition-all shadow-sm">
                <select
                  value={selectedRouteIdx}
                  onChange={(e) => handleSelectRoute(Number(e.target.value))}
                  className="bg-transparent text-purple-300 text-xs font-bold focus:outline-none cursor-pointer pr-4 appearance-none py-0.5"
                >
                  {allRoadPaths.map((path, idx) => (
                    <option key={path.id} value={idx} className="bg-slate-900 text-white py-1">
                      {idx === 0 ? '🛣️ Main Route' : `🛣️ Alt Route ${idx}`} ({path.distanceKm} km, {path.durationText})
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 text-[9px] text-purple-400">▼</span>
              </div>
            </>
          )}

          <div className="h-4 w-px bg-slate-700/80" />

          {/* Mode-specific Distance & Duration */}
          {isRouteLoading ? (
            <div className="flex items-center gap-2 text-indigo-300">
              <svg className="w-4 h-4 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Calculating...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">{osrmRoadPath?.distanceKm} km</span>
              <span className="text-slate-400">•</span>
              <span className="text-amber-300 font-bold">{osrmRoadPath?.durationText}</span>
            </div>
          )}
        </div>
      )}
    </div>

    {TooltipOverlay && (
      <div data-testid="tooltip" style={{
        position: 'fixed',
        left: tooltipPos.x + 14,
        top: tooltipPos.y - 10,
        zIndex: 9999,
        pointerEvents: 'none',
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        padding: '6px 10px',
        fontFamily: "var(--font-system)",
        maxWidth: 220,
        whiteSpace: 'nowrap',
      }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {hoveredPlace.name}
        </div>
        {hoveredPlace.category_name && CatIcon && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
            <CatIcon size={10} style={{ color: hoveredPlace.category_color || '#6b7280', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>{hoveredPlace.category_name}</span>
          </div>
        )}
        {hoveredPlace.address && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {hoveredPlace.address}
          </div>
        )}
      </div>
    )}
    </>
  )
})
