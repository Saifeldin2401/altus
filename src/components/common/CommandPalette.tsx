import { useDebounce } from '@/hooks/useDebounce'
import { useNavigation } from '@/hooks/useNavigation'
import { useSearch } from '@/hooks/useSearch'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  ArrowRightLeft,
  Award,
  BookOpen,
  Compass,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Settings,
  User
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const RESULT_ICON: Record<string, typeof FileText> = {
  document: FileText,
  user: User,
  training: GraduationCap,
  announcement: Megaphone,
  sop: BookOpen,
  page: LayoutDashboard,
  certificate: Award,
  course: Compass,
}

/**
 * Cmd/Ctrl+K. With no query it lists the pages of the member's current
 * workspace and the other workspaces they can open - the same capability-gated
 * route table the sidebar uses, so a manager sees manager pages and a learner
 * never sees a page they can't open. Typing searches both pages and content.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t, i18n } = useTranslation(['common', 'nav'])
  const isArabic = i18n.language?.startsWith('ar')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { workspaceNavigation, searchRoutes } = useNavigation()
  const { activeWorkspace, authorizedWorkspaces } = useWorkspaces()

  const debouncedQuery = useDebounce(query, 300)
  const { results, isLoading, hasResults } = useSearch(debouncedQuery, { limit: 12 })

  const navTitle = (key: string) => t(key, { ns: 'nav' })
  // Page matches are local, so they use the live query rather than the debounced one.
  const matchingPages = query.trim() ? searchRoutes(query, navTitle) : []
  const otherWorkspaces = authorizedWorkspaces.filter((ws) => ws.id !== activeWorkspace)

  const go = (path: string) => {
    onOpenChange(false)
    setQuery('')
    setTimeout(() => navigate(path), 10)
  }

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = []
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, typeof results>)

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={t('common:commandPalette.placeholder', 'Search courses, articles, people, or jump to a page…')}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-6" role="status">
              <Loader2 className="h-6 w-6 animate-spin text-ds-brass mb-2" aria-hidden="true" />
              <p className="text-sm text-ds-muted">{t('common:commandPalette.searching', 'Searching…')}</p>
            </div>
          ) : (
            t('common:commandPalette.noResults', 'No results found.')
          )}
        </CommandEmpty>

        {!query.trim() && (
          <>
            {workspaceNavigation.length > 0 && (
              <CommandGroup heading={t('common:commandPalette.goTo', 'Go to')}>
                {workspaceNavigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem key={item.path} value={`page ${item.path} ${navTitle(item.title)}`} onSelect={() => go(item.path)} className="cursor-pointer">
                      <Icon className="me-2 h-4 w-4 text-ds-brass" aria-hidden="true" />
                      <span>{navTitle(item.title)}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            {otherWorkspaces.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('common:commandPalette.workspaces', 'Switch workspace')}>
                  {otherWorkspaces.map((ws) => (
                    <CommandItem key={ws.id} value={`workspace ${ws.id} ${ws.label} ${ws.labelAr}`} onSelect={() => go(ws.defaultPath)} className="cursor-pointer">
                      <ArrowRightLeft className="me-2 h-4 w-4 text-ds-muted" aria-hidden="true" />
                      <span>{isArabic ? ws.labelAr : ws.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup heading={t('common:commandPalette.account', 'Account')}>
              <CommandItem value="account profile" onSelect={() => go('/profile')} className="cursor-pointer">
                <User className="me-2 h-4 w-4 text-ds-muted" aria-hidden="true" />
                <span>{t('common:commandPalette.profile', 'My profile')}</span>
              </CommandItem>
              <CommandItem value="account settings" onSelect={() => go('/settings')} className="cursor-pointer">
                <Settings className="me-2 h-4 w-4 text-ds-muted" aria-hidden="true" />
                <span>{t('common:commandPalette.settings', 'Settings')}</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {/* Pages are matched here (capability-gated, localized titles), so cmdk's
            own fuzzy filter is kept from hiding them via a value that contains the query. */}
        {matchingPages.length > 0 && (
          <CommandGroup heading={t('common:commandPalette.pages', 'Pages')}>
            {matchingPages.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem key={item.path} value={`page ${item.path} ${navTitle(item.title)} ${query}`} onSelect={() => go(item.path)} className="cursor-pointer">
                  <Icon className="me-2 h-4 w-4 text-ds-brass" aria-hidden="true" />
                  <span>{navTitle(item.title)}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {debouncedQuery && hasResults && (
          Object.entries(groupedResults).map(([type, items]) => {
            const Icon = RESULT_ICON[type] ?? FileText
            return (
              <CommandGroup key={type} heading={t(`common:commandPalette.types.${type}`, type.charAt(0).toUpperCase() + type.slice(1))}>
                {items.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={`${type} ${result.id} ${result.title} ${debouncedQuery}`}
                    onSelect={() => go(result.url)}
                    className="cursor-pointer"
                  >
                    <Icon className="me-2 h-4 w-4 text-ds-muted" aria-hidden="true" />
                    <span>{result.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })
        )}
      </CommandList>
    </CommandDialog>
  )
}
