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
import {
  GITHUB_ACCOUNT_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_CLASS,
  GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE,
} from '../constants';

export async function fetchRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const accountEntity = (await jobState.getData(
    DATA_ACCOUNT_ENTITY,
  )) as AccountEntity;

  const repoEntities: RepoEntity[] = []; //for use later in PRs

  await apiClient.iterateRepos(async (repo) => {
    const repoEntity = (await jobState.addEntity(
      toRepositoryEntity(repo),
    )) as RepoEntity;

    repoEntities.push(repoEntity);

    await jobState.addRelationship(
      toAccountOwnsRepoRelationship(accountEntity, repoEntity),
    );
  });

  await jobState.setData('REPO_ARRAY', repoEntities);
}

export const repoSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-repos',
    name: 'Fetch Repos',
    entities: [
      {
        resourceName: 'Github Repo',
        _type: GITHUB_REPO_ENTITY_TYPE,
        _class: GITHUB_REPO_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OWNS,
        sourceType: GITHUB_ACCOUNT_ENTITY_TYPE,
        targetType: GITHUB_REPO_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-account'],
    executionHandler: fetchRepos,
  },
];
