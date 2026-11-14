import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import { api, setCsrfToken } from './lib/api';
import type { AppNotification, BootstrapPayload, Listing } from './types/marketplace';
import { Header, type PageView } from './components/Header';
import { HeroSearch, type QuickFilterValues } from './components/HeroSearch';
import { ListingCard } from './components/ListingCard';
import { ListingsDirectory, type DirectoryFilters } from './components/ListingsDirectory';
import { Footer } from './components/Footer';
import { SafeImage } from './components/SafeImage';
import { VerifiedSellerBadge } from './components/VerifiedSellerBadge';
import {
  partitionSellersByVerification,
  resolveRequestedListing,
  resolveRequestedSeller,
} from './lib/marketplace-helpers';
import type { DashboardTab } from './components/DashboardView';

// Secondary pages are loaded on demand (code splitting). The components keep their named exports,
// so each lazy() maps the named export to the default shape React.lazy expects.
const ListingDetailView = lazy(() =>
  import('./components/ListingDetailView').then((m) => ({ default: m.ListingDetailView })),
);
const AddListingView = lazy(() =>
  import('./components/AddListingView').then((m) => ({ default: m.AddListingView })),
);
const BreedsAndPricesView = lazy(() =>
  import('./components/BreedsAndPricesView').then((m) => ({ default: m.BreedsAndPricesView })),
);
const BreedersAndGuidesView = lazy(() =>
  import('./components/BreedersAndGuidesView').then((m) => ({ default: m.BreedersAndGuidesView })),
);
const DashboardView = lazy(() =>
  import('./components/DashboardView').then((m) => ({ default: m.DashboardView })),
);
const SellerProfileView = lazy(() =>
  import('./components/SellerProfileView').then((m) => ({ default: m.SellerProfileView })),
);
const AuthView = lazy(() => import('./components/AuthView').then((m) => ({ default: m.AuthView })));

function PageFallback() {
  return (
    <div className="py-24 text-center" role="status" aria-live="polite">
      <p className="text-sm text-[var(--color-muted)]">جاري التحميل...</p>
    </div>
  );
}

const DEFAULT_FILTERS: DirectoryFilters = {
  q: '',
  categoryId: 'all',
  subCategoryId: 'all',
  breedId: 'all',
  regionId: 'all',
  minPrice: '',
  maxPrice: '',
  sex: 'all',
  negotiableOnly: false,
  sort: 'newest',
};

