import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { RepoData, EnvironmentEntity } from '../types';
import {
  GithubEntities,
  GITHUB_REPO_TAGS_ARRAY,
  Steps,
  IngestionSources,
  Relationships,
} from '../constants';
import { toEnvironmentEntity } from '../sync/converters';
import { getOrCreateRestClient } from '../client/RESTClient/client';

export async function fetchEnvironments({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const restClient = getOrCreateRestClient(config, logger);

  const repoTags = await jobState.getData<Map<string, RepoData>>(
    GITHUB_REPO_TAGS_ARRAY,
  );
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_TAGS_ARRAY} in jobState.`,
    );
  }

  for (const [repoKey, repoData] of repoTags) {
    await restClient.iterateEnvironments(repoData.name, async (env) => {
      const envEntity = (await jobState.addEntity(
        toEnvironmentEntity(
          env,
          await restClient.getOrganizationLogin(),
          config.githubApiBaseUrl,
          repoData,
        ),
      )) as EnvironmentEntity;
      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromType: GithubEntities.GITHUB_REPO._type,
          toType: GithubEntities.GITHUB_ENVIRONMENT._type,
          fromKey: repoKey,
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
