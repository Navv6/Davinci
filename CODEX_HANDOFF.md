# 다빈치노트 — Codex 인계 문서

> **작성일**: 2026-04-06
> **현재 브랜치**: `main`
> **상태**: P0 완료 / Phase 1.5 미구현

---

## 프로젝트 개요

Next.js 16.2.1 + React 19 + Three.js 기반 3D 아이디어 그래프 노트 앱.
사용자가 주제를 입력하면 3D 공간에 노드 그래프가 생성된다. 노드 추가·수정·삭제, 메모 작성, localStorage 자동 저장 구현 완료.

```
app/
  layout.tsx          — 루트 레이아웃 (fixed 푸터 포함)
  page.tsx            — 모바일/데스크톱 분기
  error.tsx           — 에러 바운더리
  privacy/page.tsx    — 개인정보처리방침
  terms/page.tsx      — 이용약관

components/
  desktop/
    DavinciExperience.tsx   — 데스크톱 진입점 (복구 UI 포함)
    IdeaSpace.tsx           — Three.js 그래프 (1100+ lines)
    NodeInfoPanel.tsx       — 선택 노드 편집 패널 (하단 카드)
    IdeaSidebar.tsx         — 아웃라인 사이드바
    MiniMapPanel.tsx        — 미니맵
  mobile/
    DavinciExperience.tsx   — 모바일 진입점 (복구 UI 포함)
    IdeaSpace.tsx           — 모바일 Three.js 그래프

lib/
  graphData.ts        — createGraphSeed, createSpawnedNode, getPaletteForLevel
  storage.ts          — saveGraph / loadGraph / clearGraph (localStorage)

types/
  davinci.ts          — GraphNode, GraphEdge, GraphSeed, SequenceStage 등
```

---

## 완료된 작업 (P0)

| 파일 | 내용 |
|------|------|
| `lib/storage.ts` | localStorage 자동 저장/복구 (`davinci_graph_v1`) |
| `components/desktop/IdeaSpace.tsx` | `initialSeed?`, `initialMemo?` props, WebGL fallback, `persistGraph` |
| `components/mobile/IdeaSpace.tsx` | 동일 패턴 |
| `components/desktop/DavinciExperience.tsx` | 이어하기/새로 시작 복구 다이얼로그 |
| `components/mobile/DavinciExperience.tsx` | 동일 패턴 |
| `app/error.tsx` | Next.js 에러 바운더리 (한국어) |
| `app/privacy/page.tsx` | 개인정보처리방침 페이지 |
| `app/terms/page.tsx` | 이용약관 페이지 |
| `app/layout.tsx` | fixed 푸터 (pointer-events-none, 캔버스 이벤트 방해 없음) |

---

## 미구현 작업 — Phase 1.5: AI 아이디어 확장

### 목표
선택된 노드 기준으로 AI가 하위 아이디어 3~5개를 제안 → 자동으로 자식 노드로 추가.
무료 3회 제한 후 "구독이 필요합니다" 메시지 표시.

### 배포 변경
현재 `next.config.ts`에 GitHub Pages 정적 배포 설정(`output: "export"`)이 있어 API 라우트 사용 불가.
**Vercel로 전환하므로 해당 설정 제거 필요.**

---

## 구현 명세

### 1단계: 패키지 설치

```bash
npm install openai
```

---

### 2단계: `next.config.ts` 수정

```typescript
// 변경 전
const isProd = process.env.GITHUB_ACTIONS === "true";
const nextConfig: NextConfig = {
  ...(isProd && { output: "export", basePath: "/Davinci" }),
  images: { unoptimized: true },
};

// 변경 후
const nextConfig: NextConfig = {
  images: { unoptimized: true },
};
export default nextConfig;
```

---

### 3단계: `lib/aiUsage.ts` 신규 생성

`lib/storage.ts`와 동일한 try/catch 패턴 사용.

