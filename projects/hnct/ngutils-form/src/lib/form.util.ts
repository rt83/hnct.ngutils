import {
    UntypedFormGroup, 
    UntypedFormBuilder, 
    UntypedFormControl, 
    UntypedFormArray, 
    ValidatorFn, 
    AsyncValidatorFn, 
    AbstractControl} from "@angular/forms"
import { isArray, isObject, isPrimitive } from "./util"


export const VALIDATION_MESSAGE_KEY = "__val_msgs__"
// For a form group or form array, the validation can
// happens at individual field or for the whole group or array.
// in the case we want to have validation for the whole group, the validation definition
// defined in the field __self__ of the validator object will be used for the form group
// Further more, if the field __fields__ is present, the validation definition defined by this
// field will be used for the other fields of the form group
// example :
// An object of following format
// {
//     abc : ""
//     pqr : ""
// }
// and the validation definition of following format
// {
//     __self__ : [Validators.required],
//     __fields__ : {
//         abc : [Validators.minlength(10)]
//         pqr : [Validators.maxlength(20)]
//     }
// }
export const SELF_KEY : string = "__self__"
export const FIELD_KEY : string = "__fields__"
// sometimes, we don't want to build an array field as an array of control, but instead,
// a normal form control whose value is an array. This is applicable for case such as
// multiple select form control, whose products is say, an array of string.
export const IGNORE_ARR_KEY : string = "__ignore_arr__"

type PrimitiveValDef = ValidatorFn | ValidatorFn[]
type AsyncPrimitiveValDef = AsyncValidatorFn | AsyncValidatorFn[]
type CompositeValDef = { 
    __self__ : PrimitiveValDef,
    __ignore_arr__?: boolean,
    __fields__? : ValDef
}

type ValDef = CompositeValDef | PrimitiveValDef | {
    [key : string] : ValDef
} | ValDef[]

type AsyncCompositeValDef = { 
    __self__ : AsyncPrimitiveValDef,
    __ignore_arr__?: boolean,
    __fields__? : AsyncValDef
}

type AsyncValDef = AsyncCompositeValDef | AsyncPrimitiveValDef | {
    [key : string] : AsyncCompositeValDef | AsyncPrimitiveValDef | AsyncValDef
} | AsyncValDef[]

export interface FormSaveEvent<T> {
    oldData : T
    newData : T
}

export interface FormBuildingResult {
    control : AbstractControl
    valMsges : ValidationWrapper
}

type FormGroupValidationWrapper = { [k : string] : ValidationWrapper }

export interface ValidationWrapper {
    controlType: typeof UntypedFormArray | typeof UntypedFormControl | typeof UntypedFormGroup
    msges : any
    children? : FormGroupValidationWrapper | ValidationWrapper[]
}

/**
 * Form creator allows creating reactive forms from object. Fields of objects will be converted to 
 * corresponding form control. If validators and validation messages are set, they will be added
 * correspondingly. The validation messages will be put in the form control so that FormError
 * directive can use directly.
 */
export class FormCreator {
    
    msges: any;
    v: ValDef | undefined = undefined;
    aV: AsyncValDef | undefined = undefined;
    options: { updateOn: "change" | "blur" | "submit" } 

    constructor(private builder : UntypedFormBuilder, private data : any, options?: { updateOn :  "change" | "blur" | "submit" }) {
        this.options = options || { updateOn: 'change' }
    }

    asyncValidators(asyncs : AsyncValDef) : FormCreator {
        this.aV = asyncs

        return this
    }

    validators(syncs : ValDef) : FormCreator {
        this.v = syncs

        return this
    }

    validatorMessages(msges : any) : FormCreator {
        this.msges = msges

        return this
    }

    build() : FormBuildingResult {
        return this.buildObject(this.data, this.v, this.aV, this.msges)
    }

