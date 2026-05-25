import { useState, useMemo, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Search, Filter, MoreHorizontal, UserPlus, FileDown, Calculator, Copy, AlertCircle, CheckCircle2 } from "lucide-react";

// Mocks & Constants
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const salaryBands: Record<string, Record<string, number>> = {
  'Frontend': { 'Junior': 80000, 'Middle': 120000, 'Senior': 160000 },
  'Backend': { 'Junior': 85000, 'Middle': 130000, 'Senior': 170000 },
  'Product': { 'Junior': 90000, 'Middle': 140000, 'Senior': 180000, 'Director': 220000 },
  'Design': { 'Junior': 75000, 'Middle': 110000, 'Senior': 150000 },
  'Marketing': { 'Middle': 100000, 'Director': 180000 },
};

const initialPlanningData = [
  { id: '1', role: 'Senior Frontend Engineer', type: 'Employee', name: 'Sarah Jenkins', dept: 'Engineering', monthlySpec: Array(12).fill('Frontend'), monthlyLevel: Array(12).fill('Senior'), limitStatus: 'In Limit', status: 'Active', monthlyBase: Array(12).fill(13000), monthlyVar: Array(12).fill(1000) },
  { id: '2', role: 'Backend Developer', type: 'Vacancy', name: '-', dept: 'Engineering', monthlySpec: Array(12).fill('Backend'), monthlyLevel: Array(12).fill('Middle'), limitStatus: 'In Limit', status: 'Open', monthlyBase: Array(12).fill(10833), monthlyVar: Array(12).fill(0) },
  { id: '3', role: 'Product Manager', type: 'Employee', name: 'Marcus Chen', dept: 'Product', monthlySpec: Array(12).fill('Product'), monthlyLevel: Array(12).fill('Senior'), limitStatus: 'Over Limit', status: 'Active', monthlyBase: Array(12).fill(15500), monthlyVar: Array(12).fill(2000) },
  { id: '4', role: 'UX Designer', type: 'Vacancy', name: '-', dept: 'Product', monthlySpec: Array(12).fill('Design'), monthlyLevel: Array(12).fill('Middle'), limitStatus: 'In Limit', status: 'Offer Extended', monthlyBase: Array(12).fill(9166), monthlyVar: Array(12).fill(0) },
  { id: '5', role: 'Marketing Director', type: 'Employee', name: 'Elena Rodriguez', dept: 'Marketing', monthlySpec: Array(12).fill('Marketing'), monthlyLevel: Array(12).fill('Director'), limitStatus: 'In Limit', status: 'Active', monthlyBase: Array(12).fill(15000), monthlyVar: Array(12).fill(3000) },
];

function getMidpoint(spec: string, level: string) {
  return salaryBands[spec]?.[level] || 0;
}

function getMonthlyCR(base: number, spec: string, level: string) {
  const mid = getMidpoint(spec, level);
  if (!mid) return 0;
  return (base / (mid / 12)) * 100;
}

