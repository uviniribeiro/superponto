import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export interface CategoryHubItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badges?: string[];
  color?: string;
}

export interface CategoryHubGroup {
  title: string;
  subtitle: string;
  items: CategoryHubItem[];
}

export interface CategoryHubConfig {
  title: string;
  description: string;
  groups: CategoryHubGroup[];
  backPath?: string;
}

interface CategoryHubProps {
  config: CategoryHubConfig;
}

export default function CategoryHub({ config }: CategoryHubProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        {config.backPath && (
          <Button variant="ghost" size="icon" onClick={() => navigate(config.backPath!)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold">{config.title}</h1>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Groups */}
      {config.groups.map((group) => (
        <div key={group.title} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.items.map((item) => (
              <Card
                key={item.title}
                className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all border-border/50 group"
                onClick={() => navigate(item.href)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg bg-muted ${item.color || 'text-primary'} group-hover:bg-primary group-hover:text-primary-foreground transition-colors`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-primary">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                      {item.badges && item.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.badges.map((badge) => (
                            <Badge
                              key={badge}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary"
                            >
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
