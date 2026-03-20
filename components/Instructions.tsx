"use client"

import { useState } from "react"

export default function Instructions() {

  const [open, setOpen] = useState(false)

  return (
    <div className={`instructions-container ${open ? "active" : ""}`}>
      <div
        className="instructions-btn "
        onClick={() => setOpen(!open)}
      >
        Instructions
      </div>

      {open && (
        <div className="instructions-content">
          <ul>
            <li>1. Fill the form with your details</li>
            <li>2. Attach the file manually in WhatsApp</li>
            <li>3. Ensure files are PDF / DOC / DOCX / JPG / JPEG / PNG</li>
            <li>4. Wait for order acceptance</li>
            <li>5. Collect hardcopy within 1-2 days</li>
          </ul>
        </div>
      )}
    </div>
  )
}
