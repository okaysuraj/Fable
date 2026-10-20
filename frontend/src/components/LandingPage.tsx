/** Public product story: real capabilities, original artwork and a clearly illustrated tour. */
import { useEffect } from "react";
import { Brand } from "./Brand";
import { IconChat, IconPin, IconSearch, IconUsers } from "./icons/Icons";
import { LandingTour } from "./LandingTour";
import { StoreDownloads, hasStoreDownloads } from "./StoreDownloads";
import "../styles/landing.css";

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={diagonal ? "fl-arrow-diagonal" : undefined}
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}

export function LandingPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Fable — A home for good conversations";
    return () => {
      document.title = previousTitle;
    };
  }, []);
  const questions = [
    {
      title: "What is Fable?",
      answer:
        "Fable is a place for group conversations. Bring people together, make a chat for what matters, and find your way back to the messages you want to keep.",
    },
    {
      title: "Can a chat be private?",
      answer:
        "Yes. Private chats are available to the people you add. Shared chats are available to members of your group, so you can choose the right space for each conversation.",
    },
    {
      title: "Can I use it on my phone?",
      answer: hasStoreDownloads
        ? "Fable is built for iPhone and Android. Choose an available app store link below to download it to your phone."
        : "Fable is built for iPhone and Android. App Store and Google Play downloads are coming soon.",
    },
    {
      title: "How do I get started?",
      answer: hasStoreDownloads
        ? "Choose an available store link below to download Fable. Sign in on your phone with Google, or create an account with your email and verify it. Then invite your people."
        : "Fable's App Store and Google Play listings are coming soon. Once available, download the mobile app and sign in with Google or your verified email account.",
    },
  ];
  return (
    <div className="fable-landing" id="top">
      <a className="fl-skip-link" href="#landing-content">
        Skip to content
      </a>
      <header className="fl-masthead">
        <a href="#top" className="fl-logo" aria-label="Fable, back to top">
          <img src="/favicon.svg" width="29" height="29" alt="" />
          <Brand />
        </a>
        <nav className="fl-navigation" aria-label="Main navigation">
          <a href="#why-fable">Why Fable</a>
          <a href="#tour">A look inside</a>
          <a href="#questions">Questions</a>
        </nav>
        <div className="fl-account-links">
          <a href="#download" className="fl-button fl-button-small">
            Get the app
            <Arrow diagonal />
          </a>
        </div>
      </header>

      <main id="landing-content" tabIndex={-1}>
        <section className="fl-hero" aria-labelledby="landing-title">
          <div className="fl-hero-copy">
            <p className="fl-intro">A space for your people.</p>
            <h1 id="landing-title">
              A home for
              <br />
              good conversations.
            </h1>
            <p className="fl-hero-description">
              For the plans, the projects, and the people that make them matter.
              Bring your group’s conversations into one considered space.
            </p>
            <div className="fl-hero-actions" id="download">
              <StoreDownloads />
              <a href="#tour" className="fl-text-link">
                Take a look inside
              </a>
            </div>
          </div>
          <figure className="fl-hero-art">
            <div className="fl-art-orbit" aria-hidden="true" />
            <img
              className="fl-sculpture"
              src="/brand/conversation-sculpture.svg"
              width="600"
              height="600"
              alt=""
              fetchPriority="high"
            />
            <figcaption>
              Good company.
              <br />
              <span>Wherever life takes you.</span>
            </figcaption>
          </figure>
          <div className="fl-hero-footnote">
            <span>Made for the way we connect.</span>
            <a href="#why-fable" aria-label="Explore why Fable">
              <span aria-hidden="true">↓</span> There’s more below
            </a>
          </div>
        </section>

        <div className="fl-capability-strip" aria-label="Fable features">
          <span>
            <IconChat size={18} />
            Group conversations
          </span>
          <span>
            <IconUsers size={18} />
            Public & private chats
          </span>
          <span>
            <IconSearch size={18} />
            Searchable history
          </span>
          <span>
            <IconPin size={18} />
            Messages worth keeping
          </span>
        </div>

        <section
          className="fl-introduction fl-section"
          id="why-fable"
          aria-labelledby="why-title"
        >
          <p className="fl-section-label">Stay in the conversation</p>
          <div>
            <h2 id="why-title">
              The little things
              <br />
              bring us together.
            </h2>
            <p>
              A quick hello. A half-formed idea. A plan that finally comes
              together. Fable gives those moments a place to live, with simple
              conversations and the details close at hand.
            </p>
          </div>
        </section>

        <LandingTour />

        <section
          className="fl-circles fl-section"
          aria-labelledby="circles-title"
        >
          <div className="fl-circles-copy">
            <p className="fl-section-label">One place, all your circles</p>
            <h2 id="circles-title">
              For the people
              <br />
              you do life with.
            </h2>
            <p>
              Keep your groups separate and your conversations together. Make a
              shared chat for the whole group, or a private one for a smaller
              circle.
            </p>
            <a className="fl-text-link" href="#download">
              Find it on your phone
              <Arrow />
            </a>
          </div>
          <div
            className="fl-circles-visual"
            aria-label="Fable brings together friends, projects and communities"
          >
            <div className="fl-circle-orbit" aria-hidden="true" />
            <div className="fl-circle-label fl-circle-friends">
              <IconHeartMark />
              Friends & everyday life
            </div>
            <div className="fl-circle-core" aria-hidden="true">
              <img src="/favicon.svg" width="64" height="64" alt="" />
            </div>
            <div className="fl-circle-label fl-circle-projects">
              <IconChat size={20} />
              Ideas & side projects
            </div>
            <div className="fl-circle-label fl-circle-communities">
              <IconUsers size={20} />
              Clubs & communities
            </div>
          </div>
        </section>

        <section
          className="fl-questions fl-section"
          id="questions"
          aria-labelledby="questions-title"
        >
          <div>
            <p className="fl-section-label">A few things to know</p>
            <h2 id="questions-title">Glad you asked.</h2>
          </div>
          <div className="fl-question-list">
            {questions.map((question) => (
              <details key={question.title}>
                <summary>
                  {question.title}
                  <span className="fl-question-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{question.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="fl-invitation" aria-labelledby="invitation-title">
          <div className="fl-invitation-art" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="fl-invitation-copy">
            <p>Every good story starts somewhere.</p>
            <h2 id="invitation-title">
              Make room
              <br />
              for your people.
            </h2>
            <StoreDownloads />
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-footer-top">
          <a href="#top" className="fl-logo" aria-label="Fable, back to top">
            <Brand />
          </a>
          <p>Conversations, kept close.</p>
          <nav aria-label="Footer navigation">
            <a href="#tour">Explore</a>
            <a href="#questions">Questions</a>
            <a href="#download">Get the app</a>
          </nav>
        </div>
        <span className="fl-footer-wordmark" translate="no" aria-hidden="true">
          fable.
        </span>
        <div className="fl-footer-bottom">
          <span>© {new Date().getFullYear()} Fable</span>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}

function IconHeartMark() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20S3 14.5 3 8.5a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1C21 14.5 12 20 12 20Z" />
    </svg>
  );
}
