import { useState, useEffect, useCallback } from 'react';

export type MenuPosition = 'left' | 'right' | 'top' | 'bottom';

interface MenuPositionState {
  position: MenuPosition;
  setPosition: (position: MenuPosition) => void;
  isHorizontal: boolean;
  isVertical: boolean;
}

const STORAGE_KEY = 'pontomax-menu-position';

export function useMenuPosition(): MenuPositionState {
  const [position, setPositionState] = useState<MenuPosition>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['left', 'right', 'top', 'bottom'].includes(stored)) {
      return stored as MenuPosition;
    }
    return 'left';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, position);
  }, [position]);

  const setPosition = useCallback((newPosition: MenuPosition) => {
    setPositionState(newPosition);
  }, []);

  const isHorizontal = position === 'top' || position === 'bottom';
  const isVertical = position === 'left' || position === 'right';

  return {
    position,
    setPosition,
    isHorizontal,
    isVertical,
  };
}
