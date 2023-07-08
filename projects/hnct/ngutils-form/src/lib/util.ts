export function isPrimitive(value : any) {
    let typeofValue = typeof value
    if (typeofValue === 'object' || typeofValue === "function" || Array.isArray(value)) 
        return false
    return true
}

export function isObject(value : any) {
    if (typeof value === "object") return true
    else return false
}

export function isArray(value : any) {
    return Array.isArray(value)
}