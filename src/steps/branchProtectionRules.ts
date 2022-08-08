//TODO  Have someone review this file -cg
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
  //TODO Not sure what else goes here -cg
  //Here
  GITHUB_BRANCH_PROTECTION_RULE_RELATIONSHIP_TYPE,
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
      async (repo) => {
        const branchProtectionRuleEntity = (await jobState.addEntity(
          toBranchProtectionEntity(repo),
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
          _type: GITHUB_BRANCH_PROTECTION_RULE_RELATIONSHIP_TYPE,
          sourceType: GithubEntities.GITHUB_REPO._type,
          _class: RelationshipClass.HAS,
          targetType: GithubEntities.GITHUB_BRANCH_PROTECITON_RULE._type,
        },
      ],
      dependsOn: ['fetch-repos'],
      executionHandler: fetchBranchProtectionRule,
    },
  ];
