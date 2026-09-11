import { useState, useEffect, useRef } from 'react'
import Modal from '../shared/Modal'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Search, MapPin, Check, Loader2, Navigation } from 'lucide-react'
import { mapsApi } from '../../api/client'
import { useTranslation } from '../../i18n'
import { useToast } from '../shared/Toast'

// Custom Pin Marker Icon for map selection
const pinIcon = new L.DivIcon({
  className: 'custom-map-picker-pin',
  html: `
    <div style="
      position: relative;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
    ">
      <div style="
        width: 32px;
        height: 32px;
        background: #4f46e5;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

interface LocationMapPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectLocation: (locationName: string) => void
  title?: string
  initialQuery?: string
}

// Controller component to handle map pan/fly operations
function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.flyTo(center, 13, { duration: 1.2 })
    }
  }, [center, map])
  return null
}

// Click listener inside react-leaflet MapContainer
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function LocationMapPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
  title = 'Pick Location on Map',
  initialQuery = '',
}: LocationMapPickerModalProps) {
  const { t, language } = useTranslation()
  const toast = useToast()

  const [pinnedCoords, setPinnedCoords] = useState<[number, number] | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 78]) // Default near India/Asia or global
  const [locationName, setLocationName] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ placeId: string; mainText: string; secondaryText: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false)

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialQuery.trim()) {
        setSearchQuery(initialQuery)
        mapsApi.search(initialQuery.trim(), language || 'en').then((res) => {
          if (res?.places?.[0] && res.places[0].lat != null && res.places[0].lng != null) {
            const lat = Number(res.places[0].lat)
            const lng = Number(res.places[0].lng)
            setPinnedCoords([lat, lng])
            setMapCenter([lat, lng])
            setLocationName(res.places[0].address || res.places[0].name || initialQuery)
          }
        }).catch(() => {})
      } else {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude
              const lng = pos.coords.longitude
              setMapCenter([lat, lng])
              handleMapClick(lat, lng)
            },
            () => {},
            { timeout: 5000 }
          )
        }
      }
    } else {
      setPinnedCoords(null)
      setLocationName('')
      setSearchQuery('')
      setSuggestions([])
    }
  }, [isOpen])

  const handleMapClick = async (lat: number, lng: number) => {
    setPinnedCoords([lat, lng])
    setIsReverseGeocoding(true)
    try {
      const res = await mapsApi.reverse(lat, lng, language || 'en')
      if (res?.address || res?.name) {
        setLocationName(res.address || res.name)
      } else {
        setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      }
    } catch {
      setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    } finally {
      setIsReverseGeocoding(false)
    }
  }

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (val.trim().length < 2) {
      setSuggestions([])
      return
    }
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await mapsApi.autocomplete(val.trim(), language || 'en')
        setSuggestions(res.suggestions || [])
      } catch {
        setSuggestions([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  const handleSelectSuggestion = async (s: { placeId: string; mainText: string; secondaryText: string }) => {
    setSuggestions([])
    const textQuery = [s.mainText, s.secondaryText].filter(Boolean).join(', ')
    setSearchQuery(textQuery)
    setIsSearching(true)
    try {
      const searchRes = await mapsApi.search(textQuery, language || 'en')
      const place = searchRes?.places?.[0]
      if (place && place.lat != null && place.lng != null) {
        const lat = Number(place.lat)
        const lng = Number(place.lng)
        setPinnedCoords([lat, lng])
        setMapCenter([lat, lng])
        setLocationName(place.address || textQuery)
      }
    } catch {
      toast.error('Could not find location coordinates')
    } finally {
      setIsSearching(false)
    }
  }

  const handleConfirm = () => {
    if (!locationName.trim()) {
      toast.error('Please select or click a location on the map')
      return
    }
    onSelectLocation(locationName)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="space-y-3">
        {/* Search Bar on Map */}
        <div className="relative z-30">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onBlur={() => setTimeout(() => setSuggestions([]), 200)}
              placeholder="Search State, City, or Area (e.g. Surat, Varachha, Tokyo)..."
              className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
            {isSearching && (
              <div className="absolute right-3">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-40 mt-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.placeId}
                  type="button"
                  onMouseDown={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-start gap-2.5 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{s.mainText}</div>
                    {s.secondaryText && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.secondaryText}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map Canvas */}
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-[380px] bg-slate-100 dark:bg-slate-900 z-10">
          <MapContainer
            center={mapCenter}
            zoom={5}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              maxZoom={19}
            />
            <MapController center={mapCenter} />
            <MapClickHandler onClick={handleMapClick} />
            {pinnedCoords && <Marker position={pinnedCoords} icon={pinIcon} />}
          </MapContainer>

          {/* Hint Overlay */}
          <div className="absolute top-3 right-3 z-[400] bg-slate-900/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            Click anywhere on map to drop location pin
          </div>
        </div>

        {/* Selected Location Footer Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
              {isReverseGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Selected Pin Location
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {isReverseGeocoding ? (
                  <span className="text-slate-400 italic">Finding location name...</span>
                ) : locationName ? (
                  locationName
                ) : (
                  <span className="text-slate-400 italic">Click map or search to place pin</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!locationName.trim() || isReverseGeocoding}
              className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Use This Location
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
