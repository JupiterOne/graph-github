import { accountSteps } from './account';
import { memberSteps } from './members';
import { teamSteps } from './teams';

const integrationSteps = [...accountSteps, ...memberSteps, ...teamSteps];

export { integrationSteps };
