import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Building2,
    Globe,
    Lock,
    ShieldAlert,
} from "lucide-react";
import * as React from "react";

type ConfidentialityLevel = "public" | "internal" | "confidential" | "restricted";

interface ConfidentialityConfig {
  level: ConfidentialityLevel;
  label: string;
  description: string;
  detailedDescription: string;
  icon;
  color: {
    bg: string;
    text: string;
    border: string;
    hover: string;
  };
  accessDescription: string;
  examples: string[];
}

const CONFIDENTIALITY_CONFIGS: Record<ConfidentialityLevel, ConfidentialityConfig> = {
  public: {
    level: "public",
    label: "Organization-Wide",
    description: "All tenant hotels & staff",
    detailedDescription: "General company-wide document published across all tenant hotels (brand standards, group policies, organization calendar).",
    icon: <Globe className="w-3.5 h-3.5" />,
    color: {
      bg: "bg-ds-surface-subtle",
      text: "text-ds-ink-secondary",
      border: "border-ds-border",
      hover: "hover:bg-ds-border",
    },
    accessDescription: "Organization-Wide (All Hotels)",
    examples: [
      "Tenant Announcements",
      "Brand Guidelines & Standards",
      "Code of Business Conduct",
      "Annual Calendar",
    ],
  },
  internal: {
    level: "internal",
    label: "Hotel-Level",
    description: "Specific hotel & department staff",
    detailedDescription: "Operational standard document accessible only to staff and team members in the assigned hotel property and department.",
    icon: <Building2 className="w-3.5 h-3.5" />,
    color: {
      bg: "bg-ds-info-soft",
      text: "text-ds-info",
      border: "border-ds-info/30",
      hover: "hover:bg-ds-info-soft",
    },
    accessDescription: "Assigned Property Staff",
    examples: [
      "Property Standard Operating Procedures",
      "Department Duty Checklists",
      "Local Supplier Directories",
      "Shift Schedules & Handover Logs",
    ],
  },
  confidential: {
    level: "confidential",
    label: "Management",
    description: "HODs & Supervisors only",
    detailedDescription: "Management-level document containing sensitive operational, financial, or personnel information.",
    icon: <Lock className="w-3.5 h-3.5" />,
    color: {
      bg: "bg-ds-warning-soft",
      text: "text-ds-warning",
      border: "border-ds-warning/30",
      hover: "hover:bg-ds-warning-soft",
    },
    accessDescription: "Department Heads & GMs",
    examples: [
      "P&L Budgets & Department Forecasts",
      "Vendor Contracts & Pricing Agreements",
      "Internal Quality & Compliance Audits",
      "Staff Performance Appraisals",
    ],
  },
  restricted: {
    level: "restricted",
    label: "Executive",
    description: "Corporate leadership & HR/Legal",
    detailedDescription: "Highly restricted document accessible only to Super Admins, Corporate Executives, and designated Legal/HR owners.",
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
    color: {
      bg: "bg-ds-danger-soft",
      text: "text-ds-danger",
      border: "border-ds-danger/30",
      hover: "hover:bg-ds-danger-soft",
    },
    accessDescription: "Executive Leadership Only",
    examples: [
      "Executive Board Memos",
      "Executive Compensation & Payroll",
      "Legal Compliance & Dispute Records",
      "Hotel Acquisition & Strategic Plans",
    ],
  },
};

interface DocumentConfidentialityBadgeProps {
  level: ConfidentialityLevel;
  size?: "sm" | "default" | "lg";
  variant?: "badge" | "pill" | "card" | "dot";
  showTooltip?: boolean;
  showHoverCard?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  sm: {
    badge: "text-[11px] px-1.5 py-0.5 min-h-[20px] gap-1 shrink-0 whitespace-nowrap",
    pill: "text-[11px] px-2 py-0.5 gap-1 shrink-0 whitespace-nowrap",
    card: "p-2 gap-2",
    dot: "w-2 h-2 shrink-0",
  },
  default: {
    badge: "text-xs px-2.5 py-0.5 min-h-[24px] gap-1.5 shrink-0 whitespace-nowrap",
    pill: "text-xs px-3 py-1 gap-1.5 shrink-0 whitespace-nowrap",
    card: "p-3 gap-3",
    dot: "w-2.5 h-2.5 shrink-0",
  },
  lg: {
    badge: "text-sm px-3 py-1 min-h-[28px] gap-2 shrink-0 whitespace-nowrap",
    pill: "text-sm px-4 py-1.5 gap-2 shrink-0 whitespace-nowrap",
    card: "p-4 gap-4",
    dot: "w-3 h-3 shrink-0",
  },
};

function BadgeContent({
  config,
  size,
  variant,
}: {
  config: ConfidentialityConfig;
  size: "sm" | "default" | "lg";
  variant: "badge" | "pill" | "card" | "dot";
}) {
  if (variant === "dot") {
    return (
      <div
        className={cn(
          "rounded-full",
          sizeClasses[size].dot,
          config.level === "public" && "bg-ds-muted",
          config.level === "internal" && "bg-ds-info",
          config.level === "confidential" && "bg-ds-warning",
          config.level === "restricted" && "bg-ds-danger"
        )}
      />
    );
  }

  if (variant === "card") {
    return (
      <div className={cn("flex items-start gap-3", sizeClasses[size].card)}>
        <div
          className={cn(
            "p-2 rounded-lg shrink-0",
            config.color.bg,
            config.color.text
          )}
        >
          {React.cloneElement(config.icon, {
            className: "w-5 h-5",
          })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{config.label}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] border-0",
                config.color.bg,
                config.color.text
              )}
            >
              {config.accessDescription}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {config.description}
          </p>
        </div>
      </div>
    );
  }

  // badge or pill
  return (
    <>
      {config.icon}
      <span>{config.label}</span>
    </>
  );
}

export function DocumentConfidentialityBadge({
  level,
  size = "default",
  variant = "badge",
  showTooltip = true,
  showHoverCard = false,
  className,
  onClick,
}: DocumentConfidentialityBadgeProps) {
  const config = CONFIDENTIALITY_CONFIGS[level];

  const badgeElement = (
    <Badge
      variant="outline"
      className={cn(
        "font-medium transition-colors",
        variant !== "dot" && config.color.bg,
        variant !== "dot" && config.color.text,
        variant !== "dot" && config.color.border,
        variant !== "dot" && config.color.hover,
        sizeClasses[size][variant],
        onClick && "cursor-pointer",
        variant === "pill" && "rounded-full",
        variant === "card" && "block w-full text-start h-auto",
        className
      )}
      onClick={onClick}
    >
      <BadgeContent config={config} size={size} variant={variant} />
    </Badge>
  );

  // Tooltip/HoverCard wrappers are optional; if their UI components are not present,
  // we still render a functional badge.
  void showTooltip;
  void showHoverCard;
  return badgeElement;
}

// Selector component for forms
interface ConfidentialitySelectorProps {
  value?: ConfidentialityLevel;
  onChange: (level: ConfidentialityLevel) => void;
  className?: string;
}

// Legend component for displaying all levels
interface ConfidentialityLegendProps {
  className?: string;
}

// Compact indicator for lists
interface ConfidentialityIndicatorProps {
  level: ConfidentialityLevel;
  showLabel?: boolean;
  className?: string;
}

export default DocumentConfidentialityBadge;