    buildObject(data : any, v : ValDef | undefined, aV : AsyncValDef | undefined, msges : any) : FormBuildingResult {
        var formGroup = this.builder.group({})
        var result : FormBuildingResult = {
            control : formGroup,
            valMsges: {
                controlType: UntypedFormGroup,
                msges: null
            }
        }

        if (v) {
            if ((v as CompositeValDef).__self__) formGroup.setValidators((v as CompositeValDef).__self__)
            if ((v as CompositeValDef).__fields__) v = (v as CompositeValDef).__fields__
        }

        if (aV) {
            if ((aV as AsyncCompositeValDef).__self__) formGroup.setAsyncValidators((aV as AsyncCompositeValDef).__self__)
            if ((aV as AsyncCompositeValDef).__fields__) aV = (aV as AsyncCompositeValDef).__fields__
        }
        
        
        if (msges) {
            // attach the corresponding validation messages to the form group so that form error directive can use
            if (msges[SELF_KEY]) result.valMsges.msges = msges[SELF_KEY]
            if (msges[FIELD_KEY]) msges = msges[FIELD_KEY]
        }
        
        let valChildren : FormGroupValidationWrapper = {}

        for (let key in data) {
            let value = data[key]
            let childResult : FormBuildingResult = this.buildFieldOrIndex(key, value, v, aV, msges)
            
            formGroup.addControl(key, childResult.control);

            valChildren[key] = childResult.valMsges
        }

        result.valMsges.children = valChildren

        return result
    }

    buildFieldOrIndex(
        key : string | number, value : any | any[], v : ValDef | ValDef[] | undefined, 
        aV : AsyncValDef | AsyncValDef[] | undefined, msges : any | any[]) : FormBuildingResult {

        if (v && (v as any)[key]) v = (v as any)[key] 
        else v = undefined
        if (aV && (aV as any)[key]) aV = (aV as any)[key]
        else aV = undefined
        if (msges && msges[key]) msges = msges[key]
        else msges = null

        if (!value || isPrimitive(value)) return this.buildPrimitive(value, v as ValDef, aV as AsyncValDef, msges)
        else if (isArray(value)) return this.buildArray(value, v as ValDef, aV as AsyncValDef, msges)
        else return this.buildObject(value, v as ValDef, aV as AsyncValDef, msges)
    }

    buildPrimitive(value : any, v : ValDef, aV : AsyncValDef, msges : any) : FormBuildingResult {

        let c = new UntypedFormControl(value, {updateOn: this.options.updateOn })

        var result : FormBuildingResult = {
            control: c,
            valMsges: {
                controlType: UntypedFormControl,
                msges: undefined
            }
        }

        if (v) c.setValidators(v as ValidatorFn | ValidatorFn[])
        if (aV) c.setAsyncValidators(aV as AsyncValidatorFn | AsyncValidatorFn[])
        if (msges) result.valMsges.msges = msges

        return result
    }

    buildArray(values : any[], v : ValDef | undefined, aV : AsyncValDef | undefined, msges : any) : FormBuildingResult {

        let ignore_array = (v && isObject(v) && (v as CompositeValDef).__ignore_arr__) || 
                            (aV && isObject(aV) && (aV as AsyncCompositeValDef).__ignore_arr__)

        var arr = ignore_array ? this.builder.control(values) : this.builder.array([])
        let result : FormBuildingResult = {
            control : arr,
            valMsges : {
                controlType : ignore_array? UntypedFormControl : UntypedFormArray,
                msges: undefined
            }
        }
        
        // if the validator is an object and not an array, we have to search for SELF_KEY as the user might want overall array validation
        if (v && isObject(v)) {
            if ((v as CompositeValDef).__self__) arr.setValidators((v as CompositeValDef).__self__)
            if ((v as CompositeValDef).__fields__) v = (v as CompositeValDef).__fields__
        }

        // if the validator is an object and not an array, we have to search for SELF_KEY as the user might want overall array validation
        if (aV && isObject(v)) {
            if ((aV as AsyncCompositeValDef).__self__) arr.setAsyncValidators((aV as AsyncCompositeValDef).__self__)
            if ((aV as AsyncCompositeValDef).__fields__) aV = (aV as AsyncCompositeValDef).__fields__
        }

        if (msges && isObject(msges)) {
            if (msges[SELF_KEY]) result.valMsges.msges = msges[SELF_KEY]
            if (msges[FIELD_KEY]) msges = msges[FIELD_KEY]
        }
        
        if (!ignore_array) {
            let valChildren : ValidationWrapper[] = []
            let arr1 = arr as UntypedFormArray

            for (let index = 0; index < values.length; index++) {
                let element = values[index]
                let r = this.buildFieldOrIndex(index, element, v, aV, msges)
                valChildren.push(r.valMsges)
                arr1.push(r.control)
            }

            result.valMsges.children = valChildren
        }

        return result
    }
}