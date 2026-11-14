import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Pencil, Send, ShieldAlert, ShieldCheck } from 'lucide-react';
import type {
  AuditLog,
  Breed,
  Category,
  Conversation,
  Listing,
  PriceOffer,
  Region,
  SellerProfile,
  SellerVerificationState,
  User,
} from '../types/marketplace';
import { api } from '../lib/api';
import { formatPriceSar, formatRelativeArabicTime, formatStatusLabel } from '../lib/format';
import { ListingCard } from './ListingCard';
import { AdminDashboardPanel } from './AdminDashboardPanel';
import { VerifiedSellerBadge } from './VerifiedSellerBadge';

// Recharts is heavy: the analytics charts are only fetched when an analytics/admin tab is opened.
const DashboardAnalytics = lazy(() =>
  import('./DashboardAnalytics').then((m) => ({ default: m.DashboardAnalytics })),
);

export type DashboardTab = 'my-listings' | 'favorites' | 'likes' | 'messages' | 'analytics' | 'admin';

interface DashboardViewProps {
  requestedTab?: DashboardTab | null;
  requestedConvId?: string | null;
  onClearNavigationHint?: () => void;
  currentUser: User;
  allListings: Listing[];
  categories: Category[];
  breeds: Breed[];
  regions: Region[];
  sellers: SellerProfile[];
  favoriteIds: string[];
  likedListingIds: string[];
  conversations: Conversation[];
  priceOffers: PriceOffer[];
  auditLogs: AuditLog[];
  onLogout: () => Promise<void>;
  onSelectListing: (listing: Listing) => void;
  onEditListing: (listing: Listing) => void;
  onToggleFavorite: (listingId: string) => void;
  onToggleLike: (listingId: string) => void;
  onMarkSold: (listingId: string) => Promise<void>;
  onSendMessage: (conversationId: string, body: string) => Promise<void>;
  onRespondToOffer: (offerId: string, status: 'accepted' | 'rejected') => Promise<void>;
  onApproveListing: (listingId: string) => Promise<void>;
  onRejectListing: (listingId: string, reason: string) => Promise<void>;
  onCreateBreed: (payload: {
    name: string;
    categoryId: string;
    origin: string;
    summary: string;
    avgWeightKg: string;
    priceRangeSar: string;
  }) => Promise<void>;
  onCreateSubCategory: (payload: {
    name: string;
    parentId: string;
    description: string;
    keywords: string;
  }) => Promise<void>;
  onUpdateSubCategory: (
    id: string,
    payload: {
      name: string;
      parentId: string;
      description: string;
      keywords: string;
    }
  ) => Promise<void>;
  onDeleteSubCategory: (id: string) => Promise<void>;
  onAutoCategorizeListings: (payload?: { listingId?: string; subCategoryId?: string }) => Promise<void>;
  onRefreshData?: () => Promise<void>;
  onNotify?: (message: string) => void;
}

function AnalyticsFallback() {
  return (
    <div className="py-16 text-center" role="status" aria-live="polite">
      <p className="text-sm text-[var(--color-muted)]">جاري تحميل الرسوم البيانية...</p>
    </div>
  );
}

