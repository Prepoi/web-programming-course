import { useEffect, useState } from "react";
import type { Answer, RequestState, Task } from "./domain";

type TaskCardProps = {
  task: Task;
  confirmedAnswer?: Answer;
  isSubmitted: boolean;
  actionState: RequestState;
  onSaveAnswer: (ans: Answer) => void;
  onClearAnswer: (taskId: string) => void;
};

export default function TaskCard({
  task,
  confirmedAnswer,
  isSubmitted,
  actionState,
  onSaveAnswer,
  onClearAnswer,
}: TaskCardProps) {
  const [draftOptionId, setDraftOptionId] = useState("");
  const [draftText, setDraftText] = useState("");

  useEffect(() => {
    if (confirmedAnswer?.kind === "single-choice") {
      setDraftOptionId(confirmedAnswer.optionId);
      setDraftText("");
    } else if (confirmedAnswer?.kind === "short-text") {
      setDraftText(confirmedAnswer.text);
      setDraftOptionId("");
    } else {
      setDraftOptionId("");
      setDraftText("");
    }
  }, [task.id, confirmedAnswer]);

  const isLoading = actionState.status === "loading";
  const canSave =
    task.kind === "single-choice"
      ? draftOptionId !== ""
      : draftText.trim().length > 0;

  const isDirty =
    task.kind === "single-choice"
      ? (confirmedAnswer?.kind === "single-choice" ? confirmedAnswer.optionId : "") !== draftOptionId
      : (confirmedAnswer?.kind === "short-text" ? confirmedAnswer.text : "") !== draftText;

  function handleSaveClick() {
    if (task.kind === "single-choice") {
      if (!draftOptionId) return;
      onSaveAnswer({ taskId: task.id, kind: "single-choice", optionId: draftOptionId });
    } else {
      if (draftText.trim().length === 0) return;
      onSaveAnswer({ taskId: task.id, kind: "short-text", text: draftText });
    }
  }

  return (
    <section>
      <h2>{task.topic}</h2>
      <p>{task.prompt}</p>

      {task.code && (
        <pre>
          <code>{task.code}</code>
        </pre>
      )}

      <p style={{ fontSize: "0.9rem", marginTop: "8px" }}>
        {confirmedAnswer && !isDirty ? (
          <span style={{ color: "#15803d" }}>✓ Ответ подтверждён сервером</span>
        ) : isDirty ? (
          <span style={{ color: "#b45309" }}>Есть несохранённые изменения</span>
        ) : (
          <span style={{ color: "#666" }}>Ответ не сохранён</span>
        )}
      </p>

      {task.kind === "single-choice" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
          {task.options.map((option) => (
            <label
              key={option.id}
              style={{ cursor: isSubmitted || isLoading ? "default" : "pointer" }}
            >
              <input
                type="radio"
                name={task.id}
                checked={draftOptionId === option.id}
                disabled={isSubmitted || isLoading}
                onChange={() => setDraftOptionId(option.id)}
                style={{ marginRight: "8px" }}
              />
              {option.label}
            </label>
          ))}
        </div>
      )}

      {task.kind === "short-text" && (
        <div style={{ marginTop: "12px" }}>
          <textarea
            value={draftText}
            disabled={isSubmitted || isLoading}
            onChange={(event) => setDraftText(event.target.value)}
            placeholder="Введите ваш ответ..."
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "8px",
              fontFamily: "inherit",
            }}
          />
          <small style={{ display: "block", marginTop: "4px", color: "#555" }}>
            Строка из пробелов не считается заполненным ответом.
          </small>
        </div>
      )}

      {!isSubmitted && (
        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isLoading || !canSave}
          >
            {isLoading ? "Сохранение..." : "Сохранить ответ"}
          </button>

          {confirmedAnswer && (
            <button
              type="button"
              onClick={() => onClearAnswer(task.id)}
              disabled={isLoading}
            >
              Очистить ответ
            </button>
          )}
        </div>
      )}
    </section>
  );
}