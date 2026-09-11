import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  MapPin,
  Calendar,
  IndianRupee,
  Compass,
  Car,
  Clock,
  Plus,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  Sliders,
  Search,
  X,
  CloudSun,
  Hotel,
  Star,
  ExternalLink,
  Activity,
  Users,
  Calculator,
  Train,
  Plane,
  Bus,
  Route,
  Camera,
  Utensils,
} from 'lucide-react'
import PageShell from '../components/Layout/PageShell'
import { useToast } from '../components/shared/Toast'
import { useSettingsStore } from '../store/settingsStore'
import { useTranslation } from '../i18n'
import { tripsApi, daysApi, placesApi, mapsApi, mlApi } from '../api/client'
import { getDestinationCoverImage, DEFAULT_FALLBACK_COVER, useRealPlacePhoto } from '../utils/destinationCovers'

export interface LocationSuggestion {
  placeId: string
  mainText: string
  secondaryText: string
}

export interface ItinerarySpot {
  name: string
  time: string
  period: 'morning' | 'afternoon' | 'evening'
  description: string
  lat: number
  lng: number
  costEst: number
  category: string
  transitFromPrev?: string
}

export interface ItineraryDay {
  dayNumber: number
  title: string
  theme: string
  spots: ItinerarySpot[]
  dailyCost: number
  proTip: string
}

export interface LiveWeatherInfo {
  temp: number
  feelsLike: number
  condition: string
  rainProb: number
  advisory: string
}

export interface HotelSuggestion {
  id: string
  name: string
  tier: 'budget' | 'comfort' | 'luxury'
  roomType?: string
  rating: number
  reviewCount: number
  pricePerNight: number
  perPersonPrice?: number
  currency: string
  photoUrl: string
  amenities: string[]
  area: string
  bookingUrl: string
  googleHotelsUrl: string
}

export interface DestinationActivity {
  id: string
  title: string
  tier?: 'budget' | 'comfort' | 'luxury'
  category: 'Adventure' | 'Heritage' | 'Nature' | 'Wildlife' | 'Food' | 'Water Sports'
  duration: string
  estCost: number
  photoUrl?: string
  description: string
  rating: number
}

export interface TransitLeg {
  legNumber: number
  from: string
  to: string
  mode: 'train' | 'flight' | 'bus' | 'drive' | 'local'
  title: string
  operatorOrService: string
  departureTime: string
  arrivalTime: string
  duration: string
  distanceKm: number
  costPerPerson: number
  bookingUrl: string
  bookingPlatform: string
  guidance: string
}

export interface TransitOption {
  id: 'train_bus' | 'flight_cab' | 'road_trip' | 'direct_bus'
  title: string
  tag: 'Budget Champion' | 'Fastest Route' | 'Epic Road Trip' | 'Direct Transit'
  tagColor: 'emerald' | 'sky' | 'amber' | 'purple'
  totalDurationFormatted: string
  totalDurationHours: number
  transitDaysOutward: number
  transitDaysReturn: number
  estCostPerPerson: number
  totalCostForGroup: number
  legs: TransitLeg[]
  description: string
  highlights: string[]
}

export interface RouteTransitPlan {
  distanceKm: number
  straightLineKm: number
  isLongDistance: boolean
  isMountainRoute: boolean
  hubCity?: string
  options: TransitOption[]
  defaultOption: TransitOption
}

export interface GeneratedPlan {
  tripTitle: string
  origin: string
  destination: string
  zone: string
  travelersCount: number
  coverImage?: string
  totalDistanceKm: number
  drivingHours: number
  recommendedMode: string
  budgetCategory: string
  estTotalCost: number
  costPerPerson: number
  costBreakdown: {
    stay: number
    food: number
    travel: number
    activities: number
    buffer: number
  }
  weather?: LiveWeatherInfo
  famousFoods?: string[]
  hotels?: HotelSuggestion[]
  activities?: DestinationActivity[]
  transitPlan?: RouteTransitPlan
  selectedTransitOption?: TransitOption
  days: ItineraryDay[]
  highlights: string[]
}

