import { StepSpec } from '@jupiterone/integration-sdk-core';
import { IntegrationConfig } from '../../../../src/config';
import { Steps } from '../../../../src/constants';

export const repositorySpec: StepSpec<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_REPOS,
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
