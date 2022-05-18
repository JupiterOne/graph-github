import { StepSpec } from '@jupiterone/integration-sdk-core';
import { IntegrationConfig } from '../../../../src/config';

export const repositorySpec: StepSpec<IntegrationConfig>[] = [
  {
    id: 'fetch-repos',
    name: 'Fetch Repos',
    entities: [
      {
        resourceName: 'GitHub Repo',
        _type: 'github_repo',
        _class: ['CodeRepo'],
      },
    ],
    relationships: [],
    dependsOn: [],
    implemented: true,
  },
];
