import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ReactiveFormsModule } from '@angular/forms';
import { DemoForm } from './demo-form.cmp';
import { FormUtilModule } from '@hnct/ngutils-form';

@NgModule({
  declarations: [
    AppComponent,
    DemoForm
  ],
  imports: [
    FormUtilModule,
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
