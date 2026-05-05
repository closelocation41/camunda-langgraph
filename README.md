# Camunda LangGraph Workflow Studio

Angular BPMN modeler for designing Camunda-compatible workflow XML and converting it into LangGraph workflow output for agentic AI systems.

Developers can visually design BPMN workflows, edit annotations and node metadata, export BPMN XML, import saved XML later, and generate LangGraph code in TypeScript, JavaScript, Python, JSON, or XML.

For product usage details, see [docs/DEVELOPER_PRODUCT_GUIDE.md](docs/DEVELOPER_PRODUCT_GUIDE.md).

## Requirements

Use current LTS tooling for local development:

- Node.js 20 LTS or newer
- npm 10 or newer
- Angular CLI 19, installed globally or run through npm scripts
- Docker, only if building or running the container image

The project uses Angular 19, Angular Material 19, BPMN JS, BPMN JS Properties Panel, and Highlight.js.

## Local Setup

Install dependencies:

```bash
npm install
```

Start the local Angular development server:

```bash
npm start
```

Open:

```text
http://localhost:4200/
```

The development server reloads when source files change.

## Common Commands

Build the production bundle:

```bash
npm run build
```

Run Angular tests:

```bash
npm test
```

Run the Angular build in watch mode:

```bash
npm run watch
```

## Docker

The included Dockerfile builds the Angular app and serves the compiled static files with Nginx.

Build the image:

```bash
docker build -t camunda-langgraph-workflow .
```

Run the container locally:

```bash
docker run --rm -p 8080:80 camunda-langgraph-workflow
```

Open:

```text
http://localhost:8080/
```

## Docker Cloud Or Registry Usage

Tag the image for a registry:

```bash
docker tag camunda-langgraph-workflow your-registry/camunda-langgraph-workflow:latest
```

Push the image:

```bash
docker push your-registry/camunda-langgraph-workflow:latest
```

Replace `your-registry` with Docker Hub, Docker Cloud, or the private registry used by the team.

## Workflow File Strategy

The recommended product workflow is to store exported BPMN XML files in a workflow folder and import them later when a workflow needs to be viewed or changed.

Example:

```text
workflows/
  customer-support/
    ticket-triage.bpmn
  finance/
    invoice-approval.bpmn
```

BPMN XML should be treated as the source of truth. Generated LangGraph code should be treated as output derived from the XML.