```typescript
const KEY = "davinci_ai_uses";
const FREE_LIMIT = 3;

export function getAIUsageCount(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const count = parseInt(raw, 10);
    return Number.isNaN(count) ? 0 : count;
  } catch {
    return 0;
  }
}

export function hasRemainingAIUsage(): boolean {
  return getAIUsageCount() < FREE_LIMIT;
}

export function incrementAIUsageCount(): void {
  try {
    localStorage.setItem(KEY, String(getAIUsageCount() + 1));
  } catch {
    // quota exceeded — 무시
  }
}

export function getRemainingAIUses(): number {
  return Math.max(0, FREE_LIMIT - getAIUsageCount());
}
```

---

### 4단계: `app/api/ai-expand/route.ts` 신규 생성

```typescript
import OpenAI from "openai";
import { NextResponse } from "next/server";

type ExpandRequest = {
  nodeLabel: string;
  nodeDescription: string;
  topic: string;
  existingLabels: string[];
};

type IdeaSuggestion = {
  label: string;
  description: string;
};

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
    return NextResponse.json({ error: "잘못된 요청 형식" }, { status: 400 });
  }

  const { nodeLabel, nodeDescription, topic, existingLabels } = body;

  const userPrompt = `다음 노드에 연결할 하위 아이디어 3~5개를 제안해주세요.

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
{"ideas":[{"label":"제목","description":"설명"},{"label":"제목","description":"설명"}]}`;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-nano",
      max_output_tokens: 512,
      instructions:
        "당신은 아이디어 브레인스토밍 전문가입니다. 반드시 JSON 형식만 출력하고 다른 텍스트는 포함하지 마세요.",
      input: userPrompt,
    });

    const rawText = response.output_text.trim();

    if (!rawText) {
      return NextResponse.json({ error: "AI 응답 형식 오류" }, { status: 500 });
    }

    let parsed: { ideas: IdeaSuggestion[] };
    try {
      parsed = JSON.parse(rawText) as { ideas: IdeaSuggestion[] };
    } catch {
      return NextResponse.json({ error: "AI 응답 파싱 실패" }, { status: 500 });
    }

    if (!Array.isArray(parsed.ideas)) {
      return NextResponse.json({ error: "AI 응답 구조 오류" }, { status: 500 });
    }

    const ideas = parsed.ideas
      .filter(
        (i) => typeof i.label === "string" && typeof i.description === "string",
      )
      .map((i) => ({
        label: i.label.slice(0, 10),
        description: i.description.slice(0, 80),
      }))
      .slice(0, 5);

    return NextResponse.json({ ideas });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

---

### 5단계: `components/desktop/IdeaSpace.tsx` 수정

#### 5-1. import 추가 (파일 상단)
```typescript
import {
  getRemainingAIUses,
  hasRemainingAIUsage,
  incrementAIUsageCount,
} from "@/lib/aiUsage";
```

#### 5-2. GraphApi 타입 확장 (파일 상단의 로컬 타입)
```typescript
type GraphApi = {
  deleteSelectedNode: () => void;
  selectNode: (id: number) => void;
  spawnMultipleNodes: (
    parentId: number,
    ideas: { label: string; description: string }[],
  ) => void;
  spawnNode: (parentId: number) => void;
  updateNode: (id: number, patch: Pick<GraphNode, "description" | "label">) => void;
};
```

#### 5-3. React state 추가 (기존 useState 블록 맨 끝에 추가)
```typescript
const [aiExpanding, setAIExpanding] = useState(false);
const [remainingAIUses, setRemainingAIUses] = useState(() =>
  getRemainingAIUses(),
);
```

#### 5-4. `spawnMultipleNodes` 함수 추가 (useEffect 내부, `spawnNode` 함수 바로 아래)

```typescript
const spawnMultipleNodes = (
  parentId: number,
  ideas: { label: string; description: string }[],
) => {
  const parent = nodeMap.get(parentId);
  if (!parent || ideas.length === 0) return;

  let siblingCount = edges.filter(([from]) => from === parentId).length;
  const spawnedIds: number[] = [];

  for (const idea of ideas) {
    const node = createSpawnedNode(idea.label, nextId, parent, siblingCount);
    node.description = idea.description;
    const runtimeNode: RuntimeNode = {
      ...node,
      bornAt: performance.now() + spawnedIds.length * 80,
    };
    nextId += 1;
    siblingCount += 1;
    nodes.push(runtimeNode);
    nodeMap.set(runtimeNode.id, runtimeNode);
    edges.push([parentId, runtimeNode.id]);
    makeNode(runtimeNode, true);
    makeEdge(parentId, runtimeNode.id, true);
    spawnedIds.push(runtimeNode.id);
  }

  if (spawnedIds[0] !== undefined) setSelected(spawnedIds[0]);
  persistGraph();
};
```

> `bornAt` 80ms 스태거: 노드가 순차적으로 등장하는 시각 효과.
> `setSelected`는 루프 밖에서 한 번만 호출 (React re-render 최소화).

#### 5-5. `graphApiRef.current` 할당부에 `spawnMultipleNodes` 추가
기존 `graphApiRef.current = { spawnNode, selectNode: setSelected, updateNode, deleteSelectedNode }` 에 `spawnMultipleNodes` 추가.

#### 5-6. `handleAIExpand` 함수 추가 (useEffect 외부, `handleDescriptionChange` 뒤에)

```typescript
const handleAIExpand = async () => {
  if (!selectedNode || aiExpanding || !hasRemainingAIUsage()) return;

  setAIExpanding(true);
  try {
    const res = await fetch("/api/ai-expand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeLabel: selectedNode.label,
        nodeDescription: selectedNode.description,
        topic,
        existingLabels: snapshotNodes.map((n) => n.label),
      }),
    });

    if (!res.ok) throw new Error("AI 요청 실패");

    const { ideas } = (await res.json()) as {
      ideas: { label: string; description: string }[];
    };

    if (Array.isArray(ideas) && ideas.length > 0) {
      graphApiRef.current?.spawnMultipleNodes(selectedNode.id, ideas);
      incrementAIUsageCount();
      setRemainingAIUses(getRemainingAIUses());
    }
  } catch (err) {
    console.error("[AI Expand]", err);
  } finally {
    setAIExpanding(false);
  }
};
```

#### 5-7. NodeInfoPanel JSX에 props 추가
```tsx
<NodeInfoPanel
  aiExpanding={aiExpanding}
  canDelete={Boolean(selectedNode && selectedNode.id !== seed.rootId)}
  node={selectedNode}
  onAIExpand={handleAIExpand}
  onDelete={handleDeleteNode}
  onDescriptionChange={handleDescriptionChange}
  onLabelChange={handleLabelChange}
  remainingAIUses={remainingAIUses}
  visible={Boolean(selectedNode)}
