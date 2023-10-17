import {
  createDirectRelationship,
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import {
  AppEntity,
  BranchProtectionRuleEntity,
  IdEntityMap,
  RepoKeyAndName,
  UserEntity,
} from '../types';
import {
  GITHUB_APP_BY_APP_ID,
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_REPO_TAGS_ARRAY,
  GithubEntities,
  IngestionSources,
  Relationships,
  Steps,
} from '../constants';
import { toBranchProtectionEntity } from '../sync/converters';

export async function fetchBranchProtectionRule({
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
    await apiClient.iterateBranchProtectionPolicy(
      repoTag.name,
      async (branchProtectionRule) => {
        const branchProtectionRuleEntity = (await jobState.addEntity(
          toBranchProtectionEntity(
            branchProtectionRule,
            config.githubApiBaseUrl,
            apiClient.graphQLClient.login,
          ),
        )) as BranchProtectionRuleEntity;

        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.HAS,
            fromType: GithubEntities.GITHUB_REPO._type,
            toType: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
            fromKey: repoTag._key,
            toKey: branchProtectionRuleEntity._key,
          }),
        );

        if (
          Array.isArray(branchProtectionRule.bypassPullRequestAllowances?.users)
        ) {
          const usersByLoginMap = await jobState.getData<
            IdEntityMap<UserEntity>
          >(GITHUB_MEMBER_BY_LOGIN_MAP);

          if (usersByLoginMap) {
            await Promise.all(
              branchProtectionRule.bypassPullRequestAllowances?.users.map(
                async (user) => {
                  if (usersByLoginMap[user.login]) {
                    await jobState.addRelationship(
                      createDirectRelationship({
                        _class: RelationshipClass.OVERRIDES,
                        from: usersByLoginMap[user.login],
                        to: branchProtectionRuleEntity,
                        properties: {
                          bypassPullRequestAllowance: true,
                        },
                      }),
                    );
                  } else {
                    logger.warn(
                      { user },
                      'Failed to find user by login for bypassPullRequestAllowances',
                    );
                  }
                },
              ),
            );
          }
        }

        if (
          Array.isArray(branchProtectionRule.bypassPullRequestAllowances?.teams)
        ) {
          await Promise.all(
            branchProtectionRule.bypassPullRequestAllowances.teams.map(
              async (team) => {
                const teamEntity = await jobState.findEntity(team.id);

                if (teamEntity) {
                  await jobState.addRelationship(
                    createDirectRelationship({
                      _class: RelationshipClass.OVERRIDES,
                      from: teamEntity,
                      to: branchProtectionRuleEntity,
                      properties: {
                        bypassPullRequestAllowance: true,
                      },
                    }),
                  );
                } else {
                  logger.warn(
                    { team },
                    'Failed to find team entity for bypassPullRequestAllowances.',
                  );
                }
              },
            ),
          );
        }

        if (
          Array.isArray(branchProtectionRule.bypassPullRequestAllowances?.apps)
        ) {
          const appsById =
            await jobState.getData<IdEntityMap<AppEntity>>(
              GITHUB_APP_BY_APP_ID,
            );

          if (appsById) {
            await Promise.all(
              branchProtectionRule.bypassPullRequestAllowances.apps.map(
                async (app) => {
                  if (appsById && appsById[`${app.databaseId}`]) {
                    const appEntity = appsById[`${app.databaseId}`];
                    await jobState.addRelationship(
                      createDirectRelationship({
                        _class: RelationshipClass.OVERRIDES,
                        from: appEntity,
                        to: branchProtectionRuleEntity,
                        properties: {
                          bypassPullRequestAllowance: true,
                        },
                      }),
                    );
                  } else {
                    logger.warn(
                      { app },
                      'Failed to find by databaseId for bypassPullRequestAllowances.',
                    );
                  }
                },
              ),
            );
          }
        }
      },
    );
  }
}

export const branchProtectionRulesSteps: IntegrationStep<IntegrationConfig>[] =
  [
    {
      id: Steps.FETCH_BRANCH_PROTECTION_RULES,
      ingestionSourceId: IngestionSources.BRANCH_PROTECTION_RULES,
      name: 'Fetch Branch Protection Rules',
      entities: [GithubEntities.GITHUB_BRANCH_PROTECTION_RULE],
      relationships: [
        Relationships.REPO_HAS_BRANCH_PROTECTION_RULE,
        Relationships.USER_OVERRIDES_BRANCH_PROTECTION_RULE,
        Relationships.TEAM_OVERRIDES_BRANCH_PROTECTION_RULE,
        Relationships.APP_OVERRIDES_BRANCH_PROTECTION_RULE,
      ],
      dependsOn: [
        Steps.FETCH_REPOS,
        Steps.FETCH_USERS,
        Steps.FETCH_TEAMS,
        Steps.FETCH_APPS,
      ],
      executionHandler: fetchBranchProtectionRule,
    },
  ];
