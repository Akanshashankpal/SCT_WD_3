import { useEffect, useId, useRef, useState } from "react";
import { TYPE_LABEL, categories } from "../data/questions.js";
import {
  formatExpected,
  formatGiven,
  gradeQuiz,
  isAnswered,
  scoreHeadline,
} from "../utils/score.js";
import "./Quiz.css";

const TYPE_ORDER = ["single", "multi", "truefalse", "blank"];

const NUDGE = {
  single: "Choose one answer to continue.",
  multi: "Select every option that applies.",
  truefalse: "Choose true or false to continue.",
  blank: "Fill in the blank to continue.",
};

export default function Quiz() {
  const [phase, setPhase] = useState("intro");
  const [categoryId, setCategoryId] = useState(categories[0].id);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [attempted, setAttempted] = useState(false);

  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const questions = category.questions;

  function start(nextCategoryId = categoryId) {
    setCategoryId(nextCategoryId);
    setPhase("play");
    setStep(0);
    setAnswers({});
    setAttempted(false);
  }

  function goHome() {
    setPhase("intro");
    setStep(0);
    setAnswers({});
    setAttempted(false);
  }

  function setAnswer(id, value) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setAttempted(false);
  }

  if (phase === "intro") {
    return <Intro onStart={start} />;
  }

  if (phase === "results") {
    return (
      <Results
        category={category}
        questions={questions}
        answers={answers}
        onRestart={() => start(category.id)}
        onHome={goHome}
      />
    );
  }

  const question = questions[step];
  const given = answers[question.id];
  const ready = isAnswered(question, given);
  const isLast = step === questions.length - 1;

  function goNext() {
    if (!ready) {
      setAttempted(true);
      return;
    }
    if (isLast) {
      setPhase("results");
      return;
    }
    setAttempted(false);
    setStep((current) => current + 1);
  }

  function goBack() {
    setAttempted(false);
    setStep((current) => Math.max(0, current - 1));
  }

  return (
    <main className="shell">
      <article className="card">
        <PlayHeader category={category} total={questions.length} step={step} question={question} />
        <QuestionBody
          question={question}
          given={given}
          onChange={(value) => setAnswer(question.id, value)}
          onAdvance={goNext}
        />
        <div className="actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={goBack}
            disabled={step === 0}
          >
            Back
          </button>
          <button type="button" className="btn btn-primary" onClick={goNext}>
            {isLast ? "See score" : "Next"}
          </button>
        </div>
        <p className="nudge" role="status">
          {attempted && !ready ? NUDGE[question.type] : "\u00a0"}
        </p>
      </article>
    </main>
  );
}

function Intro({ onStart }) {
  return (
    <main className="shell">
      <article className="card intro">
        <p className="eyebrow">Quiz Game</p>
        <h1>Quiz</h1>
        <p className="lede">
          Pick a category. Each round mixes single choice, select all, true or
          false, and fill-in-the-blank.
        </p>
        <ul className="category-list">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                className={`category cat-${category.id}`}
                onClick={() => onStart(category.id)}
              >
                <span className="category-name">{category.name}</span>
                <span className="category-blurb">{category.blurb}</span>
                <span className="category-meta">{category.questions.length} questions</span>
              </button>
            </li>
          ))}
        </ul>
      </article>
    </main>
  );
}

function PlayHeader({ category, total, step, question }) {
  const progress = ((step + 1) / total) * 100;

  return (
    <header className="play-head">
      <div className="meta">
        <p className="eyebrow">
          {category.name} · {step + 1} of {total}
        </p>
        <span className={`chip chip-${question.type}`}>{TYPE_LABEL[question.type]}</span>
      </div>
      <div
        className="track"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step + 1}
        aria-label="Quiz progress"
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="topic">{question.topic}</p>
    </header>
  );
}

