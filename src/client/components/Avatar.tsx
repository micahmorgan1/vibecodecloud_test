import BoringAvatar from 'boring-avatars';

const STYLES = ['marble', 'pixel', 'sunset', 'ring', 'bauhaus'] as const;

const PALETTE = ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface AvatarProps {
  name: string;
  email?: string;
  size: number;
  className?: string;
}

export default function Avatar({ name, email, size, className }: AvatarProps) {
  const seed = email || name;
  const variant = STYLES[hashCode(seed) % STYLES.length];

  return (
    <div className={className} style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      <BoringAvatar
        size={size}
        name={seed}
        variant={variant}
        colors={PALETTE}
      />
    </div>
  );
}
