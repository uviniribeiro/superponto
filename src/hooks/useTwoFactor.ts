import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining: number;
}

interface SetupData {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
  qrCodeData: string;
}

export function useTwoFactor() {
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);

  const getStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('two-factor-auth', {
        body: { action: 'status' },
      });

      if (error) throw error;
      setStatus(data);
      return data;
    } catch (error: any) {
      console.error('Error getting 2FA status:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('two-factor-auth', {
        body: { action: 'setup' },
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return null;
      }

      setSetupData(data);
      return data;
    } catch (error: any) {
      console.error('Error starting 2FA setup:', error);
      toast.error('Erro ao iniciar configuração do 2FA');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async (token: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('two-factor-auth', {
        body: { action: 'verify-setup', token },
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return false;
      }

      toast.success('2FA ativado com sucesso!');
      setSetupData(null);
      await getStatus();
      return true;
    } catch (error: any) {
      console.error('Error verifying 2FA setup:', error);
      toast.error('Erro ao verificar código');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verify = async (token: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('two-factor-auth', {
        body: { action: 'verify', token },
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return false;
      }

      return data.verified;
    } catch (error: any) {
      console.error('Error verifying 2FA:', error);
      toast.error('Erro ao verificar código');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyBackupCode = async (code: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('two-factor-auth', {
        body: { action: 'verify-backup', code },
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return false;
      }

      if (data.remainingCodes <= 2) {
        toast.warning(`Atenção: restam apenas ${data.remainingCodes} códigos de backup`);
      }

      return data.verified;
    } catch (error: any) {
      console.error('Error verifying backup code:', error);
      toast.error('Erro ao verificar código de backup');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const disable = async (token: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('two-factor-auth', {
        body: { action: 'disable', token },
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return false;
      }

      toast.success('2FA desabilitado com sucesso');
      await getStatus();
      return true;
    } catch (error: any) {
      console.error('Error disabling 2FA:', error);
      toast.error('Erro ao desabilitar 2FA');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const regenerateBackupCodes = async (token: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('two-factor-auth', {
        body: { action: 'regenerate-backup-codes', token },
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return null;
      }

      toast.success('Novos códigos de backup gerados!');
      await getStatus();
      return data.backupCodes;
    } catch (error: any) {
      console.error('Error regenerating backup codes:', error);
      toast.error('Erro ao gerar novos códigos');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    status,
    setupData,
    getStatus,
    startSetup,
    verifySetup,
    verify,
    verifyBackupCode,
    disable,
    regenerateBackupCodes,
  };
}
