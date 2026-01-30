export interface Platform {
  id: string;
  name: string;
  color: string;
}

export const PLATFORMS: Platform[] = [
  {
    id: 'website',
    name: 'Website',
    color: 'gray',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    color: 'blue',
  },
  {
    id: 'handshake',
    name: 'Handshake',
    color: 'green',
  },
  {
    id: 'aiala',
    name: 'AIALA',
    color: 'purple',
  },
  {
    id: 'aiabr',
    name: 'AIA Baton Rouge',
    color: 'orange',
  },
  {
    id: 'direct',
    name: 'Direct Application',
    color: 'gray',
  },
  {
    id: 'referral',
    name: 'Referral',
    color: 'indigo',
  },
];

export function getPlatformBySource(source: string): Platform {
  // Normalize the source string for matching
  const normalized = source.toLowerCase().trim();

  // Try to find exact match
  const exactMatch = PLATFORMS.find(p =>
    p.name.toLowerCase() === normalized ||
    p.id === normalized
  );

  if (exactMatch) return exactMatch;

  // Try partial matches
  if (normalized.includes('linkedin')) {
    return PLATFORMS.find(p => p.id === 'linkedin')!;
  }
  if (normalized.includes('handshake')) {
    return PLATFORMS.find(p => p.id === 'handshake')!;
  }
  if (normalized.includes('aiala')) {
    return PLATFORMS.find(p => p.id === 'aiala')!;
  }
  if (normalized.includes('aia') && normalized.includes('baton')) {
    return PLATFORMS.find(p => p.id === 'aiabr')!;
  }
  if (normalized.includes('website')) {
    return PLATFORMS.find(p => p.id === 'website')!;
  }
  if (normalized.includes('direct')) {
    return PLATFORMS.find(p => p.id === 'direct')!;
  }
  if (normalized.includes('referral')) {
    return PLATFORMS.find(p => p.id === 'referral')!;
  }

  // Default to gray "Other"
  return {
    id: 'other',
    name: source || 'Unknown',
    color: 'gray',
  };
}

export function getPlatformColorClasses(color: string): string {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
    gray: 'bg-gray-50 border-gray-200',
    indigo: 'bg-indigo-50 border-indigo-200',
  };
  return colorMap[color] || 'bg-gray-50 border-gray-200';
}

export function getPlatformTextColorClasses(color: string): string {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-900',
    green: 'text-green-900',
    purple: 'text-purple-900',
    orange: 'text-orange-900',
    gray: 'text-gray-900',
    indigo: 'text-indigo-900',
  };
  return colorMap[color] || 'text-gray-900';
}
