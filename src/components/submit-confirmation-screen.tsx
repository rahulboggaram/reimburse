"use client";

type SubmitConfirmationScreenProps = {
  title: string;
  subtitle?: string;
};

export function SubmitConfirmationScreen(props: SubmitConfirmationScreenProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-app-bg px-6"
      role="status"
      aria-live="polite"
      aria-label={props.title}
    >
      <div className="flex max-w-sm flex-col items-center gap-6 text-center">
        <div
          className="flex size-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/25 animate-submit-check-circle"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="size-10 text-white"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M6 12.5 10 16.5 18 8.5"
              pathLength={1}
              className="animate-submit-check-stroke"
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
              }}
            />
          </svg>
        </div>

        <div className="animate-submit-check-content">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {props.title}
          </h2>
          {props.subtitle ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {props.subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
