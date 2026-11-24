import React, { useMemo, useState } from 'react';
import {
  Building2,
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Sparkles,
} from 'lucide-react';
import { Contact, Deal } from '../types/crm';
import { formatCurrency } from '../utils/formatters';

interface TerritoryIntelViewProps {
  deals: Deal[];
  contacts: Contact[];
  onSelectDeal: (dealId: string) => void;
  authToken: string;
  onUnauthorized: () => void;
}

interface GroundedPlaceLink {
  title: string;
  uri: string;
  reviewSnippets: Array<{ title: string; uri: string; content?: string }>;
}

interface TerritoryQueryResult {
  query: string;
  accountName: string;
  text: string;
  places: GroundedPlaceLink[];
  timestamp: string;
}

// Known HQ metropolitan coordinates for biasing Maps Grounding retrievalConfig.latLng
const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  'Chicago, IL': { latitude: 41.8781, longitude: -87.6298 },
  'Austin, TX': { latitude: 30.2672, longitude: -97.7431 },
  'London, UK': { latitude: 51.5074, longitude: -0.1278 },
  'Boston, MA': { latitude: 42.3601, longitude: -71.0589 },
  'San Francisco, CA': { latitude: 37.7749, longitude: -122.4194 },
  'Arlington, VA': { latitude: 38.8816, longitude: -77.091 },
  'Dallas, TX': { latitude: 32.7767, longitude: -96.797 },
  'Stockholm, SE': { latitude: 59.3293, longitude: 18.0686 },
  'Atlanta, GA': { latitude: 33.749, longitude: -84.388 },
  'New York, NY': { latitude: 40.7128, longitude: -74.006 },
};

function renderFormattedMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  return (
    <div className="space-y-2.5 text-[14px] leading-relaxed text-[#dae2fd]">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="pt-2 text-[14px] font-semibold text-[#e1e0ff]"
            >
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={idx}
              className="pt-2 text-[15px] font-semibold text-[#e1e0ff]"
            >
              {trimmed.slice(3)}
            </h3>
          );
        }

        const isBullet =
          trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const content = isBullet ? trimmed.slice(2) : trimmed;

        // Inline **bold** rendering without raw HTML injection
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-[#dae2fd]">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <React.Fragment key={pIdx}>{part}</React.Fragment>;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1 text-[#c7c4d7]">
              <span className="mt-2 h-1 w-1 rounded-full bg-[#8083ff] shrink-0" />
              <p className="flex-1">{rendered}</p>
            </div>
          );
        }

        return (
          <p key={idx} className="text-[#c7c4d7]">
            {rendered}
          </p>
        );
      })}
    </div>
  );
}

