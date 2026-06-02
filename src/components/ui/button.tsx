import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-zinc-900 text-white hover:bg-zinc-800",
        outline: "border border-zinc-200 bg-white hover:bg-zinc-50",
        ghost: "hover:bg-zinc-100",
      },
      size: {
        default: "h-11 px-4 py-2",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button(
  props: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>,
) {
  return (
    <button
      type={props.type ?? "button"}
      className={cn(
        buttonVariants({ variant: props.variant, size: props.size }),
        props.className,
      )}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
