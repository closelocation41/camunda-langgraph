import { Injectable } from '@angular/core';
import {
  LangGraphEdge,
  LangGraphNode,
  LangGraphNodeKind,
  LangGraphWorkflow,
  NodeScript,
} from './workflow.types';

@Injectable({ providedIn: 'root' })
export class LangGraphConverterService {
  parse(xml: string, scripts: Record<string, NodeScript>): LangGraphWorkflow {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const error = doc.getElementsByTagName('parsererror')[0];
    if (error) {
      throw new Error(error.textContent || 'Invalid BPMN XML');
    }

    const process = this.elements(doc, 'process')[0];
    if (!process) {
      throw new Error('No BPMN process found');
    }

    const nodes: LangGraphNode[] = [];
    const edges: LangGraphEdge[] = [];
    const processId = process.getAttribute('id') || 'Process_LangGraph';
    const processName = process.getAttribute('name') || processId;

    for (const element of Array.from(process.children)) {
      if (element.localName === 'sequenceFlow' || element.localName === 'extensionElements') {
        continue;
      }

      const id = element.getAttribute('id');
      if (!id) {
        continue;
      }

      const name = element.getAttribute('name') || id;
      const kind = this.mapBpmnType(element.localName);
      const script = scripts[id];
      nodes.push({
        id,
        name,
        bpmnType: element.localName,
        kind,
        functionName: script?.functionName || this.toFunctionName(name || id),
        annotationId: script?.annotationId || id,
      });
    }

    for (const flow of this.elements(process, 'sequenceFlow')) {
      const source = flow.getAttribute('sourceRef');
      const target = flow.getAttribute('targetRef');
      if (!source || !target) {
        continue;
      }

      const label = flow.getAttribute('name') || undefined;
      edges.push({
        source,
        target,
        label,
        condition: label ? this.toFunctionName(label) : undefined,
      });
    }

    const entry = nodes.find((node) => node.kind === 'start')?.id || nodes[0]?.id || null;
    const finish = nodes.filter((node) => node.kind === 'end').map((node) => node.id);

    return {
      id: processId,
      name: processName,
      entry,
      finish,
      nodes,
      edges,
    };
  }

  toJson(xml: string, scripts: Record<string, NodeScript>): string {
    return JSON.stringify(this.parse(xml, scripts), null, 2);
  }

  toTypeScript(xml: string, scripts: Record<string, NodeScript>): string {
    const workflow = this.parse(xml, scripts);
    const nonTerminalNodes = workflow.nodes.filter((node) => node.kind !== 'start' && node.kind !== 'end');
    const normalEdges = workflow.edges.filter((edge) => !this.isConditional(edge, workflow));
    const conditionalSources = this.conditionalSources(workflow);

    return [
      `import { END, START, StateGraph, Annotation } from '@langchain/langgraph';`,
      '',
      `const WorkflowState = Annotation.Root({`,
      `  input: Annotation<string>(),`,
      `  output: Annotation<string>(),`,
      `  messages: Annotation<unknown[]>({ reducer: (left, right) => left.concat(right), default: () => [] }),`,
      `});`,
      '',
      ...nonTerminalNodes.map((node) => this.renderTsFunction(node, scripts[node.id])),
      ...conditionalSources.map((source) => this.renderTsRouteFunction(source, workflow)),
      `const graph = new StateGraph(WorkflowState)`,
      ...nonTerminalNodes.map((node) => `  .addNode('${node.id}', ${node.functionName})`),
      ...normalEdges.map((edge) => `  .addEdge(${this.edgeEndpoint(edge.source, workflow)}, ${this.edgeEndpoint(edge.target, workflow)})`),
      ...conditionalSources.map((source) => this.renderTsConditionalEdge(source, workflow)),
      `  .compile();`,
      '',
      `export default graph;`,
      '',
    ].join('\n');
  }

  toJavaScript(xml: string, scripts: Record<string, NodeScript>): string {
    return this.toTypeScript(xml, scripts)
      .replace(`import { END, START, StateGraph, Annotation } from '@langchain/langgraph';`, `import { END, START, StateGraph, Annotation } from '@langchain/langgraph';`)
      .replace(/: Annotation\.State<typeof WorkflowState>/g, '')
      .replace(/: Promise<Record<string, unknown>>/g, '')
      .replace(/: Record<string, unknown>/g, '');
  }

  toPython(xml: string, scripts: Record<string, NodeScript>): string {
    const workflow = this.parse(xml, scripts);
    const nonTerminalNodes = workflow.nodes.filter((node) => node.kind !== 'start' && node.kind !== 'end');
    const normalEdges = workflow.edges.filter((edge) => !this.isConditional(edge, workflow));
    const conditionalSources = this.conditionalSources(workflow);

    const lines = [
      `from typing import TypedDict, Annotated`,
      `from langgraph.graph import StateGraph, START, END`,
      '',
      `class WorkflowState(TypedDict):`,
      `    input: str`,
      `    output: str`,
      `    messages: list`,
      '',
      ...nonTerminalNodes.map((node) => this.renderPyFunction(node, scripts[node.id])),
      ...conditionalSources.map((source) => this.renderPyRouteFunction(source, workflow)),
      `builder = StateGraph(WorkflowState)`,
      ...nonTerminalNodes.map((node) => `builder.add_node("${node.id}", ${node.functionName})`),
      ...normalEdges.map((edge) => `builder.add_edge(${this.pyEndpoint(edge.source, workflow)}, ${this.pyEndpoint(edge.target, workflow)})`),
      ...conditionalSources.map((source) => this.renderPyConditionalEdge(source, workflow)),
      '',
      `graph = builder.compile()`,
      '',
    ];

    return lines.join('\n');
  }

