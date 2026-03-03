export function generateOrderId(){

const timestamp = Date.now().toString(36)

const random = Math.random().toString(36).substring(2,7)

return `PMP-${timestamp}-${random}`.toUpperCase()

}