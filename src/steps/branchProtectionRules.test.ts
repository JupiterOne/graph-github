jest.setTimeout(40000);

import {
  Recording,
  executeStepWithDependencies,
} from '@jupiterone/integration-sdk-testing';
import { buildStepTestConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { Relationships, Steps } from '../constants';

const filterOutAppsRelationships = (r: any) =>
  r._type !== Relationships.APP_OVERRIDES_BRANCH_PROTECTION_RULE._type;

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchBranchProtectionRules exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'branchProtectionRules',
  });
  const stepConfig = buildStepTestConfig(Steps.FETCH_BRANCH_PROTECTION_RULES);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect({
    ...stepResults,
    collectedRelationships: stepResults.collectedRelationships.filter(
      filterOutAppsRelationships,
    ),
  }).toMatchStepMetadata({
    ...stepConfig,
    invocationConfig: {
      ...stepConfig.invocationConfig,
      integrationSteps: stepConfig.invocationConfig.integrationSteps.map(
        (s) => ({
          ...s,
          relationships: s.relationships.filter(filterOutAppsRelationships),
        }),
      ),
    },
  });

  // Test for Apps
  const branchProtectionRulesAppOverrideType =
    stepResults.collectedRelationships.filter(
      (r) =>
        r._type === Relationships.APP_OVERRIDES_BRANCH_PROTECTION_RULE._type,
    );
  expect(branchProtectionRulesAppOverrideType.length).toBeGreaterThanOrEqual(0);
});
