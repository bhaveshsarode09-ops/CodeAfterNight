/**
 * VitaSync: Real Browser Camera & Inventory-Event Scanner
 *
 * Implements:
 * 1. Real webcam optical feed with jsQR continuous frame decoding
 * 2. Guaranteed manual DIN entry fallback
 * 3. Explicit operator event selection (RECEIVE, VERIFY, ISSUE)
 * 4. Duplicate-scan protection and server-side state enforcement
 * 5. Printable / visual mock ISBT-128 QR code sheet
 * 6. Live inventory refresh via backend integration
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { useVitaSync } from '../../context/VitaSyncContext';
import { apiFetch } from '../../lib/api';
import { MockLabelSheet } from '../modals/MockLabelSheet';
import {
  Camera,
  CameraOff,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Search,
  Printer,
  RotateCcw,
  PackageCheck,
  PackageMinus,
  CheckSquare,
  Thermometer,
  Layers,
} from 'lucide-react';
import { SCANNER_SAFETY_NOTICE } from '../../services/scannerService';

export type OperatorEventType =
  | 'RECEIVE_PUT_INTO_STOCK'
  | 'VERIFY_INVENTORY'
  | 'REMOVE_ISSUE_FROM_STOCK';

export const ScannerView: React.FC = () => {
  const { nodes } = useVitaSync();

  const [manualInput, setManualInput] = useState('');
  const [selectedCentreId, setSelectedCentreId] = useState(nodes[0]?.id || 'node-metro');
  const [selectedEventType, setSelectedEventType] = useState<OperatorEventType>('RECEIVE_PUT_INTO_STOCK');
  const [temperatureProbeC, setTemperatureProbeC] = useState<number>(21.8);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLabelSheetOpen, setIsLabelSheetOpen] = useState(false);

  // Scan result and error states
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<{ code: string; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Duplicate scan tracking in session
  const lastScannedRef = useRef<{ text: string; eventType: string; timestamp: number } | null>(null);

  // Video and Canvas Refs for jsQR
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Stops the camera video stream and cancels frame animation
   */
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  /**
   * Executes the backend inventory event mutation
   */
  const executeScanEvent = useCallback(
    async (rawText: string, method: 'CAMERA_QR' | 'MANUAL_DIN_ENTRY') => {
      if (!rawText.trim() || isProcessing) return;

      const cleanedText = rawText.trim();

      // Client-side quick duplicate scan throttle (within 3 seconds for exact same event)
      const now = Date.now();
      if (
        lastScannedRef.current &&
        lastScannedRef.current.text === cleanedText &&
        lastScannedRef.current.eventType === selectedEventType &&
        now - lastScannedRef.current.timestamp < 3500
      ) {
        setScanError({
          code: 'CLIENT_DUPLICATE_THROTTLE',
          message: `Rapid duplicate scan ignored. Unit ${cleanedText} was just processed for '${selectedEventType}'.`,
        });
        return;
      }

      setIsProcessing(true);
      setScanError(null);
      setScanResult(null);

      try {
        const response = await apiFetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scannedText: cleanedText,
            eventType: selectedEventType,
            centreId: selectedCentreId,
            scanMethod: method,
            temperatureCheckC: temperatureProbeC,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setScanError({
            code: data.error || 'SERVER_ERROR',
            message: data.message || 'Error processing scan event.',
          });
        } else {
          lastScannedRef.current = {
            text: cleanedText,
            eventType: selectedEventType,
            timestamp: now,
          };
          setScanResult(data);
          setManualInput('');
        }
      } catch (err: any) {
        setScanError({
          code: 'NETWORK_ERROR',
          message: err.message || 'Failed to connect to backend scan API.',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, selectedEventType, selectedCentreId, temperatureProbeC]
  );

  /**
   * Frame decoding loop running on canvas using jsQR
   */
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        // QR code detected!
        executeScanEvent(code.data, 'CAMERA_QR');
      }
    }

    if (isCameraActive) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  }, [isCameraActive, executeScanEvent]);

  /**
   * Starts camera stream with navigator.mediaDevices.getUserMedia
   */
  const startCamera = async () => {
    setCameraError(null);
    setScanError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Camera API is not supported in this browser context. Please use the Manual DIN Fallback below.'
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraActive(true);
        };
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError(
        'Camera permission was denied or camera hardware is unavailable in this environment. Use the Manual DIN Fallback below or open the Printable Label Sheet.'
      );
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    if (isCameraActive) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive, scanFrame]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-6">
      {/* Offscreen Canvas for jsQR video processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Safety Boundary Header */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-2 text-xs text-slate-300">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">
                Optical Barcode & Inventory-Event Protocol
              </span>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                {SCANNER_SAFETY_NOTICE} Camera vision decodes alphanumeric DIN strings only; all serological blood groups, expiry, and custody data come strictly from the synthetic backend record.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsLabelSheetOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Open Mock QR Label Sheet</span>
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewfinder & Manual DIN Fallback (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Operator Action & Facility Control Strip */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-300 font-semibold block">
                  1. Operating Facility (Bay Location)
                </span>
                <span className="text-2xs text-slate-500">
                  Select the centre where this scanner is actively deployed
                </span>
              </div>
              <select
                value={selectedCentreId}
                onChange={(e) => setSelectedCentreId(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-200 font-medium focus:outline-none focus:border-rose-500"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Operator Event Type Selector */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-300 block mb-1.5">
                2. Explicit Inventory Action (Required Event)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEventType('RECEIVE_PUT_INTO_STOCK')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedEventType === 'RECEIVE_PUT_INTO_STOCK'
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Receive / Put in Stock</span>
                  </div>
                  <span className="text-3xs text-slate-400 block mt-0.5">
                    Transfers custody to receiving bay
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedEventType('VERIFY_INVENTORY')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedEventType === 'VERIFY_INVENTORY'
                      ? 'bg-blue-950/70 border-blue-500 text-blue-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                    <span>Verify Integrity</span>
                  </div>
                  <span className="text-3xs text-slate-400 block mt-0.5">
                    Checks viability without moving stock
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedEventType('REMOVE_ISSUE_FROM_STOCK')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedEventType === 'REMOVE_ISSUE_FROM_STOCK'
                      ? 'bg-purple-950/70 border-purple-500 text-purple-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <PackageMinus className="w-3.5 h-3.5 text-purple-400" />
                    <span>Issue to OR</span>
                  </div>
                  <span className="text-3xs text-slate-400 block mt-0.5">
                    Removes unit from active inventory
                  </span>
                </button>
              </div>
            </div>

            {/* Cold Chain Probe Sensor Simulation Input */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-blue-400" />
                <span>Cold-Chain Handheld Probe Sensor Reading:</span>
              </span>
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  step="0.1"
                  value={temperatureProbeC}
                  onChange={(e) => setTemperatureProbeC(parseFloat(e.target.value) || 21.8)}
                  className="w-16 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-right text-blue-300 font-bold focus:outline-none"
                />
                <span className="text-slate-400">°C (20–24.5°C nominal)</span>
              </div>
            </div>
          </div>

          {/* Camera Viewfinder */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Live Camera Barcode / QR Optical Scanner
                </h3>
                <p className="text-xs text-slate-400">
                  Continuous frame decoding via jsQR
                </p>
              </div>

              <button
                onClick={isCameraActive ? stopCamera : startCamera}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 ${
                  isCameraActive
                    ? 'bg-rose-900/70 hover:bg-rose-800 text-rose-200 border border-rose-700'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {isCameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Stop Camera</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5 text-rose-400" />
                    <span>Start Webcam</span>
                  </>
                )}
              </button>
            </div>

            {/* Viewfinder Window */}
            <div className="relative w-full aspect-[4/3] max-h-72 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
              />

              {isCameraActive ? (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-36 border-2 border-rose-500/80 rounded-lg shadow-[0_0_15px_rgba(244,63,94,0.3)] relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 text-rose-400 text-2xs font-mono px-2 py-0.5 rounded border border-rose-800">
                      jsQR ACTIVE RETICLE
                    </div>
                    <div className="w-full h-0.5 bg-rose-500/60 absolute top-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-500">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-xs text-slate-300 font-medium">
                    Camera Viewfinder Standby
                  </div>
                  <div className="text-2xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Click "Start Webcam" to stream camera frames. If browser camera permissions are blocked by iframe sandboxes, utilize the Manual DIN Fallback below.
                  </div>
                  {cameraError && (
                    <div className="p-2 bg-amber-950/40 border border-amber-800/50 rounded text-amber-300 text-2xs max-w-sm mx-auto text-left">
                      {cameraError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual DIN Fallback Input */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Manual DIN Entry Fallback (Guaranteed Input)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && executeScanEvent(manualInput, 'MANUAL_DIN_ENTRY')}
                  placeholder="Enter ISBT-128 DIN e.g. =W1234260010100= or VS-U-101"
                  className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
                <button
                  disabled={isProcessing || !manualInput.trim()}
                  onClick={() => executeScanEvent(manualInput, 'MANUAL_DIN_ENTRY')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Execute Event</span>
                </button>
              </div>
            </div>
          </div>

          {/* Validation Error Card */}
          {scanError && (
            <div className="p-4 bg-rose-950/50 border border-rose-800 rounded-lg text-xs text-rose-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Validation Rejection: {scanError.code}</span>
              </div>
              <p className="text-slate-300 leading-relaxed">{scanError.message}</p>
            </div>
          )}

          {/* Successful Scan Feedback Card */}
          {scanResult && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-lg text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Inventory Event Persisted in SQLite</span>
                </div>
                <span className="font-mono text-2xs text-emerald-400/80 uppercase">
                  {scanResult.actionExecuted}
                </span>
              </div>

              {/* Data Grid: Strict Synthetic Backend Provenance */}
              <div className="p-3 bg-slate-950/70 rounded border border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-2xs text-slate-300">
                <div>
                  <span className="text-slate-500 block">DIN</span>
                  <span className="text-white font-bold">{scanResult.din}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">GROUP & COMPONENT</span>
                  <span className="text-rose-400 font-bold">
                    {scanResult.bloodGroup} · {scanResult.component}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">STATUS</span>
                  <span className="text-emerald-400 font-bold">{scanResult.newStatus || scanResult.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">SENSOR TEMP</span>
                  <span className="text-blue-400 font-bold">{scanResult.storageTempC}°C</span>
                </div>
              </div>

              <div className="text-2xs text-slate-400">
                {scanResult.nonClinicalDisclaimer}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Quick-Test Palette & Manual Test Guide (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Quick-Test Mock Barcode Palette */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Known Mock Scenario Units
              </h3>
              <span className="text-2xs text-slate-400 font-mono">1-Click Test Decodes</span>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-white block">=W1234260010100=</span>
                  <span className="text-2xs text-slate-400">VS-U-101 · Apex Blood Center (C2)</span>
                </div>
                <button
                  onClick={() => executeScanEvent('=W1234260010100=', 'MANUAL_DIN_ENTRY')}
                  className="px-2.5 py-1 text-2xs font-bold text-white bg-slate-800 hover:bg-rose-600 rounded transition-colors"
                >
                  Test Scan
                </button>
              </div>

              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-white block">=W1234260010200=</span>
                  <span className="text-2xs text-slate-400">VS-U-102 · Apex Blood Center (C2)</span>
                </div>
                <button
                  onClick={() => executeScanEvent('=W1234260010200=', 'MANUAL_DIN_ENTRY')}
                  className="px-2.5 py-1 text-2xs font-bold text-white bg-slate-800 hover:bg-rose-600 rounded transition-colors"
                >
                  Test Scan
                </button>
              </div>

              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-white block">=W1234260030100=</span>
                  <span className="text-2xs text-amber-400">VS-U-301 · Mercy Hospital (Stale)</span>
                </div>
                <button
                  onClick={() => executeScanEvent('=W1234260030100=', 'MANUAL_DIN_ENTRY')}
                  className="px-2.5 py-1 text-2xs font-bold text-white bg-slate-800 hover:bg-rose-600 rounded transition-colors"
                >
                  Test Scan
                </button>
              </div>

              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-white block">=INVALID-999-FAKE=</span>
                  <span className="text-2xs text-rose-400">Unknown Test ID (Rejection test)</span>
                </div>
                <button
                  onClick={() => executeScanEvent('=INVALID-999-FAKE=', 'MANUAL_DIN_ENTRY')}
                  className="px-2.5 py-1 text-2xs font-bold text-white bg-slate-800 hover:bg-rose-600 rounded transition-colors"
                >
                  Test Reject
                </button>
              </div>
            </div>
          </div>

          {/* Test & Verification Guide */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-3 text-xs">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>Operator Manual Test Verification Guide</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400 leading-relaxed">
              <li>
                <strong className="text-slate-300">Scan Known Unit:</strong> Select "Receive / Put in Stock", click "Test Scan" on `=W1234260010100=`. Notice successful custody transfer and status change to AVAILABLE.
              </li>
              <li>
                <strong className="text-slate-300">Duplicate Scan Protection:</strong> Click "Test Scan" on `=W1234260010100=` a second time immediately. Notice backend rejects with <code>DUPLICATE_SCAN_PROTECTION</code>.
              </li>
              <li>
                <strong className="text-slate-300">Unknown ID Rejection:</strong> Click "Test Reject" on `=INVALID-999-FAKE=`. Notice backend rejects with <code>UNKNOWN_UNIT_ID</code>.
              </li>
              <li>
                <strong className="text-slate-300">Issue / Remove from Stock:</strong> Switch the event to "Issue to OR", then scan `=W1234260010100=`. Notice status mutates to ISSUED_TO_OR.
              </li>
              <li>
                <strong className="text-slate-300">Camera / Permission Handling:</strong> Click "Start Webcam". If permission is denied or running in a sandbox, verify error message appears and manual fallback remains 100% operational.
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Printable Mock Label Sheet Modal */}
      <MockLabelSheet
        isOpen={isLabelSheetOpen}
        onClose={() => setIsLabelSheetOpen(false)}
        onSelectUnitDin={(din) => executeScanEvent(din, 'MANUAL_DIN_ENTRY')}
      />
    </div>
  );
};
