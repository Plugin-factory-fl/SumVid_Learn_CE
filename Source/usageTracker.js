/**
 * Usage Tracker Module
 * Handles daily reset logic and usage tracking for the freemium system
 * Frontend-only implementation using chrome.storage.local
 */

const ENHANCEMENTS_LIMIT = 10; // Free tier limit

/**
 * Gets the current UTC date string (YYYY-MM-DD format)
 * @returns {string} Current UTC date string
 */
function getCurrentUTCDateString() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Resets daily usage if the last reset date is not today
 * Uses UTC date to ensure consistency across timezones
 * @returns {Promise<boolean>} True if reset occurred, false if already reset today
 */
async function resetDailyUsageIfNeeded() {
  try {
    const result = await chrome.storage.local.get(['usage']);
    const usage = result.usage || {
      enhancementsUsed: 0,
      enhancementsLimit: ENHANCEMENTS_LIMIT,
      lastResetDate: null
    };

    const currentDate = getCurrentUTCDateString();
    const lastResetDate = usage.lastResetDate;

    // Check if reset is needed
    const needsReset = !lastResetDate || lastResetDate < currentDate;

    if (needsReset) {
      // Reset usage to 0 and update date
      const updatedUsage = {
        enhancementsUsed: 0,
        enhancementsLimit: ENHANCEMENTS_LIMIT,
        lastResetDate: currentDate
      };

      await chrome.storage.local.set({ usage: updatedUsage });
      console.log(`[UsageTracker] Daily usage reset (was ${usage.enhancementsUsed}, now 0)`);
      return true; // Reset occurred
    }

    console.log(`[UsageTracker] No reset needed - already reset today (count: ${usage.enhancementsUsed})`);
    return false; // Already reset today
  } catch (error) {
    console.error('[UsageTracker] Error resetting daily usage:', error);
    throw error;
  }
}

/**
 * Gets current usage stats with daily reset applied
 * @returns {Promise<Object>} Usage object with enhancementsUsed, enhancementsLimit, and lastResetDate
 */
async function getUsage() {
  try {
    // Reset if needed before fetching
    await resetDailyUsageIfNeeded();

    const result = await chrome.storage.local.get(['usage']);
    const usage = result.usage || {
      enhancementsUsed: 0,
      enhancementsLimit: ENHANCEMENTS_LIMIT,
      lastResetDate: getCurrentUTCDateString()
    };

    // Ensure limit is set correctly
    if (!usage.enhancementsLimit) {
      usage.enhancementsLimit = ENHANCEMENTS_LIMIT;
    }

    console.log(`[UsageTracker] getUsage:`, {
      enhancementsUsed: usage.enhancementsUsed,
      enhancementsLimit: usage.enhancementsLimit,
      lastResetDate: usage.lastResetDate
    });

    return {
      enhancementsUsed: usage.enhancementsUsed || 0,
      enhancementsLimit: usage.enhancementsLimit || ENHANCEMENTS_LIMIT,
      lastResetDate: usage.lastResetDate
    };
  } catch (error) {
    console.error('[UsageTracker] Error getting usage:', error);
    // Return default values on error
    return {
      enhancementsUsed: 0,
      enhancementsLimit: ENHANCEMENTS_LIMIT,
      lastResetDate: getCurrentUTCDateString()
    };
  }
}

/**
 * Increments usage counter and checks if limit is reached
 * @returns {Promise<Object>} Object with success boolean, usage stats, and error message if limit reached
 */
async function incrementUsage() {
  try {
    // Reset if needed before incrementing
    await resetDailyUsageIfNeeded();

    const currentUsage = await getUsage();

    // Check if limit is already reached
    if (currentUsage.enhancementsUsed >= currentUsage.enhancementsLimit) {
      return {
        success: false,
        error: 'Daily enhancement limit reached. Your limit will reset tomorrow.',
        usage: currentUsage
      };
    }

    // Increment usage
    const updatedUsage = {
      enhancementsUsed: currentUsage.enhancementsUsed + 1,
      enhancementsLimit: currentUsage.enhancementsLimit,
      lastResetDate: currentUsage.lastResetDate
    };

    await chrome.storage.local.set({ usage: updatedUsage });
    console.log(`[UsageTracker] Usage incremented: ${updatedUsage.enhancementsUsed}/${updatedUsage.enhancementsLimit}`);

    return {
      success: true,
      usage: updatedUsage
    };
  } catch (error) {
    console.error('[UsageTracker] Error incrementing usage:', error);
    throw error;
  }
}

/**
 * Checks if usage limit is reached without incrementing
 * @returns {Promise<boolean>} True if limit reached, false otherwise
 */
async function isLimitReached() {
  try {
    const usage = await getUsage();
    return usage.enhancementsUsed >= usage.enhancementsLimit;
  } catch (error) {
    console.error('[UsageTracker] Error checking limit:', error);
    return false; // Allow usage on error to avoid blocking users
  }
}

// Export to window for non-module usage
window.UsageTracker = {
  resetDailyUsageIfNeeded,
  getUsage,
  incrementUsage,
  isLimitReached
};
