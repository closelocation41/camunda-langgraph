# Camunda LangGraph Workflow Studio - Developer Product Guide

This document explains how developers can use the product to design agentic AI workflows visually, store the workflow as BPMN XML, and generate LangGraph workflow code in different programming languages. Keep this file updated as the product changes.

## Product Purpose

Camunda LangGraph Workflow Studio is a visual workflow design tool for agentic AI systems.

Developers can model workflow behavior with a Camunda BPMN modeler, enrich BPMN elements with annotations and node metadata, and generate LangGraph workflow code without writing the full graph manually.

The product is designed around one important idea:

The BPMN XML file is the source of truth for the workflow.

Developers can store XML files in a folder, import them later, visualize the workflow again, edit the design, and regenerate LangGraph code when needed.

## Main Use Cases

- Design agentic AI workflows visually instead of starting from code.
- Convert BPMN workflows into LangGraph code.
- Generate LangGraph workflow output in TypeScript, JavaScript, Python, JSON, or XML.
- Store workflow definitions as BPMN XML files for reuse.
- Import saved XML files later and continue editing the visual workflow.
- Use BPMN annotations and element metadata to connect visual workflow nodes with generated LangGraph node functions.
- Prepare for future LLM-assisted workflow creation through the Workflow Chat panel.

## Workflow Design Section

The Workflow Design section contains the Camunda BPMN modeler.

Developers use this area to create the visual workflow:

- Start events define workflow entry points.
- End events define workflow completion points.
- Service tasks represent backend calls, API calls, tool calls, or model/service execution.
- Script tasks represent transformation or custom logic nodes.
- User tasks represent human approval, review, or manual interaction.
- Send tasks represent outbound notification or API send actions.
- Receive tasks represent waiting for callbacks, events, or webhook responses.
- Timer events represent delay, retry, timeout, or scheduled wait behavior.
- Exclusive gateways represent conditional routing.
- Parallel gateways represent parallel workflow branches.
- Sub-processes and call activities represent nested workflows or reusable subgraphs.

The maximize button lets developers expand the BPMN modeler when they need more design space. The same control can minimize the designer back into the normal studio layout.

## Properties Section

The Properties section is used to inspect and edit selected BPMN elements.

When a developer selects a BPMN shape, the studio shows element-level metadata such as:

- Annotation ID
- Element name
- BPMN type
- Node function language
- Node function name
- Node function arguments
- Node function body
- Camunda properties

The Annotation ID connects the visual BPMN element to the generated LangGraph node metadata.

Developers can collapse the Properties section when they want more room for workflow design or generated code. They can expand it again when they need to edit node details.

## Coding Section

The Coding section generates LangGraph workflow output from the current BPMN XML and node metadata.

Supported output formats:

- TypeScript
- JavaScript
- Python
- JSON
- XML

Developers can switch the output language and use Convert to regenerate the workflow output.

The generated code maps BPMN concepts into LangGraph concepts:

- BPMN tasks become LangGraph nodes.
- BPMN sequence flows become graph edges.
- Conditional gateways become conditional edges.
- Parallel gateways become multiple graph paths.
- Timer events become delay-style nodes.
- Sub-processes and call activities become subgraph structures.
- BPMN process variables become LangGraph state annotations.

The copy icon in the Coding header copies the generated code to the clipboard and shows a Copied message.

The Coding section can also be collapsed when developers want more visual design space.

## Workflow Chat Section

The Workflow Chat section is currently a design placeholder for future LLM and agentic workflow creation.

Future usage goal:

- A developer describes the desired workflow in chat.
- An LLM or agentic assistant interprets the request.
- The assistant proposes or creates BPMN workflow structure.
- The generated workflow can be reviewed visually in the BPMN modeler.
- The developer can export the final BPMN XML and generate LangGraph code.

Current behavior:

- The chat panel is visual only.
- It does not call an LLM yet.
- It can maximize vertically to provide more conversation space.
- Width remains fixed within the center column.

## XML As The Workflow Source

Developers should store BPMN XML files as the durable workflow definition.

Recommended product flow:

1. Design the workflow visually.
2. Edit BPMN element names, annotations, and node metadata.
3. Export the BPMN XML.
4. Store the XML file in a workflow folder.
5. Import the XML later when the workflow needs to be reviewed or changed.
6. Regenerate LangGraph code from the imported XML.

The XML file allows the workflow to be recreated visually in the studio without depending only on generated code.

## Suggested Folder Usage

The product is intended to support a workflow repository pattern where XML files are stored by domain, team, or product feature.

Example structure:

```text
workflows/
  customer-support/
    ticket-triage.bpmn
    escalation-review.bpmn
  finance/
    invoice-approval.bpmn
    payment-risk-check.bpmn
  operations/
    incident-response.bpmn
```

Each XML file can be imported into the studio, visualized, edited, and converted into LangGraph code again.

## Annotation And Metadata Strategy

Use clear IDs and names for BPMN elements because they influence generated workflow readability.

Recommended examples:

```text
ServiceTask_CheckEligibility
ScriptTask_PrepareInput
UserTask_ManagerApproval
Gateway_ApprovalDecision
SendTask_NotifyCustomer
ReceiveTask_WaitForWebhook
TimerEvent_RetryDelay
```

Good annotations make the generated LangGraph code easier to read and maintain.

Use the Properties section to keep node function names aligned with the workflow intent. For example:

```text
check_customer_eligibility
prepare_invoice_payload
wait_for_manager_approval
send_customer_notification
```

## Product Examples

Approval workflow:

- Start request
- Prepare payload
- Check eligibility
- Human approval
- Approved or retry decision
- Send notification
- Wait for callback
- Complete workflow

Customer support workflow:

- Receive ticket
- Classify intent
- Retrieve customer context
- Route to agent or automated answer
- Escalate when confidence is low
- Send final response

Agentic research workflow:

- Receive research question
- Plan research steps
- Search internal knowledge
- Call external tools
- Summarize findings
- Ask for human review
- Produce final answer

Data enrichment workflow:

- Receive record
- Validate fields
- Call enrichment service
- Score confidence
- Branch on quality
- Store enriched result
- Send audit event

## Developer Responsibilities

When using the product, developers should:

- Treat BPMN XML as the canonical workflow artifact.
- Keep BPMN element names meaningful.
- Use annotations consistently.
- Review generated code before using it in production.
- Store XML files in a predictable folder structure.
- Regenerate code when workflow XML changes.
- Update this guide when product behavior changes.

## Current Limitations

- Workflow Chat is visual only and does not call an LLM yet.
- Generated node function bodies are starter code and may need business logic.
- XML is the best long-term storage artifact; generated code should be treated as output derived from XML.
- Runtime deployment behavior is outside the current studio scope.

## Future Product Direction

Planned product direction can include:

- LLM-assisted workflow creation from chat prompts.
- Agentic editing of BPMN XML.
- Workflow templates for common agentic AI patterns.
- Validation rules for BPMN-to-LangGraph compatibility.
- Versioned workflow XML library.
- Direct connection between chat instructions and visual workflow updates.
- Import workflow from a folder library and preview it visually.

