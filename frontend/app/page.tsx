export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white selection:bg-blue-400/30">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-[-12rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl sm:h-[40rem] sm:w-[40rem]" />
        <div className="absolute right-[-10rem] top-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      </div>

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">
          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.9)]" />
          AI Business
        </h2>

        <div className="flex items-center gap-4 text-sm font-medium text-slate-300 sm:gap-8">
          <a href="#services" className="transition-colors hover:text-white">
            Services
          </a>

          <a href="#demo" className="transition-colors hover:text-white">
            Demo
          </a>

          <a href="#contact" className="transition-colors hover:text-white">
            Contact
          </a>
        </div>
      </nav>

      <section className="relative z-10 flex min-h-[calc(100vh-84px)] items-center justify-center px-5 pb-20 pt-10 sm:px-8 sm:pb-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mx-auto mb-6 w-fit rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:text-sm">
            AI Business Solutions
          </p>

          <h1 className="text-balance bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-transparent sm:text-6xl lg:text-7xl">
            Help your business answer customers and capture more leads
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:mt-8 sm:text-xl sm:leading-8">
            We build modern websites, AI customer assistants and simple
            automations for local businesses.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="#demo"
              className="rounded-xl bg-blue-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-blue-500/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              View demo
            </a>

            <a
              href="#contact"
              className="rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3.5 font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              Contact us
            </a>
          </div>

          <p className="mt-7 text-sm font-medium tracking-wide text-slate-400">
            Websites <span className="mx-1.5 text-blue-400">•</span> AI assistants{" "}
            <span className="mx-1.5 text-blue-400">•</span> Business automation
          </p>
        </div>
      </section>
    </main>
  );
}
