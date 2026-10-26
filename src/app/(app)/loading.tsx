export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading workspace</span>
      <div className="animate-pulse space-y-4">
        <div className="h-2.5 w-20 rounded-full bg-[#eaecf0]" />
        <div className="h-8 w-1/2 max-w-sm rounded-lg bg-[#eaecf0]" />
        <div className="h-3 w-full max-w-md rounded-full bg-[#eaecf0]" />
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="animate-pulse rounded-[12px] border border-[#eaecf0] bg-white p-4"
          >
            <div className="h-2 w-16 rounded-full bg-[#eaecf0]" />
            <div className="mt-3 h-6 w-12 rounded-md bg-[#eaecf0]" />
          </div>
        ))}
      </div>
      <div className="mt-5 animate-pulse rounded-[12px] border border-[#eaecf0] bg-white p-5">
        <div className="h-3 w-28 rounded-full bg-[#eaecf0]" />
        <div className="mt-4 space-y-2.5">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="h-2.5 rounded-full bg-[#f2f4f7]" />
          ))}
        </div>
      </div>
    </div>
  );
}
