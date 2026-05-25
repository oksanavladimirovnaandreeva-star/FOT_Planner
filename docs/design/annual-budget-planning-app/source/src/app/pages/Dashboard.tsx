import { useState } from "react";
import { 
  Building2, 
  Users2, 
  Target, 
  TrendingDown, 
  TrendingUp,
  DollarSign,
  Briefcase
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

const summaryData = [
  { name: 'Q1', plan: 1200000, actual: 1150000 },
  { name: 'Q2', plan: 1300000, actual: 1350000 },
  { name: 'Q3', plan: 1250000, actual: 1210000 },
  { name: 'Q4', plan: 1400000, actual: 1480000 },
];

const departmentData = [
  { name: 'Engineering', budget: 2500000, headcount: 145 },
  { name: 'Sales', budget: 1800000, headcount: 85 },
  { name: 'Marketing', budget: 1200000, headcount: 45 },
  { name: 'Product', budget: 900000, headcount: 30 },
  { name: 'HR', budget: 400000, headcount: 12 },
];

export function Dashboard() {
  const [activeFilter, setActiveFilter] = useState('All Departments');

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header & Global Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Annual Overview</h1>
          <p className="text-sm text-gray-500 mt-1">High-level financial and headcount performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white px-3 py-2 border"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option>All Departments</option>
            <option>Engineering</option>
            <option>Sales</option>
            <option>Marketing</option>
            <option>Product</option>
          </select>
          <select className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white px-3 py-2 border">
            <option>FY 2026</option>
            <option>FY 2025</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Total Budget (Plan)"
          value="$5.15M"
          trend="+4.2%"
          trendUp={true}
          icon={<Target className="text-indigo-600 h-5 w-5" />}
        />
        <KpiCard 
          title="Actual Spend YTD"
          value="$3.71M"
          trend="-1.5%"
          trendUp={false}
          subtitle="vs. YTD Plan ($3.75M)"
          icon={<DollarSign className="text-emerald-600 h-5 w-5" />}
        />
        <KpiCard 
          title="Total Headcount"
          value="317"
          trend="+12"
          trendUp={true}
          subtitle="vs. Plan (305)"
          icon={<Users2 className="text-blue-600 h-5 w-5" />}
        />
        <KpiCard 
          title="Open Vacancies"
          value="24"
          trend="-3"
          trendUp={false}
          icon={<Briefcase className="text-amber-600 h-5 w-5" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan vs Actual Over Time */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-6">Budget Trajectory: Plan vs. Actual</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
              <AreaChart data={summaryData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 12 }} 
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip 
                  formatter={(value: number) => `$${(value / 1000).toFixed(1)}k`}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Area type="monotone" dataKey="plan" name="Planned Budget" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorPlan)" />
                <Area type="monotone" dataKey="actual" name="Actual Spend" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-6">Allocation by Department</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
              <BarChart data={departmentData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#4b5563', fontSize: 12 }} 
                />
                <Tooltip 
                  formatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="budget" name="Budget" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, trend, trendUp, subtitle, icon }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <div className={`flex items-center text-sm font-medium ${trendUp ? 'text-rose-600' : 'text-emerald-600'}`}>
          {trendUp ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
          {trend}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-500 mb-1">{title}</h4>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}
