// Application version configuration
export const APP_VERSION = '1.0.0';
export const APP_BUILD_DATE = '2026-01-02';
export const APP_NAME = 'PontoMax';

// Version display format
export const getVersionString = () => {
  return `v${APP_VERSION}`;
};

export const getFullVersionInfo = () => {
  return {
    version: APP_VERSION,
    buildDate: APP_BUILD_DATE,
    name: APP_NAME,
    displayString: `${APP_NAME} v${APP_VERSION}`
  };
};
