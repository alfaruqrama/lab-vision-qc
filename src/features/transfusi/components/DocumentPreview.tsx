import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driveUrl: string | null;
  bagNumber: string;
  title?: string;
}

export default function DocumentPreview({ open, onOpenChange, driveUrl, bagNumber, title }: Props) {
  const displayTitle = title || `Dokumen ${bagNumber}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{displayTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-lg overflow-hidden bg-muted">
          {driveUrl ? (
            <iframe
              src={`https://drive.google.com/file/d/${extractFileId(driveUrl)}/preview`}
              className="w-full h-full"
              title={displayTitle}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              PDF belum tersedia di Drive
            </div>
          )}
        </div>

        {driveUrl && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(driveUrl, '_blank')}
            >
              <ExternalLink size={14} className="mr-1" />
              Buka di Drive
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function extractFileId(url: string): string {
  // Handle various Google Drive URL formats
  const match = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
  return match?.[1] || url;
}
