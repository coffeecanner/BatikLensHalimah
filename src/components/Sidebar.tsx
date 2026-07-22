import { 
  LayoutDashboard, 
  ShieldCheck, 
  Users, 
  Image as ImageIcon, 
  Cpu, 
  Compass, 
  BarChart3, 
  LogOut,
  Sparkles,
  Settings as SettingsIcon,
  X,
  Grid,
  Eye,
  CheckCircle,
  ContactRound
} from "lucide-react";
import { User } from "../types";

interface SidebarProps {
  currentMenu: string;
  setCurrentMenu: (menu: string) => void;
  user: User | null;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ currentMenu, setCurrentMenu, user, onLogout, isOpen = false, onClose }: SidebarProps) {
  // Strict sidebar structure to satisfy academic validation requirements
  const allMenuItems = [
    { name: "Dashboard", id: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "STAFF"] },
    { name: "Admin", id: "Admin", icon: ShieldCheck, roles: ["ADMIN"] },
    { name: "Pegawai", id: "Pegawai", icon: Users, roles: ["ADMIN"] },
    { name: "Customer", id: "Customer", icon: ContactRound, roles: ["ADMIN", "STAFF"] },
    { name: "Data Gambar Motif Batik", id: "Data Gambar Motif Batik", icon: ImageIcon, roles: ["ADMIN", "STAFF", "CUSTOMER"] },
    { name: "Hasil Validasi Gambar Motif Batik", id: "Hasil Validasi Gambar Motif Batik", icon: CheckCircle, roles: ["ADMIN", "STAFF"] },
    { name: "Feature Map CNN", id: "Feature Map CNN", icon: Grid, roles: ["ADMIN", "STAFF"] },
    { name: "Attention Map VIT", id: "Attention Map VIT", icon: Eye, roles: ["ADMIN", "STAFF"] },
    { name: "Hasil Prediksi Motif Batik", id: "Hasil Prediksi Motif Batik", icon: Cpu, roles: ["ADMIN", "STAFF", "CUSTOMER"] },
    { name: "Data Motif Batik Kaggle", id: "Data Motif Batik Kaggle", icon: Compass, roles: ["ADMIN", "STAFF"] },
    { name: "Laporan", id: "Laporan", icon: BarChart3, roles: ["ADMIN", "STAFF"] },
  ];

  const menuItems = allMenuItems.filter(item => !item.roles || item.roles.includes(user?.role || ""));

  return (
    <>
      {/* Backdrop overlay for mobile when sidebar is open */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          id="sidebar-backdrop"
        />
      )}

      <aside 
        id="sidebar-container" 
        className={`fixed inset-y-0 left-0 w-72 bg-white h-screen border-r border-slate-200 flex flex-col justify-between select-none z-50 transition-transform duration-300 lg:translate-x-0 lg:static lg:z-0 shrink-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Banner with logo */}
          <div id="sidebar-header" className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 text-slate-900">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-lg font-display overflow-hidden shrink-0">
                <img 
                  src="/src/logo.png" 
                  alt="Logo" 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const pNode = e.currentTarget.parentNode as HTMLElement;
                    if (pNode) {
                      const fallbackSpan = document.createElement('span');
                      fallbackSpan.className = 'text-indigo-650 font-black text-xl font-display';
                      fallbackSpan.innerText = 'B';
                      pNode.appendChild(fallbackSpan);
                    }
                  }}
                />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-wider text-slate-900 uppercase font-display">BatikLens</h1>
                <p className="text-xs text-slate-500 max-w-[170px] truncate font-serif italic font-medium">Griya Batik Halimah</p>
              </div>
            </div>
            
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-lg lg:hidden cursor-pointer transition-colors"
                title="Tutup Menu"
                id="btn-close-sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Current logged-in role tag */}
          <div id="user-role-badge" className="mx-4 mt-5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center text-sm shrink-0">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-800 truncate">{user?.name}</div>
              <div className="flex items-center space-x-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${user?.role === "ADMIN" ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}></span>
                <span className="text-[10px] uppercase tracking-widest text-indigo-600 font-extrabold">{user?.role}</span>
              </div>
            </div>
          </div>

          {/* Navigation list */}
          <nav id="sidebar-nav" className="p-4 space-y-1 mt-4 flex-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentMenu === item.id;
              return (
                <button
                  key={item.id}
                  id={`menu-item-${item.id.replace(/\s+/g, '-').toLowerCase()}`}
                  onClick={() => {
                    setCurrentMenu(item.id);
                    if (onClose) onClose();
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold tracking-wide text-left transition-all duration-200 ${
                    isActive 
                      ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/10" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer logout info */}
        <div id="sidebar-footer" className="p-4 border-t border-slate-200 shrink-0 bg-white">
          <button
            id="btn-logout"
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>
    </>
  );
}
