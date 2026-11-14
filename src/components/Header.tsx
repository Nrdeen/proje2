import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react';
import type { AppNotification } from '../types/marketplace';
import { formatRelativeArabicTime } from '../lib/format';

export type PageView =
  | 'home'
  | 'listings'
  | 'detail'
  | 'add'
  | 'breeds'
  | 'breeders'
  | 'dashboard'
  | 'seller'
  | 'login';

interface HeaderProps {
  currentPage: PageView;
  onNavigate: (page: PageView) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  notifications: AppNotification[];
  onOpenNotification: (notification: AppNotification) => void;
  onMarkAllNotificationsRead: () => void;
  isLoggedIn: boolean;
  onLogout: () => void;
}

export function Header({
  currentPage,
  onNavigate,
  theme,
  onToggleTheme,
  notifications,
  onOpenNotification,
  onMarkAllNotificationsRead,
  isLoggedIn,
  onLogout,
}: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifContainerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!notifOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        notifContainerRef.current &&
        !notifContainerRef.current.contains(event.target as Node)
      ) {
        setNotifOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifOpen]);

  const navItems: { id: PageView; label: string }[] = [
    { id: 'home', label: 'الرئيسية' },
    { id: 'listings', label: 'الإعلانات' },
    { id: 'breeds', label: 'دليل السلالات' },
    { id: 'breeders', label: 'المربون والأسعار' },
    { id: 'dashboard', label: 'حسابي' },
  ];

  const handleNav = (page: PageView) => {
    onNavigate(page);
    setMobileOpen(false);
    setNotifOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-sm border-b border-[var(--color-border)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 text-[var(--color-green-ink)] font-display text-xl font-extrabold tracking-tight whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)] cursor-pointer"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect width="32" height="32" rx="8" fill="#0B3A29" />
            <path
              d="M9.5 18.5C9.5 14.5 12.4 11.5 16 11.5C19.6 11.5 22.5 14.5 22.5 18.5C22.5 21 20.6 22.5 18.5 22.5H13.5C11.4 22.5 9.5 21 9.5 18.5Z"
              stroke="#FAF6EC"
              strokeWidth="1.75"
            />
            <path
              d="M11.5 12.5C9.2 11.2 8 12.6 8.5 14.8M20.5 12.5C22.8 11.2 24 12.6 23.5 14.8"
              stroke="#D79A3D"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
          <span>سوق الغنم</span>
        </button>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="التنقل الرئيسي">
          {navItems.map((item) => {
            const active =
              currentPage === item.id ||
              (item.id === 'listings' && currentPage === 'detail');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)] ${
                  active
                    ? 'text-[var(--color-green-ink)] font-semibold'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-gold)] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Toggle + Notification Bell + Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع المظلم'}
            title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع المظلم'}
            aria-pressed={theme === 'dark'}
            className="w-10 h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-cream)] flex items-center justify-center text-[var(--color-ink)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
          >
            {theme === 'dark' ? (
              <Sun size={18} className="text-[var(--color-gold)]" aria-hidden="true" />
            ) : (
              <Moon size={18} className="text-[var(--color-green-ink)]" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => (isLoggedIn ? onLogout() : onNavigate('login'))}
            aria-label={isLoggedIn ? 'تسجيل الخروج' : 'تسجيل الدخول'}
            title={isLoggedIn ? 'تسجيل الخروج' : 'تسجيل الدخول'}
            className="h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-cream)] flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--color-ink)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
          >
            {isLoggedIn ? <LogOut size={16} aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
            <span className="hidden sm:inline">{isLoggedIn ? 'خروج' : 'دخول'}</span>
          </button>

          {/* Real-Time Notifications Bell & Dropdown */}
          <div className="relative" ref={notifContainerRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label={`الإشعارات${unreadCount > 0 ? ` (${unreadCount} غير مقروء)` : ''}`}
              aria-expanded={notifOpen}
              className="relative w-10 h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-cream)] flex items-center justify-center text-[var(--color-ink)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
            >
              <Bell size={18} aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 rounded-md bg-[var(--color-gold)] text-[#14261D] text-[11px] font-extrabold tabular-nums flex items-center justify-center border border-[var(--color-surface)]">
                  {unreadCount > 9 ? '+9' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                role="region"
                aria-label="قائمة الإشعارات"
                className="absolute left-0 mt-2 w-80 sm:w-96 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden z-50"
              >
                <div className="px-4 py-3 bg-[var(--color-cream)]/70 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-[var(--color-ink)]">
                    الإشعارات ({notifications.length})
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllNotificationsRead}
                      className="text-xs font-semibold text-[var(--color-green-ink)] hover:underline cursor-pointer"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto divide-y divide-[var(--color-border)]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[var(--color-muted)]">
                      لا توجد إشعارات حالياً. ستصلك التنبيهات فور تلقي رسالة أو سؤال أو رد أو إعجاب جديد أو تحديث على عرض سعر.
                    </div>
                  ) : (
                    notifications.slice(0, 12).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onOpenNotification(item);
                          setNotifOpen(false);
                        }}
                        className={`w-full text-right p-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                          item.read
                            ? 'bg-[var(--color-surface)] hover:bg-[var(--color-cream)]/50'
                            : 'bg-[var(--color-cream)] hover:bg-[var(--color-cream-hover)]'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {item.type === 'offer_accepted' || item.type === 'listing_approved' ? (
                            <CheckCircle2
                              size={17}
                              className="text-[var(--color-green-ink)]"
                              aria-hidden="true"
                            />
                          ) : item.type === 'offer_rejected' || item.type === 'listing_rejected' ? (
                            <XCircle
                              size={17}
                              className="text-red-700 dark:text-red-400"
                              aria-hidden="true"
                            />
                          ) : item.type === 'seller_verified' ? (
                            <ShieldCheck
                              size={17}
                              className="text-[var(--color-green-ink)]"
                              aria-hidden="true"
                            />
                          ) : item.type === 'seller_verification_rejected' ? (
                            <ShieldAlert
                              size={17}
                              className="text-red-700 dark:text-red-400"
                              aria-hidden="true"
                            />
                          ) : item.type === 'new_comment' || item.type === 'comment_reply' ? (
                            <MessageCircle
                              size={17}
                              className="text-[var(--color-green-ink)]"
                              aria-hidden="true"
                            />
                          ) : item.type === 'listing_liked' ? (
                            <ThumbsUp
                              size={17}
                              className="text-[var(--color-gold)]"
                              aria-hidden="true"
                            />
                          ) : (
                            <MessageSquare
                              size={17}
                              className="text-[var(--color-gold)]"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[var(--color-ink)] truncate">
                              {item.title}
                            </p>
                            {!item.read && (
                              <span className="text-[10px] font-bold text-[var(--color-green-ink)] shrink-0">
                                جديد
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-muted)] mt-1 line-clamp-2 leading-relaxed">
                            {item.body}
                          </p>
                          <p className="text-[11px] text-[var(--color-muted)]/80 mt-1">
                            {formatRelativeArabicTime(item.createdAt)}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleNav('add')}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
          >
            أضف إعلانك
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink)]"
            aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full text-right px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--color-cream)] text-[var(--color-green-ink)] font-semibold'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-cream)]/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
