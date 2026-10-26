export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading page</span>
      <div className="animate-pulse space-y-4">
        <div className="h-2.5 w-24 rounded-full bg-[#dfe6db]" />
        <div className="h-8 w-2/3 max-w-md rounded-lg bg-[#e3e9df]" />
        <div className="h-3 w-full max-w-lg rounded-full bg-[#e8ede4]" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="animate-pulse rounded-[12px] border border-[#e5eae1] bg-white p-4"
          >
            <div className="h-2 w-16 rounded-full bg-[#e3e9df]" />
            <div className="mt-3 h-6 w-14 rounded-md bg-[#e8ede4]" />
            <div className="mt-2 h-2 w-24 rounded-full bg-[#eef1ea]" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="animate-pulse rounded-[12px] border border-[#e5eae1] bg-white p-5">
          <div className="h-3 w-32 rounded-full bg-[#e3e9df]" />
          <div className="mt-4 space-y-2.5">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="h-2.5 rounded-full bg-[#eef1ea]" />
            ))}
          </div>
        </div>
        <div className="animate-pulse rounded-[12px] border border-[#e5eae1] bg-white p-5">
          <div className="h-3 w-24 rounded-full bg-[#e3e9df]" />
          <div className="mt-4 space-y-2.5">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-2.5 rounded-full bg-[#eef1ea]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
