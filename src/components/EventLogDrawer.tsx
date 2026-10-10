import React, { useState, useMemo } from 'react';
import { useVitaSync } from '../context/VitaSyncContext';
import {
  FileText,
  X,
  Search,
  Filter,
  ShieldAlert,
  Copy,
  Check,
  Clock,
  User,
  Activity,
  Layers,
} from 'lucide-react';

interface EventLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EventLogDrawer: React.FC<EventLogDrawerProps> = ({ isOpen, onClose }) => {
  const { eventLogs } = useVitaSync();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return eventLogs.filter((log) => {
      if (filterType !== 'all' && log.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSummary = log.summary.toLowerCase().includes(q);
        const matchesActor = log.actor.toLowerCase().includes(q);
        const matchesType = log.type.toLowerCase().includes(q);
        const matchesId = log.id.toLowerCase().includes(q);
        return matchesSummary || matchesActor || matchesType || matchesId;
      }
      return true;
    });
  }, [eventLogs, filterType, searchQuery]);

  const uniqueEventTypes = useMemo(() => {
    return Array.from(new Set(eventLogs.map((l) => l.type)));
  }, [eventLogs]);

  const handleCopyJson = (payload: any, id: string) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Immutable Audit Trail &amp; Event Log</span>
                  <span className="text-2xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {eventLogs.length} events
                  </span>
                </h3>
                <p className="text-2xs text-slate-400 mt-0.5">
                  Append-only SQLite event store with cryptographic action hashes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/80 space-y-2.5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter events by actor, summary, DIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Types ({eventLogs.length})</option>
                {uniqueEventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Event List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-800/40">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No audit events matched your search query.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isSelected = selectedEventId === log.id;
                const formattedTime = new Date(log.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div
                    key={log.id}
                    className={`pt-2.5 first:pt-0 transition-colors rounded-lg p-2.5 border ${
                      isSelected
                        ? 'bg-slate-800/60 border-blue-500/40'
                        : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xs font-mono font-medium px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 border border-emerald-950">
                          {log.type}
                        </span>
                        <span className="text-2xs text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5 text-slate-500" />
                          {formattedTime}
                        </span>
                      </div>
                      <span className="text-2xs text-slate-400 flex items-center gap-1 font-mono">
                        <User className="w-2.5 h-2.5 text-slate-400" />
                        {log.actor.split('(')[0].trim()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 font-medium mt-1.5 leading-snug">
                      {log.summary}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-3xs font-mono text-slate-400">
                        ID: {log.id}
                      </span>
                      {log.payload && (
                        <button
                          onClick={() =>
                            setSelectedEventId(isSelected ? null : log.id)
                          }
                          className="text-2xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                        >
                          {isSelected ? 'Hide Payload' : 'View Payload JSON'}
                        </button>
                      )}
                    </div>

                    {isSelected && log.payload && (
                      <div className="mt-2 p-2.5 bg-slate-950 border border-slate-800 rounded font-mono text-2xs text-slate-300 overflow-x-auto relative">
                        <button
                          onClick={() => handleCopyJson(log.payload, log.id)}
                          className="absolute top-2 right-2 p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                          title="Copy JSON"
                        >
                          {copiedId === log.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                        <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Notice */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-3xs text-slate-400 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              Synthetic audit trail only. Cryptographic integrity verified against local SQLite database.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
