import {
  OrganizationResource,
  QueryHierarchy,
  ResourceMap,
  ResourceMetadata
} from './types';

export default function buildGraphQL(
  resourceMetadataMap: ResourceMap<ResourceMetadata>,
  queryResources: OrganizationResource[]
): string {
  const variables: string[] = ['$login: String!'];
  const queries: QueryHierarchy[] = [];

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

    variables.push(resourceMetadata.graphRequestVariable);

    const includedChildren = resourceMetadata.children
      ? resourceMetadata.children.reduce(
          (included: OrganizationResource[], c: OrganizationResource) => {
            if (queryResources.includes(c)) {
              included.push(c);
            }

            return included;
          },
          []
        )
      : [];

    if (resourceMetadata.children && includedChildren.length > 0) {
      variables.push(
        ...includedChildren.map(
          (c: OrganizationResource) =>
            resourceMetadataMap[c].graphRequestVariable
        )
      );
      queries.push({
        self: resourceMetadata.factory,
        children: includedChildren.map((c: OrganizationResource) => ({
          self: () => resourceMetadataMap[c].factory(),
          children: []
        }))
      });
    } else {
      queries.push({ self: resourceMetadata.factory, children: [] });
    }
  }

  const fragmentHierarchy: QueryHierarchy[] = [
    {
      self: resourceMetadataMap[OrganizationResource.Organization].factory,
      children: [...queries]
    },
    {
      self: () => '...rateLimit',
      children: []
    }
  ];

  return `query (${variables.join(', ')}) {
    ${collapseFragments(fragmentHierarchy)}
  }`;
}

function collapseFragments(fragments: QueryHierarchy[]): string {
  return fragments
    .map(f => {
      return f.self(collapseFragments(f.children));
    })
    .join('\n');
}
