import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCw,
} from 'lucide-react';
import { Deal, SalesRep, WorkspaceSettings } from '../types/crm';
import {
  CameraPreset,
  createSpatialPipelineScene,
  SpatialSceneController,
} from '../three/pipelineScene';
import { formatCurrency, HEALTH_META, STAGE_META } from '../utils/formatters';

interface SpatialPipelineViewProps {
  deals: Deal[];
  reps: SalesRep[];
  settings: WorkspaceSettings;
  onOpenDealDrawer: (dealId: string) => void;
}

const CAMERA_PRESETS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'commit', label: 'Commit' },
  { id: 'won', label: 'Closed Won' },
  { id: 'aerial', label: 'Aerial' },
];

export const SpatialPipelineView: React.FC<SpatialPipelineViewProps> = ({
  deals,
  reps,
  settings,
  onOpenDealDrawer,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpatialSceneController | null>(null);

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [hoveredDealId, setHoveredDealId] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<CameraPreset>('overview');
  const [explodeFactor, setExplodeFactor] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [fullViewport, setFullViewport] = useState(false);

  // Store latest deals/quota for initial mount without tearing down WebGL on updates
  const initialDealsRef = useRef(deals);
  const initialQuotaRef = useRef(settings.quarterlyQuota);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const controller = createSpatialPipelineScene(
      el,
      initialDealsRef.current,
      initialQuotaRef.current,
      {
        onSelectDeal: (id) => setSelectedDealId(id),
        onHoverDeal: (id) => setHoveredDealId(id),
      }
    );
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  // Sync live deal/quota updates into the persistent WebGL scene
  useEffect(() => {
    controllerRef.current?.updateDeals(deals, settings.quarterlyQuota);
  }, [deals, settings.quarterlyQuota]);

  useEffect(() => {
    controllerRef.current?.setExplodeFactor(explodeFactor);
  }, [explodeFactor]);

  useEffect(() => {
    controllerRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  // Resize WebGL renderer when toggling full-viewport cinema mode
  useEffect(() => {
    const id = window.setTimeout(() => {
      controllerRef.current?.resize();
    }, 30);
    return () => clearTimeout(id);
  }, [fullViewport]);

  // Keyboard shortcut 'H' to collapse/expand bottom control dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape' && fullViewport) {
        setFullViewport(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullViewport]);

  const repById = useMemo(() => {
    const map: Record<string, SalesRep> = {};
    reps.forEach((r) => {
      map[r.id] = r;
    });
    return map;
  }, [reps]);

  const activeDealId = selectedDealId ?? hoveredDealId;
  const activeDeal = deals.find((d) => d.id === activeDealId) ?? null;

  const handlePresetClick = (preset: CameraPreset) => {
    setActivePreset(preset);
    controllerRef.current?.setCameraPreset(preset);
  };

  return (
    <div
      className={
        fullViewport
          ? 'fixed inset-0 z-50 w-screen h-screen bg-[#0b1326] overflow-hidden'
          : 'relative w-full h-[calc(100vh-112px)] min-h-[560px] rounded-lg border border-[#464554]/40 bg-[#0b1326] overflow-hidden'
      }
    >
      {/* Isolated WebGL canvas mount (zero sibling React churn inside) */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Minimal Top-Left Scene Title & Active Tower Readout (solid rgba, zero backdrop-filter) */}
      <div className="pointer-events-none absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-[340px]">
        <div className="pointer-events-auto rounded-lg border border-[#464554]/50 bg-[#0b1326]/92 px-4 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#c0c1ff]">
            Spatial Revenue Observatory
          </div>
          <div className="mt-0.5 text-[12px] text-[#c7c4d7]">
            Tower height = ARR · Core prism = Win probability · Click any tower to inspect
          </div>
        </div>

        {activeDeal && (
          <div className="pointer-events-auto rounded-lg border border-[#6366F1]/55 bg-[#131b2e]/95 px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[#908fa0]">
              <span className="font-mono text-[#c0c1ff]">{activeDeal.code}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STAGE_META[activeDeal.stage].badgeBg} ${STAGE_META[activeDeal.stage].badgeText}`}
              >
                {activeDeal.stage}
              </span>
            </div>
            <div className="mt-1 text-[14px] font-semibold text-[#dae2fd] truncate">
              {activeDeal.account}
            </div>
            <div className="text-[12px] text-[#908fa0] truncate">
              {activeDeal.name}
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#464554]/35 pt-2">
              <div>
                <div className="font-mono text-[15px] font-semibold tabular-nums text-[#dae2fd]">
                  {formatCurrency(activeDeal.value)}
                </div>
                <div className="text-[11px] text-[#908fa0]">
                  {activeDeal.probability}% · {repById[activeDeal.ownerId]?.name ?? 'AE'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${HEALTH_META[activeDeal.health].bg} ${HEALTH_META[activeDeal.health].text} ${HEALTH_META[activeDeal.health].border}`}
                >
                  {activeDeal.health}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenDealDrawer(activeDeal.id)}
                  className="inline-flex h-7 items-center gap-1 rounded bg-[#6366F1] px-2.5 text-[11px] font-medium text-white hover:bg-[#5558e6] transition-colors whitespace-nowrap"
                >
                  Inspect
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unified Collapsible Bottom Control Dock (zero viewport occlusion, no backdrop-filter) */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center max-w-[min(860px,94vw)] w-max">
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="mb-1.5 inline-flex items-center gap-1.5 rounded border border-[#464554]/55 bg-[#131b2e]/95 px-3 py-1 text-[11px] font-medium text-[#c7c4d7] hover:text-[#dae2fd] hover:border-[#6366F1]/60 transition-colors whitespace-nowrap"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show Controls (H)
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Hide Controls (H)
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-[#464554]/55 bg-[#131b2e]/95 px-4 py-2.5 shadow-xl">
            {/* Camera Presets */}
            <div className="flex items-center gap-1 rounded bg-[#0b1326] p-1 border border-[#464554]/40">
              {CAMERA_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetClick(preset.id)}
                  className={`rounded px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors ${
                    activePreset === preset.id
                      ? 'bg-[#6366F1] text-white'
                      : 'text-[#c7c4d7] hover:text-[#dae2fd]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Exploded View Inspection Slider */}
            <div className="flex items-center gap-2.5 border-l border-[#464554]/40 pl-3">
              <label
                htmlFor="spatial-explode-slider"
                className="text-[12px] font-medium text-[#c7c4d7] whitespace-nowrap"
              >
                Explode
              </label>
              <input
                id="spatial-explode-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(explodeFactor * 100)}
                onChange={(e) => setExplodeFactor(Number(e.target.value) / 100)}
                className="w-24 accent-[#6366F1] cursor-pointer"
              />
              <span className="font-mono text-[11px] tabular-nums text-[#908fa0] w-8 text-right">
                {Math.round(explodeFactor * 100)}%
              </span>
            </div>

            {/* Auto-Orbit Toggle */}
            <button
              type="button"
              onClick={() => setAutoRotate((prev) => !prev)}
              className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
                autoRotate
                  ? 'border-[#10B981]/50 bg-[#10B981]/18 text-[#4edea3]'
                  : 'border-[#464554]/45 bg-[#171f33] text-[#c7c4d7] hover:text-[#dae2fd]'
              }`}
            >
              <RotateCw className="h-3.5 w-3.5" />
              Orbit
            </button>

            {/* Full-Viewport Cinema Mode */}
            <button
              type="button"
              onClick={() => setFullViewport((prev) => !prev)}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-[#464554]/45 bg-[#171f33] px-2.5 text-[12px] font-medium text-[#c7c4d7] hover:text-[#dae2fd] hover:border-[#6366F1]/55 whitespace-nowrap transition-colors"
            >
              {fullViewport ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  Fullscreen
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
