import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Envia a localização do terminal do motorista direto para o banco,
 * sem depender do robô local. Grava uma posição a cada intervalo.
 */
export function useDriverGps(params: {
  enabled: boolean;
  companyId: string | null;
  profileId: string | null;
  vehicleId: string | null;
  scheduleId: string | null;
  intervalMs?: number;
}) {
  const { enabled, companyId, profileId, vehicleId, scheduleId, intervalMs = 30000 } = params;
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    if (!enabled || !companyId || !profileId) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Este aparelho não permite localização.');
      return;
    }

    const send = () => {
      if (sending.current) return;
      sending.current = true;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { error: dbError } = await supabase.from('op_gps_positions').insert({
            company_id: companyId,
            profile_id: profileId,
            vehicle_id: vehicleId,
            schedule_id: scheduleId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed_kmh: pos.coords.speed != null ? Math.max(0, pos.coords.speed * 3.6) : null,
            heading: pos.coords.heading ?? null,
            source: 'terminal',
            recorded_at: new Date().toISOString(),
          });
          sending.current = false;
          if (dbError) setError(dbError.message);
          else { setError(null); setLastSentAt(new Date()); }
        },
        (geoError) => {
          sending.current = false;
          setError(geoError.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    };

    send();
    const timer = window.setInterval(send, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, companyId, profileId, vehicleId, scheduleId, intervalMs]);

  return { lastSentAt, error };
}
