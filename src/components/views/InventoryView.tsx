import React, { useState, useMemo } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import { BloodGroup, BloodUnit, ComponentType } from '../../types/blood';
import { Search, Filter, QrCode, Thermometer, Calendar, Building, ShieldCheck } from 'lucide-react';

interface InventoryViewProps {
  onInspectUnitLabel: (unit: BloodUnit) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onInspectUnitLabel }) => {
  const { nodes, units } = useVitaSync();

  const [selectedNodeId, setSelectedNodeId] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'expiry' | 'din' | 'group' | 'temp'>('expiry');

  // Filtered units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (selectedNodeId !== 'all' && u.currentLocationNodeId !== selectedNodeId) return false;
      if (selectedComponent !== 'all' && u.component !== selectedComponent) return false;
      if (selectedGroup !== 'all' && u.bloodGroup !== selectedGroup) return false;
      if (selectedStatus !== 'all' && u.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDin = u.din.toLowerCase().includes(q);
        const matchesId = u.id.toLowerCase().includes(q);
        const matchesGroup = u.bloodGroup.toLowerCase().includes(q);
        if (!matchesDin && !matchesId && !matchesGroup) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'expiry') {
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      }
      if (sortBy === 'din') return a.din.localeCompare(b.din);
      if (sortBy === 'group') return a.bloodGroup.localeCompare(b.bloodGroup);
      if (sortBy === 'temp') return a.tempC - b.tempC;
      return 0;
    });
  }, [units, selectedNodeId, selectedComponent, selectedGroup, selectedStatus, searchQuery, sortBy]);

  // Aggregate stats per node
  const nodeStats = useMemo(() => {
    return nodes.map((n) => {
      const nodeUnits = units.filter((u) => u.currentLocationNodeId === n.id);
      const availableUnits = nodeUnits.filter((u) => u.status === 'available');
      const prbcCount = availableUnits.filter((u) => u.component === 'PRBC').length;
      const pltCount = availableUnits.filter((u) => u.component === 'PLATELETS').length;
      const ffpCount = availableUnits.filter((u) => u.component === 'FFP').length;
      const cryoCount = availableUnits.filter((u) => u.component === 'CRYO').length;
      const totalCapacity =
        n.storageCapacity.PRBC +
        n.storageCapacity.PLATELETS +
        n.storageCapacity.FFP +
        n.storageCapacity.CRYO;
      const utilPercent = Math.round((nodeUnits.length / totalCapacity) * 100);

      return {
        node: n,
        totalUnits: nodeUnits.length,
        availableUnits: availableUnits.length,
        prbcCount,
        pltCount,
        ffpCount,
        cryoCount,
        utilPercent,
      };
    });
  }, [nodes, units]);

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Node Facility Cards Strip */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-200">
            Regional Facility Cold-Storage Hubs (6 Nodes)
          </h2>
          <span className="text-xs text-slate-400">
            Total Synthetic Inventory: <span className="text-white font-mono font-bold tabular-nums">{units.length} units</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {nodeStats.map(({ node, totalUnits, availableUnits, prbcCount, pltCount, ffpCount, cryoCount, utilPercent }) => {
            const isSelected = selectedNodeId === node.id;
            return (
              <button
                key={node.id}
                onClick={() => setSelectedNodeId(isSelected ? 'all' : node.id)}
                className={`text-left p-3.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-slate-800/90 border-rose-500 shadow-sm'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {node.name}
                    </span>
                    <span className="text-2xs text-slate-400">
                      {node.cityZone} · Floor {node.safetyReserveFloorPercent}%
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-200 tabular-nums">
                    {availableUnits} avail
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-4 gap-1 text-center text-2xs font-mono">
                  <div className="p-1 bg-slate-950/50 rounded">
                    <span className="text-slate-500 block">PRBC</span>
                    <span className="text-slate-200 font-semibold tabular-nums">{prbcCount}</span>
                  </div>
                  <div className="p-1 bg-slate-950/50 rounded">
                    <span className="text-slate-500 block">PLT</span>
                    <span className="text-slate-200 font-semibold tabular-nums">{pltCount}</span>
                  </div>
                  <div className="p-1 bg-slate-950/50 rounded">
                    <span className="text-slate-500 block">FFP</span>
                    <span className="text-slate-200 font-semibold tabular-nums">{ffpCount}</span>
                  </div>
                  <div className="p-1 bg-slate-950/50 rounded">
                    <span className="text-slate-500 block">CRYO</span>
                    <span className="text-slate-200 font-semibold tabular-nums">{cryoCount}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ISBT-128 DIN (=W1234...), Unit ID, or Blood Group..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Component Filter */}
            <select
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-300 focus:outline-none"
            >
              <option value="all">All Components</option>
              <option value="PRBC">PRBC (Red Cells)</option>
              <option value="PLATELETS">Platelets</option>
              <option value="FFP">FFP (Plasma)</option>
              <option value="CRYO">Cryo</option>
            </select>

            {/* Blood Group Filter */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-300 focus:outline-none"
            >
              <option value="all">All ABO/Rh Groups</option>
              <option value="O-">O- (Univ. Red)</option>
              <option value="O+">O+</option>
              <option value="A-">A-</option>
              <option value="A+">A+</option>
              <option value="B-">B-</option>
              <option value="B+">B+</option>
              <option value="AB-">AB-</option>
              <option value="AB+">AB+ (Univ. Plasma)</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved (Plan)</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-300 focus:outline-none"
            >
              <option value="expiry">Sort: FEFO (Expiry)</option>
              <option value="din">Sort: DIN</option>
              <option value="group">Sort: Blood Group</option>
              <option value="temp">Sort: Temperature</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>
            Showing <strong className="text-white font-mono tabular-nums">{filteredUnits.length}</strong> of{' '}
            <strong className="text-slate-300 font-mono tabular-nums">{units.length}</strong> synthetic blood units
          </span>
          {selectedNodeId !== 'all' && (
            <button
              onClick={() => setSelectedNodeId('all')}
              className="text-rose-400 hover:text-rose-300 underline"
            >
              Clear Node Filter
            </button>
          )}
        </div>
      </div>

      {/* Units Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-2xs border-b border-slate-800 font-mono">
              <tr>
                <th className="py-2.5 px-4">ISBT-128 DIN</th>
                <th className="py-2.5 px-3">Group</th>
                <th className="py-2.5 px-3">Component</th>
                <th className="py-2.5 px-3">Facility Hub</th>
                <th className="py-2.5 px-3">Volume</th>
                <th className="py-2.5 px-3">Cold Chain Temp</th>
                <th className="py-2.5 px-3">Expiry (FEFO)</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-4 text-right">Label & Barcode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                    No blood units match the active filters or search terms.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => {
                  const node = nodes.find((n) => n.id === unit.currentLocationNodeId);
                  const expiry = new Date(unit.expiryDate);
                  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                  let statusBadge = (
                    <span className="text-emerald-400">Available</span>
                  );
                  if (unit.status === 'reserved') {
                    statusBadge = <span className="text-amber-400">Reserved</span>;
                  } else if (unit.status === 'in_transit') {
                    statusBadge = <span className="text-blue-400">In Transit</span>;
                  } else if (unit.status === 'delivered') {
                    statusBadge = <span className="text-purple-400">Delivered</span>;
                  }

                  const isUrgentExpiry = daysLeft <= 3;

                  return (
                    <tr
                      key={unit.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-200">
                        {unit.din}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-rose-400">
                          {unit.bloodGroup}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-300">
                        {unit.component}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-400">
                        {node?.name.split(' ')[0]}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums">
                        {unit.volumeMl} mL
                      </td>
                      <td className="py-2.5 px-3 tabular-nums">
                        <span className={unit.component === 'PLATELETS' ? 'text-amber-300' : 'text-blue-300'}>
                          {unit.tempC}°C
                        </span>
                      </td>
                      <td className="py-2.5 px-3 tabular-nums font-sans">
                        <span className={isUrgentExpiry ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                          {daysLeft} days ({expiry.toLocaleDateString()})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {statusBadge}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => onInspectUnitLabel(unit)}
                          className="px-2 py-1 text-2xs font-sans font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors inline-flex items-center gap-1"
                          title="Generate printable mock ISBT-128 label with scannable barcode"
                        >
                          <QrCode className="w-3 h-3 text-rose-400" />
                          <span>Inspect Mock Label</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
