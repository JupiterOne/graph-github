import { BaseQueryState, CursorState } from './types';
import paginate from './paginate';

type QueryParams = {
  firstParam: string;
  secondParam: number;
};

interface QueryState extends BaseQueryState {
  breedCursor: CursorState;
}

type Resource = {
  prop1: string;
  prop2: boolean;
  prop3: number;
};

describe('paginate', () => {
  test('best of breed', async () => {
    // Arrange
    const queryParams = {
      firstParam: 'test1',
      secondParam: 3,
    };
    const iteratee = jest.fn();
    const execute = jest.fn();
    const buildQuery = jest.fn();
    const processResponseData = jest
      .fn()
      .mockImplementationOnce(async (response, iteratee) => {
        await iteratee();
        await iteratee();
        return null; // Malformed response
      })
      .mockImplementationOnce(async (response, iteratee) => {
        await iteratee();
        await iteratee();
        return {
          rateLimit: { cost: 1, limit: 600, remaining: 499, resetAt: 'date' },
        };
      })
      .mockImplementation(async (response, iteratee) => {
        await iteratee();
        await iteratee();
        return {
          rateLimit: {
            cost: 1,
            limit: 600,
            remaining: 399,
            resetAt: 'date2',
          },
        };
      });
    const maxFetches = 26;

    // Act
    const { totalCost, remaining, resetAt, limit } = await paginate<
      QueryParams,
      QueryState,
      Resource
    >(
      queryParams,
      iteratee,
      execute,
      buildQuery,
      processResponseData,
      (queryState, resourceFetchCount) => resourceFetchCount >= maxFetches,
    );

    // Assert
    expect(totalCost).toBe(12);
    expect(remaining).toBe(399);
    expect(limit).toBe(600);
    expect(resetAt).toBe('date2');

    expect(iteratee).toHaveBeenCalledTimes(26);
    expect(execute).toHaveBeenCalledTimes(13);
  });
  test('error scenarios', async () => {
    // Arrange
    const queryParams = {
      firstParam: 'test1',
      secondParam: 3,
    };
    const iteratee = jest.fn();
    const execute = jest
      .fn()
      .mockRejectedValueOnce(new Error('Failed to connect to server.'));
    const buildQuery = jest.fn();
    const processResponseData = jest.fn();

    // Act & Assert
    await expect(() =>
      paginate<QueryParams, QueryState, Resource>(
        queryParams,
        iteratee,
        execute,
        buildQuery,
        processResponseData,
        jest.fn(),
      ),
    ).rejects.toThrow(new Error('Failed to connect to server.'));

    expect(buildQuery).toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
    expect(processResponseData).not.toHaveBeenCalled();
  });
});
