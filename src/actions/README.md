# Partial Ingestion

When attempting to manually test the Partial Ingestion handler in the dev environment,
the following may be useful.

```ts
const client = new JupiterOneClient({
    account: 'j1dev',
    accessToken: '', // User level API token created in the J1 UI
    dev: true,
});
    
await client.init();
const r = await client.invokeIntegrationAction(
  'be77cb5a-4af3-4bde-b77d-6e6372c740e3', // integration instance id
  {
    name: 'PARTIAL_INGEST',
    parameters: {
    entities: [
      {
        _type: 'github_pullrequest', // The only _type that is current supported.
        _key: 'JupiterOne/graph-whitehat/pull-requests/5',
      },
    ],
    },
  },
);
console.log(r);
```