import { Injectable } from '@angular/core';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from 'bpmn-js-properties-panel';
import { SelectedElementInfo } from './workflow.types';

export const EMPTY_CAMUNDA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_LangGraph"
                  targetNamespace="http://camunda.org/schema/1.0/bpmn"
                  exporter="camunda-langgraph-workflow"
                  exporterVersion="0.1.0">
  <bpmn:process id="Process_LangGraph" name="LangGraph agent workflow" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="Agent_Research" name="Research Agent" camunda:topic="agent">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:exclusiveGateway id="Gateway_Route" name="Route Result">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="Tool_Search" name="Search Tool" camunda:type="external">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="EndEvent_1" name="Done">
      <bpmn:incoming>Flow_4</bpmn:incoming>
      <bpmn:incoming>Flow_5</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Agent_Research" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Agent_Research" targetRef="Gateway_Route" />
    <bpmn:sequenceFlow id="Flow_3" name="needs_tool" sourceRef="Gateway_Route" targetRef="Tool_Search" />
    <bpmn:sequenceFlow id="Flow_4" name="complete" sourceRef="Gateway_Route" targetRef="EndEvent_1" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Tool_Search" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_LangGraph">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="156" y="172" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Agent_Research_di" bpmnElement="Agent_Research">
        <dc:Bounds x="250" y="150" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Route_di" bpmnElement="Gateway_Route" isMarkerVisible="true">
        <dc:Bounds x="435" y="165" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Tool_Search_di" bpmnElement="Tool_Search">
        <dc:Bounds x="550" y="80" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="742" y="172" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="192" y="190" />
        <di:waypoint x="250" y="190" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="370" y="190" />
        <di:waypoint x="435" y="190" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="460" y="165" />
        <di:waypoint x="460" y="120" />
        <di:waypoint x="550" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="485" y="190" />
        <di:waypoint x="742" y="190" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="670" y="120" />
        <di:waypoint x="760" y="120" />
        <di:waypoint x="760" y="172" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

type EventBus = {
  on(event: string, callback: (event: { newSelection?: Array<{ businessObject?: BpmnBusinessObject }> }) => void): void;
};

type BpmnBusinessObject = {
  id?: string;
  name?: string;
  $type?: string;
};

type Modeling = {
  updateProperties(element: unknown, props: Record<string, unknown>): void;
};

type ElementRegistry = {
  get(id: string): unknown;
};

@Injectable({ providedIn: 'root' })
export class BpmnModelerService {
  private modeler: any | null = null;
  private selectionCallback: ((selection: SelectedElementInfo | null) => void) | null = null;

  async mount(canvas: HTMLElement, propertiesPanel: HTMLElement): Promise<void> {
    this.modeler = new BpmnModeler({
      container: canvas,
      propertiesPanel: {
        parent: propertiesPanel,
      },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
      ],
    });

    const eventBus = this.modeler.get('eventBus') as EventBus;
    eventBus.on('selection.changed', (event) => {
      const businessObject = event.newSelection?.[0]?.businessObject;
      if (!businessObject) {
        this.selectionCallback?.(null);
        return;
      }
      this.selectionCallback?.({
        id: businessObject.id ?? '',
        name: businessObject.name ?? '',
        type: businessObject.$type ?? '',
      });
    });

    await this.importXml(EMPTY_CAMUNDA_XML);
  }

  onSelectionChanged(callback: (selection: SelectedElementInfo | null) => void): void {
    this.selectionCallback = callback;
  }

  async importXml(xml: string): Promise<void> {
    if (!this.modeler) {
      return;
    }
    const result = await this.modeler.importXML(xml);
    if (result.warnings?.length) {
      console.warn('BPMN import warnings', result.warnings);
    }
  }

  async exportXml(): Promise<string> {
    if (!this.modeler) {
      return '';
    }
    const result = await this.modeler.saveXML({ format: true });
    return result.xml ?? '';
  }

  async clear(): Promise<void> {
    await this.importXml(EMPTY_CAMUNDA_XML);
  }

  updateSelectedElement(id: string, props: Record<string, unknown>): void {
    if (!this.modeler || !id) {
      return;
    }

    const registry = this.modeler.get('elementRegistry') as ElementRegistry;
    const element = registry.get(id);
    if (!element) {
      return;
    }

    const modeling = this.modeler.get('modeling') as Modeling;
    modeling.updateProperties(element, props);
  }

  destroy(): void {
    this.modeler?.destroy();
    this.modeler = null;
  }
}
