// Reusable label identities and minimal conjunctive selectors.
// A label is a domain entity; filters compare only its stable identifier.

const ID_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_.:/-]*$/u;

export function normalizeLabelId(label) {
  const raw = typeof label === 'string' ? label : label?.id;
  if (typeof raw !== 'string') {
    throw new TypeError('A label must be an ID or an entity with a string ID');
  }
  const id = raw.trim().replace(/^#/, '').normalize('NFC').toLowerCase();
  if (!ID_PATTERN.test(id)) {
    throw new TypeError(`Invalid label ID: ${raw}`);
  }
  return id;
}

export function createLabel({ id, name, description } = {}) {
  const canonicalId = normalizeLabelId(id);
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw new TypeError('A label name must be a nonempty string');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw new TypeError('A label description must be a string');
  }
  return Object.freeze({
    id: canonicalId,
    name: name?.trim() ?? canonicalId,
    ...(description === undefined ? {} : { description }),
  });
}

// First useful syntax only: #corse #energie = both labels required.
export function parseLabelSelector(expression = '') {
  if (typeof expression !== 'string') {
    throw new TypeError('Label selector must be a string');
  }
  const all = expression.trim().split(/\s+/).filter(Boolean).map(token => {
    if (!token.startsWith('#')) {
      throw new TypeError(`Expected a hashtag, received: ${token}`);
    }
    const id = normalizeLabelId(token);
    if (['but', 'all', 'and', 'or', 'not'].includes(id)) {
      throw new TypeError(`Unsupported historical selector operator: ${token}`);
    }
    return id;
  });
  return { all: [...new Set(all)] };
}

export function matchesLabels(assignedLabels, selector = {}) {
  if (!Array.isArray(assignedLabels)) {
    throw new TypeError('Assigned labels must be an array');
  }
  const resolved = typeof selector === 'string' ? parseLabelSelector(selector) : selector;
  if (!resolved || Array.isArray(resolved) || typeof resolved !== 'object' ||
      !Object.keys(resolved).every(key => key === 'all') ||
      !Array.isArray(resolved.all ?? [])) {
    throw new TypeError('Label selector currently supports only an optional all array');
  }
  const assigned = new Set(assignedLabels.map(normalizeLabelId));
  return (resolved.all ?? []).every(id => assigned.has(normalizeLabelId(id)));
}
