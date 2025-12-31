import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: string;
  type: 'equipment_offline' | 'equipment_reconnected' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  equipmentId?: string;
  equipmentName?: string;
}

// Store notifications in memory (could be persisted to localStorage or database)
let notificationsState: Notification[] = [];
let notifiedOfflineEquipment: Set<string> = new Set();

export function useNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(notificationsState);
  const [unreadCount, setUnreadCount] = useState(0);

  // Sync state
  useEffect(() => {
    setNotifications(notificationsState);
    setUnreadCount(notificationsState.filter(n => !n.read).length);
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      read: false,
    };
    
    notificationsState = [newNotification, ...notificationsState].slice(0, 50); // Keep last 50
    setNotifications([...notificationsState]);
    setUnreadCount(notificationsState.filter(n => !n.read).length);
  }, []);

  const markAsRead = useCallback((id: string) => {
    notificationsState = notificationsState.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications([...notificationsState]);
    setUnreadCount(notificationsState.filter(n => !n.read).length);
  }, []);

  const markAllAsRead = useCallback(() => {
    notificationsState = notificationsState.map(n => ({ ...n, read: true }));
    setNotifications([...notificationsState]);
    setUnreadCount(0);
  }, []);

  const clearNotification = useCallback((id: string) => {
    notificationsState = notificationsState.filter(n => n.id !== id);
    setNotifications([...notificationsState]);
    setUnreadCount(notificationsState.filter(n => !n.read).length);
  }, []);

  const clearAll = useCallback(() => {
    notificationsState = [];
    notifiedOfflineEquipment.clear();
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Check equipment offline for more than 2 hours and notify
  const checkEquipmentOfflineNotifications = useCallback(async () => {
    if (!profile) return;

    const { data: equipments } = await supabase
      .from('time_clock_equipment')
      .select('id, name, is_online, is_active, last_communication')
      .eq('is_active', true);

    if (!equipments) return;

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    equipments.forEach(eq => {
      const lastComm = eq.last_communication ? new Date(eq.last_communication) : null;
      const isOfflineTooLong = !eq.is_online && lastComm && lastComm < twoHoursAgo;

      if (isOfflineTooLong && !notifiedOfflineEquipment.has(eq.id)) {
        // Notify about this equipment being offline too long
        addNotification({
          type: 'equipment_offline',
          title: 'Equipamento Offline',
          message: `${eq.name} está offline há mais de 2 horas`,
          equipmentId: eq.id,
          equipmentName: eq.name,
        });
        notifiedOfflineEquipment.add(eq.id);
      } else if (eq.is_online && notifiedOfflineEquipment.has(eq.id)) {
        // Equipment came back online, remove from notified set
        notifiedOfflineEquipment.delete(eq.id);
        addNotification({
          type: 'equipment_reconnected',
          title: 'Equipamento Reconectado',
          message: `${eq.name} voltou a ficar online`,
          equipmentId: eq.id,
          equipmentName: eq.name,
        });
      }
    });
  }, [profile, addNotification]);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    checkEquipmentOfflineNotifications,
  };
}
