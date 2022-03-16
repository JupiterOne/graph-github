import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { prSteps } from './pullRequests';
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

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchPrs exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'pullRequests',
  });
  sanitizeConfig(integrationConfig);
  integrationConfig.installationId = 23522163; //this is the id the recordings are under

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
