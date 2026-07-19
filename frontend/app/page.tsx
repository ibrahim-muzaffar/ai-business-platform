"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const demos = {
  barber: {
    label: "Barber",
    icon: "✂️",
    businessName: "Northside Barbers",
    welcome: "Hi! I’m the Northside Barbers assistant. How can I help today?",
    conversations: [
      {
        question: "Do you take walk-ins?",
        answer:
          "Yes! Walk-ins are welcome, although weekends are usually busy.",
      },
      {
        question: "What time do you close?",
        answer: "We close at 7pm Monday to Saturday and 4pm on Sunday.",
      },
      {
        question: "Can I book a skin fade?",
        answer: "Absolutely. I can help you find the next available appointment.",
      },
    ],
  },
  restaurant: {
    label: "Restaurant",
    icon: "🍕",
    businessName: "Bella Pizza Kitchen",
    welcome: "Welcome to Bella Pizza Kitchen. What can I help you with?",
    conversations: [
      {
        question: "Do you offer delivery?",
        answer: "Yes, we deliver locally every day from 5pm until 10pm.",
      },
      {
        question: "Do you have vegan options?",
        answer: "We do! Several pizzas can be made with vegan cheese and toppings.",
      },
      {
        question: "Can I reserve a table?",
        answer: "Of course. Let me help you check availability for your preferred time.",
      },
    ],
  },
  dentist: {
    label: "Dentist",
    icon: "🦷",
    businessName: "Riverside Dental Care",
    welcome: "Hello! I’m here to help with questions about Riverside Dental Care.",
    conversations: [
      {
        question: "Are you accepting new patients?",
        answer: "Yes, we are currently welcoming new private patients.",
      },
      {
        question: "Do you offer emergency appointments?",
        answer: "Yes. Please contact us as early as possible for same-day availability.",
      },
      {
        question: "How often should I have a check-up?",
        answer: "Your dentist will recommend a schedule based on your individual needs.",
      },
    ],
  },
  gym: {
    label: "Gym",
    icon: "🏋️",
    businessName: "Forge Fitness",
    welcome: "Hi! Welcome to Forge Fitness. How can I help you get started?",
    conversations: [
      {
        question: "Can I try the gym before joining?",
        answer: "Yes! You can book a day pass to explore the gym and meet the team.",
      },
      {
        question: "Do you offer personal training?",
        answer: "We do. Our trainers offer one-to-one sessions for all fitness levels.",
      },
      {
        question: "What are your opening hours?",
        answer: "We’re open from 6am to 10pm on weekdays and 8am to 8pm at weekends.",
      },
    ],
  },
} as const;

type DemoType = keyof typeof demos;
type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};
type ChatResponse = {
  reply?: string;
  message?: string;
  sessionId: string | null;
};

