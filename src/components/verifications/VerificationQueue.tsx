import React, { useState, useEffect } from 'react';
import { ChevronDown, FileText, RotateCw, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { AccountRole } from '../../types/admin';
import { getOptimizedWebpUrl } from '../../utils/imageOptimizer';

type StatusFilter = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ALL';

export const VerificationQueue: React.FC = () => {
  const { 
    verifications, 
    selectedVerificationId, 
    setSelectedVerificationId,
    openComparisonModal,
    isLoadingVerifications,
    refreshVerifications,
    currentRole,
    selectedBarangay
  } = useAdmin();
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AccountRole>('ALL');
  const [sortOrder, setSortOrder] = useState<'RECENT' | 'OLDEST'>('RECENT');

  // Strictly scope queue to assigned barangay if logged in as local LGU officer
  const scopedVerifications = (currentRole === 'ADMIN' && selectedBarangay)
    ? verifications.filter(v => (v.barangay || '').toLowerCase() === selectedBarangay.toLowerCase())
    : verifications;

  const pendingCount = scopedVerifications.filter(v => v.status === 'PENDING / REVIEW').length;
  const verifiedCount = scopedVerifications.filter(v => v.status === 'VERIFIED').length;
  const rejectedCount = scopedVerifications.filter(v => v.status === 'REJECTED').length;
  const totalCount = scopedVerifications.length;

  const filteredVerifications = scopedVerifications
    .filter(v => {
      // Status filter
      if (statusFilter === 'PENDING' && v.status !== 'PENDING / REVIEW') return false;
      if (statusFilter === 'VERIFIED' && v.status !== 'VERIFIED') return false;
      if (statusFilter === 'REJECTED' && v.status !== 'REJECTED') return false;

      // Role filter
      if (roleFilter !== 'ALL' && v.role !== roleFilter) return false;

      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.submittedDate).getTime() || 0;
      const dateB = new Date(b.submittedDate).getTime() || 0;
      return sortOrder === 'RECENT' ? dateB - dateA : dateA - dateB;
    });

  // Auto-select first item when filter switches if current selection is not visible
  useEffect(() => {
    if (filteredVerifications.length > 0) {
      const isVisible = filteredVerifications.some(v => v.id === selectedVerificationId);
      if (!isVisible) {
        setSelectedVerificationId(filteredVerifications[0].id);
      }
    }
  }, [statusFilter, roleFilter, filteredVerifications, selectedVerificationId, setSelectedVerificationId]);

  return (
      <div className="bg-white rounded-3xl p-6 sm:p-7 h-full flex flex-col">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 gap-4">
        <div>
          <h3 className="text-xl font-black font-display text-[#0D0D11] tracking-tight">
            Verification Queue
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-medium">
            {statusFilter === 'PENDING' 
              ? `${pendingCount} document${pendingCount === 1 ? '' : 's'} awaiting review`
              : `${filteredVerifications.length} document${filteredVerifications.length === 1 ? '' : 's'} listed`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Role Filter Dropdown */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="appearance-none bg-[#F0F0EC] text-zinc-800 text-xs font-bold py-2 pl-3.5 pr-8 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 border-0"
            >
              <option value="ALL">All Roles</option>
              <option value="KASAMBAHAY">Kasambahay</option>
              <option value="HOMEOWNER">Homeowner</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sort Order Dropdown */}
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="appearance-none bg-[#F0F0EC] text-zinc-800 text-xs font-bold py-2 pl-3.5 pr-8 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 border-0"
            >
              <option value="RECENT">Recent First</option>
              <option value="OLDEST">Oldest First</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Live Sync Refresh Button */}
          <button
            type="button"
            onClick={() => refreshVerifications()}
            title="Sync with Backend"
            className="p-2 rounded-full bg-[#F0F0EC] text-zinc-700 hover:bg-[#E5E5E0] transition-colors cursor-pointer border-0"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingVerifications ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Filter Tabs - Unified Pill Badges */}
      <div className="flex items-center gap-2 pb-4 overflow-x-auto">
        {[
          { id: 'PENDING', label: 'Pending', icon: Clock, count: pendingCount },
          { id: 'VERIFIED', label: 'Verified', icon: CheckCircle, count: verifiedCount },
          { id: 'REJECTED', label: 'Rejected', icon: XCircle, count: rejectedCount },
          { id: 'ALL', label: 'All', icon: null, count: totalCount },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold font-display transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-[#0D0D11] text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
              }`}
            >
              {Icon && (
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FFB380]' : 'text-zinc-400'}`} />
              )}
              <span>{tab.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                isActive ? 'bg-[#FFB380] text-white' : 'bg-white text-zinc-600'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Requests Table or Empty State */}
      {filteredVerifications.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center my-auto">
          <div className="w-14 h-14 rounded-3xl bg-zinc-100 text-zinc-500 flex items-center justify-center mb-3">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h4 className="text-base font-black font-display text-[#0D0D11]">
            {statusFilter === 'PENDING' ? 'No Pending Requests' : 'No Documents Found'}
          </h4>
          <p className="text-xs text-zinc-400 max-w-xs mt-1 font-medium">
            {statusFilter === 'PENDING'
              ? 'All submitted documents in this category have been reviewed.'
              : `There are currently no documents matching the selected filters.`}
          </p>
          {statusFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className="mt-4 px-5 py-2 rounded-full bg-[#0D0D11] text-white text-xs font-bold font-display hover:bg-black transition-all cursor-pointer"
            >
              View All Records ({totalCount})
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-display">
                <th className="py-2.5 px-2.5">User & Role</th>
                <th className="py-2.5 px-2.5">Document</th>
                <th className="py-2.5 px-2.5">Submitted</th>
                <th className="py-2.5 px-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs space-y-1">
              {filteredVerifications.map((item) => {
                const isSelected = selectedVerificationId === item.id;
                const displayStatus = item.status === 'PENDING / REVIEW' ? 'In Review' : item.status === 'VERIFIED' ? 'Verified' : 'Rejected';
                return (
                  <tr
                    key={item.id}
                    onClick={() => openComparisonModal(item.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'hover:bg-zinc-50/80 text-zinc-700'
                    }`}
                    title="Click to inspect Face & Identity comparison"
                  >
                    {/* User & Role */}
                    <td className="py-2.5 px-2.5 rounded-l-2xl whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-full overflow-hidden shrink-0 bg-zinc-100 flex items-center justify-center">
                          {item.avatar ? (
                            <img
                              src={getOptimizedWebpUrl(item.avatar, { width: 64, height: 64, quality: 'auto' })}
                              alt={item.name}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="font-bold text-xs text-zinc-500">
                              {item.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[#0D0D11] leading-tight">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-medium mt-0.5">
                            {item.role === 'KASAMBAHAY' ? 'Kasambahay' : item.role === 'HOMEOWNER' ? 'Homeowner' : item.role}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Document Type (Consolidated Package or Single Doc) */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="font-medium text-xs text-zinc-800">
                          {item.isPackage ? (item.packageLabel || item.documentType) : item.documentType}
                        </span>
                        {item.isPackage && (
                          <span className="text-[10px] text-zinc-400 font-normal">
                            · 2 docs
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Submitted Date */}
                    <td className="py-2.5 px-2.5 text-xs font-medium text-zinc-400 whitespace-nowrap" title={item.submittedDate}>
                      {item.submittedDate.split(' ').slice(0, 3).join(' ')}
                    </td>

                    {/* Status Pill (Minimal with dot indicator) */}
                    <td className="py-2.5 px-2.5 text-right rounded-r-2xl whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${
                          item.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            item.status === 'VERIFIED'
                              ? 'bg-emerald-500'
                              : item.status === 'REJECTED'
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                        />
                        {item.isPackage && item.status === 'REJECTED' && (item.primaryStatus !== 'REJECTED' || item.secondaryStatus !== 'REJECTED')
                          ? 'Partial Reject'
                          : displayStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
