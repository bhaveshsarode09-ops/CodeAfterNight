import React from 'react';
import {
  Activity,
  RotateCcw,
  Building2,
  HeartHandshake,
  FileText,
  Columns,
  ShieldAlert,
} from 'lucide-react';

export type RoleMode = 'requester' | 'provider' | 'split';

export type ActiveTab =
  | 'command'
  | 'bulk'
  | 'traffic'
  | 'bloodbank'
  | 'hospital'
  | 'scanner'
  | 'dispatch'
  | 'manifests'
  | 'inventory'
  | 'governance';

interface TopNavProps {
  roleMode: RoleMode;
  onSelectRoleMode: (mode: RoleMode) => void;
  onReset: () => void;
  onToggleAuditLog: () => void;
  auditLogCount: number;
  requesterAttentionCount: number;
  providerAttentionCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  roleMode,
  onSelectRoleMode,
  onReset,
  onToggleAuditLog,
  auditLogCount,
  requesterAttentionCount,
  providerAttentionCount,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      {/* Top Banner Notice */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-1 text-3xs text-slate-400 flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">NOTICE:</span>
            <span>
              Synthetic logistics records only. Never for clinical crossmatching, pre-transfusion testing, or biological blood release.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono text-slate-400">
            <span>Alt+1: Requester</span>
            <span>·</span>
            <span>Alt+2: Provider</span>
            <span>·</span>
            <span>Alt+3: Split View</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Logo & Mode Switcher */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                roleMode === 'requester'
                  ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400'
                  : roleMode === 'provider'
                  ? 'bg-rose-600/20 border border-rose-500/30 text-rose-400'
                  : 'bg-purple-600/20 border border-purple-500/30 text-purple-400'
              }`}
            >
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
              VitaSync
            </span>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-lg">
            {/* Requester Mode Button */}
            <button
              onClick={() => onSelectRoleMode('requester')}
              title="Switch to Requester Mode (Alt+1)"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                roleMode === 'requester'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Requester Mode</span>
              {roleMode !== 'requester' && requesterAttentionCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-3xs font-mono font-bold animate-pulse">
                  {requesterAttentionCount} new
                </span>
              )}
            </button>

            {/* Provider Mode Button */}
            <button
              onClick={() => onSelectRoleMode('provider')}
              title="Switch to Provider Mode (Alt+2)"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                roleMode === 'provider'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Provider Mode</span>
              {roleMode !== 'provider' && providerAttentionCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-3xs font-mono font-bold animate-pulse">
                  {providerAttentionCount} new
                </span>
              )}
            </button>

            {/* Split View Button */}
            <button
              onClick={() => onSelectRoleMode('split')}
              title="Side-by-side Evaluator View (Alt+3)"
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                roleMode === 'split'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>
          </div>
        </div>

        {/* Zone 2: Role Badge */}
        <div className="hidden lg:flex items-center gap-2">
          {roleMode === 'requester' && (
            <span className="text-2xs font-mono font-bold px-2.5 py-1 rounded bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>Hospital Requester Dashboard (Inbound Demand)</span>
            </span>
          )}
          {roleMode === 'provider' && (
            <span className="text-2xs font-mono font-bold px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>Blood Center Provider Dashboard (Outbound Supply)</span>
            </span>
          )}
          {roleMode === 'split' && (
            <span className="text-2xs font-mono font-bold px-2.5 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
              <span>Live Synchronized Split View (Dual Evaluation Mode)</span>
            </span>
          )}
        </div>

        {/* Zone 3: Actions & System Status */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* SQLite Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-2xs text-slate-300 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>SQLite Active</span>
          </div>

          {/* Audit Log Drawer Toggle Button */}
          <button
            onClick={onToggleAuditLog}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
            title="Open Immutable Audit Trail Drawer"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Audit Log</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-3xs">
              {auditLogCount}
            </span>
          </button>

          {/* Reset Demo Button */}
          <button
            onClick={onReset}
            title="Reset to Baseline Deterministic State"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Reset Demo</span>
          </button>
        </div>
      </div>
    </header>
  );
};
