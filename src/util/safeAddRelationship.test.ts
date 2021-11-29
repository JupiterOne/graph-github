import { JobState, Relationship } from '@jupiterone/integration-sdk-core';
import { safeAddRelationship } from './safeAddRelationship';

describe('safeAddRelationship', () => {
  it('should add a relationship to the jobState if the _key has not been seen before', async () => {
    const jobState = {
      addRelationship: jest.fn(),
    } as unknown as JobState;
    const relationshipKeys = new Set<string>();
    const relationship: Relationship = {
      _key: '_key',
      _type: '_type',
      _class: '_class',
      _toEntityKey: '_toEntityKey;',
      _fromEntityKey: '_fromEntityKey',
      displayName: 'displayName',
    };
    expect(
      await safeAddRelationship(jobState, relationshipKeys, relationship),
    ).toBe(true);
    expect(jobState.addRelationship).toHaveBeenCalledWith(relationship);
  });

  it('should add not a relationship to the jobState if the _key has been seen before', async () => {
    const alreadySeenKey = 'alreadySeenKey';
    const jobState = {
      addRelationship: jest.fn(),
    } as unknown as JobState;
    const relationshipKeys = new Set<string>([alreadySeenKey]);
    const relationship: Relationship = {
      _key: alreadySeenKey,
      _type: '_type',
      _class: '_class',
      _toEntityKey: '_toEntityKey;',
      _fromEntityKey: '_fromEntityKey',
      displayName: 'displayName',
    };
    expect(
      await safeAddRelationship(jobState, relationshipKeys, relationship),
    ).toBe(false);
    expect(jobState.addRelationship).not.toHaveBeenCalled();
  });
});