function QuestionBody({ question, given, onChange, onAdvance }) {
  const headingRef = useRef(null);

  useEffect(() => {
    if (question.type !== "blank") {
      headingRef.current?.focus();
    }
  }, [question.id, question.type]);

  useEffect(() => {
    function onKey(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0) return;

      if (question.type === "truefalse") {
        if (index === 0) onChange(true);
        if (index === 1) onChange(false);
        return;
      }

      const option = question.options?.[index];
      if (!option) return;
      if (question.type === "single") {
        onChange(option.id);
        return;
      }
      if (question.type === "multi") {
        const current = Array.isArray(given) ? given : [];
        const next = current.includes(option.id)
          ? current.filter((id) => id !== option.id)
          : [...current, option.id];
        onChange(next);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, given, onChange]);

  return (
    <section className="question" key={question.id} aria-labelledby="quiz-prompt">
      {question.type === "blank" ? (
        <BlankPrompt
          prompt={question.prompt}
          value={typeof given === "string" ? given : ""}
          onChange={onChange}
          onAdvance={onAdvance}
          headingRef={headingRef}
        />
      ) : (
        <h2 id="quiz-prompt" ref={headingRef} tabIndex={-1}>
          {question.prompt}
        </h2>
      )}

      {question.type === "single" && (
        <ChoiceGroup
          question={question}
          given={given}
          multiple={false}
          onChange={onChange}
        />
      )}
      {question.type === "multi" && (
        <>
          <p className="hint">Select every answer that applies. Partial sets do not score.</p>
          <ChoiceGroup
            question={question}
            given={Array.isArray(given) ? given : []}
            multiple
            onChange={onChange}
          />
        </>
      )}
      {question.type === "truefalse" && (
        <TrueFalse value={given} onChange={onChange} />
      )}
    </section>
  );
}

function ChoiceGroup({ question, given, multiple, onChange }) {
  function toggle(id) {
    if (!multiple) {
      onChange(id);
      return;
    }
    const next = given.includes(id)
      ? given.filter((item) => item !== id)
      : [...given, id];
    onChange(next);
  }

  return (
    <div
      className="choices"
      role={multiple ? "group" : "radiogroup"}
      aria-labelledby="quiz-prompt"
    >
      {question.options.map((option, index) => {
        const selected = multiple ? given.includes(option.id) : given === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            className={
              selected
                ? `choice is-selected${multiple ? " is-multi" : ""}`
                : `choice${multiple ? " is-multi" : ""}`
            }
            onClick={() => toggle(option.id)}
          >
            <span className="choice-key" aria-hidden="true">
              {index + 1}
            </span>
            <span className="choice-mark" aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TrueFalse({ value, onChange }) {
  return (
    <div className="tf-row" role="radiogroup" aria-labelledby="quiz-prompt">
      {[
        { id: true, label: "True", key: "1" },
        { id: false, label: "False", key: "2" },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={value === option.id ? "choice tf is-selected" : "choice tf"}
          onClick={() => onChange(option.id)}
        >
          <span className="choice-key" aria-hidden="true">
            {option.key}
          </span>
          <span className="choice-mark" aria-hidden="true" />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function BlankPrompt({ prompt, value, onChange, onAdvance, headingRef }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [before, after = ""] = prompt.split("______");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <h2 id="quiz-prompt" className="prompt-blank" ref={headingRef} tabIndex={-1}>
      {before}
      <input
        id={inputId}
        ref={inputRef}
        className="blank-input"
        value={value}
        aria-label="Your answer for the blank"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck="false"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onAdvance();
          }
        }}
      />
      {after}
    </h2>
  );
}

function Results({ category, questions, answers, onRestart, onHome }) {
  const report = gradeQuiz(questions, answers);
  const percent = Math.round((report.score / report.total) * 100);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (report.score / report.total);

  return (
    <main className="shell">
      <article className="card results">
        <p className="eyebrow">{category.name}</p>
        <h1>{scoreHeadline(report.score, report.total)}</h1>
        <div className="score-row">
          <div className="ring-wrap" aria-hidden="true">
            <svg className="score-ring" viewBox="0 0 140 140">
              <circle className="ring-track" cx="70" cy="70" r={radius} />
              <circle
                className="ring-value"
                cx="70"
                cy="70"
                r={radius}
                strokeDasharray={`${filled} ${circumference}`}
              />
            </svg>
            <p className="ring-label">
              <strong>{percent}</strong>
              <span>%</span>
            </p>
          </div>
          <div className="score-copy">
            <p className="score-figure">
              {report.score}
              <span> / {report.total}</span>
            </p>
            <ul className="breakdown">
              {TYPE_ORDER.map((type) => {
                const row = report.byType[type];
                if (!row) return null;
                return (
                  <li key={type}>
                    <span className={`chip chip-${type}`}>{TYPE_LABEL[type]}</span>
                    <span>
                      {row.correct}/{row.total}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            Categories
          </button>
          <button type="button" className="btn btn-primary" onClick={onRestart}>
            Play again
          </button>
        </div>
        <h2 className="review-title">Review</h2>
        <ol className="review-list">
          {report.items.map((item, index) => (
            <li
              key={item.question.id}
              className={item.correct ? "review is-right" : "review is-wrong"}
            >
              <div className="review-top">
                <span className="review-index">{index + 1}</span>
                <span className={`chip chip-${item.question.type}`}>
                  {TYPE_LABEL[item.question.type]}
                </span>
                <span className="verdict">{item.correct ? "Correct" : "Missed"}</span>
              </div>
              <p className="review-prompt">{item.question.prompt}</p>
              <p>
                <span className="k">Your answer</span> {formatGiven(item.question, item.given)}
              </p>
              {!item.correct && (
                <p>
                  <span className="k">Answer</span> {formatExpected(item.question)}
                </p>
              )}
              <p className="explain">{item.question.explain}</p>
            </li>
          ))}
        </ol>
      </article>
    </main>
  );
}
