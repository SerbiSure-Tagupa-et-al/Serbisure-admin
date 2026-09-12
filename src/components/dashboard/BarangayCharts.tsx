import React from 'react';

interface BarangayChartsProps {
  employedPercentage: number;
  availablePercentage: number;
}

export const BarangayCharts: React.FC<BarangayChartsProps> = ({
  employedPercentage,
  availablePercentage,
}) => {
  return (
    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.02)] flex flex-col justify-between h-full">
      <h3 className="text-xl font-bold text-slate-800 tracking-tight mb-6">
        Employment Ratio
      </h3>

      {/* Vertical Bars Container */}
      <div className="flex items-end justify-center gap-10 h-64 pt-6 pb-2">
        {/* Employed Bar */}
        <div className="flex flex-col items-center gap-3 w-28 h-full justify-end">
          <div
            className="w-full bg-[#7C5CFC] rounded-t-2xl shadow-sm transition-all duration-700 relative group flex items-center justify-center"
            style={{ height: `${Math.max(employedPercentage, 15)}%` }}
          >
            <span className="text-xs font-black text-white opacity-0 group-hover:opacity-100 transition-opacity">
              {employedPercentage}%
            </span>
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            EMPLOYED
          </span>
        </div>

        {/* Available Bar */}
        <div className="flex flex-col items-center gap-3 w-28 h-full justify-end">
          <div
            className="w-full bg-[#FFB830] rounded-t-2xl shadow-sm transition-all duration-700 relative group flex items-center justify-center"
            style={{ height: `${Math.max(availablePercentage, 15)}%` }}
          >
            <span className="text-xs font-black text-white opacity-0 group-hover:opacity-100 transition-opacity">
              {availablePercentage}%
            </span>
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            AVAILABLE
          </span>
        </div>
      </div>
    </div>
  );
};
