import React, { useState } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import {
  FileText,
  Copy,
  Check,
  ShieldAlert,
  ArrowRight,
  Thermometer,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { TransferManifest } from '../../types/blood';

interface ManifestViewProps {
  onNavigateToTab: (tab: any) => void;
}

export const ManifestView: React.FC<ManifestViewProps> = ({ onNavigateToTab }) => {
  const { manifests } = useVitaSync();
  const [selectedManifestId, setSelectedManifestId] = useState<string>(
    manifests[0]?.id || ''
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeManifest =
    manifests.find((m) => m.id === selectedManifestId) || manifests[0];

  const handleCopyJson = (manifest: TransferManifest) => {
    navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    setCopiedId(manifest.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header and Compliance Notice */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-2 text-xs text-slate-300">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">
              Operational Inter-Facility Transfer Custody Vault
            </span>
            <p className="text-slate-400 mt-0.5 leading-relaxed">
              Transfer manifests document cold-chain custodial handoffs, package integrity, and dispatch routes. They DO NOT certify clinical crossmatches, pre-transfusion antibody screens, blood release, or transfusion authorization.
            </p>
          </div>
        </div>
      </div>

      {manifests.length === 0 ? (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-lg text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-300">
            No Transfer Manifests Generated Yet
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Authorize an emergency redistribution plan in the Operations Command tab to generate certified cold-chain transfer manifests.
          </p>
          <button
            onClick={() => onNavigateToTab('command')}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
          >
            Go to Operations Command
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Manifests Sidebar List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Certified Manifests ({manifests.length})
            </h3>

            <div className="space-y-2">
              {manifests.map((m) => {
                const isSelected = activeManifest?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedManifestId(m.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-rose-500 shadow-sm'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white font-mono">
                        {m.manifestNumber}
                      </span>
                      <span className="text-2xs font-mono text-slate-400">
                        {new Date(m.generatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 mt-1 flex items-center gap-1.5 truncate">
                      <span>{m.sourceNode.name.split(' ')[0]}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span>{m.destinationNode.name.split(' ')[0]}</span>
                    </div>

                    <div className="mt-2 text-2xs text-slate-400 flex justify-between font-mono">
                      <span>{m.units.length} units payload</span>
                      <span>Dep. {m.coldChainDepartureTempC}°C</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manifest Printable/Formal Card (8 cols) */}
          <div className="lg:col-span-8">
            {activeManifest && (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-lg space-y-6">
                {/* Manifest Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="text-2xs font-mono text-rose-400 uppercase tracking-wider">
                      Official Cold-Chain Transport Manifest
                    </div>
                    <h2 className="text-lg font-bold text-white font-mono mt-0.5">
                      {activeManifest.manifestNumber}
                    </h2>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Incident Ref: <span className="font-mono text-slate-300">{activeManifest.incidentId}</span> · Generated: {new Date(activeManifest.generatedAt).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyJson(activeManifest)}
                    className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors inline-flex items-center gap-1.5 shrink-0 self-start"
                  >
                    {copiedId === activeManifest.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>JSON Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy JSON Record</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Routing & Facility Signatories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-950/60 rounded border border-slate-800 space-y-1">
                    <span className="text-2xs text-slate-500 uppercase tracking-wider font-mono">
                      Origin Dispatch Facility
                    </span>
                    <div className="font-bold text-white text-sm">
                      {activeManifest.sourceNode.name}
                    </div>
                    <div className="text-slate-400">
                      Authorized Officer: <span className="text-slate-200 font-medium">{activeManifest.sourceNode.officer}</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-950/60 rounded border border-slate-800 space-y-1">
                    <span className="text-2xs text-slate-500 uppercase tracking-wider font-mono">
                      Destination Receiving Facility
                    </span>
                    <div className="font-bold text-white text-sm">
                      {activeManifest.destinationNode.name}
                    </div>
                    <div className="text-slate-400">
                      Receiving Coordinator: <span className="text-slate-200 font-medium">{activeManifest.destinationNode.officer}</span>
                    </div>
                  </div>
                </div>

                {/* Transport & Telemetry Specifications */}
                <div className="p-3.5 bg-slate-950/40 rounded border border-slate-800/80 grid grid-cols-3 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 text-2xs block">TRANSPORT MODE</span>
                    <span className="text-slate-200 font-semibold">{activeManifest.transportMode}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-2xs block">DEPARTURE TEMPERATURE</span>
                    <span className="text-blue-400 font-semibold tabular-nums">{activeManifest.coldChainDepartureTempC}°C</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-2xs block">SECURITY SIGNATURE</span>
                    <span className="text-slate-400 truncate block text-2xs">{activeManifest.digitalSignature}</span>
                  </div>
                </div>

                {/* Units In Manifest Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      Certified Unit Payload Inventory ({activeManifest.units.length} units)
                    </span>
                    <span className="text-2xs font-mono text-slate-400">
                      ISBT-128 DIN · Vol · Expiry
                    </span>
                  </div>

                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-2xs border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">DIN</th>
                          <th className="py-2 px-3">Group</th>
                          <th className="py-2 px-3">Component</th>
                          <th className="py-2 px-3">Volume</th>
                          <th className="py-2 px-3">Expiry</th>
                          <th className="py-2 px-3 text-right">Custody Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {activeManifest.units.map((unit) => (
                          <tr key={unit.id} className="hover:bg-slate-800/30">
                            <td className="py-2 px-3 font-semibold text-white">
                              {unit.din}
                            </td>
                            <td className="py-2 px-3 text-rose-400 font-bold">
                              {unit.bloodGroup}
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-300">
                              {unit.component}
                            </td>
                            <td className="py-2 px-3 tabular-nums">
                              {unit.volumeMl} mL
                            </td>
                            <td className="py-2 px-3 font-sans tabular-nums text-2xs">
                              {new Date(unit.expiryDate).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {unit.destinationArrivalVerified ? (
                                <span className="text-emerald-400 font-sans font-medium">
                                  ✓ Verified at Bay
                                </span>
                              ) : (
                                <span className="text-amber-400 font-sans">
                                  Origin Verified · In Custody
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cryptographic Hash and Non-Clinical Notice */}
                <div className="pt-3 border-t border-slate-800 space-y-2 text-2xs text-slate-400">
                  <div className="font-mono text-slate-500 break-all">
                    Verification Audit Checksum: {activeManifest.verificationHash}
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded border border-slate-800/60 text-slate-400 leading-relaxed font-sans">
                    <strong className="text-slate-300">Disclaimer:</strong> {activeManifest.legalDisclaimer}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
