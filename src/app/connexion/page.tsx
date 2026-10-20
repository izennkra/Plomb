import { SignInForm } from "./sign-in-form";

type SearchParams = Promise<{ suite?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const { suite } = await searchParams;
  return (
    <main>
      <SignInForm next={suite ?? "/journal"} />
    </main>
  );
}
