import {
  GithubResource,
  QueryHierarchy,
  ResourceMap,
  ResourceMetadata,
} from './types';

export default function buildGraphQL(
  resourceMetadataMap: ResourceMap<ResourceMetadata>,
  parentResource: GithubResource,
  queryResources: GithubResource[],
): string {
  const queries: QueryHierarchy[] = [];
  const variables: string[] = [];

  if (resourceMetadataMap[parentResource].graphRequestVariables) {
    variables.push(
      ...resourceMetadataMap[parentResource].graphRequestVariables,
    );
  }

  for (const r of queryResources) {
    let resourceMetadata = resourceMetadataMap[r];
    if (!resourceMetadata) continue;

    const parent = resourceMetadata.parent;
    if (parent) {
      if (queryResources.includes(parent)) {
        continue;
      }

      resourceMetadata = resourceMetadataMap[parent];
    }

    if (resourceMetadata.graphRequestVariables) {
      variables.push(...resourceMetadata.graphRequestVariables);
    }

    const includedChildren = resourceMetadata.children
      ? resourceMetadata.children.reduce(
          (included: GithubResource[], c: GithubResource) => {
            if (queryResources.includes(c)) {
              included.push(c);
            }
            return included;
          },
          [],
        )
      : [];

    if (resourceMetadata.children && includedChildren.length > 0) {
      includedChildren.forEach((c: GithubResource) => {
        if (resourceMetadataMap[c].graphRequestVariables) {
          variables.push(...resourceMetadataMap[c].graphRequestVariables);
        }
      });
      queries.push({
        self: resourceMetadata.factory,
        children: includedChildren.map((c: GithubResource) => ({
          self: () => resourceMetadataMap[c].factory(),
          children: [],
        })),
      });
    } else {
      queries.push({ self: resourceMetadata.factory, children: [] });
    }
  }

  const fragmentHierarchy: QueryHierarchy[] = [
    {
      self: resourceMetadataMap[parentResource].factory,
      children: [...queries],
    },
    {
      self: () => '...rateLimit',
      children: [],
    },
  ];

  return `query (${variables.join(', ')}) {
    ${collapseFragments(fragmentHierarchy)}
  }`;
}

function collapseFragments(fragments: QueryHierarchy[]): string {
  return fragments
    .map((f) => {
      return f.self(collapseFragments(f.children));
    })
    .join('\n');
}
