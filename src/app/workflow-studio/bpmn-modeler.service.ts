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
  <bpmn:message id="Message_Callback" name="Callback received" />
  <bpmn:process id="Process_LangGraph_Sample" name="Developer approval and enrichment workflow" isExecutable="true">
    <bpmn:extensionElements>
      <camunda:properties>
        <camunda:property name="in" value="request" />
        <camunda:property name="out" value="approvalResult" />
        <camunda:property name="message" value="callbackPayload" />
        <camunda:property name="logs" value="string[]" />
      </camunda:properties>
    </bpmn:extensionElements>

    <bpmn:startEvent id="StartEvent_Request" name="Start request">
      <bpmn:outgoing>Flow_Start_To_Prepare</bpmn:outgoing>
    </bpmn:startEvent>

    <bpmn:scriptTask id="ScriptTask_PrepareInput" name="Prepare input" camunda:resultVariable="preparedPayload">
      <bpmn:incoming>Flow_Start_To_Prepare</bpmn:incoming>
      <bpmn:outgoing>Flow_Prepare_To_Service</bpmn:outgoing>
      <bpmn:script>return input;</bpmn:script>
    </bpmn:scriptTask>

    <bpmn:serviceTask id="ServiceTask_BackendCheck" name="Backend eligibility check" camunda:topic="eligibility" camunda:resultVariable="eligibilityResult">
      <bpmn:incoming>Flow_Prepare_To_Service</bpmn:incoming>
      <bpmn:outgoing>Flow_Service_To_User</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:userTask id="UserTask_Approval" name="Human approval" camunda:assignee="developer">
      <bpmn:incoming>Flow_Service_To_User</bpmn:incoming>
      <bpmn:incoming>Flow_Timer_To_User</bpmn:incoming>
      <bpmn:outgoing>Flow_User_To_Xor</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:exclusiveGateway id="Gateway_ApprovalDecision" name="Approved?">
      <bpmn:incoming>Flow_User_To_Xor</bpmn:incoming>
      <bpmn:outgoing>Flow_Xor_To_Send</bpmn:outgoing>
      <bpmn:outgoing>Flow_Xor_To_Timer</bpmn:outgoing>
    </bpmn:exclusiveGateway>

    <bpmn:sendTask id="SendTask_Notify" name="Send approval notification" camunda:topic="notify-api">
      <bpmn:incoming>Flow_Xor_To_Send</bpmn:incoming>
      <bpmn:outgoing>Flow_Send_To_Receive</bpmn:outgoing>
    </bpmn:sendTask>

    <bpmn:receiveTask id="ReceiveTask_Callback" name="Wait for webhook callback" camunda:messageRef="Message_Callback">
      <bpmn:incoming>Flow_Send_To_Receive</bpmn:incoming>
      <bpmn:outgoing>Flow_Receive_To_AndSplit</bpmn:outgoing>
    </bpmn:receiveTask>

    <bpmn:intermediateCatchEvent id="TimerEvent_RetryDelay" name="Retry after delay">
      <bpmn:incoming>Flow_Xor_To_Timer</bpmn:incoming>
      <bpmn:outgoing>Flow_Timer_To_User</bpmn:outgoing>
      <bpmn:timerEventDefinition id="TimerDefinition_Retry">
        <bpmn:timeDuration>PT1M</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
    </bpmn:intermediateCatchEvent>

    <bpmn:parallelGateway id="Gateway_ParallelSplit" name="Run enrichment and audit">
      <bpmn:incoming>Flow_Receive_To_AndSplit</bpmn:incoming>
      <bpmn:outgoing>Flow_And_To_Index</bpmn:outgoing>
      <bpmn:outgoing>Flow_And_To_Audit</bpmn:outgoing>
    </bpmn:parallelGateway>

    <bpmn:serviceTask id="ServiceTask_IndexRecord" name="Index record" camunda:topic="index-api">
      <bpmn:incoming>Flow_And_To_Index</bpmn:incoming>
      <bpmn:outgoing>Flow_Index_To_Join</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:scriptTask id="ScriptTask_AuditLog" name="Build audit log" camunda:resultVariable="auditEntry">
      <bpmn:incoming>Flow_And_To_Audit</bpmn:incoming>
      <bpmn:outgoing>Flow_Audit_To_Join</bpmn:outgoing>
      <bpmn:script>return logs;</bpmn:script>
    </bpmn:scriptTask>

    <bpmn:parallelGateway id="Gateway_ParallelJoin" name="Join parallel work">
      <bpmn:incoming>Flow_Index_To_Join</bpmn:incoming>
      <bpmn:incoming>Flow_Audit_To_Join</bpmn:incoming>
      <bpmn:outgoing>Flow_Join_To_SubProcess</bpmn:outgoing>
    </bpmn:parallelGateway>

    <bpmn:subProcess id="SubProcess_Enrichment" name="Embedded enrichment subgraph">
      <bpmn:incoming>Flow_Join_To_SubProcess</bpmn:incoming>
      <bpmn:outgoing>Flow_SubProcess_To_CallActivity</bpmn:outgoing>
      <bpmn:startEvent id="SubStart_Enrichment" name="Sub start">
        <bpmn:outgoing>SubFlow_Start_To_Service</bpmn:outgoing>
      </bpmn:startEvent>
      <bpmn:serviceTask id="SubService_FetchContext" name="Fetch context" camunda:topic="context-api">
        <bpmn:incoming>SubFlow_Start_To_Service</bpmn:incoming>
        <bpmn:outgoing>SubFlow_Service_To_Script</bpmn:outgoing>
      </bpmn:serviceTask>
      <bpmn:scriptTask id="SubScript_ScoreContext" name="Score context" camunda:resultVariable="contextScore">
        <bpmn:incoming>SubFlow_Service_To_Script</bpmn:incoming>
        <bpmn:outgoing>SubFlow_Script_To_End</bpmn:outgoing>
        <bpmn:script>return contextScore;</bpmn:script>
      </bpmn:scriptTask>
      <bpmn:endEvent id="SubEnd_Enrichment" name="Sub done">
        <bpmn:incoming>SubFlow_Script_To_End</bpmn:incoming>
      </bpmn:endEvent>
      <bpmn:sequenceFlow id="SubFlow_Start_To_Service" sourceRef="SubStart_Enrichment" targetRef="SubService_FetchContext" />
      <bpmn:sequenceFlow id="SubFlow_Service_To_Script" sourceRef="SubService_FetchContext" targetRef="SubScript_ScoreContext" />
      <bpmn:sequenceFlow id="SubFlow_Script_To_End" sourceRef="SubScript_ScoreContext" targetRef="SubEnd_Enrichment" />
    </bpmn:subProcess>

    <bpmn:callActivity id="CallActivity_ExternalReview" name="External review subgraph" calledElement="Process_ExternalReview">
      <bpmn:incoming>Flow_SubProcess_To_CallActivity</bpmn:incoming>
      <bpmn:outgoing>Flow_CallActivity_To_End</bpmn:outgoing>
    </bpmn:callActivity>

    <bpmn:endEvent id="EndEvent_Complete" name="Workflow complete">
      <bpmn:incoming>Flow_CallActivity_To_End</bpmn:incoming>
    </bpmn:endEvent>

    <bpmn:sequenceFlow id="Flow_Start_To_Prepare" sourceRef="StartEvent_Request" targetRef="ScriptTask_PrepareInput" />
    <bpmn:sequenceFlow id="Flow_Prepare_To_Service" sourceRef="ScriptTask_PrepareInput" targetRef="ServiceTask_BackendCheck" />
    <bpmn:sequenceFlow id="Flow_Service_To_User" sourceRef="ServiceTask_BackendCheck" targetRef="UserTask_Approval" />
    <bpmn:sequenceFlow id="Flow_User_To_Xor" sourceRef="UserTask_Approval" targetRef="Gateway_ApprovalDecision" />
    <bpmn:sequenceFlow id="Flow_Xor_To_Send" name="approved" sourceRef="Gateway_ApprovalDecision" targetRef="SendTask_Notify" />
    <bpmn:sequenceFlow id="Flow_Xor_To_Timer" name="retry" sourceRef="Gateway_ApprovalDecision" targetRef="TimerEvent_RetryDelay" />
    <bpmn:sequenceFlow id="Flow_Timer_To_User" name="retry_again" sourceRef="TimerEvent_RetryDelay" targetRef="UserTask_Approval" />
    <bpmn:sequenceFlow id="Flow_Send_To_Receive" sourceRef="SendTask_Notify" targetRef="ReceiveTask_Callback" />
    <bpmn:sequenceFlow id="Flow_Receive_To_AndSplit" sourceRef="ReceiveTask_Callback" targetRef="Gateway_ParallelSplit" />
    <bpmn:sequenceFlow id="Flow_And_To_Index" sourceRef="Gateway_ParallelSplit" targetRef="ServiceTask_IndexRecord" />
    <bpmn:sequenceFlow id="Flow_And_To_Audit" sourceRef="Gateway_ParallelSplit" targetRef="ScriptTask_AuditLog" />
    <bpmn:sequenceFlow id="Flow_Index_To_Join" sourceRef="ServiceTask_IndexRecord" targetRef="Gateway_ParallelJoin" />
    <bpmn:sequenceFlow id="Flow_Audit_To_Join" sourceRef="ScriptTask_AuditLog" targetRef="Gateway_ParallelJoin" />
    <bpmn:sequenceFlow id="Flow_Join_To_SubProcess" sourceRef="Gateway_ParallelJoin" targetRef="SubProcess_Enrichment" />
    <bpmn:sequenceFlow id="Flow_SubProcess_To_CallActivity" sourceRef="SubProcess_Enrichment" targetRef="CallActivity_ExternalReview" />
    <bpmn:sequenceFlow id="Flow_CallActivity_To_End" sourceRef="CallActivity_ExternalReview" targetRef="EndEvent_Complete" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_LangGraph_Sample">
      <bpmndi:BPMNShape id="StartEvent_Request_di" bpmnElement="StartEvent_Request">
        <dc:Bounds x="130" y="210" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ScriptTask_PrepareInput_di" bpmnElement="ScriptTask_PrepareInput">
        <dc:Bounds x="220" y="188" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ServiceTask_BackendCheck_di" bpmnElement="ServiceTask_BackendCheck">
        <dc:Bounds x="400" y="188" width="150" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="UserTask_Approval_di" bpmnElement="UserTask_Approval">
        <dc:Bounds x="610" y="188" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_ApprovalDecision_di" bpmnElement="Gateway_ApprovalDecision" isMarkerVisible="true">
        <dc:Bounds x="800" y="203" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SendTask_Notify_di" bpmnElement="SendTask_Notify">
        <dc:Bounds x="920" y="188" width="145" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ReceiveTask_Callback_di" bpmnElement="ReceiveTask_Callback">
        <dc:Bounds x="1125" y="188" width="150" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="TimerEvent_RetryDelay_di" bpmnElement="TimerEvent_RetryDelay">
        <dc:Bounds x="807" y="360" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_ParallelSplit_di" bpmnElement="Gateway_ParallelSplit">
        <dc:Bounds x="1335" y="203" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ServiceTask_IndexRecord_di" bpmnElement="ServiceTask_IndexRecord">
        <dc:Bounds x="1450" y="120" width="135" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ScriptTask_AuditLog_di" bpmnElement="ScriptTask_AuditLog">
        <dc:Bounds x="1450" y="285" width="135" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_ParallelJoin_di" bpmnElement="Gateway_ParallelJoin">
        <dc:Bounds x="1650" y="203" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubProcess_Enrichment_di" bpmnElement="SubProcess_Enrichment" isExpanded="true">
        <dc:Bounds x="1760" y="95" width="430" height="270" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubStart_Enrichment_di" bpmnElement="SubStart_Enrichment">
        <dc:Bounds x="1795" y="212" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubService_FetchContext_di" bpmnElement="SubService_FetchContext">
        <dc:Bounds x="1875" y="190" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubScript_ScoreContext_di" bpmnElement="SubScript_ScoreContext">
        <dc:Bounds x="2030" y="190" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubEnd_Enrichment_di" bpmnElement="SubEnd_Enrichment">
        <dc:Bounds x="2175" y="212" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="CallActivity_ExternalReview_di" bpmnElement="CallActivity_ExternalReview">
        <dc:Bounds x="2255" y="188" width="155" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_Complete_di" bpmnElement="EndEvent_Complete">
        <dc:Bounds x="2475" y="210" width="36" height="36" />
      </bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="Flow_Start_To_Prepare_di" bpmnElement="Flow_Start_To_Prepare">
        <di:waypoint x="166" y="228" />
        <di:waypoint x="220" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Prepare_To_Service_di" bpmnElement="Flow_Prepare_To_Service">
        <di:waypoint x="350" y="228" />
        <di:waypoint x="400" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Service_To_User_di" bpmnElement="Flow_Service_To_User">
        <di:waypoint x="550" y="228" />
        <di:waypoint x="610" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_User_To_Xor_di" bpmnElement="Flow_User_To_Xor">
        <di:waypoint x="740" y="228" />
        <di:waypoint x="800" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Xor_To_Send_di" bpmnElement="Flow_Xor_To_Send">
        <di:waypoint x="850" y="228" />
        <di:waypoint x="920" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Xor_To_Timer_di" bpmnElement="Flow_Xor_To_Timer">
        <di:waypoint x="825" y="253" />
        <di:waypoint x="825" y="360" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Timer_To_User_di" bpmnElement="Flow_Timer_To_User">
        <di:waypoint x="807" y="378" />
        <di:waypoint x="675" y="378" />
        <di:waypoint x="675" y="268" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Send_To_Receive_di" bpmnElement="Flow_Send_To_Receive">
        <di:waypoint x="1065" y="228" />
        <di:waypoint x="1125" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Receive_To_AndSplit_di" bpmnElement="Flow_Receive_To_AndSplit">
        <di:waypoint x="1275" y="228" />
        <di:waypoint x="1335" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_And_To_Index_di" bpmnElement="Flow_And_To_Index">
        <di:waypoint x="1360" y="203" />
        <di:waypoint x="1360" y="160" />
        <di:waypoint x="1450" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_And_To_Audit_di" bpmnElement="Flow_And_To_Audit">
        <di:waypoint x="1360" y="253" />
        <di:waypoint x="1360" y="325" />
        <di:waypoint x="1450" y="325" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Index_To_Join_di" bpmnElement="Flow_Index_To_Join">
        <di:waypoint x="1585" y="160" />
        <di:waypoint x="1675" y="160" />
        <di:waypoint x="1675" y="203" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Audit_To_Join_di" bpmnElement="Flow_Audit_To_Join">
        <di:waypoint x="1585" y="325" />
        <di:waypoint x="1675" y="325" />
        <di:waypoint x="1675" y="253" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Join_To_SubProcess_di" bpmnElement="Flow_Join_To_SubProcess">
        <di:waypoint x="1700" y="228" />
        <di:waypoint x="1760" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="SubFlow_Start_To_Service_di" bpmnElement="SubFlow_Start_To_Service">
        <di:waypoint x="1831" y="230" />
        <di:waypoint x="1875" y="230" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="SubFlow_Service_To_Script_di" bpmnElement="SubFlow_Service_To_Script">
        <di:waypoint x="1995" y="230" />
        <di:waypoint x="2030" y="230" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="SubFlow_Script_To_End_di" bpmnElement="SubFlow_Script_To_End">
        <di:waypoint x="2150" y="230" />
        <di:waypoint x="2175" y="230" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_SubProcess_To_CallActivity_di" bpmnElement="Flow_SubProcess_To_CallActivity">
        <di:waypoint x="2190" y="228" />
        <di:waypoint x="2255" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_CallActivity_To_End_di" bpmnElement="Flow_CallActivity_To_End">
        <di:waypoint x="2410" y="228" />
        <di:waypoint x="2475" y="228" />
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
