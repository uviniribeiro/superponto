import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'manager' | 'employee';

interface Company {
  id: string;
  name: string;
  company_code: string;
  cnpj: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  cpf: string | null;
  pis: string | null;
  registration_number: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  is_active: boolean;
  company_id: string | null;
  phone: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string, companyCode: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, companyName: string, companyCnpj: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  createEmployee: (employeeData: CreateEmployeeData) => Promise<{ error: Error | null; user?: any }>;
}

interface CreateEmployeeData {
  email: string;
  password: string;
  fullName: string;
  cpf?: string;
  pis?: string;
  registration_number?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setCompany(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as unknown as Profile);

        // Fetch company if profile has company_id
        if ((profileData as any).company_id) {
          const { data: companyData } = await supabase
            .from('companies')
            .select('id, name, company_code, cnpj')
            .eq('id', (profileData as any).company_id)
            .maybeSingle();

          if (companyData) {
            setCompany(companyData as Company);
          }
        }
      }

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesData) {
        setRoles(rolesData.map(r => r.role as AppRole));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string, companyCode: string) => {
    // First validate company code exists
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('id, name, company_code')
      .eq('company_code', companyCode.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (companyError || !companyData) {
      return { error: new Error('Código da empresa inválido ou empresa inativa') };
    }

    // Try to sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });

    if (authError) {
      return { error: authError as Error };
    }

    // Verify user belongs to the company
    if (authData.user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (!profileData || (profileData as any).company_id !== companyData.id) {
        await supabase.auth.signOut();
        return { error: new Error('Usuário não pertence a esta empresa') };
      }
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, companyName: string, companyCnpj: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Generate unique company code
    const companyCode = companyName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 6) + 
      Math.random().toString(36).substring(2, 6).toUpperCase();

    // Create company first
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        cnpj: companyCnpj || null,
        company_code: companyCode
      })
      .select()
      .single();

    if (companyError) {
      return { error: companyError as Error };
    }

    // Create user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });

    if (error) {
      // Rollback company creation
      await supabase.from('companies').delete().eq('id', companyData.id);
      return { error: error as Error };
    }

    if (data.user) {
      // Create profile with company_id
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: data.user.id,
        full_name: fullName,
        email: email,
        company_id: companyData.id
      });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }

      // Create initial company settings
      await supabase.from('company_settings').insert({
        company_id: companyData.id,
        company_name: companyName,
        cnpj: companyCnpj || null
      });
    }

    return { error: null };
  };

  const createEmployee = async (employeeData: CreateEmployeeData) => {
    if (!profile?.company_id) {
      return { error: new Error('Você precisa estar vinculado a uma empresa') };
    }

    // Create auth user for employee
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: employeeData.email,
      password: employeeData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: employeeData.fullName }
      }
    });

    if (authError) {
      return { error: authError as Error };
    }

    if (authData.user) {
      // Create profile for employee with company_id
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: authData.user.id,
        full_name: employeeData.fullName,
        email: employeeData.email,
        cpf: employeeData.cpf || null,
        pis: employeeData.pis || null,
        registration_number: employeeData.registration_number || null,
        department: employeeData.department || null,
        position: employeeData.position || null,
        hire_date: employeeData.hire_date || null,
        phone: employeeData.phone || null,
        company_id: profile.company_id
      });

      if (profileError) {
        return { error: profileError as Error };
      }

      // Assign employee role
      await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: 'employee'
      });
    }

    return { error: null, user: authData.user };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager') || isAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      company,
      roles,
      loading,
      signIn,
      signUp,
      signOut,
      hasRole,
      isAdmin,
      isManager,
      createEmployee
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
