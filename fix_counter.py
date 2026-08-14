with open("app/user/dashboard/page.tsx", "r") as f:
    content = f.read()

if "let fileIdCounter = 0" not in content:
    content = content.replace("export default function Dashboard", "let fileIdCounter = 0\n\nexport default function Dashboard")

with open("app/user/dashboard/page.tsx", "w") as f:
    f.write(content)
