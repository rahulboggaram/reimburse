import Link from "next/link";
import { cn } from "@/lib/utils";

/** Shared accent text-link style across the app funnel. */
export const textLinkClassName =
  "text-sm font-medium text-accent hover:text-accent-hover";

export function TextLink(
  props: React.ComponentProps<typeof Link> & { className?: string },
) {
  const { className, ...rest } = props;
  return (
    <Link
      {...rest}
      className={cn(textLinkClassName, "inline-block", className)}
    />
  );
}

export function TextLinkButton(
  props: React.ComponentProps<"button"> & { className?: string },
) {
  const { className, type = "button", ...rest } = props;
  return (
    <button
      {...rest}
      type={type}
      className={cn(textLinkClassName, "shrink-0", className)}
    />
  );
}
