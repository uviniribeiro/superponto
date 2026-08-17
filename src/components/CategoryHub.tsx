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
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-2xl"
            aria-label="Voltar"
            onClick={() => navigate(config.backPath || '/home')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-2xl"
            aria-label="Início"
            onClick={() => navigate('/home')}
          >
            <Home className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Grid3X3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">{config.title}</h1>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
      </header>

      {/* Groups */}
      {config.groups.map((group) => (
        <section key={group.title} className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-heading text-lg font-bold">{group.title}</h2>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{group.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.items.map((item, index) => {
              const isHero = index === 0;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className={
                    isHero
                      ? 'bento-hero group flex flex-col justify-between gap-8 text-left sm:col-span-2 sm:row-span-1'
                      : 'bento-card group flex flex-col justify-between gap-6 text-left'
                  }
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={
                        isHero
                          ? 'flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground'
                          : 'flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-brand-deep transition-colors group-hover:bg-primary group-hover:text-primary-foreground'
                      }
                    >
                      <item.icon className={isHero ? 'h-7 w-7' : 'h-5 w-5'} />
                    </div>
                    {isHero && (
                      <span className="text-[10px] font-medium uppercase tracking-widest text-brand">
                        Principal
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`font-heading font-bold ${isHero ? 'text-2xl' : 'text-base'}`}>
                      {item.title}
                    </h3>
                    <p
                      className={`mt-1 text-sm ${isHero ? 'text-primary-foreground/70' : 'text-muted-foreground line-clamp-2'}`}
                    >
                      {item.description}
                    </p>
                    {item.badges && item.badges.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.badges.map((badge) => (
                          <Badge
                            key={badge}
                            variant="secondary"
                            className={
                              isHero
                                ? 'h-5 rounded-full border-0 bg-brand/30 px-2 text-[10px] text-primary-foreground'
                                : 'h-5 rounded-full border-0 bg-accent px-2 text-[10px] text-accent-foreground'
                            }
                          >
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
