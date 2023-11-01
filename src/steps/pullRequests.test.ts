jest.setTimeout(300000);

import {
  Recording,
  executeStepWithDependencies,
} from '@jupiterone/integration-sdk-testing';
import { IntegrationConfig } from '../config';
import { determineIngestStartDatetime } from './pullRequests';
import {
  buildStepTestConfig,
  filterDirectRelationships,
} from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { Relationships, Steps } from '../constants';

const filterOutPrContainsPrRelationships = (r: any) =>
  r._type !== Relationships.PULLREQUEST_CONTAINS_PULLREQUEST._type;

let recording: Recording;
afterEach(async () => {
  if (recording) {
    await recording.stop();
  }
});

test('fetchPrs exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'pullRequests',
  });

  const stepConfig = buildStepTestConfig(Steps.FETCH_PRS);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect({
    ...stepResults,
    // HACK: `@jupiterone/integration-sdk-testing`
    // does not currently support `toMatchStepMetadata` with mapped
    // relationships, which is causing tests to fail. We will add
    // support soon and remove this hack.
    collectedRelationships: filterDirectRelationships(
      stepResults.collectedRelationships.filter(
        filterOutPrContainsPrRelationships,
      ),
    ),
  }).toMatchStepMetadata({
    ...stepConfig,
    invocationConfig: {
      ...stepConfig.invocationConfig,
      integrationSteps: stepConfig.invocationConfig.integrationSteps.map(
        (s) => ({
          ...s,
          relationships: s.relationships.filter(
            filterOutPrContainsPrRelationships,
          ),
          mappedRelationships: [],
        }),
      ),
    },
  });
  expect(stepResults).toMatchSnapshot();
});

describe.each([
  ['test', Date.UTC(2002, 5, 22, 15)],
  ['DISABLED', Date.UTC(2002, 5, 22, 15)],
  ['ONE_WEEK', Date.UTC(2002, 5, 15, 15)],
  ['ONE_DAY', Date.UTC(2002, 5, 21, 15)],
  ['TWELVE_HOURS', Date.UTC(2002, 5, 22, 3)],
  ['EIGHT_HOURS', Date.UTC(2002, 5, 22, 7)],
  ['FOUR_HOURS', Date.UTC(2002, 5, 22, 11)],
  ['ONE_HOUR', Date.UTC(2002, 5, 22, 14)],
  ['THIRTY_MINUTES', Date.UTC(2002, 5, 22, 14, 30)],
])(
  'determineIngestStartDatetime',
  (pollingInterval: string, expected: number) => {
    const startedOn = Date.UTC(2002, 5, 22, 15);

    const config = {
      pollingInterval,
    } as unknown as IntegrationConfig;

    expect(determineIngestStartDatetime(config, { startedOn })).toBe(
      new Date(expected).toISOString(),
    );
  },
);
