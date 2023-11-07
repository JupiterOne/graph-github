import { withBatching } from './batchUtils';

describe('withBatching', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should handle batchedEntityKeys and singleEntityKeys correctly', async () => {
    const mockBatchCb = jest.fn(async (entityIds) => {});
    const mockSingleCb = jest.fn(async (entityId) => {});
    const mockLogger = {
      warn: jest.fn(),
    } as any;
    const totalConnectionsById = new Map([
      ['entity1', 5],
      ['entity2', 4],
      ['entity3', 15],
      ['entity4', 20],
      ['entity5', 5],
      ['entity6', 1],
      ['entity7', 3],
    ]);
    const threshold = 10;

    await withBatching({
      totalConnectionsById,
      threshold,
      logger: mockLogger,
      batchCb: mockBatchCb,
      singleCb: mockSingleCb,
    });

    expect(mockBatchCb).toHaveBeenCalledTimes(2);
    expect(mockBatchCb.mock.calls).toEqual([
      [
        ['entity6', 'entity7', 'entity2'], // first call
      ],
      [
        ['entity1', 'entity5'], // second call
      ],
    ]);
    expect(mockSingleCb).toHaveBeenCalledTimes(2);
    expect(mockSingleCb.mock.calls).toEqual([
      ['entity3'], // first call
      ['entity4'], // second call
    ]);
  });

  test('should handle errors and retry mechanism properly', async () => {
    const mockBatchCb = jest.fn(async (entityIds) => {});
    const mockSingleCb = jest.fn(async (entityId) => {});
    const mockLogger = {
      warn: jest.fn(),
    } as any;
    const totalConnectionsById = new Map([
      ['entity1', 4],
      ['entity2', 4],
      ['entity3', 15],
      ['entity4', 20],
      ['entity5', 4],
      ['entity6', 1],
      ['entity7', 3],
    ]);
    const threshold = 10;

    const error = new Error('This may be the result of a timeout');
    mockBatchCb.mockRejectedValueOnce(error);

    await withBatching({
      totalConnectionsById,
      threshold,
      logger: mockLogger,
      batchCb: mockBatchCb,
      singleCb: mockSingleCb,
    });

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      { threshold: 5 },
      'Github timeout on batch query. Retrying query by half the threshold.',
    );

    expect(mockBatchCb).toHaveBeenCalledTimes(5); // Ensure that the batchCb is retried once after the error
    expect(mockBatchCb.mock.calls).toEqual([
      [
        ['entity6', 'entity7', 'entity1'], // first call - throws error
      ],
      [
        ['entity6', 'entity7'], // second call - retrying with half the threshold
      ],
      [
        ['entity1'], // third call
      ],
      [
        ['entity2'], // fourth call
      ],
      [
        ['entity5'], // fifth call
      ],
    ]);

    expect(mockSingleCb).toHaveBeenCalledTimes(2);
    expect(mockSingleCb.mock.calls).toEqual([
      ['entity3'], // first call
      ['entity4'], // second call
    ]);
  });

  test('should retry the single entity keys leveraging the single graphql query', async () => {
    const mockBatchCb = jest.fn(async (entityIds) => {});
    const mockSingleCb = jest.fn(async (entityId) => {});
    const mockLogger = {
      warn: jest.fn(),
    } as any;
    const totalConnectionsById = new Map([
      ['entity1', 4],
      ['entity2', 4],
      ['entity3', 15],
      ['entity4', 20],
      ['entity5', 4],
      ['entity6', 1],
      ['entity7', 3],
    ]);
    const threshold = 10;

    const error = new Error('This may be the result of a timeout');
    // throw two errors in a row, leaving the threshold on 2
    mockBatchCb.mockRejectedValueOnce(error).mockRejectedValueOnce(error);

    await withBatching({
      totalConnectionsById,
      threshold,
      logger: mockLogger,
      batchCb: mockBatchCb,
      singleCb: mockSingleCb,
    });

    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn.mock.calls).toEqual([
      [
        { threshold: 5 },
        'Github timeout on batch query. Retrying query by half the threshold.',
      ],
      [
        { threshold: 2 },
        'Github timeout on batch query. Retrying query by half the threshold.',
      ],
    ]);

    expect(mockBatchCb).toHaveBeenCalledTimes(3); // Ensure that the batchCb is retried once after the error
    expect(mockBatchCb.mock.calls).toEqual([
      [
        ['entity6', 'entity7', 'entity1'], // first call - throws error
      ],
      [
        ['entity6', 'entity7'], // second call - retrying with half the threshold (5) - throws error
      ],
      [
        ['entity6'], // third call - retrying with half the threshold (2)
      ],
    ]);

    expect(mockSingleCb).toHaveBeenCalledTimes(6);
    expect(mockSingleCb.mock.calls).toEqual([
      ['entity7'], // first call - retry from batched keys
      ['entity1'], // second call - retry from batched keys
      ['entity2'], // third call - retry from batched keys
      ['entity5'], // fourth call - retry from batched keys
      ['entity3'], // fifth call
      ['entity4'], // sixth call
    ]);
  });

  it('should throw when there is a different error', async () => {
    const mockBatchCb = jest.fn(async (entityIds) => {});
    const mockSingleCb = jest.fn(async (entityId) => {});
    const mockLogger = {
      warn: jest.fn(),
    } as any;
    const totalConnectionsById = new Map([
      ['entity1', 4],
      ['entity2', 4],
      ['entity3', 15],
      ['entity4', 20],
      ['entity5', 4],
      ['entity6', 1],
      ['entity7', 3],
    ]);
    const threshold = 10;

    const error = new Error('Secondary rate limit');
    mockBatchCb.mockRejectedValue(error);

    await expect(
      withBatching({
        totalConnectionsById,
        threshold,
        logger: mockLogger,
        batchCb: mockBatchCb,
        singleCb: mockSingleCb,
      }),
    ).rejects.toThrowError(error);
  });
});
