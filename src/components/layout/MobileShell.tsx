// App do funcionário (Android/iPhone): navegação de app — barra inferior com as funções do dia a dia
// (registrar ponto, registros, banco de horas, ocorrências) e "Mais" com o restante. Respeita as áreas
// seguras do celular (entalhe e barra de gestos).
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, Clock, KeyRound, ListChecks, LogOut, Menu, QrCode, Repeat, Timer, UserCog, BookOpen, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const TABS = [
  { to: '/time-clock', label: 'Ponto', icon: Clock },
  { to: '/my-records', label: 'Registros', icon: ListChecks },
  { to: '/my-time-bank', label: 'Banco', icon: Timer },
  { to: '/point-occurrences', label: 'Ocorrências', icon: AlertCircle },
];

const MORE = [
  { to: '/my-qrcode', label: 'Meu QR Code', icon: QrCode },
  { to: '/vacations', label: 'Minhas férias', icon: CalendarDays },
  { to: '/schedule-swaps', label: 'Troca de escala/folga', icon: Repeat },
  { to: '/account-settings', label: 'Minha conta', icon: UserCog },
  { to: '/forgot-password', label: 'Trocar senha', icon: KeyRound },
  { to: '/system-manual', label: 'Ajuda', icon: BookOpen },
];

export default function MobileShell() {
  const { profile, signOut } = useAuth();
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const title = [...TABS, ...MORE].find((t) => loc.pathname.startsWith(t.to))?.label ?? 'SuperPonto';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {(profile?.full_name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{profile?.full_name}</p>
        </div>
      </header>

      <main className="flex-1 px-3 pb-24 pt-3">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              {({ isActive }) => (<><span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${isActive ? 'bg-primary/15' : ''}`}><Icon className="h-5 w-5" /></span>{label}</>)}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground">
            <span className="flex h-8 w-14 items-center justify-center rounded-full"><Menu className="h-5 w-5" /></span>Mais
          </button>
        </div>
      </nav>

      {more && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-background p-4 animate-in slide-in-from-bottom" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><p className="text-lg font-semibold">Mais</p><button type="button" onClick={() => setMore(false)} aria-label="Fechar"><X className="h-5 w-5" /></button></div>
            <div className="grid grid-cols-3 gap-3">
              {MORE.map(({ to, label, icon: Icon }) => (
                <button key={to} type="button" onClick={() => { setMore(false); nav(to); }} className="flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-medium hover:bg-muted">
                  <Icon className="h-6 w-6 text-primary" />{label}
                </button>
              ))}
              <button type="button" onClick={() => { setMore(false); signOut(); }} className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/40 p-3 text-center text-xs font-medium text-destructive">
                <LogOut className="h-6 w-6" />Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
