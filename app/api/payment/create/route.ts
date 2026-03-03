// import { NextResponse } from "next/server"
// import razorpay from "@/lib/razorpay"

// export async function POST(req:Request){

// const body = await req.json()

// const order = await razorpay.orders.create({
// amount: body.amount * 100,
// currency: "INR",
// receipt: "receipt_"+Date.now()
// })

// return NextResponse.json(order)

// }
import { NextResponse } from "next/server"
import Razorpay from "razorpay"

export async function POST(req: Request) {

  try {

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({
        success: false,
        message: "Payment system not configured yet"
      })
    }

    const body = await req.json()

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })

    const order = await razorpay.orders.create({
      amount: body.amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    })

    return NextResponse.json(order)

  } catch (error) {

    console.log("RAZORPAY ERROR:", error)

    return NextResponse.json({
      success: false,
      message: "Payment failed"
    })

  }

}