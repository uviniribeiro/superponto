import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, Grid3X3 } from 'lucide-react';

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9"
            onClick={() => navigate('/home')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9"
            onClick={() => navigate('/home')}
          >
            <Home className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Grid3X3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{config.title}</h1>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
      </div>

      {/* Groups */}
      {config.groups.map((group) => (
        <div key={group.title} className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{group.title}</h2>
            <p className="text-xs text-muted-foreground">{group.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {group.items.map((item) => (
              <Card
                key={item.title}
                className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all border-border/50 group"
                onClick={() => navigate(item.href)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${item.color || 'text-primary'} group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                      {item.badges && item.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.badges.map((badge) => (
                            <Badge
                              key={badge}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary"
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
