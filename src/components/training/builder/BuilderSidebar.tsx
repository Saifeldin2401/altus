import { cn } from '@/lib/utils'

interface BuilderSidebarProps {
  className?: string
  children?: React.ReactNode
}

export const BuilderSidebar = ({ className, children }: BuilderSidebarProps) => {
  return (
    <aside
      className={cn(
        "w-[260px] xl:w-[280px] shrink-0 border-s border-ds-border bg-ds-surface-subtle/40 flex flex-col h-full overflow-y-auto overflow-x-hidden",
        className
      )}
    >
      <div className="w-full min-w-0">
        {children}
      </div>
    </aside>
  )
}
