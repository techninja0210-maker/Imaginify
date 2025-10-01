"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="collection-empty flex-col gap-4">
      <p className="p-20-semibold">Something went wrong</p>
      <button onClick={() => reset()} className="collection-btn">Try again</button>
    </div>
  );
}


