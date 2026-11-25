import { useEffect, useState } from "react";
import type {
  Answer,
  AttemptResult,
  RequestState,
  ServerAttempt,
  TrainingSet,
} from "./domain";
import { getProgress } from "./domain";
import { getUnansweredTasks } from "./attempt";
import { ApiError, trainerApi } from "./api/trainerApi";
import TaskList from "./TaskList";
import TaskCard from "./TaskCard";
import TaskReview from "./TaskReview";

const STORAGE_ATTEMPT_KEY = "trainer_attempt_id";

export default function App() {
  const [trainingSet, setTrainingSet] = useState<TrainingSet | null>(null);
  const [attempt, setAttempt] = useState<ServerAttempt | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [showReview, setShowReview] = useState(false);

  const [initState, setInitState] = useState<RequestState>({ status: "loading" });
  const [actionState, setActionState] = useState<RequestState>({ status: "idle" });
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  async function loadInitialData() {
    setInitState({ status: "loading" });
    setRestoreMessage(null);

    try {
      const sets = await trainerApi.getSets();
      if (sets.length === 0) {
        throw new Error("На сервере нет доступных учебных модулей.");
      }

      const loadedSet = await trainerApi.getSetById(sets[0].id);
      setTrainingSet(loadedSet);
      setSelectedTaskId(loadedSet.tasks[0]?.id ?? "");

      const savedAttemptId = localStorage.getItem(STORAGE_ATTEMPT_KEY);
      if (savedAttemptId) {
        try {
          const existing = await trainerApi.getAttempt(savedAttemptId);
          setAttempt(existing);
          if (existing.status === "submitted") {
            const res = await trainerApi.getResult(existing.id);
            setResult(res);
          } else {
            setResult(null);
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            localStorage.removeItem(STORAGE_ATTEMPT_KEY);
            setRestoreMessage(
              "Предыдущую подтверждённую попытку не удалось восстановить (сервер не нашёл ID). Начата новая попытка."
            );
            const fresh = await trainerApi.createAttempt(loadedSet.id);
            localStorage.setItem(STORAGE_ATTEMPT_KEY, fresh.id);
            setAttempt(fresh);
            setResult(null);
          } else {
            throw err;
          }
        }
      } else {
        setRestoreMessage(
          "Сохранённый идентификатор попытки не найден — восстановить подтверждённую попытку нельзя. Начата новая попытка."
        );
        const fresh = await trainerApi.createAttempt(loadedSet.id);
        localStorage.setItem(STORAGE_ATTEMPT_KEY, fresh.id);
        setAttempt(fresh);
        setResult(null);
      }

      setInitState({ status: "success" });
    } catch (err) {
      setInitState({
        status: "error",
        message: err instanceof Error ? err.message : "Не удалось подключиться к серверу.",
      });
    }
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function handleSaveAnswer(answer: Answer) {
    if (!attempt) return;
    setActionState({ status: "loading" });
    try {
      const updated = await trainerApi.saveAnswer(attempt.id, answer);
      setAttempt(updated);
      setActionState({ status: "success" });
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Ошибка при сохранении ответа.",
      });
    }
  }

  async function handleClearAnswer(taskId: string) {
    if (!attempt) return;
    setActionState({ status: "loading" });
    try {
      const updated = await trainerApi.deleteAnswer(attempt.id, taskId);
      setAttempt(updated);
      setActionState({ status: "success" });
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Ошибка при очистке ответа.",
      });
    }
  }

  async function handleFinish() {
    if (!attempt || !trainingSet) return;

    const unanswered = getUnansweredTasks(trainingSet, attempt.answers);
    if (unanswered.length > 0) {
      const ids = unanswered.map((t) => t.id).join(", ");
      if (!window.confirm(`Вы не ответили на задания: ${ids}. Завершить попытку?`)) {
        return;
      }
    }

    setActionState({ status: "loading" });
    try {
      const attemptResult = await trainerApi.submitAttempt(attempt.id);
      setAttempt({ ...attempt, status: "submitted" });
      setResult(attemptResult);
      setShowReview(false);
      setActionState({ status: "success" });
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Ошибка при завершении попытки.",
      });
    }
  }

  async function handleRestart() {
    if (!trainingSet) return;
    setActionState({ status: "loading" });
    try {
      const fresh = await trainerApi.createAttempt(trainingSet.id);
      localStorage.setItem(STORAGE_ATTEMPT_KEY, fresh.id);
      setAttempt(fresh);
      setResult(null);
      setRestoreMessage(null);
      setShowReview(false);
      setSelectedTaskId(trainingSet.tasks[0]?.id ?? "");
      setActionState({ status: "success" });
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Не удалось создать новую попытку.",
      });
    }
  }

  if (initState.status === "loading") {
    return <div>Загрузка модуля с сервера...</div>;
  }

  if (initState.status === "error" || !trainingSet || !attempt) {
    return (
      <div style={{ padding: "20px", background: "#fee2e2", borderRadius: "8px" }}>
        <h1>Ошибка подключения к API</h1>
        <p>{initState.status === "error" ? initState.message : "Неизвестная ошибка."}</p>
        <button type="button" onClick={() => void loadInitialData()}>
          Повторить загрузку
        </button>
      </div>
    );
  }

  const isSubmitted = attempt.status === "submitted";
  const isLoading = actionState.status === "loading";
  const progress = getProgress(trainingSet, attempt.answers);
  const unansweredTasks = getUnansweredTasks(trainingSet, attempt.answers);

  const errorBanner = actionState.status === "error" && (
    <div
      role="alert"
      style={{
        background: "#fee2e2",
        color: "#b91c1c",
        padding: "10px 12px",
        borderRadius: "6px",
        margin: "12px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>{actionState.message} (Ваш ввод сохранён, повторите действие)</span>
      <button type="button" onClick={() => setActionState({ status: "idle" })}>
        Скрыть
      </button>
    </div>
  );

  if (isSubmitted) {
    return (
      <div>
        <h1>{trainingSet.title} — Результаты</h1>
        <p><small>ID попытки: {attempt.id}</small></p>
        {errorBanner}

        <TaskReview
          set={trainingSet}
          answers={attempt.answers}
          isSubmitted={true}
          result={result}
          actionState={actionState}
        />

        <button
          type="button"
          onClick={() => void handleRestart()}
          disabled={isLoading}
          style={{ marginTop: "20px" }}
        >
          {isLoading ? "Создание..." : "Начать новую попытку"}
        </button>
      </div>
    );
  }

  if (showReview) {
    return (
      <div>
        <h1>{trainingSet.title} — Обзор до завершения</h1>
        <p><small>ID попытки: {attempt.id}</small></p>
        {errorBanner}

        <TaskReview
          set={trainingSet}
          answers={attempt.answers}
          isSubmitted={false}
          result={null}
          actionState={actionState}
          onClear={(taskId) => void handleClearAnswer(taskId)}
          onSelectTask={(taskId) => {
            setActionState({ status: "idle" });
            setSelectedTaskId(taskId);
            setShowReview(false);
          }}
        />

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button type="button" onClick={() => setShowReview(false)} disabled={isLoading}>
            Вернуться к заданиям
          </button>
          <button
            type="button"
            onClick={() => void handleFinish()}
            disabled={isLoading}
            style={{ background: "#244a7c", color: "white", borderColor: "#244a7c" }}
          >
            {isLoading ? "Отправка..." : "Завершить попытку"}
          </button>
        </div>
      </div>
    );
  }

  const currentIndex = trainingSet.tasks.findIndex((t) => t.id === selectedTaskId);
  const safeIndex = currentIndex !== -1 ? currentIndex : 0;
  const currentTask = trainingSet.tasks[safeIndex];
  const currentAnswer = attempt.answers.find((a) => a.taskId === currentTask.id);

  return (
    <div>
      <h1>{trainingSet.title}</h1>
      <p><small>ID попытки: {attempt.id}</small></p>

      {restoreMessage && (
        <p style={{ background: "#fef3c7", padding: "10px 12px", borderRadius: "6px" }}>
          {restoreMessage}
        </p>
      )}

      {errorBanner}

      <p>
        Подтверждено сервером: {progress.filled} из {progress.total}
        {unansweredTasks.length > 0
          ? ` (пропущено: ${unansweredTasks.map((t) => t.id).join(", ")})`
          : " (все задания сохранены)"}
      </p>

      <div className="container">
        <TaskList
          tasks={trainingSet.tasks}
          answers={attempt.answers}
          selectedId={currentTask.id}
          onSelect={(taskId) => {
            setActionState({ status: "idle" });
            setSelectedTaskId(taskId);
          }}
        />

        <div style={{ flex: 2 }}>
          <TaskCard
            task={currentTask}
            confirmedAnswer={currentAnswer}
            isSubmitted={false}
            actionState={actionState}
            onSaveAnswer={(ans) => void handleSaveAnswer(ans)}
            onClearAnswer={(taskId) => void handleClearAnswer(taskId)}
          />

          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button
              type="button"
              onClick={() => {
                setActionState({ status: "idle" });
                setSelectedTaskId(trainingSet.tasks[Math.max(0, safeIndex - 1)].id);
              }}
              disabled={safeIndex === 0 || isLoading}
            >
              Назад
            </button>

            <button
              type="button"
              onClick={() => {
                setActionState({ status: "idle" });
                setSelectedTaskId(
                  trainingSet.tasks[Math.min(trainingSet.tasks.length - 1, safeIndex + 1)].id
                );
              }}
              disabled={safeIndex === trainingSet.tasks.length - 1 || isLoading}
            >
              Далее
            </button>

            <button
              type="button"
              onClick={() => {
                setActionState({ status: "idle" });
                setShowReview(true);
              }}
              disabled={isLoading}
            >
              Обзор ответов
            </button>

            <button
              type="button"
              onClick={() => void handleFinish()}
              disabled={isLoading}
              style={{ background: "#244a7c", color: "white", borderColor: "#244a7c" }}
            >
              {isLoading ? "Отправка..." : "Завершить попытку"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}