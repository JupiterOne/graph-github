import { accountSteps } from './account';
import { collaboratorSteps } from './collaborators';
import { appSteps } from './apps';
import { memberSteps } from './members';
import { prSteps } from './pullrequests';
import { repoSteps } from './repos';
import { teamSteps } from './teams';
import { orgSecretSteps } from './orgsecrets';
import { repoSecretSteps } from './reposecrets';
import { environmentSteps } from './environments';
import { issueSteps } from './issues';

const integrationSteps = [
  ...accountSteps,
  ...memberSteps,
  ...repoSteps,
  ...teamSteps,
  ...collaboratorSteps,
  ...prSteps,
  ...appSteps,
  ...orgSecretSteps,
  ...repoSecretSteps,
  ...environmentSteps,
  ...issueSteps,
];

export { integrationSteps };
