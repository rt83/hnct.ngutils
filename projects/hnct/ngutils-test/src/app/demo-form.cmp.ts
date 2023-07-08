import { Component, OnInit } from "@angular/core";
import { AbstractControl, FormBuilder, FormGroup, ValidatorFn, Validators } from "@angular/forms";
import { ErrorModel, FormBuildingResult, FormCreator, FormFlowNavigationData, FormFlowSubmitEvent } from "@hnct/ngutils-form";
import { Router, ActivatedRoute } from "@angular/router";

@Component({
    selector: "demo-form",
    templateUrl: "./demo-form.html"
})
export class DemoForm {

    formError : ErrorModel | undefined
    usernameError : ErrorModel | undefined
    passwordError : ErrorModel | undefined

    constructor(private fb : FormBuilder, private router : Router, private route : ActivatedRoute) {}

    buildForm = (data? : any) : FormBuildingResult => {

        data = data || {
            username : null,
            password : null
        }

        return new FormCreator(this.fb, data).validators({
            __self__ : [this.validateMinTotalLength()],
            __fields__: {
                username : [Validators.required],
                password : [Validators.required]
            }
        })
        .validatorMessages({
            __self__ : {
                minTotalLength: "Min total length must be >= 10"
            },
            __fields__ : {
                username : { required : "This is required" },
                password : { required : "This is required" },
            }
            
        })
        .build()
    }

    validateMinTotalLength() : ValidatorFn  {
        return (control : AbstractControl) => {
            let f = control as FormGroup
            let uName = f.get("username")
            let uPass = f.get("password")

            if (f.pristine || !uName || !uPass) {
                return null
            }

            let uname = uName.value as string
            let pword = uPass.value as string

            let unameLength = uname? uname.length : 0
            let pwordLength = pword? pword.length : 0

            if (unameLength + pwordLength < 10) return { minTotalLength : true }

            return null
        }
    }

    navigate = (event : FormFlowNavigationData) => {
        this.router.navigate(["."], {
            relativeTo: this.route,
            queryParams: event.params
        })
    }

    search = (data : FormFlowSubmitEvent) => {
        console.log("Searching " + JSON.stringify(data))
    }
}