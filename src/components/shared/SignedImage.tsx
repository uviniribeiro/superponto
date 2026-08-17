import { AvatarImage } from "@/components/ui/avatar";
import { useSignedUrl } from "@/lib/storageUrl";

type SignedAvatarImageProps = React.ComponentProps<typeof AvatarImage> & {
  src?: string | null;
};

/** AvatarImage that resolves private-bucket photos to short-lived signed URLs. */
export function SignedAvatarImage({ src, ...props }: SignedAvatarImageProps) {
  const resolved = useSignedUrl(src);
  return <AvatarImage {...props} src={resolved || undefined} />;
}

type SignedImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: string | null;
};

/** <img> that resolves private-bucket photos to short-lived signed URLs. */
export function SignedImg({ src, ...props }: SignedImgProps) {
  const resolved = useSignedUrl(src);
  if (!resolved) return null;
  return <img {...props} src={resolved} />;
}
