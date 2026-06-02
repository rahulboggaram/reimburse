type Receipt = {
  id: string;
  url: string;
  fileName: string | null;
  mimeType: string;
};

export function ReceiptGallery(props: {
  receipts: Receipt[];
  title?: string;
}) {
  if (props.receipts.length === 0) return null;

  return (
    <div className="space-y-2">
      {props.title ? (
        <p className="text-xs font-medium text-zinc-500">{props.title}</p>
      ) : null}
      <ul className="grid grid-cols-2 gap-2">
        {props.receipts.map((receipt) => (
          <li key={receipt.id}>
            <a
              href={receipt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition-shadow hover:shadow-md"
            >
              {receipt.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- user uploads
                <img
                  src={receipt.url}
                  alt={receipt.fileName ?? "Receipt"}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 px-2 text-center">
                  <span className="text-2xl" aria-hidden>
                    📄
                  </span>
                  <span className="line-clamp-2 text-xs font-medium text-zinc-700">
                    {receipt.fileName ?? "PDF receipt"}
                  </span>
                  <span className="text-xs text-emerald-800">Open file</span>
                </div>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
