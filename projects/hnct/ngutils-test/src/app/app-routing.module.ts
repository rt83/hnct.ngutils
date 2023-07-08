import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DemoForm } from './demo-form.cmp';

const routes: Routes = [
  {path: "", component: DemoForm, pathMatch: "full"}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
