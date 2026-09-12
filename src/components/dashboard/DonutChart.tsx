import React from 'react';

interface DonutChartProps {
  employedPercentage: number;
  availablePercentage: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  employedPercentage,
  availablePercentage,
}) => {
  // SVG Donut calculation
  const size = 260;
  const strokeWidth = 38;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Offsets
  const employedOffset = circumference - (employedPercentage / 100) * circumference;

  return (
    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.02)] flex flex-col justify-between h-full">
      <h3 className="text-xl font-bold text-slate-800 tracking-tight mb-6">
        Employment Distribution
      </h3>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-auto">
        {/* Donut Graphic */}
        <div className="relative w-[210px] h-[210px] flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
            {/* Background base circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />

            {/* Available arc (Amber) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#FFB830"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={0}
              strokeLinecap="butt"
              className="transition-all duration-700"
            />

            {/* Employed arc (Purple) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#7C5CFC"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={employedOffset}
              strokeLinecap="butt"
              className="transition-all duration-700"
            />
          </svg>
        </div>

        {/* Legend */}
        <div className="space-y-6">
          <div className="space-y-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              EMPLOYED
            </div>
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-md bg-[#7C5CFC] inline-block shadow-xs" />
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {employedPercentage}%
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              AVAILABLE
            </div>
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-md bg-[#FFB830] inline-block shadow-xs" />
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {availablePercentage}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
