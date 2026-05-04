import { Injectable } from '@angular/core';
import {
  LangGraphEdge,
  LangGraphNode,
  LangGraphNodeKind,
  LangGraphWorkflow,
  NodeScript,
} from './workflow.types';

type Gateway = {
  id: string;
  type: 'xor' | 'and' | 'inclusive';
  bpmnType: string;
};

type RawFlow = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

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

    return this.parseProcess(process, scripts);
  }

  toJson(xml: string, scripts: Record<string, NodeScript>): string {
    return JSON.stringify(this.parse(xml, scripts), null, 2);
  }

  toTypeScript(xml: string, scripts: Record<string, NodeScript>): string {
    const workflow = this.parse(xml, scripts);
    return this.renderTypeScript(workflow, scripts, true);
  }

  toJavaScript(xml: string, scripts: Record<string, NodeScript>): string {
    return this.toTypeScript(xml, scripts)
      .replace(/: Annotation\.State<typeof State>/g, ': any')
      .replace(/: any/g, '')
      .replace(/: Promise<Record<string, unknown>>/g, '')
      .replace(/: Record<string, unknown>/g, '')
      .replace(/: string/g, '');
  }

  toPython(xml: string, scripts: Record<string, NodeScript>): string {
    const workflow = this.parse(xml, scripts);
    return this.renderPython(workflow, scripts);
  }

  defaultScript(elementId: string, elementName: string, language: NodeScript['language']): NodeScript {
    const functionName = this.symbol(elementId || elementName || 'workflow_node');
    return {
      language,
      annotationId: elementId,
      functionName,
      args: 'state',
      body: language === 'python'
        ? 'return {"logs": [f"{state}"]}'
        : `return { logs: ['${functionName} executed'] };`,
    };
  }

  private parseProcess(process: Element, scripts: Record<string, NodeScript>, symbolScope = ''): LangGraphWorkflow {
    const nodes: LangGraphNode[] = [];
    const gateways = new Map<string, Gateway>();
    const rawFlows: RawFlow[] = [];
    const processId = process.getAttribute('id') || 'Process_LangGraph';
    const processName = process.getAttribute('name') || processId;
    const scope = symbolScope || processId;
    const variables = this.extractVariables(process).map((variable) => this.variableSymbol(`${scope}_${variable}`));
    const subgraphs: Record<string, LangGraphWorkflow> = {};

    for (const element of Array.from(process.children)) {
      const id = element.getAttribute('id');
      if (!id || element.localName === 'extensionElements') {
        continue;
      }

      if (element.localName === 'sequenceFlow') {
        rawFlows.push({
          id,
          source: element.getAttribute('sourceRef') || '',
          target: element.getAttribute('targetRef') || '',
          label: element.getAttribute('name') || undefined,
        });
        continue;
      }

      const gatewayType = this.gatewayType(element.localName);
      if (gatewayType) {
        gateways.set(id, {
          id,
          type: gatewayType,
          bpmnType: element.localName,
        });
        continue;
      }

      const kind = this.mapBpmnType(element);
      const name = element.getAttribute('name') || id;
      nodes.push({
        id,
        name,
        bpmnType: element.localName,
        kind,
        functionName: this.symbol(this.scopedId(scope, id)),
        annotationId: scripts[id]?.annotationId || id,
        variables: this.nodeVariables(this.scopedId(scope, id), element),
      });

      if (kind === 'subgraph') {
        subgraphs[id] = this.parseSubgraph(element, scripts);
      }
    }

    const edges = this.normalizeEdges(rawFlows, gateways, nodes);
    const entry = nodes.find((node) => node.kind === 'start')?.id || nodes[0]?.id || null;
    const finish = nodes.filter((node) => node.kind === 'end').map((node) => node.id);

    return {
      id: processId,
      name: processName,
      symbolScope: scope,
      entry,
      finish,
      nodes,
      edges,
      subgraphs,
      variables: Array.from(new Set([...variables, ...nodes.flatMap((node) => node.variables)])),
    };
  }

  private parseSubgraph(element: Element, scripts: Record<string, NodeScript>): LangGraphWorkflow {
    const childFlows = this.elements(element, 'sequenceFlow');
    const childFlowIds = new Set(childFlows.map((flow) => flow.getAttribute('id')));
    const hasEmbeddedFlow = childFlowIds.size > 0;

    if (element.localName === 'subProcess' && hasEmbeddedFlow) {
      const shadowProcess = element.cloneNode(true) as Element;
      return this.parseProcess(shadowProcess, scripts, element.getAttribute('id') || '');
    }

    const id = element.getAttribute('id') || 'SubGraph';
    const name = element.getAttribute('name') || id;
    const nodeId = `${id}_service`;
    return {
      id,
      name,
      symbolScope: id,
      entry: nodeId,
      finish: [nodeId],
      variables: [],
      subgraphs: {},
      nodes: [{
        id: nodeId,
        name: `${name} service`,
        bpmnType: 'serviceTask',
        kind: 'service',
        functionName: this.symbol(this.scopedId(id, nodeId)),
        annotationId: nodeId,
        variables: [this.variableSymbol(this.scopedId(id, nodeId))],
      }],
      edges: [
        { source: 'START', target: nodeId },
        { source: nodeId, target: 'END' },
      ],
    };
  }

  private normalizeEdges(rawFlows: RawFlow[], gateways: Map<string, Gateway>, nodes: LangGraphNode[]): LangGraphEdge[] {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
    const incomingByTarget = this.groupBy(rawFlows, (flow) => flow.target);
    const outgoingBySource = this.groupBy(rawFlows, (flow) => flow.source);
    const result: LangGraphEdge[] = [];

    for (const flow of rawFlows) {
      if (!flow.source || !flow.target) {
        continue;
      }

      const targetGateway = gateways.get(flow.target);
      const sourceGateway = gateways.get(flow.source);

      if (targetGateway) {
        const outgoing = outgoingBySource.get(targetGateway.id) || [];
        for (const next of outgoing) {
          if (!nodeIds.has(next.target)) {
            continue;
          }
          result.push(this.edgeFromGateway(flow.source, next.target, targetGateway, next, nodeOrder));
        }
        continue;
      }

      if (sourceGateway) {
        const incoming = incomingByTarget.get(sourceGateway.id) || [];
        if (incoming.length === 0 && nodeIds.has(flow.target)) {
          result.push(this.edgeFromGateway(sourceGateway.id, flow.target, sourceGateway, flow, nodeOrder));
        }
        continue;
      }

      if (nodeIds.has(flow.source) && nodeIds.has(flow.target)) {
        result.push(this.edgeFromFlow(flow, nodeOrder));
      }
    }

    return this.uniqueEdges(result);
  }

  private edgeFromGateway(source: string, target: string, gateway: Gateway, flow: RawFlow, nodeOrder: Map<string, number>): LangGraphEdge {
    const isConditional = gateway.type !== 'and';
    return {
      source,
      target,
      label: flow.label,
      gatewayId: gateway.id,
      gatewayType: gateway.bpmnType,
      isConditional,
      isLoop: this.isLoop(source, target, nodeOrder),
      condition: isConditional ? this.routeKey(flow) : undefined,
    };
  }

  private edgeFromFlow(flow: RawFlow, nodeOrder: Map<string, number>): LangGraphEdge {
    const loop = this.isLoop(flow.source, flow.target, nodeOrder);
    return {
      source: flow.source,
      target: flow.target,
      label: flow.label,
      isLoop: loop,
      isConditional: loop,
      condition: loop ? this.routeKey(flow) : undefined,
    };
  }

  private renderTypeScript(workflow: LangGraphWorkflow, scripts: Record<string, NodeScript>, includeRun: boolean): string {
    const executableNodes = workflow.nodes.filter((node) => node.kind !== 'start' && node.kind !== 'end');
    const subgraphNodes = executableNodes.filter((node) => node.kind === 'subgraph');
    const taskNodes = executableNodes.filter((node) => node.kind !== 'subgraph');
    const normalEdges = workflow.edges.filter((edge) => !edge.isConditional);
    const conditionalSources = this.conditionalSources(workflow);

    return [
      `import { START, END, StateGraph, Annotation } from "@langchain/langgraph";`,
      '',
      `// 1. STATE (Variables -> Annotation)`,
      this.renderTsState(workflow),
      '',
      `// 2. NODES (BPMN tasks/events -> LangGraph nodes)`,
      ...taskNodes.map((node) => this.renderTsFunction(node, scripts[node.id])),
      ...subgraphNodes.map((node) => this.renderTsSubgraph(node, workflow.subgraphs[node.id], scripts)),
      ...conditionalSources.map((source) => this.renderTsRouteFunction(source, workflow)),
      `// 3. MAIN GRAPH`,
      `const graph = new StateGraph(State)`,
      ...executableNodes.map((node) => `  .addNode("${node.id}", ${node.kind === 'subgraph' ? this.subgraphCompiledSymbol(node.id) : node.functionName})`),
      ...normalEdges.map((edge) => `  .addEdge(${this.tsEndpoint(edge.source, workflow)}, ${this.tsEndpoint(edge.target, workflow)})`),
      ...conditionalSources.map((source) => this.renderTsConditionalEdge(source, workflow)),
      `  .compile();`,
      '',
      `export default graph;`,
      includeRun ? this.renderTsRunBlock() : '',
    ].join('\n');
  }

  private renderPython(workflow: LangGraphWorkflow, scripts: Record<string, NodeScript>): string {
    const executableNodes = workflow.nodes.filter((node) => node.kind !== 'start' && node.kind !== 'end');
    const subgraphNodes = executableNodes.filter((node) => node.kind === 'subgraph');
    const taskNodes = executableNodes.filter((node) => node.kind !== 'subgraph');
    const normalEdges = workflow.edges.filter((edge) => !edge.isConditional);
    const conditionalSources = this.conditionalSources(workflow);

    return [
      `from typing import TypedDict`,
      `from langgraph.graph import StateGraph, START, END`,
      '',
      `class State(TypedDict):`,
      ...this.stateVariables(workflow).map((variable) => `    ${this.symbol(variable)}: object`),
      '',
      ...taskNodes.map((node) => this.renderPyFunction(node, scripts[node.id])),
      ...subgraphNodes.map((node) => this.renderPySubgraph(node, workflow.subgraphs[node.id], scripts)),
      ...conditionalSources.map((source) => this.renderPyRouteFunction(source, workflow)),
      `graph_builder = StateGraph(State)`,
      ...executableNodes.map((node) => `graph_builder.add_node("${node.id}", ${node.kind === 'subgraph' ? this.pySubgraphCompiledSymbol(node.id) : node.functionName})`),
      ...normalEdges.map((edge) => `graph_builder.add_edge(${this.pyEndpoint(edge.source, workflow)}, ${this.pyEndpoint(edge.target, workflow)})`),
      ...conditionalSources.map((source) => this.renderPyConditionalEdge(source, workflow)),
      '',
      `graph = graph_builder.compile()`,
      '',
    ].join('\n');
  }

  private renderTsState(workflow: LangGraphWorkflow): string {
    const variables = this.stateVariables(workflow);
    return [
      `const State = Annotation.Root({`,
      ...variables.map((variable) => this.tsAnnotation(variable)),
      `});`,
    ].join('\n');
  }

  private renderTsFunction(node: LangGraphNode, script?: NodeScript): string {
    const body = (script?.body || this.defaultTsBody(node)).trim();
    return [
      `// ${this.nodeComment(node)}`,
      `const ${node.functionName} = async (state: Annotation.State<typeof State>): Promise<Record<string, unknown>> => {`,
      this.indent(body, 2),
      `};`,
      '',
    ].join('\n');
  }

  private renderPyFunction(node: LangGraphNode, script?: NodeScript): string {
    const body = (script?.body || this.defaultPyBody(node)).trim();
    return [
      `# ${this.nodeComment(node)}`,
      `async def ${node.functionName}(state):`,
      this.indent(body, 4),
      '',
    ].join('\n');
  }

  private renderTsSubgraph(node: LangGraphNode, subgraph: LangGraphWorkflow | undefined, scripts: Record<string, NodeScript>): string {
    const graph = subgraph || this.parseSubgraphFallback(node);
    const executableNodes = graph.nodes.filter((item) => item.kind !== 'start' && item.kind !== 'end');
    const normalEdges = graph.edges.filter((edge) => !edge.isConditional);

    return [
      `// SubProcess / CallActivity -> compiled subgraph`,
      ...executableNodes.map((item) => this.renderTsFunction(item, scripts[item.id])),
      ...this.conditionalSources(graph).map((source) => this.renderTsRouteFunction(source, graph)),
      `const ${this.subgraphGraphSymbol(node.id)} = new StateGraph(State)`,
      ...executableNodes.map((item) => `  .addNode("${item.id}", ${item.functionName})`),
      ...normalEdges.map((edge) => `  .addEdge(${this.tsEndpoint(edge.source, graph)}, ${this.tsEndpoint(edge.target, graph)})`),
      ...this.conditionalSources(graph).map((source) => this.renderTsConditionalEdge(source, graph)),
      `  .compile();`,
      `const ${this.subgraphCompiledSymbol(node.id)} = ${this.subgraphGraphSymbol(node.id)};`,
      '',
    ].join('\n');
  }

  private renderPySubgraph(node: LangGraphNode, subgraph: LangGraphWorkflow | undefined, scripts: Record<string, NodeScript>): string {
    const graph = subgraph || this.parseSubgraphFallback(node);
    const executableNodes = graph.nodes.filter((item) => item.kind !== 'start' && item.kind !== 'end');
    const normalEdges = graph.edges.filter((edge) => !edge.isConditional);
    return [
      `# SubProcess / CallActivity -> compiled subgraph`,
      `${this.pySubgraphBuilderSymbol(node.id)} = StateGraph(State)`,
      ...executableNodes.map((item) => {
        const script = scripts[item.id];
        return [
          `async def ${item.functionName}(state):`,
          this.indent(script?.body || this.defaultPyBody(item), 4),
          `${this.pySubgraphBuilderSymbol(node.id)}.add_node("${item.id}", ${item.functionName})`,
        ].join('\n');
      }),
      ...this.conditionalSources(graph).map((source) => this.renderPyRouteFunction(source, graph)),
      ...normalEdges.map((edge) => `${this.pySubgraphBuilderSymbol(node.id)}.add_edge(${this.pyEndpoint(edge.source, graph)}, ${this.pyEndpoint(edge.target, graph)})`),
      ...this.conditionalSources(graph).map((source) => this.renderPyConditionalEdgeForBuilder(source, graph, this.pySubgraphBuilderSymbol(node.id))),
      `${this.pySubgraphCompiledSymbol(node.id)} = ${this.pySubgraphBuilderSymbol(node.id)}.compile()`,
      '',
    ].join('\n');
  }

  private renderTsRouteFunction(source: string, workflow: LangGraphWorkflow): string {
    const firstRoute = this.routeKey(workflow.edges.find((edge) => edge.source === source && edge.isConditional));
    return [
      `// XOR Gateway / Loop -> addConditionalEdges`,
      `const ${this.routeSymbol(workflow.symbolScope, source)} = (state: Annotation.State<typeof State>): string => {`,
      `  return "${firstRoute}";`,
      `};`,
      '',
    ].join('\n');
  }

  private renderTsConditionalEdge(source: string, workflow: LangGraphWorkflow): string {
    const routes = workflow.edges.filter((edge) => edge.source === source && edge.isConditional);
    if (routes.length === 1 && routes[0].isLoop) {
      return `  .addConditionalEdges("${source}", ${this.routeSymbol(workflow.symbolScope, source)}, { "${this.routeKey(routes[0])}": ${this.tsEndpoint(routes[0].target, workflow)}, "end": END })`;
    }
    return `  .addConditionalEdges("${source}", ${this.routeSymbol(workflow.symbolScope, source)}, ${this.renderTsRouteMap(routes, workflow)})`;
  }

  private renderPyRouteFunction(source: string, workflow: LangGraphWorkflow): string {
    const firstRoute = this.routeKey(workflow.edges.find((edge) => edge.source === source && edge.isConditional));
    return [
      `def ${this.routeSymbol(workflow.symbolScope, source)}(state):`,
      `    return "${firstRoute}"`,
      '',
    ].join('\n');
  }

  private renderPyConditionalEdge(source: string, workflow: LangGraphWorkflow): string {
    const routes = workflow.edges.filter((edge) => edge.source === source && edge.isConditional);
    if (routes.length === 1 && routes[0].isLoop) {
      return `graph_builder.add_conditional_edges("${source}", ${this.routeSymbol(workflow.symbolScope, source)}, {"${this.routeKey(routes[0])}": ${this.pyEndpoint(routes[0].target, workflow)}, "end": END})`;
    }
    return `graph_builder.add_conditional_edges("${source}", ${this.routeSymbol(workflow.symbolScope, source)}, ${this.renderPyRouteMap(routes, workflow)})`;
  }

  private renderPyConditionalEdgeForBuilder(source: string, workflow: LangGraphWorkflow, builderName: string): string {
    const routes = workflow.edges.filter((edge) => edge.source === source && edge.isConditional);
    return `${builderName}.add_conditional_edges("${source}", ${this.routeSymbol(workflow.symbolScope, source)}, ${this.renderPyRouteMap(routes, workflow)})`;
  }

  private renderTsRouteMap(routes: LangGraphEdge[], workflow: LangGraphWorkflow): string {
    const entries = routes.map((edge) => `"${this.routeKey(edge)}": ${this.tsEndpoint(edge.target, workflow)}`);
    return `{ ${entries.join(', ')} }`;
  }

  private renderPyRouteMap(routes: LangGraphEdge[], workflow: LangGraphWorkflow): string {
    const entries = routes.map((edge) => `"${this.routeKey(edge)}": ${this.pyEndpoint(edge.target, workflow)}`);
    return `{${entries.join(', ')}}`;
  }

  private renderTsRunBlock(): string {
    return [
      '',
      `// 4. RUN`,
      `(async () => {`,
      `  const result = await graph.invoke({ in: "start workflow" });`,
      `  console.log(result);`,
      `})();`,
    ].join('\n');
  }

  private conditionalSources(workflow: LangGraphWorkflow): string[] {
    return Array.from(new Set(workflow.edges.filter((edge) => edge.isConditional).map((edge) => edge.source)));
  }

  private stateVariables(workflow: LangGraphWorkflow): string[] {
    void workflow;
    return ['in', 'out', 'message', 'logs'];
  }

  private tsAnnotation(variable: string): string {
    if (variable === 'in') {
      return `  in: Annotation<any>(),`;
    }
    if (variable === 'out') {
      return `  out: Annotation<any>(),`;
    }
    if (variable === 'message') {
      return `  message: Annotation<any>(),`;
    }
    if (variable === 'logs') {
      return `  logs: Annotation<string[]>({ reducer: (a, b) => a.concat(Array.isArray(b) ? b : [b]), default: () => [] }),`;
    }
    return `  ${this.symbol(variable)}: Annotation<any>(),`;
  }

  private nodeComment(node: LangGraphNode): string {
    switch (node.kind) {
      case 'service':
        return 'ServiceTask -> addNode(fn)';
      case 'script':
        return 'ScriptTask -> addNode(fn)';
      case 'user':
        return 'UserTask -> async human wait node';
      case 'send':
        return 'SendTask -> API node';
      case 'receive':
        return 'ReceiveTask -> event node';
      case 'timer':
        return 'Timer -> delay node';
      case 'subgraph':
        return 'SubProcess / CallActivity -> subgraph';
      default:
        return `${node.bpmnType} -> addNode(fn)`;
    }
  }

  private defaultTsBody(node: LangGraphNode): string {
    switch (node.kind) {
      case 'user':
        return `return { out: { approved: true }, logs: ["UserTask: approval received"] };`;
      case 'send':
        return `return { message: { sent: true }, logs: ["SendTask: API call sent"] };`;
      case 'receive':
        return `return { message: { received: true }, logs: ["ReceiveTask: event received"] };`;
      case 'timer':
        return `await new Promise((resolve) => setTimeout(resolve, 1000));\nreturn { logs: ["Timer: delay completed"] };`;
      case 'script':
        return `return { logs: ["ScriptTask: transformed input"] };`;
      case 'service':
        return `return { logs: ["ServiceTask: backend call"] };`;
      default:
        return `return { logs: ["${node.name} executed"] };`;
    }
  }

  private defaultPyBody(node: LangGraphNode): string {
    if (node.kind === 'timer') {
      return `return {"logs": ["Timer: delay completed"]}`;
    }
    if (node.kind === 'user') {
      return `return {"out": {"approved": True}, "logs": ["UserTask: approval received"]}`;
    }
    if (node.kind === 'send') {
      return `return {"message": {"sent": True}, "logs": ["SendTask: API call sent"]}`;
    }
    if (node.kind === 'receive') {
      return `return {"message": {"received": True}, "logs": ["ReceiveTask: event received"]}`;
    }
    return `return {"logs": ["${node.name} executed"]}`;
  }

  private mapBpmnType(element: Element): LangGraphNodeKind {
    if (this.isTimer(element)) {
      return 'timer';
    }

    switch (element.localName) {
      case 'startEvent':
        return 'start';
      case 'endEvent':
        return 'end';
      case 'serviceTask':
        return 'service';
      case 'scriptTask':
        return 'script';
      case 'userTask':
      case 'manualTask':
        return 'user';
      case 'sendTask':
        return 'send';
      case 'receiveTask':
        return 'receive';
      case 'callActivity':
      case 'subProcess':
        return 'subgraph';
      case 'intermediateCatchEvent':
      case 'boundaryEvent':
        return this.isTimer(element) ? 'timer' : 'receive';
      default:
        return 'task';
    }
  }

  private gatewayType(type: string): Gateway['type'] | null {
    switch (type) {
      case 'exclusiveGateway':
        return 'xor';
      case 'parallelGateway':
        return 'and';
      case 'inclusiveGateway':
        return 'inclusive';
      default:
        return null;
    }
  }

  private nodeVariables(nodeId: string, element: Element): string[] {
    return Array.from(new Set([
      this.variableSymbol(nodeId),
      ...this.extractVariables(element).map((variable) => this.variableSymbol(`${nodeId}_${variable}`)),
    ]));
  }

  private extractVariables(element: Element): string[] {
    const variables = new Set<string>();
    for (const attr of Array.from(element.attributes)) {
      if (/variable|result|input|output/i.test(attr.name) && attr.value) {
        variables.add(this.symbol(attr.value));
      }
    }
    for (const child of Array.from(element.getElementsByTagNameNS('*', '*'))) {
      const name = child.getAttribute('name');
      if (name && /variable|result|input|output/i.test(child.localName)) {
        variables.add(this.symbol(name));
      }
    }
    return Array.from(variables).filter(Boolean);
  }

  private isTimer(element: Element): boolean {
    return this.elements(element, 'timerEventDefinition').length > 0;
  }

  private parseSubgraphFallback(node: LangGraphNode): LangGraphWorkflow {
    const serviceNode: LangGraphNode = {
      id: `${node.id}_service`,
      name: `${node.name} service`,
      bpmnType: 'serviceTask',
      kind: 'service',
      functionName: this.symbol(this.scopedId(node.id, `${node.id}_service`)),
      annotationId: `${node.id}_service`,
      variables: [this.variableSymbol(this.scopedId(node.id, `${node.id}_service`))],
    };
    return {
      id: node.id,
      name: node.name,
      symbolScope: node.id,
      entry: serviceNode.id,
      finish: [serviceNode.id],
      nodes: [serviceNode],
      edges: [
        { source: 'START', target: serviceNode.id },
        { source: serviceNode.id, target: 'END' },
      ],
      subgraphs: {},
      variables: [],
    };
  }

  private tsEndpoint(id: string, workflow: LangGraphWorkflow): string {
    const node = workflow.nodes.find((item) => item.id === id);
    if (id === 'START' || node?.kind === 'start') {
      return 'START';
    }
    if (id === 'END' || node?.kind === 'end') {
      return 'END';
    }
    return `"${id}"`;
  }

  private pyEndpoint(id: string, workflow: LangGraphWorkflow): string {
    const endpoint = this.tsEndpoint(id, workflow);
    return endpoint.startsWith('"') ? endpoint : endpoint;
  }

  private routeKey(edge?: LangGraphEdge | RawFlow): string {
    return this.toFunctionName(edge?.label || edge?.target || 'next');
  }

  private scopedId(scope: string, id: string): string {
    return scope ? `${scope}_${id}` : id;
  }

  private routeSymbol(scope: string, source: string): string {
    return this.symbol(`route_${this.scopedId(scope, source)}`);
  }

  private variableSymbol(id: string): string {
    return this.symbol(`var_${id}`);
  }

  private subgraphGraphSymbol(id: string): string {
    return this.symbol(`${id}Graph`);
  }

  private subgraphCompiledSymbol(id: string): string {
    return this.symbol(`${id}Compiled`);
  }

  private pySubgraphBuilderSymbol(id: string): string {
    return this.symbol(`${id}_builder`);
  }

  private pySubgraphCompiledSymbol(id: string): string {
    return this.symbol(`${id}_compiled`);
  }

  private isLoop(source: string, target: string, nodeOrder: Map<string, number>): boolean {
    const sourceIndex = nodeOrder.get(source);
    const targetIndex = nodeOrder.get(target);
    return sourceIndex !== undefined && targetIndex !== undefined && targetIndex <= sourceIndex;
  }

  private uniqueEdges(edges: LangGraphEdge[]): LangGraphEdge[] {
    const seen = new Set<string>();
    return edges.filter((edge) => {
      const key = `${edge.source}|${edge.target}|${edge.condition || ''}|${edge.gatewayId || ''}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    for (const item of items) {
      const groupKey = key(item);
      grouped.set(groupKey, [...(grouped.get(groupKey) || []), item]);
    }
    return grouped;
  }

  private elements(parent: Document | Element, localName: string): Element[] {
    const list = Array.from(parent.getElementsByTagNameNS('*', localName));
    if (list.length) {
      return list;
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

  private symbol(value: string): string {
    const name = value
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');
    const safeName = name || 'workflow_node';
    return /^[0-9]/.test(safeName) ? `node_${safeName}` : safeName;
  }

  private indent(value: string, size: number): string {
    const prefix = ' '.repeat(size);
    return value.split('\n').map((line) => `${prefix}${line}`).join('\n');
  }
}
