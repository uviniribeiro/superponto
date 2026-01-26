import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import superpontoLogo from '@/assets/superponto-logo-modern.png';

export function GlobalWatermark() {
  const { user } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClientLogo = async () => {
      if (!user) {
        setLogoUrl(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('company_settings')
          .select('logo_url')
          .limit(1)
          .single();

        if (error || !data?.logo_url) {
          setLogoUrl(null);
        } else {
          setLogoUrl(data.logo_url);
        }
      } catch {
        setLogoUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientLogo();
  }, [user]);

  // Use client logo if available, otherwise use system logo
  const displayLogo = logoUrl || superpontoLogo;

  if (isLoading) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      <img 
        src={displayLogo} 
        alt="" 
        className="w-[40vw] max-w-[500px] min-w-[200px] select-none"
        style={{
          opacity: logoUrl ? 0.08 : 0.03,
          filter: 'grayscale(100%)',
        }}
      />
    </div>
  );
}
