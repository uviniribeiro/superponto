import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  message: string;
  announcement_type: string;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
}

export function AnnouncementPopup() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;

    // Fetch active announcements
    const { data: announcementsData, error: announcementsError } = await supabase
      .from('system_announcements')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', new Date().toISOString())
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });

    if (announcementsError || !announcementsData) return;

    // Fetch dismissed announcements for this user
    const { data: dismissals } = await supabase
      .from('announcement_dismissals')
      .select('announcement_id')
      .eq('user_id', user.id);

    const dismissedIds = new Set((dismissals || []).map(d => d.announcement_id));
    
    // Filter out dismissed announcements
    const activeAnnouncements = announcementsData.filter(a => !dismissedIds.has(a.id));
    
    setAnnouncements(activeAnnouncements);
    if (activeAnnouncements.length > 0) {
      setOpen(true);
      setCurrentIndex(0);
    }
  }, [user]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleDismiss = async () => {
    if (!user || announcements.length === 0) return;
    
    const currentAnnouncement = announcements[currentIndex];
    
    // Record dismissal
    await supabase
      .from('announcement_dismissals')
      .insert({
        announcement_id: currentAnnouncement.id,
        user_id: user.id,
      });

    // Remove from local state
    const newAnnouncements = announcements.filter((_, i) => i !== currentIndex);
    setAnnouncements(newAnnouncements);
    
    if (newAnnouncements.length === 0) {
      setOpen(false);
    } else if (currentIndex >= newAnnouncements.length) {
      setCurrentIndex(newAnnouncements.length - 1);
    }
  };

  const handleDismissAll = async () => {
    if (!user) return;
    
    // Record all dismissals
    const dismissals = announcements.map(a => ({
      announcement_id: a.id,
      user_id: user.id,
    }));
    
    await supabase.from('announcement_dismissals').insert(dismissals);
    
    setAnnouncements([]);
    setOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'urgent':
        return <AlertTriangle className="h-6 w-6 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      default:
        return <Info className="h-6 w-6 text-primary" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'urgent':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'urgent':
        return 'Urgente';
      case 'warning':
        return 'Atenção';
      default:
        return 'Informativo';
    }
  };

  if (announcements.length === 0) return null;

  const currentAnnouncement = announcements[currentIndex];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getIcon(currentAnnouncement.announcement_type)}
              <div>
                <DialogTitle className="text-lg">{currentAnnouncement.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getBadgeVariant(currentAnnouncement.announcement_type) as any}>
                    {getTypeLabel(currentAnnouncement.announcement_type)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(currentAnnouncement.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        <DialogDescription className="text-sm text-foreground whitespace-pre-wrap py-4">
          {currentAnnouncement.message}
        </DialogDescription>

        {currentAnnouncement.expires_at && (
          <p className="text-xs text-muted-foreground">
            Válido até: {format(new Date(currentAnnouncement.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {announcements.length > 1 && (
            <div className="flex items-center gap-2 mr-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} de {announcements.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentIndex(i => Math.min(announcements.length - 1, i + 1))}
                disabled={currentIndex === announcements.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            {announcements.length > 1 && (
              <Button variant="outline" onClick={handleDismissAll}>
                <X className="h-4 w-4 mr-2" />
                Dispensar Todos
              </Button>
            )}
            <Button onClick={handleDismiss}>
              Entendido
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
