import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function useBrasiliaTime() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format for Brasília timezone (UTC-3)
  const formatBrasiliaTime = () => {
    return dateTime.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getFormattedDate = () => {
    // Format as DD/MM/YYYY
    return dateTime.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getFormattedDateFull = () => {
    return dateTime.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getFormattedTime = () => {
    // Format as HH:MM:SS
    return dateTime.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getFormattedTimeShort = () => {
    // Format as HH:MM (without seconds)
    return dateTime.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFormattedDateTime = () => {
    // Format as DD/MM/YYYY, HH:MM:SS
    const date = getFormattedDate();
    const time = getFormattedTime();
    return `${date}, ${time}`;
  };

  return {
    dateTime,
    formatBrasiliaTime,
    getFormattedDate,
    getFormattedDateFull,
    getFormattedTime,
    getFormattedTimeShort,
    getFormattedDateTime
  };
}
