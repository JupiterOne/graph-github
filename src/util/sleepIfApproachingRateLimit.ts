import {
  IntegrationLogger,
  parseTimePropertyValue,
} from '@jupiterone/integration-sdk-core';
import { sleep } from '@lifeomic/attempt';

const RATELIMIT_PERCENT_REMAINING_TO_SLEEP = 0.1;

export default async function sleepIfApproachingRateLimit(
  rateLimit,
  logger: IntegrationLogger,
) {
  /*
   * Let's check how close we are to a rate limit, and take a break if needed.
   *
   * When you start using the API, GitHub sets your reset time to one hour in the future.
   * At that time, you get your full limit back. Until then, you do not refresh limits at all.
   * That means that if you burned up all your rate limits in 15 minutes, you're not getting more
   * for another 45 minutes (ie. until your first API calls are an hour old).
   * But then you get your full limit again right on the one hour mark (ie. your rate-limit
   * doesn't trickle in over 15 minutes like in a rolling-window scenario).
   *
   * In most cases, these rate limits are not a problem, but for large accounts they can be
   * They are very likely to become a problem if a customer has other automation hitting
   * these same limits at the same time that this integration is running
   */
  if (
    Number.isInteger(rateLimit?.remaining) &&
    Number.isInteger(rateLimit?.limit) &&
    parseTimePropertyValue(rateLimit?.resetAt)
  ) {
    const rateLimitRemainingProportion = rateLimit.remaining / rateLimit.limit;
    const msUntilRateLimitReset =
      parseTimePropertyValue(rateLimit.resetAt)! - Date.now();
    if (rateLimitRemainingProportion < RATELIMIT_PERCENT_REMAINING_TO_SLEEP) {
      if (msUntilRateLimitReset > 0) {
        logger.warn(
          {
            rateLimitPercentLeft: (
              rateLimitRemainingProportion * 100
            ).toPrecision(4),
            secondsUntilReset: msUntilRateLimitReset / 1000,
            resetAt: rateLimit.resetAt,
          },
          `Rate limit almost exhausted, sleeping until reset time`,
        );
        await sleep(msUntilRateLimitReset);
      }
    }
  } else {
    logger.warn(
      {},
      'GraphQL API Ratelimit details malformed in response, so could not calculate rate limit remaining',
    );
  }
}
