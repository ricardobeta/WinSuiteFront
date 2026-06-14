import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ServiciosService } from '../../../../core/services/servicios.service';

@Component({
  selector: 'app-crear-servicio',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule
  ],
  templateUrl: './crear-servicio.component.html',
  styleUrls: ['./crear-servicio.component.scss']
})
export class CrearServicioComponent implements OnInit {
  servicioForm: FormGroup;
  servicioId: string | null = null;
  isLoading = false;
  readonly isDialogMode = !!inject(MatDialogRef<CrearServicioComponent>, { optional: true });

  private readonly dialogRef = inject(MatDialogRef<CrearServicioComponent>, { optional: true });
  private readonly dialogData = inject<{ servicioId?: string } | null>(MAT_DIALOG_DATA, {
    optional: true
  });

  constructor(
    private fb: FormBuilder,
    private serviciosService: ServiciosService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.servicioForm = this.fb.group({
      nombre: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      precio: [0, [Validators.required, Validators.min(0)]],
      impuestoPorcentaje: [12, [Validators.required, Validators.min(0), Validators.max(100)]],
      activo: [true]
    });
  }

  ngOnInit(): void {
    this.servicioId = this.dialogData?.servicioId ?? this.route.snapshot.paramMap.get('id');
    if (this.servicioId) {
      this.cargarServicio();
    }
  }

  async cargarServicio(): Promise<void> {
    if (!this.servicioId) return;

    try {
      this.isLoading = true;
      const servicio = await this.serviciosService.getServicioById(this.servicioId);
      if (servicio) {
        this.servicioForm.patchValue(servicio);
      }
    } catch (error) {
      console.error('Error cargando servicio:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async guardar(): Promise<void> {
    if (this.servicioForm.valid) {
      try {
        this.isLoading = true;
        if (this.servicioId) {
          await this.serviciosService.actualizarServicio(
            this.servicioId,
            this.servicioForm.value
          );
        } else {
          await this.serviciosService.crearServicio(this.servicioForm.value);
        }

        if (this.dialogRef) {
          this.dialogRef.close(true);
        } else {
          this.router.navigate(['/workspace/servicios/lista']);
        }
      } catch (error) {
        console.error('Error guardando servicio:', error);
      } finally {
        this.isLoading = false;
      }
    }
  }

  cancelar(): void {
    if (this.dialogRef) {
      this.dialogRef.close(false);
    } else {
      this.router.navigate(['/workspace/servicios/lista']);
    }
  }
}
