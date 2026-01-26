import { useHolidayTheme } from '@/hooks/useHolidayTheme';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

export function HolidayBanner() {
  const { isHolidayThemeActive, holidayName, holidayEmoji, daysUntilHoliday, holidayColors } = useHolidayTheme();
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Reset dismissal when holiday changes
  useEffect(() => {
    const storedHoliday = localStorage.getItem('superponto_dismissed_holiday');
    if (storedHoliday !== holidayName) {
      setIsDismissed(false);
    } else {
      setIsDismissed(true);
    }
  }, [holidayName]);
  
  if (!isHolidayThemeActive || isDismissed || !holidayName) {
    return null;
  }
  
  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('superponto_dismissed_holiday', holidayName);
  };
  
  const getMessage = () => {
    if (daysUntilHoliday === null) return '';
    
    if (daysUntilHoliday > 0) {
      return `Faltam ${daysUntilHoliday} dias para o ${holidayName}!`;
    } else if (daysUntilHoliday === 0) {
      return `Hoje é ${holidayName}! ${holidayEmoji}`;
    } else {
      return `Esperamos que você tenha aproveitado o ${holidayName}!`;
    }
  };
  
  return (
    <div 
      className="relative overflow-hidden py-2 px-4 text-center text-sm font-medium text-white"
      style={{ 
        background: holidayColors?.gradient || 'hsl(var(--primary))'
      }}
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg">{holidayEmoji}</span>
        <span>{getMessage()}</span>
        <span className="text-lg">{holidayEmoji}</span>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