/>
```

---

### 6단계: `components/desktop/NodeInfoPanel.tsx` 수정

#### 6-1. Props 타입 확장

```typescript
type NodeInfoPanelProps = {
  aiExpanding?: boolean;
  canDelete: boolean;
  node: GraphNode | null;
  onAIExpand?: () => void;
  onDelete: () => void;
  onDescriptionChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  remainingAIUses?: number;
  visible: boolean;
};
```

함수 시그니처도 업데이트:
```typescript
export function NodeInfoPanel({
  aiExpanding,
  canDelete,
  node,
  onAIExpand,
  onDelete,
  onDescriptionChange,
  onLabelChange,
  remainingAIUses,
  visible,
}: NodeInfoPanelProps)
```

#### 6-2. AI 버튼 UI 추가 (description `</textarea>` 바로 아래, 카드 닫기 `</div>` 전)

```tsx
{onAIExpand !== undefined && (
  <div className="mt-4 border-t border-[#e8d5b8] pt-4">
    {remainingAIUses !== undefined && remainingAIUses > 0 ? (
      <button
        type="button"
        onClick={onAIExpand}
        disabled={aiExpanding}
        className="flex w-full items-center justify-between rounded-[0.75rem] border border-[#e8d5b8] px-4 py-2.5 text-[12px] italic tracking-[0.1em] text-[#8b6c42] transition-colors duration-200 hover:border-[#8b6c42] hover:text-[#3d2b12] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>{aiExpanding ? "확장 중..." : "AI로 아이디어 확장"}</span>
        {!aiExpanding && (
          <span className="not-italic text-[10px] tracking-[0.15em] text-[#c4a882]">
            {remainingAIUses}/3
          </span>
        )}
        {aiExpanding && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border border-[#c4a882] border-t-[#8b6c42]" />
        )}
      </button>
    ) : remainingAIUses === 0 ? (
      <p className="text-center text-[11px] italic tracking-[0.12em] text-[#c4a882]">
        구독이 필요합니다 (0/3)
      </p>
    ) : null}
  </div>
)}
```

---

### 7단계: `components/mobile/IdeaSpace.tsx` 수정

5단계와 동일한 변경을 모바일 파일에 적용.

- **GraphApi 타입**: `spawnMultipleNodes` 추가 (모바일 파일에도 로컬 타입 존재)
- **`spawnMultipleNodes`**: useEffect 내부, `spawnNode` 바로 아래에 동일하게 구현
- **`graphApiRef` 할당**: `spawnMultipleNodes` 추가
- **state**: `aiExpanding`, `remainingAIUses` 추가
- **`handleAIExpand`**: `handleDescriptionChange` 뒤에 동일하게 추가
- **인라인 바텀시트 JSX**: description `</textarea>` 아래에 버튼 삽입

```tsx
{/* AI 확장 버튼 — description textarea 아래 */}
<div className="mt-4 border-t border-[#e8d5b8] pt-4">
  {remainingAIUses > 0 ? (
    <button
      type="button"
      onClick={handleAIExpand}
      disabled={aiExpanding}
      className="flex w-full items-center justify-between rounded-[0.75rem] border border-[#e8d5b8] px-4 py-3 text-[13px] italic tracking-[0.1em] text-[#8b6c42] disabled:opacity-50"
    >
      <span>{aiExpanding ? "확장 중..." : "AI로 아이디어 확장"}</span>
      {!aiExpanding && (
        <span className="not-italic text-[11px] tracking-[0.15em] text-[#c4a882]">
          {remainingAIUses}/3
        </span>
      )}
      {aiExpanding && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border border-[#c4a882] border-t-[#8b6c42]" />
      )}
    </button>
  ) : (
    <p className="text-center text-[12px] italic tracking-[0.12em] text-[#c4a882]">
      구독이 필요합니다 (0/3)
    </p>
  )}
