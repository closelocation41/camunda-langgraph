export type CodeLanguage = 'json' | 'typescript' | 'javascript' | 'python' | 'xml';

export type ScriptLanguage = 'typescript' | 'javascript' | 'python';

export type LangGraphNodeKind =
  | 'start'
  | 'end'
  | 'agent'
  | 'tool'
  | 'router'
  | 'task'
  | 'subgraph'
  | 'event';

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
}

export interface LangGraphEdge {
  source: string;
  target: string;
  condition?: string;
  label?: string;
}

export interface LangGraphWorkflow {
  id: string;
  name: string;
  entry: string | null;
  finish: string[];
  nodes: LangGraphNode[];
  edges: LangGraphEdge[];
}
