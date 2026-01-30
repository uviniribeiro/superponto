import { useHolidayTheme, HolidayTheme } from '@/hooks/useHolidayTheme';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Get decorative emojis for each holiday
const getHolidayDecorations = (theme: HolidayTheme): string[] => {
  switch (theme) {
    case 'carnival':
      return ['🎭', '🎊', '🎉', '💃', '🪇', '🎺', '🥁'];
    case 'easter':
      return ['🐰', '🥚', '🌸', '🐣', '🌷', '🦋', '🌼'];
    case 'labor_day':
      return ['⚒️', '🔧', '✊', '💪', '🏭', '⚙️', '🛠️'];
    case 'corpus_christi':
      return ['✝️', '🕊️', '⭐', '🙏', '🌾', '🌿', '💫'];
    case 'independence':
      return ['🇧🇷', '💚', '💛', '🎆', '⭐', '🎇', '✨'];
    case 'christmas':
      return ['🎄', '🎅', '⭐', '🎁', '❄️', '🔔', '🤶'];
    case 'new_year':
      return ['🎆', '🎇', '✨', '🥂', '🎉', '🍾', '⭐'];
    default:
      return [];
  }
};

export function HolidayBanner() {
  const { isHolidayThemeActive, holidayName, holidayEmoji, daysUntilHoliday, holidayColors, currentTheme } = useHolidayTheme();
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

  const decorations = getHolidayDecorations(currentTheme);
  
  return (
    <div 
      className={cn(
        "relative overflow-hidden py-2.5 px-4 text-center text-sm font-medium text-white",
        "shadow-lg"
      )}
      style={{ 
        background: holidayColors?.gradient || 'hsl(var(--primary))'
      }}
    >
      {/* Animated decorative elements on larger screens */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
        {decorations.map((emoji, index) => (
          <span
            key={index}
            className="absolute text-xl opacity-30 animate-pulse"
            style={{
              left: `${(index * 15) + 5}%`,
              top: index % 2 === 0 ? '10%' : '60%',
              animationDelay: `${index * 0.2}s`,
              animationDuration: `${2 + (index * 0.3)}s`
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
      
      <div className="relative flex items-center justify-center gap-2 z-10">
        <span className="text-lg animate-bounce" style={{ animationDuration: '2s' }}>
          {holidayEmoji}
        </span>
        <span className="font-semibold tracking-wide">{getMessage()}</span>
        <span className="text-lg animate-bounce" style={{ animationDuration: '2s', animationDelay: '0.5s' }}>
          {holidayEmoji}
        </span>
      </div>
      
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/20 transition-colors z-20"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
