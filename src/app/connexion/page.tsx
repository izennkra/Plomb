import { SignInForm } from "./sign-in-form";

type SearchParams = Promise<{ suite?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const { suite } = await searchParams;
  return (
    <main>
      <h1 className="page-title">Plomb</h1>
      <p>Votre journal de veille créative est privé.</p>
      <SignInForm next={suite ?? "/"} />
    </main>
  );
}
