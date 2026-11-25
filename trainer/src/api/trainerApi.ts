import type {
  Answer,
  AttemptResult,
  ServerAttempt,
  TrainingSet,
  TrainingSetSummary,
} from "../domain";

const API_BASE = "http://localhost:3001/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function request(path: string, options?: RequestInit): Promise<unknown> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      "Нет соединения с учебным сервером (http://localhost:3001).",
      0
    );
  }

  if (!response.ok) {
    let message = `Ошибка сервера (HTTP ${response.status})`;
    try {
      const errBody: unknown = await response.json();
      if (isObject(errBody) && isObject(errBody.error) && typeof errBody.error.message === "string") {
        message = `${errBody.error.message} (HTTP ${response.status})`;
      }
    } catch {
        
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as unknown;
}

function assertAttempt(data: unknown): ServerAttempt {
  if (
    !isObject(data) ||
    typeof data.id !== "string" ||
    typeof data.setId !== "string" ||
    (data.status !== "in-progress" && data.status !== "submitted") ||
    !Array.isArray(data.answers)
  ) {
    throw new ApiError("Сервер вернул некорректный формат попытки.", 200);
  }
  return data as ServerAttempt;
}

function assertResult(data: unknown): AttemptResult {
  if (
    !isObject(data) ||
    typeof data.attemptId !== "string" ||
    (data.status !== "graded" && data.status !== "pending-review") ||
    (data.score !== null && typeof data.score !== "number") ||
    typeof data.maxScore !== "number" ||
    !Array.isArray(data.items)
  ) {
    throw new ApiError("Сервер вернул некорректный формат результата.", 200);
  }
  return data as AttemptResult;
}

export const trainerApi = {
  async getSets(): Promise<TrainingSetSummary[]> {
    const data = await request("/sets");
    if (!Array.isArray(data)) {
      throw new ApiError("Ожидался список модулей.", 200);
    }
    return data as TrainingSetSummary[];
  },

  async getSetById(setId: string): Promise<TrainingSet> {
    const data = await request(`/sets/${setId}`);
    if (
      !isObject(data) ||
      typeof data.id !== "string" ||
      typeof data.title !== "string" ||
      !Array.isArray(data.tasks)
    ) {
      throw new ApiError("Сервер вернул некорректный модуль.", 200);
    }
    return data as TrainingSet;
  },

  async createAttempt(setId: string): Promise<ServerAttempt> {
    const data = await request("/attempts", {
      method: "POST",
      body: JSON.stringify({ setId }),
    });
    return assertAttempt(data);
  },

  async getAttempt(attemptId: string): Promise<ServerAttempt> {
    const data = await request(`/attempts/${attemptId}`);
    return assertAttempt(data);
  },

  async saveAnswer(attemptId: string, answer: Answer): Promise<ServerAttempt> {
    const data = await request(`/attempts/${attemptId}/answers/${answer.taskId}`, {
      method: "PUT",
      body: JSON.stringify(answer),
    });
    return assertAttempt(data);
  },

  async deleteAnswer(attemptId: string, taskId: string): Promise<ServerAttempt> {
    const data = await request(`/attempts/${attemptId}/answers/${taskId}`, {
      method: "DELETE",
    });
    return assertAttempt(data);
  },

  async submitAttempt(attemptId: string): Promise<AttemptResult> {
    const data = await request(`/attempts/${attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return assertResult(data);
  },

  async getResult(attemptId: string): Promise<AttemptResult> {
    const data = await request(`/attempts/${attemptId}/result`);
    return assertResult(data);
  },
};