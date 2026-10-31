import React, { useState } from 'react';
import {
  X,
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  Activity,
  Check,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Layers,
  Clock,
  Palette,
} from 'lucide-react';
import { ChartConfig, ChartType, ChartTheme, ChartDataPoint } from '../../types';
import { VideoChartOverlay } from '../Charts/VideoChartOverlay';

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveChart: (config: ChartConfig, duration: number) => void;
  initialConfig?: ChartConfig;
  initialDuration?: number;
  isEditing?: boolean;
}

const PRESET_TEMPLATES: { name: string; icon: React.ReactNode; config: ChartConfig; duration: number }[] = [
  {
    name: 'Viewer Retention',
    icon: <TrendingUp className="w-4 h-4 text-cyan-400" />,
    duration: 4.5,
    config: {
      type: 'line',
      title: 'Viewer Retention Curve',
      subtitle: 'Average watch percentage across video',
      theme: 'cyan',
      showBackground: true,
      backgroundStyle: 'glass',
      unit: '%',
      trendText: '▲ 82% Avg',
      animated: true,
      data: [
        { label: '0:00', value: 100 },
        { label: '0:15', value: 92 },
        { label: '0:30', value: 85 },
        { label: '0:45', value: 78 },
        { label: '1:00', value: 74 },
        { label: '1:15', value: 70 },
      ],
    },
  },
  {
    name: 'Viral Growth Spike',
    icon: <BarChart3 className="w-4 h-4 text-emerald-400" />,
    duration: 4,
    config: {
      type: 'bar',
      title: 'Monthly Follower Growth',
      subtitle: 'Organic social reach explosion',
      theme: 'emerald',
      showBackground: true,
      backgroundStyle: 'glass',
      unit: 'k',
      prefix: '+',
      trendText: '+145% Surge',
      animated: true,
      data: [
        { label: 'Jan', value: 14 },
        { label: 'Feb', value: 28 },
        { label: 'Mar', value: 45 },
        { label: 'Apr', value: 92 },
        { label: 'May', value: 135 },
      ],
    },
  },
  {
    name: 'Viral Metric Callout',
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
    duration: 3.5,
    config: {
      type: 'metric',
      title: 'Peak Viral Reach',
      subtitle: 'Impressions in first 24 hours',
      theme: 'amber',
      showBackground: true,
      backgroundStyle: 'glass',
      unit: 'M',
      prefix: '+',
      trendText: '▲ 340% Spike',
      animated: true,
      data: [{ label: 'Total Views', value: 3.4 }],
    },
  },
  {
    name: 'Audience Demographics',
    icon: <PieChartIcon className="w-4 h-4 text-purple-400" />,
    duration: 4.5,
    config: {
      type: 'pie',
      title: 'Audience Age Distribution',
      subtitle: 'Core demographic breakdown',
      theme: 'purple',
      showBackground: true,
      backgroundStyle: 'glass',
      unit: '%',
      animated: true,
      data: [
        { label: '18-24', value: 42 },
        { label: '25-34', value: 33 },
        { label: '35-44', value: 15 },
        { label: '45+', value: 10 },
      ],
    },
  },
  {
    name: 'Goal Completion',
    icon: <Activity className="w-4 h-4 text-rose-400" />,
    duration: 3,
    config: {
      type: 'progress',
      title: 'Quarterly Campaign Target',
      subtitle: 'Milestone reached ahead of schedule',
      theme: 'rose',
      showBackground: true,
      backgroundStyle: 'glass',
      unit: '%',
      animated: true,
      data: [{ label: 'Q3 Milestone Reached', value: 84 }],
    },
  },
];

const THEMES: { id: ChartTheme; name: string; color: string }[] = [
  { id: 'cyan', name: 'Cyan Neon', color: '#06b6d4' },
  { id: 'emerald', name: 'Emerald', color: '#10b981' },
  { id: 'amber', name: 'Amber', color: '#f59e0b' },
  { id: 'purple', name: 'Electric Violet', color: '#a855f7' },
  { id: 'rose', name: 'Coral Rose', color: '#f43f5e' },
  { id: 'monochrome', name: 'Monochrome', color: '#f4f4f5' },
];

