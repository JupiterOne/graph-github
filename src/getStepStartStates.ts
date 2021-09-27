import {
  IntegrationExecutionContext,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import { validateInvocation, IntegrationConfig } from './config';

export default async function getStepStartStates(
  context: IntegrationExecutionContext<IntegrationConfig>,
): Promise<StepStartStates> {
  //const config = context.instance.config; //might use this later
  const scopes = await validateInvocation(context);

  return {
    ['fetch-account']: { disabled: false },
    ['fetch-users']: { disabled: false },
    ['fetch-repos']: { disabled: false },
    ['fetch-teams']: { disabled: false },
    ['fetch-collaborators']: { disabled: false },
    ['fetch-prs']: { disabled: false },
    ['fetch-apps']: { disabled: !scopes.orgAdminScope },
    ['fetch-org-secrets']: { disabled: !scopes.secretsScope },
    ['fetch-repo-secrets']: { disabled: !scopes.secretsScope },
    ['fetch-environments']: { disabled: !scopes.actionsScope },
    //['fetch-issues']: { disabled: false }, //for later
  };
}
