"use client"

import { useState } from "react"

export default function OrderForm(){

const [form,setForm] = useState({
name:"",
branch:"",
section:"",
year:"",
rollNumber:"",
pages:"",
printType:"bw"
})

const handleChange = (e:any)=>{
setForm({...form,[e.target.name]:e.target.value})
}

const handleSubmit = (e:any)=>{
e.preventDefault()

const message =
`New Print Order

Name: ${form.name}
Branch: ${form.branch}
Section: ${form.section}
Year: ${form.year}
Roll No: ${form.rollNumber}
Pages: ${form.pages}
Print Type: ${form.printType}

Please attach file.`

const url =
`https://wa.me/919793404007?text=${encodeURIComponent(message)}`

window.open(url,"_blank")
}

return(

<form className="order-form" onSubmit={handleSubmit}>

<h2>Place Your Order</h2>

<div className="form-grid">

<div className="input-group">
<label>Full Name</label>
<input name="name" onChange={handleChange} required/>
</div>

<div className="input-group">
<label>Branch</label>
<input name="branch" onChange={handleChange} required/>
</div>

<div className="input-group">
<label>Section</label>
<input name="section" onChange={handleChange} required/>
</div>

<div className="input-group">
<label>Academic Year</label>
<input name="year" onChange={handleChange} required/>
</div>

<div className="input-group">
<label>Roll Number</label>
<input name="rollNumber" onChange={handleChange} required/>
</div>

<div className="input-group">
<label>Number of Pages</label>
<input name="pages" type="number" onChange={handleChange} required/>
</div>

</div>

<div className="input-group">

<label>Print Type</label>

<select name="printType" onChange={handleChange}>

<option value="bw">Black & White</option>
<option value="color">Color</option>
<option value="glossy">Glossy</option>

</select>

</div>

<br/>

<button className="order-btn">
Place Order via WhatsApp
</button>

</form>

)
}