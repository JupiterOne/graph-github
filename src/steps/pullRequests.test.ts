import { Recording } from '@jupiterone/integration-sdk-testing';
import { IntegrationConfig, sanitizeConfig } from '../config';
import { determineIngestStartDatetime, prSteps } from './pullRequests';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import {
  GithubEntities,
  GITHUB_REPO_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
} from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';
import { SchedulerInterval } from '@jupiterone/jupiter-types';

jest.setTimeout(20000);

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
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: prSteps[0].id,
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

  const issues = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_PR._type,
  );
  expect(issues.length).toBeGreaterThan(0);
  expect(issues).toMatchGraphObjectSchema(GithubEntities.GITHUB_PR);

  // relationships
  const repoHasPrRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_REPO_PR_RELATIONSHIP_TYPE,
  );
  expect(repoHasPrRels.length).toBeGreaterThan(0);

  const memberApprovedPrRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
  );
  expect(memberApprovedPrRels.length).toBeGreaterThan(0);

  const memberOpenedPrRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
  );
  expect(memberOpenedPrRels.length).toBeGreaterThan(0);

  const memberReviewedPrRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
  );
  expect(memberReviewedPrRels.length).toBeGreaterThan(0);
});

describe.each([
  ['test' as SchedulerInterval, Date.UTC(2002, 5, 22, 15)],
  [SchedulerInterval.DISABLED, Date.UTC(2002, 5, 22, 15)],
  [SchedulerInterval.ONE_WEEK, Date.UTC(2002, 5, 15, 15)],
  [SchedulerInterval.ONE_DAY, Date.UTC(2002, 5, 21, 15)],
  [SchedulerInterval.TWELVE_HOURS, Date.UTC(2002, 5, 22, 3)],
  [SchedulerInterval.EIGHT_HOURS, Date.UTC(2002, 5, 22, 7)],
  [SchedulerInterval.FOUR_HOURS, Date.UTC(2002, 5, 22, 11)],
  [SchedulerInterval.ONE_HOUR, Date.UTC(2002, 5, 22, 14)],
  [SchedulerInterval.THIRTY_MINUTES, Date.UTC(2002, 5, 22, 14, 30)],
])(
  'determineIngestStartDatetime',
  (pollingInterval: SchedulerInterval, expected: number) => {
    const startedOn = Date.UTC(2002, 5, 22, 15);

    let config = {
      pollingInterval,
    } as unknown as IntegrationConfig;

    expect(determineIngestStartDatetime(config, { startedOn })).toBe(
      new Date(expected).toISOString(),
    );
  },
);
