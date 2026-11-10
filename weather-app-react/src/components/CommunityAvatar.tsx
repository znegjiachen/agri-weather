/** 社区头像：有自定义图片就显示图片，没有就回退到农夫 emoji。 */
interface CommunityAvatarProps {
  src?: string | null;
  small?: boolean;
  alt?: string;
}

export default function CommunityAvatar({ src, small = false, alt = '农友头像' }: CommunityAvatarProps) {
  const className = `community-avatar${small ? ' small' : ''}`;
  if (src) {
    return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" />;
  }
  return <span className={className} aria-hidden>👨‍🌾</span>;
}
