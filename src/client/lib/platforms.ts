export interface Platform {
  id: string;
  name: string;
  color: string;
}

export const PLATFORMS: Platform[] = [
  {
    id: 'website',
    name: 'Website',
    color: 'neutral',
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
    color: 'neutral',
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

  // Default to neutral "Other"
  return {
    id: 'other',
    name: source || 'Unknown',
    color: 'neutral',
  };
}

export function getPlatformColorClasses(color: string): string {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800',
    green: 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800',
    purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800',
    orange: 'bg-orange-50 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800',
    neutral: 'bg-neutral-50 border-neutral-200 dark:bg-neutral-700 dark:border-neutral-600',
    indigo: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800',
  };
  return colorMap[color] || colorMap.neutral;
}

export function getPlatformTextColorClasses(color: string): string {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-900 dark:text-blue-200',
    green: 'text-green-900 dark:text-green-200',
    purple: 'text-purple-900 dark:text-purple-200',
    orange: 'text-orange-900 dark:text-orange-200',
    neutral: 'text-neutral-900 dark:text-neutral-200',
    indigo: 'text-indigo-900 dark:text-indigo-200',
  };
  return colorMap[color] || colorMap.neutral;
}
