import { useCallback, useEffect, useRef, useState } from 'react';

export type GeolocationErrorKind =
  | 'unsupported'
  | 'insecure_context'
  | 'permission_denied'
  | 'unavailable'
  | 'timeout'
  | 'unknown';

export interface GeolocationErrorInfo {
  kind: GeolocationErrorKind;
  title: string;
  message: string;
  hint: string;
}

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  address: string | null;
  isLoading: boolean;
  isResolvingAddress: boolean;
  error: GeolocationErrorInfo | null;
  permission: PermissionState | 'unknown';
  lastUpdatedAt: Date | null;
}

const ERRORS: Record<GeolocationErrorKind, Omit<GeolocationErrorInfo, 'kind'>> = {
  unsupported: {
    title: 'Geolocalização não suportada',
    message: 'Este navegador não oferece suporte à localização.',
    hint: 'Use um navegador atualizado (Chrome, Edge, Safari ou Firefox) ou o aplicativo móvel.',
  },
  insecure_context: {
    title: 'Conexão não segura',
    message: 'A localização só funciona em páginas HTTPS.',
    hint: 'Acesse o sistema pelo endereço https:// e tente novamente.',
  },
  permission_denied: {
    title: 'Permissão de localização negada',
    message: 'O acesso à sua localização foi bloqueado para este site.',
    hint: 'Clique no cadeado ao lado do endereço, permita "Localização" e toque em "Tentar novamente".',
  },
  unavailable: {
    title: 'Localização indisponível',
    message: 'Não foi possível obter o sinal de GPS/rede neste momento.',
    hint: 'Verifique se o GPS do aparelho está ligado, vá para um local aberto e tente novamente.',
  },
  timeout: {
    title: 'Tempo esgotado ao obter localização',
    message: 'O aparelho demorou demais para responder com as coordenadas.',
    hint: 'Toque em "Tentar novamente". Em ambientes fechados o sinal pode demorar mais.',
  },
  unknown: {
    title: 'Erro ao obter localização',
    message: 'Ocorreu uma falha inesperada ao consultar a localização.',
    hint: 'Tente novamente. Se persistir, reinicie o navegador ou use outro dispositivo.',
  },
};

const buildError = (kind: GeolocationErrorKind): GeolocationErrorInfo => ({
  kind,
  ...ERRORS[kind],
});

interface Options {
  /** busca o endereço via Nominatim (OpenStreetMap) */
  resolveAddress?: boolean;
  /** inicia a captura automaticamente */
  auto?: boolean;
}

export function useGeolocation({ resolveAddress = true, auto = true }: Options = {}) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    address: null,
    isLoading: auto,
    isResolvingAddress: false,
    error: null,
    permission: 'unknown',
    lastUpdatedAt: null,
  });

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Monitora o estado da permissão (quando suportado)
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const handler = () => {
      if (status && mounted.current) {
        setState((prev) => ({ ...prev, permission: status!.state }));
      }
    };
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        status = result;
        if (mounted.current) setState((prev) => ({ ...prev, permission: result.state }));
        result.addEventListener('change', handler);
      })
      .catch(() => { /* navegador sem Permissions API */ });

    return () => status?.removeEventListener('change', handler);
  }, []);

  const fetchAddress = useCallback(async (latitude: number, longitude: number) => {
    setState((prev) => ({ ...prev, isResolvingAddress: true }));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`,
        { signal: controller.signal, headers: { Accept: 'application/json' } }
      );
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (mounted.current) {
        setState((prev) => ({
          ...prev,
          address: data?.display_name || null,
          isResolvingAddress: false,
        }));
      }
    } catch {
      // Endereço é complementar: falha aqui não impede o registro
      if (mounted.current) setState((prev) => ({ ...prev, isResolvingAddress: false }));
    }
  }, []);

  const request = useCallback(
    (highAccuracy = true) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setState((prev) => ({ ...prev, isLoading: false, error: buildError('unsupported') }));
        return;
      }
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setState((prev) => ({ ...prev, isLoading: false, error: buildError('insecure_context') }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!mounted.current) return;
          const { latitude, longitude, accuracy } = position.coords;
          setState((prev) => ({
            ...prev,
            latitude,
            longitude,
            accuracy: accuracy ?? null,
            isLoading: false,
            error: null,
            lastUpdatedAt: new Date(),
          }));
          if (resolveAddress) fetchAddress(latitude, longitude);
        },
        (error) => {
          if (!mounted.current) return;
          // Timeout ou indisponibilidade com alta precisão: tenta de novo em baixa precisão
          if (highAccuracy && error.code !== error.PERMISSION_DENIED) {
            request(false);
            return;
          }
          const kind: GeolocationErrorKind =
            error.code === error.PERMISSION_DENIED
              ? 'permission_denied'
              : error.code === error.POSITION_UNAVAILABLE
              ? 'unavailable'
              : error.code === error.TIMEOUT
              ? 'timeout'
              : 'unknown';
          setState((prev) => ({ ...prev, isLoading: false, error: buildError(kind) }));
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 12000 : 25000,
          maximumAge: highAccuracy ? 0 : 60000,
        }
      );
    },
    [fetchAddress, resolveAddress]
  );

  useEffect(() => {
    if (auto) request(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return { ...state, refresh: () => request(true) };
}
