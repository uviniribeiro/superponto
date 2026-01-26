import React, { useEffect } from 'react';
import { useHolidayTheme } from '@/hooks/useHolidayTheme';

interface HolidayThemeProviderProps {
  children: React.ReactNode;
}

export function HolidayThemeProvider({ children }: HolidayThemeProviderProps) {
  const { currentTheme, holidayColors, isHolidayThemeActive } = useHolidayTheme();
  
  useEffect(() => {
    const root = document.documentElement;
    
    if (isHolidayThemeActive && holidayColors) {
      // Apply holiday theme colors
      root.style.setProperty('--holiday-primary', holidayColors.primary);
      root.style.setProperty('--holiday-secondary', holidayColors.secondary);
      root.style.setProperty('--holiday-accent', holidayColors.accent);
      root.style.setProperty('--holiday-gradient', holidayColors.gradient);
      root.setAttribute('data-holiday-theme', currentTheme);
    } else {
      // Remove holiday theme
      root.style.removeProperty('--holiday-primary');
      root.style.removeProperty('--holiday-secondary');
      root.style.removeProperty('--holiday-accent');
      root.style.removeProperty('--holiday-gradient');
      root.removeAttribute('data-holiday-theme');
    }
    
    return () => {
      root.style.removeProperty('--holiday-primary');
      root.style.removeProperty('--holiday-secondary');
      root.style.removeProperty('--holiday-accent');
      root.style.removeProperty('--holiday-gradient');
      root.removeAttribute('data-holiday-theme');
    };
  }, [currentTheme, holidayColors, isHolidayThemeActive]);
  
  return <>{children}</>;
}