export const TerritoryIntelView: React.FC<TerritoryIntelViewProps> = ({
  deals,
  contacts,
  onSelectDeal,
  authToken,
  onUnauthorized,
}) => {
  const accountTerritories = useMemo(() => {
    const map = new Map<
      string,
      {
        account: string;
        location: string;
        totalArr: number;
        dealIds: string[];
        industry: string;
      }
    >();

    deals.forEach((d) => {
      const contactForAcc = contacts.find(
        (c) => c.account.toLowerCase() === d.account.toLowerCase()
      );
      const location = contactForAcc?.location || 'San Francisco, CA';
      const existing = map.get(d.account);
      if (existing) {
        existing.totalArr += d.value;
        existing.dealIds.push(d.id);
      } else {
        map.set(d.account, {
          account: d.account,
          location,
          totalArr: d.value,
          dealIds: [d.id],
          industry: d.industry,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalArr - a.totalArr);
  }, [deals, contacts]);

  const [selectedAccountName, setSelectedAccountName] = useState(
    accountTerritories[0]?.account ?? ''
  );
  const [queryInput, setQueryInput] = useState('');
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TerritoryQueryResult | null>(null);

  const selectedTerritory =
    accountTerritories.find((t) => t.account === selectedAccountName) ??
    accountTerritories[0];

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation is unavailable in this browser.');
      return;
    }
    setGeoStatus('Locating...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setGeoStatus(
          `Biased to ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`
        );
      },
      () => {
        setGeoStatus('Location permission declined; using account HQ coordinates.');
      },
      { timeout: 8000 }
    );
  };

  const runMapsGroundingQuery = async (promptText: string) => {
    const cleanPrompt = promptText.trim();
    if (!cleanPrompt) return;

    setLoading(true);
    setError(null);

    try {
      const hqCoords = selectedTerritory
        ? CITY_COORDS[selectedTerritory.location]
        : undefined;
      const latLng = userCoords ?? hqCoords;

      const response = await fetch('/api/maps-grounding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: cleanPrompt,
          latLng,
          accountContext: selectedTerritory
            ? `${selectedTerritory.account} (${selectedTerritory.industry}) headquartered in ${selectedTerritory.location}`
            : undefined,
        }),
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as {
        text?: string;
        places?: GroundedPlaceLink[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || 'Maps Grounding request failed.');
      }

      setResult({
        query: cleanPrompt,
        accountName: selectedTerritory?.account ?? 'Territory Search',
        text: data.text ?? '',
        places: data.places ?? [],
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to retrieve Google Maps grounded intelligence.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runMapsGroundingQuery(queryInput);
  };

  const quickPresets = selectedTerritory
    ? [
        `Top quiet executive dinner restaurants with private dining near downtown ${selectedTerritory.location} for a client QBR`,
        `Best 5-star business hotels with conference suites near ${selectedTerritory.location} financial district`,
        `Major convention centers and executive briefing hubs in ${selectedTerritory.location}`,
        `Airport transit options and commute times into central ${selectedTerritory.location}`,
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Subtle Context Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#464554]/35 bg-[#171f33] px-5 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <Compass className="h-4 w-4 text-[#4edea3] shrink-0" />
          <p className="text-[13px] text-[#c7c4d7]">
            Live Google Maps Grounding via <span className="font-mono text-[#c0c1ff]">gemini-4-hydrogen</span> for executive travel planning, private dining, and regional territory briefs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {geoStatus && (
            <span className="text-[12px] text-[#908fa0] font-mono">
              {geoStatus}
            </span>
          )}
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[12px] font-medium text-[#dae2fd] hover:border-[#6366F1]/55 hover:bg-[#222a3d] transition-colors whitespace-nowrap"
          >
            <Navigation className="h-3.5 w-3.5 text-[#adc6ff]" />
            Use My Location
          </button>
        </div>
      </div>

      {/* Main Split-Pane Territory Intelligence Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Account Territories List (4 cols) */}
        <div className="xl:col-span-4 rounded-lg border border-[#464554]/35 bg-[#171f33] overflow-hidden">
          <div className="border-b border-[#464554]/30 px-5 py-3.5">
            <h2 className="text-[14px] font-semibold text-[#dae2fd]">
              Enterprise Account Hubs
            </h2>
            <p className="text-[12px] text-[#908fa0]">
              Select an account to bias Maps Grounding to its headquarters.
            </p>
          </div>

          <div className="divide-y divide-[#464554]/25 max-h-[600px] overflow-y-auto">
            {accountTerritories.map((hub) => {
              const isSelected = selectedTerritory?.account === hub.account;
              return (
                <button
                  key={hub.account}
                  type="button"
                  onClick={() => setSelectedAccountName(hub.account)}
                  className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors ${
                    isSelected ? 'bg-[#6366F1]/16' : 'hover:bg-[#222a3d]/55'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#dae2fd] truncate">
                      {hub.account}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#908fa0]">
                      <MapPin className="h-3 w-3 text-[#4edea3] shrink-0" />
                      <span className="truncate">{hub.location}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[13px] font-semibold tabular-nums text-[#dae2fd]">
                      {formatCurrency(hub.totalArr, true)}
                    </div>
                    <div className="text-[11px] text-[#908fa0]">
                      {hub.dealIds.length} {hub.dealIds.length === 1 ? 'deal' : 'deals'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Grounding Research & Verified Links Panel (8 cols) */}
        <div className="xl:col-span-8 space-y-5">
          {/* Query Form & Presets */}
          <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-6 space-y-4">
            {selectedTerritory && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 text-[#c0c1ff]" />
                  <h2 className="text-[16px] font-semibold text-[#dae2fd]">
                    {selectedTerritory.account}
                  </h2>
                  <span className="text-[13px] text-[#908fa0]">
                    · {selectedTerritory.location}
                  </span>
                </div>
                {selectedTerritory.dealIds[0] && (
                  <button
                    type="button"
                    onClick={() => onSelectDeal(selectedTerritory.dealIds[0])}
                    className="text-[12px] font-medium text-[#c0c1ff] hover:text-[#e1e0ff]"
                  >
                    Inspect Primary Deal →
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#908fa0]" />
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder={
                    selectedTerritory
                      ? `Ask about venues, hotels, transit, or hubs near ${selectedTerritory.location}...`
                      : 'Ask a real-world location or travel question...'
                  }
                  className="h-10 w-full rounded border border-[#464554]/55 bg-[#131b2e] pl-9 pr-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !queryInput.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded bg-[#6366F1] px-4 text-[13px] font-medium text-white hover:bg-[#5558e6] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Grounding...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Search Maps Data
                  </>
                )}
              </button>
            </form>

            {/* Quick Executive Field Presets */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#908fa0]">
                Field Briefing Presets
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setQueryInput(preset);
                      runMapsGroundingQuery(preset);
                    }}
                    className="rounded border border-[#464554]/40 bg-[#131b2e] px-3 py-2 text-left text-[12px] text-[#c7c4d7] hover:border-[#6366F1]/55 hover:text-[#dae2fd] transition-colors disabled:opacity-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-[#ef4444]/40 bg-[#93000a]/25 px-5 py-4 text-[13px] text-[#ffb4ab]">
              {error}
            </div>
          )}

          {/* Grounded Response + Mandatory Extracted Google Maps Links */}
          {result ? (
            <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[#464554]/30 bg-[#131b2e] px-6 py-3.5">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-[#c0c1ff]">
                    Grounded Briefing · {result.accountName}
                  </div>
                  <div className="text-[13px] text-[#dae2fd] truncate">
                    {result.query}
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[#908fa0] shrink-0">
                  {result.timestamp}
                </span>
              </div>

              <div className="p-6">{renderFormattedMarkdown(result.text)}</div>

              {/* Mandatory Google Maps Grounding Sources & Review Snippets */}
              <div className="border-t border-[#464554]/30 bg-[#131b2e] px-6 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#908fa0] mb-3">
                  Verified Google Maps Sources ({result.places.length})
                </div>
                {result.places.length === 0 ? (
                  <p className="text-[12px] text-[#908fa0]">
                    No direct Google Maps place cards were attached to this response.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.places.map((place) => (
                      <div
                        key={place.uri}
                        className="rounded-lg border border-[#464554]/40 bg-[#171f33] p-3.5 space-y-2"
                      >
                        <a
                          href={place.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#adc6ff] hover:text-[#d8e2ff] hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5 text-[#4edea3] shrink-0" />
                          <span>{place.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>

                        {place.reviewSnippets.length > 0 && (
                          <div className="space-y-1.5 border-t border-[#464554]/25 pt-2">
                            {place.reviewSnippets.map((snippet, sIdx) => (
                              <div key={sIdx} className="text-[12px] text-[#908fa0]">
                                {snippet.content && (
                                  <p className="line-clamp-2 text-[#c7c4d7] mb-1">
                                    "{snippet.content}"
                                  </p>
                                )}
                                <a
                                  href={snippet.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-[#c0c1ff] hover:underline"
                                >
                                  {snippet.title}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            !loading && (
              <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] px-6 py-12 text-center">
                <MapPin className="mx-auto h-7 w-7 text-[#4edea3] mb-3" />
                <h3 className="text-[15px] font-semibold text-[#dae2fd]">
                  Ready for Grounded Territory Research
                </h3>
                <p className="mt-1 text-[13px] text-[#908fa0] max-w-md mx-auto">
                  Choose one of the executive field presets above or enter any location question to pull live, verified Google Maps place details and links.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
