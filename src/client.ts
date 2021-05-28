import { 
  IntegrationLogger, 
  IntegrationValidationError
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from './config';
import { AccountType } from './types';
import getInstallation from './util/getInstallation';
import createGitHubAppClient from './util/createGitHubAppClient';
import OrganizationAccountClient from './client/OrganizationAccountClient';
import { GitHubGraphQLClient } from './client/GraphQLClient';
import resourceMetadataMap from './client/GraphQLClient/resourceMetadataMap';

export type ResourceIteratee<T> = (each: T) => Promise<void> | void;

// Providers often supply types with their API libraries.

type AcmeUser = {
  id: string;
  name: string;
};

type AcmeGroup = {
  id: string;
  name: string;
  users?: Pick<AcmeUser, 'id'>[];
};

// Those can be useful to a degree, but often they're just full of optional
// values. Understanding the response data may be more reliably accomplished by
// reviewing the API response recordings produced by testing the wrapper client
// (below). However, when there are no types provided, it is necessary to define
// opaque types for each resource, to communicate the records that are expected
// to come from an endpoint and are provided to iterating functions.

/*
import { Opaque } from 'type-fest';
export type AcmeUser = Opaque<any, 'AcmeUser'>;
export type AcmeGroup = Opaque<any, 'AcmeGroup'>;
*/

/**
 * An APIClient maintains authentication state and provides an interface to
 * third party data APIs.
 *
 * It is recommended that integrations wrap provider data APIs to provide a
 * place to handle error responses and implement common patterns for iterating
 * resources.
 */
export class APIClient {
  constructor(readonly config: IntegrationConfig, readonly logger: IntegrationLogger) { }

  public async verifyAuthentication(): Promise<void> {
    // TODO make the most light-weight request possible to validate
    // authentication works with the provided credentials, throw an err if
    // authentication fails
    const installationId = Number(this.config.installationId);
    const appClient = await createGitHubAppClient(
      installationId, 
      this.logger
    );
    const { token } = (await appClient.auth({ type: 'installation' })) as {
      token: string;
    };
    const installation = await getInstallation(appClient, installationId);
  
    if (installation.target_type !== AccountType.Org) {
      throw new IntegrationValidationError(
        'Integration supports only GitHub Organization accounts.'
      );
    }

    let login = '';
    if (installation.account?.login) {
      login = installation.account.login;
    }
    const accountClient = new OrganizationAccountClient({
      login: login,
      restClient: appClient,
      graphqlClient: new GitHubGraphQLClient(
        token,
        resourceMetadataMap(),
        this.logger
      ),
      logger: this.logger,
      analyzeCommitApproval: this.config.analyzeCommitApproval,
    });

    const output = await accountClient.getAccount();
    console.log(output);
    const output2 = await accountClient.getMembers();
    console.log(output2);
    
  }

  /**
   * Iterates each user resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateUsers(
    iteratee: ResourceIteratee<AcmeUser>,
  ): Promise<void> {
    // TODO paginate an endpoint, invoke the iteratee with each record in the
    // page
    //
    // The provider API will hopefully support pagination. Functions like this
    // should maintain pagination state, and for each page, for each record in
    // the page, invoke the `ResourceIteratee`. This will encourage a pattern
    // where each resource is processed and dropped from memory.

    const users: AcmeUser[] = [
      {
        id: 'acme-user-1',
        name: 'User One',
      },
      {
        id: 'acme-user-2',
        name: 'User Two',
      },
    ];

    for (const user of users) {
      await iteratee(user);
    }
  }

  /**
   * Iterates each group resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateGroups(
    iteratee: ResourceIteratee<AcmeGroup>,
  ): Promise<void> {
    // TODO paginate an endpoint, invoke the iteratee with each record in the
    // page
    //
    // The provider API will hopefully support pagination. Functions like this
    // should maintain pagination state, and for each page, for each record in
    // the page, invoke the `ResourceIteratee`. This will encourage a pattern
    // where each resource is processed and dropped from memory.

    const groups: AcmeGroup[] = [
      {
        id: 'acme-group-1',
        name: 'Group One',
        users: [
          {
            id: 'acme-user-1',
          },
        ],
      },
    ];

    for (const group of groups) {
      await iteratee(group);
    }
  }
}

export function createAPIClient(config: IntegrationConfig, logger: IntegrationLogger): APIClient {
  return new APIClient(config, logger);
}
