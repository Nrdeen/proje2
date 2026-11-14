import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Calendar, MapPin, RotateCcw } from 'lucide-react';
import type { Listing, Region } from '../types/marketplace';
import { formatPriceSar } from '../lib/format';

interface DashboardAnalyticsProps {
  listings: Listing[];
  regions: Region[];
  isAdmin: boolean;
}

type DateRangeDays = 7 | 14 | 30;
type StatusScope = 'all' | 'Published' | 'Pending' | 'Sold';
type RegionChartMode = 'bar' | 'pie';

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface DailyPoint {
  dateKey: string;
  label: string;
  count: number;
  published: number;
  pending: number;
}

interface RegionPoint {
  regionId: string;
  name: string;
  count: number;
  avgPrice: number;
  totalHeads: number;
  sharePercent: number;
}

const REGION_PIE_COLORS = [
  'var(--color-chart-bar-top)',
  'var(--color-chart-bar)',
  'var(--color-chart-area)',
  '#3B7A57',
  '#8C6D3F',
  '#64748B',
  '#0F766E',
  '#B45309',
];

function DailyTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const point: DailyPoint = payload[0].payload;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3.5 py-2.5 shadow-md text-right text-xs space-y-1">
      <p className="font-display font-bold text-[var(--color-ink)]">{point.label}</p>
      <p className="text-[var(--color-green-ink)] font-semibold tabular-nums">
        إجمالي الإعلانات الجديدة: {point.count}
      </p>
      <p className="text-[var(--color-muted)] tabular-nums">
        منشور: {point.published} · بانتظار المراجعة: {point.pending}
      </p>
    </div>
  );
}

function RegionTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const point: RegionPoint = payload[0].payload;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3.5 py-2.5 shadow-md text-right text-xs space-y-1">
      <p className="font-display font-bold text-[var(--color-ink)]">{point.name}</p>
      <p className="text-[var(--color-green-ink)] font-semibold tabular-nums">
        عدد الإعلانات: {point.count} ({point.sharePercent}%)
      </p>
      <p className="text-[var(--color-muted)] tabular-nums">
        إجمالي الرؤوس: {point.totalHeads} رأس
      </p>
      {point.avgPrice > 0 && (
        <p className="text-[var(--color-muted)] tabular-nums">
          متوسط السعر: {formatPriceSar(point.avgPrice)}
        </p>
      )}
    </div>
  );
}

