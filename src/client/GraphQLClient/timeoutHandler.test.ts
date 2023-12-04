/* eslint-disable @typescript-eslint/ban-ts-comment */
import { buildTimeoutHandler } from './timeoutHandler';

describe('buildTimeoutHandler', () => {
  let makeRequest: any;
  let logger: any;

  beforeEach(() => {
    makeRequest = jest.fn();
    logger = {
      warn: jest.fn(),
    };
  });

  it('should throw an error if maxLimitKey is not in queryParams', () => {
    expect(() =>
      buildTimeoutHandler({
        queryParams: {
          login: 'test',
        },
        // @ts-ignore
        maxLimitKey: 'maxLimit',
        logger,
      }),
    ).toThrowError('maxLimit not found in queryParams');
  });

  it('should throw an error if maxLimitKey value is not a number', () => {
    expect(() =>
      buildTimeoutHandler({
        queryParams: { maxLimit: 'not a number' },
        maxLimitKey: 'maxLimit',
        logger,
      }),
    ).toThrowError('maxLimit is not a number');
  });

  it('should handle the timeout error and return the retry and response object', async () => {
    const queryParams = {
      maxLimit: 10,
    };

    const withTimeoutHandler = buildTimeoutHandler({
      queryParams,
      maxLimitKey: 'maxLimit',
      logger,
    });

    makeRequest
      .mockRejectedValueOnce(new Error('This may be the result of a timeout'))
      .mockRejectedValueOnce(new Error('This may be the result of a timeout'))
      .mockResolvedValueOnce({ data: { nodes: [] } });

    let result: any;
    result = await withTimeoutHandler(makeRequest);
    expect(result.retry).toBe(true);
    expect(result.response).toBeUndefined();
    expect(queryParams.maxLimit).toBe(5);

    result = await withTimeoutHandler(makeRequest);
    expect(result.retry).toBe(true);
    expect(result.response).toBeUndefined();
    expect(queryParams.maxLimit).toBe(2);

    result = await withTimeoutHandler(makeRequest);
    expect(result.retry).toBe(false);
    expect(result.response).toEqual({ data: { nodes: [] } });
    expect(queryParams.maxLimit).toBe(2);
  });

  it('should handle successful execution and return the retry and response object', async () => {
    const queryParams = {
      maxLimit: 10,
    };
    const timeoutHandler = buildTimeoutHandler({
      queryParams,
      maxLimitKey: 'maxLimit',
      logger,
    });

    makeRequest.mockResolvedValueOnce({ data: { nodes: [] } });

    const result = await timeoutHandler(makeRequest);
    expect(result.retry).toBe(false);
    expect(result.response).toEqual({ data: { nodes: [] } });
    expect(queryParams.maxLimit).toBe(10);
  });

  it('should throw the timeout error if the same maxLimit already failed', async () => {
    const queryParams = {
      maxLimit: 5,
    };
    const withTimeoutHandler = buildTimeoutHandler({
      queryParams,
      maxLimitKey: 'maxLimit',
      logger,
    });

    makeRequest
      .mockRejectedValueOnce(new Error('This may be the result of a timeout'))
      .mockRejectedValueOnce(new Error('This may be the result of a timeout'))
      .mockRejectedValueOnce(new Error('This may be the result of a timeout'));

    let result: any;
    result = await withTimeoutHandler(makeRequest);
    expect(result.retry).toBe(true);
    expect(result.response).toBeUndefined();
    expect(queryParams.maxLimit).toBe(2);

    result = await withTimeoutHandler(makeRequest);
    expect(result.retry).toBe(true);
    expect(result.response).toBeUndefined();
    expect(queryParams.maxLimit).toBe(1);

    await expect(withTimeoutHandler(makeRequest)).rejects.toThrowError(
      'This may be the result of a timeout',
    );
  });
});
