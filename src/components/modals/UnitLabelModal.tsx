import React from 'react';
import { BloodUnit } from '../../types/blood';
import { X, QrCode, ArrowRight, ShieldAlert, Copy, Check } from 'lucide-react';
import { generateBarcodeSvgBars } from '../../services/scannerService';

interface UnitLabelModalProps {
  unit: BloodUnit | null;
  isOpen: boolean;
  onClose: () => void;
  onSendToScanner: (din: string) => void;
}

export const UnitLabelModal: React.FC<UnitLabelModalProps> = ({
  unit,
  isOpen,
  onClose,
  onSendToScanner,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !unit) return null;

  const handleCopyDin = () => {
    navigator.clipboard.writeText(unit.din);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate SVG mock bars for DIN and Product Code
  const dinSvg = generateBarcodeSvgBars(unit.din);
  const prodSvg = generateBarcodeSvgBars(`${unit.component}-E0398`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-lg shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">
              Synthetic ISBT-128 Unit Label Inspector
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Mock Blood Bag Label (Physical Label Emulation) */}
          <div className="bg-white text-slate-900 rounded p-4 font-sans border-2 border-slate-300 shadow-inner select-none relative overflow-hidden">
            {/* Red Warning Banner Across Top */}
            <div className="bg-rose-700 text-white text-center py-0.5 text-2xs font-bold uppercase tracking-wider -mx-4 -mt-4 mb-3">
              SYNTHETIC TEST LABEL ONLY · NON-CLINICAL LOGISTICS PROTOTYPE
            </div>

            {/* Quad Grid: Quadrant 1 (DIN) & Quadrant 2 (Group) */}
            <div className="grid grid-cols-2 gap-4 border-b-2 border-slate-300 pb-3">
              {/* Q1: DIN Barcode */}
              <div className="space-y-1">
                <div className="text-2xs text-slate-500 uppercase font-mono font-bold">
                  Donation Identification Number
                </div>
                <div
                  dangerouslySetInnerHTML={{ __html: dinSvg }}
                  className="w-full h-10 overflow-hidden"
                />
                <div className="text-xs font-mono font-bold tracking-wider text-slate-800">
                  {unit.din}
                </div>
              </div>

              {/* Q2: ABO / Rh(D) */}
              <div className="flex flex-col items-center justify-center border-l-2 border-slate-300 pl-3">
                <div className="text-2xs text-slate-500 uppercase font-mono font-bold">
                  ABO / Rh(D) Group
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                  {unit.bloodGroup}
                </div>
                <div className="text-2xs text-slate-600 font-medium">
                  {unit.bloodGroup.includes('+') ? 'Rh(D) POSITIVE' : 'Rh(D) NEGATIVE'}
                </div>
              </div>
            </div>

            {/* Quad Grid: Quadrant 3 (Product) & Quadrant 4 (Expiry) */}
            <div className="grid grid-cols-2 gap-4 pt-3">
              {/* Q3: Product Code */}
              <div className="space-y-1">
                <div className="text-2xs text-slate-500 uppercase font-mono font-bold">
                  Component / Product Code
                </div>
                <div
                  dangerouslySetInnerHTML={{ __html: prodSvg }}
                  className="w-full h-9 overflow-hidden"
                />
                <div className="text-xs font-bold text-slate-900">
                  {unit.component === 'PRBC'
                    ? 'RED BLOOD CELLS (Leukoreduced)'
                    : unit.component === 'PLATELETS'
                    ? 'PLATELETS (Apheresis Concentrate)'
                    : unit.component === 'FFP'
                    ? 'FRESH FROZEN PLASMA'
                    : 'CRYOPRECIPITATED AHF'}
                </div>
                <div className="text-2xs text-slate-600 font-mono">
                  Volume: {unit.volumeMl} mL · {unit.anticoagulant}
                </div>
              </div>

              {/* Q4: Expiry and Storage Temp */}
              <div className="border-l-2 border-slate-300 pl-3 space-y-1">
                <div className="text-2xs text-slate-500 uppercase font-mono font-bold">
                  Expiry Date & Time
                </div>
                <div className="text-sm font-bold text-rose-800 font-mono">
                  {new Date(unit.expiryDate).toLocaleDateString()} 23:59
                </div>
                <div className="text-2xs text-slate-600 mt-1">
                  Storage Temp:{' '}
                  <strong>
                    {unit.component === 'PRBC'
                      ? '1°C to 6°C'
                      : unit.component === 'PLATELETS'
                      ? '20°C to 24°C (Agitated)'
                      : '-18°C or colder'}
                  </strong>
                </div>
                <div className="text-2xs text-slate-500 font-mono pt-1">
                  Synthetic ID: {unit.id}
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
            <button
              onClick={handleCopyDin}
              className="w-full sm:w-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors inline-flex items-center justify-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>DIN Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy DIN to Clipboard</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                onSendToScanner(unit.din);
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded shadow-sm transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <span>Verify DIN in Unit Scanner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
