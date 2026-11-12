import { Moon, Scissors, Sun } from 'lucide-react';
import { BRAND } from '../brand';

export type AppView = 'book' | 'manage' | 'owner';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function Header({ activeView, onNavigate, isDark, onToggleTheme }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 dark:border-stone-800/80 glass-header backdrop-blur-md shadow-xs transition-colors">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('book')}
          className="flex items-center gap-2 text-left whitespace-nowrap shrink-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg px-1"
        >
          {BRAND.logoUrl ? (
            <img
              src={BRAND.logoUrl}
              alt={BRAND.businessName}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover"
            />
          ) : (
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 transition-colors"
              style={{ background: `var(--brand-accent, ${BRAND.colors.accent})` }}
            >
              <Scissors className="w-4 h-4" />
            </span>
          )}
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 truncate max-w-[120px] sm:max-w-none">
            {BRAND.businessName}
          </span>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="flex items-center gap-0.5 sm:gap-6 text-xs sm:text-sm font-medium" aria-label="Primary">
          <button
            type="button"
            onClick={() => onNavigate('book')}
            className={`px-2 sm:px-3 py-2 min-h-[44px] rounded-lg whitespace-nowrap shrink-0 transition-colors ${
              activeView === 'book'
                ? 'text-stone-900 dark:text-stone-100 font-semibold underline decoration-2 underline-offset-8 decoration-amber-600'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Book
          </button>
          <button
            type="button"
            onClick={() => onNavigate('manage')}
            className={`px-2 sm:px-3 py-2 min-h-[44px] rounded-lg whitespace-nowrap shrink-0 transition-colors ${
              activeView === 'manage'
                ? 'text-stone-900 dark:text-stone-100 font-semibold underline decoration-2 underline-offset-8 decoration-amber-600'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Manage
          </button>
        </nav>

        {/* Zone 3: Theme Toggle & Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('book')}
            className="hidden sm:inline-flex items-center justify-center px-4 min-h-[44px] rounded-xl text-sm font-semibold text-white bg-amber-600 whitespace-nowrap shrink-0 transition-opacity hover:opacity-90 shadow-xs"
            style={{ background: `var(--brand-accent, ${BRAND.colors.accent})` }}
          >
            Book Now
          </button>
        </div>
      </div>
    </header>
  );
}
