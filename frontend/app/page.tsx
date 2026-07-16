export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="max-w-3xl text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-400">
          AI Business Solutions
        </p>

        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Help your business answer customers and capture more leads
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          We build modern websites, AI customer assistants and simple
          automations for local businesses.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <button className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500">
            View demo
          </button>

          <button className="rounded-lg border border-slate-600 px-6 py-3 font-semibold hover:bg-slate-800">
            Contact us
          </button>
        </div>
      </section>
    </main>
  );
}