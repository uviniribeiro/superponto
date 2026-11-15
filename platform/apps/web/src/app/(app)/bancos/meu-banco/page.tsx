'use client';

import { useQuery } from '@tanstack/react-query';
import { PiggyBank } from 'lucide-react';
import { Page, PageHeader } from '@/components/page';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { BankStatement } from '@/components/bank-statement';

export default function MeuBancoPage() {
  const me = useQuery({ queryKey: ['bank', 'me-check'], queryFn: () => api<{ balanceMinutes: number }>('/bank/me'), retry: false });
  return (
    <Page>
      <PageHeader title="Meu banco de horas" description="Seu saldo, os créditos com data de vencimento e cada lançamento (fechamentos, pagamentos e compensações)." />
      {me.isLoading ? <Skeleton className="h-60 rounded-[28px]" /> : me.error ? <Card><EmptyState icon={PiggyBank} title="Indisponível" body={(me.error as Error).message} /></Card> : (
        <Card className="max-w-2xl rounded-[28px]"><BankStatement employmentId="me" mine /></Card>
      )}
    </Page>
  );
}
