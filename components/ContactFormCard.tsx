"use client"

import { FormEvent, useState } from "react"

type SubmitStatus = {
  type: "success" | "error"
  message: string
} | null

export default function ContactFormCard(){

const [hover,setHover] = useState(false)
const [name,setName] = useState("")
const [email,setEmail] = useState("")
const [message,setMessage] = useState("")
const [website,setWebsite] = useState("")
const [isSubmitting,setIsSubmitting] = useState(false)
const [status,setStatus] = useState<SubmitStatus>(null)

async function handleSubmit(e: FormEvent<HTMLFormElement>){
e.preventDefault()

if(isSubmitting) return

const payload = {
name: name.trim(),
email: email.trim(),
message: message.trim(),
website: website.trim()
}

if(!payload.name || !payload.email || !payload.message){
setStatus({
type: "error",
message: "Please fill all fields before submitting."
})
return
}

setStatus(null)
setIsSubmitting(true)

try{
const res = await fetch("/api/contact",{
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify(payload)
})

const data = await res.json().catch(()=>null)

if(!res.ok || !data?.success){
throw new Error(data?.message || "Failed to send your message.")
}

setStatus({
type: "success",
message: "Message sent successfully."
})

setName("")
setEmail("")
setMessage("")
setWebsite("")
}catch(err){
setStatus({
type: "error",
message: err instanceof Error ? err.message : "Something went wrong. Please try again."
})
}finally{
setIsSubmitting(false)
}
}

return(

<div
onMouseEnter={()=>setHover(true)}
onMouseLeave={()=>setHover(false)}
className="relative w-[340px]"
>

{/* glow border */}

<div className={`absolute -inset-[1px] rounded-[30px] blur-xl opacity-50 transition duration-500
${hover ? "bg-gradient-to-r from-indigo-500/50 via-cyan-400/40 to-indigo-500/50" : ""}
`} />


{/* glass card */}

<form
onSubmit={handleSubmit}
className="relative flex flex-col gap-6
backdrop-blur-2xl
bg-white/70 dark:bg-white/5
border border-gray-200 dark:border-white/10
shadow-[0_20px_60px_rgba(0,0,0,0.25)]
rounded-[28px]
px-8 py-10
transition-all duration-300
ease-[cubic-bezier(.34,1.56,.64,1)]
hover:scale-[1.035]
hover:-translate-y-1
hover:shadow-[0_30px_70px_rgba(0,0,0,0.45)]
active:scale-[0.97]
"
>

<h2 className="text-2xl font-semibold text-center mb-2">
Send Message
</h2>


<input
type="text"
placeholder="Name"
value={name}
onChange={(e)=>setName(e.target.value)}
required
minLength={2}
maxLength={80}
className="bg-transparent border-b border-gray-300 dark:border-white/20 focus:border-indigo-400 outline-none pb-2 placeholder:text-gray-400 transition focus:scale-[1.01]"
/>


<input
type="email"
placeholder="E-Mail I.D."
value={email}
onChange={(e)=>setEmail(e.target.value)}
required
className="bg-transparent border-b border-gray-300 dark:border-white/20 focus:border-indigo-400 outline-none pb-2 placeholder:text-gray-400 transition focus:scale-[1.01]"
/>


<textarea
placeholder="Enter message"
value={message}
onChange={(e)=>setMessage(e.target.value)}
required
minLength={10}
maxLength={2000}
className="bg-transparent border-b border-gray-300 dark:border-white/20 focus:border-indigo-400 outline-none pb-2 h-24 resize-none placeholder:text-gray-400 transition focus:scale-[1.01]"
/>

<div
className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
aria-hidden="true"
>
  <label htmlFor="contact-website">Website</label>
  <input
    id="contact-website"
    type="text"
    tabIndex={-1}
    autoComplete="off"
    value={website}
    onChange={(e)=>setWebsite(e.target.value)}
  />
</div>


<button
type="submit"
disabled={isSubmitting}
className="mt-4 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-medium transition hover:scale-[1.04] active:scale-[0.97] shadow-lg"
>

{isSubmitting ? "Sending..." : "Submit"}

</button>

{status && (
<p
role="status"
aria-live="polite"
className={`text-sm text-center ${status.type === "success" ? "text-emerald-500" : "text-red-500"}`}
>
{status.message}
</p>
)}

</form>

</div>

)
}
