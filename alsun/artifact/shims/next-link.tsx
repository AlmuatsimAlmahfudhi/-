"use client";
import { useRouter } from "./router";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };
export default function Link({ href, onClick, prefetch, ...rest }: Props) {
  void prefetch;
  const { navigate } = useRouter();
  return (
    <a
      {...rest}
      href={"#"}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
        navigate(href);
      }}
    />
  );
}