export const ChartModal: React.FC<ChartModalProps> = ({
  isOpen,
  onClose,
  onSaveChart,
  initialConfig,
  initialDuration = 4,
  isEditing = false,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'customize' | 'data'>('presets');
  const [chartType, setChartType] = useState<ChartType>(initialConfig?.type || 'bar');
  const [title, setTitle] = useState<string>(initialConfig?.title || 'Video Analytics');
  const [subtitle, setSubtitle] = useState<string>(initialConfig?.subtitle || 'Key performance metric');
  const [theme, setTheme] = useState<ChartTheme>(initialConfig?.theme || 'cyan');
  const [trendText, setTrendText] = useState<string>(initialConfig?.trendText || '+34.2%');
  const [prefix, setPrefix] = useState<string>(initialConfig?.prefix || '');
  const [unit, setUnit] = useState<string>(initialConfig?.unit || '%');
  const [backgroundStyle, setBackgroundStyle] = useState<'glass' | 'solid' | 'transparent'>(
    initialConfig?.backgroundStyle || 'glass'
  );
  const [showBackground, setShowBackground] = useState<boolean>(
    initialConfig ? initialConfig.showBackground : true
  );
  const [duration, setDuration] = useState<number>(initialDuration);

  const [dataPoints, setDataPoints] = useState<ChartDataPoint[]>(
    initialConfig?.data || [
      { label: 'Segment 1', value: 45 },
      { label: 'Segment 2', value: 80 },
      { label: 'Segment 3', value: 65 },
      { label: 'Segment 4', value: 95 },
    ]
  );

  if (!isOpen) return null;

  const currentConfig: ChartConfig = {
    type: chartType,
    title,
    subtitle,
    theme,
    trendText,
    prefix,
    unit,
    showBackground,
    backgroundStyle,
    animated: true,
    data: dataPoints,
  };

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setChartType(preset.config.type);
    setTitle(preset.config.title);
    setSubtitle(preset.config.subtitle || '');
    setTheme(preset.config.theme);
    setTrendText(preset.config.trendText || '');
    setPrefix(preset.config.prefix || '');
    setUnit(preset.config.unit || '');
    setBackgroundStyle(preset.config.backgroundStyle || 'glass');
    setShowBackground(preset.config.showBackground);
    setDataPoints(preset.config.data);
    setDuration(preset.duration);
    setActiveTab('customize');
  };

  const handleAddDataPoint = () => {
    setDataPoints([
      ...dataPoints,
      { label: `Item ${dataPoints.length + 1}`, value: Math.floor(Math.random() * 50) + 20 },
    ]);
  };

  const handleUpdateDataPoint = (index: number, field: 'label' | 'value', val: any) => {
    const updated = [...dataPoints];
    updated[index] = {
      ...updated[index],
      [field]: field === 'value' ? Number(val) || 0 : val,
    };
    setDataPoints(updated);
  };

  const handleRemoveDataPoint = (index: number) => {
    if (dataPoints.length <= 1) return;
    setDataPoints(dataPoints.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSaveChart(currentConfig, duration);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto select-none animate-in fade-in duration-150"
      onClick={onClose}
      id="chart-modal-backdrop"
    >
      <div
        className="relative w-full max-w-3xl bg-[#14141a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        id="chart-modal-container"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#181822]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>{isEditing ? 'Edit Infographic Chart' : 'Infographic Chart Studio'}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 font-bold">
                  Overlay
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Overlay animated motion charts, metrics, and trends onto your video timeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            id="chart-modal-close-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Split into Controls & Live Preview */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Configuration Controls */}
          <div className="w-full md:w-7/12 flex flex-col border-r border-white/10 overflow-y-auto p-4 space-y-4">
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 bg-[#1a1a24] p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setActiveTab('presets')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'presets'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Presets</span>
              </button>
              <button
                onClick={() => setActiveTab('customize')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'customize'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Style</span>
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'data'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Data ({dataPoints.length})</span>
              </button>
            </div>

            {/* TAB 1: PRESETS */}
            {activeTab === 'presets' && (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  One-Click Templates
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {PRESET_TEMPLATES.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleApplyPreset(preset)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1d1d28] hover:bg-[#252535] border border-white/5 hover:border-white/15 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                          {preset.icon}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {preset.config.subtitle || preset.config.type} · {preset.duration}s
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-400/10 px-2 py-1 rounded-md">
                        Use Template
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: STYLE & CUSTOMIZATION */}
            {activeTab === 'customize' && (
              <div className="space-y-4 text-xs">
                {/* Chart Type Selector */}
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                    Chart Type
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(
                      [
                        { type: 'bar', label: 'Bar', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                        { type: 'line', label: 'Line', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                        { type: 'pie', label: 'Pie', icon: <PieChartIcon className="w-3.5 h-3.5" /> },
                        { type: 'metric', label: 'Metric', icon: <Sparkles className="w-3.5 h-3.5" /> },
                        { type: 'progress', label: 'Progress', icon: <Activity className="w-3.5 h-3.5" /> },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.type}
                        onClick={() => setChartType(t.type)}
                        className={`py-2 px-1 rounded-lg font-medium flex flex-col items-center gap-1 transition-all ${
                          chartType === t.type
                            ? 'bg-cyan-500 text-black font-bold ring-2 ring-cyan-400'
                            : 'bg-[#1c1c28] text-zinc-300 hover:text-white hover:bg-[#252535]'
                        }`}
                      >
                        {t.icon}
                        <span className="text-[10px]">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Monthly Revenue"
                      className="w-full h-8 px-2.5 rounded-lg bg-[#1c1c28] border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="e.g. 2026 organic performance"
                      className="w-full h-8 px-2.5 rounded-lg bg-[#1c1c28] border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Color Theme Selector */}
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                    Color Theme
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {THEMES.map((th) => (
                      <button
                        key={th.id}
                        onClick={() => setTheme(th.id)}
                        className={`h-8 rounded-lg flex items-center justify-center transition-all border ${
                          theme === th.id
                            ? 'ring-2 ring-white border-white scale-105'
                            : 'border-white/10 opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: th.color }}
                        title={th.name}
                      >
                        {theme === th.id && (
                          <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Metric Suffix, Prefix & Trend */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Prefix</label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="e.g. $ or +"
                      className="w-full h-8 px-2 rounded-lg bg-[#1c1c28] border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Unit/Suffix</label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="e.g. % or k"
                      className="w-full h-8 px-2 rounded-lg bg-[#1c1c28] border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Trend Badge</label>
                    <input
                      type="text"
                      value={trendText}
                      onChange={(e) => setTrendText(e.target.value)}
                      placeholder="e.g. ▲ +42%"
                      className="w-full h-8 px-2 rounded-lg bg-[#1c1c28] border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Background Card Style & Duration */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                      Background Card
                    </label>
                    <div className="flex gap-1">
                      {(['glass', 'solid', 'transparent'] as const).map((bg) => (
                        <button
                          key={bg}
                          onClick={() => {
                            setBackgroundStyle(bg);
                            setShowBackground(bg !== 'transparent');
                          }}
                          className={`flex-1 py-1 text-[10px] font-semibold rounded capitalize transition-all ${
                            backgroundStyle === bg
                              ? 'bg-white text-zinc-950 shadow'
                              : 'bg-[#1c1c28] text-zinc-400 hover:text-white'
                          }`}
                        >
                          {bg}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                      Duration: {duration}s
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      <input
                        type="range"
                        min="2"
                        max="12"
                        step="0.5"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full accent-cyan-400 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: DATA EDITING TABLE */}
            {activeTab === 'data' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Data Values
                  </span>
                  <button
                    onClick={handleAddDataPoint}
                    className="h-7 px-2.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Row</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {dataPoints.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#1a1a26] border border-white/5"
                    >
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => handleUpdateDataPoint(index, 'label', e.target.value)}
                        placeholder="Label"
                        className="flex-1 h-7 px-2 rounded bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                      <input
                        type="number"
                        value={item.value}
                        onChange={(e) => handleUpdateDataPoint(index, 'value', e.target.value)}
                        placeholder="Value"
                        className="w-20 h-7 px-2 rounded bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        onClick={() => handleRemoveDataPoint(index)}
                        disabled={dataPoints.length <= 1}
                        className="w-7 h-7 rounded text-zinc-500 hover:text-rose-400 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Interactive Preview */}
          <div className="w-full md:w-5/12 bg-[#0c0c12] p-5 flex flex-col justify-between items-center select-none">
            <div className="w-full flex items-center justify-between text-[11px] font-semibold text-zinc-400 mb-2">
              <span>Canvas Overlay Preview</span>
              <span className="font-mono text-cyan-400">Duration: {duration}s</span>
            </div>

            {/* Centered Mock Video Canvas Stage */}
            <div className="w-full aspect-[9/16] max-h-[300px] sm:max-h-[340px] rounded-xl bg-gradient-to-b from-zinc-900 to-black border border-white/10 overflow-hidden relative flex items-center justify-center p-3 shadow-inner">
              {/* Background Video Frame Mock */}
              <img
                src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80"
                alt="Video Background"
                className="absolute inset-0 w-full h-full object-cover opacity-35 filter brightness-50"
              />

              {/* The Live VideoChartOverlay */}
              <div className="w-full max-w-[240px] h-[190px] relative z-10">
                <VideoChartOverlay
                  chartConfig={currentConfig}
                  currentTime={duration * 0.8}
                  duration={duration}
                />
              </div>
            </div>

            <p className="text-[10px] text-zinc-400 text-center mt-3">
              Once added, you can scale, reposition, and drag handles directly on the video canvas.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-[#161622]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            id="chart-modal-save-btn"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>{isEditing ? 'Save Chart Changes' : 'Insert Chart Overlay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
