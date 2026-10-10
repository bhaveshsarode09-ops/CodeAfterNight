import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer, QrCode, ShieldAlert, Check, Copy } from 'lucide-react';
import { generateBarcodeSvgBars } from '../../services/scannerService';

interface MockLabelSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUnitDin?: (din: string) => void;
}

interface MockUnitCard {
  id: string;
  din: string;
  centre: string;
  group: string;
  component: string;
  volume: number;
  role: string;
  note: string;
  qrDataUrl?: string;
}

export const MockLabelSheet: React.FC<MockLabelSheetProps> = ({
  isOpen,
  onClose,
  onSelectUnitDin,
}) => {
  const [labels, setLabels] = useState<MockUnitCard[]>([
    {
      id: 'VS-U-METRO-01',
      din: '=W1234260000100=',
      centre: 'C1 Metro Trauma Bay',
      group: 'O+',
      component: 'PLATELETS',
      volume: 240,
      role: 'Demand Requester Local Reserve',
      note: 'Critically low local stock (1 unit).',
    },
    {
      id: 'VS-U-101',
      din: '=W1234260010100=',
      centre: 'C2 Apex Regional Bank',
      group: 'O+',
      component: 'PLATELETS',
      volume: 250,
      role: 'Feasible Donor Unit #1',
      note: 'Optimal candidate; 68h remaining.',
    },
    {
      id: 'VS-U-102',
      din: '=W1234260010200=',
      centre: 'C2 Apex Regional Bank',
      group: 'A+',
      component: 'PLATELETS',
      volume: 250,
      role: 'Feasible Donor Unit #2',
      note: 'Optimal candidate; 64h remaining.',
    },
    {
      id: 'VS-U-301',
      din: '=W1234260030100=',
      centre: 'C3 Mercy Community Hospital',
      group: 'O+',
      component: 'PLATELETS',
      volume: 230,
      role: 'Stale / Expired Test Unit',
      note: 'Expired (-2h viability); rejected by FEFO.',
    },
    {
      id: 'VS-U-401',
      din: '=W1234260040100=',
      centre: 'C4 North Point Clinic',
      group: 'O+',
      component: 'PLATELETS',
      volume: 250,
      role: 'Reserve-Floor Protected Unit',
      note: 'Reserve floor 2; transfer rejected.',
    },
  ]);

  const [copiedDin, setCopiedDin] = useState<string | null>(null);

  useEffect(() => {
    async function generateQrs() {
      const updated = await Promise.all(
        labels.map(async (label) => {
          try {
            const url = await QRCode.toDataURL(label.din, {
              width: 140,
              margin: 1,
              color: { dark: '#0f172a', light: '#ffffff' },
            });
            return { ...label, qrDataUrl: url };
          } catch {
            return label;
          }
        })
      );
      setLabels(updated);
    }

    if (isOpen) {
      generateQrs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (din: string) => {
    navigator.clipboard.writeText(din);
    setCopiedDin(din);
    setTimeout(() => setCopiedDin(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:p-0 print:bg-white">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-lg shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Printable Mock ISBT-128 QR & Barcode Label Sheet
              </h3>
              <p className="text-2xs text-slate-400">
                True scannable 2D QR matrices and Code-128 bars for the 4-centre demo scenario
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sheet Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:p-2">
          {/* Header Banner */}
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded text-xs text-amber-200 flex items-start gap-2.5 print:hidden">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Zero Clinical Inference Protocol:</span> The browser camera or handheld scanner reads only the alphanumeric DIN string from these QR/barcodes. All blood groups, expiry, and temperatures come strictly from the synthetic backend record.
            </div>
          </div>

          {/* Grid of Printable Labels */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {labels.map((item) => {
              const barcodeSvg = generateBarcodeSvgBars(item.din);
              return (
                <div
                  key={item.id}
                  className="bg-white text-slate-900 border-2 border-slate-300 rounded p-3 space-y-2 select-none shadow-sm print:break-inside-avoid print:border-black"
                >
                  {/* Warning Strip */}
                  <div className="bg-rose-700 text-white text-center py-0.5 text-3xs font-bold uppercase tracking-wider -mx-3 -mt-3 mb-1">
                    SYNTHETIC TEST LABEL · NON-CLINICAL DISPATCH
                  </div>

                  <div className="flex items-start justify-between border-b border-slate-200 pb-2">
                    <div>
                      <div className="text-3xs font-mono text-slate-500 font-bold uppercase">
                        {item.centre}
                      </div>
                      <div className="text-xl font-black text-slate-900">
                        {item.group} {item.component}
                      </div>
                      <div className="text-3xs text-slate-600 font-medium">
                        Vol: {item.volume} mL · Agitated
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="w-16 h-16 shrink-0 bg-white p-0.5 border border-slate-200 rounded flex items-center justify-center">
                      {item.qrDataUrl ? (
                        <img
                          src={item.qrDataUrl}
                          alt={`QR for ${item.din}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-10 h-10 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Code-128 Barcode */}
                  <div className="space-y-0.5">
                    <div
                      dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                      className="w-full h-8 overflow-hidden"
                    />
                    <div className="text-xs font-mono font-bold text-center tracking-wider text-slate-800">
                      {item.din}
                    </div>
                  </div>

                  <div className="text-3xs text-slate-500 border-t border-slate-200 pt-1 flex justify-between font-mono">
                    <span>ID: {item.id}</span>
                    <span className="font-semibold text-slate-700">{item.role}</span>
                  </div>

                  {/* Interactive Button for instant test */}
                  <div className="pt-1 flex items-center gap-1.5 print:hidden">
                    <button
                      onClick={() => handleCopy(item.din)}
                      className="flex-1 py-1 text-3xs font-sans font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors inline-flex items-center justify-center gap-1"
                    >
                      {copiedDin === item.din ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>Copy DIN</span>
                        </>
                      )}
                    </button>

                    {onSelectUnitDin && (
                      <button
                        onClick={() => {
                          onSelectUnitDin(item.din);
                          onClose();
                        }}
                        className="flex-1 py-1 text-3xs font-sans font-bold bg-rose-600 hover:bg-rose-500 text-white rounded transition-colors text-center"
                      >
                        Scan In Camera
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
