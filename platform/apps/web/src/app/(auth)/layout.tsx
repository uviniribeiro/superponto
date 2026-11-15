import { LogoMark } from '@/components/logo';

/** Telas públicas: painel da marca à esquerda (desktop) e cartão de vidro à direita. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <span className="font-brand text-xl font-bold">Super<span className="text-brand">Ponto</span></span>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
            Jornada, ponto e escalas <span className="text-brand">em um só lugar.</span>
          </h1>
          <p className="mt-5 text-muted">Gestão de ponto para empresas, escolas, saúde e operações, com regras por vínculo e auditoria completa.</p>
        </div>
        <p className="text-xs text-subtle">© SuperPonto</p>
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-40 size-[560px] rounded-full bg-brand/20 blur-[120px]" />
        <svg aria-hidden viewBox="0 0 400 400" className="pointer-events-none absolute -right-24 top-1/2 size-[520px] -translate-y-1/2 opacity-[0.07]">
          <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="2" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return <line key={i} x1={200 + Math.sin(a) * 150} y1={200 - Math.cos(a) * 150} x2={200 + Math.sin(a) * 170} y2={200 - Math.cos(a) * 170} stroke="currentColor" strokeWidth="6" strokeLinecap="round" />;
          })}
          <path d="M200 200V90M200 200l70 40" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
        </svg>
      </aside>
      <main className="flex items-center justify-center p-4 sm:p-8">{children}</main>
    </div>
  );
}
