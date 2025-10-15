'use client';

import React from 'react';

// components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCopyToClipboard } from '@/hooks';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShareSecretDialogProps {
  shareDialogOpen: boolean;
  setShareDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  shareUrl: string;
}

export const ShareSecretDialog: React.FC<ShareSecretDialogProps> = ({
  shareDialogOpen,
  setShareDialogOpen,
  shareUrl,
}) => {
  const { copyToClipboard } = useCopyToClipboard();

  return (
    <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Secrets</DialogTitle>
          <DialogDescription>
            Share this link to give read-only access to your project secrets. Anyone with this link
            and proper access can read the secrets.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4">
          <div className="bg-muted flex items-center gap-2 rounded-md border p-2">
            <Input
              readOnly
              value={shareUrl}
              className="flex-1 rounded-sm border-none bg-transparent font-mono text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await copyToClipboard(shareUrl);
                toast.success('Link copied to clipboard');
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