export function DashboardView({
  requestedTab,
  requestedConvId,
  onClearNavigationHint,
  currentUser,
  allListings,
  categories,
  breeds,
  regions,
  sellers,
  favoriteIds,
  likedListingIds,
  conversations,
  priceOffers,
  auditLogs,
  onLogout,
  onSelectListing,
  onEditListing,
  onToggleFavorite,
  onToggleLike,
  onMarkSold,
  onSendMessage,
  onRespondToOffer,
  onApproveListing,
  onRejectListing,
  onCreateBreed,
  onCreateSubCategory,
  onUpdateSubCategory,
  onDeleteSubCategory,
  onAutoCategorizeListings,
  onRefreshData,
  onNotify,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    requestedTab || (currentUser.role === 'admin' ? 'admin' : 'my-listings')
  );
  const [selectedConvId, setSelectedConvId] = useState<string>(
    requestedConvId || conversations[0]?.id || ''
  );
  const [replyText, setReplyText] = useState('');

  const [myVerification, setMyVerification] = useState<SellerVerificationState | null>(null);
  const [requestingVerification, setRequestingVerification] = useState(false);

  const loadMyVerification = useCallback(async () => {
    try {
      const res = await api.getMySellerVerification();
      setMyVerification(res.seller);
    } catch {
      // Ignore silent check failure
    }
  }, []);

  useEffect(() => {
    loadMyVerification();
  }, [loadMyVerification, currentUser.id]);

  const handleRequestVerification = async () => {
    setRequestingVerification(true);
    try {
      const res = await api.requestSellerVerification();
      setMyVerification(res.seller);
      onNotify?.('تم إرسال طلب توثيق المربي لمراجعة الإدارة');
      await onRefreshData?.();
    } catch (err: any) {
      onNotify?.(err?.message || 'تعذر إرسال طلب التوثيق');
    } finally {
      setRequestingVerification(false);
    }
  };

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab);
      if (requestedConvId) {
        setSelectedConvId(requestedConvId);
      }
      onClearNavigationHint?.();
    }
  }, [requestedTab, requestedConvId, onClearNavigationHint]);

  const myListings = allListings.filter((l) => l.sellerId === currentUser.id);
  const myOffers = priceOffers.filter(
    (o) =>
      o.sellerId === currentUser.id ||
      o.buyerId === currentUser.id ||
      currentUser.role === 'admin'
  );
  const favoriteListings = allListings.filter(
    (l) => favoriteIds.includes(l.id) && l.status === 'Published'
  );
  const likedListings = allListings.filter(
    (l) => likedListingIds.includes(l.id) && l.status === 'Published'
  );
  const pendingListings = allListings.filter((l) => l.status === 'Pending');

  const activeConv =
    conversations.find((c) => c.id === selectedConvId) || conversations[0] || null;

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !replyText.trim()) return;
    try {
      await onSendMessage(activeConv.id, replyText.trim());
      setReplyText('');
    } catch {
      // The app already showed the error toast; keep the typed reply so the user can retry.
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Account Bar & Role Switcher */}
      <div className="bg-[var(--color-cream)] rounded-xl border border-[var(--color-border)] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-medium text-[var(--color-muted)]">
            الحساب النشط حالياً ·{' '}
            {currentUser.role === 'admin'
              ? 'مشرف المنصة'
              : currentUser.role === 'seller'
              ? 'بائع / مربي'
              : 'مشتري'}
          </p>
          <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)] mt-1">
            مرحباً، {currentUser.name}
          </h1>
          <p className="text-xs text-[var(--color-muted)] tabular-nums mt-1">
            رقم الجوال: {currentUser.phone}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onLogout()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-cream-hover)]"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>

      {/* Navigation Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('my-listings')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === 'my-listings'
              ? 'bg-[var(--color-green)] text-white'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-cream)]'
          }`}
        >
          إعلاناتي ({myListings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('favorites')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === 'favorites'
              ? 'bg-[var(--color-green)] text-white'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-cream)]'
          }`}
        >
          المفضلة ({favoriteListings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('likes')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === 'likes'
              ? 'bg-[var(--color-green)] text-white'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-cream)]'
          }`}
        >
          إعجاباتي ({likedListings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === 'messages'
              ? 'bg-[var(--color-green)] text-white'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-cream)]'
          }`}
        >
          المحادثات ({conversations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-[var(--color-green)] text-white'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-cream)]'
          }`}
        >
          لوحة تحكم الأداء
        </button>
        {currentUser.role === 'admin' && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-[var(--color-gold)] text-[#14261D]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-cream)]'
            }`}
          >
            لوحة المشرف ({pendingListings.length} بانتظار المراجعة)
          </button>
        )}
      </div>

      {/* Tab 1: My Listings */}
      {activeTab === 'my-listings' && (
        <div className="space-y-8">
          {(currentUser.role === 'seller' || myListings.length > 0 || myVerification) && (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--color-muted)]">
                    حالة توثيق المربي:
                  </span>
                  {myVerification?.verificationStatus === 'Verified' ? (
                    <VerifiedSellerBadge variant="badge" label="حساب مربي موثق ومعتمد" />
                  ) : myVerification?.verificationStatus === 'Rejected' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400">
                      <ShieldAlert size={14} aria-hidden="true" />
                      <span>لم يُعتمد طلب التوثيق</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-gold)]">
                      <ShieldCheck size={14} aria-hidden="true" />
                      <span>
                        {myVerification
                          ? 'طلب التوثيق قيد مراجعة الإدارة'
                          : 'غير موثق بعد — يمكنك تقديم طلب توثيق'}
                      </span>
                    </span>
                  )}
                </div>
                {myVerification?.verificationNote && (
                  <p className="text-xs text-[var(--color-muted)]">
                    ملاحظة الإدارة: {myVerification.verificationNote}
                  </p>
                )}
              </div>

              {(!myVerification || myVerification.verificationStatus === 'Rejected') && (
                <button
                  type="button"
                  disabled={requestingVerification}
                  onClick={handleRequestVerification}
                  className="px-4 py-2 rounded-lg bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {requestingVerification
                    ? 'جاري الإرسال...'
                    : myVerification?.verificationStatus === 'Rejected'
                    ? 'إعادة إرسال طلب التوثيق'
                    : 'تقديم طلب توثيق مربي'}
                </button>
              )}
            </div>
          )}
          {myListings.length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 text-center">
              <p className="font-display text-lg font-bold text-[var(--color-ink)]">
                لم تقم بإضافة أي إعلانات بعد بهذا الحساب
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                يمكنك إضافة إعلان جديد من زر «أضف إعلانك».
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mobile card layout (320px - 767px): prevents horizontal clipping */}
              <div className="md:hidden space-y-3">
                {myListings.map((item) => (
                  <article
                    key={item.id}
                    className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectListing(item)}
                        className="font-display font-bold text-sm text-[var(--color-ink)] hover:text-[var(--color-green-ink)] text-right cursor-pointer break-words min-w-0 flex-1"
                      >
                        {item.title}
                      </button>
                      <span className="shrink-0 px-2.5 py-1 rounded-md bg-[var(--color-cream)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-ink)] whitespace-nowrap">
                        {formatStatusLabel(item.status)}
                      </span>
                    </div>

                    {item.rejectionReason && (
                      <p className="text-xs text-red-700 dark:text-red-400 break-words">
                        سبب الرفض: {item.rejectionReason}
                      </p>
                    )}

                    <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                      <div className="font-bold text-sm text-[var(--color-green-ink)] tabular-nums">
                        {formatPriceSar(item.priceAmount)}
                      </div>
                      {item.expectedPrice && (
                        <p className="text-xs font-medium text-[var(--color-muted)] tabular-nums">
                          المتوقع: {formatPriceSar(item.expectedPrice)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onEditListing(item)}
                        className="flex-1 min-w-[110px] min-h-[40px] px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-green-ink)] hover:bg-[var(--color-cream)] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Pencil size={13} aria-hidden="true" />
                        <span>تعديل</span>
                      </button>
                      {item.status === 'Published' && (
                        <button
                          type="button"
                          onClick={() => onMarkSold(item.id)}
                          className="flex-1 min-w-[110px] min-h-[40px] px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-cream)] inline-flex items-center justify-center cursor-pointer"
                        >
                          تحديد كمباع
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {/* Tablet & Desktop table (768px+) with horizontal scroll protection */}
              <div className="hidden md:block bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-x-auto">
                <table className="w-full min-w-[640px] text-right border-collapse">
                  <thead>
                    <tr className="bg-[var(--color-cream)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-muted)]">
                      <th className="py-3 px-4">الإعلان</th>
                      <th className="py-3 px-4 whitespace-nowrap">السعر</th>
                      <th className="py-3 px-4 whitespace-nowrap">الحالة</th>
                      <th className="py-3 px-4 whitespace-nowrap">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] text-sm">
                    {myListings.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => onSelectListing(item)}
                            className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-green-ink)] text-right cursor-pointer"
                          >
                            {item.title}
                          </button>
                          {item.rejectionReason && (
                            <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                              سبب الرفض: {item.rejectionReason}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[var(--color-green-ink)] tabular-nums whitespace-nowrap">
                          <div>{formatPriceSar(item.priceAmount)}</div>
                          {item.expectedPrice && (
                            <p className="text-[11px] font-medium text-[var(--color-muted)] mt-0.5">
                              المتوقع: {formatPriceSar(item.expectedPrice)}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-[var(--color-ink)] whitespace-nowrap">
                          {formatStatusLabel(item.status)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onEditListing(item)}
                              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-green-ink)] hover:bg-[var(--color-cream)] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil size={13} aria-hidden="true" />
                              <span>تعديل</span>
                            </button>
                            {item.status === 'Published' && (
                              <button
                                type="button"
                                onClick={() => onMarkSold(item.id)}
                                className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-cream)] cursor-pointer"
                              >
                                تحديد كمباع
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Price Offers / Negotiation Activity */}
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--color-ink)]">
                عروض الأسعار والتفاوض (السوم) ({myOffers.length})
              </h2>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                متابعة عروض الأسعار الواردة على إعلاناتك أو العروض التي أرسلتها للمربين
              </p>
            </div>

            {myOffers.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                لا توجد عروض أسعار مسجلة لهذا الحساب حالياً.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-right text-sm border-collapse">
                  <thead>
                    <tr className="bg-[var(--color-cream)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-muted)]">
                      <th className="py-2.5 px-3">الإعلان</th>
                      <th className="py-2.5 px-3">المشتري</th>
                      <th className="py-2.5 px-3">العرض المقدم</th>
                      <th className="py-2.5 px-3">الحالة</th>
                      <th className="py-2.5 px-3 text-left">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {myOffers.map((offer) => {
                      const listing = allListings.find((l) => l.id === offer.listingId);
                      const canRespond =
                        offer.status === 'pending' &&
                        (offer.sellerId === currentUser.id || currentUser.role === 'admin');
                      return (
                        <tr key={offer.id}>
                          <td className="py-3 px-3">
                            {listing ? (
                              <button
                                type="button"
                                onClick={() => onSelectListing(listing)}
                                className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-green-ink)] text-right cursor-pointer"
                              >
                                {listing.title}
                              </button>
                            ) : (
                              <span className="text-[var(--color-muted)]">{offer.listingId}</span>
                            )}
                            {offer.note && (
                              <p className="text-xs text-[var(--color-muted)] mt-0.5">{offer.note}</p>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs text-[var(--color-ink)] whitespace-nowrap">
                            {offer.buyerName}
                          </td>
                          <td className="py-3 px-3 font-bold text-[var(--color-green-ink)] tabular-nums whitespace-nowrap">
                            {formatPriceSar(offer.offeredPrice)} × {offer.quantity}
                          </td>
                          <td className="py-3 px-3 text-xs font-semibold whitespace-nowrap">
                            <span
                              className={
                                offer.status === 'accepted'
                                  ? 'text-[var(--color-green-ink)]'
                                  : offer.status === 'rejected'
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-[var(--color-gold)]'
                              }
                            >
                              {offer.status === 'accepted'
                                ? 'مقبول'
                                : offer.status === 'rejected'
                                ? 'مرفوض'
                                : 'بانتظار الرد'}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {canRespond && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onRespondToOffer(offer.id, 'accepted')}
                                  className="px-2.5 py-1 rounded-lg bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white text-xs font-semibold cursor-pointer"
                                >
                                  قبول
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRespondToOffer(offer.id, 'rejected')}
                                  className="px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold cursor-pointer"
                                >
                                  رفض
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Favorites */}
      {activeTab === 'favorites' && (
        <div>
          {favoriteListings.length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 text-center">
              <p className="font-display text-lg font-bold text-[var(--color-ink)]">
                قائمة المفضلة فارغة
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                اضغط على أيقونة القلب في أي إعلان لحفظه والرجوع إليه لاحقاً.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favoriteListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  breed={breeds.find((b) => b.id === listing.breedId)}
                  subCategory={categories.find((c) => c.id === listing.subCategoryId)}
                  region={regions.find((r) => r.id === listing.regionId)}
                  seller={sellers.find((s) => s.userId === listing.sellerId)}
                  isFavorite={true}
                  isLiked={likedListingIds.includes(listing.id)}
                  onSelect={onSelectListing}
                  onToggleFavorite={onToggleFavorite}
                  onToggleLike={onToggleLike}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2b: Liked Listings (Separate from Saved Favorites) */}
      {activeTab === 'likes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--color-ink)]">
                الإعلانات التي أعجبتك ({likedListings.length})
              </h2>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                سجل تفاعلات الإعجاب العامة على الإعلانات المنشورة، بشكل منفصل عن قائمة المفضلة الخاصة بك.
              </p>
            </div>
          </div>

          {likedListings.length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 text-center">
              <p className="font-display text-lg font-bold text-[var(--color-ink)]">
                لم تسجل إعجاباً بأي إعلان بعد
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                اضغط على زر «إعجاب» في أي إعلان منشور لدعم البائع وإضافته إلى قائمتك هنا.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {likedListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  breed={breeds.find((b) => b.id === listing.breedId)}
                  subCategory={categories.find((c) => c.id === listing.subCategoryId)}
                  region={regions.find((r) => r.id === listing.regionId)}
                  seller={sellers.find((s) => s.userId === listing.sellerId)}
                  isFavorite={favoriteIds.includes(listing.id)}
                  isLiked={true}
                  onSelect={onSelectListing}
                  onToggleFavorite={onToggleFavorite}
                  onToggleLike={onToggleLike}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Conversations */}
      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden min-h-[420px]">
          <div className="lg:col-span-4 border-l border-[var(--color-border)] bg-[var(--color-cream)]/40 divide-y divide-[var(--color-border)]">
            {conversations.length === 0 ? (
              <p className="p-6 text-sm text-[var(--color-muted)]">لا توجد محادثات حتى الآن.</p>
            ) : (
              conversations.map((conv) => {
                const listing = allListings.find((l) => l.id === conv.listingId);
                const selected = activeConv?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`w-full text-right p-4 transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[var(--color-surface)]'
                        : 'hover:bg-[var(--color-surface)]/60'
                    }`}
                  >
                    <p className="font-display text-sm font-bold text-[var(--color-ink)] truncate">
                      {listing?.title || 'استفسار عن إعلان'}
                    </p>
                    <p className="text-xs text-[var(--color-muted)] mt-1 truncate">
                      {conv.messages[conv.messages.length - 1]?.body || 'بدء المحادثة'}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          <div className="lg:col-span-8 flex flex-col justify-between">
            {activeConv ? (
              <>
                <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-cream)]/30">
                  <p className="font-display text-base font-bold text-[var(--color-ink)]">
                    {allListings.find((l) => l.id === activeConv.listingId)?.title}
                  </p>
                </div>

                <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[340px]">
                  {activeConv.messages.map((msg) => {
                    const isMine = msg.senderId === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`max-w-md rounded-xl px-4 py-2.5 text-sm ${
                            isMine
                              ? 'bg-[var(--color-green)] text-white'
                              : 'bg-[var(--color-cream)] text-[var(--color-ink)] border border-[var(--color-border)]'
                          }`}
                        >
                          <p>{msg.body}</p>
                        </div>
                        <span className="text-[11px] text-[var(--color-muted)] mt-1">
                          {formatRelativeArabicTime(msg.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleReplySubmit}
                  className="p-4 border-t border-[var(--color-border)] flex gap-2"
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    className="flex-1 h-11 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/75"
                  />
                  <button
                    type="submit"
                    className="h-11 px-5 rounded-lg bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Send size={15} aria-hidden="true" />
                    <span>إرسال</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-[var(--color-muted)]">
                اختر محادثة لعرض الرسائل أو أرسل استفساراً من أي صفحة إعلان.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Dashboard Analytics */}
      {activeTab === 'analytics' && (
        <Suspense fallback={<AnalyticsFallback />}>
          <DashboardAnalytics
            listings={allListings}
            regions={regions}
            isAdmin={currentUser.role === 'admin'}
          />
        </Suspense>
      )}

      {/* Tab 5: Admin Moderation Panel */}
      {activeTab === 'admin' && (
        <div className="space-y-8">
          {currentUser.role !== 'admin' ? (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 text-center max-w-xl mx-auto">
              <p className="font-display text-lg font-bold text-[var(--color-ink)]">
                لوحة الإشراف مخصصة لإدارة المنصة
              </p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                إدارة المستخدمين وتوثيق المربين واعتماد الإعلانات ومعالجة البلاغات متاحة لحسابات المشرفين فقط.
              </p>
            </div>
          ) : (
            <AdminDashboardPanel
              currentUser={currentUser}
              allListings={allListings}
              categories={categories}
              breeds={breeds}
              regions={regions}
              sellers={sellers}
              auditLogs={auditLogs}
              onSelectListing={onSelectListing}
              onApproveListing={onApproveListing}
              onRejectListing={onRejectListing}
              onCreateBreed={onCreateBreed}
              onCreateSubCategory={onCreateSubCategory}
              onUpdateSubCategory={onUpdateSubCategory}
              onDeleteSubCategory={onDeleteSubCategory}
              onAutoCategorizeListings={onAutoCategorizeListings}
              onRefreshData={onRefreshData}
              onNotify={onNotify}
            />
          )}
        </div>
      )}
    </section>
  );
}
