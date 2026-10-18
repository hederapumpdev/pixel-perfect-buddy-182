// Team (staff) payouts: each staff member earns their own % of the PLATFORM fee share on
// all site trading. The admin can change a member's % over time; past earnings are frozen
// at the old % (earned_before) and the new % only counts from the change (rate_since).
export const STAFF_MAX = 4;
export const PLATFORM_SHARE = 0.7; // platform keeps 70% of the 1% trade fee
export const STAFF_DEFAULT_PCT = 5; // % of the platform share per member
export const STAFF_MAX_PCT = 20; // highest % one member can get
export const STAFF_MIN_CLAIM_HBAR = 1;

/** HBAR earned from total trade fees at a given % of the platform share. */
export const staffEarned = (totalFeesHbar: number, pct = STAFF_DEFAULT_PCT) =>
  totalFeesHbar * PLATFORM_SHARE * (pct / 100);

/** Claimable = earned minus everything already paid or in flight. */
export const staffClaimable = (earned: number, paid: number) => Math.max(0, earned - paid);
