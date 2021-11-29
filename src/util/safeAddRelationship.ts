import { JobState, Relationship } from '@jupiterone/integration-sdk-core';

export async function safeAddRelationship(
  jobState: JobState,
  relationshipKeys: Set<string>,
  relationship?: Relationship,
) {
  if (relationship && !relationshipKeys.has(relationship._key)) {
    await jobState.addRelationship(relationship);
    relationshipKeys.add(relationship._key);
    return true;
  }
  return false;
}
