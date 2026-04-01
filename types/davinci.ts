export type SequenceStage =
  | "idle"
  | "dusting"
  | "gathering"
  | "reforming"
  | "holding"
  | "fading"
  | "graph";

export type IntroStage = SequenceStage;

export type ParticlePhase = "dust" | "gather" | "reform" | "settled" | "fading";

export type NodeCategory =
  | "topic"
  | "idea"
  | "keyword"
  | "task"
  | "reference";

export type GraphNodeLevel = 0 | 1 | 2 | 3;

export type GraphNode = {
  id: number;
  label: string;
  level: GraphNodeLevel;
  x: number;
  y: number;
  z: number;
  born: number;
  description: string;
  category?: NodeCategory;
};

export type GraphEdge = [number, number];

export type GraphSeed = {
  edges: GraphEdge[];
  nextId: number;
  nodes: GraphNode[];
  rootId: number;
};

export type NodeType = {
  id: string;
  label: string;
  position: [number, number, number];
  description?: string;
  category?: NodeCategory;
  accent?: string;
};

export type EdgeType = {
  from: string;
  to: string;
};

export type GraphData = {
  rootId: string;
  nodes: NodeType[];
  edges: EdgeType[];
};
