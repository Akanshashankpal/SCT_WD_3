export function normalizeBlank(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.?!,;:]+$/g, "");
}

export function isAnswered(question, given) {
  if (question.type === "multi") {
    return Array.isArray(given) && given.length > 0;
  }
  if (question.type === "blank") {
    return normalizeBlank(given).length > 0;
  }
  if (question.type === "truefalse") {
    return given === true || given === false;
  }
  return typeof given === "string" && given.length > 0;
}

export function isCorrect(question, given) {
  if (!isAnswered(question, given)) return false;

  if (question.type === "single" || question.type === "truefalse") {
    return given === question.answer;
  }

  if (question.type === "multi") {
    const chosen = [...given].sort();
    const expected = [...question.answer].sort();
    return (
      chosen.length === expected.length &&
      chosen.every((id, index) => id === expected[index])
    );
  }

  if (question.type === "blank") {
    const normalized = normalizeBlank(given);
    return question.answer.some((accepted) => normalizeBlank(accepted) === normalized);
  }

  return false;
}

export function optionLabel(question, id) {
  return question.options?.find((option) => option.id === id)?.label ?? String(id);
}

export function formatGiven(question, given) {
  if (!isAnswered(question, given)) return "No answer";
  if (question.type === "truefalse") return given ? "True" : "False";
  if (question.type === "blank") return String(given).trim();
  if (question.type === "multi") {
    return question.options
      .filter((option) => given.includes(option.id))
      .map((option) => option.label)
      .join(", ");
  }
  return optionLabel(question, given);
}

export function formatExpected(question) {
  if (question.type === "truefalse") return question.answer ? "True" : "False";
  if (question.type === "blank") return question.answer[0];
  if (question.type === "multi") {
    return question.answer.map((id) => optionLabel(question, id)).join(", ");
  }
  return optionLabel(question, question.answer);
}

export function gradeQuiz(questions, answers) {
  const items = questions.map((question) => {
    const given = answers[question.id];
    return {
      question,
      given,
      correct: isCorrect(question, given),
    };
  });

  const byType = {};
  for (const item of items) {
    const type = item.question.type;
    if (!byType[type]) byType[type] = { correct: 0, total: 0 };
    byType[type].total += 1;
    if (item.correct) byType[type].correct += 1;
  }

  const score = items.filter((item) => item.correct).length;
  return { items, score, total: questions.length, byType };
}

export function scoreHeadline(score, total) {
  const ratio = total === 0 ? 0 : score / total;
  if (ratio === 1) return "Perfect round";
  if (ratio >= 0.8) return "Sharp work";
  if (ratio >= 0.6) return "Solid score";
  if (ratio >= 0.4) return "A good start";
  return "Run it back";
}
