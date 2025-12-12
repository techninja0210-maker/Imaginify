import { SignIn } from '@clerk/nextjs'

const SignInPage = () => {
  return (
    <SignIn
      afterSignInUrl="/auth/redirect"
      appearance={{
        elements: {
          headerTitle: 'Shoppable Videos',
          headerSubtitle: 'Sign in to your account',
          socialButtonsBlockButton: 'Continue with Google',
          socialButtonsBlockButtonText: 'Continue with Google',
        },
        variables: {
          colorPrimary: '#624cf5',
        },
      }}
    />
  );
}

export default SignInPage