export default function Home() {
  const [selectedDemo, setSelectedDemo] = useState<DemoType>("barber");
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const demo = demos[selectedDemo];
  const conversation = demo.conversations[selectedQuestion];

  useEffect(() => {
    return () => {
      activeRequest.current?.abort();
    };
  }, []);

  function cancelPendingReply() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setIsReplying(false);
  }

  function selectDemo(demoType: DemoType) {
    cancelPendingReply();
    setSelectedDemo(demoType);
    setSelectedQuestion(0);
    setChatMessages([]);
    setSessionId(null);
    setMessage("");
  }

  function selectQuestion(index: number) {
    cancelPendingReply();
    setSelectedQuestion(index);
    setChatMessages([]);
    setSessionId(null);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage || isReplying) return;

    setChatMessages((current) => [
      ...current,
      { role: "user", text: trimmedMessage },
    ]);
    setMessage("");
    setIsReplying(true);

    const controller = new AbortController();
    activeRequest.current = controller;

    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          businessType: selectedDemo,
          ...(sessionId ? { sessionId } : {}),
        }),
        signal: controller.signal,
      });
      const data: ChatResponse = await response.json();

      if (!response.ok || typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error(data.message || "The backend returned an invalid response.");
      }

      const reply = data.reply;

      if (typeof data.sessionId === "string" && data.sessionId.trim()) {
        setSessionId(data.sessionId);
      }
      setChatMessages((current) => [
        ...current,
        { role: "assistant", text: reply },
      ]);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;

      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Sorry, I couldn’t reach the demo assistant. Please make sure the backend is running and try again.",
        },
      ]);
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsReplying(false);
      }
    }
  }

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

      <section
        id="services"
        className="relative z-10 scroll-mt-8 px-5 py-20 sm:px-8 sm:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
              What we do
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Our Services
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
              We help local businesses save time and generate more customers
              using AI and automation.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3 lg:gap-6">
            <article className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-blue-950/20 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 text-2xl transition duration-300 group-hover:scale-105 group-hover:border-blue-400/30">
                🤖
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight text-white">
                AI Customer Assistants
              </h3>
              <p className="mt-3 leading-7 text-slate-400">
                AI assistants trained on your business to answer customer
                questions 24/7.
              </p>
            </article>

            <article className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-blue-950/20 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 text-2xl transition duration-300 group-hover:scale-105 group-hover:border-blue-400/30">
                🌐
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight text-white">
                Modern Websites
              </h3>
              <p className="mt-3 leading-7 text-slate-400">
                Fast, responsive and SEO-optimised websites designed to convert
                visitors into customers.
              </p>
            </article>

            <article className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-blue-950/20 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 text-2xl transition duration-300 group-hover:scale-105 group-hover:border-blue-400/30">
                ⚡
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight text-white">
                Business Automation
              </h3>
              <p className="mt-3 leading-7 text-slate-400">
                Automate bookings, enquiries, reviews and repetitive admin
                tasks.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 py-20 sm:px-8 sm:py-28">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl"
        />

        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
              Why choose us
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Why Work With Us
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
              Straightforward solutions shaped around your goals, with support
              that continues beyond launch.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3 lg:gap-6">
            <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm sm:p-8">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-400/25 bg-blue-400/10 text-sm font-bold text-blue-300"
              >
                01
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight text-white">
                Built Around Your Business
              </h3>
              <p className="mt-3 leading-7 text-slate-400">
                We tailor each website, assistant and automation to the way your
                business actually works.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm sm:p-8">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-400/25 bg-blue-400/10 text-sm font-bold text-blue-300"
              >
                02
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight text-white">
                Practical, Not Gimmicky
              </h3>
              <p className="mt-3 leading-7 text-slate-400">
                Every feature is designed to save time, improve customer service
                or help capture more enquiries.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm sm:p-8">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-400/25 bg-blue-400/10 text-sm font-bold text-blue-300"
              >
                03
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight text-white">
                Ongoing Support
              </h3>
              <p className="mt-3 leading-7 text-slate-400">
                We help with setup, improvements and maintenance after launch.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section
        id="demo"
        className="relative z-10 scroll-mt-8 px-5 py-20 sm:px-8 sm:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
              Interactive demo
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Try Our AI Assistant
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
              Choose a business, then select a common question to see how an AI
              assistant could respond instantly.
            </p>
          </div>

          <div
            aria-label="Choose a business demo"
            className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {(Object.keys(demos) as DemoType[]).map((demoType) => {
              const item = demos[demoType];
              const isSelected = selectedDemo === demoType;

              return (
                <button
                  key={demoType}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectDemo(demoType)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:text-base ${
                    isSelected
                      ? "border-blue-400/50 bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <span aria-hidden="true" className="mr-2">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-blue-950/30 backdrop-blur-xl">
            <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
              <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
                <div aria-live="polite" className="transition-opacity duration-300">
                  <p className="text-sm font-medium text-blue-300">Demo business</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">
                    {demo.businessName}
                  </h3>
                  <p className="mt-4 leading-7 text-slate-400">{demo.welcome}</p>
                </div>

                <div className="mt-8">
                  <p className="text-sm font-semibold text-slate-200">
                    Try an example question
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {demo.conversations.map((item, index) => (
                      <button
                        key={item.question}
                        type="button"
                        aria-pressed={selectedQuestion === index}
                        onClick={() => selectQuestion(index)}
                        className={`rounded-xl border px-4 py-3 text-left text-sm leading-6 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                          selectedQuestion === index
                            ? "border-blue-400/40 bg-blue-400/10 text-white"
                            : "border-white/10 bg-slate-950/30 text-slate-400 hover:border-white/20 hover:text-slate-200"
                        }`}
                      >
                        {item.question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex min-h-[30rem] flex-col bg-slate-950/40">
                <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
                  <span
                    aria-hidden="true"
                    className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 text-xl"
                  >
                    {demo.icon}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {demo.businessName}
                    </p>
                    <p className="text-xs text-emerald-400">Assistant online</p>
                  </div>
                </div>

                <div
                  key={`${selectedDemo}-${selectedQuestion}`}
                  aria-live="polite"
                  className="flex flex-1 flex-col gap-5 p-5 transition-all duration-300 sm:p-6"
                >
                  <div className="max-w-[85%] self-end">
                    <p className="mb-1.5 text-right text-xs font-medium text-slate-500">
                      You
                    </p>
                    <p className="rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-sm leading-6 text-white shadow-lg shadow-blue-950/20">
                      {conversation.question}
                    </p>
                  </div>

                  <div className="max-w-[88%] self-start">
                    <p className="mb-1.5 text-xs font-medium text-slate-500">
                      AI assistant
                    </p>
                    <p className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.07] px-4 py-3 text-sm leading-6 text-slate-200">
                      {conversation.answer}
                    </p>
                  </div>

                  {chatMessages.map((chatMessage, index) => (
                    <div
                      key={`${chatMessage.role}-${index}`}
                      className={`max-w-[88%] ${
                        chatMessage.role === "user" ? "self-end" : "self-start"
                      }`}
                    >
                      <p
                        className={`mb-1.5 text-xs font-medium text-slate-500 ${
                          chatMessage.role === "user" ? "text-right" : ""
                        }`}
                      >
                        {chatMessage.role === "user" ? "You" : "AI assistant"}
                      </p>
                      <p
                        className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                          chatMessage.role === "user"
                            ? "rounded-br-md bg-blue-600 text-white shadow-lg shadow-blue-950/20"
                            : "rounded-bl-md border border-white/10 bg-white/[0.07] text-slate-200"
                        }`}
                      >
                        {chatMessage.text}
                      </p>
                    </div>
                  ))}

                  {isReplying && (
                    <div
                      role="status"
                      className="max-w-[88%] self-start text-sm text-slate-400"
                    >
                      <span className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.07] px-4 py-3">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 animate-pulse rounded-full bg-blue-400"
                        />
                        Assistant is typing…
                      </span>
                    </div>
                  )}
                </div>

                <form
                  onSubmit={sendMessage}
                  className="border-t border-white/10 p-4 sm:px-6"
                >
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2 pl-4 transition focus-within:border-blue-400/40 focus-within:ring-2 focus-within:ring-blue-400/10">
                    <label htmlFor="demo-message" className="sr-only">
                      Message the demo assistant
                    </label>
                    <input
                      id="demo-message"
                      type="text"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Type your message..."
                      autoComplete="off"
                      className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                    />
                    <button
                      type="submit"
                      aria-label="Send message"
                      disabled={isReplying || !message.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                    >
                      <span aria-hidden="true">&rarr;</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
