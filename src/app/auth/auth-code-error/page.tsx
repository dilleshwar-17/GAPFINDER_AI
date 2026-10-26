import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-13rem)] max-w-md items-center px-4 py-12">
      <section className="card w-full p-6 text-center sm:p-7">
        <h1 className="text-[1.4rem] text-[#171f2e]">Authentication Error</h1>
        <p className="mt-2 text-[0.9rem] text-[#475467]">
          There was an error with the authentication code. It may have expired or been used already.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/login" className="btn btn-primary">
            Back to Sign In
          </Link>
          <Link href="/signup" className="btn btn-ghost">
            Create Account
          </Link>
        </div>
      </section>
    </div>
  );
}
