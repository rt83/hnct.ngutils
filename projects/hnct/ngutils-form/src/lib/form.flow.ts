
import {EventEmitter, Output, Directive, OnInit,
    HostListener, Input, ViewContainerRef, TemplateRef, EmbeddedViewRef,
    OnChanges,  SimpleChanges,  OnDestroy, Optional, Host, AfterViewInit, ChangeDetectorRef} from "@angular/core"
import * as jose from 'jose'
import { ActivatedRoute } from "@angular/router";
import { FormGroup, UntypedFormGroup, AbstractControl, NgControl, ControlContainer, FormGroupDirective, FormGroupName, FormArrayName, UntypedFormArray } from "@angular/forms";
import { FormBuildingResult, ValidationWrapper } from "./form.util";
import { BehaviorSubject } from "rxjs";


@Directive({
    selector: "[form-flow-submit]"
})
export class FormFlowSubmit {

    @Input("form-flow-submit")
    formFlow? : FormFlow

    constructor() {}

    @HostListener("click", ["$event"])
    onSubmit() {
        this.formFlow?.startSearchProcess()
    }
}

export interface FormFlowNavigationData {
    params : any,
    actualData : any
}

export interface FormFlowSubmitEvent {
    data : any,
    from : "Params" | "Form"
}

export interface FormFlowContext {
    $implicit : any
    fflow : FormFlow
}

const __FORMFLOW_JWT_ALG = "HS256"  // we don't need to be so secure, because this only includes data stored inside search fields, which is public anyway
const __FORMFLOW_JWT_DEFAULT_KEY = 'RTJBMjg5Qjc5OUU4QkJFNzUyOEMyNDE2ODdDODZBQkNDMjMyMzQyMzQ';  // a random key in base64 encoded from a 256 bit (minimum) string 
var __FORMFLOW_JOSE_KEY : jose.KeyLike | Uint8Array | undefined = undefined;

/**
 * This directive implements a common form submitting flow which
 * involves setting forms from query parameters.
 */
@Directive({
  selector: '[fflow]',
  exportAs: 'fflow',
})
export class FormFlow implements OnInit, AfterViewInit {
  private curData: any;

  @Input('fflowJwtKey')
  jwtKey: string = __FORMFLOW_JWT_DEFAULT_KEY

  @Input('fflowParamKey')
  paramKey: string = 'searchData';

  form?: FormGroup;

  @Input('fflowBy')
  builder?: (data?: any) => FormBuildingResult;

  valMsges?: ValidationWrapper;

  /**
   * When user click the search button of the form, this component
   * will encode the form into JWT. Search action should be trigger
   * through using the router to navigate to a route with the same
   * path as current path but with a query param searchData=[the JWT]
   */
  @Input('fflowNav')
  needNavigation?: (data: FormFlowNavigationData) => void;

  /**
   * Submit action is navigationally triggered. This means that it only
   * produces event when the route with a query parameter searchData
   * is visited
   */
  @Input('fflowSubmit')
  submit?: (data: FormFlowSubmitEvent) => void;

  @Output()
  onReady: EventEmitter<boolean> = new EventEmitter();

  @Input('fflowNoNav')
  noNavigation = false;

  @Input('fflowIgnoreInit')
  ignoreInit = true;

  onFormReset = new EventEmitter<UntypedFormGroup>();

  viewRef?: EmbeddedViewRef<any>;

  constructor(
    private route: ActivatedRoute,
    private viewContainer: ViewContainerRef,
    private templateRef: TemplateRef<FormFlowContext>,
    private detector : ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(async (p) => {
      this.curData = await this.createCriteriaFromParams(p);

      let shouldNavigate = false;

      if (this.curData) {
        if (this.builder) {
          let result = this.builder(this.curData);
          this.form = result.control as UntypedFormGroup;
          this.valMsges = result.valMsges;
        }

        if (this.submit) this.submit({ data: this.curData, from: 'Params' });
      } else {
        // if no params available, build the default form if the builder is available
        if (this.builder) {
          let result = this.builder(this.curData);
          this.form = result.control as UntypedFormGroup;
          this.valMsges = result.valMsges;
        }

        if (this.form) shouldNavigate = !this.ignoreInit;
      }

      // after initialization is done
      this.createView();

      if (shouldNavigate) this.startSearchProcess(this.curData);
      else this.onReady.emit(true);
    });
  }

  ngAfterViewInit(): void {
      setTimeout(() => this.detector.detectChanges())
  }

  createView() {
    this.viewContainer.clear();
    if (this.templateRef)
      this.viewRef = this.viewContainer.createEmbeddedView(this.templateRef, {
        $implicit: this.form,
        fflow: this,
      });
  }