const INDIA_CITIES_INDEX: Array<{ mainText: string; secondaryText: string; keywords: string[] }> = [
  // GUJARAT & WEST ZONE
  { mainText: 'Ahmedabad', secondaryText: 'Gujarat, India', keywords: ['ahmedabad', 'ahmdabad', 'amdavad', 'ahmd', 'ahmed', 'gandhinagar'] },
  { mainText: 'Surat', secondaryText: 'Gujarat, India', keywords: ['surat', 'katargam', 'adajan', 'varachha', 'vesu', 'surti', 'dumas'] },
  { mainText: 'Vadodara', secondaryText: 'Gujarat, India', keywords: ['vadodara', 'baroda', 'sayaji'] },
  { mainText: 'Rajkot', secondaryText: 'Gujarat, India', keywords: ['rajkot', 'saurashtra'] },
  { mainText: 'Gandhinagar', secondaryText: 'Gujarat, India', keywords: ['gandhinagar', 'akshardham'] },
  { mainText: 'Bhavnagar', secondaryText: 'Gujarat, India', keywords: ['bhavnagar', 'ghogha'] },
  { mainText: 'Jamnagar', secondaryText: 'Gujarat, India', keywords: ['jamnagar', 'marine national park'] },
  { mainText: 'Junagadh', secondaryText: 'Gujarat, India', keywords: ['junagadh', 'girnar'] },
  { mainText: 'Bhuj', secondaryText: 'Gujarat, India', keywords: ['bhuj', 'kutch', 'rann of kutch', 'white desert'] },
  { mainText: 'Somnath', secondaryText: 'Gujarat, India', keywords: ['somnath', 'jyotirlinga', 'veraval', 'triveni sangam'] },
  { mainText: 'Dwarka', secondaryText: 'Gujarat, India', keywords: ['dwarka', 'dwarkadhish', 'bet dwarka', 'nageshwar'] },
  { mainText: 'Sasan Gir', secondaryText: 'Gujarat, India', keywords: ['sasan gir', 'gir national park', 'lion safari'] },
  { mainText: 'Saputara', secondaryText: 'Gujarat, India', keywords: ['saputara', 'dang', 'gira falls', 'sunset point'] },
  { mainText: 'Statue of Unity (Kevadia)', secondaryText: 'Gujarat, India', keywords: ['kevadia', 'statue of unity', 'sou', 'sardar sarovar', 'ekta nagar'] },

  // MAHARASHTRA & GOA
  { mainText: 'Mumbai', secondaryText: 'Maharashtra, India', keywords: ['mumbai', 'bombay', 'marine drive', 'bandra', 'colaba'] },
  { mainText: 'Pune', secondaryText: 'Maharashtra, India', keywords: ['pune', 'shaniwar wada', 'koregaon park', 'hinjewadi'] },
  { mainText: 'Nashik', secondaryText: 'Maharashtra, India', keywords: ['nashik', 'sula vineyards', 'trimbakeshwar', 'panchavati'] },
  { mainText: 'Chhatrapati Sambhajinagar (Aurangabad)', secondaryText: 'Maharashtra, India', keywords: ['aurangabad', 'sambhajinagar', 'ajanta', 'ellora', 'bibi ka maqbara'] },
  { mainText: 'Nagpur', secondaryText: 'Maharashtra, India', keywords: ['nagpur', 'orange city', 'zero mile'] },
  { mainText: 'Mahabaleshwar & Panchgani', secondaryText: 'Maharashtra, India', keywords: ['mahabaleshwar', 'panchgani', 'arthurs seat', 'venna lake'] },
  { mainText: 'Lonavala & Khandala', secondaryText: 'Maharashtra, India', keywords: ['lonavala', 'khandala', 'tiger point', 'bhushi dam'] },
  { mainText: 'Goa (Panaji & Beaches)', secondaryText: 'Goa, India', keywords: ['goa', 'panaji', 'panjim', 'calangute', 'baga', 'anjuna', 'palolem', 'dudhsagar'] },

  // RAJASTHAN
  { mainText: 'Jaipur', secondaryText: 'Rajasthan, India', keywords: ['jaipur', 'pink city', 'amber fort', 'hawa mahal', 'city palace'] },
  { mainText: 'Udaipur', secondaryText: 'Rajasthan, India', keywords: ['udaipur', 'lake city', 'lake pichola', 'fateh sagar'] },
  { mainText: 'Jodhpur', secondaryText: 'Rajasthan, India', keywords: ['jodhpur', 'blue city', 'mehrangarh fort', 'umaid bhawan'] },
  { mainText: 'Jaisalmer', secondaryText: 'Rajasthan, India', keywords: ['jaisalmer', 'golden city', 'sam sand dunes', 'thar desert'] },
  { mainText: 'Mount Abu', secondaryText: 'Rajasthan, India', keywords: ['mount abu', 'dilwara temples', 'nakki lake', 'guru shikhar'] },

  // NORTH ZONE
  { mainText: 'Delhi NCR', secondaryText: 'National Capital Region, India', keywords: ['delhi', 'new delhi', 'noida', 'gurgaon', 'india gate', 'red fort'] },
  { mainText: 'Manali', secondaryText: 'Himachal Pradesh, India', keywords: ['manali', 'kullu', 'solang valley', 'atal tunnel', 'rohtang pass', 'hadimba'] },
  { mainText: 'Shimla', secondaryText: 'Himachal Pradesh, India', keywords: ['shimla', 'kufri', 'mall road', 'ridge', 'jakhoo'] },
  { mainText: 'Dharamshala & McLeod Ganj', secondaryText: 'Himachal Pradesh, India', keywords: ['dharamshala', 'mcleodganj', 'dalai lama', 'triund', 'bhagsunath'] },
  { mainText: 'Spiti Valley (Kaza)', secondaryText: 'Himachal Pradesh, India', keywords: ['spiti', 'kaza', 'key monastery', 'chandratal', 'hikkim'] },
  { mainText: 'Rishikesh & Haridwar', secondaryText: 'Uttarakhand, India', keywords: ['rishikesh', 'haridwar', 'ganga aarti', 'triveni ghat', 'rafting'] },
  { mainText: 'Dehradun & Mussoorie', secondaryText: 'Uttarakhand, India', keywords: ['dehradun', 'mussoorie', 'kempty falls', 'gun hill'] },
  { mainText: 'Nainital & Jim Corbett', secondaryText: 'Uttarakhand, India', keywords: ['nainital', 'corbett', 'naini lake', 'jungle safari'] },
  { mainText: 'Amritsar', secondaryText: 'Punjab, India', keywords: ['amritsar', 'golden temple', 'wagah border', 'jallianwala bagh'] },
  { mainText: 'Agra', secondaryText: 'Uttar Pradesh, India', keywords: ['agra', 'taj mahal', 'agra fort', 'fatehpur sikri'] },
  { mainText: 'Varanasi', secondaryText: 'Uttar Pradesh, India', keywords: ['varanasi', 'kashi', 'banaras', 'dashashwamedh ghat', 'ganga aarti'] },
  { mainText: 'Srinagar & Gulmarg', secondaryText: 'Jammu & Kashmir, India', keywords: ['srinagar', 'gulmarg', 'dal lake', 'shikara', 'gondola', 'pahalgam'] },
  { mainText: 'Leh Ladakh', secondaryText: 'Ladakh, India', keywords: ['leh', 'ladakh', 'pangong tso', 'nubra valley', 'khardung la'] },

  // SOUTH ZONE
  { mainText: 'Bengaluru', secondaryText: 'Karnataka, India', keywords: ['bengaluru', 'bangalore', 'lalbagh', 'cubbon park'] },
  { mainText: 'Munnar', secondaryText: 'Kerala, India', keywords: ['munnar', 'tea gardens', 'eravikulam', 'mattupetty', 'top station'] },
  { mainText: 'Kochi & Alleppey', secondaryText: 'Kerala, India', keywords: ['kochi', 'cochin', 'alleppey', 'alappuzha', 'backwaters', 'houseboat'] },
  { mainText: 'Ooty & Coonoor', secondaryText: 'Tamil Nadu, India', keywords: ['ooty', 'coonoor', 'nilgiris', 'doddabetta', 'botanical gardens'] },
  { mainText: 'Coorg (Madikeri)', secondaryText: 'Karnataka, India', keywords: ['coorg', 'madikeri', 'abbey falls', 'raja seat', 'talacauvery'] },
  { mainText: 'Hampi', secondaryText: 'Karnataka, India', keywords: ['hampi', 'virupaksha', 'vijayanagara', 'vittala temple'] },
  { mainText: 'Hyderabad', secondaryText: 'Telangana, India', keywords: ['hyderabad', 'charminar', 'golconda', 'hitec city', 'biryani'] },
  { mainText: 'Chennai & Mahabalipuram', secondaryText: 'Tamil Nadu, India', keywords: ['chennai', 'mahabalipuram', 'marina beach', 'shore temple'] },

  // EAST & NORTH-EAST ZONE
  { mainText: 'Kolkata', secondaryText: 'West Bengal, India', keywords: ['kolkata', 'calcutta', 'victoria memorial', 'howrah bridge', 'park street'] },
  { mainText: 'Darjeeling & Kalimpong', secondaryText: 'West Bengal, India', keywords: ['darjeeling', 'kalimpong', 'tiger hill', 'toy train', 'kanchenjunga'] },
  { mainText: 'Puri & Konark', secondaryText: 'Odisha, India', keywords: ['puri', 'konark', 'jagannath temple', 'sun temple', 'golden beach'] },
  { mainText: 'Guwahati & Kaziranga', secondaryText: 'Assam, India', keywords: ['guwahati', 'kaziranga', 'kamakhya temple', 'rhino safari'] },
  { mainText: 'Shillong & Cherrapunji', secondaryText: 'Meghalaya, India', keywords: ['shillong', 'cherrapunji', 'living root bridges', 'dawki', 'umiam'] },
  { mainText: 'Gangtok & Nathu La', secondaryText: 'Sikkim, India', keywords: ['gangtok', 'sikkim', 'nathu la', 'tsomgo lake', 'rumtek'] },
]

function searchIndiaPlaces(queryText: string): LocationSuggestion[] {
  const q = queryText.toLowerCase().trim()
  if (!q || q.length < 2) return []

  const results: LocationSuggestion[] = []
  for (const item of INDIA_CITIES_INDEX) {
    if (
      item.mainText.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q) || q.includes(k))
    ) {
      results.push({
        placeId: `india:${item.mainText.toLowerCase().replace(/\s+/g, '-')}`,
        mainText: item.mainText,
        secondaryText: item.secondaryText,
      })
      if (results.length >= 6) break
    }
  }
  return results
}