export function Planning() {
  const [records, setRecords] = useState(initialPlanningData);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Mass Indexation State
  const [idxPercent, setIdxPercent] = useState(5);
  const [idxMonth, setIdxMonth] = useState(6); // July

  const openDrawer = (item: any) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  const saveRecord = (updatedRecord: any) => {
    if (!updatedRecord.id) {
      updatedRecord.id = Math.random().toString(36).substr(2, 9);
      setRecords([...records, updatedRecord]);
    } else {
      setRecords(records.map(r => r.id === updatedRecord.id ? updatedRecord : r));
    }
    setIsDrawerOpen(false);
  };

  const applyIndexation = () => {
    setRecords(prev => prev.map(record => {
      const newBase = [...record.monthlyBase];
      for(let i = idxMonth; i < 12; i++) {
        newBase[i] = newBase[i] * (1 + (idxPercent / 100));
      }
      return { ...record, monthlyBase: newBase };
    }));
  };

  // Summary Metrics
  const summary = useMemo(() => {
    let budget = 0;
    let varComp = 0;
    let crSum = 0;
    let crCount = 0;

    records.forEach(r => {
      const annualBase = r.monthlyBase.reduce((a: number,b: number)=>a+b,0);
      const annualVar = r.monthlyVar.reduce((a: number,b: number)=>a+b,0);
      budget += (annualBase + annualVar);
      varComp += annualVar;

      for (let i = 0; i < 12; i++) {
        const mid = getMidpoint(r.monthlySpec[i], r.monthlyLevel[i]);
        if (mid) {
          crSum += (r.monthlyBase[i] / (mid / 12)) * 100;
          crCount++;
        }
      }
    });

    return {
      budget,
      varComp,
      headcount: records.filter(r => r.type === 'Employee').length,
      vacancies: records.filter(r => r.type === 'Vacancy').length,
      avgCR: crCount ? (crSum / crCount) : 0,
    };
  }, [records]);

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planning & Headcount</h1>
          <p className="text-sm text-gray-500 mt-1">Manage budget, salaries, and plan vacancies for FY 2026</p>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            <FileDown className="h-4 w-4 mr-2 text-gray-500" />
            Export
          </button>
          <button 
            onClick={() => openDrawer({ 
              type: 'Vacancy', role: '', name: '-', dept: '', limitStatus: 'In Limit', status: 'Draft',
              monthlySpec: Array(12).fill('Frontend'), monthlyLevel: Array(12).fill('Middle'),
              monthlyBase: Array(12).fill(0), monthlyVar: Array(12).fill(0) 
            })}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Vacancy
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Total Planned Budget</h4>
          <div className="text-2xl font-bold text-gray-900">${summary.budget.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
          <div className="text-xs text-gray-400 mt-1">Includes base & variable</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Headcount & Vacancies</h4>
          <div className="text-2xl font-bold text-gray-900">{summary.headcount} + {summary.vacancies}</div>
          <div className="text-xs text-gray-400 mt-1">Active + Open</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Average Compa-Ratio</h4>
          <div className="text-2xl font-bold text-gray-900">{summary.avgCR.toFixed(1)}%</div>
          <div className="text-xs text-gray-400 mt-1">Across all planned positions</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Total Variable Comp</h4>
          <div className="text-2xl font-bold text-gray-900">${summary.varComp.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
          <div className="text-xs text-gray-400 mt-1">Annual bonus pool</div>
        </div>
      </div>

      {/* Toolbar & Mass Indexation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input 
              type="text" 
              placeholder="Search roles or names..." 
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
            <select className="text-sm border-gray-300 rounded-md shadow-sm bg-white px-3 py-2 border">
              <option>All Departments</option>
              <option>Engineering</option>
              <option>Product</option>
            </select>
            <button className="p-2 border border-gray-300 rounded-md bg-white text-gray-600 hover:bg-gray-50">
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center text-sm font-semibold text-indigo-900">
            <Calculator className="h-4 w-4 mr-2" />
            Mass Salary Indexation
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Increase %</label>
              <input type="number" value={idxPercent} onChange={e=>setIdxPercent(Number(e.target.value))} className="w-full border-gray-300 rounded-md text-sm px-3 py-1.5 border bg-white focus:ring-indigo-500" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">From Month</label>
              <select value={idxMonth} onChange={e=>setIdxMonth(Number(e.target.value))} className="w-full border-gray-300 rounded-md text-sm px-3 py-1.5 border bg-white focus:ring-indigo-500">
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            <button onClick={applyIndexation} className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors shadow-sm">
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spec & Level</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Annual Total</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg CR</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Limit Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.map((person) => {
              const annualBase = person.monthlyBase.reduce((a: number,b: number)=>a+b,0);
              const annualVar = person.monthlyVar.reduce((a: number,b: number)=>a+b,0);
              const totalComp = annualBase + annualVar;

              let personCrSum = 0;
              let personCrCount = 0;
              for (let i = 0; i < 12; i++) {
                const mid = getMidpoint(person.monthlySpec[i], person.monthlyLevel[i]);
                if (mid) {
                  personCrSum += (person.monthlyBase[i] / (mid / 12)) * 100;
                  personCrCount++;
                }
              }
              const avgCR = personCrCount ? personCrSum / personCrCount : 0;
              const isOverLimit = person.limitStatus === 'Over Limit';

              return (
                <tr 
                  key={person.id} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => openDrawer(person)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{person.role}</div>
                        <div className="text-xs text-gray-500">{person.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{person.name}</div>
                    <div className="text-xs text-gray-500">{person.dept}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {person.monthlySpec[0]} 
                      {person.monthlySpec[0] !== person.monthlySpec[11] && <span className="text-indigo-600 ml-1 text-xs" title="Changes during the year">(&rarr; {person.monthlySpec[11]})</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {person.monthlyLevel[0]}
                      {person.monthlyLevel[0] !== person.monthlyLevel[11] && <span className="text-indigo-600 ml-1" title="Changes during the year">(&rarr; {person.monthlyLevel[11]})</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    ${totalComp.toLocaleString(undefined, {maximumFractionDigits:0})}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-medium ${avgCR > 110 ? 'text-rose-600' : avgCR < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {avgCR ? avgCR.toFixed(1) + '%' : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center text-xs font-medium ${isOverLimit ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {isOverLimit ? <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                      {person.limitStatus}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${person.type === 'Vacancy' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {person.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PlanningDrawer 
        open={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        record={selectedItem}
        onSave={saveRecord}
      />
    </div>
  );
}

// Drawer Component for isolated state management
function PlanningDrawer({ open, onClose, record, onSave }: any) {
  const [local, setLocal] = useState<any>(null);

  useEffect(() => {
    if (open && record) {
      setLocal(JSON.parse(JSON.stringify(record)));
    }
  }, [open, record]);

  if (!local) return null;

  const handleBaseChange = (idx: number, val: string) => {
    const num = Number(val) || 0;
    setLocal((prev: any) => {
      const nb = [...prev.monthlyBase]; nb[idx] = num;
      return { ...prev, monthlyBase: nb };
    });
  };

  const handleVarChange = (idx: number, val: string) => {
    const num = Number(val) || 0;
    setLocal((prev: any) => {
      const nv = [...prev.monthlyVar]; nv[idx] = num;
      return { ...prev, monthlyVar: nv };
    });
  };

  const handleSpecChange = (idx: number, val: string) => {
    setLocal((prev: any) => {
      const ns = [...prev.monthlySpec]; ns[idx] = val;
      return { ...prev, monthlySpec: ns };
    });
  };

  const handleLevelChange = (idx: number, val: string) => {
    setLocal((prev: any) => {
      const nl = [...prev.monthlyLevel]; nl[idx] = val;
      return { ...prev, monthlyLevel: nl };
    });
  };

  const applyNext = (idx: number) => {
    const baseVal = local.monthlyBase[idx];
    const varVal = local.monthlyVar[idx];
    const specVal = local.monthlySpec[idx];
    const lvlVal = local.monthlyLevel[idx];
    setLocal((prev: any) => {
      const nb = [...prev.monthlyBase];
      const nv = [...prev.monthlyVar];
      const ns = [...prev.monthlySpec];
      const nl = [...prev.monthlyLevel];
      for (let i = idx + 1; i < 12; i++) {
        nb[i] = baseVal;
        nv[i] = varVal;
        ns[i] = specVal;
        nl[i] = lvlVal;
      }
      return { ...prev, monthlyBase: nb, monthlyVar: nv, monthlySpec: ns, monthlyLevel: nl };
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(val) => !val && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-5xl bg-white shadow-xl flex flex-col border-l border-gray-200 transition-transform duration-300">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {local.type === 'Vacancy' && !local.id ? 'New Vacancy Plan' : 'Edit Planning Details'}
            </Dialog.Title>
            <Dialog.Description className="sr-only">Detailed configuration for the role's monthly compensation and levels</Dialog.Description>
            <Dialog.Close className="text-gray-400 hover:text-gray-500 rounded-full p-1 hover:bg-gray-100 transition-colors">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* General Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Title</label>
                <input type="text" value={local.role} onChange={e => setLocal({...local, role: e.target.value})} className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name</label>
                <input type="text" value={local.name} disabled={local.type === 'Vacancy'} onChange={e => setLocal({...local, name: e.target.value})} className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select value={local.dept} onChange={e => setLocal({...local, dept: e.target.value})} className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border bg-white focus:ring-indigo-500 sm:text-sm">
                  <option value="Engineering">Engineering</option>
                  <option value="Product">Product</option>
                  <option value="Marketing">Marketing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={local.status} onChange={e => setLocal({...local, status: e.target.value})} className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border bg-white focus:ring-indigo-500 sm:text-sm">
                  <option value="Active">Active</option>
                  <option value="Open">Open</option>
                  <option value="Offer Extended">Offer Extended</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>

            {/* Classification & Banding */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Classification & Limits</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Budget Limit Status</label>
                  <select value={local.limitStatus} onChange={e => setLocal({...local, limitStatus: e.target.value})} className="w-full sm:w-1/3 border-gray-300 rounded-md shadow-sm px-3 py-2 border bg-white focus:ring-indigo-500 sm:text-sm">
                    <option value="In Limit">In Limit</option>
                    <option value="Over Limit">Over Limit</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Monthly Compensation Grid */}
            <div>
              <div className="flex justify-between items-end mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Monthly Compensation Schedule</h4>
                <p className="text-xs text-gray-500">CR updates automatically based on Base Salary</p>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 font-medium text-gray-500 w-16">Month</th>
                      <th className="px-3 py-2 font-medium text-gray-500">Spec</th>
                      <th className="px-3 py-2 font-medium text-gray-500">Level</th>
                      <th className="px-3 py-2 font-medium text-gray-500">Base Salary</th>
                      <th className="px-3 py-2 font-medium text-gray-500">Variable</th>
                      <th className="px-3 py-2 font-medium text-gray-500">Total</th>
                      <th className="px-3 py-2 font-medium text-gray-500 w-16">CR %</th>
                      <th className="px-3 py-2 font-medium text-gray-500 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {MONTHS.map((m, i) => {
                      const base = local.monthlyBase[i];
                      const v = local.monthlyVar[i];
                      const spec = local.monthlySpec[i];
                      const lvl = local.monthlyLevel[i];
                      const total = base + v;
                      const cr = getMonthlyCR(base, spec, lvl);
                      
                      return (
                        <tr key={m} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-900 font-medium">{m}</td>
                          <td className="px-3 py-2">
                            <select value={spec} onChange={e => handleSpecChange(i, e.target.value)} className="w-full min-w-[100px] border-gray-300 rounded-md px-2 py-1 border bg-white focus:ring-indigo-500 text-xs">
                              {Object.keys(salaryBands).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select value={lvl} onChange={e => handleLevelChange(i, e.target.value)} className="w-full min-w-[90px] border-gray-300 rounded-md px-2 py-1 border bg-white focus:ring-indigo-500 text-xs">
                              <option value="Junior">Junior</option>
                              <option value="Middle">Middle</option>
                              <option value="Senior">Senior</option>
                              <option value="Director">Director</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <div className="relative rounded-md shadow-sm max-w-[120px]">
                              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                <span className="text-gray-500 text-xs">$</span>
                              </div>
                              <input type="number" value={base} onChange={e => handleBaseChange(i, e.target.value)} className="w-full pl-5 pr-2 py-1 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-xs" />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="relative rounded-md shadow-sm max-w-[120px]">
                              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                <span className="text-gray-500 text-xs">$</span>
                              </div>
                              <input type="number" value={v} onChange={e => handleVarChange(i, e.target.value)} className="w-full pl-5 pr-2 py-1 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-xs" />
                            </div>
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900 text-xs">
                            ${total.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <span className={`font-medium ${cr > 110 ? 'text-rose-600' : cr < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {cr ? cr.toFixed(1) + '%' : '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => applyNext(i)} title="Apply to remaining months" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
                              <Copy className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-900 text-xs">
                    <tr>
                      <td className="px-3 py-3" colSpan={3}>Totals</td>
                      <td className="px-3 py-3">${local.monthlyBase.reduce((a:number,b:number)=>a+b,0).toLocaleString()}</td>
                      <td className="px-3 py-3">${local.monthlyVar.reduce((a:number,b:number)=>a+b,0).toLocaleString()}</td>
                      <td className="px-3 py-3">${(local.monthlyBase.reduce((a:number,b:number)=>a+b,0) + local.monthlyVar.reduce((a:number,b:number)=>a+b,0)).toLocaleString()}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={() => onSave(local)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700">
              Save Plan
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}