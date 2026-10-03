interface FloatingConciergeBadgeProps {
  number?: string;
  label?: string;
  className?: string;
}

export function FloatingConciergeBadge({
  number = '01',
  label = 'CONCIERGE • SELECTION',
  className = '',
}: FloatingConciergeBadgeProps) {
  return (
    <div
      className={`w-[150px] h-[150px] rounded-full bg-ds-chrome/90 border border-ds-chrome-accent/40 text-ds-chrome-text flex flex-col items-center justify-center shadow-xl shadow-black/40 select-none pointer-events-auto transition-transform duration-200 ease-out hover:scale-105 active:scale-95 group ${className}`}
    >
      <div className="w-[134px] h-[134px] rounded-full border border-dashed border-ds-chrome-accent/30 flex flex-col items-center justify-center p-3 text-center">
        <span className="text-2xl italic text-ds-chrome-accent leading-none mb-1 group-hover:text-ds-chrome-text transition-colors">
          {number}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ds-chrome-muted text-center leading-tight">
          {label}
        </span>
        <div className="w-4 h-0.5 bg-ds-chrome-accent/60 rounded-full mt-1.5" />
      </div>
    </div>
  );
}
