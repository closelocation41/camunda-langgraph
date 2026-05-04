import { Component } from '@angular/core';
import { WorkflowStudioComponent } from './workflow-studio/workflow-studio.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [WorkflowStudioComponent],
  template: '<app-workflow-studio />',
})
export class AppComponent {}
