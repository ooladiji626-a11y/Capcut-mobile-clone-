import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { ChartConfig, ChartTheme } from '../../types';
import { TrendingUp, ArrowUpRight, BarChart3, Activity } from 'lucide-react';

interface VideoChartOverlayProps {
  chartConfig: ChartConfig;
  currentTime?: number;
  duration?: number;
}

const THEME_COLORS: Record<ChartTheme, { primary: string; secondary: string; glow: string; text: string; bg: string }> = {
  cyan: {
    primary: '#06b6d4',
    secondary: '#3b82f6',
    glow: 'rgba(6, 182, 212, 0.4)',
    text: 'text-cyan-300',
    bg: 'from-cyan-500/20 to-blue-600/10',
  },
  emerald: {
    primary: '#10b981',
    secondary: '#059669',
    glow: 'rgba(16, 185, 129, 0.4)',
    text: 'text-emerald-300',
    bg: 'from-emerald-500/20 to-teal-600/10',
  },
  amber: {
    primary: '#f59e0b',
    secondary: '#ef4444',
    glow: 'rgba(245, 158, 11, 0.4)',
    text: 'text-amber-300',
    bg: 'from-amber-500/20 to-orange-600/10',
  },
  purple: {
    primary: '#a855f7',
    secondary: '#ec4899',
    glow: 'rgba(168, 85, 247, 0.4)',
    text: 'text-purple-300',
    bg: 'from-purple-500/20 to-pink-600/10',
  },
  rose: {
    primary: '#f43f5e',
    secondary: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.4)',
    text: 'text-rose-300',
    bg: 'from-rose-500/20 to-red-600/10',
  },
  monochrome: {
    primary: '#f4f4f5',
    secondary: '#71717a',
    glow: 'rgba(255, 255, 255, 0.25)',
    text: 'text-zinc-100',
    bg: 'from-white/15 to-white/5',
  },
};

