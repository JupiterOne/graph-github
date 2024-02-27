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
import MockDate from 'mockdate';

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
  const stepResults = await executeStepWithDependencies({
    ...stepConfig,
    instanceConfig: {
      ...stepConfig.instanceConfig,
      pullRequestIngestSinceDays: 365,
    },
  });

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
});

describe('determineIngestStartDatetime', () => {
  beforeEach(() => {
    MockDate.set('2023-12-31T12:00:00.000Z');
  });

  afterEach(() => {
    MockDate.reset();
  });

  it('should return the start datetime from config if provided', () => {
    const config = {
      pullRequestIngestStartDatetime: '2024-01-20T12:00:00Z',
    } as IntegrationConfig;
    const result = determineIngestStartDatetime(config);
    expect(result).toBe('2024-01-20T12:00:00.000Z');
  });

  it('should return the datetime from 90 days ago if config does not provide start datetime', () => {
    const config = {} as IntegrationConfig;
    const result = determineIngestStartDatetime(config);
    expect(result).toBe('2023-10-02T12:00:00.000Z');
  });

  it('should return the datetime from specified number of days ago if provided in config', () => {
    const config = {
      pullRequestIngestSinceDays: 365,
    } as IntegrationConfig;
    const result = determineIngestStartDatetime(config);
    expect(result).toBe('2022-12-31T12:00:00.000Z');
  });
});
