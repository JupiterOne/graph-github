import { accountSteps } from './account';
import { memberSteps } from './members';
import { repoSteps } from './repos';
import { teamSteps } from './teams';

const integrationSteps = [
  ...accountSteps,
  ...memberSteps,
  ...repoSteps,
  ...teamSteps,
];

export { integrationSteps };
