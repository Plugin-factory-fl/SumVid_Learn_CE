/**
 * Stripe Utility Functions
 * Helper functions for linking Stripe customers to user accounts
 */

import Stripe from 'stripe';
import { query } from './database.js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20'
});

/**
 * Link a Stripe customer to a user account by email
 * @param {string} email - User's email address (will be normalized to lowercase)
 * @param {string} stripeCustomerId - Stripe customer ID to link
 * @returns {Promise<{linked: boolean, userId: number|null, message: string}>}
 */
export async function linkStripeCustomerByEmail(email, stripeCustomerId) {
  if (!email || !stripeCustomerId) {
    return {
      linked: false,
      userId: null,
      message: 'Email and Stripe customer ID are required'
    };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    const userResult = await query(
      'SELECT id, stripe_customer_id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return {
        linked: false,
        userId: null,
        message: `No user found with email ${normalizedEmail}`
      };
    }

    const user = userResult.rows[0];

    if (user.stripe_customer_id && user.stripe_customer_id !== stripeCustomerId) {
      console.warn(
        `[Stripe] User ${user.id} already has Stripe customer ${user.stripe_customer_id}, ` +
        `attempting to link ${stripeCustomerId}. This may indicate duplicate customers.`
      );
    }

    if (user.stripe_customer_id === stripeCustomerId) {
      return {
        linked: true,
        userId: user.id,
        message: `User ${user.id} already linked to customer ${stripeCustomerId}`
      };
    }

    await query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [stripeCustomerId, user.id]
    );

    console.log(
      `[Stripe] Linked customer ${stripeCustomerId} to user ${user.id} (email: ${normalizedEmail})`
    );

    return {
      linked: true,
      userId: user.id,
      message: `Successfully linked customer ${stripeCustomerId} to user ${user.id}`
    };
  } catch (error) {
    console.error('[Stripe] Error linking customer by email:', error);
    return {
      linked: false,
      userId: null,
      message: `Failed to link customer: ${error.message}`
    };
  }
}

/**
 * Find and link a Stripe customer by email (searches Stripe for customer with matching email)
 * @param {string} email - User's email address
 * @returns {Promise<{linked: boolean, customerId: string|null, userId: number|null, message: string}>}
 */
export async function findAndLinkStripeCustomerByEmail(email) {
  if (!email) {
    return {
      linked: false,
      customerId: null,
      userId: null,
      message: 'Email is required'
    };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    const userResult = await query(
      'SELECT id, stripe_customer_id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return {
        linked: false,
        customerId: null,
        userId: null,
        message: `No user found with email ${normalizedEmail}`
      };
    }

    const user = userResult.rows[0];

    if (user.stripe_customer_id) {
      return {
        linked: true,
        customerId: user.stripe_customer_id,
        userId: user.id,
        message: `User ${user.id} already has Stripe customer ${user.stripe_customer_id}`
      };
    }

    const customers = await stripe.customers.list({
      email: normalizedEmail,
      limit: 1
    });

    if (customers.data.length === 0) {
      return {
        linked: false,
        customerId: null,
        userId: user.id,
        message: `No Stripe customer found with email ${normalizedEmail}`
      };
    }

    const customer = customers.data[0];

    await query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, user.id]
    );

    console.log(
      `[Stripe] Found and linked customer ${customer.id} to user ${user.id} (email: ${normalizedEmail})`
    );

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10
    });

    const activeOrTrialingSubscriptions = subscriptions.data.filter(
      sub => sub.status === 'active' || sub.status === 'trialing'
    );

    if (activeOrTrialingSubscriptions.length > 0) {
      const subscription = activeOrTrialingSubscriptions[0];
      await query(
        'UPDATE users SET subscription_status = $1, enhancements_limit = 999999, stripe_subscription_id = $2 WHERE id = $3',
        ['premium', subscription.id, user.id]
      );
      console.log(`[Stripe] Updated user ${user.id} to premium status based on ${subscription.status} subscription`);
    }

    return {
      linked: true,
      customerId: customer.id,
      userId: user.id,
      message: `Successfully linked customer ${customer.id} to user ${user.id}`
    };
  } catch (error) {
    console.error('[Stripe] Error finding and linking customer by email:', error);
    return {
      linked: false,
      customerId: null,
      userId: null,
      message: `Failed to find and link customer: ${error.message}`
    };
  }
}

/**
 * Get Stripe customer by ID and extract email
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<{email: string|null, customer: object|null}>}
 */
export async function getStripeCustomerEmail(customerId) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return {
      email: customer.email || null,
      customer: customer
    };
  } catch (error) {
    console.error(`[Stripe] Error retrieving customer ${customerId}:`, error);
    return {
      email: null,
      customer: null
    };
  }
}

export { stripe };