export default function AITripPlannerPage(): React.ReactElement {
  const { settings } = useSettingsStore()
  const { locale } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()

  const darkMode = settings.dark_mode
  const dark = darkMode === true || darkMode === 'dark' || (darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Form State
  const [origin, setOrigin] = useState<string>('Surat, Gujarat, India')
  const [destination, setDestination] = useState<string>('Manali, Himachal Pradesh, India')
  const [daysCount, setDaysCount] = useState<number>(5)
  const [travelersCount, setTravelersCount] = useState<number>(4)
  const [selectedBudgetTier, setSelectedBudgetTier] = useState<'budget' | 'comfort' | 'luxury'>('budget')
  const [selectedTransitMode, setSelectedTransitMode] = useState<'train_bus' | 'flight_cab' | 'road_trip'>('train_bus')
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [customBudgetAmount, setCustomBudgetAmount] = useState<string>('25000')
  const [customActivity, setCustomActivity] = useState<string>('Mountains, Trekking, Local Food, Photography')
  const [travelPace, setTravelPace] = useState<'relaxed' | 'balanced' | 'explorer'>('balanced')

  // Autocomplete state for Origin
  const [originSuggestions, setOriginSuggestions] = useState<LocationSuggestion[]>([])
  const [isSearchingOrigin, setIsSearchingOrigin] = useState<boolean>(false)
  const [showOriginDropdown, setShowOriginDropdown] = useState<boolean>(false)
  const originDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const originWrapperRef = useRef<HTMLDivElement>(null)

  // Autocomplete state for Destination
  const [destSuggestions, setDestSuggestions] = useState<LocationSuggestion[]>([])
  const [isSearchingDest, setIsSearchingDest] = useState<boolean>(false)
  const [showDestDropdown, setShowDestDropdown] = useState<boolean>(false)
  const destDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const destWrapperRef = useRef<HTMLDivElement>(null)

  // Generation & Results State
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [isSavingTrip, setIsSavingTrip] = useState<boolean>(false)
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)
  const [expandedDay, setExpandedDay] = useState<number | null>(1)

  // Real-world authentic photography resolver
  const liveDestinationPhoto = useRealPlacePhoto(destination)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (originWrapperRef.current && !originWrapperRef.current.contains(e.target as Node)) {
        setShowOriginDropdown(false)
      }
      if (destWrapperRef.current && !destWrapperRef.current.contains(e.target as Node)) {
        setShowDestDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle Origin Change
  const handleOriginChange = (val: string) => {
    setOrigin(val)
    setShowOriginDropdown(true)
    if (originDebounce.current) clearTimeout(originDebounce.current)
    if (val.trim().length < 2) {
      setOriginSuggestions([])
      return
    }

    const localHits = searchIndiaPlaces(val)
    if (localHits.length > 0) setOriginSuggestions(localHits)

    originDebounce.current = setTimeout(async () => {
      setIsSearchingOrigin(true)
      try {
        const queryWithIndia = val.toLowerCase().includes('india') ? val.trim() : `${val.trim()}, India`
        const res = await mapsApi.autocomplete(queryWithIndia, locale || 'en')
        const rawSuggestions: LocationSuggestion[] = res.suggestions || []
        const merged = [...localHits]
        for (const item of rawSuggestions) {
          if (!merged.some((m) => m.mainText.toLowerCase() === item.mainText.toLowerCase())) {
            merged.push(item)
          }
        }
        setOriginSuggestions(merged.slice(0, 6))
      } catch {
        if (localHits.length > 0) setOriginSuggestions(localHits)
        else setOriginSuggestions([])
      } finally {
        setIsSearchingOrigin(false)
      }
    }, 250)
  }

  const handleSelectOriginSuggestion = (s: LocationSuggestion) => {
    const full = s.secondaryText.includes('India') ? `${s.mainText}, ${s.secondaryText}` : `${s.mainText}, ${s.secondaryText}, India`
    setOrigin(full)
    setOriginSuggestions([])
    setShowOriginDropdown(false)
  }

  // Handle Destination Change
  const handleDestChange = (val: string) => {
    setDestination(val)
    setShowDestDropdown(true)
    if (destDebounce.current) clearTimeout(destDebounce.current)
    if (val.trim().length < 2) {
      setDestSuggestions([])
      return
    }

    const localHits = searchIndiaPlaces(val)
    if (localHits.length > 0) setDestSuggestions(localHits)

    destDebounce.current = setTimeout(async () => {
      setIsSearchingDest(true)
      try {
        const queryWithIndia = val.toLowerCase().includes('india') ? val.trim() : `${val.trim()}, India`
        const res = await mapsApi.autocomplete(queryWithIndia, locale || 'en')
        const rawSuggestions: LocationSuggestion[] = res.suggestions || []
        const merged = [...localHits]
        for (const item of rawSuggestions) {
          if (!merged.some((m) => m.mainText.toLowerCase() === item.mainText.toLowerCase())) {
            merged.push(item)
          }
        }
        setDestSuggestions(merged.slice(0, 6))
      } catch {
        if (localHits.length > 0) setDestSuggestions(localHits)
        else setDestSuggestions([])
      } finally {
        setIsSearchingDest(false)
      }
    }, 250)
  }

  const handleSelectDestSuggestion = (s: LocationSuggestion) => {
    const full = s.secondaryText.includes('India') ? `${s.mainText}, ${s.secondaryText}` : `${s.mainText}, ${s.secondaryText}, India`
    setDestination(full)
    setDestSuggestions([])
    setShowDestDropdown(false)
  }

  // Generate Itinerary Plan using Custom ML Model
  const handleGeneratePlan = async () => {
    if (!origin.trim() || !destination.trim()) {
      toast.error('Please enter both Starting Point and Destination')
      return
    }

    const effectiveDays = Math.max(1, Math.min(60, Number(daysCount) || 5))
    setDaysCount(effectiveDays)

    setIsGenerating(true)
    setGeneratedPlan(null)

    try {
      const payload = {
        origin: origin.trim(),
        destination: destination.trim(),
        people: travelersCount,
        days: effectiveDays,
        budget: Number(customBudgetAmount) || 25000,
        travel_pace: travelPace,
        interests: customActivity.trim() || 'Sightseeing, Local Cuisine, Culture, Photography',
        transit_mode: selectedTransitMode,
        budget_tier: selectedBudgetTier,
        season: 'winter',
        start_date: startDate || undefined,
      }

      // Call Node.js backend Gateway -> Python FastAPI ML Service
      const res = await mlApi.predictTrip(payload)

      if (res) {
        const summary = res.trip_summary || {}
        const trans = res.transport || {}
        const accom = res.accommodation || {}
        const acts = res.activities || {}
        const itin = res.itinerary || res.itinerary_days || []
        const budgetObj = res.budget || {}
        const breakdown = budgetObj.breakdown || res.cost_breakdown || {}

        const effectiveTotalCost = budgetObj.total || res.estimated_total_cost || Number(customBudgetAmount) || 20000
        const effectiveCostPp = budgetObj.cost_per_person || res.cost_per_person || Math.round(effectiveTotalCost / travelersCount)
        const effectiveOrigin = summary.origin || res.origin || origin
        const effectiveDest = summary.destination || res.destination || destination
        const effectiveDistKm = summary.road_distance_km || res.total_distance_km || 450
        const effectiveDrivingHours = summary.driving_duration_hours || res.driving_hours || 7.5
        const effectiveRecommendedMode = trans.recommended?.title || res.recommended_mode || '🚆 Superfast Express'
        const effectiveTitle = summary.title || res.trip_title || `${effectiveDays}-Day ${destination.split(',')[0]} Trip`

        const hotelsList = accom.all_available_options || res.recommended_hotels || (accom.selected ? [accom.selected] : [])
        const activitiesList = acts.top_recommendations || res.recommended_activities || []

        const plan: GeneratedPlan = {
          tripTitle: effectiveTitle,
          origin: effectiveOrigin,
          destination: effectiveDest,
          zone: res.zone || 'Regional Zone',
          travelersCount: summary.people || res.people || travelersCount,
          coverImage: getDestinationCoverImage(`${effectiveDest} ${effectiveTitle}`),
          totalDistanceKm: effectiveDistKm,
          drivingHours: effectiveDrivingHours,
          recommendedMode: effectiveRecommendedMode,
          budgetCategory: selectedBudgetTier.toUpperCase(),
          estTotalCost: effectiveTotalCost,
          costPerPerson: effectiveCostPp,
          costBreakdown: {
            stay: breakdown.accommodation_cost || breakdown.stay || Math.round(effectiveTotalCost * 0.35),
            food: breakdown.food_cost || breakdown.food || Math.round(effectiveTotalCost * 0.25),
            travel: breakdown.transport_cost || breakdown.travel || Math.round(effectiveTotalCost * 0.25),
            activities: breakdown.activity_cost || breakdown.activities || Math.round(effectiveTotalCost * 0.10),
            buffer: breakdown.miscellaneous_cost || breakdown.buffer || Math.round(effectiveTotalCost * 0.05),
          },
          hotels: hotelsList.map((h: any, idx: number) => ({
            id: h.id || `hotel_${idx}_${h.name}`,
            name: h.name,
            tier: h.tier,
            pricePerNight: h.price_per_night,
            rating: h.rating,
            reviewCount: h.review_count || h.reviews_count || 120,
            amenities: h.amenities || [],
            area: h.location_area || h.area || 'Central Tourist Area',
            photoUrl: h.photo_url || getDestinationCoverImage(`${h.name} hotel`),
            bookingUrl: h.booking_url || `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(h.name)}`,
            googleHotelsUrl: h.google_hotels_url || `https://www.google.com/travel/hotels?q=${encodeURIComponent(h.name)}`,
          })),
          activities: activitiesList.map((a: any, idx: number) => ({
            id: a.id || `act_${idx}_${a.title}`,
            title: a.title,
            category: a.category,
            estCost: a.price ?? a.est_cost ?? 50,
            duration: a.duration_formatted || `${a.duration || 1.5}h`,
            rating: a.rating || 4.5,
            description: a.description || a.reason || 'Must-visit regional attraction.',
          })),
          days: itin.map((d: any) => ({
            dayNumber: d.day_number || d.dayNumber,
            title: d.title,
            theme: d.theme || 'Heritage & Exploration',
            spots: (d.schedule || d.spots || []).map((s: any) => ({
              name: s.location || s.name || s.activity,
              time: s.time,
              period: s.period || (s.time?.includes('AM') ? 'Morning' : s.time?.includes('PM') ? 'Afternoon' : 'Day'),
              description: s.activity || s.description || s.name,
              lat: s.lat || 0,
              lng: s.lng || 0,
              costEst: s.estimated_cost ?? s.cost_est ?? 0,
              category: s.item_type || s.category || 'Sightseeing',
              transitFromPrev: s.travel_time ? `${s.travel_time} (${s.travel_distance})` : s.transit_from_prev || '10 mins transit',
            })),
            dailyCost: d.daily_cost || d.dailyCost || Math.round(effectiveTotalCost / effectiveDays),
            proTip: d.day_notes || d.pro_tip || 'Start early to beat crowds.',
          })),
          highlights: res.highlights || (summary.rag_guidance ? summary.rag_guidance.map((g: any) => g.title) : []),
          transitPlan: {
            distanceKm: effectiveDistKm,
            straightLineKm: Math.round(effectiveDistKm * 0.8),
            isLongDistance: effectiveDistKm > 300,
            isMountainRoute: false,
            options: (trans.alternatives || res.ranked_transports || []).map((t: any) => ({
              id: t.id || t.type,
              title: t.title,
              tag: t.suitability_tag || t.tag || 'Recommended',
              tagColor: t.suitability_color || t.tag_color || 'blue',
              totalDurationFormatted: t.duration_formatted,
              totalDurationHours: t.duration_hours,
              transitDaysOutward: 0,
              transitDaysReturn: 0,
              estCostPerPerson: t.price_per_person,
              totalCostForGroup: t.total_cost_for_group,
              legs: [],
              description: t.description,
              highlights: [t.suitability_tag || t.tag || 'Direct Route', `${t.duration_formatted} travel duration`],
            })),
            defaultOption: {
              id: trans.recommended?.id || 'recommended_transit',
              title: effectiveRecommendedMode,
              tag: trans.recommended?.suitability_tag || 'Best Balance',
              tagColor: trans.recommended?.suitability_color || 'emerald',
              totalDurationFormatted: trans.recommended?.duration_formatted || `${effectiveDrivingHours}h`,
              totalDurationHours: trans.recommended?.duration_hours || effectiveDrivingHours,
              transitDaysOutward: 0,
              transitDaysReturn: 0,
              estCostPerPerson: trans.recommended?.price_per_person || Math.round(effectiveTotalCost / Math.max(1, travelersCount)),
              totalCostForGroup: trans.recommended?.total_cost_for_group || effectiveTotalCost,
              legs: [],
              description: trans.recommended?.description || 'Optimal transit selected by ML engine.',
              highlights: ['ML Ranked Route'],
            },
          },
          selectedTransitOption: {
            id: trans.recommended?.id || 'recommended_transit',
            title: effectiveRecommendedMode,
            tag: trans.recommended?.suitability_tag || 'Best Balance',
            tagColor: trans.recommended?.suitability_color || 'emerald',
            totalDurationFormatted: trans.recommended?.duration_formatted || `${effectiveDrivingHours}h`,
            totalDurationHours: trans.recommended?.duration_hours || effectiveDrivingHours,
            transitDaysOutward: 0,
            transitDaysReturn: 0,
            estCostPerPerson: trans.recommended?.price_per_person || Math.round(effectiveTotalCost / Math.max(1, travelersCount)),
            totalCostForGroup: trans.recommended?.total_cost_for_group || effectiveTotalCost,
            legs: [],
            description: trans.recommended?.description || 'Optimal transit selected by ML engine.',
            highlights: ['ML Ranked Route'],
          },
        }

        setGeneratedPlan(plan)
        toast.success(`✨ Itinerary generated by ML Microservice!`)
      }
    } catch (err: any) {
      console.error('Generation error:', err)
      toast.error(err?.response?.data?.error || err?.message || 'Failed to generate trip plan. Please ensure Python ML service is running.')
    } finally {
      setIsGenerating(false)
    }
  }

  // 1-Click Save to My Trips
  const handleSaveToMyTrips = async () => {
    if (!generatedPlan) return

    setIsSavingTrip(true)
    try {
      const coverUrl = getDestinationCoverImage(`${generatedPlan.destination} ${generatedPlan.tripTitle}`)
      const sDate = startDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]
      const sDateObj = new Date(sDate + 'T00:00:00Z')
      const eDateObj = new Date(sDateObj.getTime() + (generatedPlan.days.length - 1) * 86400000)
      const eDate = eDateObj.toISOString().split('T')[0]

      const primaryHotelStr = generatedPlan.hotels?.[0]?.name ? `\nStay: ${generatedPlan.hotels[0].name} (${generatedPlan.hotels[0].area})` : ''
      const created = await tripsApi.create({
        title: generatedPlan.tripTitle,
        origin_location: generatedPlan.origin,
        destination_location: generatedPlan.destination,
        start_date: sDate,
        end_date: eDate,
        day_count: generatedPlan.days.length,
        currency: 'INR',
        cover_image: coverUrl,
        description: `AI Planned Trip from ${generatedPlan.origin} to ${generatedPlan.destination}.\nDistance: ~${generatedPlan.totalDistanceKm} km (${generatedPlan.zone}).\nEst. Budget: ₹${generatedPlan.estTotalCost.toLocaleString('en-IN')}${primaryHotelStr}`,
      })

      const tripId = created?.trip?.id
      if (!tripId) throw new Error('Failed to obtain new trip ID')

      const daysRes = await daysApi.list(tripId)
      const existingDays = daysRes?.days || []

      for (const planDay of generatedPlan.days) {
        const matchingDay = existingDays.find((d: any) => d.day_number === planDay.dayNumber) || existingDays[planDay.dayNumber - 1]
        if (matchingDay) {
          for (let i = 0; i < planDay.spots.length; i++) {
            const spot = planDay.spots[i]
            await placesApi.create(tripId, {
              name: spot.name,
              address: `${spot.name}, ${generatedPlan.destination}`,
              lat: spot.lat,
              lng: spot.lng,
              day_id: matchingDay.id,
              notes: `${spot.time} · ${spot.description}`,
              category: spot.category,
              duration_minutes: 90,
              order_index: i,
            })
          }
        }
      }

      toast.success('🎉 Trip successfully created and saved to My Trips!')
      navigate(`/trips/${tripId}`)
    } catch (err: any) {
      console.error('Error saving AI trip:', err)
      toast.error(err?.message || 'Failed to save trip. Please try again.')
    } finally {
      setIsSavingTrip(false)
    }
  }

  // Switch Transit Mode & Update Plan Logistics
  const handleSwitchTransitMode = (mode: 'train_bus' | 'flight_cab' | 'road_trip') => {
    setSelectedTransitMode(mode)
    if (generatedPlan?.transitPlan) {
      const opt = generatedPlan.transitPlan.options.find(o => o.id === mode) || generatedPlan.transitPlan.defaultOption
      setGeneratedPlan({
        ...generatedPlan,
        selectedTransitOption: opt,
        recommendedMode: opt.title,
      })
      toast.info(`Switched transit mode to ${opt.title}`)
    }
  }

  // Copy Markdown
  const handleCopyMarkdown = () => {
    if (!generatedPlan) return
    let md = `# ${generatedPlan.tripTitle}\n\n`
    md += `**Origin:** ${generatedPlan.origin} | **Destination:** ${generatedPlan.destination}\n`
    md += `**Distance:** ~${generatedPlan.totalDistanceKm} km | **Estimated Budget:** ₹${generatedPlan.estTotalCost.toLocaleString('en-IN')}\n\n`

    if (generatedPlan.weather) {
      md += `### 🌤️ Live Destination Weather:\n`
      md += `- **Temperature:** ${generatedPlan.weather.temp}°C (Feels like ${generatedPlan.weather.feelsLike}°C)\n`
      md += `- **Condition:** ${generatedPlan.weather.condition} | Rain Probability: ${generatedPlan.weather.rainProb}%\n`
      md += `- **Advisory:** ${generatedPlan.weather.advisory}\n\n`
    }

    generatedPlan.days.forEach((d) => {
      md += `## Day ${d.dayNumber}: ${d.title}\n`
      md += `*Theme: ${d.theme}*\n\n`
      d.spots.forEach((s) => {
        md += `- **${s.time}** - **${s.name}** (${s.category})\n  ${s.description}\n`
      })
      md += `\n> 💡 *Pro Tip: ${d.proTip}*\n\n`
    })

    navigator.clipboard.writeText(md)
    toast.success('Itinerary copied to clipboard!')
  }

  return (
    <PageShell
      className="bg-surface-primary text-content transition-colors duration-200"
      contentClassName="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2.5 border border-edge bg-surface-secondary text-content">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI TRIP PLANNING ENGINE</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
          AI Smart Trip & Route Planner
        </h1>
        <p className="text-sm sm:text-base text-content-muted">
          Type your starting point and destination to compute smart multi-day routes, day-by-day stops, budget estimations, and 1-click map exports.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Inputs Column */}
        <div className="lg:col-span-5">
          <div className="p-6 rounded-2xl border border-edge bg-surface-card shadow-sm">
            <h2 className="text-base font-bold mb-5 flex items-center gap-2 text-content">
              <Sliders className="w-4 h-4" />
              Trip Preferences
            </h2>

            {/* From Input with Autocomplete Dropdown */}
            <div className="mb-5 relative" ref={originWrapperRef}>
              <label className="block text-xs font-bold uppercase tracking-wider text-content-muted mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  From (Starting Point)
                </span>
                {isSearchingOrigin && <span className="text-[10px] lowercase text-content-faint">searching...</span>}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => handleOriginChange(e.target.value)}
                  onFocus={() => { if (originSuggestions.length > 0) setShowOriginDropdown(true) }}
                  placeholder="Type any starting city (e.g. Surat, Mumbai, Delhi)..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-content/20 bg-surface-tertiary border-edge text-content"
                />
                <Search className="w-4 h-4 absolute left-3 top-3 text-content-faint" />
                {origin && (
                  <button
                    type="button"
                    onClick={() => { setOrigin(''); setOriginSuggestions([]) }}
                    className="absolute right-2.5 top-2.5 p-0.5 rounded text-content-faint hover:text-content"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showOriginDropdown && originSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border bg-surface-card border-edge shadow-xl max-h-56 overflow-y-auto divide-y divide-edge">
                  {originSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectOriginSuggestion(s)}
                      className="w-full p-2.5 text-left flex items-start gap-2.5 hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-content-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate text-content">{s.mainText}</div>
                        <div className="text-[11px] text-content-muted truncate">{s.secondaryText}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* To Input with Autocomplete Dropdown */}
            <div className="mb-5 relative" ref={destWrapperRef}>
              <label className="block text-xs font-bold uppercase tracking-wider text-content-muted mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  To (Destination)
                </span>
                {isSearchingDest && <span className="text-[10px] lowercase text-content-faint">searching...</span>}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => handleDestChange(e.target.value)}
                  onFocus={() => { if (destSuggestions.length > 0) setShowDestDropdown(true) }}
                  placeholder="Type any destination (e.g. Manali, Munnar, Goa, Ladakh)..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-content/20 bg-surface-tertiary border-edge text-content"
                />
                <Search className="w-4 h-4 absolute left-3 top-3 text-content-faint" />
                {destination && (
                  <button
                    type="button"
                    onClick={() => { setDestination(''); setDestSuggestions([]) }}
                    className="absolute right-2.5 top-2.5 p-0.5 rounded text-content-faint hover:text-content"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showDestDropdown && destSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border bg-surface-card border-edge shadow-xl max-h-56 overflow-y-auto divide-y divide-edge">
                  {destSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDestSuggestion(s)}
                      className="w-full p-2.5 text-left flex items-start gap-2.5 hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <Compass className="w-4 h-4 flex-shrink-0 mt-0.5 text-content-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate text-content">{s.mainText}</div>
                        <div className="text-[11px] text-content-muted truncate">{s.secondaryText}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live Destination Visual Preview */}
            {destination.trim().length >= 2 && (
              <div className="mb-5 rounded-2xl overflow-hidden border border-edge bg-surface-secondary shadow-sm transition-all animate-fadeIn">
                <div className="relative h-32 w-full overflow-hidden bg-surface-tertiary">
                  <img
                    src={liveDestinationPhoto}
                    alt={destination}
                    className="w-full h-full object-cover brightness-95 transition-transform duration-500 hover:scale-105"
                    onError={(e) => { e.currentTarget.src = DEFAULT_FALLBACK_COVER; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent flex flex-col justify-end p-3 text-white">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-white/20 text-white backdrop-blur-md">
                          Real Destination Photo
                        </span>
                        <div className="text-sm font-bold text-white mt-1 drop-shadow-sm truncate">
                          {destination.split(',')[0]}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-white/90 bg-black/40 px-2 py-1 rounded-lg backdrop-blur-md">
                        <Camera className="w-3.5 h-3.5 text-white" />
                        <span>Authentic</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trip Start Date & Duration Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-content-muted mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Start Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-content/20 bg-surface-tertiary border-edge text-content"
                  />
                  <Calendar className="w-4 h-4 absolute left-3 top-3 text-content-faint" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-content-muted mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Duration (Days)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={daysCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      setDaysCount(val > 0 ? val : 1)
                    }}
                    placeholder="e.g. 5"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-content/20 bg-surface-tertiary border-edge text-content"
                  />
                  <Clock className="w-4 h-4 absolute left-3 top-3 text-content-faint" />
                </div>
              </div>
            </div>

            {/* Group Size / Travelers Input */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Travelers (Group Size)
                </label>
                <span className="text-[11px] font-bold text-sky-400">
                  {travelersCount === 1 ? 'Solo Trip' : travelersCount === 2 ? 'Couple / Duo' : `${travelersCount} Travelers (Group)`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { count: 1, label: '1 Solo' },
                  { count: 2, label: '2 Duo' },
                  { count: 4, label: '4 Friends' },
                  { count: 6, label: '6+ Family' },
                ].map((g) => (
                  <button
                    key={g.count}
                    type="button"
                    onClick={() => setTravelersCount(g.count)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      travelersCount === g.count
                        ? 'bg-surface-secondary border-sky-400 text-sky-400 shadow-sm'
                        : 'bg-surface-tertiary border-edge text-content-muted hover:text-content'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget / Expenses Input */}
            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-content-muted mb-1.5 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5" />
                Total Trip Budget (₹ INR)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="500"
                  step="500"
                  value={customBudgetAmount}
                  onChange={(e) => setCustomBudgetAmount(e.target.value)}
                  placeholder="Enter total estimated budget (e.g. 50000)"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-content/20 bg-surface-tertiary border-edge text-content"
                />
                <IndianRupee className="w-4 h-4 absolute left-3 top-3 text-content-faint" />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-content-muted px-1">
                <span>Per Person: <strong className="text-content">₹{Math.round((Number(customBudgetAmount) || 25000) / Math.max(1, travelersCount)).toLocaleString('en-IN')}</strong></span>
                <span>Per Day: <strong className="text-content">₹{Math.round((Number(customBudgetAmount) || 25000) / (Math.max(1, daysCount) * Math.max(1, travelersCount))).toLocaleString('en-IN')} / person</strong></span>
              </div>
            </div>

            {/* Preferred Transit Mode */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5" />
                  Travel & Transit Mode
                </label>
                <span className="text-[11px] font-bold text-emerald-400">
                  {selectedTransitMode === 'train_bus' ? '🚆 Train + Volvo' : selectedTransitMode === 'flight_cab' ? '✈️ Flight + Bus' : '🚗 Road Trip'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'train_bus', label: '🚆 Train + Bus', tag: 'Budget Pick', color: 'emerald' },
                  { id: 'flight_cab', label: '✈️ Flight + Bus', tag: 'Fastest', color: 'sky' },
                  { id: 'road_trip', label: '🚗 Road Trip', tag: 'Stopovers', color: 'amber' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedTransitMode(m.id as any)}
                    className={`py-2 px-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      selectedTransitMode === m.id
                        ? 'bg-surface-secondary border-sky-400 text-sky-400 shadow-sm'
                        : 'bg-surface-tertiary border-edge text-content-muted hover:text-content'
                    }`}
                  >
                    <div className="truncate">{m.label}</div>
                    <div className="text-[9.5px] text-content-faint font-normal">{m.tag}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Activities & Interests Input */}
            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-content-muted mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Activities & Interests
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customActivity}
                  onChange={(e) => setCustomActivity(e.target.value)}
                  placeholder="Type activities (e.g. Mountains, Trekking, Street Food, Photography)..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-content/20 bg-surface-tertiary border-edge text-content"
                />
                <Sparkles className="w-4 h-4 absolute left-3 top-3 text-content-faint" />
              </div>
            </div>

            {/* Travel Pace Radio */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-content-muted mb-1.5">
                Travel Pace
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['relaxed', 'balanced', 'explorer'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTravelPace(p)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer ${
                      travelPace === p
                        ? 'bg-surface-secondary border-content text-content shadow-sm'
                        : 'bg-surface-tertiary border-edge text-content-muted hover:text-content'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGeneratePlan}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              style={{
                background: dark ? '#ffffff' : '#0f172a',
                color: dark ? '#000000' : '#ffffff',
              }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing AI Itinerary...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate AI Itinerary</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Output Column */}
        <div className="lg:col-span-7">
          {!generatedPlan && !isGenerating && (
            <div className="p-10 rounded-2xl border border-edge bg-surface-card text-center flex flex-col items-center justify-center min-h-[440px]">
              <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-edge flex items-center justify-center mb-4 text-content">
                <Compass className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-2">Ready to Plan Your Perfect Journey</h3>
              <p className="text-sm text-content-muted max-w-md mb-6">
                Type your starting point and destination on the left, then click <strong>"Generate AI Itinerary"</strong> to generate custom multi-day routes with your personal ML model.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="px-3 py-1 rounded-full text-xs bg-surface-secondary border border-edge text-content-muted">
                  🤖 Custom ML Travel Model
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-surface-secondary border border-edge text-content-muted">
                  🗺️ Multi-Day Itinerary Engine
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-surface-secondary border border-edge text-content-muted">
                  💰 Smart Budget & Transit
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-surface-secondary border border-edge text-content-muted">
                  💾 1-Click Save to My Trips
                </span>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="p-12 rounded-2xl border border-edge bg-surface-card text-center flex flex-col items-center justify-center min-h-[440px]">
              <div className="w-10 h-10 border-2 border-edge border-t-content rounded-full animate-spin mb-4" />
              <h3 className="text-base font-bold mb-1">Crafting Custom Itinerary</h3>
              <p className="text-xs text-content-muted">
                Generating itinerary with custom ML model from {origin.split(',')[0]} to {destination.split(',')[0]}...
              </p>
            </div>
          )}

          {generatedPlan && (
            <div className="space-y-6">
              {/* Trip Overview Header Card */}
              <div className="p-6 rounded-2xl border border-edge bg-surface-card shadow-sm relative overflow-hidden">
                {/* Destination Hero Panoramic Visual */}
                <div className="relative h-44 sm:h-52 w-full rounded-xl overflow-hidden mb-5 border border-edge shadow-sm bg-surface-tertiary">
                  <img
                    src={generatedPlan.coverImage || getDestinationCoverImage(`${generatedPlan.destination} ${generatedPlan.tripTitle}`)}
                    alt={generatedPlan.destination}
                    className="w-full h-full object-cover brightness-95 transition-transform duration-700 hover:scale-105"
                    onError={(e) => { e.currentTarget.src = DEFAULT_FALLBACK_COVER; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent flex flex-col justify-between p-4 sm:p-5 text-white">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-md border border-white/25 text-white shadow-sm">
                        {generatedPlan.zone}
                      </span>
                      {generatedPlan.weather && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/50 backdrop-blur-md border border-white/15 text-amber-300 flex items-center gap-1.5 shadow-sm">
                          <CloudSun className="w-3.5 h-3.5 text-amber-400" />
                          <span>{generatedPlan.weather.temp}°C • {generatedPlan.weather.condition}</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/85 flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                        <span className="truncate">{generatedPlan.origin.split(',')[0]} → {generatedPlan.destination.split(',')[0]}</span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow-md">
                        {generatedPlan.tripTitle}
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-surface-secondary border border-edge text-content-muted">
                        AI Planned Itinerary
                      </span>
                      <span className="text-xs text-content-muted">
                        {generatedPlan.days.length} Days Schedule
                      </span>
                    </div>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyMarkdown}
                      title="Copy Itinerary Text"
                      className="p-2 rounded-xl border border-edge bg-surface-secondary text-content-muted hover:text-content transition-all cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleSaveToMyTrips}
                      disabled={isSavingTrip}
                      className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer"
                      style={{
                        background: dark ? '#ffffff' : '#0f172a',
                        color: dark ? '#000000' : '#ffffff',
                      }}
                    >
                      {isSavingTrip ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Save to My Trips</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Key Metrics & Group Math Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-edge">
                  <div className="p-2.5 rounded-xl bg-surface-secondary border border-edge">
                    <div className="text-[10px] text-content-muted uppercase font-bold flex items-center gap-1">
                      <Car className="w-3 h-3" />
                      Distance
                    </div>
                    <div className="text-sm font-extrabold mt-0.5">{generatedPlan.totalDistanceKm} km</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface-secondary border border-edge">
                    <div className="text-[10px] text-content-muted uppercase font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Drive Time
                    </div>
                    <div className="text-sm font-extrabold mt-0.5">~{generatedPlan.drivingHours} hrs</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface-secondary border border-edge">
                    <div className="text-[10px] text-content-muted uppercase font-bold flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Travelers
                    </div>
                    <div className="text-sm font-extrabold mt-0.5 text-sky-400">
                      {generatedPlan.travelersCount || 4} {generatedPlan.travelersCount === 1 ? 'Person' : 'Persons'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface-secondary border border-edge">
                    <div className="text-[10px] text-content-muted uppercase font-bold flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" />
                      Total Budget
                    </div>
                    <div className="text-sm font-extrabold mt-0.5 text-emerald-400">
                      ₹{generatedPlan.estTotalCost.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[9.5px] text-content-muted">
                      (₹{(generatedPlan.costPerPerson || Math.round(generatedPlan.estTotalCost / (generatedPlan.travelersCount || 4))).toLocaleString('en-IN')}/person)
                    </div>
                  </div>
                </div>

                {/* MULTI-MODAL TRANSIT & ROUTE LOGISTICS CARD */}
                {generatedPlan.transitPlan && (
                  <div className="mt-3 p-3.5 rounded-xl bg-surface-secondary/90 border border-edge shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Route className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-xs sm:text-sm font-bold text-content">
                            Multi-Modal Transit Logistics & Route
                          </h4>
                          <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {generatedPlan.selectedTransitOption?.tag || 'Budget Champion'}
                          </span>
                        </div>
                        <p className="text-[11px] text-content-muted mt-0.5">
                          {generatedPlan.origin.split(',')[0]} → {generatedPlan.destination.split(',')[0]} (~{generatedPlan.totalDistanceKm} km) • {generatedPlan.selectedTransitOption?.totalDurationFormatted}
                        </p>
                      </div>

                      {/* Transit Mode Switcher Tabs */}
                      <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-tertiary border border-edge overflow-x-auto max-w-full">
                        {[
                          generatedPlan.transitPlan.defaultOption,
                          ...generatedPlan.transitPlan.options.filter(o => o.id !== generatedPlan.transitPlan?.defaultOption.id)
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSwitchTransitMode(opt.id as any)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                              (generatedPlan.selectedTransitOption?.id || generatedPlan.transitPlan?.defaultOption.id) === opt.id
                                ? 'bg-surface-card text-content shadow-sm border border-edge'
                                : 'text-content-muted hover:text-content'
                            }`}
                          >
                            {opt.title ? opt.title.split('(')[0].trim() : opt.id}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Step-by-Step Transit Legs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
                      {generatedPlan.selectedTransitOption?.legs.map((leg) => (
                        <div
                          key={leg.legNumber}
                          className="p-3 rounded-xl bg-surface-card border border-edge flex flex-col justify-between hover:border-sky-500/30 transition-all shadow-sm"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-surface-secondary border border-edge text-sky-400 flex items-center gap-1">
                                {leg.mode === 'train' ? <Train className="w-3 h-3" /> : leg.mode === 'flight' ? <Plane className="w-3 h-3" /> : leg.mode === 'bus' ? <Bus className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                                Leg {leg.legNumber}: {leg.mode.toUpperCase()}
                              </span>
                              <span className="text-[10px] font-bold text-content-muted">
                                {leg.duration}
                              </span>
                            </div>

                            <div className="font-bold text-xs text-content line-clamp-1 mt-1">
                              {leg.title}
                            </div>
                            <div className="text-[10.5px] text-content-secondary mt-0.5 font-medium line-clamp-1">
                              {leg.operatorOrService}
                            </div>

                            <div className="mt-2 p-2 rounded-lg bg-surface-secondary/60 text-[10px] text-content-muted space-y-0.5">
                              <div className="font-semibold text-content">Departure: {leg.departureTime}</div>
                              <div>Arrival: {leg.arrivalTime}</div>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-edge flex items-center justify-between gap-2">
                            <div>
                              <div className="text-[9px] uppercase text-content-muted font-bold">Fare / Person</div>
                              <div className="text-xs font-black text-emerald-400">
                                {leg.costPerPerson > 0 ? `₹${leg.costPerPerson.toLocaleString('en-IN')}` : 'Local Transit'}
                              </div>
                            </div>

                            {leg.bookingUrl && (
                              <a
                                href={leg.bookingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-1 px-2 rounded-lg text-center font-bold text-[10px] bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1 transition-colors shadow-sm"
                              >
                                <span>{leg.bookingPlatform}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Highlights & Cost Summary */}
                    <div className="p-2.5 rounded-lg bg-surface-tertiary border border-edge flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="text-[11px] text-content-secondary">
                        💡 <strong>Transit Strategy:</strong> {generatedPlan.selectedTransitOption?.description}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] uppercase font-bold text-content-muted">Total Transit for Group: </span>
                        <strong className="text-emerald-400 font-extrabold">₹{(generatedPlan.selectedTransitOption?.totalCostForGroup ?? 0).toLocaleString('en-IN')}</strong>
                        <span className="text-content-muted text-[10px]"> (₹{(generatedPlan.selectedTransitOption?.estCostPerPerson ?? 0).toLocaleString('en-IN')}/head)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* GROUP BUDGET DISTRIBUTION TABLE */}
                <div className="mt-3 p-3 rounded-xl bg-surface-secondary/70 border border-edge">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-content">
                      <Calculator className="w-3.5 h-3.5 text-sky-400" />
                      Budget Math Breakdown ({generatedPlan.travelersCount || 4} Travelers • {generatedPlan.days.length} Days)
                    </span>
                    <span className="text-[10.5px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ₹{Math.round((generatedPlan.estTotalCost ?? 0) / (Math.max(1, generatedPlan.days.length) * (generatedPlan.travelersCount || 4))).toLocaleString('en-IN')} / person / day
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-surface-tertiary border border-edge">
                      <div className="text-[10px] text-content-muted font-bold uppercase">🏨 Stay</div>
                      <div className="font-extrabold text-content mt-0.5">₹{(generatedPlan.costBreakdown?.stay ?? 0).toLocaleString('en-IN')}</div>
                      <div className="text-[9.5px] text-content-muted">₹{Math.round((generatedPlan.costBreakdown?.stay ?? 0) / (generatedPlan.travelersCount || 4)).toLocaleString('en-IN')}/head</div>
                    </div>
                    <div className="p-2 rounded-lg bg-surface-tertiary border border-edge">
                      <div className="text-[10px] text-content-muted font-bold uppercase">🍲 Food</div>
                      <div className="font-extrabold text-content mt-0.5">₹{(generatedPlan.costBreakdown?.food ?? 0).toLocaleString('en-IN')}</div>
                      <div className="text-[9.5px] text-content-muted">₹{Math.round((generatedPlan.costBreakdown?.food ?? 0) / (generatedPlan.travelersCount || 4)).toLocaleString('en-IN')}/head</div>
                    </div>
                    <div className="p-2 rounded-lg bg-surface-tertiary border border-edge">
                      <div className="text-[10px] text-content-muted font-bold uppercase">🚗 Travel</div>
                      <div className="font-extrabold text-content mt-0.5">₹{(generatedPlan.costBreakdown?.travel ?? 0).toLocaleString('en-IN')}</div>
                      <div className="text-[9.5px] text-content-muted">₹{Math.round((generatedPlan.costBreakdown?.travel ?? 0) / (generatedPlan.travelersCount || 4)).toLocaleString('en-IN')}/head</div>
                    </div>
                    <div className="p-2 rounded-lg bg-surface-tertiary border border-edge">
                      <div className="text-[10px] text-content-muted font-bold uppercase">🧗 Activities</div>
                      <div className="font-extrabold text-content mt-0.5">₹{(generatedPlan.costBreakdown?.activities ?? 0).toLocaleString('en-IN')}</div>
                      <div className="text-[9.5px] text-content-muted">₹{Math.round((generatedPlan.costBreakdown?.activities ?? 0) / (generatedPlan.travelersCount || 4)).toLocaleString('en-IN')}/head</div>
                    </div>
                    <div className="p-2 rounded-lg bg-surface-tertiary border border-edge col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-content-muted font-bold uppercase">🛡️ Buffer</div>
                      <div className="font-extrabold text-content mt-0.5">₹{(generatedPlan.costBreakdown?.buffer || Math.round((generatedPlan.estTotalCost ?? 0) * 0.03)).toLocaleString('en-IN')}</div>
                      <div className="text-[9.5px] text-content-muted">₹{Math.round((generatedPlan.costBreakdown?.buffer || ((generatedPlan.estTotalCost ?? 0) * 0.03)) / (generatedPlan.travelersCount || 4)).toLocaleString('en-IN')}/head</div>
                    </div>
                  </div>
                </div>

                {/* Live Weather & Cuisine Bar */}
                {(generatedPlan.weather || generatedPlan.famousFoods) && (
                  <div className="mt-3 pt-3 border-t border-edge grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {generatedPlan.weather && (
                      <div className="p-2.5 rounded-xl bg-surface-secondary border border-edge flex items-start gap-2.5">
                        <CloudSun className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                        <div>
                          <div className="font-bold text-content">
                            Live Weather: {generatedPlan.weather.temp}°C ({generatedPlan.weather.condition})
                          </div>
                          <div className="text-[11px] text-content-muted mt-0.5">
                            Rain Chance: {generatedPlan.weather.rainProb}% • {generatedPlan.weather.advisory}
                          </div>
                        </div>
                      </div>
                    )}

                    {generatedPlan.famousFoods && (
                      <div className="p-2.5 rounded-xl bg-surface-secondary border border-edge flex items-start gap-2.5">
                        <Utensils className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                        <div>
                          <div className="font-bold text-content">Must-Try Local Cuisine:</div>
                          <div className="text-[11px] text-content-muted mt-0.5">
                            {generatedPlan.famousFoods.slice(0, 3).join(' • ')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* BUDGET TIER FILTER BAR */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-content">
                      <Hotel className="w-4 h-4 text-sky-400" />
                      <span>Select Accommodation & Activity Budget Tier</span>
                    </h3>
                    <p className="text-[11px] text-content-muted">
                      Customized for {generatedPlan.travelersCount || 4} travelers in {generatedPlan.destination.split(',')[0]}
                    </p>
                  </div>

                  {/* Budget Tier Buttons */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-secondary border border-edge">
                    {[
                      { id: 'budget', label: '🟢 Low Budget / Hostels' },
                      { id: 'comfort', label: '🔵 Mid-Range / 3★' },
                      { id: 'luxury', label: '🟣 Luxury / Resorts' },
                    ].map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedBudgetTier(tier.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedBudgetTier === tier.id
                            ? 'bg-surface-card text-content shadow-sm border border-edge'
                            : 'text-content-muted hover:text-content'
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtered Hotel Suggestions */}
                {generatedPlan.hotels && generatedPlan.hotels.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {generatedPlan.hotels
                      .filter((h) => {
                        if (selectedBudgetTier === 'budget') return h.tier === 'budget_hostel' || h.tier === 'budget_hotel' || h.tier === 'budget'
                        if (selectedBudgetTier === 'comfort') return h.tier === 'midrange_hotel' || h.tier === 'budget_hotel' || h.tier === 'comfort'
                        if (selectedBudgetTier === 'luxury') return h.tier === 'premium_hotel' || h.tier === 'luxury'
                        return true
                      })
                      .map((hotel, hIdx) => (
                      <div
                        key={hotel.id || `hotel_${hIdx}_${hotel.name}`}
                        className={`rounded-xl border bg-surface-card overflow-hidden flex flex-col justify-between transition-all hover:shadow-md group ${
                          (selectedBudgetTier === 'budget' && (hotel.tier === 'budget_hostel' || hotel.tier === 'budget_hotel')) ||
                          (selectedBudgetTier === 'comfort' && hotel.tier === 'midrange_hotel') ||
                          (selectedBudgetTier === 'luxury' && (hotel.tier === 'premium_hotel' || hotel.tier === 'luxury'))
                            ? 'border-sky-500/50 ring-1 ring-sky-500/30'
                            : 'border-edge'
                        }`}
                      >
                        <div>
                          <div className="relative h-32 w-full overflow-hidden bg-surface-tertiary">
                            <img
                              src={hotel.photoUrl}
                              alt={hotel.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => { e.currentTarget.src = DEFAULT_FALLBACK_COVER }}
                            />
                            <div className="absolute top-2 left-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md border shadow-sm ${
                                  hotel.tier === 'premium_hotel' || hotel.tier === 'luxury'
                                    ? 'bg-amber-500/80 text-white border-amber-300/40'
                                    : hotel.tier === 'midrange_hotel' || hotel.tier === 'comfort'
                                    ? 'bg-sky-500/80 text-white border-sky-300/40'
                                    : hotel.tier === 'budget_hotel'
                                    ? 'bg-blue-500/80 text-white border-blue-300/40'
                                    : 'bg-emerald-500/80 text-white border-emerald-300/40'
                                }`}
                              >
                                {hotel.tier === 'premium_hotel' || hotel.tier === 'luxury'
                                  ? '⭐ Luxury Resort'
                                  : hotel.tier === 'midrange_hotel' || hotel.tier === 'comfort'
                                  ? '✨ Mid-Range Stay'
                                  : hotel.tier === 'budget_hotel'
                                  ? '🏨 Budget Hotel'
                                  : '🏷️ Value Hostel'}
                              </span>
                            </div>
                            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[11px] font-extrabold text-amber-300 flex items-center gap-1 border border-white/10">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{hotel.rating}</span>
                              <span className="text-[9px] text-white/70 font-normal">({hotel.reviewCount})</span>
                            </div>
                          </div>

                          <div className="p-3">
                            <div className="text-[10px] font-bold uppercase text-sky-400 tracking-wide">
                              {hotel.tier === 'budget_hostel'
                                ? '4-Bed Dorm / Hostel Bed'
                                : hotel.tier === 'budget_hotel'
                                ? 'Standard AC Deluxe Room'
                                : hotel.tier === 'midrange_hotel'
                                ? 'Executive Heritage Room'
                                : 'Luxury Suite / Resort Villa'}
                            </div>
                            <h4 className="font-bold text-xs sm:text-sm text-content line-clamp-1 group-hover:text-sky-400 transition-colors mt-0.5">
                              {hotel.name}
                            </h4>
                            <p className="text-[11px] text-content-muted mt-0.5 line-clamp-1">{hotel.area}</p>

                            <div className="flex flex-wrap gap-1 mt-2">
                              {hotel.amenities.slice(0, 3).map((amenity, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-surface-secondary border border-edge text-content-secondary"
                                >
                                  {amenity}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 pt-0 border-t border-edge/50 mt-2">
                          <div className="flex items-baseline justify-between mb-2.5 pt-2">
                            <span className="text-[10px] uppercase font-bold text-content-muted">Room Rate (Total)</span>
                            <div className="text-right">
                              <span className="text-xs sm:text-sm font-black text-content">
                                ₹{hotel.pricePerNight.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-content-muted"> / night</span>
                              {hotel.perPersonPrice && (
                                <div className="text-[9.5px] text-emerald-400 font-bold">
                                  ₹{hotel.perPersonPrice.toLocaleString('en-IN')} / person
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <a
                              href={hotel.googleHotelsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-1.5 px-2 rounded-lg text-center font-bold text-[10px] bg-surface-secondary hover:bg-surface-hover border border-edge text-content flex items-center justify-center gap-1 transition-colors"
                            >
                              <span>Google Hotels</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </a>
                            <a
                              href={hotel.bookingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-1.5 px-2 rounded-lg text-center font-bold text-[10px] bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center gap-1 transition-colors shadow-sm"
                            >
                              <span>Booking.com</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TIERED TOP ACTIVITIES & EXPERIENCES */}
              {generatedPlan.activities && generatedPlan.activities.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-content">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>Recommended Activities for {selectedBudgetTier === 'budget' ? '🟢 Budget Travelers' : selectedBudgetTier === 'comfort' ? '🔵 Comfort Group' : '🟣 Luxury Group'}</span>
                    </h3>
                    <span className="text-xs text-content-muted">Curated local adventures</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(generatedPlan.activities.filter((a) => !a.tier || a.tier === selectedBudgetTier).length > 0
                      ? generatedPlan.activities.filter((a) => !a.tier || a.tier === selectedBudgetTier)
                      : generatedPlan.activities
                    ).map((act, aIdx) => (
                      <div
                        key={act.id || `act_${aIdx}_${act.title}`}
                        className="p-3 rounded-xl border bg-surface-card border-edge flex flex-col justify-between hover:border-emerald-500/40 transition-all shadow-sm"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wide bg-surface-secondary border border-edge text-emerald-400">
                              {act.category}
                            </span>
                            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-amber-400" />
                              {act.rating}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-content mt-1">{act.title}</h4>
                          <p className="text-[11px] text-content-secondary mt-1 line-clamp-2">{act.description}</p>
                        </div>

                        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-edge text-[11px]">
                          <span className="text-content-muted flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3" />
                            {act.duration}
                          </span>
                          <span className="font-extrabold text-content">
                            {act.estCost > 0 ? `~₹${act.estCost.toLocaleString('en-IN')} / person` : 'Free Entry'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Day by Day Cards List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Day-by-Day Schedule
                  </h3>
                  <span className="text-xs text-content-muted">{generatedPlan.days.length} Days Itinerary</span>
                </div>

                {generatedPlan.days.map((day) => {
                  const isExpanded = expandedDay === day.dayNumber
                  return (
                    <div
                      key={day.dayNumber}
                      className="rounded-xl border bg-surface-card border-edge overflow-hidden transition-all shadow-sm"
                    >
                      {/* Day Header Accordion Toggle */}
                      <button
                        type="button"
                        onClick={() => setExpandedDay(isExpanded ? null : day.dayNumber)}
                        className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-surface-secondary font-bold flex items-center justify-center text-xs border border-edge text-content">
                            {day.dayNumber}
                          </div>
                          <div>
                            <div className="font-bold text-xs sm:text-sm text-content">{day.title}</div>
                            <div className="text-[11px] text-content-secondary font-medium mt-0.5">{day.theme}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-content-muted hidden sm:inline">
                            ₹{day.dailyCost.toLocaleString('en-IN')}/day
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-content-muted" /> : <ChevronDown className="w-4 h-4 text-content-muted" />}
                        </div>
                      </button>

                      {/* Day Content */}
                      {isExpanded && (
                        <div className="p-3.5 pt-1 border-t border-edge space-y-2.5">
                          {day.spots.map((spot, idx) => (
                            <div
                              key={`spot_${day.dayNumber}_${idx}_${spot.name}`}
                              className="p-3 rounded-lg bg-surface-secondary border border-edge flex items-start gap-3"
                            >
                              <div className="w-16 flex-shrink-0 text-center py-1 rounded bg-surface-tertiary border border-edge text-[10px] font-semibold text-content">
                                {spot.time}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="font-bold text-xs sm:text-sm truncate text-content">{spot.name}</h4>
                                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-surface-tertiary border border-edge text-content-muted">
                                    {spot.category}
                                  </span>
                                </div>
                                <p className="text-xs text-content-secondary mt-1">{spot.description}</p>
                                {spot.transitFromPrev && (
                                  <div className="mt-1 text-[11px] text-content-muted flex items-center gap-1">
                                    <Car className="w-3 h-3" />
                                    <span>{spot.transitFromPrev}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Day Pro Tip */}
                          {day.proTip && (
                            <div className="p-2.5 rounded-lg bg-surface-secondary border border-edge text-xs text-content flex items-start gap-2">
                              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-content" />
                              <div>
                                <span className="font-bold text-content">Pro Tip: </span>
                                <span className="text-content-secondary">{day.proTip}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Bottom Call to Action */}
              <div className="p-5 rounded-2xl border border-edge bg-surface-card text-center flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="text-left">
                  <h4 className="font-bold text-sm sm:text-base text-content">Ready to explore on the map?</h4>
                  <p className="text-xs text-content-muted mt-0.5">
                    Save this itinerary into GlobeTrotter to visualize real turn-by-turn road routes on Leaflet map!
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSavingTrip}
                  onClick={handleSaveToMyTrips}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  style={{
                    background: dark ? '#ffffff' : '#0f172a',
                    color: dark ? '#000000' : '#ffffff',
                  }}
                >
                  {isSavingTrip ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Trip...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save & Open in Map</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
