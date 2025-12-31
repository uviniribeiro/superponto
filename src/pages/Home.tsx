import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CompanySettings {
  logo_url: string | null;
}

export default function Home() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanyLogo = async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('logo_url')
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setLogoUrl((data as CompanySettings).logo_url);
      }
    };

    fetchCompanyLogo();
  }, []);

  return (
    <div className="relative flex items-center justify-center min-h-[calc(100vh-8rem)]">
      {logoUrl && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            backgroundImage: `url(${logoUrl})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'contain',
            opacity: 0.5,
            filter: 'grayscale(0%)',
            mixBlendMode: 'normal',
          }}
        >
          <div 
            className="absolute inset-0"
            style={{
              background: 'transparent',
            }}
          />
        </div>
      )}
      {!logoUrl && (
        <div className="text-center text-muted-foreground/50">
          <p className="text-lg">Configure a logo da empresa nas configurações</p>
        </div>
      )}
    </div>
  );
}
