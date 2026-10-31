import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Armchair,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardCheck,
  Download,
  Receipt,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import FullScreenLoader from "../shared/FullScreenLoader";
import { getSalesReport } from "../../api/report.api";
import { getDashboardMetrics } from "../../api/dashboard.api";
import { formatRupiah } from "../../utils";
import { exportSalesReportToExcel } from "../../utils/excelExport.utils";

// ---------- Constants ----------
const PERIODS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

const ACCENT = "#f97316";
const METHOD_COLORS = ["#f97316", "#60a5fa", "#22c55e", "#a78bfa", "#eab308"];
const STATUS_META = {
  in_progress: { label: "In progress", color: "#eab308" },
  ready: { label: "Ready", color: "#22c55e" },
  completed: { label: "Completed", color: "#60a5fa" },
};

const WIB_OFFSET = 7 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const tooltipStyle = {
  backgroundColor: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 8,
  color: "#f5f5f5",
  fontSize: 12,
};

// ---------- Helpers ----------
const compactRupiah = (v) => {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}rb`;
  return String(v);
};

const wibDate = (value) =>
  new Date(new Date(value).getTime() + WIB_OFFSET).toISOString().slice(0, 10);

// Isi hari tanpa order dengan 0 supaya garis tren tidak melompat
const buildTrend = (report) => {
  if (!report) return [];
  const trend = report.revenueTrend || [];
  const { start, end } = report.range || {};

  if (!start || !end) {
    return trend.map((t) => ({
      date: t._id,
      revenue: t.revenue,
      orders: t.orders,
    }));
  }

  const byDate = new Map(trend.map((t) => [t._id, t]));
  const rows = [];
  let cursor = new Date(`${wibDate(start)}T00:00:00Z`);
  const last = new Date(`${wibDate(end)}T00:00:00Z`);

  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    rows.push({
      date: key,
      revenue: byDate.get(key)?.revenue || 0,
      orders: byDate.get(key)?.orders || 0,
    });
    cursor = new Date(cursor.getTime() + DAY);
  }
  return rows;
};

const formatDay = (value) => format(new Date(`${value}T00:00:00`), "dd MMM");

// ---------- Shared pieces ----------
const Card = ({ className = "", children }) => (
  <div
    className={`bg-[#262626] border border-[#333] rounded-xl p-5 ${className}`}
  >
    {children}
  </div>
);

