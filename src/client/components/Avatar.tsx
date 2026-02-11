import BoringAvatar from 'boring-avatars';

const STYLES = ['marble', 'pixel', 'sunset', 'ring'] as const;

const PALETTES = [
  ['#5b1d99', '#0074b4', '#00b34c', '#ffd41f', '#fc6e3d'], // marble pop
  ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'], // warm earth
  ['#69d2e7', '#a7dbd8', '#e0e4cc', '#f38630', '#fa6900'], // ocean sunset
  ['#0f4c81', '#5b8db8', '#aecad6', '#f2d0a4', '#d4845e'], // coastal dusk
  ['#6c5ce7', '#a29bfe', '#fd79a8', '#fab1a0', '#ffeaa7'], // pastel dream
  ['#dacdac', '#f39708', '#f85741', '#0e9094', '#1e1801'], // warm contrast
  ['#f23e02', '#fef5c8', '#00988d', '#2c6b74', '#013750'], // fire & sea
  ['#f0f0f0', '#d8d8d8', '#c0c0a8', '#604848', '#484848'], // warm gray
  ['#f3b578', '#f78376', '#da4c66', '#8f3c68', '#3f3557'], // sunset plum
  ['#8dc9b5', '#f6f4c2', '#ffc391', '#ff695c', '#8c315d'], // tropical sorbet
];

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
  const hash = hashCode(seed);
  const variant = STYLES[hash % STYLES.length];
  const palette = PALETTES[Math.floor(hash / STYLES.length) % PALETTES.length];

  return (
    <div className={className} style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      <BoringAvatar
        size={size}
        name={seed}
        variant={variant}
        colors={palette}
      />
    </div>
  );
}
