import sleepIfApproachingRateLimit from './sleepIfApproachingRateLimit';
import { createMockIntegrationLogger } from '@jupiterone/integration-sdk-testing';

const logger = createMockIntegrationLogger();
const TIME_TO_SLEEP: number = 4000;
const resetTime: string = new Date(Date.now() + TIME_TO_SLEEP).toString(); //a string of TIME_TO_SLEEP sec from now

describe('sleepRespectsTenPercentLimit', () => {
  const rateLimitAboveTenPercent = {
    limit: 5000,
    remaining: 501,
    resetAt: resetTime,
  };

  const rateLimitBelowTenPercent = {
    limit: 5000,
    remaining: 499,
    resetAt: resetTime,
  };

  test('no sleep when above limit', async () => {
    const testStart = Date.now();
    await sleepIfApproachingRateLimit(rateLimitAboveTenPercent, logger);
    const testEnd = Date.now();
    expect(testEnd - testStart).toBeLessThan(1000);
  });

  test('sleep when below limit', async () => {
    const testStart = Date.now();
    await sleepIfApproachingRateLimit(rateLimitBelowTenPercent, logger);
    const testEnd = Date.now();
    expect(testEnd - testStart).toBeGreaterThanOrEqual(TIME_TO_SLEEP - 1000); //giving 1000 msec leeway here for execution time
  });
});

describe('badRateLimitFormattingThrowsWarning', () => {
  const rateLimit = {
    limit: 5000,
    remaining: 499,
    resetAt: 'some unparseable string that is not time',
  };

  test('badResetAtProperty', async () => {
    //should return quickly
    const testStart = Date.now();
    await sleepIfApproachingRateLimit(rateLimit, logger);
    const testEnd = Date.now();
    expect(testEnd - testStart).toBeLessThan(1000);
  });
});
