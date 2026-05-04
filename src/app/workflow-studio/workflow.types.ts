export type CodeLanguage = 'json' | 'typescript' | 'javascript' | 'python' | 'xml';

export type ScriptLanguage = 'typescript' | 'javascript' | 'python';

export type LangGraphNodeKind =
  | 'start'
  | 'end'
  | 'service'
  | 'script'
  | 'user'
  | 'send'
  | 'receive'
  | 'timer'
  | 'subgraph'
  | 'task';

export interface SelectedElementInfo {
  id: string;
  name: string;
  type: string;
}

export interface NodeScript {
  language: ScriptLanguage;
  annotationId: string;
  functionName: string;
  args: string;
  body: string;
}

export interface LangGraphNode {
  id: string;
  name: string;
  bpmnType: string;
  kind: LangGraphNodeKind;
  functionName: string;
  annotationId: string;
  variables: string[];
}

export interface LangGraphEdge {
  source: string;
  target: string;
  condition?: string;
  label?: string;
  gatewayId?: string;
  gatewayType?: string;
  isConditional?: boolean;
  isLoop?: boolean;
}

export interface LangGraphWorkflow {
  id: string;
  name: string;
  symbolScope: string;
  entry: string | null;
  finish: string[];
  nodes: LangGraphNode[];
  edges: LangGraphEdge[];
  subgraphs: Record<string, LangGraphWorkflow>;
  variables: string[];
}
