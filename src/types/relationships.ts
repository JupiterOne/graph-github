import { ExplicitRelationship } from '@jupiterone/integration-sdk-core';

export interface RepoTeamRelationship extends ExplicitRelationship {
  permission: string;
}
