import { accountSteps } from './account';
import { collaboratorSteps } from './collaborators';
import { appSteps } from './apps';
import { memberSteps } from './members';
import { prSteps } from './pullRequests';
import { repoSteps } from './repos';
import { teamSteps } from './teams';
import { orgSecretSteps } from './orgSecrets';
import { repoSecretSteps } from './repoSecrets';
import { environmentSteps } from './environments';
import { issueSteps } from './issues';
import { envSecretSteps } from './envSecrets';
import { teamRepoSteps } from './teamRepos';
import { teamMemberSteps } from './teamMembers';

const integrationSteps = [
  ...accountSteps,
  ...memberSteps,
  ...repoSteps,
  ...teamSteps,
  ...collaboratorSteps,
  ...prSteps,
  ...issueSteps,
  ...appSteps,
  ...environmentSteps,
  ...orgSecretSteps,
  ...repoSecretSteps,
  ...envSecretSteps,
  ...teamMemberSteps,
  ...teamRepoSteps,
];

export { integrationSteps };
