import { useMemo } from "react";
import { Search, Download, Filter, TrendingDown, TrendingUp } from "lucide-react";

const pvaData = [
  { id: '1001', category: 'Base Salary', subcategory: 'Engineering', plan: 2500000, actual: 2450000, variance: 50000 },
  { id: '1002', category: 'Base Salary', subcategory: 'Sales', plan: 1800000, actual: 1850000, variance: -50000 },
  { id: '1003', category: 'Benefits', subcategory: 'Health Insurance', plan: 450000, actual: 440000, variance: 10000 },
  { id: '1004', category: 'Benefits', subcategory: '401k Match', plan: 300000, actual: 295000, variance: 5000 },
  { id: '2001', category: 'Software', subcategory: 'Cloud Infrastructure', plan: 500000, actual: 620000, variance: -120000 },
  { id: '2002', category: 'Software', subcategory: 'SaaS Tools', plan: 250000, actual: 245000, variance: 5000 },
  { id: '3001', category: 'Travel', subcategory: 'Sales Flights', plan: 150000, actual: 120000, variance: 30000 },
];

export function PlanVsActual() {
  const totalPlan = useMemo(() => pvaData.reduce((acc, row) => acc + row.plan, 0), []);
  const totalActual = useMemo(() => pvaData.reduce((acc, row) => acc + row.actual, 0), []);
  const totalVariance = useMemo(() => pvaData.reduce((acc, row) => acc + row.variance, 0), []);
  const variancePercent = totalPlan > 0 ? (totalVariance / totalPlan) * 100 : 0;
  const isOverBudget = totalVariance < 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan vs Actual Performance</h1>
          <p className="text-sm text-gray-500 mt-1">Detailed breakdown of planned budget against actual spend (YTD)</p>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4 mr-2 text-gray-500" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Total Plan (YTD)</h4>
          <div className="text-2xl font-bold text-gray-900">${totalPlan.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Total Actual (YTD)</h4>
          <div className="text-2xl font-bold text-gray-900">${totalActual.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Total Variance</h4>
          <div className={`text-2xl font-bold flex items-center ${isOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
            {isOverBudget ? '-' : '+'}${Math.abs(totalVariance).toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Variance %</h4>
          <div className={`text-2xl font-bold flex items-center ${isOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
            {isOverBudget ? <TrendingUp className="w-5 h-5 mr-1" /> : <TrendingDown className="w-5 h-5 mr-1" />}
            {Math.abs(variancePercent).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
          <select className="text-sm border-gray-300 rounded-md shadow-sm bg-white px-3 py-2 border">
            <option>All Departments</option>
            <option>Engineering</option>
            <option>Sales</option>
          </select>
          <select className="text-sm border-gray-300 rounded-md shadow-sm bg-white px-3 py-2 border">
            <option>Q3 FY26</option>
            <option>Q2 FY26</option>
            <option>Q1 FY26</option>
          </select>
          <button className="p-2 border border-gray-300 rounded-md bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4" />
            More Filters
          </button>
        </div>
        <div className="relative w-full max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search categories..." 
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line Item ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subcategory</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Plan (YTD)</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual (YTD)</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% Variance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pvaData.map((row) => {
              const rowVariancePercent = (row.variance / row.plan) * 100;
              const rowIsOverBudget = row.variance < 0;
              
              return (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{row.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.subcategory}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${row.plan.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${row.actual.toLocaleString()}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${rowIsOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {rowIsOverBudget ? '-' : '+'}${Math.abs(row.variance).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${rowIsOverBudget ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {rowVariancePercent > 0 ? '+' : ''}{rowVariancePercent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
            {/* Totals Row */}
            <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
              <td colSpan={3} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">Totals (YTD)</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                ${totalPlan.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                ${totalActual.toLocaleString()}
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${isOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
                {isOverBudget ? '-' : '+'}${Math.abs(totalVariance).toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${isOverBudget ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {variancePercent > 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
