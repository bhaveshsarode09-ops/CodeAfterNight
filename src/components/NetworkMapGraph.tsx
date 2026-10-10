import React from 'react';
import { NetworkNode, OptimizationPlan, DispatchTracker } from '../types/blood';
import { Building2, Navigation, AlertCircle } from 'lucide-react';

interface NetworkMapGraphProps {
  nodes: NetworkNode[];
  activePlan: OptimizationPlan | null;
  targetNodeId?: string;
  dispatches: DispatchTracker[];
  onSelectNode?: (nodeId: string) => void;
  selectedNodeId?: string;
}

export const NetworkMapGraph: React.FC<NetworkMapGraphProps> = ({
  nodes,
  activePlan,
  targetNodeId,
  dispatches,
  onSelectNode,
  selectedNodeId,
}) => {
  // SVG canvas bounds
  const width = 640;
  const height = 360;

  // Compute bounding box of node lat/lng
  const lats = nodes.map((n) => n.lat);
  const lngs = nodes.map((n) => n.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const padding = 50;
  const projectX = (lng: number) => {
    return padding + ((lng - minLng) / (maxLng - minLng || 1)) * (width - padding * 2);
  };
  const projectY = (lat: number) => {
    // Invert Y because lat increases northward
    return height - (padding + ((lat - minLat) / (maxLat - minLat || 1)) * (height - padding * 2));
  };

  const activeSourceNodeIds = new Set(
    activePlan?.legs.map((l) => l.sourceNodeId) || []
  );

  return (
    <div className="relative w-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Metropolitan Logistics Grid & Corridor Routing
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Geospatial nodes, inter-facility transit lines, and real-time dispatch vectors
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Surge Target</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Donor Source</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span>Network Node</span>
          </div>
        </div>
      </div>

      <div className="relative w-full aspect-[16/9] max-h-[380px] bg-slate-950/60">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full select-none"
        >
          <defs>
            <linearGradient id="corridorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.8" />
            </linearGradient>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
            </marker>
          </defs>

          {/* Grid lines */}
          <g stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3">
            {[...Array(6)].map((_, i) => (
              <line
                key={`h-${i}`}
                x1="0"
                y1={(i + 1) * (height / 7)}
                x2={width}
                y2={(i + 1) * (height / 7)}
              />
            ))}
            {[...Array(8)].map((_, i) => (
              <line
                key={`v-${i}`}
                x1={(i + 1) * (width / 9)}
                y1="0"
                x2={(i + 1) * (width / 9)}
                y2={height}
              />
            ))}
          </g>

          {/* Passive connections between adjacent nodes */}
          <g stroke="#334155" strokeWidth="1" strokeOpacity="0.4">
            {nodes.map((nodeA, i) =>
              nodes.slice(i + 1).map((nodeB) => (
                <line
                  key={`line-${nodeA.id}-${nodeB.id}`}
                  x1={projectX(nodeA.lng)}
                  y1={projectY(nodeA.lat)}
                  x2={projectX(nodeB.lng)}
                  y2={projectY(nodeB.lat)}
                />
              ))
            )}
          </g>

          {/* Active transfer route lines */}
          {activePlan?.legs.map((leg) => {
            const src = nodes.find((n) => n.id === leg.sourceNodeId);
            const dst = nodes.find((n) => n.id === leg.targetNodeId);
            if (!src || !dst) return null;

            const x1 = projectX(src.lng);
            const y1 = projectY(src.lat);
            const x2 = projectX(dst.lng);
            const y2 = projectY(dst.lat);

            const isPriority = leg.transportMode === 'resqtech_priority';

            return (
              <g key={`active-route-${leg.id}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isPriority ? '#10b981' : '#f59e0b'}
                  strokeWidth="3"
                  strokeDasharray={isPriority ? 'none' : '5 4'}
                  markerEnd="url(#arrow)"
                />
                {/* Distance and ETA badge in center of line */}
                <rect
                  x={(x1 + x2) / 2 - 32}
                  y={(y1 + y2) / 2 - 11}
                  width="64"
                  height="22"
                  rx="4"
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth="1"
                />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 + 3}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  className="font-mono tabular-nums"
                >
                  {leg.distanceKm}km · {isPriority ? `${leg.resqtechCorridorEtaMin}m` : `${leg.standardEtaMin}m`}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const cx = projectX(node.lng);
            const cy = projectY(node.lat);
            const isTarget = node.id === targetNodeId;
            const isSource = activeSourceNodeIds.has(node.id);
            const isSelected = node.id === selectedNodeId;

            let fillColor = '#1e293b';
            let strokeColor = '#475569';
            let ringColor = 'transparent';

            if (isTarget) {
              fillColor = '#881337';
              strokeColor = '#f43f5e';
              ringColor = '#fda4af';
            } else if (isSource) {
              fillColor = '#064e3b';
              strokeColor = '#10b981';
              ringColor = '#6ee7b7';
            }

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-transform duration-150 hover:scale-105"
                onClick={() => onSelectNode && onSelectNode(node.id)}
              >
                {/* Outer halo if selected or active */}
                {(isTarget || isSource || isSelected) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="16"
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="1.5"
                    strokeOpacity="0.4"
                  />
                )}

                {/* Node icon circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="10"
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="2"
                />

                {/* Node label */}
                <text
                  x={cx}
                  y={cy + 22}
                  textAnchor="middle"
                  fill={isSelected ? '#ffffff' : '#cbd5e1'}
                  fontSize="11"
                  fontWeight="600"
                  className="pointer-events-none drop-shadow-md"
                >
                  {node.name.split(' ')[0]}
                </text>
                <text
                  x={cx}
                  y={cy + 34}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="9.5"
                  className="pointer-events-none"
                >
                  {node.cityZone.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
