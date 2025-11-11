import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

const SIGNUP_ACCESS_TOKEN = process.env.SIGNUP_ACCESS_TOKEN;

interface SignUpPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

const SignUpPage = ({ searchParams }: SignUpPageProps) => {
  if (SIGNUP_ACCESS_TOKEN) {
    const providedToken = (() => {
      const raw = searchParams?.token ?? searchParams?.invite ?? searchParams?.access;
      if (Array.isArray(raw)) return raw[0];
      return raw;
    })();

    if (providedToken !== SIGNUP_ACCESS_TOKEN) {
      return (
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold text-gray-900">Registration Closed</h1>
            <p className="text-sm text-gray-600">
              Direct sign-ups are disabled. If you were invited, please use the private link that includes your access
              token or reach out to the team for an invitation.
            </p>
          </div>
          <Link
            href="/sign-in"
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Return to Sign In
          </Link>
        </div>
      );
    }
  }

  return <SignUp />;
};

export default SignUpPage;