  async getKeyObj(k : string) : Promise<jose.KeyLike | Uint8Array> {

    if (!__FORMFLOW_JOSE_KEY)
      __FORMFLOW_JOSE_KEY = await jose.importJWK({
        "kty" : "oct",
        "k": __FORMFLOW_JWT_DEFAULT_KEY
      }, __FORMFLOW_JWT_ALG)

    let key = __FORMFLOW_JOSE_KEY

    if (k != __FORMFLOW_JWT_DEFAULT_KEY) 
      key = await jose.importJWK({
        "kty": "oct",
        "k": k
      }, __FORMFLOW_JWT_ALG)
    
    if (!key) throw new Error("Cannot initialize jwt key object")

    return key
  }

  async startSearchProcess(data?: any) {
    let raw = data || this.getRawSearchData();

    let key = await this.getKeyObj(this.jwtKey)

    if (!this.noNavigation) {
      let searchToken = await new jose.SignJWT(raw).setProtectedHeader({alg: __FORMFLOW_JWT_ALG}).sign(key)

      let params: any = {};
      params[this.paramKey] = searchToken;

      if (this.needNavigation) this.needNavigation({
        params: params,
        actualData: raw,
      });
    } else {
      if (this.submit)
        this.submit({ data: raw, from: 'Form' });
    }
  }

  getRawSearchData() {
    let raw = this.form?.getRawValue();

    return raw;
  }

  async createCriteriaFromParams(params?: { [key: string]: any }) {
    let c: any = null;

    let key = await this.getKeyObj(this.jwtKey)

    if (params) {
      let p = params[this.paramKey];

      if (p) {
        let verified = await jose.jwtVerify(p, key)
        c = verified.payload
      }
    }

    return c;
  }

  canSubmit() {
    return this.form && this.form.dirty && this.form.valid;
  }

  dirty() {
    return this.form && this.form.dirty;
  }

  reset(newData: any) {
    if (!this.builder) throw new Error("Builder for form has not been set!")
    if (!this.viewRef) throw new Error("View reference has not been initialized. The reset must be called after the form constructed successfully at least once.")

    this.curData = newData || this.curData;
    let result = this.builder(this.curData);
    this.form = result.control as UntypedFormGroup;
    this.valMsges = result.valMsges;
    this.viewRef.context.$implicit = this.form;
    this.onFormReset.next(this.form);
  }
}

export interface FormBindAware {
    updateForm(form : AbstractControl) : any
}

export interface ErrorModel {
    key : string
    msg : string
}

/**
 * This is used to bind the form instance and inform ferror or other directives on form binding change so that they
 * can react accordingly. This is developed to support reset of form.
 *
 * Using formGroup.reset(oldData) is not desirable because if there are new control added, reseting will not remove the newly
 * added control. Hence, the strategy for resetting is recreate the whole form. However, directive such as [ferror] is not aware
 * of the new form instance and continue to monitor old form instance.
 *
 */
@Directive({
    selector: "[ferrcoord]"
})
export class FormErrorCoordinator implements OnInit {

    @Input("ferrcoord")
    flow? : FormFlow

    directives : FormBindAware[] = []
    form?: FormGroup;

    addDirective(bindAware : FormBindAware) {
        this.directives.push(bindAware)
    }

    removeDirective(bindAware : FormBindAware) {
        var i = 0
        for (; i < this.directives.length; i++)
            if (this.directives[i] === bindAware) break

        this.directives.splice(i,1)
    }

    ngOnInit() {
        if (!this.flow) throw new Error("The form error coordinator has not been initialized correctly. It needs to be used together with form flow.")

        this.flow?.onFormReset.subscribe(newForm => {
            if (!newForm) throw new Error("Cannot reset a form using an undefined form!")
            this.form = newForm
            this.directives.forEach(d => d.updateForm(this.form!))
        })
    }

}

/**
 * A directive to set error for a form control / container. It is designed to work
 * with FormControl, FormGroup, and FormArray. The form has to be created using FormCreator below.
 *
 * The form error directive obtains the control/container instance it needs to monitor for
 * errors through dependency injection.
 */
@Directive({
    selector: "[ferror]",
    exportAs : "ferror"
})
export class FormError implements OnInit, FormBindAware, OnDestroy {

    // out that emit the error whenever it can detects one
    @Output('ferrorChange') udpate  = new EventEmitter<ErrorModel | undefined >() // can emit null to clear the error message
    @Input('ferror') currentErrorMessage : ErrorModel | undefined = undefined
    error$  = new BehaviorSubject<ErrorModel | null>(null)

