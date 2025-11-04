/**
 * Rewardful utility functions
 * Handles Rewardful referral tracking and integration
 */

/**
 * Get Rewardful referral ID from cookie
 * Rewardful stores referral information in a cookie named 'rwf_*' or similar
 */
export function getRewardfulReferral(): string | null {
  if (typeof window === 'undefined') return null;

  // Rewardful typically stores referral in a cookie or in window object
  // Check for common Rewardful cookie patterns
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name.startsWith('rwf_') || name.startsWith('rewardful_')) {
      return value;
    }
  }

  // Check window object for Rewardful data
  const rewardful = (window as any).rewardful;
  if (rewardful?.referral) {
    return rewardful.referral;
  }

  // Check for Rewardful in URL parameters
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref') || params.get('rewardful');
  if (ref) {
    return ref;
  }

  return null;
}

/**
 * Get Rewardful referral for server-side usage
 * Note: This requires passing the referral from client to server
 */
export function parseRewardfulFromRequest(referral?: string): string | undefined {
  return referral || undefined;
}