const ChartCard = ({ title, subtitle, className = "", children }) => (
  <Card className={className}>
    <h3 className="text-[#f5f5f5] font-semibold">{title}</h3>
    {subtitle && <p className="text-sm text-[#ababab] mt-0.5">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </Card>
);

const EmptyState = ({ message }) => (
  <div className="h-48 flex items-center justify-center text-sm text-[#ababab]">
    {message}
  </div>
);

const GrowthBadge = ({ value }) => {
  if (value === null || value === undefined) {
    return <span className="text-xs text-gray-500">No comparison data</span>;
  }
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-lg ${
        up ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"
      }`}
    >
      <Icon size={14} />
      {Math.abs(value)}%
    </span>
  );
};

const KpiCard = ({ title, value, icon: Icon, growth, showGrowth, hint }) => (
  <Card>
    <div className="flex items-center justify-between">
      <p className="text-sm text-[#ababab]">{title}</p>
      <div className="text-emerald-500 bg-emerald-500/10 p-2 rounded-lg">
        <Icon size={18} />
      </div>
    </div>
    <p className="mt-3 text-2xl lg:text-3xl font-bold text-white">{value}</p>
    <div className="mt-3 flex items-center gap-2">
      {showGrowth ? (
        <>
          <GrowthBadge value={growth} />
          {growth !== null && growth !== undefined && (
            <span className="text-xs text-gray-500">vs previous period</span>
          )}
        </>
      ) : (
        <span className="text-xs text-gray-500">{hint}</span>
      )}
    </div>
  </Card>
);

const Donut = ({ data, centerValue, centerLabel, formatValue }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <EmptyState message="No data for this period" />;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-44 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={data.length > 1 ? 3 : 0}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-white">{centerValue}</span>
          <span className="text-xs text-[#ababab]">{centerLabel}</span>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {data.map((d) => (
          <li
            key={d.name}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2 text-[#ababab]">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              {d.name}
            </span>
            <span className="text-[#f5f5f5] font-medium">
              {formatValue(d.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---------- Main ----------
const Overview = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = searchParams.get("range") || "30d";

  const {
    data: response,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["sales-report", range],
    queryFn: () => getSalesReport(range),
    placeholderData: keepPreviousData,
  });

  const { data: tablesResponse } = useQuery({
    queryKey: ["dashboard-tables"],
    queryFn: () => getDashboardMetrics("30d"),
  });

  const report = response?.data?.data;
  const tables = tablesResponse?.data?.data?.items;
  const trendData = useMemo(() => buildTrend(report), [report]);

  if (isLoading) return <FullScreenLoader />;

  if (isError || !report) {
    return (
      <div className="py-6">
        <Card className="text-center">
          <p className="text-red-400 font-medium">
            Could not load the overview
          </p>
          <p className="text-sm text-[#ababab] mt-1">
            Check your connection and try again.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  const {
    summary = {},
    statusBreakdown = {},
    revenueByMethod = [],
    topItems = [],
  } = report;

  const showGrowth = range !== "all";

  const statusData = Object.keys(STATUS_META).map((key) => ({
    name: STATUS_META[key].label,
    value: statusBreakdown[key] || 0,
    color: STATUS_META[key].color,
  }));

  const methodData = revenueByMethod.map((m, i) => ({
    name: String(m._id).charAt(0).toUpperCase() + String(m._id).slice(1),
    value: m.total,
    color: METHOD_COLORS[i % METHOD_COLORS.length],
  }));
  const methodTotal = methodData.reduce((sum, m) => sum + m.value, 0);

  const itemsData = topItems.map((item) => ({
    name: item._id,
    qty: item.qty,
  }));

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#f5f5f5]">Overview</h2>
          <p className="text-sm text-[#ababab]">
            Business performance, {report.period?.label?.toLowerCase()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tables && (
            <span className="inline-flex items-center gap-2 text-sm text-[#ababab] bg-[#262626] border border-[#333] rounded-lg px-3 py-2">
              <Armchair size={16} />
              {tables.activeTables} of {tables.totalTables} tables in use
            </span>
          )}

          <select
            value={range}
            onChange={(e) =>
              setSearchParams({ tab: "overview", range: e.target.value })
            }
            className="bg-[#262626] border border-[#333] text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500"
            aria-label="Select period"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => exportSalesReportToExcel(report)}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Export Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Revenue"
          value={formatRupiah(summary.netRevenue || 0)}
          icon={Wallet}
          growth={summary.revenueGrowth}
          showGrowth={showGrowth}
          hint="Before tax"
        />
        <KpiCard
          title="Orders"
          value={summary.totalOrders || 0}
          icon={ShoppingBag}
          growth={summary.ordersGrowth}
          showGrowth={showGrowth}
          hint="All statuses"
        />
        <KpiCard
          title="Completed orders"
          value={summary.completedOrders || 0}
          icon={ClipboardCheck}
          hint={`${summary.completionRate || 0}% completion rate`}
        />
        <KpiCard
          title="Average order value"
          value={formatRupiah(summary.avgOrderValue || 0)}
          icon={Receipt}
          hint="Per completed order"
        />
      </div>

      {/* Trend + status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          className="xl:col-span-2"
          title="Revenue trend"
          subtitle="Daily revenue from completed orders"
        >
          {trendData.length === 0 ? (
            <EmptyState message="No completed orders in this period" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="revenueFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="#333"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDay}
                    tick={{ fill: "#ababab", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={compactRupiah}
                    tick={{ fill: "#ababab", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={formatDay}
                    formatter={(v) => [formatRupiah(v), "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={ACCENT}
                    strokeWidth={2}
                    fill="url(#revenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Order status" subtitle="Share of all orders">
          <Donut
            data={statusData}
            centerValue={summary.totalOrders || 0}
            centerLabel="orders"
            formatValue={(v) => v}
          />
        </ChartCard>
      </div>

      {/* Products + methods */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          className="xl:col-span-2"
          title="Top products"
          subtitle="Most sold items from completed orders"
        >
          {itemsData.length === 0 ? (
            <EmptyState message="No sales yet in this period" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={itemsData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#333"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: "#ababab", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fill: "#ababab", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#ffffff08" }}
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`${v} pcs`, "Sold"]}
                  />
                  <Bar
                    dataKey="qty"
                    fill={ACCENT}
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Payment methods" subtitle="Revenue by method">
          <Donut
            data={methodData}
            centerValue={compactRupiah(methodTotal)}
            centerLabel="total"
            formatValue={formatRupiah}
          />
        </ChartCard>
      </div>
    </div>
  );
};

export default Overview;
