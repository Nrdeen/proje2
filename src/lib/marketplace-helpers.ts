import type { Listing, SellerProfile } from '../types/marketplace';

/**
 * Resolves a requested listing strictly by ID without falling back to an unrelated listing.
 */
export function resolveRequestedListing(params: {
  listingId: string | null;
  allListings: Listing[];
  publishedListings: Listing[];
}): Listing | null {
  const id = params.listingId?.trim();
  if (!id) return null;
  return (
    params.allListings.find((item) => item.id === id) ||
    params.publishedListings.find((item) => item.id === id) ||
    null
  );
}

/**
 * Resolves a requested seller profile strictly by userId.
 */
export function resolveRequestedSeller(params: {
  sellerId: string | null;
  sellers: SellerProfile[];
}): SellerProfile | null {
  const id = params.sellerId?.trim();
  if (!id) return null;
  return params.sellers.find((seller) => seller.userId === id) || null;
}

/**
 * Partitions sellers so only strictly verified sellers appear under "Verified Breeders" headings,
 * while keeping non-verified sellers browsable in a separately labeled section.
 */
export function partitionSellersByVerification(sellers: SellerProfile[]): {
  verifiedSellers: SellerProfile[];
  otherSellers: SellerProfile[];
} {
  const verifiedSellers: SellerProfile[] = [];
  const otherSellers: SellerProfile[] = [];

  for (const seller of sellers) {
    if (seller.verificationStatus === 'Verified') {
      verifiedSellers.push(seller);
    } else {
      otherSellers.push(seller);
    }
  }

  return { verifiedSellers, otherSellers };
}
