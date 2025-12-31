import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const MAX_RECENT_ROUTES = 5;

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load favorites from database
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('favorite_routes, last_visited_routes')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setFavorites(data.favorite_routes || []);
        setRecentRoutes(data.last_visited_routes || []);
      }
      setLoading(false);
    };

    loadPreferences();
  }, [user]);

  const saveToDatabase = useCallback(async (newFavorites: string[], newRecent: string[]) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_preferences')
        .update({ 
          favorite_routes: newFavorites,
          last_visited_routes: newRecent
        })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_preferences')
        .insert({ 
          user_id: user.id, 
          favorite_routes: newFavorites,
          last_visited_routes: newRecent
        });
    }
  }, [user]);

  const toggleFavorite = useCallback(async (route: string) => {
    const newFavorites = favorites.includes(route)
      ? favorites.filter(f => f !== route)
      : [...favorites, route];
    
    setFavorites(newFavorites);
    await saveToDatabase(newFavorites, recentRoutes);
  }, [favorites, recentRoutes, saveToDatabase]);

  const isFavorite = useCallback((route: string) => {
    return favorites.includes(route);
  }, [favorites]);

  const addRecentRoute = useCallback(async (route: string) => {
    // Skip home and auth routes
    if (route === '/home' || route === '/auth' || route.startsWith('/category')) return;

    const newRecent = [
      route,
      ...recentRoutes.filter(r => r !== route)
    ].slice(0, MAX_RECENT_ROUTES);

    setRecentRoutes(newRecent);
    await saveToDatabase(favorites, newRecent);
  }, [favorites, recentRoutes, saveToDatabase]);

  return {
    favorites,
    recentRoutes,
    loading,
    toggleFavorite,
    isFavorite,
    addRecentRoute
  };
}
