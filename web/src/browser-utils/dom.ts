export function iterateUp(
  node: Node | null,
  ops: (n: Node) => boolean,
) {
  let currentNode: Node | null = node;
  while (currentNode) {
    if (!ops(currentNode)) {
      return currentNode;
    }
    if (currentNode.parentNode instanceof ShadowRoot) {
      currentNode = currentNode.parentNode.host;
    } else {
      currentNode = currentNode.parentNode;
    }
  }
  return currentNode ?? null;
}

export function findAncestor(
  node: Node | null,
  predicate: (n: Node) => boolean,
) {
  return iterateUp(node, (n) => { return !predicate(n); });
}

export function findAncestorOfType<T>(
  node: Node | null,
  baseType: new (...args: any[]) => T,
): T | null {
  return findAncestor(node, (n) => n instanceof baseType) as T | null;
}