</div>
```

**조이스틱 bottom offset 조정** (버튼 공간 확보):
```tsx
// 변경 전
bottom: panelOpen ? 220 : 40

// 변경 후
bottom: panelOpen ? 270 : 40
```

---

## 환경 변수

### 로컬 개발 (`.env.local` — gitignore 필수)
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-nano
```

### Vercel 배포
대시보드 → Settings → Environment Variables:
```
OPENAI_API_KEY = sk-...
OPENAI_MODEL = gpt-5-nano
```

---

## 검증 체크리스트

- [ ] 노드 선택 → NodeInfoPanel 하단에 "AI로 아이디어 확장 [3/3]" 버튼 표시
- [ ] 버튼 클릭 → "확장 중..." + 스피너 표시
- [ ] AI 응답 후 자식 노드 3~5개 순차 생성 (80ms 스태거 애니메이션)
- [ ] 3회 사용 후 → "구독이 필요합니다 (0/3)" 텍스트로 교체
- [ ] 새로고침 후 사용 횟수 유지 (localStorage `davinci_ai_uses`)
- [ ] `OPENAI_API_KEY` 미설정 → 서버 500, 클라이언트 console.error, 카운트 미증가
- [ ] 모바일 바텀시트에도 동일 버튼 표시 및 동작
- [ ] `next build` + `npx tsc --noEmit` + `npx eslint` 모두 통과

---

## 주의사항

1. **`createSpawnedNode`** (`lib/graphData.ts:41`) 은 `description: ""` 반환 → 루프 안에서 `node.description = idea.description` 으로 직접 덮어씀
2. **`persistGraph`** 는 이미 useEffect 클로저 안에 정의되어 있음 → `spawnMultipleNodes` 끝에서 호출
3. **ESLint `react-hooks/exhaustive-deps`**: `useEffect` 의존성 배열 `[seed]` 에 `// eslint-disable-next-line react-hooks/exhaustive-deps` 주석 이미 추가되어 있음 — 새 함수 추가 시 동일 패턴 유지
4. **`output: "export"` 제거** 후 GitHub Actions 배포 워크플로우(`/.github/workflows/`)가 있다면 해당 파일도 비활성화 또는 삭제 필요
