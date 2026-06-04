import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-white disabled:hover:bg-zinc-300",
        outline:
          "border border-zinc-200 bg-white hover:bg-zinc-50 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-zinc-100",
        ghost:
          "hover:bg-zinc-100 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-zinc-100",
      },
      size: {
        default: "h-field px-4 py-2",
        lg: "h-field px-4 text-base",
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
