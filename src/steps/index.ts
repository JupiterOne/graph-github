import { accountSteps } from './account';
import { memberSteps } from './members';

const integrationSteps = [...accountSteps, ...memberSteps];

export { integrationSteps };
