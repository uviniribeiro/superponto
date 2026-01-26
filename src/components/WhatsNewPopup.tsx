import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLatestChangelog, APP_VERSION } from '@/lib/version';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, CheckCircle2, Rocket, PartyPopper } from 'lucide-react';

const STORAGE_KEY = 'superponto_last_seen_version';

export function WhatsNewPopup() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const changelog = getLatestChangelog();

  useEffect(() => {
    if (!user) return;

    const lastSeenVersion = localStorage.getItem(STORAGE_KEY);
    
    // Show popup if user hasn't seen this version yet
    if (lastSeenVersion !== APP_VERSION) {
      // Small delay to allow other popups to load first
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
    setOpen(false);
  };

  if (!changelog) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/50 rounded-full blur opacity-75 animate-pulse" />
              <div className="relative bg-background p-4 rounded-full">
                <PartyPopper className="h-10 w-10 text-primary" />
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <DialogTitle className="text-xl">O que há de novo!</DialogTitle>
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
            <DialogDescription className="text-base">
              Versão {changelog.version} • {new Date(changelog.date).toLocaleDateString('pt-BR')}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">{changelog.title}</h3>
            <Badge variant={changelog.type === 'major' ? 'default' : changelog.type === 'minor' ? 'secondary' : 'outline'}>
              {changelog.type === 'major' ? 'Major' : changelog.type === 'minor' ? 'Minor' : 'Patch'}
            </Badge>
          </div>

          <ScrollArea className="h-[200px] pr-4">
            <ul className="space-y-3">
              {changelog.changes.map((change, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{change}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full gradient-primary text-white font-medium">
            <Sparkles className="h-4 w-4 mr-2" />
            Entendi, vamos começar!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
