import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
//change
import { branchProtectionRulesSteps } from './branchProtectionRules';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import {
  GITHUB_BRANCH_PROTECTION_RULE_RELATIONSHIP_TYPE,
  GITHUB_BRANCH_PROTECTION_RULE_MEMBER_OVERRIDE_TYPE,
  GITHUB_BRANCH_PROTECTION_RULE_TEAM_OVERRIDE_TYPE,
  //GITHUB_BRANCH_PROTECTION_RULE_APP_OVERRIDE_TYPE,
  GithubEntities,
} from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

//change
test('fetchBranchProtectionRules exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    //change
    name: 'branchProtectionRules',
  });
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      //change
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
    (e) => e._type === GithubEntities.GITHUB_BRANCH_PROTECITON_RULE._type,
  );

  expect(branchProtectionRules.length).toBeGreaterThan(0);
  expect(branchProtectionRules).toMatchGraphObjectSchema({
    _class: GithubEntities.GITHUB_BRANCH_PROTECITON_RULE._class,
  });

  // relationships
  const branchProtectionRulesType = collectedRelationships.filter(
    (e) => e._type === GITHUB_BRANCH_PROTECTION_RULE_RELATIONSHIP_TYPE,
  );
  expect(branchProtectionRulesType.length).toBeGreaterThan(0);

  const branchProtectionRulesMemberOverrideType = collectedRelationships.filter(
    (e) => e._type === GITHUB_BRANCH_PROTECTION_RULE_MEMBER_OVERRIDE_TYPE,
  );
  expect(branchProtectionRulesMemberOverrideType.length).toBeGreaterThan(0);

  const branchProtectionRulesTeamOverrideType = collectedRelationships.filter(
    (e) => e._type === GITHUB_BRANCH_PROTECTION_RULE_TEAM_OVERRIDE_TYPE,
  );
  expect(branchProtectionRulesTeamOverrideType.length).toBeGreaterThan(0);

  //Need to add App to bypass protection rules before running this test.
  /*
  const branchProtectionRulesAppOverrideType = collectedRelationships.filter(
    (e) => e._type === GITHUB_BRANCH_PROTECTION_RULE_APP_OVERRIDE_TYPE,
  );
  expect(branchProtectionRulesAppOverrideType.length).toBeGreaterThan(0);
  */
});
