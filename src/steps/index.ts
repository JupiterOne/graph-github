import { accountSteps } from './account';
import { collaboratorSteps } from './collaborators';
import { appSteps } from './apps';
import { memberSteps } from './members';
import { prSteps } from './pullrequests';
import { repoSteps } from './repos';
import { teamSteps } from './teams';

const integrationSteps = [
  ...accountSteps,
  ...memberSteps,
  ...repoSteps,
  ...teamSteps,
  ...collaboratorSteps,
  ...prSteps,
  ...appSteps,
];

export { integrationSteps };
