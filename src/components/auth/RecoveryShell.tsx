import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { PontoMaxLogo } from '@/components/PontoMaxLogo';

export function RecoveryShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">
    <header className="border-b border-sidebar-border bg-sidebar px-6 py-5"><Link to="/super-admin-auth"><PontoMaxLogo inverse /></Link></header>
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-12">
      <ShieldCheck className="mb-6 h-10 w-10 text-primary" />{children}
    </main>
    <footer className="py-6 text-center text-xs text-muted-foreground">PontoMax · Acesso protegido</footer>
  </div>;
}