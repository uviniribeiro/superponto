import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { validateCNPJ, cleanCNPJ } from '@/lib/validators';

type AppRole = 'admin' | 'manager' | 'employee' | 'super_admin';

interface Company {
  id: string;
  name: string;
  company_code: string;
  cnpj: string | null;
  sector: string | null;
  organization_type: 'company' | 'city_hall';
  teacher_module_enabled: boolean;
  doctor_module_enabled: boolean;
  payroll_module_enabled: boolean;
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
  photo_url: string | null;
  must_change_password: boolean | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (username: string, password: string, companyCode: string) => Promise<{ error: Error | null }>;
  signUp: (username: string, password: string, fullName: string, companyName: string, companyCnpj: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  hasTeacherModule: boolean;
  hasDoctorModule: boolean;
  hasPayrollModule: boolean;
  createEmployee: (employeeData: CreateEmployeeData) => Promise<{ error: Error | null; user?: any }>;
}

interface CreateEmployeeData {
  username: string;
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

// Helper to generate internal email from username
const generateInternalEmail = (username: string, companyId: string) => {
  const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${sanitizedUsername}@${companyId.slice(0, 8)}.pontomax.local`;
};

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
            .select('id, name, company_code, cnpj, sector, organization_type, teacher_module_enabled, doctor_module_enabled, payroll_module_enabled')
            .eq('id', (profileData as any).company_id)
            .maybeSingle();

          if (companyData) {
            setCompany(companyData as unknown as Company);
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

  const signIn = async (username: string, password: string, companyCode: string) => {
    try {
      // Use edge function to get user email (bypasses RLS)
      const { data: lookupData, error: lookupError } = await supabase.functions.invoke('validate-company-login', {
        body: { action: 'get-user-email', companyCode, username }
      });

      if (lookupError) {
        console.error('Error looking up user:', lookupError);
        return { error: new Error('Erro ao validar credenciais') };
      }

      if (!lookupData?.success) {
        return { error: new Error('Código da empresa inválido ou empresa inativa') };
      }

      const { companyId, internalEmail, storedEmail } = lookupData;

      // Try to sign in with internal email first
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email: internalEmail, 
        password 
      });

      if (authError) {
        // If login fails with internal email and we have a stored email, try that
        if (storedEmail && storedEmail !== internalEmail) {
          const { data: retryAuth, error: retryError } = await supabase.auth.signInWithPassword({
            email: storedEmail,
            password
          });

          if (retryError) {
            console.error('Login retry failed:', retryError.message);
            return { error: new Error('Login ou senha incorretos') };
          }

          // Verify user belongs to the company after login
          if (retryAuth.user) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('company_id')
              .eq('user_id', retryAuth.user.id)
              .maybeSingle();

            if (!profileData || profileData.company_id !== companyId) {
              await supabase.auth.signOut();
              return { error: new Error('Usuário não pertence a esta empresa') };
            }
          }

          return { error: null };
        }

        console.error('Login failed:', authError.message);
        return { error: new Error('Login ou senha incorretos') };
      }

      // Verify user belongs to the company after successful login
      if (authData.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (!profileData || profileData.company_id !== companyId) {
          await supabase.auth.signOut();
          return { error: new Error('Usuário não pertence a esta empresa') };
        }
      }

      return { error: null };
    } catch (err) {
      console.error('SignIn error:', err);
      return { error: new Error('Erro ao realizar login') };
    }
  };

  const signUp = async (username: string, password: string, fullName: string, companyName: string, companyCnpj: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // CNPJ numérico ou alfanumérico (padrão Receita Federal 2026)
    const cnpjCheck = validateCNPJ(companyCnpj);
    if (!cnpjCheck.valid) {
      return { error: new Error(cnpjCheck.message) };
    }
    const normalizedCnpj = cleanCNPJ(companyCnpj);
    
    // Check if CNPJ is already registered
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('company_code', normalizedCnpj)
      .maybeSingle();
    
    if (existingCompany) {
      return { error: new Error('CNPJ já cadastrado no sistema') };
    }

    // Create company first with CNPJ as company_code
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        cnpj: companyCnpj,
        company_code: normalizedCnpj
      })
      .select()
      .single();

    if (companyError) {
      return { error: companyError as Error };
    }

    // Generate internal email from username
    const internalEmail = generateInternalEmail(username, companyData.id);

    // Create user with internal email
    const { data, error } = await supabase.auth.signUp({
      email: internalEmail,
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
      // Create profile with company_id - store username in email field for display
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: data.user.id,
        full_name: fullName,
        email: internalEmail, // Store internal email
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

    // Generate internal email from username
    const internalEmail = generateInternalEmail(employeeData.username, profile.company_id);

    // Check if username already exists in this company
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('email', internalEmail)
      .maybeSingle();

    if (existingProfile) {
      return { error: new Error('Este login já está em uso nesta empresa') };
    }

    // Create auth user for employee with internal email
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: internalEmail,
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
        email: internalEmail,
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
  const isSuperAdmin = hasRole('super_admin');
  const isAdmin = hasRole('admin') || isSuperAdmin;
  const isManager = hasRole('manager') || isAdmin;
  const mustChangePassword = profile?.must_change_password === true;
  
  // Teacher module is available if:
  // 1. Company is a city_hall with education sector
  // 2. OR Company has teacher_module_enabled = true
  const hasTeacherModule = company?.sector === 'education' || company?.teacher_module_enabled === true;
  
  // Doctor module is available if:
  // 1. Company is a city_hall with health sector
  // 2. OR Company has doctor_module_enabled = true
  const hasDoctorModule = company?.sector === 'health' || company?.doctor_module_enabled === true;
  
  // Payroll module is available if company has payroll_module_enabled = true
  const hasPayrollModule = company?.payroll_module_enabled === true;

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
      isSuperAdmin,
      mustChangePassword,
      hasTeacherModule,
      hasDoctorModule,
      hasPayrollModule,
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
