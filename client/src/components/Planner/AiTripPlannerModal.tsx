import React, { useState } from 'react'
import { aiRecommendationsApi } from '../../api/client'
import { placeRepo } from '../../repo/placeRepo'
import type { TripAiRecommendationsResult } from '@trek/shared'
import { getDestinationCoverImage, DEFAULT_FALLBACK_COVER } from '../../utils/destinationCovers'

interface AiTripPlannerModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: number | string
  onPlaceAdded?: () => void
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'it', name: 'Italian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
]

export const AiTripPlannerModal: React.FC<AiTripPlannerModalProps> = ({
  isOpen,
  onClose,
  tripId,
  onPlaceAdded,
}) => {
  const [selectedLang, setSelectedLang] = useState('en')
  const [budgetGoal, setBudgetGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TripAiRecommendationsResult | null>(null)
  const [addedPlaces, setAddedPlaces] = useState<Record<string, boolean>>({})
  const [addingPlace, setAddingPlace] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'budget' | 'sights' | 'food' | 'days' | 'tips'>('budget')

  if (!isOpen) return null

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setLoadingStep('Retrieving Trip & Budget Context...')
    try {
      setTimeout(() => setLoadingStep('Analyzing Budget Metrics & Category Gaps...'), 800)
      setTimeout(() => setLoadingStep('Ingesting RAG Travel Knowledge...'), 1800)
      setTimeout(() => setLoadingStep('Executing ABCD AI StateGraph Model...'), 3200)

      const result = await aiRecommendationsApi.generate(tripId, {
        lang: selectedLang,
        budgetGoal: budgetGoal.trim() || undefined,
      })
      setData(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch AI recommendations'
      setError(msg)
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  const handleAddPlace = async (name: string, why?: string, category?: string) => {
    setAddingPlace(name)
    try {
      await placeRepo.create(tripId, {
        name,
        notes: why ? `AI Recommendation: ${why}` : 'AI Suggested Place',
      })
      setAddedPlaces((prev) => ({ ...prev, [name]: true }))
      if (onPlaceAdded) onPlaceAdded()
    } catch (err) {
      console.error('Failed to add place:', err)
    } finally {
      setAddingPlace(null)
    }
  }

  const getBadgeStyle = (score?: string) => {
    if (score === 'Budget-Friendly') return 'bg-emerald-950 text-emerald-300 border-emerald-500/50 font-extrabold'
    if (score === 'High-Cost') return 'bg-amber-950 text-amber-300 border-amber-500/50 font-extrabold'
    return 'bg-slate-800 text-white border-slate-600 font-extrabold'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl animate-fadeIn">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-[#0a0a0c] text-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#111114] px-6 py-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 border border-slate-600 text-white shadow-md">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-extrabold tracking-tight text-white">ABCD AI Trip & Budget Planner</h2>
                <span className="rounded-full border border-slate-600 bg-slate-800 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                  LangGraph RAG
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">Smart budget-friendly itinerary recommendations</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
          >
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#08080a] px-6 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-white">
              <span>Language:</span>
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="rounded-xl border border-slate-600 bg-[#141418] px-3 py-1.5 text-xs font-semibold text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>

            <input
              type="text"
              placeholder="Budget goal (e.g. Under $50/day, Street food focus)..."
              value={budgetGoal}
              onChange={(e) => setBudgetGoal(e.target.value)}
              className="w-72 rounded-xl border border-slate-600 bg-[#141418] px-3.5 py-1.5 text-xs font-semibold text-white placeholder-slate-400 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-extrabold shadow-lg shadow-black/50 disabled:opacity-50 px-4 py-2 text-xs transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-white font-extrabold">Analyzing RAG Graph...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.603 15.1a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
                <span className="text-white font-extrabold">{data ? 'Regenerate Recommendations' : 'Generate AI Plan'}</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto bg-[#0a0a0c] p-6 space-y-6">
          {error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-xs text-red-300 shadow-lg">
              <p className="font-bold text-red-200 text-sm">Unable to generate AI recommendations</p>
              <p className="mt-1 opacity-90">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 border border-slate-600 shadow-xl">
                <svg className="h-8 w-8 text-white animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-extrabold text-white">{loadingStep}</p>
                <p className="mt-1.5 text-xs text-slate-300 font-medium">ABCD AI Model is querying budget heuristics & destination knowledge...</p>
              </div>
            </div>
          )}

          {!loading && !data && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="rounded-2xl bg-[#141418] border border-slate-600 p-4 text-white shadow-xl">
                <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-extrabold text-white">AI-Powered Budget & Itinerary Suggestions</h3>
              <p className="max-w-md text-xs text-slate-300 font-medium leading-relaxed">
                Click <strong className="text-white font-extrabold">Generate AI Plan</strong> above to analyze your trip's current itinerary, calculate cost allocations, and receive tailored budget recommendations.
              </p>
            </div>
          )}

          {data && !loading && (
            <>

              {/* Navigation Tabs Bar */}
              <div className="flex border-b border-slate-800 gap-2 pb-3 text-xs font-semibold overflow-x-auto">
                <button
                  onClick={() => setActiveTab('budget')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    activeTab === 'budget'
                      ? 'bg-slate-800 text-white border border-slate-600 font-extrabold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-semibold'
                  }`}
                >
                  Budget Savings ({data.budgetSuggestions?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('sights')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    activeTab === 'sights'
                      ? 'bg-slate-800 text-white border border-slate-600 font-extrabold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-semibold'
                  }`}
                >
                  Budget Sights ({data.costSavingPlaces?.length || data.places?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('food')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    activeTab === 'food'
                      ? 'bg-slate-800 text-white border border-slate-600 font-extrabold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-semibold'
                  }`}
                >
                  Affordable Food ({data.food?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('days')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    activeTab === 'days'
                      ? 'bg-slate-800 text-white border border-slate-600 font-extrabold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-semibold'
                  }`}
                >
                  Itinerary Ideas ({data.dayIdeas?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('tips')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    activeTab === 'tips'
                      ? 'bg-slate-800 text-white border border-slate-600 font-extrabold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-semibold'
                  }`}
                >
                  Tips & Packing ({data.tips?.length || 0})
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'budget' && (
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {data.budgetSuggestions && data.budgetSuggestions.length > 0 ? (
                    data.budgetSuggestions.map((b, i) => (
                      <div key={i} className="flex flex-col justify-between rounded-xl border border-slate-700 bg-[#121216] p-4.5 space-y-2.5 shadow-md hover:border-slate-500 transition-all">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-white">{b.category}</span>
                            {b.potentialSavings && (
                              <span className="rounded-md border border-emerald-500/40 bg-emerald-950 px-2.5 py-1 text-[11px] font-extrabold text-emerald-300 shadow-sm">
                                {b.potentialSavings}
                              </span>
                            )}
                          </div>
                          <p className="mt-2.5 text-xs font-medium leading-relaxed text-slate-200">{b.budgetTip}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 col-span-2">No specific budget category adjustments required.</p>
                  )}
                </div>
              )}

              {activeTab === 'sights' && (
                <div className="space-y-3">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    {(data.costSavingPlaces && data.costSavingPlaces.length > 0
                      ? data.costSavingPlaces
                      : data.places
                    ).map((p, i) => (
                      <div key={i} className="flex flex-col justify-between rounded-xl border border-slate-700 bg-[#121216] p-4 space-y-3 shadow-md hover:border-slate-500 transition-all overflow-hidden">
                        <div className="flex gap-3 items-start">
                          <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800 border border-slate-700">
                            <img
                              src={getDestinationCoverImage(p.name)}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.src = DEFAULT_FALLBACK_COVER; }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                              {'isFree' in p && p.isFree && (
                                <span className="rounded-md border border-emerald-500/40 bg-emerald-950 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 shadow-sm shrink-0">
                                  FREE
                                </span>
                              )}
                            </div>
                            {p.kind && <p className="text-[10px] uppercase font-bold text-slate-300 mt-0.5">{p.kind}</p>}
                            {p.why && <p className="mt-1 text-xs font-medium leading-relaxed text-slate-200 line-clamp-2">{p.why}</p>}
                            {p.suggestedDay && <p className="mt-1 text-[11px] font-semibold text-slate-300">Suggested: {p.suggestedDay}</p>}
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddPlace(p.name, p.why, p.kind)}
                          disabled={addedPlaces[p.name] || addingPlace === p.name}
                          className="mt-1 flex items-center justify-center gap-1.5 w-full rounded-xl border border-slate-600 bg-slate-800 py-2 text-xs font-extrabold text-white hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
                        >
                          {addedPlaces[p.name] ? (
                            <>
                              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-emerald-400 font-extrabold">Added to Trip</span>
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span className="text-white font-extrabold">Add Place to Trip</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'food' && (
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {data.food.map((f, i) => (
                    <div key={i} className="rounded-xl border border-slate-700 bg-[#121216] p-4 flex gap-3 items-start shadow-md hover:border-slate-500 transition-all">
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800 border border-slate-700">
                        <img
                          src={getDestinationCoverImage(f.name || 'food')}
                          alt={f.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.src = DEFAULT_FALLBACK_COVER; }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{f.name}</h4>
                        {f.why && <p className="text-xs font-medium leading-relaxed text-slate-200 mt-1">{f.why}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'days' && (
                <div className="space-y-3">
                  {data.dayIdeas.map((d, i) => (
                    <div key={i} className="rounded-xl border border-slate-700 bg-[#121216] p-4.5 space-y-1.5 shadow-md hover:border-slate-500 transition-all">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-white">{d.day}</span>
                      <p className="text-xs font-medium leading-relaxed text-slate-200">{d.idea}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'tips' && (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Local Travel Tips</h4>
                    <ul className="space-y-2.5">
                      {data.tips.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs font-medium text-slate-200">
                          <span className="text-white font-bold">•</span>
                          <span className="leading-relaxed">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Recommended Packing Items</h4>
                    <div className="space-y-2.5">
                      {data.packing.map((p, i) => (
                        <div key={i} className="rounded-xl border border-slate-700 bg-[#121216] p-3 shadow-md">
                          <p className="text-xs font-bold text-white">{p.item}</p>
                          {p.why && <p className="text-[11px] text-slate-300 mt-0.5">{p.why}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
