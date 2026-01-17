import { useState, useEffect, useCallback } from 'react';

export type ScreenOrientation = 'landscape' | 'portrait';
export type ScreenSize = 'mobile' | 'tablet' | 'desktop' | 'desktop-xl';

interface ScreenInfo {
  width: number;
  height: number;
  orientation: ScreenOrientation;
  size: ScreenSize;
  isLandscape: boolean;
  isPortrait: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  is1080p: boolean;
  is1080pPortrait: boolean;
  is1920x1080: boolean;
  is1080x1920: boolean;
  aspectRatio: number;
  pixelDensity: number;
}

export function useScreenSize(): ScreenInfo {
  const getScreenInfo = useCallback((): ScreenInfo => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const orientation: ScreenOrientation = width >= height ? 'landscape' : 'portrait';
    
    // Determine size category
    let size: ScreenSize;
    if (width < 640) {
      size = 'mobile';
    } else if (width < 1024) {
      size = 'tablet';
    } else if (width < 1440) {
      size = 'desktop';
    } else {
      size = 'desktop-xl';
    }

    // Check for specific resolutions (with tolerance of 50px)
    const is1920x1080 = (width >= 1870 && width <= 1970) && (height >= 1030 && height <= 1130);
    const is1080x1920 = (width >= 1030 && width <= 1130) && (height >= 1870 && height <= 1970);

    return {
      width,
      height,
      orientation,
      size,
      isLandscape: orientation === 'landscape',
      isPortrait: orientation === 'portrait',
      isMobile: size === 'mobile',
      isTablet: size === 'tablet',
      isDesktop: size === 'desktop' || size === 'desktop-xl',
      is1080p: is1920x1080 || is1080x1920,
      is1080pPortrait: is1080x1920,
      is1920x1080,
      is1080x1920,
      aspectRatio: width / height,
      pixelDensity: window.devicePixelRatio || 1,
    };
  }, []);

  const [screenInfo, setScreenInfo] = useState<ScreenInfo>(getScreenInfo);

  useEffect(() => {
    const handleResize = () => {
      setScreenInfo(getScreenInfo());
    };

    // Use ResizeObserver for more accurate tracking
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(document.documentElement);

    // Also listen to orientation changes
    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, [getScreenInfo]);

  return screenInfo;
}

// CSS classes based on screen size
export function getResponsiveClasses(screen: ScreenInfo): string {
  const classes: string[] = [];
  
  if (screen.is1920x1080) {
    classes.push('screen-1920x1080');
  }
  if (screen.is1080x1920) {
    classes.push('screen-1080x1920');
  }
  if (screen.isPortrait) {
    classes.push('screen-portrait');
  }
  if (screen.isLandscape) {
    classes.push('screen-landscape');
  }
  
  return classes.join(' ');
}
