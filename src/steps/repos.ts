import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import {
  toRepositoryEntity,
  toAccountOwnsRepoRelationship,
} from '../sync/converters';
import { AccountEntity, RepoEntity } from '../types';

export async function fetchRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const apiClient = createAPIClient(instance.config, logger);

  const accountEntity = (await jobState.getData(
    DATA_ACCOUNT_ENTITY,
  )) as AccountEntity;

  await apiClient.iterateRepos(async (repo) => {
    const repoEntity = (await jobState.addEntity(
      toRepositoryEntity(repo),
    )) as RepoEntity;

    await jobState.addRelationship(
      toAccountOwnsRepoRelationship(accountEntity, repoEntity),
    );
  });
}

export const repoSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-repos',
    name: 'Fetch Repos',
    entities: [
      {
        resourceName: 'Github Repo',
        _type: 'github_repo',
        _class: 'CodeRepo',
      },
    ],
    relationships: [
      {
        _type: 'github_account_owns_repo',
        _class: RelationshipClass.OWNS,
        sourceType: 'github_account',
        targetType: 'github_repo',
      },
    ],
    dependsOn: ['fetch-account'],
    executionHandler: fetchRepos,
  },
];
