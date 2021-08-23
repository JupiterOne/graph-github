import { ExplicitRelationship } from '@jupiterone/integration-sdk-core';

export interface RepoAllowRelationship extends ExplicitRelationship {
  permissionType: string; // 'READ' | 'TRIAGE' | 'WRITE' | 'MAINTAIN' | 'ADMIN'
  adminPermission: boolean;
  maintainPermission: boolean;
  pushPermission: boolean;
  triagePermission: boolean;
  pullPermission: boolean;
}