export function DashboardAnalytics({ listings, regions, isAdmin }: DashboardAnalyticsProps) {
  const [rangeDays, setRangeDays] = useState<DateRangeDays>(7);
  const [statusScope, setStatusScope] = useState<StatusScope>('all');
  const [regionChartMode, setRegionChartMode] = useState<RegionChartMode>('bar');

  const scopedListings = useMemo(() => {
    if (statusScope === 'all') return listings;
    return listings.filter((l) => l.status === statusScope);
  }, [listings, statusScope]);

  const dailyData = useMemo<DailyPoint[]>(() => {
    const timestamps = listings
      .map((l) => new Date(l.createdAt).getTime())
      .filter((t) => !Number.isNaN(t));
    const anchorMs = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
    const anchorDate = new Date(anchorMs);
    anchorDate.setHours(0, 0, 0, 0);

    const points: DailyPoint[] = [];
    const byDate = new Map<string, { count: number; published: number; pending: number }>();

    for (const item of scopedListings) {
      const d = new Date(item.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = toLocalDateKey(d);
      const curr = byDate.get(key) || { count: 0, published: 0, pending: 0 };
      curr.count += 1;
      if (item.status === 'Published') curr.published += 1;
      if (item.status === 'Pending') curr.pending += 1;
      byDate.set(key, curr);
    }

    for (let i = rangeDays - 1; i >= 0; i -= 1) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() - i);
      const key = toLocalDateKey(d);
      const stats = byDate.get(key) || { count: 0, published: 0, pending: 0 };
      const formattedLabel = new Intl.DateTimeFormat('ar-SA', {
        month: 'short',
        day: 'numeric',
      }).format(d);

      points.push({
        dateKey: key,
        label: formattedLabel,
        count: stats.count,
        published: stats.published,
        pending: stats.pending,
      });
    }

    return points;
  }, [listings, scopedListings, rangeDays]);

  const regionData = useMemo<RegionPoint[]>(() => {
    const total = scopedListings.length || 1;
    return regions
      .map((reg) => {
        const items = scopedListings.filter((l) => l.regionId === reg.id);
        const count = items.length;
        const avgPrice =
          count > 0
            ? Math.round(items.reduce((acc, l) => acc + l.priceAmount, 0) / count)
            : 0;
        const totalHeads = items.reduce((acc, l) => acc + (l.quantity || 1), 0);
        const sharePercent = scopedListings.length > 0 ? Math.round((count / total) * 100) : 0;
        return {
          regionId: reg.id,
          name: reg.name,
          count,
          avgPrice,
          totalHeads,
          sharePercent,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [regions, scopedListings]);

  const activeRegionData = useMemo(
    () => regionData.filter((r) => r.count > 0),
    [regionData]
  );

  const publishedCount = useMemo(
    () => listings.filter((l) => l.status === 'Published').length,
    [listings]
  );
  const pendingCount = useMemo(
    () => listings.filter((l) => l.status === 'Pending').length,
    [listings]
  );
  const soldCount = useMemo(
    () => listings.filter((l) => l.status === 'Sold').length,
    [listings]
  );
  const activeRegionsCount = activeRegionData.length;
  const topRegion = regionData[0];

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 space-y-6 transition-colors">
      {/* Header & Interactive Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-green-ink)]">
            <BarChart3 size={18} aria-hidden="true" />
            <h2 className="font-display text-xl font-bold text-[var(--color-ink)]">
              لوحة تحكم الأداء
            </h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {isAdmin
              ? 'مؤشرات الإعلانات الجديدة يومياً وتوزيعها الجغرافي عبر مناطق المملكة'
              : 'متابعة حركة الإعلانات المتاحة يومياً وتوزيعها على مناطق المملكة'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Segmented Control */}
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--color-cream)] border border-[var(--color-border)]">
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRangeDays(days)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  rangeDays === days
                    ? 'bg-[var(--color-green)] text-white'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                آخر {days} {days === 7 ? 'أيام' : 'يوماً'}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            aria-label="تصفية الإحصائيات حسب الحالة"
            value={statusScope}
            onChange={(e) => setStatusScope(e.target.value as StatusScope)}
            className="h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-green-ink)]"
          >
            <option value="all">جميع الحالات ({listings.length})</option>
            <option value="Published">المنشورة فقط ({publishedCount})</option>
            <option value="Pending">بانتظار المراجعة ({pendingCount})</option>
            <option value="Sold">المباعة ({soldCount})</option>
          </select>
        </div>
      </div>

      {/* KPI Strip (Clean hairline grid, no nested card sandwiches) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-[var(--color-border)] border border-[var(--color-border)] rounded-xl bg-[var(--color-cream)]/50">
        <div className="p-4">
          <p className="text-xs text-[var(--color-muted)]">إجمالي الإعلانات المرصودة</p>
          <p className="font-display text-2xl font-extrabold text-[var(--color-ink)] tabular-nums mt-1">
            {scopedListings.length}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-[var(--color-muted)]">الإعلانات المنشورة</p>
          <p className="font-display text-2xl font-extrabold text-[var(--color-green-ink)] tabular-nums mt-1">
            {publishedCount}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-[var(--color-muted)]">بانتظار المراجعة</p>
          <p className="font-display text-2xl font-extrabold text-[var(--color-gold)] tabular-nums mt-1">
            {pendingCount}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-[var(--color-muted)]">المناطق النشطة</p>
          <p className="font-display text-2xl font-extrabold text-[var(--color-ink)] tabular-nums mt-1">
            {activeRegionsCount} / {regions.length}
          </p>
          {topRegion && topRegion.count > 0 && (
            <p className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">
              الأعلى: {topRegion.name} ({topRegion.count})
            </p>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      {scopedListings.length === 0 ? (
        <div className="py-12 px-6 text-center rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)]/40">
          <p className="font-display text-base font-bold text-[var(--color-ink)]">
            لا توجد إعلانات مطابقة لنطاق التصفية المحدد
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            جرّب اختيار «جميع الحالات» لعرض توزيع الإعلانات اليومي والجهوي.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusScope('all');
              setRangeDays(7);
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white text-xs font-semibold cursor-pointer"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>إعادة ضبط العرض</span>
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Chart 1: Daily New Listings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-[var(--color-green-ink)]" aria-hidden="true" />
                  <h3 className="font-display text-base font-bold text-[var(--color-ink)]">
                    عدد الإعلانات الجديدة يومياً
                  </h3>
                </div>
                <span className="text-xs text-[var(--color-muted)] tabular-nums">
                  آخر {rangeDays} {rangeDays === 7 ? 'أيام' : 'يوماً'}
                </span>
              </div>

              <div className="h-[290px] w-full min-w-0 pt-2" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={270}>
                  <AreaChart data={dailyData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dailyListingsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-chart-area)" stopOpacity={0.32} />
                        <stop offset="95%" stopColor="var(--color-chart-area)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="dailyPublishedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-chart-grid)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--color-chart-grid)' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<DailyTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                      formatter={(value) => (
                        <span style={{ color: 'var(--color-muted)' }}>{value}</span>
                      )}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="إجمالي الإعلانات"
                      stroke="var(--color-chart-area)"
                      strokeWidth={2.5}
                      fill="url(#dailyListingsGrad)"
                      activeDot={{
                        r: 5,
                        fill: 'var(--color-gold)',
                        stroke: 'var(--color-chart-area)',
                        strokeWidth: 2,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="published"
                      name="المنشورة"
                      stroke="var(--color-gold)"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      fill="url(#dailyPublishedGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Listings Distribution by Region */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-[var(--color-gold)]" aria-hidden="true" />
                  <h3 className="font-display text-base font-bold text-[var(--color-ink)]">
                    توزيع الإعلانات حسب المناطق
                  </h3>
                </div>

                <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[var(--color-cream)] border border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => setRegionChartMode('bar')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      regionChartMode === 'bar'
                        ? 'bg-[var(--color-green)] text-white'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    أعمدة
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegionChartMode('pie')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      regionChartMode === 'pie'
                        ? 'bg-[var(--color-green)] text-white'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    نسب دائرية
                  </button>
                </div>
              </div>

              <div className="h-[290px] w-full min-w-0 pt-2" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={270}>
                  {regionChartMode === 'bar' ? (
                    <BarChart data={regionData} margin={{ top: 10, right: 12, left: -16, bottom: 16 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-chart-grid)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }}
                        axisLine={{ stroke: 'var(--color-chart-grid)' }}
                        tickLine={false}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={52}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<RegionTooltip />} />
                      <Bar dataKey="count" name="عدد الإعلانات" radius={[6, 6, 0, 0]} maxBarSize={38}>
                        {regionData.map((entry, idx) => (
                          <Cell
                            key={entry.regionId}
                            fill={
                              idx === 0 && entry.count > 0
                                ? 'var(--color-chart-bar-top)'
                                : 'var(--color-chart-bar)'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <PieChart>
                      <Pie
                        data={activeRegionData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="46%"
                        innerRadius={56}
                        outerRadius={92}
                        paddingAngle={3}
                      >
                        {activeRegionData.map((entry, idx) => (
                          <Cell
                            key={entry.regionId}
                            fill={REGION_PIE_COLORS[idx % REGION_PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<RegionTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '11px' }}
                        formatter={(value) => (
                          <span style={{ color: 'var(--color-muted)' }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Regional Breakdown Summary Table */}
          {activeRegionData.length > 0 && (
            <div className="pt-4 border-t border-[var(--color-border)]">
              <p className="text-xs font-bold text-[var(--color-ink)] mb-3">
                ملخص الأداء الجغرافي حسب المناطق النشطة
              </p>
              <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--color-cream)] border-b border-[var(--color-border)] text-[var(--color-muted)]">
                      <th className="py-2.5 px-4 font-semibold">المنطقة</th>
                      <th className="py-2.5 px-4 font-semibold">عدد الإعلانات</th>
                      <th className="py-2.5 px-4 font-semibold">النسبة من السوق</th>
                      <th className="py-2.5 px-4 font-semibold">إجمالي الرؤوس</th>
                      <th className="py-2.5 px-4 font-semibold">متوسط السعر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                    {activeRegionData.map((reg) => (
                      <tr key={reg.regionId} className="hover:bg-[var(--color-cream)]/40">
                        <td className="py-2.5 px-4 font-semibold text-[var(--color-ink)]">
                          {reg.name}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-[var(--color-green-ink)] tabular-nums">
                          {reg.count}
                        </td>
                        <td className="py-2.5 px-4 text-[var(--color-muted)] tabular-nums">
                          {reg.sharePercent}%
                        </td>
                        <td className="py-2.5 px-4 text-[var(--color-ink)] tabular-nums">
                          {reg.totalHeads} رأس
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[var(--color-ink)] tabular-nums">
                          {reg.avgPrice > 0 ? formatPriceSar(reg.avgPrice) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
