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

  // TODO: make this not super ugly
  if (resourceMetadataMap[parentResource].graphRequestVariable) {
    variables.push(resourceMetadataMap[parentResource].graphRequestVariable);
  }
  if (resourceMetadataMap[parentResource].graphRequestVariable2) {
    variables.push(resourceMetadataMap[parentResource].graphRequestVariable2!);
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

    if (resourceMetadata.graphRequestVariable) {
      variables.push(resourceMetadata.graphRequestVariable);
    }
    if (resourceMetadata.graphRequestVariable2) {
      variables.push(resourceMetadata.graphRequestVariable2);
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
        if (resourceMetadataMap[c].graphRequestVariable) {
          variables.push(resourceMetadataMap[c].graphRequestVariable);
        }
        // TODO: Do this better
        if (resourceMetadataMap[c].graphRequestVariable2) {
          variables.push(resourceMetadataMap[c].graphRequestVariable2!);
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
