import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { RepoKeyAndName, EnvironmentEntity } from '../types';
import {
  GithubEntities,
  GITHUB_REPO_TAGS_ARRAY,
  Steps,
  IngestionSources,
  Relationships,
} from '../constants';
import { toEnvironmentEntity } from '../sync/converters';

export async function fetchEnvironments({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

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
        toEnvironmentEntity(
          env,
          apiClient.graphQLClient.login,
          config.githubApiBaseUrl,
          repoTag,
        ),
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
    id: Steps.FETCH_ENVIRONMENTS,
    ingestionSourceId: IngestionSources.ENVIRONMENTS,
    name: 'Fetch Environments',
    entities: [GithubEntities.GITHUB_ENVIRONMENT],
    relationships: [Relationships.REPO_HAS_ENVIRONMENT],
    dependsOn: [Steps.FETCH_REPOS],
    executionHandler: fetchEnvironments,
  },
];
