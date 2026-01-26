import { useMemo } from 'react';
import { addDays, subDays, isWithinInterval, getYear, differenceInBusinessDays, isBefore, isAfter } from 'date-fns';

export type HolidayTheme = 
  | 'default' 
  | 'carnival' 
  | 'easter' 
  | 'labor_day' 
  | 'corpus_christi' 
  | 'independence' 
  | 'christmas' 
  | 'new_year';

interface HolidayConfig {
  name: string;
  theme: HolidayTheme;
  getDate: (year: number) => Date;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    gradient: string;
  };
  emoji: string;
}

// Calculate Easter date using Anonymous Gregorian algorithm
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Calculate Carnival date (47 days before Easter)
function calculateCarnival(year: number): Date {
  const easter = calculateEaster(year);
  return subDays(easter, 47);
}

// Calculate Corpus Christi (60 days after Easter)
function calculateCorpusChristi(year: number): Date {
  const easter = calculateEaster(year);
  return addDays(easter, 60);
}

const holidays: HolidayConfig[] = [
  {
    name: 'Carnaval',
    theme: 'carnival',
    getDate: calculateCarnival,
    colors: {
      primary: '280 85% 50%', // Purple
      secondary: '45 100% 50%', // Yellow/Gold
      accent: '150 80% 45%', // Green
      gradient: 'linear-gradient(135deg, hsl(280, 85%, 50%), hsl(45, 100%, 50%), hsl(150, 80%, 45%))'
    },
    emoji: '🎭'
  },
  {
    name: 'Páscoa',
    theme: 'easter',
    getDate: calculateEaster,
    colors: {
      primary: '280 60% 65%', // Lavender
      secondary: '45 100% 70%', // Light Yellow
      accent: '150 70% 60%', // Soft Green
      gradient: 'linear-gradient(135deg, hsl(280, 60%, 65%), hsl(45, 100%, 70%))'
    },
    emoji: '🐰'
  },
  {
    name: 'Dia do Trabalhador',
    theme: 'labor_day',
    getDate: (year) => new Date(year, 4, 1), // May 1st
    colors: {
      primary: '0 70% 50%', // Red
      secondary: '45 100% 50%', // Yellow
      accent: '220 70% 50%', // Blue
      gradient: 'linear-gradient(135deg, hsl(0, 70%, 50%), hsl(45, 100%, 50%))'
    },
    emoji: '⚒️'
  },
  {
    name: 'Corpus Christi',
    theme: 'corpus_christi',
    getDate: calculateCorpusChristi,
    colors: {
      primary: '45 100% 50%', // Gold
      secondary: '0 0% 100%', // White
      accent: '280 80% 60%', // Purple
      gradient: 'linear-gradient(135deg, hsl(45, 100%, 50%), hsl(280, 80%, 60%))'
    },
    emoji: '✝️'
  },
  {
    name: 'Independência do Brasil',
    theme: 'independence',
    getDate: (year) => new Date(year, 8, 7), // September 7th
    colors: {
      primary: '120 80% 35%', // Green
      secondary: '45 100% 50%', // Yellow
      accent: '220 70% 50%', // Blue
      gradient: 'linear-gradient(135deg, hsl(120, 80%, 35%), hsl(45, 100%, 50%))'
    },
    emoji: '🇧🇷'
  },
  {
    name: 'Natal',
    theme: 'christmas',
    getDate: (year) => new Date(year, 11, 25), // December 25th
    colors: {
      primary: '0 80% 45%', // Red
      secondary: '120 80% 30%', // Green
      accent: '45 100% 50%', // Gold
      gradient: 'linear-gradient(135deg, hsl(0, 80%, 45%), hsl(120, 80%, 30%))'
    },
    emoji: '🎄'
  },
  {
    name: 'Ano Novo',
    theme: 'new_year',
    getDate: (year) => new Date(year, 0, 1), // January 1st
    colors: {
      primary: '45 100% 50%', // Gold
      secondary: '0 0% 15%', // Near Black
      accent: '210 100% 60%', // Blue
      gradient: 'linear-gradient(135deg, hsl(45, 100%, 50%), hsl(210, 100%, 60%))'
    },
    emoji: '🎆'
  }
];

// Count business days after a date (excluding weekends)
function countBusinessDaysAfter(holidayDate: Date, currentDate: Date): number {
  if (isBefore(currentDate, holidayDate)) return -1;
  return differenceInBusinessDays(currentDate, holidayDate);
}

export function useHolidayTheme() {
  const now = new Date();
  const currentYear = getYear(now);
  
  const activeHoliday = useMemo(() => {
    // Check current year and next year for holidays
    const yearsToCheck = [currentYear, currentYear + 1, currentYear - 1];
    
    for (const year of yearsToCheck) {
      for (const holiday of holidays) {
        const holidayDate = holiday.getDate(year);
        
        // Theme starts 20 days before
        const themeStartDate = subDays(holidayDate, 20);
        
        // Theme ends 3 business days after
        // We need to find the actual date that is 3 business days after
        let endDate = holidayDate;
        let businessDaysCount = 0;
        while (businessDaysCount < 3) {
          endDate = addDays(endDate, 1);
          const dayOfWeek = endDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            businessDaysCount++;
          }
        }
        
        // Check if current date is within the theme period
        if (isWithinInterval(now, { start: themeStartDate, end: endDate })) {
          return {
            ...holiday,
            holidayDate,
            themeStartDate,
            themeEndDate: endDate,
            daysUntilHoliday: Math.ceil((holidayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
            isActive: true
          };
        }
      }
    }
    
    return null;
  }, [currentYear, now.toDateString()]);
  
  return {
    currentTheme: activeHoliday?.theme || 'default',
    holidayName: activeHoliday?.name || null,
    holidayEmoji: activeHoliday?.emoji || null,
    holidayColors: activeHoliday?.colors || null,
    daysUntilHoliday: activeHoliday?.daysUntilHoliday || null,
    isHolidayThemeActive: !!activeHoliday,
    holidayDate: activeHoliday?.holidayDate || null
  };
}
