import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Package, DollarSign, LogOut, Menu, LayoutDashboard, Receipt, Megaphone, Users, LineChart, FileText } from 'lucide-react';
import { auth } from '../firebase';
import { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Layout() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/sales', icon: DollarSign, label: 'Sales' },
    { to: '/expenses', icon: Receipt, label: 'Expenses' },
    { to: '/ad-spend', icon: Megaphone, label: 'Ad Spend' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/customers', icon: Users, label: 'Customers' },
    { to: '/pnl', icon: LineChart, label: 'P&L Statement' },
    { to: '/invoice', icon: FileText, label: 'Invoice' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-300 flex flex-col md:flex-row font-sans selection:bg-rose-500/30">
      {/* Mobile Header */}
      <div className="md:hidden bg-black/20 border-b border-white/10 text-white flex items-center justify-between p-4">
        <span className="font-serif italic text-xl tracking-tighter">Motovia <span className="text-rose-600">Nepal</span></span>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "bg-[#0a0a0a] border-r border-white/10 w-full md:w-64 md:flex flex-col flex-shrink-0 transition-all duration-300",
        mobileMenuOpen ? "flex" : "hidden"
      )}>
        <div className="p-8 hidden md:block">
          <div className="text-white font-serif italic text-2xl tracking-tighter">Motovia <span className="text-rose-600">Nepal</span></div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">Premium Auto Care Admin</div>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "px-4 py-3 rounded-lg flex items-center gap-3 transition-colors",
                isActive 
                  ? "bg-white/5 border border-white/10 text-white" 
                  : "hover:bg-white/5 text-slate-300"
              )}
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isActive ? "bg-rose-600" : "border border-white/30"
                  )}></div>
                  <span className="text-sm font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-white/10">
          <div className="bg-rose-950/20 border border-rose-900/50 p-4 rounded-xl mb-4">
            <div className="text-[10px] uppercase text-rose-500 font-bold mb-1">System Status</div>
            <div className="text-xs text-white/70">Firebase Connected</div>
            <div className="w-full bg-white/10 h-1 mt-2 rounded-full overflow-hidden">
              <div className="bg-rose-600 h-full w-3/4"></div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/10"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
