import React, { useEffect, useMemo } from 'react';
import { useHolidayTheme, HolidayTheme } from '@/hooks/useHolidayTheme';

interface HolidayThemeProviderProps {
  children: React.ReactNode;
}

// Holiday-specific patterns (SVG data URIs)
const holidayPatterns: Record<HolidayTheme, string> = {
  default: 'none',
  carnival: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C27B0' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  easter: `url("data:image/svg+xml,%3Csvg width='52' height='26' viewBox='0 0 52 26' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C27B0' fill-opacity='0.3'%3E%3Cpath d='M10 10c0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6h2c0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4v2c-3.314 0-6-2.686-6-6 0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6zm25.464-1.95l8.486 8.486-1.414 1.414-8.486-8.486 1.414-1.414z' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  labor_day: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23E53935' fill-opacity='0.3' fill-rule='evenodd'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.41l-2.83 2.83-1.41-1.41L38.59 0H40v1.41zM20 18.6l2.83-2.83 1.41 1.41L21.41 20l2.83 2.83-1.41 1.41L20 21.41l-2.83 2.83-1.41-1.41L18.59 20l-2.83-2.83 1.41-1.41L20 18.59z'/%3E%3C/g%3E%3C/svg%3E")`,
  corpus_christi: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23FFD700' fill-opacity='0.3'%3E%3Cpath d='M50 50c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10zM10 10c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10S0 25.523 0 20s4.477-10 10-10zm10 8c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm40 40c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  independence: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23009C3B' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  christmas: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C62828' fill-opacity='0.3'%3E%3Cpath d='M50 50c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10zM10 10c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10S0 25.523 0 20s4.477-10 10-10zm10 8c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm40 40c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  new_year: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23FFD700' fill-opacity='0.3' fill-rule='evenodd'/%3E%3C/svg%3E")`
};

// Holiday confetti/decoration styles
const getHolidayDecorations = (theme: HolidayTheme): string => {
  switch (theme) {
    case 'carnival':
      return `
        --holiday-decoration-1: 🎭;
        --holiday-decoration-2: 🎊;
        --holiday-decoration-3: 🎉;
        --holiday-decoration-4: 💃;
        --holiday-decoration-5: 🪇;
      `;
    case 'easter':
      return `
        --holiday-decoration-1: 🐰;
        --holiday-decoration-2: 🥚;
        --holiday-decoration-3: 🌸;
        --holiday-decoration-4: 🐣;
        --holiday-decoration-5: 🌷;
      `;
    case 'labor_day':
      return `
        --holiday-decoration-1: ⚒️;
        --holiday-decoration-2: 🔧;
        --holiday-decoration-3: ✊;
        --holiday-decoration-4: 💪;
        --holiday-decoration-5: 🏭;
      `;
    case 'corpus_christi':
      return `
        --holiday-decoration-1: ✝️;
        --holiday-decoration-2: 🕊️;
        --holiday-decoration-3: ⭐;
        --holiday-decoration-4: 🙏;
        --holiday-decoration-5: 🌾;
      `;
    case 'independence':
      return `
        --holiday-decoration-1: 🇧🇷;
        --holiday-decoration-2: 💚;
        --holiday-decoration-3: 💛;
        --holiday-decoration-4: 🎆;
        --holiday-decoration-5: ⭐;
      `;
    case 'christmas':
      return `
        --holiday-decoration-1: 🎄;
        --holiday-decoration-2: 🎅;
        --holiday-decoration-3: ⭐;
        --holiday-decoration-4: 🎁;
        --holiday-decoration-5: ❄️;
      `;
    case 'new_year':
      return `
        --holiday-decoration-1: 🎆;
        --holiday-decoration-2: 🎇;
        --holiday-decoration-3: ✨;
        --holiday-decoration-4: 🥂;
        --holiday-decoration-5: 🎉;
      `;
    default:
      return '';
  }
};

export function HolidayThemeProvider({ children }: HolidayThemeProviderProps) {
  const { currentTheme, holidayColors, isHolidayThemeActive } = useHolidayTheme();
  
  // Generate dynamic styles for the holiday theme
  const holidayStyles = useMemo(() => {
    if (!isHolidayThemeActive || !holidayColors) return null;
    
    return {
      primary: holidayColors.primary,
      secondary: holidayColors.secondary,
      accent: holidayColors.accent,
      gradient: holidayColors.gradient,
      pattern: holidayPatterns[currentTheme] || 'none',
      decorations: getHolidayDecorations(currentTheme)
    };
  }, [currentTheme, holidayColors, isHolidayThemeActive]);
  
  useEffect(() => {
    const root = document.documentElement;
    
    if (isHolidayThemeActive && holidayStyles) {
      // Apply holiday theme colors as CSS custom properties
      root.style.setProperty('--holiday-primary', holidayStyles.primary);
      root.style.setProperty('--holiday-secondary', holidayStyles.secondary);
      root.style.setProperty('--holiday-accent', holidayStyles.accent);
      root.style.setProperty('--holiday-gradient', holidayStyles.gradient);
      root.style.setProperty('--holiday-pattern', holidayStyles.pattern);
      root.setAttribute('data-holiday-theme', currentTheme);
      
      // Add holiday class to body for additional styling hooks
      document.body.classList.add('holiday-active');
      document.body.classList.add(`holiday-${currentTheme}`);
    } else {
      // Remove holiday theme
      root.style.removeProperty('--holiday-primary');
      root.style.removeProperty('--holiday-secondary');
      root.style.removeProperty('--holiday-accent');
      root.style.removeProperty('--holiday-gradient');
      root.style.removeProperty('--holiday-pattern');
      root.removeAttribute('data-holiday-theme');
      
      document.body.classList.remove('holiday-active');
      // Remove all possible holiday classes
      document.body.classList.remove(
        'holiday-carnival', 
        'holiday-easter', 
        'holiday-labor_day',
        'holiday-corpus_christi',
        'holiday-independence',
        'holiday-christmas',
        'holiday-new_year'
      );
    }
    
    return () => {
      root.style.removeProperty('--holiday-primary');
      root.style.removeProperty('--holiday-secondary');
      root.style.removeProperty('--holiday-accent');
      root.style.removeProperty('--holiday-gradient');
      root.style.removeProperty('--holiday-pattern');
      root.removeAttribute('data-holiday-theme');
      document.body.classList.remove('holiday-active');
    };
  }, [currentTheme, holidayStyles, isHolidayThemeActive]);
  
  return <>{children}</>;
}
