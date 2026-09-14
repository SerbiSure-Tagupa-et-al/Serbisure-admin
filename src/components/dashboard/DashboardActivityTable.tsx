import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  ArrowUpRight, 
  Loader2, 
  Inbox, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

const ITEMS_PER_PAGE = 5;

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, '...', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export const DashboardActivityTable: React.FC = () => {
  const { verifications, bookings, isLoadingDashboardActivity, setActiveNav, currentRole, selectedBarangay } = useAdmin();
  const [activeTab, setActiveTab] = useState<'DEPLOYMENTS' | 'VERIFICATIONS'>('DEPLOYMENTS');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingsPage, setBookingsPage] = useState(1);
  const [verificationsPage, setVerificationsPage] = useState(1);

  // Scope to assigned barangay if logged in as local LGU officer
  const scopedVerifications = useMemo(() => {
    return (currentRole === 'ADMIN' && selectedBarangay)
      ? verifications.filter(v => (v.barangay || '').toLowerCase() === selectedBarangay.toLowerCase())
      : verifications;
  }, [currentRole, selectedBarangay, verifications]);

  const scopedBookings = useMemo(() => {
    return (currentRole === 'ADMIN' && selectedBarangay)
      ? bookings.filter(b => (b.barangay || '').toLowerCase() === selectedBarangay.toLowerCase())
      : bookings;
  }, [currentRole, selectedBarangay, bookings]);

  // Reset pagination on filter or tab changes
  useEffect(() => {
    setBookingsPage(1);
    setVerificationsPage(1);
  }, [searchTerm, selectedBarangay, activeTab]);

  // Filtered lists
  const filteredBookings = useMemo(() => {
    if (!searchTerm.trim()) return scopedBookings;
    const q = searchTerm.toLowerCase().trim();
    return scopedBookings.filter(b => 
      (b.homeownerName || '').toLowerCase().includes(q) ||
      (b.workerName || '').toLowerCase().includes(q) ||
      (b.contractType || '').toLowerCase().includes(q) ||
      (b.serviceCategory || '').toLowerCase().includes(q) ||
      (b.barangay || '').toLowerCase().includes(q) ||
      (b.bookingStatus || '').toLowerCase().includes(q)
    );
  }, [scopedBookings, searchTerm]);

  const filteredVerifications = useMemo(() => {
    if (!searchTerm.trim()) return scopedVerifications;
    const q = searchTerm.toLowerCase().trim();
    return scopedVerifications.filter(v => 
      (v.name || '').toLowerCase().includes(q) ||
      (v.role || '').toLowerCase().includes(q) ||
      (v.documentType || '').toLowerCase().includes(q) ||
      (v.barangay || '').toLowerCase().includes(q) ||
      (v.status || '').toLowerCase().includes(q)
    );
  }, [scopedVerifications, searchTerm]);

  // Safe pagination calculations for bookings
  const totalBookings = filteredBookings.length;
  const totalBookingPages = Math.max(1, Math.ceil(totalBookings / ITEMS_PER_PAGE));
  const safeBookingsPage = Math.min(Math.max(1, bookingsPage), totalBookingPages);
  const startBookingIdx = (safeBookingsPage - 1) * ITEMS_PER_PAGE;
  const endBookingIdx = Math.min(startBookingIdx + ITEMS_PER_PAGE, totalBookings);
  const paginatedBookings = filteredBookings.slice(startBookingIdx, endBookingIdx);

  // Safe pagination calculations for verifications
  const totalVerifications = filteredVerifications.length;
  const totalVerifPages = Math.max(1, Math.ceil(totalVerifications / ITEMS_PER_PAGE));
  const safeVerifPage = Math.min(Math.max(1, verificationsPage), totalVerifPages);
  const startVerifIdx = (safeVerifPage - 1) * ITEMS_PER_PAGE;
  const endVerifIdx = Math.min(startVerifIdx + ITEMS_PER_PAGE, totalVerifications);
  const paginatedVerifications = filteredVerifications.slice(startVerifIdx, endVerifIdx);

  // Helper for status badge styling
  const renderBookingStatusBadge = (status?: string) => {
    const s = (status || 'Pending').toLowerCase();
    if (s.includes('complete')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Completed</span>
        </span>
      );
    }
    if (s.includes('progress') || s.includes('accepted')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700">
          <Clock className="w-3.5 h-3.5 text-sky-600" />
          <span>{s.includes('progress') ? 'In Progress' : 'Accepted'}</span>
        </span>
      );
    }
    if (s.includes('cancel')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-600">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
          <span>Cancelled</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700">
        <Clock className="w-3.5 h-3.5 text-amber-500" />
        <span>Pending</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-zinc-100/80">
      {/* Top Tabs & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5">
        
        {/* Navigation Tabs with Pills */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-extrabold font-display pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('DEPLOYMENTS')}
            className={`px-5 py-2.5 rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'DEPLOYMENTS'
                ? 'bg-[#0D0D11] text-white font-black shadow-xs'
                : 'bg-[#F0F0EC] text-zinc-600 hover:bg-[#EAEAE5] hover:text-zinc-900'
            }`}
          >
            Placement & Bookings
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VERIFICATIONS')}
            className={`px-5 py-2.5 rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'VERIFICATIONS'
                ? 'bg-[#0D0D11] text-white font-black shadow-xs'
                : 'bg-[#F0F0EC] text-zinc-600 hover:bg-[#EAEAE5] hover:text-zinc-900'
            }`}
          >
            Recent Clearances ({scopedVerifications.length})
          </button>
        </div>

        {/* Right Search & Filter Pill Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search records..."
              className="pl-9 pr-4 py-1.5 bg-[#F0F0EC] hover:bg-[#EAEAE5] focus:bg-white rounded-full text-xs font-medium text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F0F0EC] rounded-full text-xs font-bold text-zinc-700">
            <Calendar className="w-3.5 h-3.5 text-[#FFB380]" />
            <span>{new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
          </div>

          <button
            type="button"
            onClick={() => setActiveNav('verifications')}
            className="flex items-center gap-1 px-4 py-1.5 bg-[#FFB380] hover:bg-[#F5A066] text-white rounded-full text-xs font-black font-display transition-transform active:scale-95 cursor-pointer"
          >
            <span>Full Queue</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto mt-2">
        {activeTab === 'DEPLOYMENTS' && (
          isLoadingDashboardActivity ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-[#FFB380]" />
              <p className="text-xs font-medium">Loading live placement data...</p>
            </div>
          ) : totalBookings === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
              <Inbox className="w-8 h-8 text-zinc-300" />
              <p className="text-xs font-bold text-zinc-600">
                {searchTerm ? `No placements matching "${searchTerm}"` : 'No active placements found'}
              </p>
              <p className="text-[11px] text-zinc-400 max-w-sm text-center">
                {searchTerm 
                  ? 'Try checking for typos or searching by another worker or employer name.' 
                  : 'Bookings will appear here once registered on the platform.'}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-2 px-4 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-400 font-extrabold font-display uppercase tracking-wider text-[11px]">
                    <th className="pb-3 px-3">Employer</th>
                    <th className="pb-3 px-3">Kasambahay</th>
                    <th className="pb-3 px-3">Monthly Wage</th>
                    <th className="pb-3 px-3">Contract Type</th>
                    <th className="pb-3 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="font-medium text-zinc-700">
                  {paginatedBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-[#F6F5F2] rounded-2xl transition-colors">
                      <td className="py-3 px-3 rounded-l-2xl">
                        <div className="flex items-center gap-2.5">
                          <img src={b.homeownerAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          <span className={`font-bold font-display ${b.homeownerName === 'Unassigned' ? 'text-zinc-400 italic font-normal' : 'text-zinc-900'}`}>
                            {b.homeownerName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <img src={b.workerAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          <span className={`font-semibold ${b.workerName === 'Unassigned' ? 'text-zinc-400 italic font-normal' : 'text-zinc-800'}`}>
                            {b.workerName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-black font-display text-zinc-900">
                        ₱{b.offeredWage.toLocaleString()} / mo
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-[11px] font-bold">
                          {b.contractType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right rounded-r-2xl">
                        {renderBookingStatusBadge(b.bookingStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-100 mt-3 text-xs">
                <div className="text-zinc-500 font-medium">
                  Showing <span className="font-bold text-zinc-900">{startBookingIdx + 1}</span> to{' '}
                  <span className="font-bold text-zinc-900">{endBookingIdx}</span> of{' '}
                  <span className="font-bold text-zinc-900">{totalBookings}</span> placements
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBookingsPage((p) => Math.max(1, p - 1))}
                    disabled={safeBookingsPage <= 1}
                    className="p-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {getPageNumbers(safeBookingsPage, totalBookingPages).map((p, idx) => (
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-zinc-400 font-bold select-none">…</span>
                    ) : (
                      <button
                        key={`page-${p}`}
                        type="button"
                        onClick={() => setBookingsPage(p as number)}
                        className={`min-w-[32px] h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                          safeBookingsPage === p
                            ? 'bg-[#0D0D11] text-white shadow-xs'
                            : 'bg-[#F0F0EC] text-zinc-700 hover:bg-[#EAEAE5] hover:text-zinc-900'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}

                  <button
                    type="button"
                    onClick={() => setBookingsPage((p) => Math.min(totalBookingPages, p + 1))}
                    disabled={safeBookingsPage >= totalBookingPages}
                    className="p-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )
        )}

        {activeTab === 'VERIFICATIONS' && (
          totalVerifications === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
              <Inbox className="w-8 h-8 text-zinc-300" />
              <p className="text-xs font-bold text-zinc-600">
                {searchTerm ? `No clearances matching "${searchTerm}"` : 'No pending clearances found'}
              </p>
              <p className="text-[11px] text-zinc-400 max-w-sm text-center">
                {searchTerm 
                  ? 'Try checking for typos or searching by another name.' 
                  : 'Document submissions will appear here once uploaded.'}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-2 px-4 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-400 font-extrabold font-display uppercase tracking-wider text-[11px]">
                    <th className="pb-3 px-3">Applicant</th>
                    <th className="pb-3 px-3">Document</th>
                    <th className="pb-3 px-3">Barangay</th>
                    <th className="pb-3 px-3">Submitted</th>
                    <th className="pb-3 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="font-medium text-zinc-700">
                  {paginatedVerifications.map((v) => (
                    <tr key={v.id} className="hover:bg-[#F6F5F2] rounded-2xl transition-colors">
                      <td className="py-3 px-3 rounded-l-2xl">
                        <div className="flex items-center gap-2.5">
                          <img src={v.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          <div>
                            <span className="font-bold font-display text-zinc-900 block">{v.name}</span>
                            <span className="text-[10px] text-zinc-400 uppercase font-semibold">{v.role}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-zinc-800">{v.documentType}</td>
                      <td className="py-3 px-3">{v.barangay}</td>
                      <td className="py-3 px-3 text-zinc-400">{v.submittedDate}</td>
                      <td className="py-3 px-3 text-right rounded-r-2xl">
                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                          v.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : v.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}>
                          {v.status === 'PENDING / REVIEW' ? 'In Review' : v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Footer for Verifications */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-100 mt-3 text-xs">
                <div className="text-zinc-500 font-medium">
                  Showing <span className="font-bold text-zinc-900">{startVerifIdx + 1}</span> to{' '}
                  <span className="font-bold text-zinc-900">{endVerifIdx}</span> of{' '}
                  <span className="font-bold text-zinc-900">{totalVerifications}</span> clearances
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVerificationsPage((p) => Math.max(1, p - 1))}
                    disabled={safeVerifPage <= 1}
                    className="p-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {getPageNumbers(safeVerifPage, totalVerifPages).map((p, idx) => (
                    p === '...' ? (
                      <span key={`verif-ellipsis-${idx}`} className="px-2 text-zinc-400 font-bold select-none">…</span>
                    ) : (
                      <button
                        key={`verif-page-${p}`}
                        type="button"
                        onClick={() => setVerificationsPage(p as number)}
                        className={`min-w-[32px] h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                          safeVerifPage === p
                            ? 'bg-[#0D0D11] text-white shadow-xs'
                            : 'bg-[#F0F0EC] text-zinc-700 hover:bg-[#EAEAE5] hover:text-zinc-900'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}

                  <button
                    type="button"
                    onClick={() => setVerificationsPage((p) => Math.min(totalVerifPages, p + 1))}
                    disabled={safeVerifPage >= totalVerifPages}
                    className="p-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};
