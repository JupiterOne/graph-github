import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { issueSteps } from './issues';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import {
  GithubEntities,
  GITHUB_REPO_ISSUE_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_CREATED_ISSUE_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_ASSIGNED_ISSUE_RELATIONSHIP_TYPE,
} from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchIssues exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'issues',
  });
  sanitizeConfig(integrationConfig);
  integrationConfig.installationId = 17214088; //this is the id the recordings are under

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: issueSteps[0].id,
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
    (e) => e._type === GithubEntities.GITHUB_ISSUE._type,
  );
  expect(issues.length).toBeGreaterThan(0);
  expect(issues).toMatchGraphObjectSchema(GithubEntities.GITHUB_ISSUE);

  // relationships
  const repoHasIssueRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_REPO_ISSUE_RELATIONSHIP_TYPE,
  );
  expect(repoHasIssueRels.length).toBeGreaterThan(0);

  const memberCreatedIssueRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_MEMBER_CREATED_ISSUE_RELATIONSHIP_TYPE,
  );
  expect(memberCreatedIssueRels.length).toBeGreaterThan(0);

  const memberAssignedIssueRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_MEMBER_ASSIGNED_ISSUE_RELATIONSHIP_TYPE,
  );
  expect(memberAssignedIssueRels.length).toBeGreaterThan(0);
});
