import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Subscribes admins/managers to real-time divergence blocks from
 * `identification_validation_attempts` and surfaces them as:
 *  - a toast (sonner)
 *  - a notification with a link to the audit evidence
 */
export function DivergenceAlertsSubscriber() {
  const { profile, isAdmin, isManager } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile || (!isAdmin && !isManager)) return;

    const channel = supabase
      .channel('divergence-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'identification_validation_attempts',
          filter: 'method_type=eq.divergence',
        },
        async (payload) => {
          const row: any = payload.new;
          if (!row) return;
          // Only admins scope by company; managers see their company only
          if (profile.company_id && row.company_id && row.company_id !== profile.company_id) return;
          // Ignore acknowledged justifications (success = true means user confirmed)
          if (row.success) return;

          // Look up employee name
          let empName = 'Funcionário';
          if (row.profile_id) {
            const { data } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', row.profile_id)
              .maybeSingle();
            if (data?.full_name) empName = data.full_name;
          }

          const actionUrl = `/validation-audit?attempt=${row.id}`;
          const message = `${empName} teve o ponto bloqueado por divergência de dispositivo.`;

          addNotification({
            type: 'divergence_block',
            title: 'Bloqueio por divergência',
            message,
            actionUrl,
            actionLabel: 'Abrir evidência',
          });

          toast.warning('Bloqueio por divergência detectado', {
            description: message,
            icon: <ShieldAlert className="h-4 w-4" />,
            action: {
              label: 'Ver evidência',
              onClick: () => navigate(actionUrl),
            },
            duration: 10000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, isAdmin, isManager, addNotification, navigate]);

  return null;
}
