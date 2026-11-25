import type { Answer, AttemptResult, RequestState, TrainingSet } from "./domain";
import { getProgress, isAnswerFilled } from "./domain";
import { getUnansweredTasks } from "./attempt";

type TaskReviewProps = {
  set: TrainingSet;
  answers: Answer[];
  isSubmitted: boolean;
  result: AttemptResult | null;
  actionState: RequestState;
  onClear?: (taskId: string) => void;
  onSelectTask?: (taskId: string) => void;
};

export default function TaskReview({
  set,
  answers,
  isSubmitted,
  result,
  actionState,
  onClear,
  onSelectTask,
}: TaskReviewProps) {
  const progress = getProgress(set, answers);
  const unanswered = getUnansweredTasks(set, answers);
  const isLoading = actionState.status === "loading";

  return (
    <div>
      {isSubmitted && result ? (
        <div style={{ padding: "12px", background: "#f0f8ff", borderRadius: "6px", marginBottom: "16px" }}>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Статус проверки:</strong>{" "}
            {result.status === "pending-review" ? "Ожидает проверки (pending-review)" : "Проверено (graded)"}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Итоговый балл:</strong>{" "}
            {result.score === null
              ? "Ожидает проверки"
              : `${result.score} из ${result.maxScore}`}
          </p>
        </div>
      ) : (
        <>
          <p>
            <strong>Подтверждено сервером:</strong> {progress.filled} из {progress.total}
          </p>
          <p>
            <strong>Пропуски:</strong>{" "}
            {unanswered.length > 0 ? unanswered.map((t) => t.id).join(", ") : "нет"}
          </p>
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
        {set.tasks.map((task) => {
          const ans = answers.find((a) => a.taskId === task.id);
          const filled = isAnswerFilled(task, ans);
          const item = result?.items.find((i) => i.taskId === task.id);

          let ansText = "Нет ответа";
          if (ans?.kind === "single-choice") {
            const opt =
              task.kind === "single-choice"
                ? task.options.find((o) => o.id === ans.optionId)
                : null;
            ansText = opt ? opt.label : ans.optionId;
          } else if (ans?.kind === "short-text") {
            ansText = ans.text.trim().length > 0 ? ans.text : "Пустой текст";
          }

          return (
            <div
              key={task.id}
              style={{ border: "1px solid #ccc", padding: "16px", borderRadius: "8px" }}
            >
              <p style={{ margin: 0 }}>
                <strong>[{task.id}] {task.topic}:</strong> {task.prompt}
              </p>

              <p style={{ margin: "6px 0", color: "#244a7c" }}>
                Ваш ответ: {ansText}
              </p>

              {isSubmitted && item ? (
                <div style={{ fontSize: "0.95rem" }}>
                  <p style={{ margin: "4px 0" }}>
                    <strong>Статус:</strong>{" "}
                    {item.status === "pending-review" ? "Ожидает проверки" : item.status}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    <strong>Балл:</strong>{" "}
                    {item.score === null ? "Ожидает проверки" : `${item.score} из ${item.maxScore}`}
                  </p>
                  {item.feedback && (
                    <p style={{ margin: "4px 0", color: "#555" }}>
                      <strong>Комментарий:</strong> {item.feedback}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p style={{ margin: "4px 0", color: filled ? "#15803d" : "#b91c1c", fontWeight: "bold" }}>
                    {filled ? "Сохранено на сервере" : "Пропущено"}
                  </p>

                  {!isSubmitted && (onSelectTask || (onClear && ans)) && (
                    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                      {onSelectTask && (
                        <button type="button" disabled={isLoading} onClick={() => onSelectTask(task.id)}>
                          Перейти к заданию
                        </button>
                      )}
                      {onClear && ans && (
                        <button type="button" disabled={isLoading} onClick={() => onClear(task.id)}>
                          Очистить ответ
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}