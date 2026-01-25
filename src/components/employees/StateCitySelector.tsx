import React, { useState, useMemo, useCallback, forwardRef } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { brazilianStates, getCitiesByState, searchCities, BrazilianCity } from '@/lib/brazilianLocations';

interface StateCitySelectorProps {
  stateValue: string;
  cityValue: string;
  onStateChange: (stateCode: string) => void;
  onCityChange: (cityName: string) => void;
  stateLabel?: string;
  cityLabel?: string;
  required?: boolean;
  disabled?: boolean;
}

export const StateCitySelector = forwardRef<HTMLDivElement, StateCitySelectorProps>(function StateCitySelector({
  stateValue,
  cityValue,
  onStateChange,
  onCityChange,
  stateLabel = 'Estado/UF',
  cityLabel = 'Cidade',
  required = false,
  disabled = false,
}, ref) {
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const filteredCities = useMemo(() => {
    if (!stateValue) return [];
    return citySearch
      ? searchCities(citySearch, stateValue)
      : getCitiesByState(stateValue);
  }, [stateValue, citySearch]);

  const handleStateChange = useCallback((newState: string) => {
    onStateChange(newState === 'none' ? '' : newState);
    onCityChange(''); // Reset city when state changes
    setCitySearch('');
  }, [onStateChange, onCityChange]);

  const handleCitySelect = useCallback((city: string) => {
    onCityChange(city);
    setCityOpen(false);
    setCitySearch('');
  }, [onCityChange]);

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="state">
          {stateLabel} {required && '*'}
        </Label>
        <Select
          value={stateValue || 'none'}
          onValueChange={handleStateChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o estado" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
            <SelectItem value="none">Selecione...</SelectItem>
            {brazilianStates.map((state) => (
              <SelectItem key={state.code} value={state.code}>
                {state.code} - {state.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">
          {cityLabel} {required && '*'}
        </Label>
        <Popover open={cityOpen} onOpenChange={setCityOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={cityOpen}
              disabled={disabled || !stateValue}
              className="w-full justify-between font-normal"
            >
              {cityValue || (stateValue ? 'Buscar cidade...' : 'Selecione o estado primeiro')}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 z-50 bg-background border shadow-lg" align="start">
            <Command>
              <CommandInput
                placeholder="Buscar cidade..."
                value={citySearch}
                onValueChange={setCitySearch}
              />
              <CommandList>
                <CommandEmpty>
                  <div className="flex flex-col items-center py-4 text-muted-foreground">
                    <MapPin className="h-8 w-8 mb-2" />
                    <p>Nenhuma cidade encontrada</p>
                    {citySearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleCitySelect(citySearch)}
                      >
                        Usar "{citySearch}"
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {filteredCities.map((city) => (
                    <CommandItem
                      key={city.name}
                      value={city.name}
                      onSelect={() => handleCitySelect(city.name)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          cityValue === city.name ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {city.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});
