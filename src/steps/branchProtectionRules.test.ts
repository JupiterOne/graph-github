import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { branchProtectionRulesSteps } from './branchProtectionRules';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { GithubEntities, Relationships } from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(40000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchBranchProtectionRules exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'branchProtectionRules',
  });
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: branchProtectionRulesSteps[0].id,
      invocationConfig: invocationConfig as any,
      instanceConfig: integrationConfig,
    });

  expect({
    numCollectedEntities: collectedEntities.length,
    numCollectedRelationships: collectedRelationships.length,
    collectedEntities: collectedEntities,
    collectedRelationships: collectedRelationships,
    encounteredTypes: encounteredTypes,
  }).toMatchSnapshot();

  const branchProtectionRules = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
  );

  expect(branchProtectionRules.length).toBeGreaterThan(0);
  expect(branchProtectionRules).toMatchGraphObjectSchema({
    _class: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._class,
  });

  // relationships
  const branchProtectionRulesType = collectedRelationships.filter(
    (e) => e._type === Relationships.REPO_HAS_BRANCH_PROTECTION_RULE._type,
  );
  expect(branchProtectionRulesType.length).toBeGreaterThan(0);

  //Test for users
  const branchProtectionRulesMemberOverrideType = collectedRelationships.filter(
    (e) =>
      e._type === Relationships.USER_OVERRIDES_BRANCH_PROTECTION_RULE._type,
  );
  expect(branchProtectionRulesMemberOverrideType.length).toBeGreaterThanOrEqual(
    0,
  );

  //Test for Teams
  const branchProtectionRulesTeamOverrideType = collectedRelationships.filter(
    (e) =>
      e._type === Relationships.TEAM_OVERRIDES_BRANCH_PROTECTION_RULE._type,
  );
  expect(branchProtectionRulesTeamOverrideType.length).toBeGreaterThanOrEqual(
    0,
  );

  //Test for Apps
  const branchProtectionRulesAppOverrideType = collectedRelationships.filter(
    (e) => e._type === Relationships.APP_OVERRIDES_BRANCH_PROTECTION_RULE._type,
  );
  expect(branchProtectionRulesAppOverrideType.length).toBeGreaterThanOrEqual(0);
});
