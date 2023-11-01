jest.setTimeout(50000);

import {
  Recording,
  executeStepWithDependencies,
} from '@jupiterone/integration-sdk-testing';
import {
  buildStepTestConfig,
  filterDirectRelationships,
} from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { Steps } from '../constants';

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchIssues exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'issues',
  });

  const stepConfig = buildStepTestConfig(Steps.FETCH_ISSUES);
  const stepResults = await executeStepWithDependencies(stepConfig);
  expect({
    ...stepResults,
    // HACK: `@jupiterone/integration-sdk-testing`
    // does not currently support `toMatchStepMetadata` with mapped
    // relationships, which is causing tests to fail. We will add
    // support soon and remove this hack.
    collectedRelationships: filterDirectRelationships(
      stepResults.collectedRelationships,
    ),
  }).toMatchStepMetadata({
    ...stepConfig,
    invocationConfig: {
      ...stepConfig.invocationConfig,
      integrationSteps: stepConfig.invocationConfig.integrationSteps.map(
        (s) => {
          return {
            ...s,
            mappedRelationships: [],
          };
        },
      ),
    },
  });
  expect(stepResults).toMatchSnapshot();
});
