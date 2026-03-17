import SupplierNavbar from "@/components/SupplierNavbar"

export default function SupplierLayout({
  children
}:{
  children:React.ReactNode
}){

return(

<div className="min-h-screen bg-transparent dark:bg-black text-gray-900 dark:text-white">

<SupplierNavbar/>

{/* wider container */}

<div className="max-w-[1500px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10">
{children}
</div>

</div>

)

}
