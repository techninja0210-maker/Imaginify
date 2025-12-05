import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

const SIGNUP_ACCESS_TOKEN = process.env.SIGNUP_ACCESS_TOKEN;

interface SignUpPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

const SignUpPage = async ({ searchParams }: SignUpPageProps) => {
  // Handle both Promise and direct object for searchParams (Next.js 15+ compatibility)
  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  
  // Token protection is DISABLED to allow open sign-ups
  // To re-enable token protection, uncomment the code below and set SIGNUP_ACCESS_TOKEN env variable
  /*
  // Check if token protection is enabled
  if (SIGNUP_ACCESS_TOKEN && SIGNUP_ACCESS_TOKEN.trim() !== '') {
    const providedToken = (() => {
      const raw = params?.token ?? params?.invite ?? params?.access;
      if (Array.isArray(raw)) return raw[0];
      return raw;
    })();

    // If no token provided or token doesn't match, block access
    if (!providedToken || providedToken !== SIGNUP_ACCESS_TOKEN) {
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
  */

  return (
    <SignUp
      appearance={{
        elements: {
          headerTitle: 'Shoppable Videos',
          headerSubtitle: 'Create your account',
          socialButtonsBlockButton: 'Continue with Google',
          socialButtonsBlockButtonText: 'Continue with Google',
          // Ensure username field is visible
          formFieldInput__username: {
            placeholder: 'Choose a username',
          },
        },
        variables: {
          colorPrimary: '#624cf5',
        },
      }}
      // Enable username field in sign-up flow
      // Note: This requires username to be enabled in Clerk Dashboard
      // Path: User & Authentication → Username → Enable "Sign-up with username"
    />
  );
};

export default SignUpPage;