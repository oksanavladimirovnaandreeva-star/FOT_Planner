import { NavLink, Outlet, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  CalendarRange, 
  Users, 
  TrendingUp, 
  BarChart3,
  Search,
  Settings,
  Bell
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Planning', href: '/planning', icon: CalendarRange },
  { name: 'Directories', href: '/directories', icon: Users },
  { name: 'Plan vs Actual', href: '/plan-vs-actual', icon: TrendingUp },
  { name: 'Deviation', href: '/deviation', icon: BarChart3 },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <TrendingUp size={20} strokeWidth={2.5} />
            </div>
            BudgetFlow
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">
            Main Menu
          </div>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500',
                    'mr-3 flex-shrink-0 h-5 w-5'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-3 flex-shrink-0 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="User avatar" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-700">Alex Morgan</span>
              <span className="text-xs text-gray-500">VP of Finance</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <div className="flex-1 flex items-center max-w-md">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="text" 
                placeholder="Search across reports, departments, or employees..." 
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
              />
            </div>
          </div>
          <div className="ml-4 flex items-center gap-4">
            <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <Bell className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-auto bg-[#F8FAFC]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
