import React, { useState } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import {
  PRBC_COMPATIBILITY_RULES,
  FFP_COMPATIBILITY_RULES,
  PLATELET_COMPATIBILITY_RULES,
  CRYO_COMPATIBILITY_RULES,
  COMPATIBILITY_POLICY_DISCLAIMER,
} from '../../services/compatibilityRules';
import { SYNTHETIC_KAGGLE_HISTORICAL_DATA } from '../../data/syntheticData';
import {
  ShieldAlert,
  Database,
  FileSpreadsheet,
  Lock,
  Layers,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { BloodGroup } from '../../types/blood';

export const GovernanceView: React.FC = () => {
  const { policyMode, setPolicyMode, replanActiveIncident } = useVitaSync();
  const [activeTab, setActiveTab] = useState<'policy' | 'dataset'>('policy');

  const groups: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-2 text-xs text-slate-300">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">
              Operational Regulatory & Compliance Governance Boundary
            </span>
            <p className="text-slate-400 mt-0.5 leading-relaxed">
              {COMPATIBILITY_POLICY_DISCLAIMER}
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Tab Controls */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('policy')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'policy'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Demo Compatibility Rulebook & Policy
        </button>
        <button
          onClick={() => setActiveTab('dataset')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'dataset'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Synthetic Benchmark Dataset Inspector
        </button>
      </div>

      {activeTab === 'policy' ? (
        <div className="space-y-6">
          {/* Active Policy Selector */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Demo Redistribution Policy Configuration
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select algorithmic rule engine governing automated multi-criteria redistribution
                </p>
              </div>

              <select
                value={policyMode}
                onChange={(e) => {
                  setPolicyMode(e.target.value as any);
                  replanActiveIncident();
                }}
                className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 font-semibold focus:outline-none focus:border-rose-500"
              >
                <option value="standard_demo_matrix">Standard Demo Redistribution Matrix (Default)</option>
                <option value="strict_isogroup">Strict Isogroup Only (Exact ABO/Rh Match)</option>
                <option value="universal_emergency">Universal Protocol (O- Red Cells / AB+ Plasma)</option>
              </select>
            </div>
          </div>

          {/* Differentiated Component Matrix Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PRBC Red Cell Compatibility */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
              <div>
                <div className="text-xs font-mono text-rose-400">ERYTHROCYTE LOGISTICS</div>
                <h4 className="text-sm font-bold text-white mt-0.5">
                  Packed Red Blood Cells (PRBC) Matrix
                </h4>
                <p className="text-2xs text-slate-400">
                  Targeted at erythrocyte ABO and Rh(D) surface antigens. O- functions as universal donor red cells.
                </p>
              </div>

              <div className="border border-slate-800 rounded overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 text-2xs border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Recipient Group</th>
                      <th className="py-2 px-3">Compatible Donor Units</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {groups.map((grp) => (
                      <tr key={grp} className="hover:bg-slate-800/30">
                        <td className="py-1.5 px-3 font-bold text-rose-400">{grp}</td>
                        <td className="py-1.5 px-3">
                          {PRBC_COMPATIBILITY_RULES[grp].join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FFP Plasma Compatibility */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
              <div>
                <div className="text-xs font-mono text-blue-400">PLASMA LOGISTICS</div>
                <h4 className="text-sm font-bold text-white mt-0.5">
                  Fresh Frozen Plasma (FFP) Matrix
                </h4>
                <p className="text-2xs text-slate-400">
                  Soluble isohemagglutinins present in plasma invert red-cell rules: <strong className="text-blue-300">AB is universal donor</strong>; O plasma contains both anti-A and anti-B!
                </p>
              </div>

              <div className="border border-slate-800 rounded overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 text-2xs border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Recipient Group</th>
                      <th className="py-2 px-3">Compatible Plasma Units</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {groups.map((grp) => (
                      <tr key={grp} className="hover:bg-slate-800/30">
                        <td className="py-1.5 px-3 font-bold text-blue-400">{grp}</td>
                        <td className="py-1.5 px-3">
                          {FFP_COMPATIBILITY_RULES[grp].join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Platelets Compatibility Rule */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
              <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded text-2xs text-amber-300">
                <span className="font-bold">CRITICAL SAFEGUARD:</span> Never apply red-cell compatibility logic to platelets! Platelet transfusions consider recipient HLA antibodies, low-titer plasma volume, and short 5-day viability.
              </div>
              <div>
                <div className="text-xs font-mono text-amber-400">THROMBOCYTE LOGISTICS</div>
                <h4 className="text-sm font-bold text-white mt-0.5">
                  Platelets (RDP / SDP) Matrix
                </h4>
                <p className="text-2xs text-slate-400">
                  Isogroup matching preferred; cross-group triage permitted under demo protocol only.
                </p>
              </div>

              <div className="border border-slate-800 rounded overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 text-2xs border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Recipient Group</th>
                      <th className="py-2 px-3">Demo Compatible Platelet Groups</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {groups.map((grp) => (
                      <tr key={grp} className="hover:bg-slate-800/30">
                        <td className="py-1.5 px-3 font-bold text-amber-400">{grp}</td>
                        <td className="py-1.5 px-3">
                          {PLATELET_COMPATIBILITY_RULES[grp].join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cryoprecipitate Compatibility */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
              <div>
                <div className="text-xs font-mono text-purple-400">FIBRINOGEN POOL</div>
                <h4 className="text-sm font-bold text-white mt-0.5">
                  Cryoprecipitated AHF Matrix
                </h4>
                <p className="text-2xs text-slate-400">
                  Minimal plasma supernatant; ABO matching preferred, but permitted across ABO barriers in emergency massive hemorrhage resuscitation.
                </p>
              </div>

              <div className="border border-slate-800 rounded overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 text-2xs border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Recipient Group</th>
                      <th className="py-2 px-3">Demo Compatible Cryo Groups</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {groups.map((grp) => (
                      <tr key={grp} className="hover:bg-slate-800/30">
                        <td className="py-1.5 px-3 font-bold text-purple-400">{grp}</td>
                        <td className="py-1.5 px-3">
                          {CRYO_COMPATIBILITY_RULES[grp].join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Kaggle/Synthetic Tabular Dataset Inspector */
        <div className="space-y-6">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-mono text-emerald-400">DATASET GOVERNANCE AUDIT</div>
                <h3 className="text-base font-semibold text-white mt-0.5">
                  Synthetic Metropolitan Blood Demand & Surge Timeseries
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Derived from open healthcare logistics benchmarks. Tabular CSV records model historical operational patterns and demand volatility.
                </p>
              </div>
              <span className="px-2.5 py-1 text-2xs font-mono bg-slate-800 text-emerald-400 border border-slate-700 rounded">
                License: CC0 Public Domain
              </span>
            </div>

            {/* Privacy and Methodology Assurance Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-950 rounded border border-slate-800 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Zero Donor PII Guarantee</span>
                </span>
                <p className="text-2xs text-slate-400 leading-relaxed">
                  Dataset contains zero donor names, contact numbers, email addresses, or clinical patient records. Aggregated logistical metrics only.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>Demand History ≠ Live Stock</span>
                </span>
                <p className="text-2xs text-slate-400 leading-relaxed">
                  Historical demand timeseries provides consumption forecasting baselines; it is not real-time inventory on hospital shelves.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tabular Data ≠ Vision Training</span>
                </span>
                <p className="text-2xs text-slate-400 leading-relaxed">
                  Structured tabular rows inform route timing and demand baselines; they are never used as a camera vision training set.
                </p>
              </div>
            </div>

            {/* Historical Timeseries Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Tabular Reference Log (15-Day Sample Segment)
                </span>
                <span className="text-2xs text-slate-400 font-mono">
                  Showing 15 rows · Aggregate metrics
                </span>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 text-2xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Weekday</th>
                      <th className="py-2.5 px-3">Collections</th>
                      <th className="py-2.5 px-3">Routine Issues</th>
                      <th className="py-2.5 px-3">Emergency Surges</th>
                      <th className="py-2.5 px-3">Unfulfilled Units</th>
                      <th className="py-2.5 px-3">O- Deficit %</th>
                      <th className="py-2.5 px-3">Platelet Wastage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {SYNTHETIC_KAGGLE_HISTORICAL_DATA.map((row) => (
                      <tr key={row.date} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-semibold text-white">{row.date}</td>
                        <td className="py-2 px-3 font-sans text-slate-400">{row.weekday}</td>
                        <td className="py-2 px-3 tabular-nums">{row.totalCollections}</td>
                        <td className="py-2 px-3 tabular-nums">{row.routineIssues}</td>
                        <td className="py-2 px-3 tabular-nums text-rose-400 font-bold">{row.emergencySurgeDemands}</td>
                        <td className="py-2 px-3 tabular-nums">
                          {row.unfulfilledEmergencyUnits > 0 ? (
                            <span className="text-amber-400 font-bold">{row.unfulfilledEmergencyUnits}</span>
                          ) : (
                            <span className="text-emerald-400">0</span>
                          )}
                        </td>
                        <td className="py-2 px-3 tabular-nums">{row.oNegDeficitPercentage}%</td>
                        <td className="py-2 px-3 tabular-nums">{row.plateletWastagePercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
