export const normalizeDepartment = (value?: string | null): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const departmentMatches = (a?: string | null, b?: string | null): boolean => {
  const x = normalizeDepartment(a);
  const y = normalizeDepartment(b);
  if (!x || !y) return false;
  if (x === y) return true;

  const aliases = [
    ['comp', 'computer', 'computer engineering', 'cse'],
    ['entc', 'etc', 'electronics and telecommunication', 'electronics and telecommunications', 'electronics and telecommunication engineering'],
    ['mech', 'mechanical', 'mechanical engineering'],
    ['civil', 'civil engineering'],
    ['it', 'information technology'],
    ['chem', 'chemical', 'chemical engineering']
  ];

  for (const group of aliases) {
    if (group.includes(x) && group.includes(y)) return true;
  }

  const stripSuffix = (s: string) => s.replace(/\bengineering\b/g, '').trim();
  const strippedX = stripSuffix(x);
  const strippedY = stripSuffix(y);
  if (strippedX && strippedX === strippedY) return true;

  return false;
};
