import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { AlertCircle, ArrowDownRight, ArrowUpRight } from 'lucide-react';

const varianceData = [
  { name: 'Base Salary', variance: 50000, type: 'under' },
  { name: 'Bonuses', variance: -25000, type: 'over' },
  { name: 'Benefits', variance: 15000, type: 'under' },
  { name: 'Software', variance: -115000, type: 'over' },
  { name: 'Travel', variance: 30000, type: 'under' },
  { name: 'Hardware', variance: -10000, type: 'over' },
  { name: 'Training', variance: 5000, type: 'under' },
];

export function Deviation() {
  const topOverages = varianceData.filter(d => d.type === 'over').sort((a, b) => a.variance - b.variance);
  const topSavings = varianceData.filter(d => d.type === 'under').sort((a, b) => b.variance - a.variance);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Deviation Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">Deep dive into budget variances and key drivers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Critical Alerts */}
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <h3 className="text-base font-semibold text-rose-900">Critical Overages</h3>
          </div>
          <div className="space-y-4">
            {topOverages.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white/60 p-3 rounded-lg">
                <span className="font-medium text-gray-900">{item.name}</span>
                <div className="flex items-center text-rose-600 font-semibold">
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  ${Math.abs(item.variance).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notable Savings */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-emerald-900">Notable Savings</h3>
          </div>
          <div className="space-y-4">
            {topSavings.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white/60 p-3 rounded-lg">
                <span className="font-medium text-gray-900">{item.name}</span>
                <div className="flex items-center text-emerald-600 font-semibold">
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                  ${item.variance.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Variance Bar Chart */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-6">Variance by Category (YTD)</h3>
        <p className="text-sm text-gray-500 mb-6">Positive values indicate savings (under budget). Negative values indicate overages (over budget).</p>
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={1}>
            <BarChart
              data={varianceData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickFormatter={(value) => `$${value / 1000}k`}
              />
              <Tooltip 
                formatter={(value: number) => {
                  const formatted = `$${Math.abs(value).toLocaleString()}`;
                  return value < 0 ? `Overage: ${formatted}` : `Savings: ${formatted}`;
                }}
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <ReferenceLine y={0} stroke="#9ca3af" />
              <Bar dataKey="variance" radius={[4, 4, 4, 4]}>
                {varianceData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.variance > 0 ? '#10b981' : '#f43f5e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Action Plan */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Recommended Actions</h3>
        <ul className="space-y-3 text-sm text-gray-600 list-disc pl-5">
          <li><strong>Software Overages:</strong> Cloud infrastructure spend is trending 24% above plan. Recommend immediate review of idle compute instances in AWS.</li>
          <li><strong>Travel Savings:</strong> Reallocate $30k of unused travel budget to cover the software shortfall in Q4.</li>
          <li><strong>Hiring Delay:</strong> Vacancies in the Product team are generating temporary salary savings. Monitor impact on Q4 deliverables.</li>
        </ul>
      </div>
    </div>
  );
}
