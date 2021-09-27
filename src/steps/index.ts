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
];

export { integrationSteps };
