// Team (staff) payouts: each staff member earns a fixed share of the PLATFORM fee
// share on all site trading since the day they joined. Paid by the bot wallet on claim.
export const STAFF_MAX = 4;
export const PLATFORM_SHARE = 0.7; // platform keeps 70% of the 1% trade fee
export const STAFF_SHARE_OF_PLATFORM = 0.05; // 5% each (4 × 5% = 20% of the platform share)
export const STAFF_MIN_CLAIM_HBAR = 1;

/** HBAR a staff member earned from the total trade fees collected since they joined. */
export const staffEarned = (totalFeesHbar: number) =>
  totalFeesHbar * PLATFORM_SHARE * STAFF_SHARE_OF_PLATFORM;

/** Claimable = earned minus everything already paid or in flight. */
export const staffClaimable = (earned: number, paid: number) => Math.max(0, earned - paid);