  defaultScript(elementId: string, elementName: string, language: NodeScript['language']): NodeScript {
    const functionName = this.toFunctionName(elementName || elementId || 'workflow_node');
    return {
      language,
      annotationId: elementId,
      functionName,
      args: language === 'python' ? 'state' : 'state',
      body: language === 'python'
        ? 'return {"output": state.get("input", "")}'
        : `return { output: state.input ?? '' };`,
    };
  }

  private renderTsFunction(node: LangGraphNode, script?: NodeScript): string {
    const body = (script?.body || `return { output: state.input ?? '' };`).trim();
    return [
      `async function ${node.functionName}(state: Annotation.State<typeof WorkflowState>): Promise<Record<string, unknown>> {`,
      this.indent(body, 2),
      `}`,
      '',
    ].join('\n');
  }

  private renderPyFunction(node: LangGraphNode, script?: NodeScript): string {
    const body = (script?.body || `return {"output": state.get("input", "")}`).trim();
    return [
      `def ${node.functionName}(state):`,
      this.indent(body, 4),
      '',
    ].join('\n');
  }

  private renderTsRouteFunction(source: string, workflow: LangGraphWorkflow): string {
    const firstRoute = this.routeKey(workflow.edges.find((edge) => edge.source === source));
    return [
      `function route_${source}(state: Annotation.State<typeof WorkflowState>): string {`,
      `  // Replace this placeholder with real state-based routing logic.`,
      `  return '${firstRoute}';`,
      `}`,
      '',
    ].join('\n');
  }

  private renderTsConditionalEdge(source: string, workflow: LangGraphWorkflow): string {
    return `  .addConditionalEdges('${source}', route_${source}, ${this.renderTsRouteMap(source, workflow)})`;
  }

  private renderPyRouteFunction(source: string, workflow: LangGraphWorkflow): string {
    const firstRoute = this.routeKey(workflow.edges.find((edge) => edge.source === source));
    return [
      `def route_${source}(state):`,
      `    # Replace this placeholder with real state-based routing logic.`,
      `    return "${firstRoute}"`,
      '',
    ].join('\n');
  }

  private renderPyConditionalEdge(source: string, workflow: LangGraphWorkflow): string {
    return `builder.add_conditional_edges("${source}", route_${source}, ${this.renderPyRouteMap(source, workflow)})`;
  }

  private renderTsRouteMap(source: string, workflow: LangGraphWorkflow): string {
    const entries = workflow.edges
      .filter((edge) => edge.source === source)
      .map((edge) => `'${this.routeKey(edge)}': ${this.edgeEndpoint(edge.target, workflow)}`);
    return `{ ${entries.join(', ')} }`;
  }

  private renderPyRouteMap(source: string, workflow: LangGraphWorkflow): string {
    const entries = workflow.edges
      .filter((edge) => edge.source === source)
      .map((edge) => `"${this.routeKey(edge)}": ${this.pyEndpoint(edge.target, workflow)}`);
    return `{${entries.join(', ')}}`;
  }

  private conditionalSources(workflow: LangGraphWorkflow): string[] {
    return Array.from(new Set(
      workflow.edges
        .filter((edge) => this.isConditional(edge, workflow))
        .map((edge) => edge.source),
    ));
  }

  private routeKey(edge?: LangGraphEdge): string {
    return edge?.condition || this.toFunctionName(edge?.label || edge?.target || 'next');
  }

  private isConditional(edge: LangGraphEdge, workflow: LangGraphWorkflow): boolean {
    const source = workflow.nodes.find((node) => node.id === edge.source);
    return source?.kind === 'router';
  }

  private edgeEndpoint(id: string, workflow: LangGraphWorkflow): string {
    const node = workflow.nodes.find((item) => item.id === id);
    if (node?.kind === 'start') {
      return 'START';
    }
    if (node?.kind === 'end') {
      return 'END';
    }
    return `'${id}'`;
  }

  private pyEndpoint(id: string, workflow: LangGraphWorkflow): string {
    const endpoint = this.edgeEndpoint(id, workflow);
    return endpoint.startsWith("'") ? `"${id}"` : endpoint;
  }

  private mapBpmnType(type: string): LangGraphNodeKind {
    switch (type) {
      case 'startEvent':
        return 'start';
      case 'endEvent':
        return 'end';
      case 'userTask':
      case 'manualTask':
        return 'agent';
      case 'serviceTask':
      case 'sendTask':
      case 'receiveTask':
        return 'tool';
      case 'exclusiveGateway':
      case 'inclusiveGateway':
      case 'parallelGateway':
        return 'router';
      case 'callActivity':
      case 'subProcess':
        return 'subgraph';
      case 'intermediateCatchEvent':
      case 'intermediateThrowEvent':
      case 'boundaryEvent':
        return 'event';
      default:
        return 'task';
    }
  }

  private elements(parent: Document | Element, localName: string): Element[] {
    const namespaced = Array.from(parent.getElementsByTagNameNS('*', localName));
    if (namespaced.length) {
      return namespaced;
    }
    return Array.from(parent.getElementsByTagName(localName));
  }

  private toFunctionName(value: string): string {
    const name = value
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    return /^[0-9]/.test(name) ? `node_${name}` : name || 'workflow_node';
  }

  private indent(value: string, size: number): string {
    const prefix = ' '.repeat(size);
    return value.split('\n').map((line) => `${prefix}${line}`).join('\n');
  }
}
