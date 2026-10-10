/**
 * VitaSync: Emergency Blood-Inventory Redistribution Prototype
 *
 * Operational Command Application Entry Point.
 * Structured into two role-based dashboards (Requester Hospital & Provider Blood Center)
 * with instant sub-100ms switching, split-screen evaluation, and persistent global state.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { VitaSyncProvider, useVitaSync } from './context/VitaSyncContext';
import { TopNav, RoleMode } from './components/TopNav';
import { RequesterDashboard, RequesterTab } from './components/dashboards/RequesterDashboard';
import { ProviderDashboard, ProviderTab } from './components/dashboards/ProviderDashboard';
import { EventLogDrawer } from './components/EventLogDrawer';
import { UnitLabelModal } from './components/modals/UnitLabelModal';
import { BloodUnit } from './types/blood';
import { ShieldAlert, Activity, Columns, Building2, HeartHandshake } from 'lucide-react';
import { API_BASE_URL, DEMO_MODE } from './lib/api';

const VitaSyncAppContent: React.FC = () => {
  // Mode switcher: 'requester' | 'provider' | 'split'
  const [roleMode, setRoleMode] = useState<RoleMode>(() => {
    // Check URL hash first, then localStorage fallback
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#provider') return 'provider';
      if (hash === '#split') return 'split';
      if (hash === '#requester') return 'requester';
      const stored = localStorage.getItem('vitasync_role_mode');
      if (stored === 'provider' || stored === 'split' || stored === 'requester') {
        return stored as RoleMode;
      }
    }
    return 'requester';
  });

  const [isEventLogOpen, setIsEventLogOpen] = useState(false);
  const [inspectedUnit, setInspectedUnit] = useState<BloodUnit | null>(null);

  // Sub-tab preservation per mode
  const [requesterSubTab, setRequesterSubTab] = useState<RequesterTab>('request_hub');
  const [providerSubTab, setProviderSubTab] = useState<ProviderTab>('incoming_requests');

  // Selected centres preservation
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('node-metro');
  const [selectedHubId, setSelectedHubId] = useState<string>('node-apex');

  const {
    nodes,
    units,
    activeIncident,
    activePlan,
    dispatches,
    manifests,
    allRequests,
    eventLogs,
    isBackendConnected,
    resetSimulationState,
  } = useVitaSync();

  // Instant mode switch handler with URL hash & localStorage sync (<100ms, no re-fetch)
  const handleSelectRoleMode = useCallback((mode: RoleMode) => {
    setRoleMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vitasync_role_mode', mode);
      window.location.hash = `#${mode}`;
    }
  }, []);

  // Listen to hash change from browser navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#provider') setRoleMode('provider');
      else if (hash === '#split') setRoleMode('split');
      else if (hash === '#requester') setRoleMode('requester');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Keyboard shortcuts: Alt+1 = Requester, Alt+2 = Provider, Alt+3 = Split
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        handleSelectRoleMode('requester');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        handleSelectRoleMode('provider');
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        handleSelectRoleMode('split');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectRoleMode]);

  // Compute live attention counts for inactive badges
  // Requester attention: In-transit shipments or pending receiving signoff
  const requesterAttentionCount = useMemo(() => {
    const inboundDispatches = dispatches.filter(
      (d) => d.status === 'in_transit' && d.targetNodeId === selectedHospitalId
    ).length;
    const pendingReceiving = (activePlan?.legs || []).filter(
      (l) => l.targetNodeId === selectedHospitalId && l.sourceApproved && !l.receivingApproved
    ).length;
    return inboundDispatches + pendingReceiving;
  }, [dispatches, activePlan, selectedHospitalId]);

  // Provider attention: New requests requiring allocation or legs awaiting source approval
  const providerAttentionCount = useMemo(() => {
    const unallocated = allRequests.filter(
      (r) => r.status === 'SUBMITTED' || r.status === 'OPEN' || r.status === 'UNMET'
    ).length;
    const pendingSource = (activePlan?.legs || []).filter(
      (l) => l.sourceNodeId === selectedHubId && !l.sourceApproved
    ).length;
    return unallocated + pendingSource;
  }, [allRequests, activePlan, selectedHubId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Role-Based Top Navigation */}
      <TopNav
        roleMode={roleMode}
        onSelectRoleMode={handleSelectRoleMode}
        onReset={resetSimulationState}
        onToggleAuditLog={() => setIsEventLogOpen(true)}
        auditLogCount={eventLogs.length}
        requesterAttentionCount={requesterAttentionCount}
        providerAttentionCount={providerAttentionCount}
      />

      {DEMO_MODE && (
        <div className="border-b border-blue-700/60 bg-blue-950/80 px-4 py-2 text-xs text-blue-100 text-center">
          Synthetic frontend demo mode — requests and optimizer results are stored only in this browser and are not written to SQLite.
        </div>
      )}

      {!isBackendConnected && (
        <div className="border-b border-amber-700/60 bg-amber-950/80 px-4 py-3 text-xs text-amber-100">
          <div className="max-w-7xl mx-auto flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">VitaSync backend unavailable — requests cannot be saved.</div>
              <div className="text-amber-200/80 mt-0.5">
                This frontend is connected to {API_BASE_URL || 'the current site'}, but its /api endpoints are not available.
                Configure <code className="font-mono">VITE_API_BASE_URL</code> with the public Node backend URL and redeploy.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Operational Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Split View Container: Side by side for dual evaluation */}
        {roleMode === 'split' ? (
          <div className="space-y-4">
            <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl flex items-center justify-between text-xs text-purple-200">
              <div className="flex items-center gap-2">
                <Columns className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="font-semibold">Dual Role Evaluation Mode:</span>
                <span className="text-purple-300">
                  Left side: Requesting Hospital (inbound). Right side: Blood Center Hub (outbound). Actions sync across both sides in real time.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              {/* Left Column: Requester Dashboard */}
              <div className="border border-blue-500/30 rounded-2xl p-4 bg-slate-950/60 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-sm text-blue-300">Hospital Requester Bay</span>
                  </div>
                  <span className="text-3xs font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                    LEFT PANEL
                  </span>
                </div>
                <RequesterDashboard
                  activeSubTab={requesterSubTab}
                  onSubTabChange={setRequesterSubTab}
                  selectedHospitalId={selectedHospitalId}
                  onHospitalChange={setSelectedHospitalId}
                />
              </div>

              {/* Right Column: Provider Dashboard */}
              <div className="border border-rose-500/30 rounded-2xl p-4 bg-slate-950/60 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-sm text-rose-300">Blood Bank Provider Hub</span>
                  </div>
                  <span className="text-3xs font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                    RIGHT PANEL
                  </span>
                </div>
                <ProviderDashboard
                  activeSubTab={providerSubTab}
                  onSubTabChange={setProviderSubTab}
                  selectedHubId={selectedHubId}
                  onHubChange={setSelectedHubId}
                  onInspectUnitLabel={(u) => setInspectedUnit(u)}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Single View Container: Both components remain MOUNTED in the DOM to preserve form state and scroll position */
          <div className="w-full">
            {/* Requester Dashboard Panel */}
            <div className={roleMode === 'requester' ? 'block' : 'hidden'}>
              <RequesterDashboard
                activeSubTab={requesterSubTab}
                onSubTabChange={setRequesterSubTab}
                selectedHospitalId={selectedHospitalId}
                onHospitalChange={setSelectedHospitalId}
              />
            </div>

            {/* Provider Dashboard Panel */}
            <div className={roleMode === 'provider' ? 'block' : 'hidden'}>
              <ProviderDashboard
                activeSubTab={providerSubTab}
                onSubTabChange={setProviderSubTab}
                selectedHubId={selectedHubId}
                onHubChange={setSelectedHubId}
                onInspectUnitLabel={(u) => setInspectedUnit(u)}
              />
            </div>
          </div>
        )}
      </main>

      {/* Slide-out Immutable Audit Trail Drawer */}
      <EventLogDrawer
        isOpen={isEventLogOpen}
        onClose={() => setIsEventLogOpen(false)}
      />

      {/* Unit Barcode / Label Inspector Modal */}
      <UnitLabelModal
        unit={inspectedUnit}
        isOpen={!!inspectedUnit}
        onClose={() => setInspectedUnit(null)}
        onSendToScanner={() => {
          setRequesterSubTab('receiving');
          handleSelectRoleMode('requester');
          setInspectedUnit(null);
        }}
      />

      {/* Operational Regulatory Notice & Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 text-2xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">VitaSync Prototype</span>
            <span aria-hidden="true">·</span>
            <span>Two Role-Based Dashboards (Requester / Provider)</span>
            <span aria-hidden="true">·</span>
            <span>Deterministic SQLite Logistics Backend</span>
          </div>

          <div className="text-slate-400">
            Logistics decision-support prototype · Zero clinical triage, biological release, or real traffic signals
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <VitaSyncProvider>
      <VitaSyncAppContent />
    </VitaSyncProvider>
  );
}
