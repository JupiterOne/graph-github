import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { RepoKeyAndName, EnvironmentEntity } from '../types';
import {
  GithubEntities,
  GITHUB_REPO_ENVIRONMENT_RELATIONSHIP_TYPE,
  GITHUB_REPO_TAGS_ARRAY,
} from '../constants';
import { toEnvironmentEntity } from '../sync/converters';

export async function fetchEnvironments({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const repoTags = await jobState.getData<RepoKeyAndName[]>(
    GITHUB_REPO_TAGS_ARRAY,
  );
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_TAGS_ARRAY} in jobState.`,
    );
  }

  for (const repoTag of repoTags) {
    await apiClient.iterateEnvironments(repoTag.name, async (env) => {
      const envEntity = (await jobState.addEntity(
        toEnvironmentEntity(env, apiClient.accountClient.login, repoTag),
      )) as EnvironmentEntity;
      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromType: GithubEntities.GITHUB_REPO._type,
          toType: GithubEntities.GITHUB_ENVIRONMENT._type,
          fromKey: repoTag._key,
          toKey: envEntity._key,
        }),
      );
    });
  }
}

export const environmentSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-environments',
    name: 'Fetch Environments',
    entities: [
      {
        resourceName: 'GitHub Environment',
        _type: GithubEntities.GITHUB_ENVIRONMENT._type,
        _class: GithubEntities.GITHUB_ENVIRONMENT._class,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_ENVIRONMENT_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GithubEntities.GITHUB_REPO._type,
        targetType: GithubEntities.GITHUB_ENVIRONMENT._type,
      },
    ],
    dependsOn: ['fetch-repos'],
    executionHandler: fetchEnvironments,
  },
];
