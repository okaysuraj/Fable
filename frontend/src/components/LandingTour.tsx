/** A keyboard-accessible capability tour; illustrations contain no fictional account activity. */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  IconChat,
  IconCheck,
  IconPin,
  IconSearch,
  IconUsers,
} from "./icons/Icons";

const pages = [
  {
    id: "chats",
    label: "Conversations",
    icon: IconChat,
    title: "A little hello goes a long way.",
    copy: "Give each conversation its own space. Make plans, share an idea, or pick up where you left off.",
    details: [
      "Group chats for the things you share",
      "Private chats for a smaller circle",
      "A simple, familiar message view",
    ],
  },
  {
    id: "search",
    label: "Search",
    icon: IconSearch,
    title: "Less scrolling. More finding.",
    copy: "Remember the thought, but not where it went? Search past messages and open the conversation right where it happened.",
    details: [
      "Search across your group’s conversations",
      "Look inside a single chat",
      "Jump straight to the message",
    ],
  },
  {
    id: "pins",
    label: "Pins",
    icon: IconPin,
    title: "Keep the good stuff close.",
    copy: "Some messages deserve more than a passing glance. Pin useful details and ideas so they’re easy to come back to.",
    details: [
      "Pin messages from a conversation",
      "Browse earlier saved messages",
      "Keep the original context close by",
    ],
  },
] as const;

export function LandingTour() {
  const readIndex = () =>
    Math.max(
      0,
      pages.findIndex(
        (page) =>
          page.id === new URLSearchParams(window.location.search).get("tour"),
      ),
    );
  const [index, setIndex] = useState(readIndex);
  useEffect(() => {
    const update = () => setIndex(readIndex());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const active = pages[index];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (next: number) => {
    setIndex(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tour", pages[next].id);
    window.history.replaceState(window.history.state, "", url);
  };
  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    current: number,
  ) => {
    const next =
      event.key === "ArrowRight"
        ? (current + 1) % pages.length
        : event.key === "ArrowLeft"
          ? (current + pages.length - 1) % pages.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? pages.length - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };
  return (
    <section
      className="fl-tour fl-section"
      id="tour"
      aria-labelledby="tour-title"
    >
      <div className="fl-tour-heading">
        <div>
          <p className="fl-section-label">A look inside Fable</p>
          <h2 id="tour-title">
            Good company.
            <br />
            Thoughtful little details.
          </h2>
        </div>
        <p>
          Everything you need to stay in the conversation, with room for the
          things worth remembering.
        </p>
      </div>
      <div
        className="fl-tour-tabs"
        role="tablist"
        aria-label="Explore Fable features"
      >
        {pages.map((page, itemIndex) => (
          <button
            key={page.id}
            ref={(node) => {
              tabRefs.current[itemIndex] = node;
            }}
            type="button"
            role="tab"
            id={`fable-tour-tab-${page.id}`}
            aria-controls={`fable-tour-panel-${page.id}`}
            aria-selected={itemIndex === index}
            tabIndex={itemIndex === index ? 0 : -1}
            onClick={() => select(itemIndex)}
            onKeyDown={(event) => onKeyDown(event, itemIndex)}
          >
            <page.icon size={18} />
            <span>{page.label}</span>
          </button>
        ))}
      </div>
      {pages.map((page) => (
        <div
          key={page.id}
          hidden={page.id !== active.id}
          className="fl-tour-panel"
          role="tabpanel"
          id={`fable-tour-panel-${page.id}`}
          aria-labelledby={`fable-tour-tab-${page.id}`}
          tabIndex={0}
        >
          <div className="fl-tour-description" key={page.id}>
            <h3>{page.title}</h3>
            <p>{page.copy}</p>
            <ul>
              {page.details.map((detail) => (
                <li key={detail}>
                  <IconCheck size={15} />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
          <figure className={`fl-tour-illustration fl-tour-${page.id}`}>
            <div
              className="fl-tour-canvas"
              role="img"
              aria-label={
                page.id === "chats"
                  ? "Illustration of a focused, two-column conversation view"
                  : page.id === "search"
                    ? "Illustration of finding a message within its conversation"
                    : "Illustration of keeping useful messages pinned"
              }
            >
              {page.id === "chats" ? (
                <div className="fl-mini-app" aria-hidden="true">
                  <div className="fl-mini-sidebar">
                    <span className="fl-mini-title">Messages</span>
                    <span className="fl-mini-item is-current">
                      <IconChat size={17} />
                      Group chats
                    </span>
                    <span className="fl-mini-item">
                      <IconUsers size={17} />
                      Your people
                    </span>
                    <span className="fl-mini-rule" />
                    <span className="fl-mini-line" />
                    <span className="fl-mini-line is-short" />
                  </div>
                  <div className="fl-mini-conversation">
                    <div className="fl-mini-header">
                      <span>Conversations, kept close.</span>
                      <IconChat size={16} />
                    </div>
                    <div className="fl-mini-empty">
                      <span className="fl-mini-chat-icon">
                        <IconChat size={29} />
                      </span>
                      <strong>Say hello.</strong>
                      <p>
                        A little space
                        <br />
                        for your next conversation.
                      </p>
                    </div>
                    <span className="fl-mini-footer">
                      A place for your people.
                    </span>
                  </div>
                </div>
              ) : page.id === "search" ? (
                <div className="fl-search-art" aria-hidden="true">
                  <div className="fl-search-paper fl-search-paper-back" />
                  <div className="fl-search-paper">
                    <IconChat size={20} />
                    <span className="fl-search-line" />
                    <span className="fl-search-line is-selected" />
                    <span className="fl-search-line is-short" />
                    <p>Right where you left it.</p>
                  </div>
                  <span className="fl-search-lens">
                    <IconSearch size={49} />
                  </span>
                  <span className="fl-search-caption">
                    Find the thought. Keep the context.
                  </span>
                </div>
              ) : (
                <div className="fl-pin-art" aria-hidden="true">
                  <div className="fl-pin-paper-back" />
                  <div className="fl-pin-paper">
                    <span className="fl-pin-symbol">
                      <IconPin size={27} />
                    </span>
                    <span>
                      Worth
                      <br />
                      keeping.
                    </span>
                    <p>
                      The little details.
                      <br />
                      The good ideas.
                      <br />
                      All close at hand.
                    </p>
                  </div>
                  <span className="fl-pin-caption">
                    <IconPin size={17} />
                    Keep the good bits.
                  </span>
                </div>
              )}
            </div>
            <figcaption>Product illustration</figcaption>
          </figure>
        </div>
      ))}
    </section>
  );
}
