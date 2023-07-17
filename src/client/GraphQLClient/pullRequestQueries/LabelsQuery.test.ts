import LabelsQuery from './LabelsQuery';
import { labelsQueryResponse } from './testResponses';

describe('LabelsQuery', () => {
  describe('#iterateLabels', () => {
    test('Pulling data out', async () => {
      const iteratee = jest.fn();
      const execute = jest
        .fn()
        .mockResolvedValueOnce(labelsQueryResponse[0])
        .mockResolvedValueOnce(labelsQueryResponse[1]);

      // Act
      const result = await LabelsQuery.iterateLabels(
        {
          repoOwner: 'J1-Test',
          repoName: 'happy-sunshine',
          pullRequestNumber: 2,
        },
        execute,
        iteratee,
      );

      // Assert
      expect(result.totalCost).toBe(3);
      expect(iteratee).toHaveBeenCalledTimes(3);
      expect(iteratee.mock.calls[0][0]).toMatchSnapshot();
      expect(iteratee.mock.calls[1][0]).toMatchSnapshot();
      expect(iteratee.mock.calls[2][0]).toMatchSnapshot();
      expect(execute).toHaveBeenCalledTimes(2);
      expect(execute.mock.calls[0][0]).toMatchSnapshot();
      expect(execute.mock.calls[1][0]).toMatchSnapshot();
    });
  });
});
