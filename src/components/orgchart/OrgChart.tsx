import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, User, ChevronDown } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
}

interface Position {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  parent_id: string | null;
  level: number;
  is_active: boolean;
}

interface OrgChartProps {
  departments: Department[];
  positions: Position[];
}

export function OrgChart({ departments, positions }: OrgChartProps) {
  const getDepartmentPositions = (departmentId: string) => {
    return positions
      .filter(p => p.department_id === departmentId && p.is_active)
      .sort((a, b) => b.level - a.level);
  };

  const buildDepartmentTree = (parentId: string | null = null): Department[] => {
    return departments
      .filter(d => d.parent_id === parentId && d.is_active)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const getLevelColor = (level: number) => {
    const colors: Record<number, string> = {
      5: 'bg-purple-500/20 text-purple-700 border-purple-300',
      4: 'bg-blue-500/20 text-blue-700 border-blue-300',
      3: 'bg-emerald-500/20 text-emerald-700 border-emerald-300',
      2: 'bg-amber-500/20 text-amber-700 border-amber-300',
      1: 'bg-slate-500/20 text-slate-700 border-slate-300',
    };
    return colors[level] || colors[1];
  };

  const getLevelLabel = (level: number) => {
    const labels: Record<number, string> = {
      5: 'Diretoria',
      4: 'Gerência',
      3: 'Supervisão',
      2: 'Técnico',
      1: 'Operacional',
    };
    return labels[level] || 'Operacional';
  };

  const renderPositionNode = (position: Position, isLast: boolean = false) => {
    const childPositions = positions.filter(
      p => p.parent_id === position.id && p.is_active
    ).sort((a, b) => b.level - a.level);

    return (
      <div key={position.id} className="flex flex-col items-center">
        <div
          className={`p-3 rounded-lg border-2 min-w-[160px] text-center transition-all hover:shadow-lg ${getLevelColor(position.level)}`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <User className="h-4 w-4" />
            <span className="font-semibold text-sm">{position.name}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {getLevelLabel(position.level)}
          </Badge>
        </div>

        {childPositions.length > 0 && (
          <>
            <div className="w-0.5 h-4 bg-border" />
            <div className="flex gap-6">
              {childPositions.map((child, idx) => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-0.5 h-4 bg-border" />
                  {renderPositionNode(child, idx === childPositions.length - 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderDepartmentNode = (department: Department, level: number = 0) => {
    const childDepts = buildDepartmentTree(department.id);
    const deptPositions = getDepartmentPositions(department.id);
    const topLevelPositions = deptPositions.filter(
      p => !p.parent_id || !positions.find(pp => pp.id === p.parent_id && pp.department_id === department.id)
    );

    return (
      <div key={department.id} className="flex flex-col items-center">
        <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 min-w-[200px] text-center shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-bold text-primary">{department.name}</span>
          </div>
          {department.description && (
            <p className="text-xs text-muted-foreground">{department.description}</p>
          )}
          {deptPositions.length > 0 && (
            <Badge className="mt-2" variant="secondary">
              {deptPositions.length} cargo(s)
            </Badge>
          )}
        </div>

        {/* Positions in this department */}
        {topLevelPositions.length > 0 && (
          <>
            <div className="w-0.5 h-4 bg-border" />
            <div className="flex gap-4 flex-wrap justify-center">
              {topLevelPositions.map((pos, idx) => (
                <div key={pos.id} className="flex flex-col items-center">
                  {renderPositionNode(pos, idx === topLevelPositions.length - 1)}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Child departments */}
        {childDepts.length > 0 && (
          <>
            <div className="w-0.5 h-6 bg-primary/30" />
            <ChevronDown className="h-4 w-4 text-primary/50 -my-1" />
            <div className="flex gap-8 flex-wrap justify-center">
              {childDepts.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-0.5 h-4 bg-primary/30" />
                  {renderDepartmentNode(child, level + 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const rootDepartments = buildDepartmentTree(null);
  const orphanPositions = positions.filter(p => !p.department_id && p.is_active && !p.parent_id);

  if (departments.length === 0 && positions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            Nenhum departamento ou cargo cadastrado.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre departamentos e cargos para visualizar o organograma.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Organograma
        </CardTitle>
        <CardDescription>
          Visualização da estrutura organizacional da empresa
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-max p-4">
          {/* Render department trees */}
          <div className="flex gap-12 justify-center flex-wrap">
            {rootDepartments.map((dept) => renderDepartmentNode(dept))}
          </div>

          {/* Render orphan positions (without department) */}
          {orphanPositions.length > 0 && (
            <div className="mt-8 pt-8 border-t">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Cargos sem departamento
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                {orphanPositions.map((pos) => (
                  <div
                    key={pos.id}
                    className={`p-3 rounded-lg border-2 min-w-[140px] text-center ${getLevelColor(pos.level)}`}
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <User className="h-4 w-4" />
                      <span className="font-semibold text-sm">{pos.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {getLevelLabel(pos.level)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm font-medium mb-2">Legenda de Níveis:</p>
          <div className="flex gap-3 flex-wrap">
            {[5, 4, 3, 2, 1].map((level) => (
              <Badge key={level} variant="outline" className={getLevelColor(level)}>
                {getLevelLabel(level)}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