function resolveInitialTheme(): 'light' | 'dark' {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  try {
    const saved = localStorage.getItem('souq-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore storage access issues
  }
  return 'light';
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(resolveInitialTheme);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [publishedListings, setPublishedListings] = useState<Listing[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const initialDeepLinkListingId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const id = new URLSearchParams(window.location.search).get('listing');
      return id && id.trim() ? id.trim() : null;
    } catch {
      return null;
    }
  }, []);

  const [page, setPage] = useState<PageView>(initialDeepLinkListingId ? 'detail' : 'home');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(initialDeepLinkListingId);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [homeBreedFilter, setHomeBreedFilter] = useState<string>('all');
  const [filters, setFilters] = useState<DirectoryFilters>(DEFAULT_FILTERS);
  const [toast, setToast] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [commentRefreshMap, setCommentRefreshMap] = useState<Record<string, number>>({});
  const [dashboardRequestedTab, setDashboardRequestedTab] = useState<DashboardTab | null>(null);
  const [dashboardRequestedConvId, setDashboardRequestedConvId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('souq-compare-ids');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string').slice(0, 4)
        : [];
    } catch {
      return [];
    }
  });
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('souq-compare-ids', JSON.stringify(compareIds));
    } catch {
      // ignore storage errors
    }
  }, [compareIds]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('souq-theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4500);
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      const boot = await api.bootstrap();
      setCsrfToken(boot.csrfToken);
      setBootstrap(boot);
      setNotifications(boot.notifications || []);

      const pubRes = await api.getListings({ status: 'Published' });
      setPublishedListings(pubRes.listings);

      // Load user/admin accessible listings for dashboard/moderation
      if (!boot.currentUser) {
        // Visitor: public listings only.
        setAllListings(pubRes.listings);
      } else if (boot.currentUser.role === 'admin') {
        const pendingRes = await api.getListings({ status: 'Pending' });
        const rejectedRes = await api.getListings({ status: 'Rejected' });
        const soldRes = await api.getListings({ status: 'Sold' });
        setAllListings([
          ...pendingRes.listings,
          ...pubRes.listings,
          ...rejectedRes.listings,
          ...soldRes.listings,
        ]);
      } else {
        const mineRes = await api.getListings({ sellerId: boot.currentUser.id });
        const merged = [...mineRes.listings];
        pubRes.listings.forEach((p) => {
          if (!merged.some((m) => m.id === p.id)) merged.push(p);
        });
        setAllListings(merged);
      }
      setError('');
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل بيانات المنصة');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const currentUserId = bootstrap?.currentUser?.id;

  useEffect(() => {
    if (!currentUserId) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;
    let failedAttempts = 0;

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // The server identifies the connection from the session cookie; nothing about identity is sent here.
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      socket = new WebSocket(wsUrl);

      socket.addEventListener('open', () => {
        failedAttempts = 0;
      });

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          if (payload.type === 'notifications:init' || payload.type === 'notifications:updated') {
            if (Array.isArray(payload.notifications)) {
              setNotifications(payload.notifications);
            }
          } else if (payload.type === 'notification:new' && payload.notification) {
            const incoming = payload.notification as AppNotification;
            setNotifications((prev) => {
              if (prev.some((item) => item.id === incoming.id)) return prev;
              return [incoming, ...prev];
            });
            notify(incoming.title);
            if (
              incoming.listingId &&
              (incoming.type === 'new_comment' || incoming.type === 'comment_reply')
            ) {
              const targetListingId = incoming.listingId;
              setCommentRefreshMap((prev) => ({
                ...prev,
                [targetListingId]: (prev[targetListingId] || 0) + 1,
              }));
              loadAllData();
            } else if (incoming.type !== 'listing_liked') {
              loadAllData();
            }
          } else if (payload.type === 'listing:comments-updated' && payload.listingId) {
            const targetListingId = String(payload.listingId);
            setCommentRefreshMap((prev) => ({
              ...prev,
              [targetListingId]: (prev[targetListingId] || 0) + 1,
            }));
          } else if (
            payload.type === 'listing:likes-updated' &&
            payload.listingId &&
            typeof payload.likesCount === 'number'
          ) {
            const targetListingId = String(payload.listingId);
            const nextCount = payload.likesCount;
            setPublishedListings((prev) =>
              prev.map((item) =>
                item.id === targetListingId ? { ...item, likesCount: nextCount } : item
              )
            );
            setAllListings((prev) =>
              prev.map((item) =>
                item.id === targetListingId ? { ...item, likesCount: nextCount } : item
              )
            );
          } else if (payload.type === 'conversation:updated' || payload.type === 'offer:updated') {
            loadAllData();
          }
        } catch {
          // Ignore malformed WS payloads
        }
      });

      socket.addEventListener('close', (event) => {
        if (disposed) return;
        // 4401: the server ended our session. Repeated failures: the handshake is being refused (signed out).
        failedAttempts += 1;
        if (event.code === 4401) {
          loadAllData();
          return;
        }
        if (failedAttempts === 6) loadAllData(); // refresh auth state once; retries continue with backoff
        reconnectTimer = window.setTimeout(connect, Math.min(30_000, 2500 * failedAttempts));
      });
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
  }, [currentUserId, loadAllData, notify]);

  const syncListingQueryParam = useCallback((listingId: string | null) => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (listingId) {
        url.searchParams.set('listing', listingId);
      } else {
        url.searchParams.delete('listing');
      }
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Ignore history API restrictions
    }
  }, []);

  const navigate = useCallback(
    (nextPage: PageView) => {
      setPage(nextPage);
      if (nextPage !== 'detail') {
        setSelectedListingId(null);
        syncListingQueryParam(null);
      }
      if (nextPage !== 'seller') {
        setSelectedSellerId(null);
      }
      if (nextPage !== 'add') {
        setEditingListingId(null);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [syncListingQueryParam]
  );

  const clearDashboardHint = useCallback(() => {
    setDashboardRequestedTab(null);
    setDashboardRequestedConvId(null);
  }, []);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await api.markAllNotificationsRead();
    } catch {
      // Optimistic local read state already applied
    }
  }, []);

  const handleOpenNotification = useCallback(
    async (item: AppNotification) => {
      if (!item.read) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
        try {
          await api.markNotificationRead(item.id);
        } catch {
          // Keep optimistic read state
        }
      }

      if (item.type === 'new_message') {
        setDashboardRequestedTab('messages');
        setDashboardRequestedConvId(item.conversationId || null);
        navigate('dashboard');
      } else if (
        item.type === 'seller_verified' ||
        item.type === 'seller_verification_rejected' ||
        item.type === 'listing_rejected'
      ) {
        setDashboardRequestedTab('my-listings');
        navigate('dashboard');
      } else if (item.listingId) {
        setSelectedListingId(item.listingId);
        syncListingQueryParam(item.listingId);
        navigate('detail');
        if (item.type === 'new_comment' || item.type === 'comment_reply') {
          window.setTimeout(() => {
            document
              .getElementById('listing-comments-section')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 160);
        }
      }
    },
    [navigate, syncListingQueryParam]
  );

  const handleHeroSearch = (quick: QuickFilterValues) => {
    setFilters({
      ...DEFAULT_FILTERS,
      q: quick.q,
      categoryId: quick.categoryId,
      regionId: quick.regionId,
      maxPrice: quick.maxPrice,
    });
    navigate('listings');
  };

  const handleSelectListing = (listing: Listing) => {
    setSelectedListingId(listing.id);
    syncListingQueryParam(listing.id);
    navigate('detail');
  };

  /** Sends visitors to the login page; throws so callers do not report success. */
  const ensureSignedIn = () => {
    if (!bootstrap?.currentUser) {
      navigate('login');
      throw new Error('سجّل الدخول للمتابعة');
    }
  };

  const handleToggleFavorite = async (listingId: string) => {
    if (!bootstrap) return;
    try {
      ensureSignedIn();
      const res = await api.toggleFavorite(listingId);
      setBootstrap({ ...bootstrap, favoriteIds: res.favoriteIds });
      notify(res.isFavorite ? 'تمت إضافة الإعلان إلى المفضلة' : 'تمت إزالة الإعلان من المفضلة');
    } catch (err: any) {
      notify(err?.message || 'تعذر تحديث المفضلة');
    }
  };

  const pendingLikesRef = useRef<Set<string>>(new Set());

  const handleToggleLike = async (listingId: string) => {
    if (!bootstrap) return;
    if (!bootstrap.currentUser) {
      navigate('login');
      notify('سجّل الدخول للإعجاب بالإعلانات');
      return;
    }
    if (pendingLikesRef.current.has(listingId)) return;

    const prevLikedIds = bootstrap.likedListingIds || [];
    const wasLiked = prevLikedIds.includes(listingId);
    const targetAction = wasLiked ? 'unlike' : 'like';
    const delta = wasLiked ? -1 : 1;

    const existingListing =
      publishedListings.find((item) => item.id === listingId) ||
      allListings.find((item) => item.id === listingId);
    const prevLikesCount = existingListing?.likesCount ?? 0;

    const nextOptimisticLikedIds = wasLiked
      ? prevLikedIds.filter((id) => id !== listingId)
      : [...prevLikedIds, listingId];

    const patchLikesCount = (items: Listing[]) =>
      items.map((item) =>
        item.id === listingId
          ? { ...item, likesCount: Math.max(0, (item.likesCount ?? 0) + delta) }
          : item
      );

    // Apply optimistic update immediately
    setBootstrap((prev) => (prev ? { ...prev, likedListingIds: nextOptimisticLikedIds } : prev));
    setPublishedListings(patchLikesCount);
    setAllListings(patchLikesCount);
    pendingLikesRef.current.add(listingId);

    try {
      const res = await api.setListingLike(listingId, targetAction);
      setBootstrap((prev) => (prev ? { ...prev, likedListingIds: res.likedListingIds } : prev));
      setPublishedListings((prev) =>
        prev.map((item) => (item.id === listingId ? { ...item, likesCount: res.likesCount } : item))
      );
      setAllListings((prev) =>
        prev.map((item) => (item.id === listingId ? { ...item, likesCount: res.likesCount } : item))
      );
    } catch (err: any) {
      // Roll back optimistic state cleanly on failure
      setBootstrap((prev) => (prev ? { ...prev, likedListingIds: prevLikedIds } : prev));
      setPublishedListings((prev) =>
        prev.map((item) =>
          item.id === listingId ? { ...item, likesCount: prevLikesCount } : item
        )
      );
      setAllListings((prev) =>
        prev.map((item) =>
          item.id === listingId ? { ...item, likesCount: prevLikesCount } : item
        )
      );
      notify(err?.message || 'تعذر تحديث الإعجاب، تم التراجع عن التغيير');
    } finally {
      pendingLikesRef.current.delete(listingId);
    }
  };

  const handleCreateListing = async (payload: Record<string, unknown>) => {
    const res = await api.createListing(payload);
    await loadAllData();
    if (res.listing.status === 'Pending') {
      notify('تم إرسال الإعلان للمراجعة الإدارية، ويمكنك متابعته من لوحة حسابي');
      navigate('dashboard');
    } else {
      notify('تم نشر الإعلان بنجاح');
      setSelectedListingId(res.listing.id);
      syncListingQueryParam(res.listing.id);
      navigate('detail');
    }
  };

  const handleStartEditListing = (listing: Listing) => {
    setEditingListingId(listing.id);
    setPage('add');
    syncListingQueryParam(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateListing = async (listingId: string, payload: Record<string, unknown>) => {
    const res = await api.updateListing(listingId, payload);
    await loadAllData();
    setEditingListingId(null);
    setSelectedListingId(res.listing.id);
    syncListingQueryParam(res.listing.id);
    notify('تم حفظ تعديلات الإعلان بنجاح');
    navigate('detail');
  };

  /**
   * Conversation actions: a failure is always shown to the user (toast) and then re-thrown, so the calling
   * form can show its own inline error and keep the typed text. Success is only reported after the server
   * accepted the message; a failed refresh afterwards does not turn a delivered message into an "error".
   */
  const handleStartConversation = async (listingId: string, initialMessage: string) => {
    try {
      ensureSignedIn();
      await api.startConversation(listingId, initialMessage);
    } catch (err: any) {
      notify(err?.message || 'تعذر إرسال رسالتك إلى البائع، حاول مرة أخرى');
      throw err;
    }
    await loadAllData();
    notify('تم إرسال رسالتك إلى البائع');
  };

  const handleSendMessage = async (conversationId: string, body: string) => {
    try {
      await api.sendMessage(conversationId, body);
    } catch (err: any) {
      notify(err?.message || 'تعذر إرسال الرسالة، حاول مرة أخرى');
      throw err;
    }
    await loadAllData();
  };

  const handleSubmitPriceOffer = async (
    listingId: string,
    payload: { offeredPrice: number; quantity: number; note: string }
  ) => {
    ensureSignedIn();
    await api.submitPriceOffer(listingId, payload);
    await loadAllData();
    notify('تم إرسال عرض السعر إلى المربي بنجاح');
  };

  const handleRespondToOffer = async (offerId: string, status: 'accepted' | 'rejected') => {
    await api.respondToOffer(offerId, status);
    await loadAllData();
    notify(status === 'accepted' ? 'تم قبول عرض السعر' : 'تم رفض عرض السعر');
  };

  const handleReportListing = async (listingId: string, reason: string, details: string) => {
    ensureSignedIn();
    await api.createReport(listingId, reason, details);
    await loadAllData();
  };

  const handleLogin = async (phone: string, password: string) => {
    const res = await api.login({ phone, password });
    setCsrfToken(res.csrfToken);
    await loadAllData();
    notify(`مرحباً ${res.user.name}`);
    if (page === 'login') navigate('home');
  };

  const handleRegister = async (
    name: string,
    phone: string,
    password: string,
    role: 'buyer' | 'seller'
  ) => {
    const res = await api.register({ name, phone, password, role });
    setCsrfToken(res.csrfToken);
    await loadAllData();
    notify(`مرحباً ${res.user.name}، تم تفعيل حسابك بنجاح`);
    if (page === 'login') navigate('home');
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Even if the request fails the local view is reset; the server session expires on its own.
    }
    setCsrfToken(null);
    setNotifications([]);
    clearDashboardHint();
    await loadAllData();
    navigate('home');
    notify('تم تسجيل الخروج');
  };

  // The server ended our session (expiry/revocation): fall back to the signed-out view.
  useEffect(() => {
    const onUnauthenticated = () => {
      setCsrfToken(null);
      loadAllData();
    };
    window.addEventListener('souq:unauthenticated', onUnauthenticated);
    return () => window.removeEventListener('souq:unauthenticated', onUnauthenticated);
  }, [loadAllData]);

  const handleApproveListing = async (listingId: string) => {
    await api.approveListing(listingId);
    await loadAllData();
    notify('تم اعتماد الإعلان ونشره في السوق');
  };

  const handleRejectListing = async (listingId: string, reason: string) => {
    await api.rejectListing(listingId, reason);
    await loadAllData();
    notify('تم رفض الإعلان وتوثيق السبب');
  };

  const handleMarkSold = async (listingId: string) => {
    await api.updateListing(listingId, { status: 'Sold' });
    await loadAllData();
    notify('تم تحديث حالة الإعلان إلى مباع');
  };

  const handleSubmitSellerReview = async (
    sellerId: string,
    payload: { rating: number; comment: string }
  ) => {
    ensureSignedIn();
    await api.submitSellerReview(sellerId, payload);
    await loadAllData();
    notify('تم حفظ تقييمك للمربي بنجاح');
  };

  const handleCreateBreed = async (payload: {
    name: string;
    categoryId: string;
    origin: string;
    summary: string;
    avgWeightKg: string;
    priceRangeSar: string;
  }) => {
    await api.createBreed(payload);
    await loadAllData();
    notify('تمت إضافة السلالة الجديدة إلى قاعدة البيانات');
  };

  const handleCreateSubCategory = async (payload: {
    name: string;
    parentId: string;
    description: string;
    keywords: string;
  }) => {
    await api.createSubCategory(payload);
    await loadAllData();
    notify(`تم إنشاء الفئة الفرعية «${payload.name}» بنجاح`);
  };

  const handleUpdateSubCategory = async (
    id: string,
    payload: {
      name: string;
      parentId: string;
      description: string;
      keywords: string;
    }
  ) => {
    await api.updateSubCategory(id, payload);
    await loadAllData();
    notify(`تم تحديث الفئة الفرعية «${payload.name}»`);
  };

  const handleDeleteSubCategory = async (id: string) => {
    await api.deleteSubCategory(id);
    await loadAllData();
    notify('تم حذف الفئة الفرعية وإعادة توزيع الإعلانات');
  };

  const handleAutoCategorizeListings = async (
    payload: { listingId?: string; subCategoryId?: string } = {}
  ) => {
    const res = await api.autoCategorizeListings(payload);
    await loadAllData();
    notify(
      payload.listingId
        ? 'تم تحديث الفئة الفرعية للإعلان'
        : `تم تصنيف ${res.updatedCount} إعلان تلقائياً`
    );
  };

  const homeListings = useMemo(() => {
    const base =
      homeBreedFilter === 'all'
        ? publishedListings
        : publishedListings.filter((l) => l.breedId === homeBreedFilter);
    return base.slice(0, 6);
  }, [publishedListings, homeBreedFilter]);

  const selectedListing = useMemo(
    () =>
      resolveRequestedListing({
        listingId: selectedListingId,
        allListings,
        publishedListings,
      }),
    [allListings, publishedListings, selectedListingId]
  );

  const editingListing = useMemo(
    () => (editingListingId ? allListings.find((l) => l.id === editingListingId) || null : null),
    [allListings, editingListingId]
  );

  const handleToggleCompare = useCallback(
    (listingId: string) => {
      setCompareIds((prev) => {
        if (prev.includes(listingId)) {
          notify('تمت إزالة الإعلان من قائمة المقارنة');
          return prev.filter((id) => id !== listingId);
        }
        if (prev.length >= 4) {
          notify('يمكنك مقارنة 4 إعلانات كحد أقصى في الوقت نفسه');
          return prev;
        }
        notify(`تمت إضافة الإعلان إلى قائمة المقارنة (${prev.length + 1}/4)`);
        return [...prev, listingId];
      });
    },
    [notify]
  );

  const handleClearCompare = useCallback(() => {
    setCompareIds([]);
    notify('تم مسح قائمة مقارنة المواشي');
  }, [notify]);

  const compareListings = useMemo(() => {
    const pool = [...allListings];
    publishedListings.forEach((p) => {
      if (!pool.some((item) => item.id === p.id)) pool.push(p);
    });
    return compareIds
      .map((id) => pool.find((l) => l.id === id))
      .filter((item): item is Listing => Boolean(item));
  }, [compareIds, allListings, publishedListings]);

  const selectedSeller = useMemo(
    () =>
      resolveRequestedSeller({
        sellerId: selectedSellerId,
        sellers: bootstrap?.sellers || [],
      }),
    [bootstrap, selectedSellerId]
  );

  const { verifiedSellers: verifiedHomeSellers, otherSellers: otherHomeSellers } = useMemo(
    () => partitionSellersByVerification(bootstrap?.sellers || []),
    [bootstrap]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="font-display text-2xl font-extrabold text-[var(--color-green-ink)]">
            سوق الغنم
          </p>
          <p className="text-sm text-[var(--color-muted)]">جاري تحميل المنصة...</p>
        </div>
      </div>
    );
  }

  if (error || !bootstrap) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--color-cream)] border border-[var(--color-border)] rounded-xl p-6 text-center">
          <p className="font-display text-lg font-bold text-[var(--color-ink)]">
            تعذر تحميل البيانات
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{error}</p>
          <button
            type="button"
            onClick={loadAllData}
            className="mt-4 px-5 py-2 rounded-lg bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white text-sm font-semibold cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      <Header
        currentPage={page}
        onNavigate={navigate}
        isLoggedIn={Boolean(bootstrap.currentUser)}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
        notifications={notifications}
        onOpenNotification={handleOpenNotification}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-5 z-50 bg-[var(--color-green)] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium border border-[var(--color-gold)]/50"
        >
          {toast}
        </div>
      )}

      <main className="flex-1">
        <Suspense fallback={<PageFallback />}>
        {/* HOME PAGE */}
        {page === 'home' && (
          <>
            <HeroSearch
              categories={bootstrap.categories}
              regions={bootstrap.regions}
              onSearch={handleHeroSearch}
              onBrowseAll={() => {
                setFilters(DEFAULT_FILTERS);
                navigate('listings');
              }}
            />

            {/* Section 2: Featured & Latest Listings */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)]">
                    أحدث إعلانات المواشي المختارة
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    عروض محدثة بمواصفات العمر والوزن والسعر الواضح بالريال السعودي
                  </p>
                </div>

                {/* Breed Quick Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[var(--color-cream)] rounded-lg border border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => setHomeBreedFilter('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      homeBreedFilter === 'all'
                        ? 'bg-[var(--color-green)] text-white'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    الكل
                  </button>
                  {bootstrap.breeds.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setHomeBreedFilter(b.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        homeBreedFilter === b.id
                          ? 'bg-[var(--color-green)] text-white'
                          : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {homeListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    breed={bootstrap.breeds.find((b) => b.id === listing.breedId)}
                    subCategory={bootstrap.categories.find((c) => c.id === listing.subCategoryId)}
                    region={bootstrap.regions.find((r) => r.id === listing.regionId)}
                    seller={bootstrap.sellers.find((s) => s.userId === listing.sellerId)}
                    isFavorite={bootstrap.favoriteIds.includes(listing.id)}
                    isLiked={(bootstrap.likedListingIds || []).includes(listing.id)}
                    onSelect={handleSelectListing}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleLike={handleToggleLike}
                  />
                ))}
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setFilters(DEFAULT_FILTERS);
                    navigate('listings');
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[var(--color-green-ink)] text-[var(--color-green-ink)] hover:bg-[var(--color-green)] hover:text-white hover:border-[var(--color-green)] text-sm font-semibold transition-colors cursor-pointer"
                >
                  <span>عرض جميع الإعلانات ({publishedListings.length})</span>
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
              </div>
            </section>

            {/* Section 3: Breed Directory & Indicative Prices Spotlight */}
            <section className="bg-[var(--color-cream)] border-y border-[var(--color-border)] py-14">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)]">
                      دليل السلالات والأسعار الاسترشادية
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      تعرّف على خصائص أشهر السلالات السعودية ومتوسطات أسعارها الحالية في السوق
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('breeds')}
                    className="text-sm font-semibold text-[var(--color-green-ink)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    استعراض الدليل والأسعار كاملة
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {bootstrap.breeds.slice(0, 5).map((breed) => (
                    <article
                      key={breed.id}
                      className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden flex flex-col"
                    >
                      <div className="aspect-[4/3] bg-[var(--color-cream)]">
                        <SafeImage
                          src={breed.imageUrl}
                          alt={breed.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-[11px] text-[var(--color-muted)]">{breed.origin}</p>
                          <h3 className="font-display text-base font-bold text-[var(--color-ink)] mt-0.5">
                            {breed.name}
                          </h3>
                          <p className="mt-1.5 font-display text-sm font-extrabold text-[var(--color-green-ink)] tabular-nums">
                            {breed.priceRangeSar}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFilters({ ...DEFAULT_FILTERS, breedId: breed.id });
                            navigate('listings');
                          }}
                          className="mt-3 text-xs font-semibold text-[var(--color-green-ink)] hover:underline text-right cursor-pointer"
                        >
                          تصفح عروض {breed.name}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            {/* Section 4: Trusted Breeders Strip */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
                      مربون موثقون في المملكة
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      تواصل مع أصحاب المزارع والمراحات المعتمدة والموثقة من إدارة المنصة
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('breeders')}
                    className="text-sm font-semibold text-[var(--color-green-ink)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    المربون والمقالات والأسئلة الشائعة
                  </button>
                </div>

                {verifiedHomeSellers.length === 0 ? (
                  <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 text-center">
                    <p className="text-sm font-semibold text-[var(--color-ink)]">
                      لا يوجد مربون موثقون معروضون حالياً.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('breeders')}
                      className="mt-3 text-xs font-semibold text-[var(--color-green-ink)] hover:underline cursor-pointer"
                    >
                      استعراض دليل المربين والأسعار
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {verifiedHomeSellers.map((seller) => (
                      <div
                        key={seller.userId}
                        className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                            <span>{seller.city}</span>
                            <VerifiedSellerBadge variant="badge" />
                          </div>
                          <h3 className="mt-2 font-display text-lg font-bold text-[var(--color-ink)]">
                            {seller.displayName}
                          </h3>
                          <p className="mt-1.5 text-sm text-[var(--color-muted)] line-clamp-2">
                            {seller.bio}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs gap-2">
                          <span className="text-[var(--color-muted)] tabular-nums inline-flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-bold text-[var(--color-ink)]">
                              <Star
                                size={13}
                                className="text-[var(--color-gold)] fill-[var(--color-gold)]"
                                aria-hidden="true"
                              />
                              <span>{seller.rating.toFixed(1)}</span>
                              {seller.ratingCount !== undefined && (
                                <span className="font-normal text-[var(--color-muted)]">
                                  ({seller.ratingCount})
                                </span>
                              )}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              خبرة {seller.yearsExperience} سنة · {seller.totalSales} بيعة
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSellerId(seller.userId);
                              navigate('seller');
                            }}
                            className="font-semibold text-[var(--color-green-ink)] hover:underline shrink-0 cursor-pointer"
                          >
                            ملف المربي
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {otherHomeSellers.length > 0 && (
                <div className="pt-8 border-t border-[var(--color-border)]">
                  <div className="mb-6">
                    <h3 className="font-display text-xl font-bold text-[var(--color-ink)]">
                      مربون وبائعون آخرون في السوق
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      حسابات مسجلة يمكنك تصفح مراحاتها وإعلاناتها، ولم تُستكمل إجراءات توثيقها المعتمدة بعد
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {otherHomeSellers.map((seller) => (
                      <div
                        key={seller.userId}
                        className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                            <span>{seller.city}</span>
                            <span className="text-[11px] font-medium text-[var(--color-muted)]">
                              {seller.verificationStatus === 'Pending'
                                ? 'قيد مراجعة التوثيق'
                                : 'حساب غير موثق بعد'}
                            </span>
                          </div>
                          <h4 className="mt-2 font-display text-lg font-bold text-[var(--color-ink)]">
                            {seller.displayName}
                          </h4>
                          <p className="mt-1.5 text-sm text-[var(--color-muted)] line-clamp-2">
                            {seller.bio}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs gap-2">
                          <span className="text-[var(--color-muted)] tabular-nums inline-flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-bold text-[var(--color-ink)]">
                              <Star
                                size={13}
                                className="text-[var(--color-gold)] fill-[var(--color-gold)]"
                                aria-hidden="true"
                              />
                              <span>{seller.rating.toFixed(1)}</span>
                              {seller.ratingCount !== undefined && (
                                <span className="font-normal text-[var(--color-muted)]">
                                  ({seller.ratingCount})
                                </span>
                              )}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              خبرة {seller.yearsExperience} سنة · {seller.totalSales} بيعة
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSellerId(seller.userId);
                              navigate('seller');
                            }}
                            className="font-semibold text-[var(--color-green-ink)] hover:underline shrink-0 cursor-pointer"
                          >
                            ملف المربي
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* LISTINGS DIRECTORY */}
        {page === 'listings' && (
          <ListingsDirectory
            listings={publishedListings}
            categories={bootstrap.categories}
            breeds={bootstrap.breeds}
            regions={bootstrap.regions}
            sellers={bootstrap.sellers}
            favoriteIds={bootstrap.favoriteIds}
            likedListingIds={bootstrap.likedListingIds || []}
            filters={filters}
            onChangeFilters={setFilters}
            onResetFilters={() => setFilters(DEFAULT_FILTERS)}
            onSelectListing={handleSelectListing}
            onToggleFavorite={handleToggleFavorite}
            onToggleLike={handleToggleLike}
          />
        )}

        {/* LISTING DETAIL */}
        {page === 'detail' && (
          selectedListing ? (
            <ListingDetailView
              key={selectedListing.id}
              listing={selectedListing}
              currentUser={bootstrap.currentUser}
              category={bootstrap.categories.find((c) => c.id === selectedListing.categoryId)}
              subCategory={bootstrap.categories.find((c) => c.id === selectedListing.subCategoryId)}
              breed={bootstrap.breeds.find((b) => b.id === selectedListing.breedId)}
              region={bootstrap.regions.find((r) => r.id === selectedListing.regionId)}
              seller={bootstrap.sellers.find((s) => s.userId === selectedListing.sellerId)}
              offers={bootstrap.priceOffers || []}
              isFavorite={bootstrap.favoriteIds.includes(selectedListing.id)}
              isLiked={(bootstrap.likedListingIds || []).includes(selectedListing.id)}
              onBack={() => navigate('listings')}
              onToggleFavorite={handleToggleFavorite}
              onToggleLike={handleToggleLike}
              onStartConversation={handleStartConversation}
              onSubmitPriceOffer={handleSubmitPriceOffer}
              onRespondToOffer={handleRespondToOffer}
              onReportListing={handleReportListing}
              onOpenSellerProfile={(sellerId) => {
                setSelectedSellerId(sellerId);
                navigate('seller');
              }}
              onNotify={notify}
              comparableListings={publishedListings}
              allCategories={bootstrap.categories}
              allBreeds={bootstrap.breeds}
              allRegions={bootstrap.regions}
              allSellers={bootstrap.sellers}
              compareIds={compareIds}
              compareListings={compareListings}
              onToggleCompare={handleToggleCompare}
              onClearCompare={handleClearCompare}
              onSelectListing={handleSelectListing}
              commentRefreshSignal={commentRefreshMap[selectedListing.id] || 0}
              onRequireAuth={() => navigate('login')}
            />
          ) : (
            <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
              <div
                role="status"
                className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8 text-center space-y-4 shadow-sm"
              >
                <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-[var(--color-cream)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-gold)]">
                  إعلان غير متاح
                </div>
                <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
                  الإعلان غير موجود أو غير متاح للعرض
                </h1>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                  تعذر العثور على الإعلان المطلوب؛ قد يكون محذوفاً أو لم يُنشر بعد أو لا تملك صلاحية عرضه.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(DEFAULT_FILTERS);
                      navigate('listings');
                    }}
                    className="px-5 py-2.5 rounded-lg bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white text-sm font-semibold cursor-pointer"
                  >
                    تصفح الإعلانات المتاحة
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('home')}
                    className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] hover:bg-[var(--color-cream-hover)] text-[var(--color-ink)] text-sm font-semibold cursor-pointer"
                  >
                    العودة للرئيسية
                  </button>
                  {!bootstrap.currentUser && (
                    <button
                      type="button"
                      onClick={() => navigate('login')}
                      className="px-5 py-2.5 rounded-lg border border-[var(--color-green-ink)] text-[var(--color-green-ink)] hover:bg-[var(--color-cream)] text-sm font-semibold cursor-pointer"
                    >
                      تسجيل الدخول
                    </button>
                  )}
                </div>
              </div>
            </section>
          )
        )}

        {/* LOGIN / REGISTER (also shown in place of pages that need an account) */}
        {!bootstrap.currentUser && (page === 'login' || page === 'add' || page === 'dashboard') && (
          <AuthView
            reason={page === 'login' ? undefined : 'سجّل الدخول أو أنشئ حساباً للمتابعة إلى هذه الصفحة.'}
            onLogin={handleLogin}
            onRegister={handleRegister}
          />
        )}

        {/* ADD / EDIT LISTING */}
        {page === 'add' && bootstrap.currentUser && (
          <AddListingView
            key={editingListing?.id || 'new'}
            categories={bootstrap.categories}
            breeds={bootstrap.breeds}
            regions={bootstrap.regions}
            isAdmin={bootstrap.currentUser.role === 'admin'}
            editingListing={editingListing}
            onCreate={handleCreateListing}
            onUpdate={handleUpdateListing}
            onCancel={() => {
              if (editingListing) {
                setEditingListingId(null);
                navigate('dashboard');
              } else {
                navigate('home');
              }
            }}
          />
        )}

        {/* BREEDS & INDICATIVE PRICES */}
        {page === 'breeds' && (
          <BreedsAndPricesView
            breeds={bootstrap.breeds}
            categories={bootstrap.categories}
            indicativePrices={bootstrap.indicativePrices}
            onFilterByBreed={(breedId) => {
              setFilters({ ...DEFAULT_FILTERS, breedId });
              navigate('listings');
            }}
          />
        )}

        {/* BREEDERS, ARTICLES & FAQ */}
        {page === 'breeders' && (
          <BreedersAndGuidesView
            sellers={bootstrap.sellers}
            articles={bootstrap.articles}
            faqs={bootstrap.faqs}
            indicativePrices={bootstrap.indicativePrices}
            onOpenSeller={(sellerId) => {
              setSelectedSellerId(sellerId);
              navigate('seller');
            }}
          />
        )}

        {/* SELLER PROFILE */}
        {page === 'seller' && (
          selectedSeller ? (
            <SellerProfileView
              seller={selectedSeller}
              currentUser={bootstrap.currentUser}
              listings={publishedListings}
              breeds={bootstrap.breeds}
              regions={bootstrap.regions}
              favoriteIds={bootstrap.favoriteIds}
              likedListingIds={bootstrap.likedListingIds || []}
              reviews={bootstrap.sellerReviews || []}
              onBack={() => navigate('listings')}
              onSelectListing={handleSelectListing}
              onToggleFavorite={handleToggleFavorite}
              onToggleLike={handleToggleLike}
              onSubmitReview={handleSubmitSellerReview}
            />
          ) : (
            <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
              <div
                role="status"
                className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8 text-center space-y-4 shadow-sm"
              >
                <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-[var(--color-cream)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-gold)]">
                  ملف مربي غير متاح
                </div>
                <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
                  ملف المربي غير موجود أو غير متاح
                </h1>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                  تعذر العثور على بيانات المربي المطلوب في الدليل العام حالياً، أو أن هذا الحساب لا يمتلك ملف مراح عام.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('breeders')}
                    className="px-5 py-2.5 rounded-lg bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white text-sm font-semibold cursor-pointer"
                  >
                    استعراض دليل المربين
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(DEFAULT_FILTERS);
                      navigate('listings');
                    }}
                    className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] hover:bg-[var(--color-cream-hover)] text-[var(--color-ink)] text-sm font-semibold cursor-pointer"
                  >
                    تصفح الإعلانات
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('home')}
                    className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-ink)] text-sm font-semibold cursor-pointer"
                  >
                    العودة للرئيسية
                  </button>
                </div>
              </div>
            </section>
          )
        )}

        {/* ACCOUNT / DASHBOARD / MODERATION */}
        {page === 'dashboard' && bootstrap.currentUser && (
          <DashboardView
            requestedTab={dashboardRequestedTab}
            requestedConvId={dashboardRequestedConvId}
            onClearNavigationHint={clearDashboardHint}
            currentUser={bootstrap.currentUser}
            allListings={allListings}
            categories={bootstrap.categories}
            breeds={bootstrap.breeds}
            regions={bootstrap.regions}
            sellers={bootstrap.sellers}
            favoriteIds={bootstrap.favoriteIds}
            likedListingIds={bootstrap.likedListingIds || []}
            conversations={bootstrap.conversations}
            priceOffers={bootstrap.priceOffers || []}
            auditLogs={bootstrap.auditLogs}
            onLogout={handleLogout}
            onSelectListing={handleSelectListing}
            onEditListing={handleStartEditListing}
            onToggleFavorite={handleToggleFavorite}
            onToggleLike={handleToggleLike}
            onMarkSold={handleMarkSold}
            onSendMessage={handleSendMessage}
            onRespondToOffer={handleRespondToOffer}
            onApproveListing={handleApproveListing}
            onRejectListing={handleRejectListing}
            onCreateBreed={handleCreateBreed}
            onCreateSubCategory={handleCreateSubCategory}
            onUpdateSubCategory={handleUpdateSubCategory}
            onDeleteSubCategory={handleDeleteSubCategory}
            onAutoCategorizeListings={handleAutoCategorizeListings}
            onRefreshData={loadAllData}
            onNotify={notify}
          />
        )}
        </Suspense>
      </main>

      <Footer onNavigate={navigate} />
    </div>
  );
}
