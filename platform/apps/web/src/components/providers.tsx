'use client';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState } from 'react';
import { api, type Me } from '@/lib/api';

const SessionContext = createContext<{ me: Me | undefined; loading: boolean }>({ me: undefined, loading: true });

function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/auth/me'), staleTime: 60_000 });
  return <SessionContext.Provider value={{ me: data, loading: isLoading }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

export function can(me: Me | undefined, permission: string) {
  return !!me && (me.isPlatformAdmin || me.permissions.includes(permission));
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
