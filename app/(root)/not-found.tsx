import Link from "next/link";

export default function NotFound() {
  return (
    <div className="collection-empty flex-col gap-4">
      <p className="p-20-semibold">404 - Page not found</p>
      <Link href="/" className="collection-btn flex-center">Go home</Link>
    </div>
  );
}



