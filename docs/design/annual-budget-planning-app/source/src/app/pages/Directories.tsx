import { useState } from "react";
import { Search, Mail, Phone, ChevronRight, Folder } from "lucide-react";

const directoriesData = [
  {
    department: 'Engineering',
    teams: [
      {
        name: 'Core Platform',
        members: [
          { id: 1, name: 'Sarah Jenkins', role: 'Senior Frontend Engineer', email: 'sarah.j@company.com' },
          { id: 2, name: 'David Lee', role: 'Staff Backend Engineer', email: 'david.l@company.com' }
        ]
      },
      {
        name: 'Mobile App',
        members: [
          { id: 3, name: 'Amanda Smith', role: 'iOS Developer', email: 'amanda.s@company.com' },
        ]
      }
    ]
  },
  {
    department: 'Product',
    teams: [
      {
        name: 'Growth',
        members: [
          { id: 4, name: 'Marcus Chen', role: 'Product Manager', email: 'marcus.c@company.com' },
        ]
      }
    ]
  }
];

export function Directories() {
  const [selectedDept, setSelectedDept] = useState(directoriesData[0]);

  return (
    <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Company Directory</h1>
        <p className="text-sm text-gray-500 mt-1">Browse teams and employees across the organization</p>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search teams..." 
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto p-2 flex-1">
            {directoriesData.map((dept) => (
              <div key={dept.department} className="mb-2">
                <button 
                  onClick={() => setSelectedDept(dept)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${selectedDept.department === dept.department ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <div className="flex items-center">
                    <Folder className={`mr-2 h-4 w-4 ${selectedDept.department === dept.department ? 'text-indigo-600' : 'text-gray-400'}`} />
                    {dept.department}
                  </div>
                  <ChevronRight className={`h-4 w-4 ${selectedDept.department === dept.department ? 'text-indigo-600' : 'text-gray-400 opacity-0'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-y-auto p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{selectedDept.department} Department</h2>
          
          <div className="space-y-8">
            {selectedDept.teams.map((team) => (
              <div key={team.name}>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                  {team.name} Team
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {team.members.map((member) => (
                    <div key={member.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all bg-gray-50/50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900">{member.name}</h4>
                            <p className="text-xs text-gray-500">{member.role}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center text-xs text-gray-500">
                          <Mail className="h-3.5 w-3.5 mr-2 text-gray-400" />
                          {member.email}
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <Phone className="h-3.5 w-3.5 mr-2 text-gray-400" />
                          +1 (555) 000-0000
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
