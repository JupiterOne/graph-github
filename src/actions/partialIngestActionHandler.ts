import { GithubEntities } from '../constants';
import {
  decomposePullRequestKey,
  isValidPullRequestKey,
} from '../util/propertyHelpers';
import { QueryParams } from '../client/GraphQLClient/pullRequestQueries/SinglePullRequestQuery';
import { APIClient } from '../client';
import {
  toOrganizationCollaboratorEntity,
  toOrganizationMemberEntity,
  toPullRequestEntity,
} from '../sync/converters';
import { IdEntityMap, UserEntity } from '../types';
import {
  IntegrationError,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';

interface EntityToIngest {
  _type: string; // e.g. - github_pullrequest
  _key: string; // e.g. JupiterOne/graph-whitehat/pull-requests/8
}

interface EntityIngestError extends EntityToIngest {
  message: string;
}

/**
 * Proc
 * @param client
 * @param entitiesToIngest
 * @param logger
 */
export const partialIngestActionHandler = async (
  client: APIClient,
  entitiesToIngest: EntityToIngest[],
  logger: IntegrationLogger,
) => {
  const errors: EntityIngestError[] = [];

  const pendingPromises = entitiesToIngest.map((entity) => {
    if (entity && entity._type === GithubEntities.GITHUB_PR._type) {
      if (!isValidPullRequestKey(entity._key)) {
        errors.push({ ...entity, message: 'Invalid pull request key' });
      }

      const pullRequest = decomposePullRequestKey(entity._key);

      return buildEntity(client, {
        repoOwner: pullRequest.login,
        repoName: pullRequest.repoName,
        pullRequestNumber: pullRequest.pullRequestNumber,
      }).catch((error) => {
        logger.error({ entity, error }, 'Failed to collect data for entity');
        errors.push({
          ...entity,
          message: 'Failed to collect data for entity.',
        });
      });

      // TODO: INT-3800: Ingest entity and relationships (VDubber May 2022)
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
  client: APIClient,
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
    await buildUserLoginMaps(client, repoName);

  return toPullRequestEntity(
    pullRequest,
    memberByLoginMap,
    allCollaboratorsByLoginMap,
  );
};

const buildUserLoginMaps = async (client: APIClient, repoName: string) => {
  const memberByLoginMap: IdEntityMap<UserEntity> = {};
  const allCollaboratorsByLoginMap: IdEntityMap<UserEntity> = {};

  // Query for all members of organization
  // There's not a good way to fetch a single member from an organization
  // We can use a REST endpoint, but it pulls back different data.
  await client.iterateOrgMembers((member) => {
    memberByLoginMap[member.login] = toOrganizationMemberEntity(member);
  });

  await client.iterateRepoCollaborators(repoName, (collaborator) => {
    allCollaboratorsByLoginMap[collaborator.login] =
      toOrganizationCollaboratorEntity(
        collaborator,
        client.config.githubApiBaseUrl,
      );
  });

  return {
    memberByLoginMap,
    allCollaboratorsByLoginMap,
  };
};
