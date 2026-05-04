import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import hljs from 'highlight.js';
import { BpmnModelerService } from './bpmn-modeler.service';
import { LangGraphConverterService } from './langgraph-converter.service';
import {
  CodeLanguage,
  NodeScript,
  ScriptLanguage,
  SelectedElementInfo,
} from './workflow.types';

@Component({
  selector: 'app-workflow-studio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSidenavModule,
    MatSnackBarModule,
    MatTabsModule,
    MatToolbarModule,
  ],
  templateUrl: './workflow-studio.component.html',
  styleUrl: './workflow-studio.component.scss',
})
export class WorkflowStudioComponent implements AfterViewInit, OnDestroy {
  @ViewChild('bpmnCanvas', { static: true }) bpmnCanvas!: ElementRef<HTMLElement>;
  @ViewChild('camundaProperties', { static: true }) camundaProperties!: ElementRef<HTMLElement>;
  @ViewChild('fileInput', { static: true }) fileInput!: ElementRef<HTMLInputElement>;

  xml = '';
  output = '';
  outputLanguage: CodeLanguage = 'typescript';
  scriptLanguage: ScriptLanguage = 'typescript';
  status = 'Ready';
  selectedElement: SelectedElementInfo | null = null;
  currentScript: NodeScript = {
    language: 'typescript',
    annotationId: '',
    functionName: 'workflow_node',
    args: 'state',
    body: `return { output: state.input ?? '' };`,
  };
  private scripts: Record<string, NodeScript> = {};

  constructor(
    private readonly bpmn: BpmnModelerService,
    private readonly converter: LangGraphConverterService,
    private readonly snackBar: MatSnackBar,
  ) {}

  async ngAfterViewInit(): Promise<void> {
    await this.bpmn.mount(this.bpmnCanvas.nativeElement, this.camundaProperties.nativeElement);
    this.bpmn.onSelectionChanged((selection) => {
      this.persistCurrentScript();
      this.selectedElement = selection;
      this.loadSelectedScript();
    });
    await this.refreshXml();
    this.generate();
  }

  ngOnDestroy(): void {
    this.bpmn.destroy();
  }

  async clear(): Promise<void> {
    await this.bpmn.clear();
    this.scripts = {};
    this.selectedElement = null;
    this.currentScript = this.converter.defaultScript('', '', this.scriptLanguage);
    await this.refreshXml();
    this.generate();
    this.showStatus('Workflow reset to sample Camunda XML');
  }

  openFile(): void {
    this.fileInput.nativeElement.value = '';
    this.fileInput.nativeElement.click();
  }

  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const xml = await file.text();
      await this.bpmn.importXml(xml);
      this.xml = xml;
      this.generate();
      this.showStatus(`Imported ${file.name}`);
    } catch (error) {
      this.showStatus(error instanceof Error ? error.message : 'Unable to import BPMN XML');
    }
  }

  async exportXml(): Promise<void> {
    await this.refreshXml();
    this.download(this.xml, 'camunda-langgraph-workflow.bpmn', 'application/xml');
    this.showStatus('BPMN XML exported');
  }

  async refreshXml(): Promise<void> {
    this.xml = await this.bpmn.exportXml();
  }

  async generate(): Promise<void> {
    this.persistCurrentScript();
    await this.refreshXml();
    try {
      this.output = this.renderOutput();
      this.showStatus(`Generated ${this.outputLanguage.toUpperCase()} LangGraph workflow`);
    } catch (error) {
      this.output = error instanceof Error ? error.message : 'Unable to convert BPMN XML';
      this.showStatus(this.output);
    }
  }

  clearOutput(): void {
    this.output = '';
    this.showStatus('Generated code cleared');
  }

  exportOutput(): void {
    const extension = this.outputLanguage === 'typescript'
      ? 'ts'
      : this.outputLanguage === 'javascript'
        ? 'js'
        : this.outputLanguage === 'python'
          ? 'py'
          : this.outputLanguage;
    const mime = this.outputLanguage === 'json' ? 'application/json' : 'text/plain';
    this.download(this.output || this.renderOutput(), `langgraph-workflow.${extension}`, mime);
    this.showStatus('Generated code exported');
  }

  updateElementName(name: string): void {
    if (!this.selectedElement) {
      return;
    }
    this.selectedElement = { ...this.selectedElement, name };
    this.bpmn.updateSelectedElement(this.selectedElement.id, { name });
    this.currentScript.functionName = this.converter.defaultScript(this.selectedElement.id, name, this.scriptLanguage).functionName;
  }

  updateElementId(id: string): void {
    if (!this.selectedElement || !id || id === this.selectedElement.id) {
      return;
    }
    const oldId = this.selectedElement.id;
    this.bpmn.updateSelectedElement(oldId, { id });
    this.scripts[id] = { ...this.currentScript, annotationId: id };
    delete this.scripts[oldId];
    this.selectedElement = { ...this.selectedElement, id };
  }

  changeScriptLanguage(language: ScriptLanguage): void {
    this.scriptLanguage = language;
    this.currentScript = {
      ...this.currentScript,
      language,
      body: language === 'python'
        ? 'return {"output": state.get("input", "")}'
        : `return { output: state.input ?? '' };`,
    };
    this.persistCurrentScript();
  }

  get highlightedOutput(): string {
    if (!this.output) {
      return '';
    }
    const language = this.outputLanguage === 'xml' ? 'xml' : this.outputLanguage;
    try {
      return hljs.highlight(this.output, { language }).value;
    } catch {
      return hljs.highlightAuto(this.output).value;
    }
  }

  get selectedSummary(): string {
    if (!this.selectedElement) {
      return 'No element selected';
    }
    return `${this.selectedElement.type.replace('bpmn:', '')} / ${this.selectedElement.id}`;
  }

  private renderOutput(): string {
    switch (this.outputLanguage) {
      case 'xml':
        return this.xml;
      case 'json':
        return this.converter.toJson(this.xml, this.scripts);
      case 'javascript':
        return this.converter.toJavaScript(this.xml, this.scripts);
      case 'python':
        return this.converter.toPython(this.xml, this.scripts);
      case 'typescript':
      default:
        return this.converter.toTypeScript(this.xml, this.scripts);
    }
  }

  private persistCurrentScript(): void {
    if (!this.selectedElement?.id) {
      return;
    }
    this.scripts[this.selectedElement.id] = {
      ...this.currentScript,
      language: this.scriptLanguage,
    };
  }

  private loadSelectedScript(): void {
    if (!this.selectedElement) {
      this.currentScript = this.converter.defaultScript('', '', this.scriptLanguage);
      return;
    }
    const script = this.scripts[this.selectedElement.id];
    this.currentScript = script || this.converter.defaultScript(
      this.selectedElement.id,
      this.selectedElement.name,
      this.scriptLanguage,
    );
  }

  private download(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private showStatus(message: string): void {
    this.status = message;
    this.snackBar.open(message, 'OK', { duration: 2200 });
  }
}
