import { Entity } from '@jupiterone/integration-sdk-core';

export function createMockAccountEntity(): Entity {
  return {
    _class: ['Account'],
    _key: 'MDEyOk9yZ2FuaXphdGlvbjg0OTIzNTAz',
    _rawData: [
      {
        name: 'default',
        rawData: {
          createdAt: '2021-05-27T15:21:12Z',
          databaseId: 84923503,
          description: "Here's my test description",
          email: 'email@email.com',
          id: 'MDEyOk9yZ2FuaXphdGlvbjg0OTIzNTAz',
          isVerified: false,
          location: 'Albania',
          login: 'Kei-Institute',
          name: 'Kei-Institute',
          updatedAt: '2022-01-06T17:48:33Z',
          url: 'https://github.com/Kei-Institute',
          websiteUrl: 'www.goclickatesturl.com',
        },
      },
    ],
    _type: 'github_account',
    accountId: 'Kei-Institute',
    accountType: 'Organization',
    createdOn: 1622128872000,
    databaseId: 84923503,
    description: "Here's my test description",
    displayName: 'Kei-Institute',
    email: 'email@email.com',
    location: 'Albania',
    login: 'Kei-Institute',
    name: 'Kei-Institute',
    node: 'MDEyOk9yZ2FuaXphdGlvbjg0OTIzNTAz',
    updatedOn: 1641491313000,
    verified: false,
    webLink: 'https://github.com/Kei-Institute',
    websiteUrl: 'www.goclickatesturl.com',
  };
}
