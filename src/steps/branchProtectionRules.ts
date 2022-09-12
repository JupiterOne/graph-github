import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  IntegrationMissingKeyError,
  RelationshipClass,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { BranchProtectionRuleEntity, RepoKeyAndName } from '../types';
import {
  GITHUB_REPO_BRANCH_PROTECTION_RULE_RELATIONSHIP_TYPE,
  GITHUB_REPO_BRANCH_PROTECTION_RULE_MEMBER_OVERRIDE_TYPE,
  GITHUB_REPO_BRANCH_PROTECTION_RULE_TEAM_OVERRIDE_TYPE,
  GITHUB_REPO_BRANCH_PROTECTION_RULE_APP_OVERRIDE_TYPE,
  GithubEntities,
  GITHUB_REPO_TAGS_ARRAY,
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
            apiClient.accountClient.login,
          ),
        )) as BranchProtectionRuleEntity;
        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.HAS,
            fromType: GithubEntities.GITHUB_REPO._type,
            toType: GithubEntities.GITHUB_BRANCH_PROTECITON_RULE._type,
            fromKey: repoTag._key,
            toKey: branchProtectionRuleEntity._key,
          }),
        );
        if (branchProtectionRule.bypassPullRequestAllowances?.users) {
          console.log(
            `Users: ${branchProtectionRule.bypassPullRequestAllowances?.users}`,
          );
        }

        if (branchProtectionRule.bypassPullRequestAllowances?.teams) {
          console.log(
            `Teams: ${branchProtectionRule.bypassPullRequestAllowances?.teams}`,
          );
        }

        if (branchProtectionRule.bypassPullRequestAllowances?.apps) {
          console.log(
            `Apps: ${branchProtectionRule.bypassPullRequestAllowances?.apps}`,
          );
        }
      },
    );
  }
}

export const branchProtectionRulesSteps: IntegrationStep<IntegrationConfig>[] =
  [
    {
      id: 'fetch-branch-protection-rules',
      name: 'Fetch Branch Protection Rules',
      entities: [
        {
          resourceName: 'GitHub Branch Protection Rules',
          _type: GithubEntities.GITHUB_BRANCH_PROTECITON_RULE._type,
          _class: GithubEntities.GITHUB_BRANCH_PROTECITON_RULE._class,
        },
      ],
      relationships: [
        {
          _type: GITHUB_REPO_BRANCH_PROTECTION_RULE_RELATIONSHIP_TYPE,
          sourceType: GithubEntities.GITHUB_REPO._type,
          _class: RelationshipClass.HAS,
          targetType: GithubEntities.GITHUB_BRANCH_PROTECITON_RULE._type,
        },
        {
          _type: GITHUB_REPO_BRANCH_PROTECTION_RULE_MEMBER_OVERRIDE_TYPE,
          sourceType: GithubEntities.GITHUB_MEMBER._type,
          _class: RelationshipClass.OVERRIDES,
          targetType: GithubEntities.GITHUB_BRANCH_PROTECITON_RULE._type,
        },
        {
          _type: GITHUB_REPO_BRANCH_PROTECTION_RULE_TEAM_OVERRIDE_TYPE,
          sourceType: GithubEntities.GITHUB_TEAM._type,
          _class: RelationshipClass.OVERRIDES,
          targetType: GithubEntities.GITHUB_BRANCH_PROTECITON_RULE._type,
        },
        {
          _type: GITHUB_REPO_BRANCH_PROTECTION_RULE_APP_OVERRIDE_TYPE,
          sourceType: GithubEntities.GITHUB_APP._type,
          _class: RelationshipClass.OVERRIDES,
          targetType: GithubEntities.GITHUB_BRANCH_PROTECITON_RULE._type,
        },
      ],
      dependsOn: ['fetch-repos', 'fetch-users', 'fetch-teams', 'fetch-apps'],
      executionHandler: fetchBranchProtectionRule,
    },
  ];