const PIE_PALETTE = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export const VideoChartOverlay: React.FC<VideoChartOverlayProps> = ({
  chartConfig,
  currentTime = 0,
  duration = 4,
}) => {
  const theme = THEME_COLORS[chartConfig.theme] || THEME_COLORS.cyan;
  const progressRatio = Math.min(1, Math.max(0.1, duration > 0 ? (currentTime || 0) / duration : 1));

  // Progressively animate data values based on current time
  const animatedData = (chartConfig.data || []).map((item, index) => {
    // Stagger animation across items
    const itemStagger = index / Math.max(1, chartConfig.data.length);
    const itemProgress = Math.min(1, Math.max(0, (progressRatio - itemStagger * 0.3) / 0.7));
    return {
      ...item,
      value: chartConfig.animated !== false ? Math.round(item.value * itemProgress) : item.value,
    };
  });

  const backgroundClass =
    chartConfig.backgroundStyle === 'transparent' || !chartConfig.showBackground
      ? 'bg-transparent'
      : chartConfig.backgroundStyle === 'solid'
      ? 'bg-zinc-950/95 border border-white/15 shadow-2xl backdrop-blur-none'
      : 'bg-black/75 border border-white/15 shadow-2xl backdrop-blur-md';

  return (
    <div
      className={`w-full h-full flex flex-col justify-between p-3.5 rounded-2xl select-none pointer-events-none transition-all duration-150 ${backgroundClass}`}
      style={{
        boxShadow: chartConfig.showBackground ? `0 10px 30px -10px ${theme.glow}` : undefined,
      }}
    >
      {/* Chart Header */}
      <div className="flex items-start justify-between gap-2 shrink-0 mb-1">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full animate-pulse shrink-0"
              style={{ backgroundColor: theme.primary }}
            />
            <h4 className="text-xs font-bold text-white tracking-tight truncate max-w-[170px]">
              {chartConfig.title || 'Infographic Metric'}
            </h4>
          </div>
          {chartConfig.subtitle && (
            <p className="text-[10px] text-zinc-400 font-medium truncate max-w-[180px] ml-3.5">
              {chartConfig.subtitle}
            </p>
          )}
        </div>

        {chartConfig.trendText && (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 bg-white/10 border border-white/10"
            style={{ color: theme.primary }}
          >
            <TrendingUp className="w-2.5 h-2.5" />
            <span>{chartConfig.trendText}</span>
          </div>
        )}
      </div>

      {/* Main Chart Body */}
      <div className="w-full flex-1 min-h-[90px] relative flex items-center justify-center overflow-hidden">
        {/* 1. BAR CHART */}
        {chartConfig.type === 'bar' && (
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={animatedData}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  stroke="#71717a"
                  fontSize={9}
                  tickLine={false}
                  axisLine={{ stroke: '#27272a' }}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={8}
                  tickLine={false}
                  axisLine={false}
                  unit={chartConfig.unit || ''}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0];
                      return (
                        <div className="bg-zinc-900/90 border border-white/10 px-2 py-1 rounded shadow text-[10px] text-white">
                          <span className="font-semibold">{dataPoint.payload.label}: </span>
                          <span style={{ color: theme.primary }}>
                            {chartConfig.prefix || ''}
                            {dataPoint.value}
                            {chartConfig.unit || ''}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  fill={theme.primary}
                  isAnimationActive={false}
                >
                  {animatedData.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={entry.color || (index % 2 === 0 ? theme.primary : theme.secondary)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 2. LINE CHART */}
        {chartConfig.type === 'line' && (
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={animatedData}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  stroke="#71717a"
                  fontSize={9}
                  tickLine={false}
                  axisLine={{ stroke: '#27272a' }}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={8}
                  tickLine={false}
                  axisLine={false}
                  unit={chartConfig.unit || ''}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0];
                      return (
                        <div className="bg-zinc-900/90 border border-white/10 px-2 py-1 rounded shadow text-[10px] text-white">
                          <span className="font-semibold">{dataPoint.payload.label}: </span>
                          <span style={{ color: theme.primary }}>
                            {chartConfig.prefix || ''}
                            {dataPoint.value}
                            {chartConfig.unit || ''}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={theme.primary}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: theme.primary, strokeWidth: 1, stroke: '#09090b' }}
                  activeDot={{ r: 5, fill: '#ffffff' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 3. PIE / DONUT CHART */}
        {chartConfig.type === 'pie' && (
          <div className="w-full h-full flex items-center justify-between gap-2">
            <div className="w-1/2 h-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={animatedData}
                    cx="50%"
                    cy="50%"
                    innerRadius="48%"
                    outerRadius="80%"
                    paddingAngle={3}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {animatedData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_PALETTE[index % PIE_PALETTE.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Pie Legend */}
            <div className="w-1/2 flex flex-col justify-center gap-1 overflow-hidden pr-1">
              {animatedData.slice(0, 4).map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between text-[9px] gap-1">
                  <div className="flex items-center gap-1 truncate">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: PIE_PALETTE[idx % PIE_PALETTE.length] }}
                    />
                    <span className="text-zinc-300 truncate">{entry.label}</span>
                  </div>
                  <span className="font-mono font-bold text-white shrink-0">
                    {entry.value}
                    {chartConfig.unit || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. VIRAL METRIC COUNTER CALLOUT */}
        {chartConfig.type === 'metric' && (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
            {/* Sub-label */}
            <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
              {chartConfig.data[0]?.label || 'Active Metric'}
            </span>

            {/* Giant Metric Display */}
            <div className="flex items-baseline justify-center gap-1 my-1">
              {chartConfig.prefix && (
                <span className="text-sm font-black text-zinc-400">{chartConfig.prefix}</span>
              )}
              <span
                className="text-3xl sm:text-4xl font-black tracking-tight drop-shadow-md"
                style={{
                  color: theme.primary,
                  textShadow: `0 0 20px ${theme.glow}`,
                }}
              >
                {animatedData[0]?.value ?? 100}
              </span>
              {chartConfig.unit && (
                <span className="text-sm font-extrabold text-zinc-300">
                  {chartConfig.unit}
                </span>
              )}
            </div>

            {/* Micro Sparkline / Status Badge */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                {chartConfig.trendText || '+34.2%'}
              </span>
              <span className="text-[9px] text-zinc-500 font-mono">vs previous period</span>
            </div>
          </div>
        )}

        {/* 5. INFOGRAPHIC PROGRESS BAR */}
        {chartConfig.type === 'progress' && (
          <div className="w-full h-full flex flex-col justify-center px-2">
            <div className="flex justify-between items-center text-[10px] font-bold mb-1.5">
              <span className="text-white truncate">
                {chartConfig.data[0]?.label || 'Completion Progress'}
              </span>
              <span className="font-mono" style={{ color: theme.primary }}>
                {chartConfig.prefix || ''}
                {animatedData[0]?.value ?? 75}
                {chartConfig.unit || '%'}
              </span>
            </div>

            {/* Outer Track */}
            <div className="w-full h-3 rounded-full bg-zinc-800/90 overflow-hidden p-0.5 border border-white/10 shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${Math.min(100, Math.max(0, animatedData[0]?.value ?? 0))}%`,
                  background: `linear-gradient(90deg, ${theme.secondary}, ${theme.primary})`,
                  boxShadow: `0 0 12px ${theme.glow}`,
                }}
              />
            </div>

            {/* Milestone Markers */}
            <div className="flex justify-between text-[8px] text-zinc-500 mt-1 font-mono">
              <span>0%</span>
              <span>50%</span>
              <span>100% Target</span>
            </div>
          </div>
        )}
      </div>

      {/* Subtle Bottom Footer */}
      <div className="flex items-center justify-between border-t border-white/5 pt-1.5 mt-0.5 text-[8.5px] text-zinc-400 shrink-0">
        <span className="flex items-center gap-1">
          <Activity className="w-2.5 h-2.5 text-zinc-400" />
          <span>Real-time Analytics</span>
        </span>
        <span className="font-mono text-zinc-400">
          {(currentTime || 0).toFixed(1)}s / {(duration || 0).toFixed(1)}s
        </span>
      </div>
    </div>
  );
};
