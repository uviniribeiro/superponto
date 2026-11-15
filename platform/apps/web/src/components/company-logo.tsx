'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, type Company } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button, useToast } from './ui';

/** Logo da empresa (ou a inicial, quando não há logo). */
export function CompanyLogo({ company, className }: { company: Pick<Company, 'id' | 'legalName' | 'tradeName' | 'logoUpdatedAt'>; className?: string }) {
  const logo = useQuery({
    queryKey: ['company-logo', company.id, company.logoUpdatedAt],
    queryFn: () => api<{ dataUrl: string }>(`/companies/${company.id}/logo`),
    enabled: !!company.logoUpdatedAt,
    staleTime: Infinity,
  });
  const initial = (company.tradeName ?? company.legalName).charAt(0).toUpperCase();
  return logo.data ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo.data.dataUrl} alt="" className={cn('size-10 shrink-0 rounded-xl bg-white object-contain p-1', className)} />
  ) : (
    <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft font-display font-bold text-brand', className)}>{initial}</div>
  );
}

/** Enviar/trocar/remover o logo (PNG, JPEG ou WebP até 512 KB). */
export function CompanyLogoField({ company }: { company: Company }) {
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [updatedAt, setUpdatedAt] = useState(company.logoUpdatedAt);
  const done = (msg: string) => { qc.invalidateQueries({ queryKey: ['companies'] }); toast('success', msg); };
  const upload = useMutation({
    mutationFn: (dataUrl: string) => api<{ logoUpdatedAt: string }>(`/companies/${company.id}/logo`, { method: 'PUT', json: { dataUrl } }),
    onSuccess: (r) => { setUpdatedAt(r.logoUpdatedAt); done('Logo atualizado'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const remove = useMutation({
    mutationFn: () => api(`/companies/${company.id}/logo`, { method: 'DELETE' }),
    onSuccess: () => { setUpdatedAt(null); done('Logo removido'); },
    onError: (e: Error) => toast('error', e.message),
  });
  function pick(file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { toast('error', 'Use uma imagem PNG, JPEG ou WebP'); return; }
    if (file.size > 512 * 1024) { toast('error', 'O logo deve ter no máximo 512 KB'); return; }
    const reader = new FileReader();
    reader.onload = () => upload.mutate(String(reader.result));
    reader.readAsDataURL(file);
  }
  return (
    <div className="flex items-center gap-4">
      <CompanyLogo company={{ ...company, logoUpdatedAt: updatedAt }} className="size-16 rounded-2xl" />
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} aria-label="Arquivo do logo" />
        <Button type="button" variant="outline" loading={upload.isPending} onClick={() => input.current?.click()}><ImagePlus className="size-4" />{updatedAt ? 'Trocar logo' : 'Enviar logo'}</Button>
        {updatedAt && <Button type="button" variant="ghost" loading={remove.isPending} onClick={() => remove.mutate()} className="hover:text-danger"><Trash2 className="size-4" />Remover</Button>}
      </div>
      <p className="hidden text-xs text-subtle sm:block">PNG, JPEG ou WebP, até 512 KB. Aparece nos relatórios e no espelho de ponto.</p>
    </div>
  );
}
