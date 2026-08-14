import re

with open("app/admin/page.tsx", "r") as f:
    content = f.read()

# Add framer-motion import
if "framer-motion" not in content:
    content = content.replace('import { useState', 'import { motion } from "framer-motion"\nimport { useState')

old_modal_start = """<div className="relative w-[min(980px,94vw)] mt-[8vh] mx-auto rounded-3xl border border-gray-200 dark:border-white/20 bg-white/85 dark:bg-black/80 backdrop-blur-3xl shadow-[0_20px_80px_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">"""

new_modal_start = """<motion.div 
            drag 
            dragMomentum={false}
            className="relative w-[min(980px,94vw)] mt-[8vh] mx-auto rounded-3xl border border-gray-200 dark:border-white/20 bg-white/85 dark:bg-black/80 backdrop-blur-3xl shadow-[0_20px_80px_rgba(0,0,0,0.45)] flex flex-col"
            style={{ maxHeight: "85vh", resize: "both", overflow: "hidden" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10 cursor-move">"""

content = content.replace(old_modal_start, new_modal_start)

# The content body inside needs overflow-y-auto
old_content_body = """<div className="p-5 space-y-5">"""
new_content_body = """<div className="p-5 space-y-5 overflow-y-auto flex-1">"""
content = content.replace(old_content_body, new_content_body)

# Replace the closing div of the modal with motion.div
# This is a bit tricky, let's replace the one right after 
old_end = """              </div>
            </div>
          </div>
        </div>
      ) : null}"""
new_end = """              </div>
            </div>
          </motion.div>
        </div>
      ) : null}"""
content = content.replace(old_end, new_end)

with open("app/admin/page.tsx", "w") as f:
    f.write(content)
