import { useMemo } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import type { Breed, Category, Listing, Region, SellerProfile } from '../types/marketplace';
import { ListingCard } from './ListingCard';

export interface DirectoryFilters {
  q: string;
  categoryId: string;
  subCategoryId: string;
  breedId: string;
  regionId: string;
  minPrice: string;
  maxPrice: string;
  sex: string;
  negotiableOnly: boolean;
  sort: 'newest' | 'price_asc' | 'price_desc' | 'most_liked';
}

interface ListingsDirectoryProps {
  listings: Listing[];
  categories: Category[];
  breeds: Breed[];
  regions: Region[];
  sellers: SellerProfile[];
  favoriteIds: string[];
  likedListingIds: string[];
  filters: DirectoryFilters;
  onChangeFilters: (next: DirectoryFilters) => void;
  onResetFilters: () => void;
  onSelectListing: (listing: Listing) => void;
  onToggleFavorite: (listingId: string) => void;
  onToggleLike: (listingId: string) => void;
}

export function ListingsDirectory({
  listings,
  categories,
  breeds,
  regions,
  sellers,
  favoriteIds,
  likedListingIds,
  filters,
  onChangeFilters,
  onResetFilters,
  onSelectListing,
  onToggleFavorite,
  onToggleLike,
}: ListingsDirectoryProps) {
  const filtered = useMemo(() => {
    let result = listings.filter((l) => l.status === 'Published');

    if (filters.q.trim()) {
      const term = filters.q.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(term) ||
          l.description.toLowerCase().includes(term) ||
          l.city.toLowerCase().includes(term)
      );
    }
    if (filters.categoryId !== 'all') {
      result = result.filter((l) => l.categoryId === filters.categoryId);
    }
    if (filters.subCategoryId !== 'all') {
      result = result.filter((l) => l.subCategoryId === filters.subCategoryId);
    }
    if (filters.breedId !== 'all') {
      result = result.filter((l) => l.breedId === filters.breedId);
    }
    if (filters.regionId !== 'all') {
      result = result.filter((l) => l.regionId === filters.regionId);
    }
    if (filters.minPrice) {
      const min = Number(filters.minPrice);
      if (!Number.isNaN(min)) result = result.filter((l) => l.priceAmount >= min);
    }
    if (filters.maxPrice) {
      const max = Number(filters.maxPrice);
      if (!Number.isNaN(max)) result = result.filter((l) => l.priceAmount <= max);
    }
    if (filters.sex !== 'all') {
      result = result.filter((l) => l.sex === filters.sex);
    }
    if (filters.negotiableOnly) {
      result = result.filter((l) => l.isNegotiable);
    }

    if (filters.sort === 'price_asc') {
      result.sort((a, b) => a.priceAmount - b.priceAmount);
    } else if (filters.sort === 'price_desc') {
      result.sort((a, b) => b.priceAmount - a.priceAmount);
    } else if (filters.sort === 'most_liked') {
      result.sort(
        (a, b) =>
          (b.likesCount ?? 0) - (a.likesCount ?? 0) ||
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    } else {
      result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }

    return result;
  }, [listings, filters]);

  const mainCategories = useMemo(
    () => categories.filter((c) => c.parentId === null),
    [categories]
  );

  const subCategories = useMemo(
    () => categories.filter((c) => c.parentId !== null),
    [categories]
  );

  const availableBreeds = useMemo(() => {
    if (filters.categoryId === 'all') return breeds;
    return breeds.filter((b) => b.categoryId === filters.categoryId);
  }, [breeds, filters.categoryId]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)]">
            جميع إعلانات المواشي
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            تصفّح حسب السلالة والمنطقة والنطاق السعري والمواصفات المنظمة ({filtered.length} إعلان متاح)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label
            htmlFor="dir-sort"
            className="text-xs font-medium text-[var(--color-muted)] whitespace-nowrap"
          >
            ترتيب حسب:
          </label>
          <select
            id="dir-sort"
            value={filters.sort}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                sort: e.target.value as DirectoryFilters['sort'],
              })
            }
            className="h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-green-ink)]"
          >
            <option value="newest">الأحدث نشراً</option>
            <option value="most_liked">الأكثر إعجاباً</option>
            <option value="price_asc">السعر: من الأقل إلى الأعلى</option>
            <option value="price_desc">السعر: من الأعلى إلى الأقل</option>
          </select>
        </div>
      </div>

      {/* Smart Sub-Category Quick Filter Tabs */}
      {subCategories.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-muted)] ml-1">الغرض:</span>
          <button
            type="button"
            onClick={() => onChangeFilters({ ...filters, subCategoryId: 'all' })}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filters.subCategoryId === 'all'
                ? 'bg-[var(--color-green)] text-white'
                : 'bg-[var(--color-cream)] text-[var(--color-muted)] border border-[var(--color-border)] hover:text-[var(--color-ink)]'
            }`}
          >
            جميع الفئات الفرعية
          </button>
          {subCategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => onChangeFilters({ ...filters, subCategoryId: sub.id })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filters.subCategoryId === sub.id
                  ? 'bg-[var(--color-green)] text-white'
                  : 'bg-[var(--color-cream)] text-[var(--color-muted)] border border-[var(--color-border)] hover:text-[var(--color-ink)]'
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="mt-4 bg-[var(--color-cream)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>تصفية دقيقة للإعلانات</span>
          </div>
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-green-ink)] hover:underline cursor-pointer"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>إعادة ضبط الفلاتر</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label htmlFor="flt-q" className="block text-xs text-[var(--color-muted)] mb-1">
              كلمة البحث
            </label>
            <input
              id="flt-q"
              type="text"
              value={filters.q}
              onChange={(e) => onChangeFilters({ ...filters, q: e.target.value })}
              placeholder="نعيمي، فحل، جدة..."
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/75 focus:outline-none focus:border-[var(--color-green-ink)]"
            />
          </div>

          <div>
            <label htmlFor="flt-cat" className="block text-xs text-[var(--color-muted)] mb-1">
              التصنيف
            </label>
            <select
              id="flt-cat"
              value={filters.categoryId}
              onChange={(e) =>
                onChangeFilters({ ...filters, categoryId: e.target.value, breedId: 'all' })
              }
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-green-ink)]"
            >
              <option value="all">الكل</option>
              {mainCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="flt-breed" className="block text-xs text-[var(--color-muted)] mb-1">
              السلالة
            </label>
            <select
              id="flt-breed"
              value={filters.breedId}
              onChange={(e) => onChangeFilters({ ...filters, breedId: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-green-ink)]"
            >
              <option value="all">جميع السلالات</option>
              {availableBreeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="flt-region" className="block text-xs text-[var(--color-muted)] mb-1">
              المنطقة
            </label>
            <select
              id="flt-region"
              value={filters.regionId}
              onChange={(e) => onChangeFilters({ ...filters, regionId: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-green-ink)]"
            >
              <option value="all">جميع المناطق</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="flt-sex" className="block text-xs text-[var(--color-muted)] mb-1">
              الجنس
            </label>
            <select
              id="flt-sex"
              value={filters.sex}
              onChange={(e) => onChangeFilters({ ...filters, sex: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-green-ink)]"
            >
              <option value="all">الكل</option>
              <option value="ذكر">ذكر</option>
              <option value="أنثى">أنثى</option>
              <option value="قطيع مختلط">قطيع مختلط</option>
            </select>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="flt-minp" className="text-xs text-[var(--color-muted)]">
              السعر من:
            </label>
            <input
              id="flt-minp"
              type="number"
              min="0"
              value={filters.minPrice}
              onChange={(e) => onChangeFilters({ ...filters, minPrice: e.target.value })}
              placeholder="0"
              className="w-24 h-9 px-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] tabular-nums"
            />
            <label htmlFor="flt-maxp" className="text-xs text-[var(--color-muted)]">
              إلى:
            </label>
            <input
              id="flt-maxp"
              type="number"
              min="0"
              value={filters.maxPrice}
              onChange={(e) => onChangeFilters({ ...filters, maxPrice: e.target.value })}
              placeholder="5000"
              className="w-24 h-9 px-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] tabular-nums"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-[var(--color-ink)] cursor-pointer">
            <input
              type="checkbox"
              checked={filters.negotiableOnly}
              onChange={(e) =>
                onChangeFilters({ ...filters, negotiableOnly: e.target.checked })
              }
              className="w-4 h-4 accent-[#0B3A29]"
            />
            <span>القابلة للتفاوض فقط</span>
          </label>
        </div>
      </div>

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="mt-10 text-center py-14 px-6 bg-[var(--color-cream)]/60 border border-[var(--color-border)] rounded-xl">
          <p className="font-display text-lg font-bold text-[var(--color-ink)]">
            لا توجد إعلانات مطابقة للخيارات المحددة
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            جرّب توسيع النطاق السعري أو اختيار منطقة أخرى لعرض المزيد من العروض.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-5 px-5 py-2.5 rounded-lg bg-[var(--color-green)] text-white text-sm font-semibold hover:bg-[var(--color-green-hover)] cursor-pointer"
          >
            عرض جميع الإعلانات
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              breed={breeds.find((b) => b.id === listing.breedId)}
              subCategory={categories.find((c) => c.id === listing.subCategoryId)}
              region={regions.find((r) => r.id === listing.regionId)}
              seller={sellers.find((s) => s.userId === listing.sellerId)}
              isFavorite={favoriteIds.includes(listing.id)}
              isLiked={likedListingIds.includes(listing.id)}
              onSelect={onSelectListing}
              onToggleFavorite={onToggleFavorite}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>
      )}
    </section>
  );
}
