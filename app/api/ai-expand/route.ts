import OpenAI from "openai";
import { NextResponse } from "next/server";

type ExpandRequest = {
  existingLabels: string[];
  nodeDescription: string;
  nodeLabel: string;
  topic: string;
};

type IdeaSuggestion = {
  description: string;
  label: string;
};

const MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";

function normalizeLabel(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function parseIdeas(rawText: string, existingLabels: string[]) {
  const existing = new Set(existingLabels.map(normalizeLabel));
  const seen = new Set<string>();
  const trimmed = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed = JSON.parse(trimmed) as { ideas?: IdeaSuggestion[] };
  if (!Array.isArray(parsed.ideas)) {
    throw new Error("AI response did not include an ideas array.");
  }

  return parsed.ideas
    .filter(
      (idea) =>
        typeof idea?.label === "string" && typeof idea?.description === "string",
    )
    .map((idea) => ({
      label: idea.label.trim().slice(0, 10),
      description: idea.description.trim().slice(0, 80),
    }))
    .filter((idea) => idea.label.length > 0)
    .filter((idea) => {
      const key = normalizeLabel(idea.label);
      if (existing.has(key) || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY 환경 변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  let body: ExpandRequest;
  try {
    body = (await request.json()) as ExpandRequest;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { existingLabels, nodeDescription, nodeLabel, topic } = body;
  if (
    typeof topic !== "string" ||
    typeof nodeLabel !== "string" ||
    typeof nodeDescription !== "string" ||
    !Array.isArray(existingLabels) ||
    existingLabels.some((label) => typeof label !== "string")
  ) {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const userPrompt = `다음 노드와 연결될 하위 아이디어 3~5개를 제안해주세요.

전체 주제: ${topic}
현재 노드 제목: ${nodeLabel}
현재 노드 설명: ${nodeDescription || "(없음)"}
이미 있는 노드 목록: ${existingLabels.join(", ") || "(없음)"}

조건:
- 각 아이디어의 제목(label)은 최대 10자 이내
- 각 아이디어의 설명(description)은 최대 80자 이내
- 이미 있는 노드 목록과 중복되지 않을 것
- 한국어로 작성

다음 JSON 형식으로만 응답하세요:
{"ideas":[{"label":"제목","description":"설명"}]}`;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: MODEL,
      max_output_tokens: 512,
      instructions:
        "당신은 아이디어 브레인스토밍 보조 전문가입니다. 반드시 JSON 형식만 출력하고 다른 텍스트는 포함하지 마세요.",
      input: userPrompt,
    });
    const rawText = response.output_text.trim();

    if (!rawText) {
      return NextResponse.json({ error: "AI 응답 형식 오류" }, { status: 500 });
    }

    let ideas: IdeaSuggestion[];
    try {
      ideas = parseIdeas(rawText, existingLabels);
    } catch {
      return NextResponse.json({ error: "AI 응답 파싱 실패" }, { status: 500 });
    }

    return NextResponse.json({ ideas });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
