import { accountSteps } from './account';
import { memberSteps } from './members';
import { prSteps } from './pullrequests';
import { repoSteps } from './repos';
import { teamSteps } from './teams';

const integrationSteps = [
  ...accountSteps,
  ...memberSteps,
  ...repoSteps,
  ...teamSteps,
  ...prSteps,
];

export { integrationSteps };
