'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  Settings,
  ShieldAlert,
  LogOut,
  Stethoscope,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';

const navigation = [
  { name: 'Live Queue & Stats', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Patients Directory', href: '/patients', icon: Users },
  { name: 'All Appointments', href: '/appointments', icon: CalendarCheck },
  { name: 'Payments & Revenue', href: '/payments', icon: CreditCard },
  { name: 'Clinic Settings', href: '/settings', icon: Settings },
  { name: 'Security Audit Logs', href: '/audit-logs', icon: ShieldAlert },
];

export function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.logout();
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white">
      {/* Clinic Header */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 leading-tight">S K Poddar neurological clinic</h1>
          <p className="text-xs text-emerald-600 font-semibold">FCFS Token System</p>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1.5 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <a
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              {item.name}
            </a>
          );
        })}

        {/* Mock Payment Checkout Sandbox */}
        <div className="pt-4">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Testing Sandbox</p>
          <a
            href="/mock-payment"
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex items-center justify-between rounded-lg px-3 py-2 text-sm text-amber-700 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 transition-all"
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              HDFC Simulator
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-amber-500" />
          </a>
        </div>
      </nav>

      {/* User profile & Logout */}
      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
            {user?.fullName?.charAt(0) || 'D'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">{user?.fullName || 'Dr. S K Poddar'}</p>
            <p className="truncate text-[11px] text-slate-400">{user?.email || 'doctor@skpoddarclinic.com'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-rose-600 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