    control : AbstractControl | null = null
    // note that this is set when the control OWN VALIDATORS return valid. It doesn't coincide the validity of the control
    // for example, if the control is a FormGroup and one of its internal control is not valid, the FormGroup validity is FALSE
    // but if the FormGroup validator return VALID then this value is TRUE.
    isLastValid : boolean = false

    errorMessages : any

    constructor(
        @Optional() private ngControl : NgControl,
        @Optional() private group : ControlContainer,
        private coordinator : FormErrorCoordinator) {}

    ngOnInit() {
        let path : string[]

        if (this.ngControl) {

            this.control = this.ngControl.control
            this.control!.statusChanges.subscribe(this.tryUpdateError.bind(this, this.control!))

            if (!this.ngControl.path) throw new Error("Some control's path is null: "+this.ngControl.name)

            path = this.ngControl.path

        } else if (this.group) {
            if (this.group instanceof FormGroupDirective) this.control = this.group.form
            else if (this.group instanceof FormGroupName || this.group instanceof FormArrayName) this.control = this.group.control

            if (!this.group.path) throw new Error("Some control group's path is null: "+this.group.name)

            path = this.group.path

            if (!this.control) throw new Error("Unable to find any control for group "+this.group.name)

            this.control!.valueChanges.subscribe(this.tryUpdateError.bind(this, this.control))
        }

        // try to find the correct error msg base on the path
        // error message is stored within the form flow object, with structure correspond to the control
        let start = this.coordinator.flow!.valMsges

        if (!start) throw new Error("No error message configured! [Ferror] directive should only be used when there are error messages configured for the formed through the form creator. Check read me for more details.")

        for (var p of path!)
            if (!(start!.children as any)[p]) throw { error: "Cannot find error message for path. [Ferror] directive used on certain form control should have its error messages configured.", data: path! }
            else start = (start!.children as any)[p]

        this.errorMessages = start!.msges

        if (this.coordinator) this.coordinator.addDirective(this as FormBindAware)
    }

    @HostListener('blur')
    checkBlur() {
        if (this.control && this.control.pristine) {
            this.tryUpdateError(this.control)
        }
    }

    tryUpdateError(control : AbstractControl) {

        if (control.invalid) {
            if (control.errors) {
                this.extractAndEmitFirstError(control)
            }

            if (control instanceof UntypedFormGroup || control instanceof UntypedFormArray) {
                // the group's own validators might be returning valid, but one of the internal control of the group
                // is not valid, resulting in the overall invalidity of the group.
                // In this case, we want to clear the errors created by the group's own validators.
                if (!control.errors && !this.isLastValid) {
                    this.isLastValid = true
                    this.udpate.emit(undefined)

                    return
                }
            }
        } else if (control.valid && !this.isLastValid) {
            this.udpate.emit(undefined)    // clear error if this time is valid and last time was not valid
        }

        this.isLastValid = control.valid

    }


    /**
     * TODO: Define the structure of messages / errors and allow custom interpretation of the error message. This is because sometimes validator method
     * might produce error object with more than just a format of { '<code>' : '<message string>' }. One possible way is the user can attach an
     * interpreter in the messages object for example:
     *
     * Errors can be: { '<code>' : <some complicated error object> } --> produced by validation function
     * Messages can be  { '<code> : <some interpreter which understand the error object> } --> this is attached to the control and the intepreter will be used
     * to produce the error messages from the error object.
     *
     * @param errors the errors of a control or control container
     * @param messages the messages map which contains the validation messages
     */
    extractAndEmitFirstError(control : AbstractControl) {
        let errors : any = undefined

        if (control.errors) errors = control.errors
        else return

        let messages = this.errorMessages

        for (var key in errors) {
            if (messages && messages[key])
                this.udpate.emit({ key : key, msg: messages[key] })
            else if (errors[key])
                this.udpate.emit({key : key, msg: errors[key]})
            else this.udpate.emit({ key : key, msg : key })

            return
        }
    }

    updateForm(form : AbstractControl) {
        var path : string[] = []

        if (this.ngControl) path = this.ngControl.path!
        else if (this.group) path = this.group.path!

        var c = form.get(path)

        if (c) {
            this.control = c

            if (this.ngControl) {
                this.control.statusChanges.subscribe(this.tryUpdateError.bind(this, this.control))
            } else if (this.group) {
                this.control.valueChanges.subscribe(this.tryUpdateError.bind(this, this.control))
            }
        }
    }

    ngOnDestroy() {
        if (this.coordinator) this.coordinator.removeDirective(this)
    }

}
