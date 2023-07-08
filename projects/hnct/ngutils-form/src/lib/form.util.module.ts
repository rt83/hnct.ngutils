import { NgModule } from "@angular/core";
import { FormFlow, FormFlowSubmit, FormError, FormErrorCoordinator } from "./form.flow";

@NgModule({
    declarations: [FormError, FormErrorCoordinator, FormFlow, FormFlowSubmit],
    exports: [FormError,  FormErrorCoordinator, FormFlow, FormFlowSubmit]
})
export class FormUtilModule {

}