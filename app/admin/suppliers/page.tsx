"use client"

import { useEffect,useState } from "react"

export default function AdminSuppliers(){

const [suppliers,setSuppliers] = useState([])

const load = async()=>{

const res = await fetch("/api/admin/suppliers")

const data = await res.json()

setSuppliers(data.suppliers)

}

useEffect(()=>{
load()
},[])

const approve = async(id:string)=>{

await fetch("/api/admin/approve-supplier",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({id})

})

load()

}

return(

<div style={{padding:"40px"}}>

<h1>Supplier Requests</h1>

{suppliers.map((s:any)=>(

<div key={s._id}>

<p>{s.name}</p>

<button onClick={()=>approve(s._id)}>
Approve
</button>

</div>

))}

</div>

)

}