
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  DollarSign, 
  PieChart, 
  Briefcase, 
  Target, 
  Menu, 
  X,
  CheckSquare
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  pendingCount?: number;
}

export const Layout: React.FC<LayoutProps> = ({ children, pendingCount = 0 }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Resumo Geral', href: '/', icon: LayoutDashboard },
    { name: 'Financeiro', href: '/financeiro', icon: DollarSign },
    { name: 'Serviços', href: '/servicos', icon: Briefcase },
    { name: 'Ofertas', href: '/ofertas', icon: Target },
    { name: 'Divisão de Lucros', href: '/lucros', icon: PieChart },
    { name: 'Checagem Diária', href: '/checagem', icon: CheckSquare, badge: pendingCount },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 transform transition-transform duration-200 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950">
          <span className="text-xl font-bold tracking-tight text-emerald-400">Finanças Pro</span>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors group
                  ${isActive(item.href) 
                    ? 'bg-emerald-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <div className="flex items-center">
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                </div>
                {item.badge && item.badge > 0 ? (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {item.badge}
                    </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">
              TM
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">Time Admin</p>
              <p className="text-xs text-slate-400">Visualização de Gestor</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 h-16 flex items-center px-4 justify-between">
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600">
            <Menu size={24} />
          </button>
          <span className="font-semibold text-slate-800">Finanças Pro</span>
          <div className="w-6" /> {/* Spacer */}
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
