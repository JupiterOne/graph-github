import OrganizationQuery from './OrganizationQuery';

describe('OrganizationQuery', () => {
  test('#fetchOrganization', async () => {
    const response = {
      organization: {
        id: 'O_kgDOBfl5ZQ',
        login: 'j1-ingest',
        name: 'j1-ingest',
        createdAt: '2022-02-22T19:40:36Z',
        updatedAt: '2022-03-23T20:28:45Z',
        description: 'This is a test Org for J1 Ingestion',
        email: 'test@test.com',
        databaseId: 100235621,
        isVerified: false,
        location: 'United States of America',
        websiteUrl: null,
        url: 'https://github.com/j1-ingest',
      },
      rateLimit: {
        cost: 1,
        limit: 5000,
        resetAt: '2022-03-24T18:44:44Z',
        remaining: 4999,
      },
    };
    const executor = jest.fn().mockResolvedValueOnce(response);

    const result = await OrganizationQuery.fetchOrganization(
      'j1-test',
      executor,
    );

    expect(result.rateLimit).toEqual({ ...response.rateLimit, totalCost: 1 });
    expect(result.organization).toEqual(response.organization);
    expect(executor.mock.calls[0][0]).toMatchSnapshot();
  });

  test('#fetchOrganization without rateLimit', async () => {
    const response = {
      organization: {
        id: 'O_kgDOBfl5ZQ',
        login: 'j1-ingest',
        name: 'j1-ingest',
        createdAt: '2022-02-22T19:40:36Z',
        updatedAt: '2022-03-23T20:28:45Z',
        description: 'This is a test Org for J1 Ingestion',
        email: 'test@test.com',
        databaseId: 100235621,
        isVerified: false,
        location: 'United States of America',
        websiteUrl: null,
        url: 'https://github.com/j1-ingest',
      },
    };
    const executor = jest.fn().mockResolvedValueOnce(response);

    const result = await OrganizationQuery.fetchOrganization(
      'j1-test',
      executor,
    );

    expect(result.rateLimit).toEqual({ totalCost: 0 });
    expect(result.organization).toEqual(response.organization);
  });
});
