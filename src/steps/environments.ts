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
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_ENVIRONMENT_ENTITY_TYPE,
  GITHUB_ENVIRONMENT_ENTITY_CLASS,
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
          fromType: GITHUB_REPO_ENTITY_TYPE,
          toType: GITHUB_ENVIRONMENT_ENTITY_TYPE,
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
        _type: GITHUB_ENVIRONMENT_ENTITY_TYPE,
        _class: GITHUB_ENVIRONMENT_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_ENVIRONMENT_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_ENVIRONMENT_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-repos'],
    executionHandler: fetchEnvironments,
  },
];
