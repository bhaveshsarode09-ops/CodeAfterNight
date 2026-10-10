import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import jsQR from 'jsqr';
import {
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Truck,
  Check,
  X,
  FileText,
  RotateCcw,
  Zap,
  Info,
  Layers,
  Thermometer,
  ShieldCheck,
  Flame,
  Camera,
  CameraOff,
  Search,
  PackageCheck,
  ChevronDown,
  ChevronUp,
  Send,
  Upload,
} from 'lucide-react';
import { BloodGroup, ComponentType, BloodUnit } from '../../types/blood';

export type RequesterTab = 'request_hub' | 'live_tracking' | 'receiving' | 'history';

interface RequesterDashboardProps {
  onNavigateToTab?: (tab: any) => void;
  activeSubTab?: RequesterTab;
  onSubTabChange?: (tab: RequesterTab) => void;
  selectedHospitalId?: string;
  onHospitalChange?: (id: string) => void;
}

export const RequesterDashboard: React.FC<RequesterDashboardProps> = ({
  onNavigateToTab,
  activeSubTab: externalSubTab,
  onSubTabChange,
  selectedHospitalId: externalHospitalId,
  onHospitalChange,
}) => {
  const {
    nodes,
    units,
    activeIncident,
    activePlan,
    dispatches,
    manifests,
    allRequests,
    roadEdges,
    eventLogs,
    createIncident,
    createBulkRequests,
    runBatchOptimization,
    approveReceivingLeg,
    verifyScannedUnit,
    isLoading,
  } = useVitaSync();

  // Sub-tabs: 'request_hub' | 'live_tracking' | 'receiving' | 'history'
  const [internalSubTab, setInternalSubTab] = useState<RequesterTab>('request_hub');
  const activeTab = externalSubTab !== undefined ? externalSubTab : internalSubTab;
  const setActiveTab = (tab: RequesterTab) => {
    if (onSubTabChange) onSubTabChange(tab);
    setInternalSubTab(tab);
  };

  // Hospital selection
  const [internalHospitalId, setInternalHospitalId] = useState<string>('node-metro');
  const selectedHospitalId = externalHospitalId !== undefined ? externalHospitalId : internalHospitalId;
  const setSelectedHospitalId = (id: string) => {
    if (onHospitalChange) onHospitalChange(id);
    setInternalHospitalId(id);
  };

  const hospitalNodes = useMemo(() => {
    return nodes.filter((n) => n.type !== 'regional_blood_bank');
  }, [nodes]);

  const currentHospital = useMemo(() => {
    return nodes.find((n) => n.id === selectedHospitalId) || hospitalNodes[0] || nodes[0];
  }, [nodes, hospitalNodes, selectedHospitalId]);

  // Request form state
  const [reqComponent, setReqComponent] = useState<ComponentType>('PLATELETS');
  const [reqBloodGroup, setReqBloodGroup] = useState<BloodGroup>('O+');
  const [reqQuantity, setReqQuantity] = useState<number>(3);
  const [reqUrgencyMin, setReqUrgencyMin] = useState<number>(30);
  const [reqPriority, setReqPriority] = useState<'STAT' | 'URGENT' | 'ROUTINE'>('STAT');
  const [reqNotes, setReqNotes] = useState<string>(
    'Emergency trauma resuscitation bay activation; immediate platelet infusion indicated.'
  );
  const [receivingOfficer, setReceivingOfficer] = useState<string>(
    'Dr. S. Nair (Trauma Bay Director)'
  );
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Bulk request state
  const [showBulkPanel, setShowBulkPanel] = useState<boolean>(false);
  const [bulkCsvInput, setBulkCsvInput] = useState<string>(
    `quantity,component,bloodGroup,urgencyTier,urgencyWindowMinutes,notes\n3,PLATELETS,O+,STAT,25,Massive trauma protocol bay 1\n2,PRBC,O-,STAT,30,Acute massive hemorrhage OR\n2,PLATELETS,A+,URGENT,50,ICU surgical bleed stabilization`
  );
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  // Scanner state inside Receiving tab
  const [scannerManualInput, setScannerManualInput] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Expanded card tracking
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // Units in this hospital
  const hospitalUnits = useMemo(() => {
    return units.filter((u) => u.currentLocationNodeId === selectedHospitalId);
  }, [units, selectedHospitalId]);

  // Active requests for this hospital
  const hospitalActiveRequests = useMemo(() => {
    return allRequests.filter((r) => r.target_centre_id === selectedHospitalId);
  }, [allRequests, selectedHospitalId]);

  // Incoming transfer legs for this hospital
  const incomingLegs = useMemo(() => {
    if (!activePlan || !activePlan.legs) return [];
    return activePlan.legs.filter((l) => l.targetNodeId === selectedHospitalId);
  }, [activePlan, selectedHospitalId]);

  // Inbound dispatches for this hospital
  const hospitalInboundDispatches = useMemo(() => {
    return dispatches.filter((d) => d.targetNodeId === selectedHospitalId);
  }, [dispatches, selectedHospitalId]);

  // Manifests destined for this hospital
  const hospitalManifests = useMemo(() => {
    return manifests.filter((m) => m.destinationNode.id === selectedHospitalId);
  }, [manifests, selectedHospitalId]);

  // Hospital-specific audit events
  const hospitalEvents = useMemo(() => {
    return eventLogs.filter(
      (e) =>
        e.summary.toLowerCase().includes(currentHospital?.name.toLowerCase() || '') ||
        e.summary.toLowerCase().includes(selectedHospitalId) ||
        e.actor.toLowerCase().includes('trauma') ||
        e.actor.toLowerCase().includes('nair')
    );
  }, [eventLogs, currentHospital, selectedHospitalId]);

  // Stock inventory calculation vs safety floor
  const inventoryStatus = useMemo(() => {
    const platelets = hospitalUnits.filter((u) => u.component === 'PLATELETS' && u.status === 'available').length;
    const prbc = hospitalUnits.filter((u) => u.component === 'PRBC' && u.status === 'available').length;
    const ffp = hospitalUnits.filter((u) => u.component === 'FFP' && u.status === 'available').length;
    
    // Safety floors (Metro baseline standard)
    const pltFloor = 5;
    const prbcFloor = 8;
    const ffpFloor = 4;

    return {
      platelets: { current: platelets, floor: pltFloor, deficit: Math.max(0, pltFloor - platelets) },
      prbc: { current: prbc, floor: prbcFloor, deficit: Math.max(0, prbcFloor - prbc) },
      ffp: { current: ffp, floor: ffpFloor, deficit: Math.max(0, ffpFloor - ffp) },
    };
  }, [hospitalUnits]);

  // Handle single demand creation
  const handleCreateSurgeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createIncident({
        incidentNumber: `EMD-${Date.now().toString().slice(-4)}`,
        title: `Trauma Surge Demand: ${reqQuantity}x ${reqComponent} (${reqBloodGroup}) - ${currentHospital?.name}`,
        type: 'TRAUMA_SURGE',
        targetNodeId: selectedHospitalId,
        urgencyMinutes: reqUrgencyMin,
        requestedUnits: [
          {
            component: reqComponent,
            bloodGroup: reqBloodGroup,
            quantity: reqQuantity,
            priority: reqPriority,
          },
        ],
        operationalNotes: reqNotes,
      });
      setActionSuccessMsg(
        `Emergency Request submitted! Forwarded to Regional Optimizer & Blood Centers. ETA queue ranked.`
      );
      setTimeout(() => setActionSuccessMsg(null), 5000);
      setActiveTab('live_tracking');
    } catch (err: any) {
      setActionErrorMsg(`Request creation failed: ${err.message || 'Network error'}`);
      setTimeout(() => setActionErrorMsg(null), 6000);
    }
  };

  // Preset quick triggers
  const handleApplyPreset = (preset: 'TRAUMA_STAT' | 'PPH_STAT' | 'PLATELET_BUFFER') => {
    if (preset === 'TRAUMA_STAT') {
      setReqComponent('PLATELETS');
      setReqBloodGroup('O+');
      setReqQuantity(4);
      setReqPriority('STAT');
      setReqUrgencyMin(25);
      setReqNotes('Level 1 Trauma Alert: Multitrauma resuscitation bay. Platelets critical floor deficit.');
    } else if (preset === 'PPH_STAT') {
      setReqComponent('PRBC');
      setReqBloodGroup('O-');
      setReqQuantity(3);
      setReqPriority('STAT');
      setReqUrgencyMin(30);
      setReqNotes('Obstetric hemorrhage protocol: Universal emergency O- RBC release required.');
    } else {
      setReqComponent('PLATELETS');
      setReqBloodGroup('A+');
      setReqQuantity(2);
      setReqPriority('URGENT');
      setReqUrgencyMin(45);
      setReqNotes('Cardiothoracic bypass post-operative platelet buffer augmentation.');
    }
  };

  // Submit bulk CSV for this hospital
  const handleSubmitBulk = async () => {
    try {
      const lines = bulkCsvInput.trim().split('\n');
      if (lines.length <= 1) return;
      const rows = [];
      const header = lines[0].split(',').map((h) => h.trim());
      
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length >= 4) {
          rows.push({
            targetCentreId: selectedHospitalId,
            quantity: parseInt(parts[0], 10),
            component: parts[1],
            bloodGroup: parts[2],
            urgencyTier: parts[3] || 'STAT',
            urgencyWindowMinutes: parts[4] ? parseInt(parts[4], 10) : 35,
            notes: parts[5] || 'Bulk emergency batch item',
          });
        }
      }

      const res = await createBulkRequests(rows, `BULK-${currentHospital?.id.toUpperCase()}-${Date.now().toString().slice(-4)}`, receivingOfficer);
      setBulkFeedback(`Successfully registered ${res.acceptedCount} bulk requests for ${currentHospital?.name}!`);
      setTimeout(() => setBulkFeedback(null), 5000);
      setActiveTab('live_tracking');
    } catch (err: any) {
      setBulkFeedback(`Bulk upload error: ${err.message}`);
    }
  };

  // Authorize Receiving Signoff
  const handleApproveReceiving = async (legId: string) => {
    if (!activePlan) return;
    const ok = await approveReceivingLeg(activePlan.id, legId, receivingOfficer);
    if (ok) {
      setActionSuccessMsg(`Inbound custody authorized by ${receivingOfficer}. Verified into receiving lock!`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    }
  };

  // Manual DIN or camera scan in Receiving tab
  const handleReceiveScan = async (dinToScan: string) => {
    setScanError(null);
    setScanResult(null);
    if (!dinToScan.trim()) return;

    try {
      const res = await verifyScannedUnit(
        dinToScan.trim(),
        'RECEIVE_PUT_INTO_STOCK',
        selectedHospitalId,
        22.1
      );
      if (res.success) {
        setScanResult(res);
        setScannerManualInput('');
        setActionSuccessMsg(`Unit ${dinToScan} received and stocked in ${currentHospital?.name} inventory!`);
        setTimeout(() => setActionSuccessMsg(null), 4000);
      } else {
        setScanError(res.message || 'Verification rejected.');
      }
    } catch (err: any) {
      setScanError(err.message || 'Scanner request failed.');
    }
  };

  // Camera continuous scan loop
  useEffect(() => {
    if (!isCameraActive) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch((err) => {
        setCameraError(`Camera feed unavailable: ${err.message}. Use manual DIN input.`);
        setIsCameraActive(false);
      });

    const scanFrame = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data) {
              handleReceiveScan(code.data);
              setIsCameraActive(false);
              return;
            }
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraActive]);

  return (
    <div className="space-y-5">
      {/* Hospital Role Selector Bar */}
      <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-blue-950/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                REQUESTER ROLE
              </span>
              <span className="text-xs text-slate-400">Inbound Blood Consumer</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <label htmlFor="hospital-select" className="text-xs text-slate-400 font-medium">
                Requesting Hospital:
              </label>
              <select
                id="hospital-select"
                value={selectedHospitalId}
                onChange={(e) => setSelectedHospitalId(e.target.value)}
                className="bg-slate-950 border border-blue-500/40 rounded-lg px-3 py-1 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {hospitalNodes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Stock Shortage Indicator vs Safety Floor */}
        <div className="flex items-center gap-2 sm:gap-4 bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-xs">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                inventoryStatus.platelets.deficit > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <div>
              <div className="text-2xs text-slate-400 font-mono">PLATELETS</div>
              <div className="font-bold text-white">
                {inventoryStatus.platelets.current} / {inventoryStatus.platelets.floor}
                {inventoryStatus.platelets.deficit > 0 && (
                  <span className="ml-1 text-rose-400 text-2xs font-mono font-bold">
                    (-{inventoryStatus.platelets.deficit})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                inventoryStatus.prbc.deficit > 0 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <div>
              <div className="text-2xs text-slate-400 font-mono">PRBC</div>
              <div className="font-bold text-white">
                {inventoryStatus.prbc.current} / {inventoryStatus.prbc.floor}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-2xs text-slate-400 font-mono">DEFICIT STATUS</div>
            <span
              className={`text-2xs font-mono font-bold px-2 py-0.5 rounded border ${
                inventoryStatus.platelets.deficit > 0
                  ? 'bg-rose-950 text-rose-400 border-rose-800'
                  : 'bg-emerald-950 text-emerald-400 border-emerald-800'
              }`}
            >
              {inventoryStatus.platelets.deficit > 0 ? 'CRITICAL SHORTAGE' : 'SAFETY FLOOR STABLE'}
            </span>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-blue-950/80 border border-blue-500/50 rounded-lg flex items-center justify-between text-xs text-blue-200 animate-fade-in shadow-md">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-blue-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification Alert */}
      {actionErrorMsg && (
        <div className="p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-lg flex items-center justify-between text-xs text-rose-200 animate-fade-in shadow-md">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{actionErrorMsg}</span>
          </div>
          <button
            onClick={() => setActionErrorMsg(null)}
            className="text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Tabs Segmented Navigation */}
      <div className="border-b border-slate-800 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('request_hub')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'request_hub'
              ? 'border-blue-500 text-blue-400 bg-blue-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>1. Request Hub</span>
          {inventoryStatus.platelets.deficit > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('live_tracking')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'live_tracking'
              ? 'border-blue-500 text-blue-400 bg-blue-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>2. Live Tracking</span>
          {hospitalActiveRequests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-900 text-blue-300 text-3xs font-mono">
              {hospitalActiveRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('receiving')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'receiving'
              ? 'border-blue-500 text-blue-400 bg-blue-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>3. Receiving &amp; Scanner</span>
          {incomingLegs.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-900 text-amber-300 text-3xs font-mono">
              {incomingLegs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-400 bg-blue-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>4. History &amp; Audit</span>
        </button>
      </div>

      {/* ================= TAB 1: REQUEST HUB ================= */}
      {activeTab === 'request_hub' && (
        <div className="space-y-6">
          {/* Quick Preset Buttons */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Quick Emergency Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('TRAUMA_STAT')}
                className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-medium transition-colors"
              >
                Trauma Shock STAT (4x Platelets O+)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('PPH_STAT')}
                className="px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 font-medium transition-colors"
              >
                Acute Hemorrhage STAT (3x PRBC O-)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('PLATELET_BUFFER')}
                className="px-2.5 py-1 rounded bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800 font-medium transition-colors"
              >
                ICU Platelet Buffer (2x Platelets A+)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Surge Request Form */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-rose-500" />
                    <span>Create Emergency Surge Request</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Submits formal logistics requirement to regional blood centers and activates priority routing.
                  </p>
                </div>
                <span className="text-2xs font-mono font-bold px-2 py-1 rounded bg-rose-950 text-rose-400 border border-rose-800">
                  {reqPriority} TIER
                </span>
              </div>

              <form onSubmit={handleCreateSurgeRequest} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Blood Group */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Blood Group
                    </label>
                    <select
                      value={reqBloodGroup}
                      onChange={(e) => setReqBloodGroup(e.target.value as BloodGroup)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="O+">O+ (Universal RBC Recipient / Common)</option>
                      <option value="O-">O- (Universal Red Blood Cell Donor)</option>
                      <option value="A+">A+ (Standard)</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+ (Universal Platelet/Plasma Donor)</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  {/* Component Type */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Component Type
                    </label>
                    <select
                      value={reqComponent}
                      onChange={(e) => setReqComponent(e.target.value as ComponentType)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="PLATELETS">PLATELETS (Room Temp 20-24°C, Agitated)</option>
                      <option value="PRBC">PACKED RED BLOOD CELLS (PRBC, Cold 1-6°C)</option>
                      <option value="FFP">FRESH FROZEN PLASMA (FFP, Frozen &lt;-18°C)</option>
                      <option value="CRYO">CRYOPRECIPITATE (Anti-hemophilic)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Required Quantity (Units)
                    </label>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setReqQuantity(Math.max(1, reqQuantity - 1))}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-l-lg border border-r-0 border-slate-700 text-sm font-bold"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={reqQuantity}
                        onChange={(e) => setReqQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-950 border-y border-slate-700 py-2 text-center text-sm font-bold text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setReqQuantity(reqQuantity + 1)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-r-lg border border-l-0 border-slate-700 text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Urgency Level */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Urgency Level
                    </label>
                    <select
                      value={reqPriority}
                      onChange={(e) => {
                        const val = e.target.value as 'STAT' | 'URGENT' | 'ROUTINE';
                        setReqPriority(val);
                        if (val === 'STAT') setReqUrgencyMin(25);
                        else if (val === 'URGENT') setReqUrgencyMin(60);
                        else setReqUrgencyMin(180);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="STAT">STAT (Immediate &le;30m)</option>
                      <option value="URGENT">URGENT (&le;60m)</option>
                      <option value="ROUTINE">ROUTINE (&le;180m)</option>
                    </select>
                  </div>

                  {/* Required By Minutes */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Deadline Window (Minutes)
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="number"
                        min="5"
                        max="720"
                        value={reqUrgencyMin}
                        onChange={(e) => setReqUrgencyMin(parseInt(e.target.value) || 30)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Logistics Notes */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Clinical Logistics Justification Notes
                  </label>
                  <textarea
                    rows={2}
                    value={reqNotes}
                    onChange={(e) => setReqNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    placeholder="Provide incident rationale, trauma bay location, or blood bank coordinator note..."
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-2xs text-slate-400 font-mono">
                    Destination: {currentHospital?.name} ({selectedHospitalId})
                  </span>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-blue-900/30 transition-all flex items-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Emergency Surge Request</span>
                  </button>
                </div>
              </form>

              {/* Bulk Request Dropdown / Expander */}
              <div className="pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkPanel(!showBulkPanel)}
                  className="w-full flex items-center justify-between py-2 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>Bulk Request Upload / CSV Entry (Disaster Surge Mode)</span>
                  </span>
                  {showBulkPanel ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showBulkPanel && (
                  <div className="mt-3 p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Upload multiple requests simultaneously for mass-casualty triage or regional disaster events. Rows will be validated against active inventory constraints.
                    </p>

                    <div>
                      <label className="block text-2xs font-mono text-slate-400 mb-1">
                        CSV Batch Rows (quantity, component, bloodGroup, urgencyTier, urgencyWindowMinutes, notes):
                      </label>
                      <textarea
                        rows={4}
                        value={bulkCsvInput}
                        onChange={(e) => setBulkCsvInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-2xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {bulkFeedback && (
                      <div className="p-2.5 bg-blue-950/70 border border-blue-800 rounded text-2xs text-blue-300 font-mono">
                        {bulkFeedback}
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleSubmitBulk}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5 text-blue-400" />
                        <span>Submit Bulk Surge Batch</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Hospital Local Safety Floor Watch */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Hospital Safety Floor Status</span>
                </h4>
                <p className="text-2xs text-slate-400 mt-0.5">
                  Real-time inventory currently stored in {currentHospital?.name} bays.
                </p>
              </div>

              <div className="space-y-3">
                {/* Platelets */}
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">PLATELETS (20-24°C)</span>
                    <span
                      className={`text-2xs font-mono font-bold px-2 py-0.5 rounded ${
                        inventoryStatus.platelets.deficit > 0
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {inventoryStatus.platelets.deficit > 0
                        ? `-${inventoryStatus.platelets.deficit} SHORTAGE`
                        : 'SUFFICIENT'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        inventoryStatus.platelets.deficit > 0 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((inventoryStatus.platelets.current / inventoryStatus.platelets.floor) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
                    <span>Available: {inventoryStatus.platelets.current} units</span>
                    <span>Safety Floor: {inventoryStatus.platelets.floor} units</span>
                  </div>
                </div>

                {/* PRBC */}
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">PACKED RBC (1-6°C)</span>
                    <span
                      className={`text-2xs font-mono font-bold px-2 py-0.5 rounded ${
                        inventoryStatus.prbc.deficit > 0
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {inventoryStatus.prbc.deficit > 0
                        ? `-${inventoryStatus.prbc.deficit} SHORTAGE`
                        : 'SUFFICIENT'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        inventoryStatus.prbc.deficit > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((inventoryStatus.prbc.current / inventoryStatus.prbc.floor) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
                    <span>Available: {inventoryStatus.prbc.current} units</span>
                    <span>Safety Floor: {inventoryStatus.prbc.floor} units</span>
                  </div>
                </div>

                {/* FFP */}
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">PLASMA / FFP (&lt;-18°C)</span>
                    <span
                      className={`text-2xs font-mono font-bold px-2 py-0.5 rounded ${
                        inventoryStatus.ffp.deficit > 0
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {inventoryStatus.ffp.deficit > 0
                        ? `-${inventoryStatus.ffp.deficit} SHORTAGE`
                        : 'SUFFICIENT'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        inventoryStatus.ffp.deficit > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((inventoryStatus.ffp.current / inventoryStatus.ffp.floor) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
                    <span>Available: {inventoryStatus.ffp.current} units</span>
                    <span>Safety Floor: {inventoryStatus.ffp.floor} units</span>
                  </div>
                </div>
              </div>

              {/* Local Units Listing Preview */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-2xs font-medium text-slate-400 block mb-2">
                  Units physically stocked in {currentHospital?.name} ({hospitalUnits.length}):
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {hospitalUnits.length === 0 ? (
                    <div className="text-3xs text-slate-500 italic py-2 text-center">
                      No units currently stocked in this hospital bay.
                    </div>
                  ) : (
                    hospitalUnits.map((u) => (
                      <div
                        key={u.id}
                        className="px-2 py-1 bg-slate-950 border border-slate-800/80 rounded flex items-center justify-between text-2xs font-mono"
                      >
                        <span className="text-slate-300">{u.din}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-rose-400 font-bold">{u.bloodGroup}</span>
                          <span className="text-slate-500">{u.component}</span>
                          <span className="text-emerald-400">{u.tempC}°C</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: LIVE TRACKING ================= */}
      {activeTab === 'live_tracking' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                <span>Active Demand Tracking &amp; Inbound ResQtech Telemetry</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time lifecycle for blood requests submitted by {currentHospital?.name}.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Active: {hospitalActiveRequests.length} requests
            </span>
          </div>

          {hospitalActiveRequests.length === 0 && !activeIncident ? (
            <div className="p-12 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-3">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-300">
                No Active Blood Requests from {currentHospital?.name}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create a surge demand in the Request Hub to track multi-facility allocation, provider approvals, and courier transit in real time.
              </p>
              <button
                onClick={() => setActiveTab('request_hub')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Go to Request Hub</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {hospitalActiveRequests.map((req) => {
                // Determine lifecycle progress step (1 to 5)
                let step = 1; // Requested
                let stepLabel = '1. Requested (Queued)';
                if (req.status === 'PLAN_PROPOSED') {
                  step = 2;
                  stepLabel = '2. Optimizer Proposed (MILP Matched)';
                } else if (req.status === 'SOURCE_APPROVED') {
                  step = 3;
                  stepLabel = '3. Source Blood Bank Approved';
                } else if (req.status === 'IN_TRANSIT_SIMULATED' || req.status === 'DISPATCH_READY') {
                  step = 4;
                  stepLabel = '4. In Transit (ResQtech Active)';
                } else if (req.status === 'ARRIVED_SIMULATED' || req.status === 'COMPLETED_SIMULATED' || req.fulfilled_quantity === req.quantity) {
                  step = 5;
                  stepLabel = '5. Delivered & Stocked';
                }

                // Check matching dispatch for telemetry
                const matchedDispatch = hospitalInboundDispatches.find(
                  (d) => d.targetNodeId === selectedHospitalId
                );

                const isExpanded = expandedRequestId === req.id;

                return (
                  <div
                    key={req.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                            req.urgency_tier === 'STAT'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {req.urgency_tier}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">
                              {req.quantity}x {req.component} ({req.blood_group})
                            </h4>
                            <span className="text-2xs font-mono text-slate-400">
                              ID: {req.id}
                            </span>
                          </div>
                          <p className="text-2xs text-slate-400 mt-0.5">
                            Required within: {req.urgency_window_minutes}m · Destination: {currentHospital?.name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-blue-950 text-blue-300 border border-blue-800">
                          {stepLabel}
                        </span>
                        <button
                          onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Progress Step Bar */}
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-5 gap-2 text-center text-3xs font-mono font-medium text-slate-400">
                        <span className={step >= 1 ? 'text-blue-400 font-bold' : ''}>1. Requested</span>
                        <span className={step >= 2 ? 'text-blue-400 font-bold' : ''}>2. Proposed</span>
                        <span className={step >= 3 ? 'text-blue-400 font-bold' : ''}>3. Source Approved</span>
                        <span className={step >= 4 ? 'text-blue-400 font-bold' : ''}>4. In Transit</span>
                        <span className={step >= 5 ? 'text-emerald-400 font-bold' : ''}>5. Delivered</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full transition-all duration-500 ${
                            step === 5 ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${(step / 5) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Telemetry & ETA Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs">
                      <div>
                        <span className="text-2xs text-slate-400 font-mono block">ESTIMATED ARRIVAL</span>
                        <span className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          {matchedDispatch ? `~${Math.max(1, Math.round(18 * (1 - matchedDispatch.progressPercent / 100)))} mins` : '~14 mins'}
                        </span>
                      </div>

                      <div>
                        <span className="text-2xs text-slate-400 font-mono block">TRANSIT DISTANCE</span>
                        <span className="text-sm font-bold text-white">
                          8.4 km
                        </span>
                      </div>

                      <div>
                        <span className="text-2xs text-slate-400 font-mono block">TRAFFIC CORRIDOR</span>
                        <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 inline-block mt-0.5">
                          RESQTECH CORRIDOR ACTIVE
                        </span>
                      </div>

                      <div>
                        <span className="text-2xs text-slate-400 font-mono block">COLD CHAIN MONITOR</span>
                        <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                          <Thermometer className="w-3.5 h-3.5" />
                          {matchedDispatch ? `${matchedDispatch.coldChainTempC.toFixed(1)}°C NOMINAL` : '22.1°C NOMINAL'}
                        </span>
                      </div>
                    </div>

                    {/* Actions and Next Step Prompt */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-2xs text-slate-400">
                        {step < 3 && 'Waiting for provider source release approval at Blood Center...'}
                        {step === 3 && 'Source release approved! Courier package being loaded for dispatch.'}
                        {step === 4 && 'Vehicle en route! Head to Receiving tab to authorize signoff on delivery.'}
                        {step === 5 && 'Custody verified and stored in local inventory.'}
                      </div>

                      {step >= 3 && step < 5 && (
                        <button
                          onClick={() => setActiveTab('receiving')}
                          className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <span>Authorize Receiving Signoff</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: RECEIVING & SCANNER ================= */}
      {activeTab === 'receiving' && (
        <div className="space-y-6">
          {/* Section A: Pending Receiving Signoffs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Pending Custodial Receiving Signoff</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm receipt of incoming transfer legs and sign custody into {currentHospital?.name}.
                </p>
              </div>
              <span className="text-2xs font-mono text-slate-400">
                Pending: {incomingLegs.length} transfers
              </span>
            </div>

            {incomingLegs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/60 rounded-lg">
                No transfer legs currently awaiting receiving signoff for {currentHospital?.name}.
              </div>
            ) : (
              <div className="space-y-3">
                {incomingLegs.map((leg) => {
                  const sourceNode = nodes.find((n) => n.id === leg.sourceNodeId);
                  const isBothApproved = leg.sourceApproved && leg.receivingApproved;

                  return (
                    <div
                      key={leg.id}
                      className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              Leg #{leg.id}: {leg.allocatedUnitIds.length}x {leg.component} ({leg.bloodGroup})
                            </span>
                            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              Origin: {sourceNode?.name || leg.sourceNodeId}
                            </span>
                          </div>
                          <p className="text-2xs text-slate-400 mt-1 font-mono">
                            ETA: {leg.resqtechCorridorEtaMin}m · Distance: {leg.distanceKm}km · Units: {leg.allocatedUnitIds.join(', ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {leg.receivingApproved ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-xs font-semibold">
                              <Check className="w-3.5 h-3.5" />
                              <span>Receiving Authorized</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApproveReceiving(leg.id)}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-colors flex items-center gap-1.5 shadow"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Sign &amp; Accept Custody</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Approval Status Badges */}
                      <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80 text-2xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Source Release:</span>
                          {leg.sourceApproved ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Approved by {leg.sourceApprovedBy}
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold">Awaiting Provider Release</span>
                          )}
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Receiver Custody:</span>
                          {leg.receivingApproved ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Signed by {leg.receivingApprovedBy}
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold">Awaiting Hospital Signature</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section B: Inbound Unit Scanner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span>Physical Unit Scanner (ISBT-128 DIN Verification)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Scan inbound blood containers with browser webcam or manual DIN to verify against manifest and admit into local inventory.
                </p>
              </div>
              <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                RECEIVE_PUT_INTO_STOCK
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Camera Feed or Placeholder */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col items-center justify-center min-h-[220px] relative">
                {isCameraActive ? (
                  <div className="w-full flex flex-col items-center">
                    <video
                      ref={videoRef}
                      className="w-full max-h-48 rounded bg-black object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <button
                      onClick={() => setIsCameraActive(false)}
                      className="mt-3 px-3 py-1 bg-slate-800 text-slate-300 hover:text-white rounded text-xs flex items-center gap-1.5"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      <span>Stop Optical Camera</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 mx-auto">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-xs text-slate-400">
                      Optical barcode / QR scanner idle
                    </div>
                    <button
                      onClick={() => setIsCameraActive(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-2 mx-auto"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Activate Webcam Scanner</span>
                    </button>
                  </div>
                )}
                {cameraError && (
                  <p className="text-2xs text-amber-400 text-center mt-2">{cameraError}</p>
                )}
              </div>

              {/* Right: Manual DIN Entry Fallback */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-300">
                    Manual DIN or Mock Barcode Input
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. VS-U-101 or =W1234260010100="
                      value={scannerManualInput}
                      onChange={(e) => setScannerManualInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => handleReceiveScan(scannerManualInput)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Verify
                    </button>
                  </div>

                  {/* Quick test buttons with real demo DINs */}
                  <div className="pt-2">
                    <span className="text-3xs font-mono text-slate-400 block mb-1">
                      Quick Demo Units (click to test scan):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleReceiveScan('VS-U-101')}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-3xs font-mono"
                      >
                        VS-U-101 (Platelets A+)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReceiveScan('VS-U-102')}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-3xs font-mono"
                      >
                        VS-U-102 (Platelets A+)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReceiveScan('VS-U-201')}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-3xs font-mono"
                      >
                        VS-U-201 (PRBC O-)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scan Feedback Box */}
                {scanResult && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-xs space-y-1">
                    <div className="text-emerald-300 font-semibold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>{scanResult.message}</span>
                    </div>
                    {scanResult.unit && (
                      <div className="text-2xs font-mono text-slate-300">
                        DIN: {scanResult.unit.din} · Group: {scanResult.unit.bloodGroup} · Temp: {scanResult.unit.tempC}°C
                      </div>
                    )}
                  </div>
                )}

                {scanError && (
                  <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-300 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-rose-400" />
                    {scanError}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: HISTORY & AUDIT ================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Manifests for this Hospital */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Transfer Manifests &amp; Certified Receipts</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Archived digital custody manifests destined for {currentHospital?.name}.
                </p>
              </div>

              {hospitalManifests.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No transfer manifests generated for this hospital yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {hospitalManifests.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white font-mono">{m.manifestNumber}</span>
                        <span className="text-2xs font-mono text-slate-400">
                          {new Date(m.generatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-2xs text-slate-400">
                        Origin: {m.sourceNode.name} &rarr; Destination: {m.destinationNode.name}
                      </div>
                      <div className="flex items-center justify-between text-2xs font-mono pt-1 border-t border-slate-800/80">
                        <span className="text-slate-300">{m.units.length} unit(s) verified</span>
                        <span className="text-emerald-400">Dual Signoff Sealed</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hospital-specific Event Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Hospital Clinical Logistics Audit Trail</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Append-only immutable record of requests, approvals, and custody receipts.
                </p>
              </div>

              {hospitalEvents.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No audit logs recorded for this hospital yet.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {hospitalEvents.map((e) => (
                    <div
                      key={e.id}
                      className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-2xs font-mono text-slate-400">
                        <span className="text-blue-400">{e.type}</span>
                        <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-200 text-xs">{e.summary}</p>
                      <div className="text-3xs text-slate-500 font-mono">
                        Actor: {e.actor}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
