import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { differenceInDays, format, isPast, isToday } from "date-fns";
import {
    AlertTriangle,
    ArrowRight,
    Calendar,
    CheckCircle2,
    Clock,
    X,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

type ExpiryWarningLevel = "critical" | "warning" | "notice" | "expired";

interface DocumentExpiryInfo {
  id: string;
  title: string;
  expiryDate: string;
  documentNumber?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
}

interface DocumentExpiryBannerProps {
  documents: DocumentExpiryInfo[];
  warningThresholds?: {
    critical: number; // days (default: 1)
    warning: number; // days (default: 7)
    notice: number; // days (default: 30)
  };
  onExtend?: (documentId: string, newDate: Date) => void;
  onDismiss?: (documentId: string) => void;
  onViewDocument?: (documentId: string) => void;
  maxDisplay?: number;
  className?: string;
}

function getExpiryStatus(
  expiryDate: string,
  thresholds: { critical: number; warning: number; notice: number }
): { level: ExpiryWarningLevel; daysRemaining: number; message: string } {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysRemaining = differenceInDays(expiry, now);

  if (isPast(expiry) && !isToday(expiry)) {
    return {
      level: "expired",
      daysRemaining: Math.abs(daysRemaining),
      message: `Expired ${Math.abs(daysRemaining)} days ago`,
    };
  }

  if (isToday(expiry)) {
    return {
      level: "critical",
      daysRemaining: 0,
      message: "Expires today",
    };
  }

  if (daysRemaining <= thresholds.critical) {
    return {
      level: "critical",
      daysRemaining,
      message: `Expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`,
    };
  }

  if (daysRemaining <= thresholds.warning) {
    return {
      level: "warning",
      daysRemaining,
      message: `Expires in ${daysRemaining} days`,
    };
  }

  if (daysRemaining <= thresholds.notice) {
    return {
      level: "notice",
      daysRemaining,
      message: `Expires in ${daysRemaining} days`,
    };
  }

  return {
    level: "notice",
    daysRemaining,
    message: `Expires in ${daysRemaining} days`,
  };
}

function getStatusStyles(level: ExpiryWarningLevel) {
  switch (level) {
    case "expired":
      return {
        container: "bg-ds-danger-soft border-ds-danger/30 text-ds-danger",
        icon: "text-ds-danger",
        badge: "bg-ds-danger-soft text-ds-danger border-ds-danger/30",
        button: "bg-ds-danger hover:bg-ds-danger text-white",
      };
    case "critical":
      return {
        container: "bg-ds-danger-soft/80 border-ds-danger/30 text-ds-danger",
        icon: "text-ds-danger",
        badge: "bg-ds-danger-soft text-ds-danger border-ds-danger/30",
        button: "bg-ds-danger hover:bg-ds-danger text-white",
      };
    case "warning":
      return {
        container: "bg-ds-warning-soft border-ds-warning/30 text-ds-warning",
        icon: "text-ds-warning",
        badge: "bg-ds-warning-soft text-ds-warning border-ds-warning/30",
        button: "bg-ds-warning hover:bg-ds-warning text-white dark:text-ds-on-ink",
      };
    case "notice":
      return {
        container: "bg-ds-info-soft border-ds-info/30 text-ds-info",
        icon: "text-ds-info",
        badge: "bg-ds-info-soft text-ds-info border-ds-info/30",
        button: "bg-ds-info hover:bg-ds-info text-white dark:text-ds-on-ink",
      };
  }
}

export function DocumentExpiryBanner({
  documents,
  warningThresholds = { critical: 1, warning: 7, notice: 30 },
  onExtend,
  onDismiss,
  onViewDocument,
  maxDisplay = 3,
  className,
}: DocumentExpiryBannerProps) {
  const [dismissedIds, setDismissedIds] = React.useState<string[]>([]);
  const [extendDialogOpen, setExtendDialogOpen] = React.useState(false);
  const [selectedDocument, setSelectedDocument] =
    React.useState<DocumentExpiryInfo | null>(null);
  const [newExpiryDate, setNewExpiryDate] = React.useState<Date>();
  const [showAll, setShowAll] = React.useState(false);
  const { t } = useTranslation();

  // Filter out dismissed and sort by urgency
  const activeDocuments = documents
    .filter((doc) => !dismissedIds.includes(doc.id))
    .map((doc) => ({
      ...doc,
      status: getExpiryStatus(doc.expiryDate, warningThresholds),
    }))
    .sort((a, b) => a.status.daysRemaining - b.status.daysRemaining);

  const displayedDocuments = showAll
    ? activeDocuments
    : activeDocuments.slice(0, maxDisplay);
  const remainingCount = activeDocuments.length - maxDisplay;

  const handleDismiss = (e: React.MouseEvent, documentId: string) => {
    e.stopPropagation();
    setDismissedIds((prev) => [...prev, documentId]);
    onDismiss?.(documentId);
  };

  const handleExtendClick = (e: React.MouseEvent, doc: DocumentExpiryInfo) => {
    e.stopPropagation();
    setSelectedDocument(doc);
    setNewExpiryDate(new Date(doc.expiryDate));
    setExtendDialogOpen(true);
  };

  const handleExtendSubmit = () => {
    if (selectedDocument && newExpiryDate) {
      onExtend?.(selectedDocument.id, newExpiryDate);
      setExtendDialogOpen(false);
      setSelectedDocument(null);
      setNewExpiryDate(undefined);
    }
  };

  if (activeDocuments.length === 0) {
    return null;
  }

  // Group by urgency for summary
  const expiredCount = activeDocuments.filter(
    (d) => d.status.level === "expired"
  ).length;
  const criticalCount = activeDocuments.filter(
    (d) => d.status.level === "critical"
  ).length;
  const warningCount = activeDocuments.filter(
    (d) => d.status.level === "warning"
  ).length;

  const hasUrgent = expiredCount > 0 || criticalCount > 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Summary Banner */}
      {activeDocuments.length > 1 && (
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border",
            hasUrgent
              ? "bg-ds-danger-soft border-ds-danger/30"
              : "bg-ds-warning-soft border-ds-warning/30"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
              hasUrgent ? "bg-ds-danger-soft" : "bg-ds-warning-soft"
            )}
          >
            <Clock
              className={cn(
                "w-5 h-5",
                hasUrgent ? "text-ds-danger" : "text-ds-warning"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "font-medium",
                hasUrgent ? "text-ds-danger" : "text-ds-warning"
              )}
            >
              {activeDocuments.length} documents require attention
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {expiredCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {expiredCount} expired
                </Badge>
              )}
              {criticalCount > 0 && (
                <Badge className="text-xs bg-ds-danger-soft text-ds-danger hover:bg-ds-danger-soft">
                  {criticalCount} critical
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="text-xs bg-ds-warning-soft text-ds-warning hover:bg-ds-warning-soft">
                  {warningCount} warning
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Individual Document Banners */}
      <div className="space-y-2">
        {displayedDocuments.map((doc) => {
          const styles = getStatusStyles(doc.status.level);
          return (
            <div
              key={doc.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-all",
                styles.container,
                onViewDocument && "cursor-pointer hover:shadow-sm"
              )}
              onClick={() => onViewDocument?.(doc.id)}
            >
              <AlertTriangle className={cn("w-5 h-5 shrink-0", styles.icon)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{doc.title}</span>
                  {doc.documentNumber && (
                    <Badge variant="outline" className="text-xs">
                      {doc.documentNumber}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-sm opacity-80">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(doc.expiryDate), "MMM d, yyyy")}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", styles.badge)}
                  >
                    {doc.status.message}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn("h-8 gap-1.5", styles.badge)}
                  onClick={(e) => handleExtendClick(e, doc)}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Extend
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 opacity-60 hover:opacity-100"
                  onClick={(e) => handleDismiss(e, doc.id)}
                  aria-label={t('accessibility.dismiss_notification', 'Dismiss notification')}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Show More/Less */}
        {activeDocuments.length > maxDisplay && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll
              ? "Show less"
              : `Show ${remainingCount} more document${
                  remainingCount !== 1 ? "s" : ""
                }`}
          </Button>
        )}
      </div>

      {/* Extend Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Extend Expiry Date</DialogTitle>
            <DialogDescription>
              Select a new expiry date for &quot;{selectedDocument?.title}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-start font-normal"
                >
                  <Calendar className="me-2 h-4 w-4" />
                  {newExpiryDate ? (
                    format(newExpiryDate, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={newExpiryDate}
                  onSelect={setNewExpiryDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {newExpiryDate && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-ds-success" />
                Document will expire in{" "}
                {differenceInDays(newExpiryDate, new Date())} days
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExtendDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExtendSubmit}
              disabled={!newExpiryDate}
              className="bg-ds-ink hover:bg-ds-ink/90"
            >
              <CheckCircle2 className="w-4 h-4 me-2" />
              Extend Expiry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simple inline version for document cards
interface DocumentExpiryInlineProps {
  expiryDate: string;
  className?: string;
}
