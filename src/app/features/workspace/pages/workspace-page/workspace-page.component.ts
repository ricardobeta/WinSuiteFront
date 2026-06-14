import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-workspace-page',
  imports: [],
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.scss'
})
export class WorkspacePageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly pageData = toSignal(
    this.route.data.pipe(
      map((data) => ({
        module: (data['module'] as string) ?? 'Workspace',
        page: (data['page'] as string) ?? 'Dashboard'
      }))
    ),
    {
      initialValue: {
        module: 'Workspace',
        page: 'Dashboard'
      }
    }
  );
}
