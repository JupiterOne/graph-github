import { GithubEntities } from '../constants';
import {
  decomposePullRequestKey,
  isValidPullRequestKey,
} from '../util/propertyHelpers';
import { QueryParams } from '../client/GraphQLClient/pullRequestQueries/SinglePullRequestQuery';
import {
  toOrganizationCollaboratorEntity,
  toOrganizationMemberEntity,
  toPullRequestEntity,
} from '../sync/converters';
import { IdEntityMap } from '../types';
import {
  Entity,
  IntegrationError,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';
import {
  GithubGraphqlClient,
  PullRequestResponse,
} from '../client/GraphQLClient';
import { IntegrationConfig } from '../config';

interface EntityToIngest {
  _type: string; // e.g. - github_pullrequest
  _key: string; // e.g. JupiterOne/graph-whitehat/pull-requests/8
}

export interface EntityIngestError extends EntityToIngest {
  message: string;
}

/**
 * Proc
 * @param client
 * @param entitiesToIngest
 * @param logger
 */
export const partialIngestActionHandler = async (
  client: GithubGraphqlClient,
  entitiesToIngest: EntityToIngest[],
  config: IntegrationConfig,
  logger: IntegrationLogger,
): Promise<{ entities: any[]; errors: EntityIngestError[] }> => {
  const errors: EntityIngestError[] = [];

  const pendingPromises = entitiesToIngest.map((entity) => {
    if (entity && entity._type === GithubEntities.GITHUB_PR._type) {
      if (!isValidPullRequestKey(entity._key)) {
        errors.push({ ...entity, message: 'Invalid pull request key' });
      }

      const pullRequest = decomposePullRequestKey(entity._key);

      return buildEntity(client, config, {
        repoOwner: pullRequest.login,
        repoName: pullRequest.repoName,
        pullRequestNumber: pullRequest.pullRequestNumber,
      }).catch((error) => {
        logger.error({ entity, error }, 'Failed to collect data for entity');
        errors.push({
          ...entity,
          message: 'Failed to collect data for entity.',
        });
        return null;
      });
    } else {
      errors.push({
        ...entity,
        message: 'github_pullrequest is the only supported entity type.',
      });
    }
  });

  const entities = await Promise.all(pendingPromises);

  return {
    entities: entities.filter((e) => e),
    errors,
  };
};

/**
 * Builds pull request entity.
 * @param client
 * @param repoOwner
 * @param repoName
 * @param pullRequestNumber
 */
const buildEntity = async (
  client: GithubGraphqlClient,
  config: IntegrationConfig,
  { repoOwner, repoName, pullRequestNumber }: QueryParams,
) => {
  const pullRequest = await client.fetchPullRequest(
    repoOwner,
    repoName,
    pullRequestNumber,
  );

  if (!pullRequest) {
    throw new IntegrationError({
      message: 'Pull request not found',
      fatal: true,
      code: 'NOT_FOUND',
    });
  }

  const { memberByLoginMap, allCollaboratorsByLoginMap } =
    await buildUserLoginMaps(client, config, repoName);

  return toPullRequestEntity({
    pullRequest: pullRequest as unknown as PullRequestResponse,
    commits: pullRequest.commits ?? [],
    reviews: pullRequest.reviews ?? [],
    labels: pullRequest.labels ?? [],
    teamMembersByLoginMap: memberByLoginMap,
    allKnownUsersByLoginMap: allCollaboratorsByLoginMap,
  });
};

const buildUserLoginMaps = async (
  client: GithubGraphqlClient,
  config: IntegrationConfig,
  repoName: string,
) => {
  const memberByLoginMap: IdEntityMap<Entity['_key']> = new Map();
  const allCollaboratorsByLoginMap: IdEntityMap<Entity['_key']> = new Map();

  // Query for all members of organization
  // There's not a good way to fetch a single member from an organization
  // We can use a REST endpoint, but it pulls back different data.
  await client.iterateMembers((member) => {
    if (member.login) {
      memberByLoginMap.set(
        member.login,
        toOrganizationMemberEntity(member)._key,
      );
    }
  });

  await client.iterateCollaborators(repoName, (collaborator) => {
    allCollaboratorsByLoginMap.set(
      collaborator.login,
      toOrganizationCollaboratorEntity(collaborator, config.githubApiBaseUrl)
        ._key,
    );
  });

  return {
    memberByLoginMap,
    allCollaboratorsByLoginMap,
  };
};
