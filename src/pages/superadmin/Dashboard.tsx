import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, 
  Building2, 
  Landmark, 
  Key, 
  Users, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';

interface License {
  id: string;
  company_id: string;
  license_type: string;
  max_employees: number | null;
  valid_until: string;
  is_active: boolean;
  company?: {
    name: string;
    organization_type: string;
  };
}

interface Company {
  id: string;
  name: string;
  organization_type: 'company' | 'city_hall';
  is_active: boolean;
  license_status: string | null;
  created_at: string;
  parent_organization_id: string | null;
}

const LICENSE_PRICES = {
  '50': { monthly: 150, annual: 1500, lifetime: 5000 },
  '100': { monthly: 250, annual: 2500, lifetime: 8000 },
  '200': { monthly: 400, annual: 4000, lifetime: 12000 },
  '300': { monthly: 550, annual: 5500, lifetime: 16000 },
  '500': { monthly: 800, annual: 8000, lifetime: 24000 },
  '1000': { monthly: 1200, annual: 12000, lifetime: 36000 },
  'unlimited': { monthly: 2000, annual: 20000, lifetime: 60000 },
};

const chartConfig = {
  companies: {
    label: "Empresas",
    color: "hsl(var(--primary))",
  },
  cityHalls: {
    label: "Prefeituras",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig;

export default function SuperAdminDashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [companiesRes, licensesRes] = await Promise.all([
        supabase.from('companies').select('*').order('created_at', { ascending: false }),
        supabase.from('licenses').select(`
          *,
          company:companies(name, organization_type)
        `).order('valid_until', { ascending: true })
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (licensesRes.error) throw licensesRes.error;

      setCompanies((companiesRes.data || []) as Company[]);
      setLicenses((licensesRes.data || []) as License[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats calculations
  const totalCompanies = companies.filter(c => c.organization_type === 'company' && !c.parent_organization_id).length;
  const totalCityHalls = companies.filter(c => c.organization_type === 'city_hall' && !c.parent_organization_id).length;
  const activeCompanies = companies.filter(c => c.is_active && !c.parent_organization_id).length;
  const activeLicenses = licenses.filter(l => l.is_active).length;
  
  const today = new Date();
  const expiringLicenses = licenses.filter(l => {
    const validUntil = new Date(l.valid_until);
    const daysUntilExpiry = differenceInDays(validUntil, today);
    return l.is_active && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  });

  const expiredLicenses = licenses.filter(l => {
    const validUntil = new Date(l.valid_until);
    return l.is_active && validUntil < today;
  });

  // Calculate estimated revenue
  const calculateMonthlyRevenue = () => {
    let total = 0;
    licenses.filter(l => l.is_active).forEach(license => {
      const employees = license.max_employees === -1 ? 'unlimited' : String(license.max_employees);
      const prices = LICENSE_PRICES[employees as keyof typeof LICENSE_PRICES];
      if (prices) {
        if (license.license_type === 'monthly') {
          total += prices.monthly;
        } else if (license.license_type === 'annual') {
          total += prices.annual / 12;
        }
        // Lifetime doesn't count as recurring revenue
      }
    });
    return total;
  };

  const calculateAnnualRevenue = () => {
    let total = 0;
    licenses.filter(l => l.is_active).forEach(license => {
      const employees = license.max_employees === -1 ? 'unlimited' : String(license.max_employees);
      const prices = LICENSE_PRICES[employees as keyof typeof LICENSE_PRICES];
      if (prices) {
        if (license.license_type === 'monthly') {
          total += prices.monthly * 12;
        } else if (license.license_type === 'annual') {
          total += prices.annual;
        }
      }
    });
    return total;
  };

  // License type distribution
  const licenseTypeData = [
    { name: 'Mensal', value: licenses.filter(l => l.license_type === 'monthly' && l.is_active).length, fill: 'hsl(var(--primary))' },
    { name: 'Anual', value: licenses.filter(l => l.license_type === 'annual' && l.is_active).length, fill: 'hsl(var(--accent))' },
    { name: 'Vitalícia', value: licenses.filter(l => l.license_type === 'lifetime' && l.is_active).length, fill: 'hsl(var(--muted-foreground))' },
  ].filter(d => d.value > 0);

  // Recent registrations by month (last 6 months)
  const getRegistrationsByMonth = () => {
    const months: { [key: string]: { companies: number; cityHalls: number } } = {};
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = format(date, 'MMM/yy', { locale: ptBR });
      months[key] = { companies: 0, cityHalls: 0 };
    }

    companies.filter(c => !c.parent_organization_id).forEach(company => {
      const createdAt = new Date(company.created_at);
      const key = format(createdAt, 'MMM/yy', { locale: ptBR });
      if (months[key]) {
        if (company.organization_type === 'company') {
          months[key].companies++;
        } else {
          months[key].cityHalls++;
        }
      }
    });

    return Object.entries(months).map(([month, data]) => ({
      month,
      ...data,
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse-soft">Carregando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Dashboard"
          description="Visão geral do sistema Ponto Max" icon={LayoutDashboard}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompanies}</div>
            <p className="text-xs text-muted-foreground">
              {companies.filter(c => c.organization_type === 'company' && c.is_active && !c.parent_organization_id).length} ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prefeituras</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCityHalls}</div>
            <p className="text-xs text-muted-foreground">
              {companies.filter(c => c.organization_type === 'city_hall' && c.is_active && !c.parent_organization_id).length} ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licenças Ativas</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLicenses}</div>
            <p className="text-xs text-muted-foreground">
              de {licenses.length} totais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(calculateMonthlyRevenue())}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(calculateAnnualRevenue())}/ano estimado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Expiring Licenses Alert */}
        <Card className={expiringLicenses.length > 0 ? 'border-yellow-500' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className={`h-5 w-5 ${expiringLicenses.length > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
              Licenças Expirando (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringLicenses.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {expiringLicenses.map(license => (
                  <div key={license.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{license.company?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Expira em {format(new Date(license.valid_until), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      {differenceInDays(new Date(license.valid_until), today)} dias
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Nenhuma licença expirando nos próximos 30 dias</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expired Licenses */}
        <Card className={expiredLicenses.length > 0 ? 'border-destructive' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className={`h-5 w-5 ${expiredLicenses.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              Licenças Expiradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiredLicenses.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {expiredLicenses.map(license => (
                  <div key={license.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{license.company?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Expirou em {format(new Date(license.valid_until), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      {Math.abs(differenceInDays(new Date(license.valid_until), today))} dias atrás
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Nenhuma licença expirada</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Registrations by Month */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cadastros por Mês
            </CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <BarChart data={getRegistrationsByMonth()}>
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="companies" name="Empresas" fill="var(--color-companies)" radius={4} />
                <Bar dataKey="cityHalls" name="Prefeituras" fill="var(--color-cityHalls)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* License Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Tipos de Licença
            </CardTitle>
            <CardDescription>Distribuição por tipo</CardDescription>
          </CardHeader>
          <CardContent>
            {licenseTypeData.length > 0 ? (
              <div className="flex items-center justify-center gap-8">
                <ChartContainer config={chartConfig} className="h-[200px] w-[200px]">
                  <PieChart>
                    <Pie
                      data={licenseTypeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {licenseTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="space-y-2">
                  {licenseTypeData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-sm">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                Nenhuma licença cadastrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cadastros Recentes
          </CardTitle>
          <CardDescription>Últimos 10 cadastros</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {companies.filter(c => !c.parent_organization_id).slice(0, 10).map(company => (
              <div key={company.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {company.organization_type === 'company' ? (
                    <Building2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Landmark className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <p className="font-medium">{company.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {company.organization_type === 'company' ? 'Empresa' : 'Prefeitura'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={company.is_active ? 'default' : 'secondary'}>
                    {company.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(company.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
