import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { toTagEntity } from '../sync/converters';
import {
  GithubEntities,
  Steps,
  GITHUB_REPO_HAS_TAG_RELATIONSHIP_TYPE,
} from '../constants';

export async function fetchTags({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  await jobState.iterateEntities(
    { _type: GithubEntities.GITHUB_REPO._type },
    async (repoEntity) => {
      await apiClient.iterateTags(repoEntity.name as string, async (tag) => {
        const tagEntity = toTagEntity(tag);
        await jobState.addEntity(tagEntity);

        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.HAS,
            from: repoEntity,
            to: tagEntity,
          }),
        );
      });
    },
  );
}

export const tagSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_TAGS,
    name: 'Fetch Tags',
    entities: [
      {
        resourceName: 'Github Tag',
        _type: GithubEntities.GITHUB_REPO_TAG._type,
        _class: GithubEntities.GITHUB_REPO_TAG._class,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_HAS_TAG_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GithubEntities.GITHUB_REPO._type,
        targetType: GithubEntities.GITHUB_REPO_TAG._type,
      },
    ],
    dependsOn: [Steps.FETCH_REPOS],
    executionHandler: fetchTags,
  },
];
