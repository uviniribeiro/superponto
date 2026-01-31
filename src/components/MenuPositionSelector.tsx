import React from 'react';
import { MenuPosition } from '@/hooks/useMenuPosition';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  PanelLeft, 
  PanelRight, 
  PanelTop, 
  PanelBottom,
  Settings2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuPositionSelectorProps {
  position: MenuPosition;
  onPositionChange: (position: MenuPosition) => void;
  compact?: boolean;
}

const positions: { value: MenuPosition; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'left', label: 'Esquerda', icon: PanelLeft },
  { value: 'right', label: 'Direita', icon: PanelRight },
  { value: 'top', label: 'Superior', icon: PanelTop },
  { value: 'bottom', label: 'Inferior', icon: PanelBottom },
];

export function MenuPositionSelector({ position, onPositionChange, compact }: MenuPositionSelectorProps) {
  if (compact) {
    return (
      <Popover>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Posição do Menu</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-2 gap-1">
            {positions.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={position === value ? 'default' : 'ghost'}
                size="sm"
                className="h-9 justify-start gap-2"
                onClick={() => onPositionChange(value)}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
      {positions.map(({ value, label, icon: Icon }) => (
        <Tooltip key={value} delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant={position === value ? 'default' : 'ghost'}
              size="icon"
              className={cn(
                "h-7 w-7",
                position === value && "shadow-sm"
              )}
              onClick={() => onPositionChange(value)}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
